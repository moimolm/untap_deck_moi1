// テスト：npm test（結果を見本と比べる） / npm run test:update（見本を作り直す）
//   d2u.js（組み立て済みの本体）を、各サイトの「見本ページ」で動かして、
//   コピーされる内容が test/snap/<name>.txt と同じか確かめる。本物のサイトには繋がない。
//   node test/run.mjs op-    … 名前が「op-」で始まるケースだけ
import fs from 'node:fs';
import { chromium } from 'playwright';
import cases from './cases.mjs';

const root = new URL('..', import.meta.url);
const SNAP = new URL('test/snap/', root);
const update = process.argv.includes('--update');
const only = process.argv.slice(2).filter(a => !a.startsWith('--'));
const code = fs.readFileSync(new URL('d2u.js', root), 'utf8');
fs.mkdirSync(SNAP, { recursive: true });

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let fail = 0, pass = 0, made = 0;

const defaultResult = async p => {
  const info = await p.$('#c2u-panel .c2u-info');
  let shown = info ? await info.innerText() : await p.innerText('#c2u-body');
  shown = shown.split('中身を見る')[0].trim();
  return ['=== コピーされた内容 ===', await p.evaluate(() => window.__clip ?? '(コピーなし)'), '=== 表示 ===', shown].join('\n');
};

for (const c of cases) {
  if (only.length && !only.some(o => c.name.startsWith(o))) continue;
  const ctx = await browser.newContext({ locale: 'ja-JP', timezoneId: 'Asia/Tokyo' });
  await ctx.addInitScript(clip => {
    window.__clip = null;
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async t => { window.__clip = t; }, readText: async () => clip ?? '' } });
  }, c.clipboard ?? null);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  // 外への通信はすべて止め、見本だけを返す
  await page.route('**/*', async r => {
    const url = r.request().url();
    const u = new URL(url), cu = new URL(c.url);
    if (u.origin === cu.origin && u.pathname === cu.pathname) {
      return r.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><html><head><meta charset="utf-8"></head><body>${c.html}</body></html>` });
    }
    for (const [k, fn] of Object.entries(c.api || {})) {
      if (url.includes(k)) return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(fn(new URL(url))) });
    }
    return r.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: 'not found (test)' });
  });
  let out;
  try {
    await page.goto(c.url);
    await page.evaluate(code);
    await page.waitForFunction(() => { const b = document.querySelector('#c2u-body'); return b && (b.querySelector('button, [data-clip]') || /ff7b7b/.test(b.innerHTML)) && !/中…\s*$/.test(b.textContent); }, null, { timeout: 30000 });
    if (c.steps) await c.steps(page);
    else {
      await page.click('#c2u-body button');
      await page.waitForFunction(() => window.__clip || /ff7b7b/.test(document.querySelector('#c2u-body').innerHTML), null, { timeout: 30000 });
      await page.waitForTimeout(200);
    }
    out = await (c.result || defaultResult)(page);
    if (errors.length) out += '\n=== ページのエラー ===\n' + errors.join('\n');
  } catch (e) {
    out = '!!! テストが途中で止まりました: ' + e.message.split('\n')[0] + '\n' + (await page.innerText('#c2u-body').catch(() => ''));
  }
  out = out.replace(/\r/g, '').trim() + '\n';
  const f = new URL(c.name + '.txt', SNAP);
  if (update || !fs.existsSync(f)) {
    fs.writeFileSync(f, out); made++;
    console.log(`📝 ${c.name}（見本を保存）`);
  } else if (fs.readFileSync(f, 'utf8') === out) {
    pass++; console.log(`✅ ${c.name}`);
  } else {
    fail++;
    console.log(`❌ ${c.name}：見本と違います`);
    const a = fs.readFileSync(f, 'utf8').split('\n'), b = out.split('\n');
    for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { console.log(`   ${i + 1}行目\n   見本: ${a[i] ?? '(なし)'}\n   今回: ${b[i] ?? '(なし)'}`); break; }
    fs.writeFileSync(new URL(c.name + '.new.txt', SNAP), out);
  }
  await ctx.close();
}
await browser.close();
console.log(`\n合格 ${pass} ／ 不合格 ${fail}` + (made ? ` ／ 見本を保存 ${made}` : ''));
if (fail) { console.log('意図した変更なら npm run test:update で見本を更新してください（違いは test/snap/*.new.txt）'); process.exit(1); }
