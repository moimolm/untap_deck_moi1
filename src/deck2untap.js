/* deck → untap.in  v14
 * 対応:
 *   ONE PIECE : cardrush.media（デッキ記事・デッキ詳細）
 *   遊戯王    : tcg-portal.jp（大会結果・投稿デッキ）/ deck-maker.com（デッキ編集画面）
 *   ポケモン  : cardrush.media / tcg-portal.jp / pokemon-card.com（デッキ表示）
 *   デュエマ  : tcg-portal.jp / deck-maker.com（英語名は Duel Masters Wiki を検索して照合）
 *   ヴァイス  : ws-tcg.com（公式デッキレシピ）/ decklog.bushiroad.com（英語名は HoC を見てユーザーが入力、ブラウザに保存）
 *   ヴァンガード: cf-vanguard.com（入賞者デッキレシピ）/ decklog.bushiroad.com（英語名は Cardfight!! Vanguard Wiki をカード番号で照合）
 * ページのデッキを読み取り、公式英語名に変換して untap.in の Paste Deck 用テキストをコピーする。
 */
(async () => {
  const C2U_VER = 'v17';
  const ID = 'c2u-panel';
  document.getElementById(ID)?.remove();

  /* ---------- UI ---------- */
  const panel = document.createElement('div');
  panel.id = ID;
  panel.style.cssText =
    'position:fixed;top:12px;right:12px;z-index:2147483647;width:min(420px,calc(100vw - 24px));' +
    'max-height:calc(100vh - 24px);overflow:auto;background:#1b1d22;color:#e8e8e8;border:1px solid #444;' +
    'border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.5);font:13px/1.5 system-ui,sans-serif;padding:12px;text-align:left';
  panel.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
    '<b>untapへ転送 <span style="opacity:.5;font-weight:400;font-size:11px">' + C2U_VER + '</span></b><button id="c2u-x" style="all:unset;cursor:pointer;padding:0 6px;font-size:18px">×</button></div>' +
    '<div id="c2u-body">読み込み中…</div>';
  document.body.appendChild(panel);
  panel.querySelector('#c2u-x').onclick = () => panel.remove();
  const body = panel.querySelector('#c2u-body');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const status = t => (body.textContent = t);

  const cacheGet = (key, maxAge) => {
    try { const c = JSON.parse(localStorage.getItem(key) || 'null'); if (c && Date.now() - c.t < maxAge) return c.m; } catch (e) {}
    return null;
  };
  const cacheSet = (key, m) => { try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), m })); } catch (e) {} };
  const DAY = 24 * 3600 * 1000;
  // 英語名が見つからないカードを調べるページ（パネルのオレンジ表示のリンク先）
  const enc = encodeURIComponent;
  const LOOK = {
    op: q => 'https://en.onepiece-cardgame.com/cardlist/?freewords=' + enc(q.split(' ')[0]),
    yg: q => 'https://yugipedia.com/index.php?title=Special%3ASearch&search=' + enc(q),
    pk: q => 'https://limitlesstcg.com/cards/jp?q=' + enc(q.replace(/[(（].*$/, '').trim()),
    dm: q => 'https://duelmasters.fandom.com/wiki/Special:Search?query=' + enc(q.split('/')[0]),
    vg: q => 'https://cardfight.fandom.com/wiki/Special:Search?query=' + enc(q.replace(/^\S+\s+/, '')),
  };

  /* ================= ONE PIECE (cardrush) ================= */
  const opNames = async () => {
    let names = cacheGet('c2u-en-names-v2', 3 * DAY);
    if (names) return names;
    status('英語カード名データを取得中…（初回のみ数秒）');
    const list = await (await fetch('https://api.github.com/repos/buhbbl/punk-records/contents/english/data')).json();
    if (!Array.isArray(list)) throw new Error('英語名データの一覧を取得できませんでした（GitHubの回数制限の可能性。1時間ほど空けて再実行）');
    names = {};
    await Promise.all(list.filter(f => f.name.endsWith('.json')).map(async f => {
      try { for (const c of await (await fetch(f.download_url)).json()) if (c && c.id && c.name && !names[c.id]) names[c.id] = c.name.replace(/\(/g, '[').replace(/\)/g, ']'); } catch (e) {} // untap は Mr.3[Galdino] 表記。丸括弧だと型番扱いされる
    }));
    cacheSet('c2u-en-names-v2', names);
    return names;
  };

  // 型番 → 日本語名（punk-records の japanese。デッキを比べるときの表示用）
  const opJpNames = async () => {
    let names = cacheGet('c2u-jp-names-v1', 7 * DAY);
    if (names) return names;
    const list = await (await fetch('https://api.github.com/repos/buhbbl/punk-records/contents/japanese/data')).json();
    if (!Array.isArray(list)) return {};
    names = {};
    await Promise.all(list.filter(f => f.name.endsWith('.json')).map(async f => {
      try { for (const c of await (await fetch(f.download_url)).json()) if (c && c.id && c.name && !names[c.id]) names[c.id] = c.name; } catch (e) {}
    }));
    cacheSet('c2u-jp-names-v1', names);
    return names;
  };

  // ドン!!デッキ（untap の DON Deck＝//deck-2）。既定は通常のドン!!、パネルで好きなドン!!に変えられる（ブラウザに保存）
  const OP_DON_KEY = 'c2u-op-don-v1', OP_DON_DEFAULT = 'Don!! Card (don-000)';
  const opDon = () => { try { return localStorage.getItem(OP_DON_KEY) || OP_DON_DEFAULT; } catch (e) { return OP_DON_DEFAULT; } };
  const opDonText = () => '\n\n//deck-2\n10 ' + opDon();
  // cardrush の記事：各デッキの見出しの近くに /decks/<id> へのリンクがある → その見出しへ飛ぶ
  const crEl = d => d.deckId ? () => {
    const a = [...document.querySelectorAll('a[href]')].find(x => new RegExp('/decks/' + d.deckId + '(?:[/?#]|$)').test(x.getAttribute('href')));
    if (!a) return null;
    let e = a; for (let k = 0; k < 8 && e.parentElement; k++) { e = e.parentElement; const h = e.querySelector('h2,h3'); if (h) return h; }
    return a;
  } : null;
  const cardrushFindDecks = rootObj => {
    const out = [], seen = new Set();
    const walk = (o, parent) => {
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o)) {
        const ok = o.length && o.every(r => r && typeof r === 'object' && 'count' in r && r.card && (r.card.card_number || r.card.id));
        if (ok && !seen.has(o)) {
          seen.add(o);
          const p = parent || {};
          out.push({ label: [p.tournament_date, p.tournament_name, p.score, p.name].filter(Boolean).join(' '), lite: o, deckId: p.id });
          return;
        }
        o.forEach(x => walk(x, parent));
        return;
      }
      for (const k in o) walk(o[k], Array.isArray(o[k]) ? o : parent);
    };
    walk(rootObj, null);
    return out;
  };

  /* ================= ポケモン ================= */
  // 日本語名 → 英語名（Limitless の日本版カード一覧より。トレーナーズは英語版の正式名）
  const PK_DICT_Z = '__PKDICT__';
  const PK_BASIC_ENERGY = { 草: 'Grass', 炎: 'Fire', 水: 'Water', 雷: 'Lightning', 超: 'Psychic', 闘: 'Fighting', 悪: 'Darkness', 鋼: 'Metal' };
  const pkNorm = s => String(s || '').replace(/[(（][^()（）]*[)）]\s*$/, '').normalize('NFKC').replace(/[\s・]/g, '');
  let pkDict = null;
  const pkName = jp => {
    if (!pkDict) {
      pkDict = {};
      const raw = JSON.parse(LZString.decompressFromEncodedURIComponent(PK_DICT_Z));
      for (const k in raw) pkDict[pkNorm(k)] = raw[k];
    }
    const e = String(jp).match(/^基本(.)エネルギー/);
    if (e && PK_BASIC_ENERGY[e[1]]) return PK_BASIC_ENERGY[e[1]] + ' Energy';
    return pkDict[pkNorm(jp)] || pkDict[pkNorm(String(jp).replace(/[(（].*?[)）]/g, ''))] || null;
  };
  // rows: [日本語名, 枚数, 日本版の弾コード(任意)]。弾コードを付けると untap の日本版登録が選ばれる
  const pkBuild = rows => {
    const missing = [], pairs = [];
    const lines = rows.map(([n, q, set]) => {
      const en = pkName(n);
      if (!en) missing.push(n); else pairs.push([en, n]);
      return `${q} ${en || n}` + (en && set ? ` (${set.toLowerCase()})` : '');
    });
    return { text: '//deck-1\n' + lines.join('\n'), missing, pairs, look: LOOK.pk };
  };

  const pokeOfficial = async () => {
    const P = window.PCGDECK;
    const keys = ['deck_pke', 'deck_gds', 'deck_tool', 'deck_tech', 'deck_sup', 'deck_sta', 'deck_ene', 'deck_ajs'];
    if (!P || !P.searchItemName) throw new Error('デッキが見つかりません（ポケカ公式の「デッキを表示」ページで実行してください）');
    const rows = [];
    for (const k of keys) {
      const el = document.querySelector(`input[name="${k}"],#${k}`);
      if (!el || !el.value) continue;
      for (const part of el.value.split('-')) {
        const [id, n] = part.split('_');
        if (!id || !n) continue;
        const name = P.searchItemName[id] || ('ID' + id);
        // 弾コード：名前の「(SV6 081/101)」か、画像パスのフォルダ（…/SV8a/046958_T_….jpg）から
        const m = name.match(/[(（]([A-Za-z0-9-]+)\s+\d+\/\d+[)）]/);
        const pict = String((P.searchItemCardPict || {})[id] || '').split('/');
        const set = m ? m[1] : (pict.length > 1 ? pict[pict.length - 2] : '');
        rows.push([name, Number(n), /^(ENE|L\d.*|[A-Z]{1,3}-[A-Z])$/.test(set) ? '' : set]);
      }
    }
    if (!rows.length) throw new Error('デッキが空です');
    const total = rows.reduce((s, r) => s + r[1], 0);
    const code = (location.pathname.match(/deckID\/([\w-]+)/) || [])[1] || '';
    return [{ title: 'ポケカ公式デッキ ' + code, sub: total + '枚', build: async () => pkBuild(rows) }];
  };

  const cardrushPoke = async () => {
    const nd = document.getElementById('__NEXT_DATA__');
    if (!nd) throw new Error('デッキデータが見つかりません（cardrush のデッキ記事／デッキ詳細ページで実行してください）');
    const decks = cardrushFindDecks(JSON.parse(nd.textContent)).filter(d => d.lite.length);
    if (!decks.length) throw new Error('このページにはデッキレシピが見つかりませんでした');
    return decks.map((d, i) => ({
      el: crEl(d),
      title: (d.label || 'デッキ ' + (i + 1)),
      sub: d.lite.reduce((s, r) => s + Number(r.count), 0) + '枚',
      build: async () => pkBuild(d.lite.map(r => [r.card.name, Number(r.count)])),
    }));
  };

  const cardrush = async () => {
    if (location.pathname.startsWith('/pokemon')) return cardrushPoke();
    const nd = document.getElementById('__NEXT_DATA__');
    if (!nd) throw new Error('デッキデータが見つかりません（cardrush のデッキ記事／デッキ詳細ページで実行してください）');
    const findDecks = rootObj => {
      const out = [], seen = new Set();
      const walk = (o, parent) => {
        if (!o || typeof o !== 'object') return;
        if (Array.isArray(o)) {
          const ok = o.length && o.every(r => r && typeof r === 'object' && 'count' in r && r.card && (r.card.card_number || r.card.id));
          if (ok && !seen.has(o)) {
            seen.add(o);
            const p = parent || {};
            out.push({ label: [p.tournament_date, p.tournament_name, p.score, p.name].filter(Boolean).join(' '),
              recipes: o.every(r => r.card.card_number) ? o : null, lite: o, deckId: p.id });
            return;
          }
          o.forEach(x => walk(x, parent));
          return;
        }
        for (const k in o) walk(o[k], Array.isArray(o[k]) ? o : parent);
      };
      walk(rootObj, null);
      return out;
    };
    const decks = findDecks(JSON.parse(nd.textContent)).filter(d => d.recipes || d.deckId);
    if (!decks.length) throw new Error('このページにはデッキレシピが見つかりませんでした');
    const names = await opNames();
    const loadFull = async d => {
      if (d.recipes) return d.recipes;
      const m = (await (await fetch('/onepiece/decks/' + d.deckId)).text()).match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      const full = m && findDecks(JSON.parse(m[1])).find(x => x.recipes);
      if (!full) throw new Error('デッキ詳細を読み込めませんでした（ID ' + d.deckId + '）');
      return (d.recipes = full.recipes);
    };
    const base = n => (String(n).toUpperCase().match(/^[A-Z]+\d*-\d{3}/) || [String(n).toUpperCase()])[0];
    return decks.map((d, i) => ({
      el: crEl(d),
      title: (d.lite[0] && d.lite[0].card.name) || 'デッキ',
      sub: 'メイン' + d.lite.slice(1).reduce((s, r) => s + Number(r.count), 0) + '枚 ' + (d.label || 'デッキ ' + (i + 1)),
      build: async () => {
        const leader = [], main = [], missing = [], pairs = [];
        for (const r of await loadFull(d)) {
          const no = base(r.card.card_number), en = names[no];
          if (!en) missing.push(no + ' ' + r.card.name); else pairs.push([en, r.card.name]);
          (r.card.category === 'リーダー' ? leader : main).push(`${r.count} ${en || r.card.name} [${no.toLowerCase()}]`);
        }
        return { text: (leader.length ? '//play-1\n' + leader.join('\n') + '\n\n' : '') + '//deck-1\n' + main.join('\n') + opDonText(), missing, pairs, look: LOOK.op };
      },
    }));
  };

  /* ================= 遊戯王 共通：日本語名 → 英語名 ================= */
  const ygNorm = s => String(s || '')
    .replace(/<rt>.*?<\/rt>/g, '').replace(/<rp>.*?<\/rp>/g, '').replace(/<\/?ruby>/g, '')
    .normalize('NFKC').replace(/[〜～]/g, '~').replace(/[\s・]/g, '').toLowerCase();
  const ygNames = async () => {
    let m = cacheGet('c2u-ygo-ja2en-v1', 7 * DAY);
    if (m) return m;
    status('遊戯王の英語カード名データを取得中…（初回のみ・約100MB、10秒ほど）');
    const r = await fetch('https://dawnbrandbots.github.io/yaml-yugi/cards.json');
    if (!r.ok) throw new Error('英語名データを取得できませんでした（' + r.status + '）');
    m = {};
    for (const c of await r.json()) if (c.name && c.name.ja && c.name.en) m[ygNorm(c.name.ja)] = c.name.en;
    cacheSet('c2u-ygo-ja2en-v1', m);
    return m;
  };
  // untap 側が公式英語名と違う名前（有志翻訳）で登録しているカード
  const YG_ALIAS = {
    'Ars Magna the Finite and the Infinite': 'Ars Magna of Infinity and Finity',
    'Ars Magna the Division and the Union': 'Ars Magna of Unification and Separation',
  };
  const ygBuild = (zones, m) => {
    // zones: {main:[[name,qty]], extra:[...], side:[...]}
    const head = { main: '//deck-1', extra: '//deck-2', side: '//sideboard-1' };
    const missing = [], parts = [], pairs = [];
    for (const z of ['main', 'extra', 'side']) {
      const rows = zones[z] || [];
      if (!rows.length) continue;
      parts.push(head[z] + '\n' + rows.map(([n, q]) => {
        let en = m[ygNorm(n)];
        if (en && YG_ALIAS[en]) en = YG_ALIAS[en];
        if (!en) missing.push(n); else pairs.push([en, n]);
        return `${q} ${en || n}`;
      }).join('\n'));
    }
    return { text: parts.join('\n\n'), missing, pairs, look: LOOK.yg };
  };
  const cnt = rows => rows.reduce((s, r) => s + Number(r[1]), 0);

  /* ================= デュエマ：日本語名 → 英語名（Duel Masters Wiki を検索して日本語名で照合） ================= */
  const dmNorm = s => String(s || '')
    .replace(/\{\{Ruby\|([^|}]*)\|[^}]*\}\}/gi, '$1')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/''\(.*?\)''/g, '').replace(/''+/g, '')
    .normalize('NFKC').replace(/[\s・·“”"'＂『』「」]/g, '').replace(/[〜～]/g, '~').toLowerCase();
  const DM_API = 'https://duelmasters.fandom.com/api.php?format=json&formatversion=2&origin=*&';
  const dmNames = async jpList => {
    const cache = cacheGet('c2u-dm-ja2en-v1', 30 * DAY) || {};
    const out = {};
    const todo = [...new Set(jpList)].filter(n => { const k = dmNorm(n); if (cache[k]) { out[n] = cache[k]; return false; } return true; });
    let done = 0;
    const one = async jp => {
      const key = dmNorm(jp), first = dmNorm(jp.split('/')[0]);
      const tryQ = async q => {
        const s = await (await fetch(DM_API + 'action=query&list=search&srlimit=6&srsearch=' + encodeURIComponent(q))).json();
        const titles = ((s.query || {}).search || []).map(x => x.title).filter(t => !/\/(Gallery|Rulings)$/.test(t));
        if (!titles.length) return null;
        const r = await (await fetch(DM_API + 'action=query&redirects=1&prop=revisions&rvprop=content&rvslots=main&titles=' + encodeURIComponent(titles.join('|')))).json();
        for (const p of (r.query || {}).pages || []) {
          const c = p.revisions && p.revisions[0].slots.main.content || '';
          const j1 = (c.match(/\|\s*jpname\s*=\s*(.+)/) || [])[1], j2 = (c.match(/\|\s*jpname2\s*=\s*(.+)/) || [])[1];
          if (!j1) continue;
          const a = dmNorm(j1), b = j2 ? dmNorm(j2) : '';
          if (a === key || a + '/' + b === key || (b && a + b === key.replace('/', '')) || (a === first && b)) return p.title;
        }
        return null;
      };
      let en = await tryQ(jp.split('/')[0]);
      if (!en) en = await tryQ(jp.split('/')[0].replace(/^.*?\s/, ''));
      status(`デュエマの英語名を検索中… ${++done}/${todo.length}`);
      if (en) { out[jp] = en; cache[key] = en; }
    };
    for (let i = 0; i < todo.length; i += 6) await Promise.all(todo.slice(i, i + 6).map(n => one(n).catch(() => {})));
    cacheSet('c2u-dm-ja2en-v1', cache);
    return out;
  };
  const dmBuild = (zones, m) => {
    // zones: {play, main, gr, hs}: [[jpName, qty]]
    const head = { play: '//play-1', main: '//deck-1', gr: '//deck-2', hs: '//pile-public' };
    const missing = [], parts = [], pairs = [];
    for (const z of ['play', 'main', 'gr', 'hs']) {
      const rows = zones[z] || [];
      if (!rows.length) continue;
      parts.push(head[z] + '\n' + rows.map(([n, q]) => { const en = m[n]; if (!en) missing.push(n); else pairs.push([en, n]); return `${q} ${en || n}`; }).join('\n'));
    }
    return { text: parts.join('\n\n'), missing, pairs, look: LOOK.dm };
  };
  const dmSub = z => `メイン${cnt(z.main)}` + (cnt(z.gr) ? `・GR${cnt(z.gr)}` : '') + (cnt(z.hs) ? `・超次元${cnt(z.hs)}` : '');
  const dmAll = z => [].concat(...['play', 'main', 'gr', 'hs'].map(k => (z[k] || []).map(r => r[0])));

  /* ---------- tcg-portal.jp ---------- */
  const tcgPortal = async () => {
    const game = (location.pathname.match(/^\/(\w+)/) || [])[1];
    if (!/^(yugioh|onepiece|pokemon|duelmasters)$/.test(game || '')) throw new Error('TCG PORTAL は遊戯王・ワンピース・ポケモン・デュエマの大会結果／デッキページに対応しています');
    const labels = [...document.querySelectorAll('main *')].filter(e =>
      e.children.length === 0 && /^(メインデッキ|EXデッキ|エクストラデッキ|サイドデッキ|サイド|リーダーカード|リーダー|超次元ゾーン|超次元|超GRゾーン|超GR|GRゾーン|GR)$/.test(e.textContent.trim()));
    const zones = { main: [], extra: [], side: [], leader: [], gr: [], hs: [] };
    for (const tb of document.querySelectorAll('main table')) {
      const rows = [...tb.querySelectorAll('tr')].map(r => [...r.cells].map(c => c.innerText.trim())).filter(r => /^\d+$/.test(r[0] || '') && r[1]);
      if (!rows.length) continue;
      const before = labels.filter(l => l.compareDocumentPosition(tb) & Node.DOCUMENT_POSITION_FOLLOWING).pop();
      const t = before ? before.textContent : 'メインデッキ';
      const z = /リーダー/.test(t) ? 'leader' : /超次元/.test(t) ? 'hs' : /GR/.test(t) ? 'gr' : /EX|エクストラ/.test(t) ? 'extra' : /サイド/.test(t) ? 'side' : 'main';
      for (const r of rows) zones[z].push([r[1].split('\n')[0].trim(), Number(r[0])]);
    }
    if (!zones.main.length) throw new Error('このページにデッキリストの表が見つかりませんでした（大会結果・投稿デッキのページで実行してください）');
    const h1 = ((document.querySelector('h1') || {}).textContent || document.title).trim().slice(0, 60);
    if (game === 'duelmasters') {
      const z = { main: zones.main, gr: zones.gr, hs: zones.hs };
      const m = await dmNames(dmAll(z));
      return [{ title: h1, sub: dmSub(z), build: async () => dmBuild(z, m) }];
    }
    if (game === 'pokemon') {
      return [{ title: h1, sub: cnt(zones.main) + '枚', build: async () => pkBuild(zones.main) }];
    }
    if (game === 'onepiece') {
      const names = await opNames();
      const conv = rows => rows.map(([s, q]) => {
        const m = s.match(/^(.*?)\s*([A-Z]+\d*-\d{3})\s*$/);
        return m ? { jp: m[1], no: m[2], q } : { jp: s, no: '', q };
      });
      const leader = conv(zones.leader), main = conv(zones.main);
      return [{ title: h1, sub: `リーダー${leader.map(r => r.jp).join('')}・メイン${cnt(zones.main)}枚`, build: async () => {
        const missing = [], pairs = [];
        const line = r => {
          const en = r.no && names[r.no];
          if (!en) missing.push((r.no + ' ' + r.jp).trim()); else pairs.push([en, r.jp]);
          return `${r.q} ${en || r.jp}` + (r.no ? ` [${r.no.toLowerCase()}]` : '');
        };
        const L = leader.map(line), M = main.map(line);
        return { text: (L.length ? '//play-1\n' + L.join('\n') + '\n\n' : '') + '//deck-1\n' + M.join('\n') + opDonText(), missing, pairs, look: LOOK.op };
      } }];
    }
    const m = await ygNames();
    return [{ title: h1, sub: `メイン${cnt(zones.main)}・EX${cnt(zones.extra)}・サイド${cnt(zones.side)}`, build: async () => ygBuild(zones, m) }];
  };

  /* ================= ヴァンガード：カード番号 → 英語名（Cardfight!! Vanguard Wiki のセット一覧・カードページ） ================= */
  const VG_API = 'https://cardfight.fandom.com/api.php?format=json&formatversion=2&origin=*&';
  const vgNorm = s => String(s || '').replace(/\{\{Ruby\|([^|}]*)\|[^}]*\}\}/gi, '$1').replace(/''+/g, '')
    .normalize('NFKC').replace(/[\s・·“”"'＂『』「」]/g, '').replace(/[〜～]/g, '~').toLowerCase();
  // wiki の曖昧さ回避「(D Series)」「(Fighter Icon)」などを外す
  const vgClean = t => String(t).replace(/\s*\([^()]*\)\s*$/, '').trim();
  const vgNames = async rows => {
    // rows: [[cardNo, jpName]]
    const c = cacheGet('c2u-vg-v1', 30 * DAY) || {};
    const num = c.num || {}, nm = c.nm || {};
    const look = (no, jp) => num[no] || num[no.replace(/R$/, '')] || nm[vgNorm(jp)];
    const eat = pages => {
      for (const p of pages || []) {
        const t = p.revisions && p.revisions[0].slots.main.content || '';
        let m, re = /\{\{CardList\|([^|}]+)\|([^|}]+)/g;
        while ((m = re.exec(t))) { const k = m[1].trim(); if (!num[k]) num[k] = m[2].trim(); }
        const jps = ['kanji', 'jpname', 'kana'].map(f => (t.match(new RegExp('\\|\\s*' + f + '\\s*=\\s*(.+)')) || [])[1]).filter(Boolean);
        if (jps.length && /\{\{[A-Z]?Table/.test(t) && !/^Card Gallery:/.test(p.title)) {
          for (const j of jps) { const k = vgNorm(j.replace(/''\(.*?\)''/g, '')); if (k && !nm[k]) nm[k] = p.title; }
          for (const n of (t.match(/\|\s*set\d*\s*=.*/g) || []).join(' ').match(/[A-Z]+-[A-Z0-9]+\/[A-Z0-9]+/g) || []) if (!num[n]) num[n] = p.title;
        }
      }
    };
    const query = async q => {
      const s = await (await fetch(VG_API + 'action=query&list=search&srlimit=8&srsearch=' + encodeURIComponent(q))).json();
      const titles = ((s.query || {}).search || []).map(x => x.title).filter(t => !/^(Card Gallery|Category|User|Template):|\/(Gallery|Rulings)$/.test(t));
      if (!titles.length) return;
      const r = await (await fetch(VG_API + 'action=query&redirects=1&prop=revisions&rvprop=content&rvslots=main&titles=' + encodeURIComponent(titles.join('|')))).json();
      eat((r.query || {}).pages);
    };
    const todo = rows.filter(([no, jp]) => !look(no, jp));
    let done = 0;
    const one = async ([no, jp]) => {
      for (const q of [`"${no}"`, jp, jp.replace(/^.*?\s/, '')]) {
        if (look(no, jp)) break;
        try { await query(q); } catch (e) {}
      }
      status(`ヴァンガードの英語名を検索中… ${++done}/${todo.length}`);
    };
    for (let i = 0; i < todo.length; i += 4) await Promise.all(todo.slice(i, i + 4).map(one));
    cacheSet('c2u-vg-v1', { num, nm });
    const out = {};
    for (const [no, jp] of rows) { const t = look(no, jp); if (t) out[no] = vgClean(t); }
    return out;
  };
  // untap の置き場：ライドデッキ＝Ride Zone（//pile-facedown）、デッキ＝Main Deck
  const VG_HEAD = { ride: '//pile-facedown', main: '//deck-1' };
  const vgBuild = (zones, m) => {
    const missing = [], parts = [], pairs = [];
    for (const z of ['ride', 'main']) {
      const rows = zones[z] || [];
      if (!rows.length) continue;
      parts.push(VG_HEAD[z] + '\n' + rows.map(([no, jp, q]) => { const en = m[no]; if (!en) missing.push(no + ' ' + jp); else pairs.push([en, jp]); return `${q} ${en || jp}` + (en ? ` (${no.toLowerCase()})` : ''); }).join('\n'));
    }
    return { text: parts.join('\n\n'), missing, pairs, look: LOOK.vg };
  };
  const vgDecks = async decks => {
    // decks: [{title, sub, zones:{ride:[[no,jp,q]], main:[...]}}]
    const all = new Map();
    for (const d of decks) for (const z of ['ride', 'main']) for (const r of d.zones[z]) all.set(r[0], r[1]);
    const m = await vgNames([...all]);
    return decks.map(d => ({ title: d.title, sub: d.sub, el: d.el, build: async () => vgBuild(d.zones, m) }));
  };
  const vgSub = z => `ライド${cnt3(z.ride)}・デッキ${cnt3(z.main)}`;
  const cnt3 = rows => rows.reduce((s, r) => s + Number(r[2]), 0);

  /* ---------- cf-vanguard.com（入賞者デッキレシピ） ---------- */
  const vgOfficial = async () => {
    const lists = [...document.querySelectorAll('.recipe-single-list')];
    if (!lists.length) throw new Error('デッキが見つかりません（公式サイトの入賞者デッキレシピのページで実行してください）');
    const decks = lists.map((l, i) => {
      const zones = { ride: [], main: [] };
      for (const li of l.querySelectorAll('li')) {
        const a = li.querySelector('a[href*="cardno="]');
        if (!a) continue;
        const no = decodeURIComponent((a.getAttribute('href').match(/cardno=([^&#]+)/) || [])[1] || '');
        const num = li.querySelector('.num');
        const ride = !!li.querySelector('.ride');
        (ride ? zones.ride : zones.main).push([no, a.title || (li.querySelector('img') || {}).alt || no, ride ? 1 : Number(num ? num.textContent.trim() : 1) || 1]);
      }
      // 見出し（選手名・国家・DECK LOG コード）はリストの手前のテキストから
      let info = [], e = l.previousElementSibling;
      for (let k = 0; k < 6 && e; k++, e = e.previousElementSibling) { const t = e.textContent.trim(); if (t) info.unshift(t.replace(/\s+/g, ' ')); if (/DECK LOG/.test(t)) break; }
      const who = info.find(t => /選手/.test(t)) || '';
      const nation = (info.find(t => /国家/.test(t)) || '').replace(/^国家[：:]\s*/, '');
      return { title: (who || 'デッキ ' + (i + 1)) + (nation ? '（' + nation + '）' : ''), sub: vgSub(zones), zones, el: () => l };
    }).filter(d => d.zones.main.length);
    return vgDecks(decks);
  };

  /* ================= ヴァイスシュヴァルツ（英語名はユーザーが HoC で確認して入力 → ブラウザに保存） ================= */
  const WS_KEY = 'c2u-ws-names-v1';
  const wsDict = () => { try { return JSON.parse(localStorage.getItem(WS_KEY) || '{}'); } catch (e) { return {}; } };
  const wsSave = d => { try { localStorage.setItem(WS_KEY, JSON.stringify(d)); } catch (e) {} };
  // GitHub に置いた ws-names.json（書き出したファイル）があれば、どのサイト・どの PC でも読み込む
  const WS_REMOTE = 'https://moimolm.github.io/untap_deck_moi1/ws-names.json';
  const wsRemote = async () => {
    try { const r = await fetch(WS_REMOTE + '?t=' + Math.floor(Date.now() / 6e5)); if (!r.ok) return {}; const j = await r.json(); return j && typeof j === 'object' ? (j.names || j) : {}; }
    catch (e) { return {}; }
  };
  const wsImg = no => { // GU/WE46-60GUR → …/cardlist/g/gu_we46/gu_we46_60gur.png
    const m = String(no).toLowerCase().match(/^([a-z0-9]+)\/([a-z0-9]+)-([a-z0-9]+)$/);
    return m ? `https://ws-tcg.com/wordpress/wp-content/images/cardlist/${m[1][0]}/${m[1]}_${m[2]}/${m[1]}_${m[2]}_${m[3]}.png` : '';
  };
  const wsHoc = no => 'https://heartofthecards.com/code/cardlist.html?card=WS_' + encodeURI(no);
  // デッキを開いたときの編集画面：番号・日本語名・枚数・英語名入力・HoC／画像リンク
  const wsEditor = (info, rows, title, remote = {}) => {
    const dict = { ...remote, ...wsDict() };
    const nRemote = Object.keys(remote).length;
    const S = 'style="color:#8ab4ff;text-decoration:underline"';
    info.innerHTML =
      `<div style="font-size:12px;opacity:.8;margin:6px 0">英語名を入れた行は英語名で、空欄の行は日本語名で出力します（untap に日本語名でカスタム登録済みならそのまま入ります）。入力した英語名はこのサイトのブラウザに保存され、次回から自動で入ります。</div>` +
      `<table style="width:100%;border-collapse:collapse;font-size:12px">` +
      rows.map(([no, jp, q], i) =>
        `<tr style="border-top:1px solid #333"><td style="padding:3px 2px;white-space:nowrap">${q}×</td>` +
        `<td style="padding:3px 2px"><div>${esc(jp)}</div><div style="opacity:.6">${esc(no)} · <a ${S} target="_blank" rel="noopener" href="${esc(wsHoc(no))}">HoC</a>` +
        (wsImg(no) ? ` · <a ${S} target="_blank" rel="noopener" href="${esc(wsImg(no))}">画像</a>` : '') + `</div>` +
        `<input data-i="${i}" placeholder="英語名（HoCで確認）" value="${esc(dict[no] || '')}" style="all:unset;box-sizing:border-box;width:100%;margin-top:2px;padding:2px 4px;background:#111;border:1px solid #444;border-radius:4px;color:#eee"></td></tr>`).join('') +
      `</table><div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">` +
      `<button data-a="copy" style="all:unset;cursor:pointer;background:#2f6fed;color:#fff;border-radius:6px;padding:4px 10px">untap用にコピー</button>` +
      `<button data-a="list" style="all:unset;cursor:pointer;border:1px solid #555;border-radius:6px;padding:4px 10px">カスタム登録用の一覧をコピー</button></div>` +
      `<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;font-size:12px">` +
      `<button data-a="export" style="all:unset;cursor:pointer;border:1px solid #555;border-radius:6px;padding:3px 8px">英語名データを書き出す</button>` +
      `<button data-a="import" style="all:unset;cursor:pointer;border:1px solid #555;border-radius:6px;padding:3px 8px">読み込む</button>` +
      `<input type="file" accept=".json,application/json" style="display:none"></div>` +
      `<div style="font-size:11px;opacity:.6;margin-top:4px">保存済みの英語名 ${Object.keys(dict).length} 件` + (nRemote ? `（うち GitHub の ws-names.json から ${nRemote} 件）` : '') + `</div>` +
      `<div class="c2u-ws-out" style="font-size:12px;margin-top:6px"></div>` + extrasHtml();
    const out = info.querySelector('.c2u-ws-out');
    info.querySelectorAll('input[data-i]').forEach(inp => inp.addEventListener('input', () => {
      const d = wsDict(), no = rows[inp.dataset.i][0], v = inp.value.trim();
      if (v) d[no] = v; else delete d[no];
      wsSave(d);
    }));
    const val = i => info.querySelector(`input[data-i="${i}"]`).value.trim();
    const fileIn = info.querySelector('input[type=file]');
    wireExtras(info, () => '//deck-1\n' + rows.map(([no, jp, q], i) => `${q} ${val(i) || jp} (${no.toLowerCase()})`).join('\n'),
      () => notesText(title, '', rows.map(([no, jp], i) => [val(i), jp + '（' + no + '）']).filter(p => p[0])),
      () => rows.map(([no, jp], i) => [val(i) || jp, jp]));
    info.querySelector('[data-a="export"]').onclick = () => {
      const all = { ...remote, ...wsDict() };
      const keys = Object.keys(all).sort();
      const data = JSON.stringify({ app: 'untapへ転送', kind: 'ws-names', saved: new Date().toISOString(), names: Object.fromEntries(keys.map(k => [k, all[k]])) }, null, 1);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
      a.download = 'ws-names.json';
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      out.innerHTML = `英語名 ${keys.length} 件を ws-names.json に書き出しました。GitHub のリポジトリ（d2u.js と同じ場所）に上書きアップロードしておくと、どのサイト・どの PC でも自動で読み込まれます。`;
      log('ws-names 書き出し ' + keys.length + '件');
    };
    info.querySelector('[data-a="import"]').onclick = () => fileIn.click();
    fileIn.onchange = async () => {
      const f = fileIn.files && fileIn.files[0];
      if (!f) return;
      try {
        const j = JSON.parse(await f.text()), add = j.names || j, d = wsDict();
        let n = 0;
        for (const k in add) if (typeof add[k] === 'string' && add[k].trim() && !d[k]) { d[k] = add[k].trim(); n++; }
        wsSave(d);
        info.querySelectorAll('input[data-i]').forEach(inp => { const no = rows[inp.dataset.i][0]; if (!inp.value && d[no]) inp.value = d[no]; });
        out.innerHTML = `<span style="color:#9be29b">${n} 件を読み込みました</span>（すでに入力済みの英語名はそのまま残しています）。`;
        log('ws-names 読み込み ' + n + '件');
      } catch (e) { out.innerHTML = `<span style="color:#ff7b7b">読み込めませんでした（書き出した ws-names.json を選んでください）</span>`; }
      fileIn.value = '';
    };
    info.querySelector('[data-a="copy"]').onclick = async () => {
      // (番号) を付ける：untap の Set / Release Identifier と一致すればその版、登録後の照合にも使う
      const lines = rows.map(([no, jp, q], i) => `${q} ${val(i) || jp} (${no.toLowerCase()})`);
      await copyText(withMeta('//deck-1\n' + lines.join('\n'), title, ''));
      const left = rows.filter((r, i) => !val(i)).length;
      out.innerHTML = `<span style="color:#9be29b">コピーしました。</span>` + (left ? `<span style="color:#ffb454">英語名が空欄のカード ${left} 種は日本語名のまま出力しています。</span>` : '') + countCheck('//deck-1\n' + lines.join('\n'), 'ws');
    };
    info.querySelector('[data-a="list"]').onclick = async () => {
      const t = rows.filter((r, i) => !val(i)).map(([no, jp]) => [no, jp, wsImg(no), wsHoc(no)].join('\t'));
      await copyText(t.length ? '番号\t日本語名\t画像\tHoC\n' + t.join('\n') : '');
      out.innerHTML = t.length ? `英語名が空欄の ${t.length} 種を「番号・日本語名・画像URL・HoCのURL」の表でコピーしました（スプレッドシートに貼れます）。` : '空欄のカードはありません。';
    };
  };
  const wsDeck = (title, sub, load, el) => ({ title, sub, ws: true, load, el });

  /* ---------- ws-tcg.com（公式デッキレシピ） ---------- */
  const wsTables = root => {
    const rows = [];
    for (const tb of root.querySelectorAll('table')) for (const tr of tb.querySelectorAll('tr')) {
      const c = [...tr.cells].map(x => x.innerText.trim());
      if (c.length >= 4 && /^[A-Z0-9]+\/[A-Z0-9]+-[A-Z0-9]+$/i.test(c[0])) rows.push([c[0], c[1], Number((c[3].match(/\d+/) || [1])[0]), '']);
    }
    return rows;
  };
  const wsOfficial = async () => {
    const blocks = [...document.querySelectorAll('.deckrecipeBlock')];
    if (!blocks.length) throw new Error('デッキが見つかりません（公式サイトのデッキレシピ一覧・詳細ページで実行してください）');
    return blocks.map((b, i) => {
      const t = b.innerText;
      const g = k => ((t.match(new RegExp(k + '\\s*\\n\\s*(.+)')) || [])[1] || '').trim();
      const title = [g('デッキ名'), g('ハンドルネーム') && g('ハンドルネーム') + ' さん'].filter(Boolean).join(' / ') || 'デッキ ' + (i + 1);
      const sub = [g('成績'), g('デッキコード') && 'コード ' + g('デッキコード')].filter(Boolean).join('・');
      return wsDeck(title, sub, async () => {
        let rows = wsTables(b);
        if (!rows.length) { // 「詳細を開く」を押してカード表を読み込ませる
          const a = b.querySelector('.js-recipe-load-detail');
          if (a) a.click();
          for (let k = 0; k < 30 && !rows.length; k++) { await new Promise(r => setTimeout(r, 200)); rows = wsTables(b); }
        }
        if (!rows.length) throw new Error('カード表を読み込めませんでした（そのデッキの「詳細を開く」を押してから、もう一度お試しください）');
        return rows;
      }, () => b);
    });
  };

  /* ---------- decklog.bushiroad.com（ヴァンガード） ---------- */
  const deckLog = async () => {
    const items = [...document.querySelectorAll('.card-item')];
    if (!items.length) throw new Error('デッキが見つかりません（DECK LOG のデッキ表示ページで、カードが表示されてから実行してください）');
    const img0 = items[0].querySelector('img');
    const src = img0 ? (img0.getAttribute('src') || img0.getAttribute('data-src') || '') : '';
    const code = (location.pathname.match(/view\/(\w+)/) || [])[1] || '';
    const name = (document.body.innerText.match(/デッキ名「(.+?)」/) || [])[1] || '';
    if (/ws-tcg\.com/.test(src)) {
      const rows = items.map(it => {
        const im = it.querySelector('img'), n = it.querySelector('.num');
        const m = String(im && im.title || '').match(/^\s*(\S+)\s*:\s*(.+)$/);
        return m ? [m[1], m[2].trim(), Number(n ? n.textContent.trim() : 1) || 1, ''] : null;
      }).filter(Boolean);
      return [wsDeck((name || 'DECK LOG') + ' ' + code, rows.reduce((s, r) => s + r[2], 0) + '枚', async () => rows)];
    }
    if (!/cf-vanguard\.com/.test(src)) throw new Error('DECK LOG はヴァンガード・ヴァイスシュヴァルツのデッキに対応しています');
    const zones = { ride: [], main: [] };
    for (const it of items) {
      const im = it.querySelector('img');
      const m = String(im && im.title || '').match(/^\s*(\S+)\s*:\s*(.+)$/);
      if (!m) continue;
      const n = it.querySelector('.num');
      const ride = it.classList.contains('card-item-is-ride');
      (ride ? zones.ride : zones.main).push([m[1], m[2].trim(), Number(n ? n.textContent.trim() : 1) || 1]);
    }
    return vgDecks([{ title: (name || 'DECK LOG') + ' ' + code, sub: vgSub(zones), zones }]);
  };

  /* ---------- deck-maker.com ---------- */
  const deckMaker = async () => {
    const el = document.querySelector('.DeckArea');
    const vm = el && el.__vue__;
    const isDM = /^\/dm\//.test(location.pathname);
    const store = window.$nuxt && window.$nuxt.$store && window.$nuxt.$store.state[isDM ? 'dm' : 'yg'];
    if (!vm || !store) throw new Error('デッキが見つかりません（DECK MAKER のデッキ画面が表示し終わってから実行してください）');
    const byId = {};
    for (const c of Object.values(store.cards || {})) byId[c.mainCardId] = c.name;
    const agg = list => { const mm = new Map(); for (const c of list || []) { const n = byId[c.mainCardId] || ('ID' + c.mainCardId); mm.set(n, (mm.get(n) || 0) + 1); } return [...mm]; };
    if (isDM) {
      const z = { main: agg(vm.mainCards), gr: agg(vm.grCards), hs: agg(vm.hyperSpatialCards), play: [] };
      for (const k of ['dorumagedon', 'zeron']) { const c = vm[k]; if (c && typeof c === 'object') z.play.push(...agg(Array.isArray(c) ? c : [c])); }
      if (!cnt(z.main)) throw new Error('メインデッキが空です');
      const m = await dmNames(dmAll(z));
      return [{ title: 'DECK MAKER のデッキ（デュエマ）', sub: dmSub(z), build: async () => dmBuild(z, m) }];
    }
    const zones = { main: agg(vm.mainCards), extra: agg(vm.extraCards), side: agg(vm.sideCards) };
    if (!cnt(zones.main)) throw new Error('メインデッキが空です');
    const m = await ygNames();
    return [{ title: 'DECK MAKER のデッキ', sub: `メイン${cnt(zones.main)}・EX${cnt(zones.extra)}・サイド${cnt(zones.side)}`, build: async () => ygBuild(zones, m) }];
  };

  /* ================= 実行 ================= */
  const copyText = async text => {
    try { await navigator.clipboard.writeText(text); }
    catch (e) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
  };
  /* ---------- 対戦用メモ（untap の Play Notes に貼る：元ページ＋英語名→日本語名） ---------- */
  const notesText = (title, sub, pairs) => {
    const seen = new Set(), lines = [];
    for (const [en, jp] of pairs || []) { const k = en + '\t' + jp; if (!seen.has(k) && en !== jp) { seen.add(k); lines.push(`${en} → ${jp}`); } }
    return [`【元のデッキ】${title}${sub ? '（' + sub + '）' : ''}`, location.href, '', '【英語名 → 日本語名】', ...lines].join('\n');
  };
  /* ---------- デッキの差分（貼り付けたリストと比べる） ---------- */
  const deckMap = text => {
    const m = new Map();
    for (const l of String(text).split('\n')) {
      const r = l.trim().match(/^(\d+)\s*[x×]?\s+(.+)$/i);
      if (!r || /^\/\//.test(l)) continue;
      const no = (r[2].match(/[\[(]([^\[\]()]*)[\])]\s*$/) || [])[1] || '';
      const name = r[2].replace(/\s*[\[(][^\[\]()]*[\])]\s*$/, '').trim();
      const k = name.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ');
      const o = m.get(k) || { name, no, n: 0 }; o.n += Number(r[1]); if (!o.no) o.no = no; m.set(k, o);
    }
    return m;
  };
  // jp(o) → 日本語名（分からなければ ''）。日本語名があれば「日本語名 · 英語名」で表示
  const diffHtml = (a, b, jp = () => '') => {
    const A = deckMap(a), B = deckMap(b), more = [], less = [];
    const nm = o => { const j = jp(o); return j && j !== o.name ? `${j} · ${o.name}` : o.name; };
    let same = 0;
    for (const [k, o] of A) { const n = (B.get(k) || {}).n || 0; if (o.n > n) more.push(`+${o.n - n} ${nm(o)}` + (n ? `（${n}→${o.n}）` : '')); else if (o.n === n) same++; }
    for (const [k, o] of B) { const n = (A.get(k) || {}).n || 0; if (o.n > n) less.push(`−${o.n - n} ${nm(o)}` + (n ? `（${o.n}→${n}）` : '')); }
    if (!B.size) return '<div style="color:#ffb454">比べるデッキが読み取れませんでした（「枚数 カード名」の行が必要です）</div>';
    if (!more.length && !less.length) return `<div style="color:#9be29b">同じ構成です（${same} 種）</div>`;
    const ul = (t, xs, c) => xs.length ? `<div style="margin-top:4px;color:${c}">${t}</div><div style="white-space:pre-wrap">${esc(xs.join('\n'))}</div>` : '';
    return `<div style="opacity:.75">同じ枚数のカード ${same} 種</div>` +
      ul('このページのデッキの方が多い（貼り付けたデッキに足すもの）', more, '#9be29b') +
      ul('貼り付けたデッキの方が多い（抜くもの）', less, '#ffb454');
  };
  const extrasHtml = () =>
    `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;font-size:12px">` +
    `<button data-x="notes" style="all:unset;cursor:pointer;border:1px solid #555;border-radius:6px;padding:3px 8px">対戦用メモをコピー</button>` +
    `<button data-x="diff" style="all:unset;cursor:pointer;border:1px solid #555;border-radius:6px;padding:3px 8px">別のデッキと比べる</button></div>` +
    `<div class="c2u-x-out" style="font-size:12px;margin-top:4px"></div>`;
  // 比べるときの日本語名：このデッキの「英語名 → 日本語名」＋ワンピースは型番から
  const jpResolver = async (pairs, texts) => {
    const byEn = new Map((pairs || []).map(([en, j]) => [String(en).normalize('NFKC').toLowerCase().replace(/\s+/g, ' '), j]));
    const opNo = /^[a-z]+\d*-\d{3}$/i;
    let op = {};
    if (texts.some(t => [...deckMap(t).values()].some(o => opNo.test(o.no) && !byEn.has(o.name.normalize('NFKC').toLowerCase().replace(/\s+/g, ' '))))) {
      try { op = await opJpNames(); } catch (e) {}
    }
    return o => byEn.get(o.name.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ')) || (opNo.test(o.no) && op[o.no.toUpperCase()]) || '';
  };
  const wireExtras = (root, getText, getNotes, getPairs = () => []) => {
    const out = root.querySelector('.c2u-x-out');
    root.querySelector('[data-x="notes"]').onclick = async () => {
      await copyText(getNotes());
      out.innerHTML = '<span style="color:#9be29b">コピーしました。</span>untap のデッキ画面の「Play Notes」タブに貼ると、対戦中に日本語名と元のページを見られます。';
      log('対戦用メモをコピー');
    };
    root.querySelector('[data-x="diff"]').onclick = () => {
      out.innerHTML = `<div style="opacity:.8;margin-bottom:4px">比べたいデッキを貼り付け（untap の「Export Deck」の中身、別のページでコピーした内容など）</div>` +
        `<textarea style="width:100%;box-sizing:border-box;min-height:90px;background:#111;color:#eee;border:1px solid #444;border-radius:4px;font:11px/1.4 monospace"></textarea>` +
        `<button style="all:unset;cursor:pointer;background:#2f6fed;color:#fff;border-radius:6px;padding:3px 10px;margin-top:4px">比べる</button><div class="c2u-diff" style="margin-top:6px"></div>`;
      const ta = out.querySelector('textarea');
      out.querySelector('button').onclick = async () => {
        const box = out.querySelector('.c2u-diff'); box.textContent = '比べています…';
        const t = getText(), jp = await jpResolver(getPairs(), [t, ta.value]);
        box.innerHTML = diffHtml(t, ta.value, jp); log('差分を表示');
      };
      ta.focus();
    };
  };

  /* ---------- 枚数チェック（ゲームごとの決まった枚数と比べる） ---------- */
  const RULES = {
    op: [['//play-1', 'リーダー', 1, 1], ['//deck-1', 'デッキ', 50, 50], ['//deck-2', 'ドン!!', 10, 10]],
    yg: [['//deck-1', 'メイン', 40, 60], ['//deck-2', 'EX', 0, 15], ['//sideboard-1', 'サイド', 0, 15]],
    pk: [['//deck-1', 'デッキ', 60, 60]],
    dm: [['//deck-1', 'メイン', 40, 40], ['//deck-2', '超GR', 0, 12], ['//pile-public', '超次元', 0, 8]],
    vg: [['//pile-facedown', 'ライド', 4, 5], ['//deck-1', 'デッキ', 50, 50]],
    ws: [['//deck-1', 'デッキ', 50, 50]],
  };
  const countCheck = (text, game) => {
    const rules = RULES[game];
    if (!rules) return '';
    const z = {}; let cur = '//deck-1';
    for (const l of String(text).split('\n')) { const h = l.match(/^\/\/\S+/), n = l.match(/^(\d+) /); if (h) cur = h[0]; else if (n) z[cur] = (z[cur] || 0) + Number(n[1]); }
    const parts = [], bad = [];
    for (const [h, label, lo, hi] of rules) {
      const n = z[h] || 0;
      if (!n && lo === 0) continue;
      const ok = n >= lo && n <= hi && !(game === 'dm' && h === '//deck-2' && n !== 12);
      parts.push(`${label} ${n}${lo === hi ? '/' + hi : '枚'} ${ok ? '✓' : '✗'}`);
      if (!ok) bad.push(`${label}は${lo === hi ? lo : lo + '〜' + hi}枚のはず`);
    }
    log('枚数チェック(' + game + '): ' + parts.join(' ') + (bad.length ? ' / NG' : ''));
    return bad.length
      ? `<div style="color:#ffb454;font-size:12px;margin-top:4px">枚数が合いません：${esc(parts.join('・'))}（${esc(bad.join('、'))}）。ページの読み取り漏れか、そういう構成のデッキです。おかしいと思ったらパネル下の「報告用にコピー」を。</div>`
      : `<div style="color:#9be29b;font-size:12px;margin-top:4px">枚数チェック：${esc(parts.join('・'))}</div>`;
  };
  const gameOf = b => Object.keys(LOOK).find(k => LOOK[k] === b.look);

  /* ---------- 不具合報告（エラー内容・ページの状態をまとめてコピー） ---------- */
  const LOG = [];
  const log = t => { LOG.push(new Date().toTimeString().slice(0, 8) + ' ' + t); if (LOG.length > 30) LOG.shift(); };
  const probes = () => {
    const q = s => document.querySelectorAll(s).length;
    const da = document.querySelector('.DeckArea');
    return [
      '__NEXT_DATA__:' + !!document.getElementById('__NEXT_DATA__'), 'table:' + q('table'), 'main table:' + q('main table'),
      '.card-item:' + q('.card-item'), '.recipe-single-list:' + q('.recipe-single-list'), '.deckrecipeBlock:' + q('.deckrecipeBlock'),
      'PCGDECK:' + !!window.PCGDECK, '.DeckArea:' + !!da, 'vue:' + !!(da && da.__vue__), '$nuxt:' + !!window.$nuxt,
    ].join(' ');
  };
  const errs = [];
  const reportText = e => [
    '【untapへ転送 不具合報告】',
    '版: ' + C2U_VER,
    '日時: ' + new Date().toLocaleString('ja-JP'),
    'ページ: ' + location.href,
    'ページ名: ' + document.title,
    'ブラウザ: ' + navigator.userAgent,
    e ? 'エラー: ' + (e.message || e) : 'エラー: （なし・結果がおかしいときの報告）',
    e && e.stack ? '発生箇所: ' + String(e.stack).split('\n').slice(0, 4).join(' / ') : '',
    'ページの状態: ' + probes(),
    '操作の記録:', ...LOG.map(l => '  ' + l),
  ].filter(Boolean).join('\n');
  const errHtml = (e, big) => {
    errs.push(e); log('エラー: ' + (e.message || e));
    return `<div style="color:#ff7b7b;${big ? '' : 'font-size:12px'}">${esc(e.message || e)}</div>` +
      `<button data-report="${errs.length - 1}" style="all:unset;cursor:pointer;margin-top:4px;font-size:12px;border:1px solid #555;border-radius:6px;padding:2px 8px">報告用にコピー</button>` +
      `<span class="c2u-rep" style="font-size:12px;margin-left:6px;opacity:.8"></span>`;
  };
  panel.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-report]');
    if (!b) return;
    const i = b.dataset.report;
    await copyText(reportText(i === 'none' ? null : errs[Number(i)]));
    const m = b.parentElement.querySelector('.c2u-rep') || b;
    m.textContent = 'コピーしました。LINE などでそのまま送ってください';
  });
  const foot = document.createElement('div');
  foot.style.cssText = 'margin-top:8px;padding-top:6px;border-top:1px solid #333;font-size:11px;opacity:.7';
  foot.innerHTML = 'うまく動かないとき：<a href="javascript:void(0)" data-report="none" style="color:#8ab4ff">状況を報告用にコピー</a>' +
    '<span class="c2u-rep" style="margin-left:6px"></span><div>（ページの URL・ブラウザの種類・エラー内容が含まれます）</div>';
  panel.appendChild(foot);
  /* ================= untap.in 側：クリップボードのデッキを自動で取り込む＋履歴 ================= */
  const META_RE = /^\/\/c2u (.*)$/m;
  const withMeta = (text, title, sub) => text + '\n\n//c2u ' + [title, sub, location.href].map(x => String(x || '').replace(/[|\n]/g, ' ').trim()).join(' | ');
  const UT_GAMES = { OPCG: 'op', PKM: 'pk', DUEMA: 'dm', CFV: 'vg', WSTCG: 'ws', YGO: 'yg' };
  const UT_NAMES = { op: 'ワンピース', pk: 'ポケモン', yg: '遊戯王', dm: 'デュエマ', vg: 'ヴァンガード', ws: 'ヴァイス' };
  const guessGame = text => {
    if (/^\/\/pile-facedown/m.test(text)) return 'vg';
    if (/\[(op|st|eb|prb|p)\d*-\d{3}\]/i.test(text)) return 'op';
    if (/^\/\/pile-public/m.test(text)) return 'dm';
    if (/\((sv|svm|svp)[^)]*\)/i.test(text)) return 'pk';
    if (/^\d+ .*\/[a-z]*w[a-z]?\d+-/im.test(text)) return 'ws';
    return '';
  };
  const HIST_KEY = 'c2u-history-v1';
  const histGet = () => { try { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); } catch (e) { return []; } };
  const histSet = h => { try { localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(0, 100))); } catch (e) {} };
  const parseMeta = text => {
    const m = String(text).match(META_RE);
    const [title, sub, url] = m ? m[1].split(' | ') : [];
    return { title: (title || '').trim(), sub: (sub || '').trim(), url: (url || '').trim() };
  };
  const untapLookQ = (game, line) => {
    const body = line.replace(/^\d+\s+/, '');
    if (game === 'op') { const n = body.match(/\[([a-z]+\d*-\d{3})\]/i); return n ? n[1].toUpperCase() + ' ' + body : body; }
    const name = body.replace(/\s*[\[(][^\[\]()]*[\])]\s*$/, '').trim();
    return game === 'vg' ? 'x ' + name : name;
  };
  const untapMode = async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const byText = (sel, re) => [...document.querySelectorAll(sel)].find(e => re.test(e.textContent.trim()) && e.offsetParent !== null);
    const titleIn = document.querySelector('.deck-title-input');
    const code = titleIn && (titleIn.closest('.container') || document.body).innerText.trim().split('\n')[0].trim();
    const game = UT_GAMES[code] || (titleIn && /Yu-?Gi-?Oh/i.test(titleIn.closest('.container').innerText.slice(0, 80)) ? 'yg' : '');
    const onDeck = !!titleIn && /\/deck\//.test(location.pathname);
    const setName = name => {
      if (!titleIn || !name) return;
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      set.call(titleIn, name.slice(0, 80)); titleIn.dispatchEvent(new Event('input', { bubbles: true })); titleIn.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const autoImport = async text => {
      const clr = byText('a,button,span,div', /^Clear Failed$/); if (clr) { clr.click(); await w(200); }
      const tab = byText('button', /^Import \/ Export$/); if (tab) { tab.click(); await w(400); }
      const pb = byText('button', /^Paste Deck$/); if (!pb) throw new Error('untap の「Paste Deck」ボタンが見つかりません（デッキ編集画面で実行してください）');
      pb.click();
      let ta = null; for (let i = 0; i < 20 && !ta; i++) { await w(150); ta = document.querySelector('textarea[placeholder="Paste your cards here"]'); }
      if (!ta) throw new Error('貼り付け欄が開きませんでした');
      const setTa = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setTa.call(ta, text); ta.dispatchEvent(new Event('input', { bubbles: true }));
      const cb = [...document.querySelectorAll('input[type=checkbox]')].find(c => /Clear existing/.test(c.parentElement.textContent));
      if (cb && !cb.checked) cb.click();
      const ib = byText('button', /^Import Cards$/); if (!ib) throw new Error('「Import Cards」ボタンが見つかりません');
      ib.click();
      await w(2500);
      const fb = [...document.querySelectorAll('*')].find(e => e.children.length && /^Cards Failed Import/.test(e.textContent.trim()) && e.offsetParent !== null && e.textContent.length < 3000);
      const failed = fb ? fb.innerText.split('\n').map(s => s.trim()).filter(s => /^\d+ /.test(s) && !/^\/\/c2u/.test(s)) : [];
      return failed;
    };
    const record = (text, meta) => {
      const h = histGet().filter(x => x.text !== text);
      h.unshift({ at: Date.now(), game: game || guessGame(text), title: meta.title || '（名前なし）', sub: meta.sub, url: meta.url, text });
      histSet(h);
    };
    // ヴァイス：登録済みの英語名（GitHub の ws-names.json＋この untap に保存した分）を番号で当てはめる
    let wsNames = null;
    const wsNamesGet = async () => (wsNames = wsNames || { ...(await wsRemote()), ...wsDict() });
    const wsApply = (text, names) => text.replace(/^(\d+) (.+?) \(([a-z0-9]+\/[a-z0-9]+-[a-z0-9]+)\)$/gim,
      (l, q, nm, no) => { const en = names[no.toUpperCase()]; return en ? `${q} ${en} (${no.toLowerCase()})` : l; });
    let last = null; // 最後に取り込んだデッキ（再取り込み用）
    // 友人からの依頼の入口（Google フォーム。依頼内容を事前入力して開く）
    const REQ_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSfBI-qi51bINoY5ou9_KaH1jOK5RMtb8Yp7GXHrmlPU8xMRtw/viewform';
    const REQ_ENTRY = 'entry.1346860428';
    const REQ_NAME_KEY = 'c2u-req-name-v1';
    const reqName = () => { try { return localStorage.getItem(REQ_NAME_KEY) || ''; } catch (e) { return ''; } };
    const reqText = (failed, meta, g, forForm) => [
      '【untap カード作成依頼】',
      reqName() ? '依頼者: ' + reqName() : '',
      'ゲーム: ' + (UT_NAMES[g] || g || '不明') + (code ? '（' + code + '）' : ''),
      'デッキ: ' + (meta.title || '（名前なし）') + (meta.url ? ' | ' + meta.url : ''),
      'untap の作業用デッキ: ' + location.href,
      '未登録カード（' + failed.length + ' 行）:',
      ...failed.map(l => {
        const m = l.match(/^(\d+) (.+?)(?: \(([^)]+)\)| \[([^\]]+)\])?$/) || [];
        const no = (m[3] || m[4] || '').toUpperCase();
        return '- ' + [no || '（番号なし）', m[2] || l, (m[1] || '?') + '枚', !forForm && g === 'ws' && no ? wsImg(no) : ''].filter(Boolean).join(' | ');
      }),
    ].filter(Boolean).join('\n');
    const sendReq = async (failed, meta, g, msg) => {
      const t = reqText(failed, meta, g, true);
      const url = REQ_FORM + '?usp=pp_url&' + REQ_ENTRY + '=' + encodeURIComponent(t);
      const long = url.length > 7000;
      if (long) await copyText(t);
      const a = document.createElement('a'); a.href = long ? REQ_FORM : url; a.target = '_blank'; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      msg.innerHTML = long
        ? '<span style="color:#ffb454">依頼が長いので、内容をコピーしました。開いたフォームの「依頼内容」に貼り付けて「送信」を押してください。</span>'
        : '<span style="color:#9be29b">依頼フォームを開きました。内容を確認して「送信」を押してください。</span>登録が終わったら、もう一度取り込むと入ります。';
      log('作成依頼を送る ' + failed.length + '行' + (long ? '（コピー）' : ''));
    };
    const doImport = async (text, meta, out) => {
      if (!onDeck) throw new Error('untap のデッキ編集画面（Decks → デッキを開いた画面）で実行してください');
      const g2 = guessGame(text);
      if (game && g2 && game !== g2) throw new Error(`このデッキは${UT_NAMES[game]}ですが、取り込もうとしたのは${UT_NAMES[g2]}のデッキのようです。同じゲームのデッキ画面で実行してください`);
      out.innerHTML = '取り込み中…';
      const g = game || g2;
      if (g === 'ws') text = wsApply(text, await wsNamesGet());
      const failed = await autoImport(text);
      last = { text, meta };
      if (panel.querySelector('[data-setname]').checked) setName(meta.title);
      record(text, meta);
      log('untap取り込み: ' + meta.title + ' 失敗' + failed.length);
      out.innerHTML = `<div style="color:#9be29b">取り込みました${panel.querySelector('[data-setname]').checked && meta.title ? '（デッキ名も入れました）' : ''}。確認して、untap 右上の「Save」を押してください。</div>` +
        countCheck(text, g) +
        (failed.length ? `<div style="color:#ffb454;margin-top:4px">取り込めなかったカード ${failed.length} 行（名前を押すと調べるページが開きます）:<br>` +
          failed.map(l => { const L = LOOK[g]; return L ? `<a target="_blank" rel="noopener" href="${esc(L(untapLookQ(g, l)))}" style="color:#ffb454;text-decoration:underline">${esc(l)}</a>` : esc(l); }).join('<br>') + `</div>` +
          `<div style="margin-top:6px;padding:6px;border:1px dashed #ffb454;border-radius:6px">未登録のカードは、登録をお願いできます。` +
          `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:4px"><input data-reqname placeholder="あなたの名前（任意）" value="${esc(reqName())}" style="all:unset;box-sizing:border-box;width:140px;padding:2px 4px;background:#111;border:1px solid #444;border-radius:4px;color:#eee">` +
          `<button data-reqsend style="all:unset;cursor:pointer;background:#b8741a;color:#fff;border-radius:6px;padding:3px 10px">作成依頼を送る</button>` +
          `<button data-req style="all:unset;cursor:pointer;border:1px solid #ffb454;color:#ffb454;border-radius:6px;padding:3px 10px">依頼内容をコピー</button></div>` +
          `<div class="c2u-req-out" style="margin-top:4px;opacity:.9"></div></div>` : '');
      const rb = out.querySelector('[data-req]'), rs = out.querySelector('[data-reqsend]'), rn = out.querySelector('[data-reqname]');
      if (rn) rn.oninput = () => { try { localStorage.setItem(REQ_NAME_KEY, rn.value.trim()); } catch (e) {} };
      if (rb) rb.onclick = async () => { await copyText(reqText(failed, meta, g)); out.querySelector('.c2u-req-out').textContent = 'コピーしました。LINE などで登録してくれる人に送るか、登録担当のチャットに貼ってください'; };
      if (rs) rs.onclick = () => sendReq(failed, meta, g, out.querySelector('.c2u-req-out')).catch(e => { out.querySelector('.c2u-req-out').innerHTML = errHtml(e); });
      renderHist();
      return failed;
    };

    /* ---------- カード登録アシスト：Add Missing Card のフォームに自動で入力する（Add Card は人が押す） ---------- */
    const setVal = (el, v) => {
      const P = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(P, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const until = async (fn, ms = 6000) => { for (let t = 0; t < ms; t += 150) { const r = fn(); if (r) return r; await w(150); } return null; };
    // 「Add Missing Card」で始まり、入力欄やボタンを含むいちばん内側の枠
    const modal = () => [...document.querySelectorAll('div')].filter(d => d.offsetParent !== null && /^Add Missing Card/.test(d.innerText.trim()) && d.querySelector('input,button,select,textarea'))
      .sort((a, b) => a.innerText.length - b.innerText.length)[0];
    const fieldBy = (root, label, sel) => { // ラベル文字の近くの入力欄
      const lab = [...root.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim() === label);
      let b = lab; for (let i = 0; i < 5 && b; i++) { b = b.parentElement; const f = b && b.querySelector(sel); if (f) return f; }
      return null;
    };
    const pickOpt = (s, re) => { const o = [...s.options].find(x => re.test(x.textContent)); if (o) setVal(s, o.value); return !!o; };
    // card: { no, name, text, image, reprint(true/false/自動) }
    const fillCard = async card => {
      if (!onDeck) throw new Error('untap のデッキ編集画面で実行してください');
      let m = modal();
      if (!m) {
        const link = byText('a,button,span', /^Add Missing Card$/);
        if (!link) throw new Error('「Add Missing Card」が見つかりません（デッキ編集画面の右下）');
        link.click();
        await until(() => modal() || byText('button,a', /I understand/i));
        const ok = byText('button,a', /I understand/i); if (ok) { ok.click(); await w(400); }
        m = await until(modal);
      }
      if (!m) throw new Error('登録画面が開きませんでした');
      const nameIn = await until(() => [...m.querySelectorAll('input')].find(i => /exactly as printed/i.test(i.placeholder || '')));
      if (!nameIn) throw new Error('カード名の入力欄が見つかりません（登録画面を一度閉じてやり直してください）');
      setVal(nameIn, card.name);
      await until(() => /Already In The Database|Nothing Matched/i.test(m.innerText), 5000);
      await w(300);
      // 既存カード：名前が完全一致する行の「Add reprint」
      const norm = s => s.replace(/\s+/g, ' ').trim().toLowerCase();
      let mode = 'new';
      if (card.reprint !== false) {
        const rows = [...m.querySelectorAll('*')].filter(e => [...e.querySelectorAll('button,a')].some(b => /^Add reprint$/i.test(b.textContent.trim())) && e.innerText.length < 400);
        const hit = rows.find(r => norm(r.innerText.split('\n')[0]) === norm(card.name));
        if (hit) { [...hit.querySelectorAll('button,a')].find(b => /^Add reprint$/i.test(b.textContent.trim())).click(); mode = 'reprint'; }
        else if (card.reprint === true) throw new Error('同じ名前の既存カードが見つかりません：' + card.name);
      }
      if (mode === 'new') {
        const nb = [...m.querySelectorAll('button')].find(b => /It's a new card/i.test(b.textContent));
        if (!nb) throw new Error('「It\'s a new card」ボタンが見つかりません');
        nb.click();
      }
      // 画像：URL を貼って Continue
      const urlIn = await until(() => { const M = modal(); return M && [...M.querySelectorAll('input')].find(i => /paste an image URL/i.test(i.placeholder || '')); });
      if (!urlIn) throw new Error('画像 URL の入力欄が見つかりません');
      setVal(urlIn, card.image || wsImg(card.no));
      urlIn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      urlIn.blur();
      const cont = await until(() => { const M = modal(); return M && [...M.querySelectorAll('button')].find(b => /^Continue$/i.test(b.textContent.trim()) && !b.disabled); }, 15000);
      if (!cont) throw new Error('画像を読み込めませんでした（URL を確認してください）：' + (card.image || wsImg(card.no)));
      await w(500); cont.click();
      // カード情報
      // 実物の欄名：title / set / image-type（印刷の種類）。向きは Portrait を含む select、テキストは textarea
      const F = {
        id: M => M.querySelector('input[name="set"]') || fieldBy(M, 'Set / Release Identifier', 'input'),
        title: M => M.querySelector('input[name="title"]') || fieldBy(M, 'Title On Card', 'input'),
        type: M => M.querySelector('select[name="image-type"]') || fieldBy(M, 'Print Type', 'select'),
        orient: M => [...M.querySelectorAll('select')].find(x => [...x.options].some(o => /^Portrait$/i.test(o.textContent.trim()))),
        front: M => fieldBy(M, 'Front', 'textarea') || M.querySelector('textarea'),
      };
      const idIn = await until(() => { const M = modal(); return M && F.id(M); }, 15000);
      if (!idIn) throw new Error('「Set / Release Identifier」の欄が見つかりません');
      await w(800); // 画像からの自動入力が終わるのを待つ
      const M = modal();
      if (mode === 'new') {
        const t = F.title(M); if (t) setVal(t, card.name);
        const f = F.front(M); if (f && card.text != null) setVal(f, card.text);
      }
      setVal(idIn, card.no.toLowerCase());
      const pt = F.type(M); if (pt) pickOpt(pt, /^Official print$/i);
      const or = F.orient(M); if (or) pickOpt(or, /^Portrait$/i);
      const add = [...M.querySelectorAll('button')].find(b => /^Add Card$/i.test(b.textContent.trim()));
      if (add) { add.style.outline = '3px solid #ffb454'; add.scrollIntoView({ block: 'center' }); }
      const d = wsDict(); d[card.no.toUpperCase()] = card.name; wsSave(d); if (wsNames) wsNames[card.no.toUpperCase()] = card.name;
      log('登録アシスト: ' + card.no + ' ' + mode);
      return mode;
    };
    const parseCards = s => {
      s = String(s).replace(/```(json)?/g, '').trim();
      const a = JSON.parse(s.slice(s.indexOf('['), s.lastIndexOf(']') + 1));
      return a.filter(c => c && c.no && c.name).map(c => ({ no: String(c.no).trim(), name: String(c.name).trim(), text: c.text == null ? null : String(c.text), image: c.image || '', reprint: c.reprint }));
    };
    const regHtml = () =>
      `<details style="margin-top:10px" data-reg><summary style="cursor:pointer"><b>カード登録アシスト</b> <span style="font-size:11px;opacity:.7">（登録担当のチャットが作った登録用データを貼る）</span></summary>` +
      `<textarea data-regin placeholder='[{"no":"GIM/W124-032","name":"…","text":"…"}]' style="all:unset;box-sizing:border-box;display:block;width:100%;height:70px;margin-top:4px;padding:4px;background:#111;border:1px solid #444;border-radius:4px;color:#eee;font-size:11px;white-space:pre-wrap"></textarea>` +
      `<button data-regload style="all:unset;cursor:pointer;margin-top:4px;border:1px solid #555;border-radius:6px;padding:2px 10px;font-size:12px">読み込む</button>` +
      `<div class="c2u-reg" style="font-size:12px;margin-top:6px"></div></details>`;
    const wireReg = () => {
      const box = body.querySelector('.c2u-reg'); let cards = [];
      const render = (msg = '') => {
        box.innerHTML = (msg ? `<div style="margin-bottom:4px">${msg}</div>` : '') + cards.map((c, i) =>
          `<div style="border-top:1px solid #333;padding:4px 0;display:flex;gap:6px;align-items:center"><div style="flex:1"><div>${esc(c.name)}</div><div style="opacity:.6">${esc(c.no)}${c.done ? ' · <span style="color:#9be29b">' + (c.done === 'reprint' ? '版を追加' : '新規') + 'で入力済み</span>' : ''}</div></div>` +
          `<button data-fill="${i}" style="all:unset;cursor:pointer;background:${c.done ? '#333' : '#2f6fed'};color:#fff;border-radius:6px;padding:3px 10px;white-space:nowrap">フォームに入力</button></div>`).join('') +
          (cards.length ? `<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap"><button data-regre style="all:unset;cursor:pointer;background:#2f6fed;color:#fff;border-radius:6px;padding:3px 10px">登録後にもう一度取り込む</button>` +
            `<button data-regexp style="all:unset;cursor:pointer;border:1px solid #555;border-radius:6px;padding:3px 10px">英語名データを書き出す</button></div>` : '');
      };
      body.querySelector('[data-regload]').onclick = () => {
        try { cards = parseCards(body.querySelector('[data-regin]').value); render(`${cards.length} 枚を読み込みました。上から順に「フォームに入力」→ 中身を確認して untap の「Add Card」を押してください。`); }
        catch (e) { box.innerHTML = errHtml(new Error('登録用データを読めませんでした（[ で始まり ] で終わるデータを貼ってください）')); }
      };
      box.addEventListener('click', async ev => {
        const f = ev.target.closest('[data-fill]');
        try {
          if (f) { const c = cards[Number(f.dataset.fill)]; f.textContent = '入力中…'; c.done = await fillCard(c); render(`<span style="color:#9be29b">${esc(c.no)} を入力しました。</span>内容を確認して、光っている「Add Card」を押してください。`); }
          else if (ev.target.closest('[data-regre]')) {
            if (!last) throw new Error('先に「コピーしたデッキを取り込む」でデッキを取り込んでください');
            wsNames = null; const failed = await doImport(last.text, last.meta, out);
            render(failed.length ? `<span style="color:#ffb454">まだ ${failed.length} 行取り込めません（上の一覧）。</span>` : '<span style="color:#9be29b">全部取り込めました。</span>「Save」を押してください。');
          } else if (ev.target.closest('[data-regexp]')) {
            const all = await wsNamesGet(), keys = Object.keys(all).sort();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([JSON.stringify({ app: 'untapへ転送', kind: 'ws-names', saved: new Date().toISOString(), names: Object.fromEntries(keys.map(k => [k, all[k]])) }, null, 1)], { type: 'application/json' }));
            a.download = 'ws-names.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
            render(`英語名 ${keys.length} 件を ws-names.json に書き出しました。GitHub に上書きアップロードすると、友人の環境でも自動で使われます。`);
          }
        } catch (e) { render(errHtml(e)); }
      });
      // 登録担当のチャット（ブラウザ操作）から呼べるように
      window.c2u = { fillCard, parseCards, reimport: () => body.querySelector('[data-regre]') && body.querySelector('[data-regre]').click(), load: s => { body.querySelector('[data-regin]').value = s; body.querySelector('[data-regload]').click(); } };
    };
    body.innerHTML =
      `<div style="margin-bottom:6px">${onDeck ? `このデッキ：<b>${esc(UT_NAMES[game] || code || '不明')}</b>` : '<span style="color:#ffb454">デッキ編集画面で使うと自動で取り込めます（今は履歴の確認とコピーだけできます）</span>'}</div>` +
      (onDeck ? `<button data-clip style="all:unset;cursor:pointer;background:#2f6fed;color:#fff;border-radius:6px;padding:6px 12px">コピーしたデッキを取り込む</button>` +
        `<label style="display:block;font-size:12px;margin-top:4px"><input type="checkbox" data-setname checked> デッキ名も入れる</label>` : '<input type="checkbox" data-setname style="display:none">') +
      `<div class="c2u-ut-out" style="font-size:12px;margin-top:6px"></div>` + (onDeck ? regHtml() : '') +
      `<div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center"><b>履歴</b><label style="font-size:11px;opacity:.8"><input type="checkbox" data-all> 全ゲーム</label></div><div class="c2u-hist"></div>`;
    const out = body.querySelector('.c2u-ut-out');
    const renderHist = () => {
      const all = body.querySelector('[data-all]').checked || !game;
      const h = histGet(), box = body.querySelector('.c2u-hist');
      const list = h.map((x, i) => [x, i]).filter(([x]) => all || x.game === game);
      box.innerHTML = list.length ? list.map(([x, i]) =>
        `<div style="border-top:1px solid #333;padding:5px 0;font-size:12px"><div><b>${esc(x.title)}</b> <span style="opacity:.6">${esc(UT_NAMES[x.game] || '')}</span></div>` +
        `<div style="opacity:.6">${esc(x.sub || '')} · ${new Date(x.at).toLocaleDateString('ja-JP')}</div>` +
        `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:2px">` +
        (onDeck ? `<a href="javascript:void(0)" data-h="imp" data-i="${i}" style="color:#8ab4ff">このデッキに取り込む</a>` : '') +
        `<a href="javascript:void(0)" data-h="copy" data-i="${i}" style="color:#8ab4ff">コピー</a>` +
        `<a href="javascript:void(0)" data-h="name" data-i="${i}" style="color:#8ab4ff">デッキ名をコピー</a>` +
        (x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener" style="color:#8ab4ff">元のページ</a>` : '') +
        `<a href="javascript:void(0)" data-h="del" data-i="${i}" style="color:#ff9b9b">削除</a></div></div>`).join('')
        : '<div style="font-size:12px;opacity:.6">まだありません。取り込んだデッキがここに残ります（最大100件）。</div>';
    };
    body.querySelector('[data-all]').onchange = renderHist;
    body.addEventListener('click', async ev => {
      const a = ev.target.closest('[data-h]'); if (!a) return;
      const h = histGet(), x = h[Number(a.dataset.i)]; if (!x) return;
      try {
        if (a.dataset.h === 'imp') await doImport(x.text, x, out);
        else if (a.dataset.h === 'copy') { await copyText(x.text); out.innerHTML = '<span style="color:#9be29b">コピーしました</span>'; }
        else if (a.dataset.h === 'name') { await copyText(x.title); out.innerHTML = '<span style="color:#9be29b">デッキ名をコピーしました</span>'; }
        else if (a.dataset.h === 'del') { h.splice(Number(a.dataset.i), 1); histSet(h); renderHist(); }
      } catch (e) { out.innerHTML = errHtml(e); }
    });
    const clip = body.querySelector('[data-clip]');
    if (clip) clip.onclick = async () => {
      try {
        let text = '';
        try { text = await navigator.clipboard.readText(); } catch (e) { throw new Error('クリップボードを読めませんでした。Chrome の「クリップボードへのアクセス」を許可してから、もう一度押してください'); }
        if (!/^\d+ /m.test(text)) throw new Error('クリップボードにデッキが入っていません。先にデッキのページでブックマークを押して「コピー」してください');
        await doImport(text, parseMeta(text), out);
      } catch (e) { out.innerHTML = errHtml(e); }
    };
    if (onDeck) wireReg();
    renderHist();
    return null;
  };

  try {
    const h = location.hostname;
    if (/(^|\.)untap\.in$/.test(h)) { log('untap モード'); await untapMode(); return; }
    const site = /cardrush\.media$/.test(h) ? cardrush
      : /tcg-portal\.jp$/.test(h) ? tcgPortal
      : /deck-maker\.com$/.test(h) ? deckMaker
      : /pokemon-card\.com$/.test(h) ? pokeOfficial
      : /cf-vanguard\.com$/.test(h) ? vgOfficial
      : /decklog\.bushiroad\.com$/.test(h) ? deckLog
      : /ws-tcg\.com$/.test(h) ? wsOfficial : null;
    if (!site) throw new Error('対応サイト（untap.in のデッキ画面では、コピーしたデッキの自動取り込みと履歴）：cardrush（ワンピース・ポケモン）／ TCG PORTAL（遊戯王・ワンピース・ポケモン・デュエマ）／ DECK MAKER（遊戯王・デュエマ）／ ポケカ公式のデッキ表示ページ ／ ヴァンガード公式の入賞者デッキレシピ・DECK LOG ／ ヴァイス公式のデッキレシピ');
    log('開始: ' + location.hostname);
    const decks = await site();
    log('デッキ ' + decks.length + ' 件: ' + decks.map(d => d.title + '（' + d.sub + '）').join(' / ').slice(0, 400));
    body.innerHTML = `<div style="opacity:.75;margin-bottom:8px">${decks.some(d => d.ws) ? '「開く」→ 英語名を確認・入力 →「untap用にコピー」→ untap の Paste Deck に貼り付け' : '「コピー」→ untap の Paste Deck に貼り付け'}</div>`;
    for (const d of decks) {
      const box = document.createElement('div');
      box.style.cssText = 'border:1px solid #3a3d44;border-radius:8px;padding:8px;margin-bottom:8px';
      box.innerHTML =
        `<div style="display:flex;justify-content:space-between;gap:8px;align-items:center">` +
        `<div${d.el ? ' data-jump title="ページのこのデッキの場所へ移動" style="cursor:pointer"' : ''}><b${d.el ? ' style="text-decoration:underline dotted"' : ''}>${esc(d.title)}</b><div style="opacity:.7;font-size:12px">${esc(d.sub)}${d.el ? ' <span style="opacity:.8">↓ 場所へ</span>' : ''}</div></div>` +
        `<button style="all:unset;cursor:pointer;background:#2f6fed;color:#fff;border-radius:6px;padding:4px 12px;white-space:nowrap">${d.ws ? '開く' : 'コピー'}</button></div>` +
        `<div class="c2u-info"></div>`;
      const btn = box.querySelector('button'), info = box.querySelector('.c2u-info');
      const jb = box.querySelector('[data-jump]');
      if (jb) jb.onclick = () => {
        const e = d.el();
        if (!e) { jb.querySelector('div').insertAdjacentHTML('beforeend', ' <span style="color:#ffb454">（場所が見つかりませんでした）</span>'); return; }
        e.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const o = e.style.outline; e.style.outline = '3px solid #ffb454'; setTimeout(() => { e.style.outline = o; }, 1800);
      };
      if (d.ws) {
        btn.onclick = async () => {
          btn.textContent = '読み込み中…';
          try { const rows = await d.load(); const remote = await wsRemote(); log('開く: ' + d.title + ' ' + rows.length + '種・GitHub辞書' + Object.keys(remote).length + '件'); wsEditor(info, rows, d.title, remote); btn.textContent = '開く'; }
          catch (e) { btn.textContent = '開く'; info.innerHTML = errHtml(e); }
        };
        body.appendChild(box);
        continue;
      }
      btn.onclick = async () => {
        btn.textContent = '準備中…';
        try {
          const b = await d.build();
          log('コピー: ' + d.title + ' 行数' + b.text.split('\n').filter(l => /^\d+ /.test(l)).length + ' 未変換' + b.missing.length + (b.missing.length ? '（' + b.missing.slice(0, 8).join('、') + '）' : ''));
          b.text = withMeta(b.text, d.title, d.sub);
          await copyText(b.text);
          btn.textContent = 'コピーしました';
          info.innerHTML = countCheck(b.text, gameOf(b)) +
            (b.missing.length ? `<div style="color:#ffb454;font-size:12px;margin-top:4px">英語名が見つからないカード（日本語名のまま出力）。名前を押すと英語名を調べるページが開きます:<br>` +
              b.missing.map(q => b.look ? `<a href="${esc(b.look(q))}" target="_blank" rel="noopener" style="color:#ffb454;text-decoration:underline">${esc(q)}</a>` : esc(q)).join('、') + `</div>` : '') +
            `<details style="margin-top:4px"><summary style="cursor:pointer;opacity:.7;font-size:12px">中身を見る</summary>` +
            `<pre style="white-space:pre-wrap;font-size:11px;margin:4px 0 0">${esc(b.text)}</pre></details>` + extrasHtml();
          wireExtras(info, () => b.text, () => notesText(d.title, d.sub, b.pairs), () => b.pairs);
          if (gameOf(b) === 'op') {
            const box2 = document.createElement('div');
            box2.style.cssText = 'font-size:12px;margin-top:6px;padding-top:6px;border-top:1px dashed #333';
            box2.innerHTML = `ドン!!カード（10枚・DON Deck に入ります）<input value="${esc(opDon())}" style="all:unset;box-sizing:border-box;width:100%;margin:2px 0;padding:2px 4px;background:#111;border:1px solid #444;border-radius:4px;color:#eee">` +
              `<button style="all:unset;cursor:pointer;border:1px solid #555;border-radius:6px;padding:2px 8px">このドン!!で保存して再コピー</button> <button data-reset style="all:unset;cursor:pointer;opacity:.7;text-decoration:underline">通常に戻す</button>` +
              `<div style="opacity:.6;margin-top:2px">untap で「Don card」と検索して、使いたいドン!!の「名前 (版)」を入れてください。例：<code>Don!! Card - Luffy (op01)</code></div><span class="c2u-don-out"></span>`;
            const inp = box2.querySelector('input'), o2 = box2.querySelector('.c2u-don-out');
            const apply = async v => {
              try { if (v && v !== OP_DON_DEFAULT) localStorage.setItem(OP_DON_KEY, v); else localStorage.removeItem(OP_DON_KEY); } catch (e) {}
              inp.value = opDon();
              const nb = await d.build(); b.text = withMeta(nb.text, d.title, d.sub); await copyText(b.text);
              info.querySelector('pre').textContent = b.text;
              o2.innerHTML = '<span style="color:#9be29b"> 保存して、コピーし直しました。</span>';
              log('ドン!!変更: ' + opDon());
            };
            box2.querySelector('button').onclick = () => apply(inp.value.trim());
            box2.querySelector('[data-reset]').onclick = () => apply('');
            info.appendChild(box2);
          }
          setTimeout(() => (btn.textContent = 'コピー'), 1500);
        } catch (e) {
          btn.textContent = 'コピー';
          info.innerHTML = errHtml(e);
        }
      };
      body.appendChild(box);
    }
  } catch (e) {
    body.innerHTML = errHtml(e, true);
  }
})();
