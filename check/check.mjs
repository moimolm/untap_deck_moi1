// 対応サイトの自動点検：各サイトの見本ページで d2u.js を動かし、デッキが読めて枚数チェックが通るかを確かめる。
// 実行: node check/check.mjs   （GitHub Actions から週1回）
import { chromium } from 'playwright';
import fs from 'node:fs';

const SCRIPT = fs.readFileSync(new URL('../d2u.js', import.meta.url), 'utf8');
const PAGES = [
  ['ワンピース / cardrush', 'https://cardrush.media/onepiece/articles/89'],
  ['ワンピース / TCG PORTAL', 'https://tcg-portal.jp/onepiece/tournament-results/cmu9xrc6g0001gm0aznl5q86f'],
  ['ポケモン / TCG PORTAL', 'https://tcg-portal.jp/pokemon/tournament-results/cmubbknwx001tgm0akgijsr81'],
  ['ポケモン / ポケカ公式', 'https://www.pokemon-card.com/deck/confirm.html/deckID/Qn9igQ-VM6R8C-nQ9nQg'],
  ['遊戯王 / DECK MAKER', 'https://deck-maker.com/yg/decks/new/?copiedfrom=f0be6648-bb29-4708-a04f-c4b5ba0b136c'],
  ['デュエマ / DECK MAKER', 'https://deck-maker.com/dm/decks/new/?copiedfrom=c967f869-a739-48b8-8ca7-8af2eae2386e'],
  ['デュエマ / TCG PORTAL', 'https://tcg-portal.jp/duelmasters/tournament-results/cmue5ru9t0019gm0b743rzyyd'],
  ['ヴァンガード / 公式', 'https://cf-vanguard.com/deckrecipe/events/areacup2026_s2_sapporo_2nd/'],
  ['ヴァンガード / DECK LOG', 'https://decklog.bushiroad.com/view/1QTT92'],
  ['ヴァイス / DECK LOG', 'https://decklog.bushiroad.com/view/6472W'],
  ['ヴァイス / 公式', 'https://ws-tcg.com/deckrecipe/?title_name=%E3%81%94%E6%B3%A8%E6%96%87%E3%81%AF%E3%81%86%E3%81%95%E3%81%8E%E3%81%A7%E3%81%99%E3%81%8B%EF%BC%9F%EF%BC%9F&keyword_type%5B%5D=all'],
];
// テスト用：MOCK_DIR を指定すると、ページを「ホスト名.html」から読む
const MOCK = process.env.MOCK_DIR;

const browser = await chromium.launch();
const context = await browser.newContext({
  locale: 'ja-JP', timezoneId: 'Asia/Tokyo', viewport: { width: 1280, height: 900 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  extraHTTPHeaders: { 'Accept-Language': 'ja,en-US;q=0.8,en;q=0.6' },
});
const BLOCK_RE = /access denied|forbidden|just a moment|attention required|verify you are human|cloudflare|アクセスが拒否|海外からのアクセス|ご利用いただけません|request blocked|not available in your/i;
const results = [];
for (const [label, url, opt = {}] of PAGES) {
  const page = await context.newPage();
  let status = 'OK', detail = '', http = 0;
  try {
    // GitHub API（ワンピースの英語名データ）は Actions の共有 IP だと回数制限に当たるので、トークンを付ける
    if (process.env.GITHUB_TOKEN) await page.route('https://api.github.com/**', r => r.continue({ headers: { ...r.request().headers(), authorization: 'Bearer ' + process.env.GITHUB_TOKEN } }));
    if (MOCK) await page.route('**/*', r => { const f = `${MOCK}/${new URL(r.request().url()).hostname}.html`; return r.request().resourceType() === 'document' && fs.existsSync(f) ? r.fulfill({ contentType: 'text/html; charset=utf-8', body: fs.readFileSync(f, 'utf8') }) : r.continue(); });
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    http = res ? res.status() : 0;
    await page.waitForTimeout(/deck-maker|decklog/.test(url) ? 8000 : 3000);
    await page.evaluate(() => { try { navigator.clipboard.writeText = async () => {}; } catch (e) {} });
    await page.evaluate(SCRIPT);
    await page.waitForSelector('#c2u-body button, #c2u-body [style*="ff7b7b"]', { timeout: 90000 });
    const err = await page.$('#c2u-body [style*="ff7b7b"]');
    if (err) throw new Error('パネルのエラー: ' + (await err.textContent()));
    const decks = await page.$$eval('#c2u-body > div > div > div > b', b => b.length);
    await page.click('#c2u-body button');
    await page.waitForFunction(() => { const i = document.querySelector('.c2u-info'); return i && i.textContent.trim(); }, null, { timeout: 60000 });
    const info = (await page.textContent('.c2u-info')).replace(/\s+/g, ' ');
    const inputs = await page.$$eval('.c2u-info input[data-i]', x => x.length);
    if (/\[data-report\]|報告用にコピー/.test(info) && !/枚数/.test(info)) throw new Error('コピー時のエラー: ' + info.slice(0, 120));
    if (inputs) detail = `デッキ${decks}件・カード${inputs}種`;
    else {
      const m = info.match(/枚数(チェック：|が合いません：)[^。中]*/);
      detail = `デッキ${decks}件・` + (m ? m[0] : '枚数表示なし');
      if (!m) throw new Error('枚数チェックが表示されない: ' + info.slice(0, 120));
      if (/✗/.test(m[0]) && !opt.allowCountNG) status = 'WARN';
    }
  } catch (e) {
    status = 'NG'; detail = String(e.message || e).split('\n')[0].slice(0, 160);
    // ページの状態を記録（アクセス拒否・ボット確認の画面なら BLOCK として別扱い）
    let title = '', text = '';
    try { title = await page.title(); text = (await page.evaluate(() => document.body ? document.body.innerText.split('untapへ転送 v')[0] : '')).replace(/\s+/g, ' ').slice(0, 160); } catch (e2) {}
    if (http >= 400 || BLOCK_RE.test(title + ' ' + text)) status = 'BLOCK';
    detail += ` ／ HTTP ${http} ／ タイトル「${title.slice(0, 60)}」 ／ 本文「${text}」`;
  }
  results.push([status, label, detail, url]);
  console.log(`[${status}] ${label}: ${detail}`);
  await page.close();
}
await context.close();
await browser.close();

const ng = results.filter(r => r[0] === 'NG' || r[0] === 'WARN');
const md = ['## untapへ転送 自動点検', '', '🚫 BLOCK = GitHub（海外のサーバー）からの接続が拒否されたサイト。ツールの故障ではないので失敗扱いにしません。', '', '| 結果 | サイト | 内容 |', '|---|---|---|', ...results.map(([s, l, d, u]) => `| ${s === 'OK' ? '✅' : s === 'WARN' ? '⚠️' : s === 'BLOCK' ? '🚫' : '❌'} ${s} | [${l}](${u}) | ${d.replace(/\|/g, '/')} |`)].join('\n');
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
if (ng.length) { console.error(`\n${ng.length} サイトで問題がありました（NG=読み取り失敗、WARN=枚数が合わない）`); process.exit(1); }
