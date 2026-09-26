/* deck → untap.in  v14
 * 対応:
 *   ONE PIECE : cardrush.media（デッキ記事・デッキ詳細）
 *   遊戯王    : tcg-portal.jp（大会結果・投稿デッキ）/ deck-maker.com（デッキ編集画面）
 *   ポケモン  : cardrush.media / tcg-portal.jp / pokemon-card.com（デッキ表示）
 *   デュエマ  : tcg-portal.jp / deck-maker.com（英語名は Duel Masters Wiki を検索して照合）
 *   ヴァイス  : ws-tcg.com（公式デッキレシピ）/ decklog.bushiroad.com（英語名は登録担当が作る ws-names.json から。未登録はその場で照合・登録の依頼）
 *   ヴァンガード: cf-vanguard.com（入賞者デッキレシピ）/ decklog.bushiroad.com（英語名は Cardfight!! Vanguard Wiki をカード番号で照合）
 * ページのデッキを読み取り、公式英語名に変換して untap.in の Paste Deck 用テキストをコピーする。
 */
(async () => {
  const C2U_VER = 'v33';
  const ID = 'c2u-panel';
  // 最小化中にもう一度ブックマークを押したら、作り直さずに元の大きさに戻す（中身をそのまま残す）
  // ただし古い版のパネルが残っていたら戻さずに作り直す（新しい版を使うため）
  { const old = document.getElementById(ID); if (old && old.dataset.min && old.__restore && old.dataset.ver === C2U_VER) { old.__restore(); return; } old?.remove(); }

  /* ---------- UI ---------- */
  const panel = document.createElement('div');
  panel.id = ID;
  panel.dataset.ver = C2U_VER;
  panel.style.cssText =
    'position:fixed;top:12px;right:12px;z-index:2147483647;width:min(420px,calc(100vw - 24px));' +
    'max-height:calc(100vh - 24px);overflow:auto;background:#1b1d22;color:#e8e8e8;border:1px solid #444;' +
    'border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.5);font:13px/1.5 system-ui,sans-serif;padding:12px;text-align:left';
  panel.innerHTML =
    '<div id="c2u-head" style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px">' +
    '<b id="c2u-title" style="cursor:default">untapへ転送 <span style="opacity:.5;font-weight:400;font-size:11px">' + C2U_VER + '</span></b><span style="display:flex;gap:2px;align-items:center">' +
    '<button id="c2u-side" title="パネルを反対側へ移す" style="all:unset;cursor:pointer;padding:0 6px;font-size:15px">⇆</button>' +
    '<button id="c2u-min" title="小さくする（中身はそのまま）" style="all:unset;cursor:pointer;padding:0 6px;font-size:18px">–</button>' +
    '<button id="c2u-x" title="閉じる" style="all:unset;cursor:pointer;padding:0 6px;font-size:18px">×</button></span></div>' +
    '<div id="c2u-body">読み込み中…</div>';
  document.body.appendChild(panel);
  panel.querySelector('#c2u-x').onclick = () => panel.remove();
  // 最小化：いま寄せている側の上端に、見出しの帯だけ残す（右寄せなら右上、左寄せなら左上）
  // ・ボタンは画面の端側に並べるので、小さくしても「–」と「▢」が同じ位置に来る。中身は消さないので続きから使える
  // ・小さくした帯はタイトルをつかんで上下に動かせる。位置と左右はこのサイトのブラウザに覚える
  const PREF = 'c2u-panel-pref-v1';
  const pref = (() => { try { return JSON.parse(localStorage.getItem(PREF) || '{}') || {}; } catch (e) { return {}; } })();
  const savePref = () => { try { localStorage.setItem(PREF, JSON.stringify(pref)); } catch (e) {} };
  let side = pref.side === 'left' ? 'left' : 'right';
  const head = panel.querySelector('#c2u-head'), ttl = panel.querySelector('#c2u-title'), mb = panel.querySelector('#c2u-min');
  const minTop = () => Math.max(8, Math.min(window.innerHeight - 48, Number(pref.minTop) || 12));
  const place = () => {
    panel.style.left = side === 'left' ? '12px' : ''; panel.style.right = side === 'right' ? '12px' : '';
    head.style.flexDirection = side === 'left' ? 'row-reverse' : 'row';
    head.lastElementChild.style.flexDirection = side === 'left' ? 'row-reverse' : 'row';
    panel.style.top = (panel.dataset.min ? minTop() : 12) + 'px';
  };
  const rest = () => [...panel.children].filter(e => e !== head);
  // 見出し（– ⇆ ×）はスクロールしても上に残す。パネルの余白ぶん外に広げて、下の中身が透けないように背景を付ける
  const stickHead = () => Object.assign(head.style, { position: 'sticky', top: '-12px', zIndex: '3', margin: '-12px -12px 8px', padding: '12px 12px 6px', background: '#1b1d22', borderBottom: '1px solid #333' });
  stickHead();
  const minimize = () => {
    panel.dataset.min = '1'; rest().forEach(e => { e.dataset.c2uHid = e.style.display; e.style.display = 'none'; });
    Object.assign(panel.style, { width: 'auto', overflow: 'hidden', padding: '12px 12px 8px' }); // 上と横は開いたときと同じ余白 → ボタンの位置がずれない
    mb.textContent = '▢'; mb.title = '元の大きさに戻す';
    Object.assign(head.style, { position: 'static', margin: '0', padding: '0', background: '', borderBottom: '' }); head.style.gap = '12px';
    ttl.style.cursor = 'ns-resize'; ttl.title = '上下にドラッグで移動・ダブルクリックで戻す';
    place();
  };
  const restore = () => {
    delete panel.dataset.min; rest().forEach(e => { e.style.display = e.dataset.c2uHid || ''; delete e.dataset.c2uHid; });
    Object.assign(panel.style, { width: 'min(420px,calc(100vw - 24px))', overflow: 'auto', padding: '12px' });
    mb.textContent = '–'; mb.title = '小さくする（中身はそのまま）';
    stickHead(); head.style.gap = '8px';
    ttl.style.cursor = 'default'; ttl.title = '';
    place();
  };
  panel.__restore = restore;
  mb.onclick = () => (panel.dataset.min ? restore() : minimize());
  ttl.ondblclick = () => (panel.dataset.min ? restore() : minimize());
  panel.querySelector('#c2u-side').onclick = () => { side = side === 'right' ? 'left' : 'right'; pref.side = side; savePref(); place(); };
  ttl.addEventListener('pointerdown', ev => {
    if (!panel.dataset.min) return;
    ev.preventDefault();
    const y0 = ev.clientY, t0 = panel.getBoundingClientRect().top;
    const mv = e => { pref.minTop = Math.round(t0 + e.clientY - y0); panel.style.top = minTop() + 'px'; };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); pref.minTop = minTop(); savePref(); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  });
  place();
  // パネルの中の画像を押すと大きく表示（もう一度押すと閉じる）
  panel.addEventListener('click', ev => {
    const im = ev.target.closest('img[data-zoom]'); if (!im) return;
    ev.preventDefault();
    const z = document.createElement('div');
    z.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;cursor:zoom-out';
    z.innerHTML = `<img src="${esc(im.src)}" style="max-width:min(92vw,520px);max-height:92vh;border-radius:8px;box-shadow:0 8px 30px #000">`;
    z.onclick = () => z.remove(); document.body.appendChild(z);
  });
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
  // 区切りの揺れに強い照合用：長音「ー」とハイフン類（－ − - ‐ – — ―）を同じ文字として扱う
  //   例：DECK MAKER の「閃刀姫ーシズク」→ 公式「閃刀姫－シズク」。カタカナの長音も両側で同じ置き換えになるので、ふつうの名前は崩れない
  const ygLoose = s => ygNorm(s).replace(/[ー－−\-‐‑–—―ｰ]/g, '|');
  let ygLooseMap = null, ygLooseSrc = null;
  const ygFind = (m, n) => {
    const en = m[ygNorm(n)]; if (en) return en;
    if (ygLooseSrc !== m) { ygLooseSrc = m; ygLooseMap = {}; for (const k in m) { const lk = k.replace(/[ー－−\-‐‑–—―ｰ]/g, '|'); if (!(lk in ygLooseMap)) ygLooseMap[lk] = m[k]; } }
    return ygLooseMap[ygLoose(n)];
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
        let en = ygFind(m, n);
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

  /* ================= ヴァイスシュヴァルツ（英語名は ws-names.json＝登録担当が untap に登録した名前だけを使う） ================= */
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
  // 名前が英字だけ（例「Shiny Days」）：untap は名前で探すので、英語版の同名の別カードが入ることがある
  const wsAscii = nm => /[A-Za-z]/.test(nm) && !/[぀-ヿ㐀-鿿豈-﫿ｦ-ﾟ]/.test(nm);
  // デッキを開いたときの画面：untap に登録済みか（ws-names.json にあるか）を判定し、未登録はその場で照合・登録の依頼
  // ※ HoC の訳は転載禁止なので、英語名の手入力欄は置かない（v20〜。以前ブラウザに保存した手入力の英語名も使わない）
  const wsEditor = (info, rows, title, remote = {}) => {
    const S = 'style="color:#8ab4ff;text-decoration:underline"';
    const st = rows.map(([no, jp]) => remote[no] ? 'ok' : wsAscii(jp) ? 'chk' : 'new');
    const nOk = st.filter(x => x === 'ok').length, nNew = st.filter(x => x === 'new').length, nChk = st.filter(x => x === 'chk').length;
    const line = ([no, jp, q]) => `${q} ${remote[no] || jp} (${no.toLowerCase()})`;
    const badge = { ok: '<span style="color:#9be29b">登録済み</span>', new: '<span style="color:#ffb454">データに無し</span>', chk: '<span style="color:#ffd27a">要確認</span>' };
    info.innerHTML =
      `<div style="margin:6px 0;padding:6px;border-radius:6px;background:#1c1c1c;font-size:13px">` +
      (nOk === rows.length ? `<b style="color:#9be29b">全部英語名データにあります（${rows.length} 種類）</b>。そのまま取り込めます。`
        : `英語名データにある <b>${nOk} / ${rows.length}</b> 種類。` + (nNew ? `<span style="color:#ffb454">データに無い ${nNew} 種類</span>は、untap に取り込むときに番号で探します（他の人が登録済みなら、そのまま入ります）。` : '') +
          (nChk ? `<span style="color:#ffd27a">要確認 ${nChk} 種類</span>は名前が英字だけなので、英語版の同じ名前の別カードが入るかもしれません。` : '')) + `</div>` +
      `<table style="width:100%;border-collapse:collapse;font-size:12px">` +
      rows.map(([no, jp, q], i) =>
        `<tr style="border-top:1px solid #333"><td style="padding:3px 2px;white-space:nowrap;vertical-align:top">${q}×</td>` +
        `<td style="padding:3px 2px"><div>${esc(jp)} ${badge[st[i]]}</div>` + (remote[no] ? `<div style="opacity:.75">${esc(remote[no])}</div>` : '') +
        `<div style="opacity:.6">${esc(no)}` + (wsImg(no) ? ` · <a ${S} target="_blank" rel="noopener" href="${esc(wsImg(no))}">画像</a>` : '') +
        ` · <a ${S} target="_blank" rel="noopener" href="${esc(wsHoc(no))}" title="ファンの英訳サイト。読むだけ（転載禁止なので登録には使いません）">効果を読む（HoC）</a></div></td></tr>`).join('') +
      `</table><div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">` +
      `<button data-a="copy" style="all:unset;cursor:pointer;background:#2f6fed;color:#fff;border-radius:6px;padding:4px 10px">untap用にコピー</button></div>` +
      (nNew || nChk ? `<details style="margin-top:6px;font-size:12px"><summary style="cursor:pointer;opacity:.8">untap で取り込む前に頼む</summary><div style="padding:6px;border:1px dashed #555;border-radius:6px;margin-top:4px">ふつうは、untap で取り込んでから「入らなかったカードだけ」頼めば十分です（取り込むときに番号で探すので、依頼が減ります）。先に頼んでおきたいときはこちら。` +
        `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:4px"><input data-reqname placeholder="あなたの名前（任意）" value="${esc(reqName())}" style="all:unset;box-sizing:border-box;width:140px;padding:2px 4px;background:#111;border:1px solid #444;border-radius:4px;color:#eee">` +
        `<button data-reqsend style="all:unset;cursor:pointer;border:1px solid #ffb454;color:#ffb454;border-radius:6px;padding:3px 10px">照合・登録を頼む</button>` +
        `<button data-req style="all:unset;cursor:pointer;border:1px solid #555;border-radius:6px;padding:3px 10px">依頼内容をコピー</button></div>` +
        `<div class="c2u-req-out" style="margin-top:4px;opacity:.9"></div></div></details>` : '') +
      `<div style="font-size:11px;opacity:.6;margin-top:4px">英語名データ（登録担当が untap に登録した名前）${Object.keys(remote).length} 件を使っています</div>` +
      `<div class="c2u-ws-out" style="font-size:12px;margin-top:6px"></div>` + extrasHtml();
    const out = info.querySelector('.c2u-ws-out');
    wireExtras(info, () => '//deck-1\n' + rows.map(line).join('\n'),
      () => notesText(title, '', rows.filter(([no]) => remote[no]).map(([no, jp]) => [remote[no], jp + '（' + no + '）'])),
      () => rows.map(([no, jp]) => [remote[no] || jp, jp]));
    info.querySelector('[data-a="copy"]').onclick = async () => {
      // (番号) を付ける：untap は名前で探し、同じ名前のカードが複数あれば番号の版を選ぶ
      const text = '//deck-1\n' + rows.map(line).join('\n');
      await copyText(withMeta(text, title, ''));
      out.innerHTML = `<span style="color:#9be29b">コピーしました。</span>` + (nNew ? `<span style="color:#ffb454">データに無い ${nNew} 種類は日本語名のまま入れています（untap で取り込むときに番号で探します）。</span>` : '') + countCheck(text, 'ws') + nextHtml();
    };
    const failed = rows.filter((r, i) => st[i] === 'new').map(line), chk = rows.filter((r, i) => st[i] === 'chk').map(line);
    const meta = { title, url: location.href }, ctx = { code: 'WSTCG', work: '' };
    const rb = info.querySelector('[data-req]'), rs = info.querySelector('[data-reqsend]'), rn = info.querySelector('[data-reqname]'), ro = info.querySelector('.c2u-req-out');
    if (rn) rn.oninput = () => { try { localStorage.setItem(REQ_NAME_KEY, rn.value.trim()); } catch (e) {} };
    if (rb) rb.onclick = async () => { await copyText(reqText(failed, meta, 'ws', false, chk, ctx)); ro.textContent = 'コピーしました。LINE などで登録してくれる人に送るか、登録担当のチャットに貼ってください'; };
    if (rs) rs.onclick = () => sendReq(failed, meta, 'ws', ro, chk, ctx).catch(e => { ro.innerHTML = errHtml(e); });
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
      : `<div style="color:#9be29b;font-size:12px;margin-top:4px">元のデッキの枚数チェック：${esc(parts.join('・'))}</div>`;
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
  // コピーしたあとの次の一歩（デッキのページ用）
  const nextHtml = () => `<div style="font-size:12px;margin-top:6px;padding:6px;border-radius:6px;background:#16233a">次は untap で：デッキの画面を開いて、ブックマーク →「コピーしたデッキを取り込む」。<a href="https://untap.in/" target="_blank" rel="noopener" style="color:#8ab4ff;text-decoration:underline">untap を開く</a>（Decks から同じゲームのデッキを開くか、新しく作る）</div>`;
  const errHtml = (e, big) => {
    errs.push(e); log('エラー: ' + (e.message || e));
    return `<div style="color:#ff7b7b;${big ? '' : 'font-size:12px'}">${esc(e.message || e)}</div>` +
      (/接続が切れています/.test(e.message || '') ? `<button data-reload style="all:unset;cursor:pointer;margin:4px 6px 0 0;font-size:12px;background:#2f6fed;color:#fff;border-radius:6px;padding:3px 10px">ページを再読み込みする</button>` : '') +
      `<button data-report="${errs.length - 1}" style="all:unset;cursor:pointer;margin-top:4px;font-size:12px;border:1px solid #555;border-radius:6px;padding:2px 8px">報告用にコピー</button>` +
      `<span class="c2u-rep" style="font-size:12px;margin-left:6px;opacity:.8"></span>`;
  };
  panel.addEventListener('click', ev => { if (ev.target.closest('[data-reload]')) location.reload(); });
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
  // 友人からの依頼の入口（Google フォーム。依頼内容を事前入力して開く）
  const REQ_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSfBI-qi51bINoY5ou9_KaH1jOK5RMtb8Yp7GXHrmlPU8xMRtw/viewform';
  const REQ_ENTRY = 'entry.1346860428';
  const REQ_NAME_KEY = 'c2u-req-name-v1';
  const reqName = () => { try { return localStorage.getItem(REQ_NAME_KEY) || ''; } catch (e) { return ''; } };
  // ※ 依頼文の形は登録担当のルーティンが読み取っている（1行目【untap 照合・登録の依頼】/旧【untap カード作成依頼】、
  //   「照合:」行、カード行の「候補:」、「英語名の報告」欄、「番号照合で見つかった英語名」欄の見出しの書き出し、区切りの「 | 」）。
  //   見出しの文言や区切りを変えるときは、先に登録担当のチャットに知らせてルーティンを直してもらうこと
  const reqText = (failed, meta, g, forForm, chk = [], ctx = {}) => [
    '【untap 照合・登録の依頼】',
    reqName() ? '依頼者: ' + reqName() : '',
    'ゲーム: ' + (UT_NAMES[g] || g || '不明') + (ctx.code ? '（' + ctx.code + '）' : ''),
    'デッキ: ' + (meta.title || '（名前なし）') + (meta.url ? ' | ' + meta.url : ''),
    ctx.work ? 'untap の作業用デッキ: ' + ctx.work : '',
    g === 'ws' ? '照合: ' + (ctx.check || (ctx.work ? 'まだ' : 'まだ（デッキのページから）')) : '',
    failed.length ? '未登録カード（' + failed.length + ' 行）:' : '',
    ...failed.map(l => {
      const m = l.match(/^(\d+) (.+?)(?: \(([^)]+)\)| \[([^\]]+)\])?$/) || [];
      const no = (m[3] || m[4] || '').toUpperCase();
      const c = ctx.cand && no ? ctx.cand(no) : '';
      return '- ' + [no || '（番号なし）', m[2] || l, (m[1] || '?') + '枚', !forForm && g === 'ws' && no ? wsImg(no) : '', c ? '候補: ' + c : ''].filter(Boolean).join(' | ');
    }),
    ...((ctx.reports && ctx.reports().length) ? ['英語名の報告（依頼者が untap の候補から選択。登録は不要。画像を確かめて ws-names.json に足す）:',
      ...ctx.reports().map(r => '- ' + [r.no, r.jp, r.qty ? r.qty + '枚' : '', r.title + '（登録番号 ' + r.set + '）'].filter(Boolean).join(' | '))] : []),
    ...((ctx.found && ctx.found().length) ? ['番号照合で見つかった英語名（untap に同じ番号の登録が1つだけあったもの。登録不要・確認不要で ws-names.json に足してよい）:',
      ...ctx.found().map(f => '- ' + [f.no, forForm ? '' : f.jp, f.title].filter(Boolean).join(' | '))] : []),
    ...(chk.length ? ['要確認（名前だけで別のカードが入ったかもしれない ' + chk.length + ' 行。この番号で登録されているか確認してください）:',
      ...chk.map(l => { const m = l.match(/^(\d+) (.+?) \(([^)]+)\)$/) || []; const no = (m[3] || '').toUpperCase();
        return '- ' + [no, m[2] || l, (m[1] || '?') + '枚', !forForm && no ? wsImg(no) : ''].filter(Boolean).join(' | '); })] : []),
  ].filter(Boolean).join('\n');
  const sendReq = async (failed, meta, g, msg, chk = [], ctx = {}) => {
    const t = reqText(failed, meta, g, true, chk, ctx);
    const url = REQ_FORM + '?usp=pp_url&' + REQ_ENTRY + '=' + encodeURIComponent(t);
    const long = url.length > 7000;
    if (long) await copyText(t);
    const a = document.createElement('a'); a.href = long ? REQ_FORM : url; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    msg.innerHTML = long
      ? '<span style="color:#ffb454">依頼が長いので、内容をコピーしました。開いたフォームの「依頼内容」に貼り付けて「送信」を押してください。</span>'
      : '<span style="color:#9be29b">依頼フォームを開きました。内容を確認して「送信」を押してください。</span>登録が終わったら、もう一度取り込むと入ります。';
    log('照合・登録を頼む ' + failed.length + '行' + (chk.length ? ' 要確認' + chk.length : '') + (long ? '（コピー）' : ''));
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
      const clr = byText('a,button,span,div', /^Clear Failed$/i); if (clr) { clr.click(); await w(200); }
      const tab = byText('button', /^Import \/ Export$/); if (tab) { tab.click(); await w(400); }
      const pb = byText('button', /^Paste Deck$/); if (!pb) throw new Error(utConnected() === false || !document.querySelector('.deck-title-input') ? OFFLINE : 'untap の「Paste Deck」ボタンが見つかりません（デッキ編集画面で実行してください）');
      pb.click();
      let ta = null; for (let i = 0; i < 20 && !ta; i++) { await w(150); ta = document.querySelector('textarea[placeholder="Paste your cards here"]'); }
      if (!ta) throw new Error('貼り付け欄が開きませんでした');
      const setTa = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setTa.call(ta, text); ta.dispatchEvent(new Event('input', { bubbles: true }));
      const cb = [...document.querySelectorAll('input[type=checkbox]')].find(c => /Clear existing/.test(c.parentElement.textContent));
      if (cb && !cb.checked) cb.click();
      const ib = byText('button', /^Import Cards$/); if (!ib) throw new Error('「Import Cards」ボタンが見つかりません');
      // 前回の「No cards where imported」の通知がまだ残っていることがあるので、押す前からあるものは数えない
      const oldToasts = new Set([...document.querySelectorAll('div,span,p')].filter(e => /No cards (where|were) imported/i.test(e.textContent.trim())));
      ib.click();
      await w(2500);
      // 1枚も一致しないと untap は「No cards where imported」を出すだけで、貼り付け画面が開いたまま残る → 全行を失敗扱いにして画面を閉じる
      const none = [...document.querySelectorAll('div,span,p')].some(e => !oldToasts.has(e) && e.offsetParent !== null && /No cards (where|were) imported/i.test(e.textContent.trim())) || (document.querySelector('textarea[placeholder="Paste your cards here"]') && byText('button', /^Import Cards$/));
      if (none) {
        const cancel = byText('button', /^Cancel$/); if (cancel) { cancel.click(); await w(300); }
        return { all: true, failed: text.split('\n').map(s => s.trim()).filter(s => /^\d+ /.test(s)) };
      }
      // 取り込めなかったカード：2026-09 から untap は `.failed-imports > span`（「2 カード名」だけで番号が消える）。古い形（Cards Failed Import）も読む
      let raw = [...document.querySelectorAll('.failed-imports > span')].filter(e => e.offsetParent !== null).map(e => e.textContent.replace(/\s+/g, ' ').trim());
      if (!raw.length) {
        const fb = [...document.querySelectorAll('*')].find(e => e.children.length && /^Cards Failed Import/i.test(e.textContent.trim()) && e.offsetParent !== null && e.textContent.length < 3000);
        raw = fb ? fb.innerText.split('\n').map(s => s.trim()) : [];
      }
      raw = raw.filter(s => /^\d+ /.test(s) && !/^\/\/c2u/.test(s));
      // 貼った行に戻す（番号を付け直す）。同じ行を二度使わない
      const src = text.split('\n').map(s => s.trim()).filter(s => /^\d+ /.test(s)), used = new Set();
      const norm = x => x.replace(/\s*[\(\[][^\)\]]*[\)\]]\s*$/, '').replace(/\s+/g, ' ').trim().toLowerCase();
      const failed = raw.map(r => { const i = src.findIndex((l, k) => !used.has(k) && (l === r || norm(l) === norm(r))); if (i < 0) return r; used.add(i); return src[i]; });
      // 念のため枚数でも確かめる（「25 Cards - 8 Unique」）
      const want = src.reduce((a, l) => a + Number(l.match(/^\d+/)[0]), 0);
      const hd = [...document.querySelectorAll('*')].find(e => e.childElementCount === 0 && /^\d+ Cards - \d+ Unique/.test(e.textContent.trim()) && e.offsetParent !== null);
      const got = hd ? Number(hd.textContent.trim().match(/^\d+/)[0]) : null;
      return { all: false, failed, want, got };
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
    // untap はカード名で探す（大文字小文字は無視。番号は同名カードの中から版を選ぶだけで、番号が無くても名前が合えば入る）。
    // そのため英語名データに無く名前が英字だけのカードは、英語版の同名の別カードが黙って入ることがある → 取り込み後に警告
    const wsRisky = (text, names) => text.split('\n').map(s => s.trim()).filter(l => {
      const m = l.match(/^\d+ (.+?) \(([a-z0-9]+\/[a-z0-9]+-[a-z0-9]+)\)$/i);
      return m && !names[m[2].toUpperCase()] && wsAscii(m[1]);
    });
    // ヴァイス：英語名データに無いカードを、untap の内部検索（card-search の sets）に番号でまとめて問い合わせる
    // ・番号が完全に一致した登録だけ自動で使う（同じ番号に別の名前が複数あるときは使わず「候補」にする）
    // ・区切りや 0 の有無が違う登録は「候補」として依頼に書き添えるだけ（別のカードを黙って入れないため）
    // ※ untap の非公式な仕組み。使えないときは ok:false で今まで通りの流れに戻る
    const utApi = () => { try { const e = [...document.querySelectorAll('*')].find(x => x.__vue__); const a = e && e.__vue__.$root && e.__vue__.$root.$api; return a && typeof a.send === 'function' ? a : null; } catch (e) { return null; } };
    // untap との接続（放っておくと切れて、ロゴと「Login」の読み込み画面になる）。分からないときは null
    const utConnected = () => { try { const e = [...document.querySelectorAll('*')].find(x => x.__vue__); const a = e && e.__vue__.$root && e.__vue__.$root.$api; return a && typeof a.socketConnected === 'boolean' ? a.socketConnected : null; } catch (e) { return null; } };
    const OFFLINE = 'untap との接続が切れています（しばらく放っておくと切れます）。untap のページを再読み込み（F5）して、デッキの画面が出てからもう一度押してください。';
    const wsVariants = no => {
      const m = no.toLowerCase().match(/^([a-z0-9]+)\/([a-z0-9]+)-([a-z]*)(\d+)([a-z]*)$/); if (!m) return [];
      const [, a, b, p, d, x] = m, nums = [...new Set([d, String(Number(d)), String(Number(d)).padStart(3, '0')])];
      const out = new Set(); for (const n of nums) for (const sep of ['/', '-', '']) out.add(`${a}${sep}${b}-${p}${n}${x}`);
      out.delete(no.toLowerCase()); return [...out];
    };
    const wsLookup = async nos => {
      const api = utApi(), found = {}, cand = {};
      if (!api || !nos.length || utConnected() === false) return { ok: !!api && utConnected() !== false, found, cand };
      const want = {}; // 問い合わせる番号 → 元の番号
      for (const no of nos) { want[no.toLowerCase()] = no; for (const v of wsVariants(no)) if (!want[v]) want[v] = no; }
      const keys = Object.keys(want), hits = {};
      try {
        for (let i = 0; i < keys.length; i += 30) {
          const r = await Promise.race([api.send('card-search', { ccg: 'wstcg', sets: keys.slice(i, i + 30) }), w(6000).then(() => { throw new Error('timeout'); })]);
          for (const c of (r && r.results) || []) for (const st of c.sets || []) {
            const k = String(st.set || '').toLowerCase(); if (!(k in want)) continue;
            (hits[k] = hits[k] || []).push({ title: c.title, set: st.set, by: st.added_by_username || '', img: st.front_image || '', usage: Number(st.usage || c.usage || 0) || 0 });
          }
        }
      } catch (e) { log('番号照合 失敗: ' + e.message); return { ok: false, found, cand }; }
      for (const no of nos) {
        const ex = hits[no.toLowerCase()] || [], titles = [...new Set(ex.map(h => h.title))];
        if (titles.length === 1) { found[no] = titles[0]; continue; }
        const cs = [...ex, ...wsVariants(no).flatMap(v => hits[v] || [])];
        // 同じ名前・同じ番号は1つにまとめ、よく使われている順に並べる
        if (cs.length) cand[no] = cs.filter((h, i) => cs.findIndex(x => x.title === h.title && x.set === h.set) === i).sort((a, b) => b.usage - a.usage).slice(0, 4);
      }
      return { ok: true, found, cand };
    };
    let last = null; // 最後に取り込んだデッキ（再取り込み用）
    let reports = {}; // 候補から選んだ英語名（番号 → {no, jp, qty, title, set}）。同じデッキを取り込み直しても残す
    let foundAll = {}; // 番号照合で見つかった英語名（番号 → {no, jp, qty, title}）。ws-names.json に足してもらうために共有する
    const doImport = async (text, meta, out) => {
      if (utConnected() === false) throw new Error(OFFLINE);
      if (!onDeck) throw new Error('untap のデッキ編集画面（Decks → デッキを開いた画面）で実行してください');
      const g2 = guessGame(text);
      if (game && g2 && game !== g2) throw new Error(`このデッキは${UT_NAMES[game]}ですが、取り込もうとしたのは${UT_NAMES[g2]}のデッキのようです。同じゲームのデッキ画面で実行してください`);
      out.innerHTML = '取り込み中…';
      const g = game || g2;
      let risky = [], look = null;
      if (!last || last.meta.title !== meta.title) { reports = {}; foundAll = {}; }
      if (g === 'ws') {
        const names = await wsNamesGet(); text = wsApply(text, names);
        const miss = [...new Set([...text.matchAll(/^\d+ .+? \(([a-z0-9]+\/[a-z0-9]+-[a-z0-9]+)\)$/gim)].map(m => m[1].toUpperCase()).filter(no => !names[no]))];
        if (miss.length) {
          out.innerHTML = `untap で ${miss.length} 種類を番号から探しています…`;
          look = await wsLookup(miss);
          for (const no in look.found) { const m = text.match(new RegExp('^(\\d+) (.+?) \\(' + no.toLowerCase().replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '\\)$', 'im')); foundAll[no] = { no, jp: m ? m[2] : '', qty: m ? Number(m[1]) : 0, title: look.found[no] }; }
          if (Object.keys(look.found).length) { const d = wsDict(); for (const no in look.found) { names[no] = look.found[no]; d[no] = look.found[no]; } wsSave(d); text = wsApply(text, names); }
          log('番号照合: 探した' + miss.length + ' 見つかった' + Object.keys(look.found).length + ' 候補' + Object.keys(look.cand).length + (look.ok ? '' : '（検索できず）'));
        }
        risky = wsRisky(text, names);
      }
      const res = await autoImport(text), failed = res.failed;
      const chk = res.all ? [] : risky.filter(l => !failed.includes(l));
      const noOf = l => ((l.match(/\(([^)]+)\)\s*$/) || [])[1] || '').toUpperCase();
      const ctx = { code, work: location.href };
      if (look) {
        const nFound = Object.keys(look.found).length, nCand = failed.filter(l => look.cand[noOf(l)]).length;
        ctx.check = look.ok ? `済み（untap で番号照合。見つかった ${nFound} ／ 候補あり ${nCand} ／ 無し ${failed.length - nCand}）` : 'できませんでした（untap の検索が使えませんでした）';
        ctx.cand = no => (look.cand[no] || []).map(h => `${h.title}（登録番号 ${h.set}）`).join(' / ');
      }
      ctx.reports = () => Object.values(reports);
      ctx.found = () => Object.values(foundAll).filter(f => !reports[f.no]);
      last = { text, meta };
      if (panel.querySelector('[data-setname]').checked) setName(meta.title);
      record(text, meta);
      log('untap取り込み: ' + meta.title + ' 失敗' + failed.length);
      out.innerHTML = (res.all
        ? `<div style="color:#ffb454">1枚も取り込めませんでした（untap に一致するカードがありません）。下のカードを登録してもらうと取り込めるようになります。</div>`
        : (failed.length || (res.got != null && res.got < res.want)
          ? `<div style="color:#ffb454">取り込みましたが、<b>入らなかったカードがあります</b>（下の一覧）。このまま「Save」してもかまいませんが、そのカードはデッキに入っていません。</div>`
          : `<div style="color:#9be29b">取り込みました${panel.querySelector('[data-setname]').checked && meta.title ? '（デッキ名も入れました）' : ''}。確認して、untap 右上の「Save」を押してください。</div>`) + countCheck(text, g)) +
        (!res.all && res.got != null && res.got < res.want - failed.reduce((t, l) => t + (Number((l.match(/^\d+/) || [0])[0]) || 0), 0) ? `<div data-short style="color:#ff9b9b;margin-top:4px">⚠ untap のデッキは ${res.got} 枚です（貼ったのは ${res.want} 枚）。下の一覧のほかにも入っていないカードがあります。untap 左側の「Cards failed import」を見てください。</div>` : '') +
        (look && Object.keys(look.found).length ? `<div data-found style="color:#9be29b;margin-top:4px">untap で番号から ${Object.keys(look.found).length} 種類見つけて、untap の英語名で取り込みました。</div>` : '') +
        (look && !look.ok ? `<div style="opacity:.8;margin-top:4px">（untap の検索が使えなかったので、番号からの照合はしていません）</div>` : '') +
        (g === "ws" && Object.keys(reports).length ? `<div style="color:#9be29b;margin-top:4px">候補から選んだ ${Object.keys(reports).length} 種類は、選んだ英語名で取り込みました。</div>` : '') +
        (failed.length ? `<div style="color:#ffb454;margin-top:6px">取り込めなかったカード ${failed.length} 行。<b>チェックの入ったカード</b>を依頼に入れます（名前を押すと調べるページが開きます）:</div>` +
          failed.map((l, i) => {
            const L = LOOK[g], no = noOf(l), cs = (look && look.cand[no]) || [];
            const maxU = Math.max(0, ...cs.map(h => h.usage));
            return `<div data-fl="${i}" style="margin-top:4px;padding:4px 6px;border-left:3px solid #ffb454;background:#1a1a1a;border-radius:4px">` +
              `<label style="display:flex;gap:6px;align-items:flex-start;cursor:pointer"><input type="checkbox" data-inc="${i}" checked style="margin-top:3px">` +
              `<span>${L ? `<a target="_blank" rel="noopener" href="${esc(L(untapLookQ(g, l)))}" style="color:#ffb454;text-decoration:underline">${esc(l)}</a>` : esc(l)}</span></label>` +
              (cs.length ? `<div style="color:#ffd27a;font-size:11px;margin:4px 0 2px 20px">untap に候補があります。同じカードなら「これを使う」を選ぶと、依頼しなくても取り込めます。</div>` +
                `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-left:20px;font-size:11px">` +
                (g === 'ws' && wsImg(no) ? `<div style="width:78px;text-align:center;opacity:.9"><img data-zoom src="${esc(wsImg(no))}" alt="" title="押すと大きく表示" style="width:74px;border-radius:3px;border:1px solid #666;cursor:zoom-in"><div>公式（日本語版）</div></div>` : '') +
                cs.map((h, j) => `<div data-cand="${i}:${j}" title="押して選ぶ" style="width:118px;padding:3px;border:2px solid #444;border-radius:6px;cursor:pointer">` +
                  (h.img ? `<img data-zoom src="${esc(h.img)}" alt="" title="押すと大きく表示" style="width:74px;display:block;margin:0 auto 2px;border-radius:3px;cursor:zoom-in">` : '') +
                  `<div style="color:#eee;word-break:break-word">${esc(h.title)}</div><div style="opacity:.7">登録番号 ${esc(h.set)}${h.by ? ' · ' + esc(h.by) : ''}</div>` +
                  (cs.length > 1 && h.usage > 0 && h.usage === maxU ? `<div style="color:#9be29b">よく使われている</div>` : '') +
                  `<label style="display:block;margin-top:2px;cursor:pointer"><input type="radio" name="c2u-pick-${i}" data-pick="${i}" data-j="${j}" style="appearance:auto;-webkit-appearance:radio;opacity:1;position:static;width:auto;height:auto;margin:0 3px 0 0"><span data-plab>これを使う</span></label>` +
                  `<button data-cp="${esc(h.title)}" style="all:unset;cursor:pointer;color:#8ab4ff;text-decoration:underline">名前をコピー</button></div>`).join('') +
                `<label data-cand="${i}:" style="align-self:center;cursor:pointer;padding:4px 6px;border:2px solid #666;border-radius:6px"><input type="radio" name="c2u-pick-${i}" data-pick="${i}" data-j="" checked style="appearance:auto;-webkit-appearance:radio;opacity:1;position:static;width:auto;height:auto;margin:0 3px 0 0">どれでもない</label></div>` +
                `<div data-picked="${i}" style="margin:3px 0 0 20px;font-size:12px;color:#ffb454">未選択：このカードは依頼に入ります</div>` : '') +
              `</div>`;
          }).join('') +
          `<div class="c2u-cp-out" style="font-size:11px;opacity:.85;margin-top:2px"></div>` : '') +
        (chk.length ? `<div data-chk style="color:#ffd27a;margin-top:6px;padding:6px;border:1px solid #806020;border-radius:6px;background:#2a2410">⚠ 次のカードは、<b>名前が同じ別のカード</b>（英語版の別のカード）が入ったかもしれません。untap のデッキで絵柄を確認して、違ったら「照合・登録を頼む」を押してください。<br>` +
          chk.map(l => { const L = LOOK[g]; return L ? `<a target="_blank" rel="noopener" href="${esc(L(untapLookQ(g, l)))}" style="color:#ffd27a;text-decoration:underline">${esc(l)}</a>` : esc(l); }).join('<br>') + `</div>` : '') +
        (failed.length || chk.length || Object.keys(reports).length || Object.keys(foundAll).length ? `<div data-actions style="position:sticky;bottom:-12px;z-index:2;margin-top:6px;padding:6px;border:1px dashed #ffb454;border-radius:6px;background:#1b1d22;box-shadow:0 -6px 12px rgba(0,0,0,.45)">` +
          `<div data-pickbar style="display:none;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #333"><button data-repick style="all:unset;cursor:pointer;background:#2f6fed;color:#fff;border-radius:6px;padding:3px 10px">選んだカードで取り込み直す</button> <span style="font-size:11px;opacity:.8">選んだ英語名はこのブラウザに保存し、依頼を送ると登録担当にも報告されます</span></div>` +
          `<span data-reqlead>${failed.length ? '未登録のカードは、untap にあるか調べて、無ければ登録してもらえます。' : chk.length ? '確認したいカードは、untap にあるか調べてもらえます。' : (Object.keys(reports).length ? '候補から選んだ英語名を、登録担当に報告できます（次から誰でも英語名で入るようになります）。' : `untap で番号から見つけた英語名 ${Object.keys(foundAll).length} 件を共有できます（任意）。共有すると、次から誰でもデッキのページで「データにあり」になります。`)}</span>` +
          `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:4px"><input data-reqname placeholder="あなたの名前（任意）" value="${esc(reqName())}" style="all:unset;box-sizing:border-box;width:140px;padding:2px 4px;background:#111;border:1px solid #444;border-radius:4px;color:#eee">` +
          `<button data-reqsend style="all:unset;cursor:pointer;background:#b8741a;color:#fff;border-radius:6px;padding:3px 10px">照合・登録を頼む</button>` +
          `<button data-req style="all:unset;cursor:pointer;border:1px solid #ffb454;color:#ffb454;border-radius:6px;padding:3px 10px">依頼内容をコピー</button></div>` +
          `<div class="c2u-req-out" style="margin-top:4px;opacity:.9"></div></div>` : '');
      // チェック・候補の選択
      const picks = {}; // 行番号 → 候補
      const inc = i => { const c = out.querySelector(`[data-inc="${i}"]`); return !c || c.checked; };
      const sel = () => failed.filter((l, i) => inc(i) && !picks[i]);
      const upd = () => {
        const nReq = sel().length + chk.length, nPick = Object.keys(picks).length, nRep = Object.keys(reports).length, nFound = ctx.found().length;
        const bar = out.querySelector('[data-pickbar]'); if (bar) bar.style.display = nPick ? '' : 'none';
        const rs = out.querySelector('[data-reqsend]'), rb = out.querySelector('[data-req]');
        const rp2 = out.querySelector('[data-repick]'); if (rp2) rp2.textContent = `選んだカードで取り込み直す（${nPick} 件）`;
        if (rs) { rs.textContent = nReq ? `照合・登録を頼む（${nReq} 件）` : nRep || nPick ? '英語名を報告する' : `見つけた英語名を共有する（${nFound} 件）`; const off = !nReq && !nRep && !nPick && !nFound; rs.style.opacity = rb.style.opacity = off ? '.4' : ''; rs.dataset.off = rb.dataset.off = off ? '1' : ''; }
      };
      out.querySelectorAll('[data-pick]').forEach(r => r.onchange = () => {
        const i = Number(r.dataset.pick), l = failed[i], no = noOf(l), cs = (look && look.cand[no]) || [], j = r.dataset.j;
        const c = out.querySelector(`[data-inc="${i}"]`);
        if (j === '') { delete picks[i]; if (c) c.checked = true; }
        else { picks[i] = cs[Number(j)]; if (c) c.checked = false; }
        showPick(i);
        upd();
      });
      // 選んだ候補を目立たせる（untap の画面ではラジオボタンの丸が見えないことがあるため、枠の色と文字で示す）
      function showPick(i) {
        const p = picks[i];
        out.querySelectorAll(`[data-cand^="${i}:"]`).forEach(b => {
          const j = b.dataset.cand.split(':')[1], on = p ? j !== '' && (look.cand[noOf(failed[i])] || [])[Number(j)] === p : j === '';
          b.style.borderColor = on ? '#4c8dff' : (j === '' ? '#666' : '#444'); b.style.background = on ? '#1d2a44' : '';
          const lab = b.querySelector('[data-plab]'); if (lab) lab.textContent = on ? '✓ 選択中' : 'これを使う';
          if (lab) lab.style.color = on ? '#8ab4ff' : '';
        });
        const st = out.querySelector(`[data-picked="${i}"]`);
        if (st) { st.textContent = p ? `✓ 選択中：「${p.title}」を使う（依頼には入れません。一覧の下の「選んだカードで取り込み直す」で反映）` : '未選択：このカードは依頼に入ります'; st.style.color = p ? '#8ab4ff' : '#ffb454'; }
      }
      // 候補の枠のどこを押しても選べる（名前をコピー・画像の拡大は除く）
      out.querySelectorAll('[data-cand]').forEach(b => b.addEventListener('click', ev => {
        if (ev.target.closest('[data-cp], img[data-zoom], input')) return;
        const r = b.querySelector('input[type=radio]'); if (r && !r.checked) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
      }));
      out.querySelectorAll('[data-picked]').forEach(e => showPick(Number(e.dataset.picked)));
      out.querySelectorAll('[data-inc]').forEach(c => c.onchange = upd);
      out.querySelectorAll('[data-cp]').forEach(b => b.onclick = async () => { await copyText(b.dataset.cp); out.querySelector('.c2u-cp-out').textContent = `「${b.dataset.cp}」をコピーしました。untap 左上の「Search cards」に貼ると、大きな画像で確かめられます。`; });
      const addPicks = () => {
        const d = wsDict();
        for (const i in picks) {
          const l = failed[i], no = noOf(l), m = l.match(/^(\d+) (.+?) \(/) || [];
          reports[no] = { no, jp: m[2] || l, qty: Number(m[1]) || 0, title: picks[i].title, set: picks[i].set };
          d[no] = picks[i].title; if (wsNames) wsNames[no] = picks[i].title;
        }
        wsSave(d);
      };
      const rp = out.querySelector('[data-repick]');
      if (rp) rp.onclick = async () => {
        addPicks(); log('候補から選択 ' + Object.keys(picks).length + '件 → 取り込み直し');
        try { await doImport(text, meta, out); } catch (e) { out.innerHTML = errHtml(e); }
      };
      const reqNow = () => { addPicks(); return sel(); };
      const rb = out.querySelector('[data-req]'), rs = out.querySelector('[data-reqsend]'), rn = out.querySelector('[data-reqname]');
      if (rn) rn.oninput = () => { try { localStorage.setItem(REQ_NAME_KEY, rn.value.trim()); } catch (e) {} };
      if (rb) rb.onclick = async () => { if (rb.dataset.off) return; await copyText(reqText(reqNow(), meta, g, false, chk, ctx)); out.querySelector('.c2u-req-out').textContent = 'コピーしました。LINE などで登録してくれる人に送るか、登録担当のチャットに貼ってください'; };
      if (rs) rs.onclick = () => { if (rs.dataset.off) return; sendReq(reqNow(), meta, g, out.querySelector('.c2u-req-out'), chk, ctx).catch(e => { out.querySelector('.c2u-req-out').innerHTML = errHtml(e); }); };
      upd();
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
          (cards.length ? `<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap"><button data-regre style="all:unset;cursor:pointer;background:#2f6fed;color:#fff;border-radius:6px;padding:3px 10px">登録後にもう一度取り込む</button>` + `</div>` : ''); // ws-names.json はルーティンが自動でコミットするので、手で書き出すボタンは置かない（v30〜）
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
    body.innerHTML = `<div style="opacity:.75;margin-bottom:8px">${decks.some(d => d.ws) ? '「コピー」→ untap で取り込む（英語名データに無いカードは番号で探します）→ 入らなかったカードだけ依頼。中身を確かめたいときは「開く」' : '「コピー」→ untap の Paste Deck に貼り付け'}</div>`;
    for (const d of decks) {
      const box = document.createElement('div');
      box.style.cssText = 'border:1px solid #3a3d44;border-radius:8px;padding:8px;margin-bottom:8px';
      box.innerHTML =
        `<div style="display:flex;justify-content:space-between;gap:8px;align-items:center">` +
        `<div${d.el ? ' data-jump title="ページのこのデッキの場所へ移動" style="cursor:pointer"' : ''}><b${d.el ? ' style="text-decoration:underline dotted"' : ''}>${esc(d.title)}</b><div style="opacity:.7;font-size:12px">${esc(d.sub)}${d.el ? ' <span style="opacity:.8">↓ 場所へ</span>' : ''}</div></div>` +
        `<span style="display:flex;gap:6px">` + (d.ws ? `<button data-qcopy style="all:unset;cursor:pointer;background:#2f6fed;color:#fff;border-radius:6px;padding:4px 12px;white-space:nowrap">コピー</button>` : '') +
        `<button data-main style="all:unset;cursor:pointer;${d.ws ? 'border:1px solid #2f6fed;color:#8ab4ff' : 'background:#2f6fed;color:#fff'};border-radius:6px;padding:4px 12px;white-space:nowrap">${d.ws ? '開く' : 'コピー'}</button></span></div>` +
        `<div class="c2u-info"></div>`;
      const btn = box.querySelector('[data-main]'), info = box.querySelector('.c2u-info'), qb = box.querySelector('[data-qcopy]');
      const jb = box.querySelector('[data-jump]');
      if (jb) jb.onclick = () => {
        const e = d.el();
        if (!e) { jb.querySelector('div').insertAdjacentHTML('beforeend', ' <span style="color:#ffb454">（場所が見つかりませんでした）</span>'); return; }
        e.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const o = e.style.outline; e.style.outline = '3px solid #ffb454'; setTimeout(() => { e.style.outline = o; }, 1800);
      };
      if (d.ws) {
        btn.onclick = async () => {
          if (btn.dataset.open) { info.innerHTML = ''; delete btn.dataset.open; btn.textContent = '開く'; return; }
          btn.textContent = '読み込み中…';
          try { const rows = await d.load(); const remote = await wsRemote(); log('開く: ' + d.title + ' ' + rows.length + '種・GitHub辞書' + Object.keys(remote).length + '件'); wsEditor(info, rows, d.title, remote); btn.dataset.open = '1'; btn.textContent = '閉じる'; }
          catch (e) { btn.textContent = '開く'; info.innerHTML = errHtml(e); }
        };
        // 開かずにそのままコピー（中身を確かめたいときは「開く」）
        qb.onclick = async () => {
          qb.textContent = '準備中…';
          try {
            const rows = await d.load(), remote = await wsRemote();
            const text = '//deck-1\n' + rows.map(([no, jp, q]) => `${q} ${remote[no] || jp} (${no.toLowerCase()})`).join('\n');
            await copyText(withMeta(text, d.title, ''));
            const nNew = rows.filter(([no]) => !remote[no]).length;
            log('コピー（ヴァイス・開かずに）: ' + d.title + ' ' + rows.length + '種 データに無し' + nNew);
            qb.textContent = 'コピーしました';
            if (btn.dataset.open) { delete btn.dataset.open; btn.textContent = '開く'; }
            info.innerHTML = `<div style="font-size:12px;margin-top:4px"><span style="color:#9be29b">コピーしました。</span>` + (nNew ? `英語名データに無い ${nNew} 種類は、untap に取り込むときに番号で探します。` : '全部英語名データにあります。') + `</div>` + countCheck(text, 'ws') + nextHtml();
          } catch (e) { qb.textContent = 'コピー'; info.innerHTML = errHtml(e); }
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
            `<pre style="white-space:pre-wrap;font-size:11px;margin:4px 0 0">${esc(b.text)}</pre></details>` + nextHtml() + extrasHtml();
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
