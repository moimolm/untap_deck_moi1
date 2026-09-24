// テストケース：各サイトの画面の「見本」と、英語名データの「見本」
//   url   … 見本ページを開く URL（本物のサイトには繋がない）
//   html  … そのページの中身（本物の構造を小さくまねたもの）
//   api   … 英語名データなど外部への問い合わせの見本 { URLの一部: (url) => 返すJSON }
//   steps … ブックマークを押した後の操作（省略時は1つ目の「コピー」を押す）
// 結果は test/snap/<name>.txt と比べる（npm run test:update で作り直し）

const tbl = rows => `<table><tr><th>枚数</th><th>カード名</th><th>購入</th></tr>${rows.map(([q, n]) => `<tr><td>${q}</td><td><a href="#">${n}</a></td><td>出品リクエスト</td></tr>`).join('')}</table>`;
const nextData = obj => `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(obj)}</script>`;

// ---------- 英語名データの見本 ----------
const OP_API = {
  'api.github.com/repos/buhbbl/punk-records': () => [{ name: 'op16.json', download_url: 'https://raw.test/op16.json' }, { name: 'st30.json', download_url: 'https://raw.test/st30.json' }],
  'raw.test/op16.json': () => [
    { id: 'OP16-022', name: 'Monkey.D.Luffy' }, { id: 'OP16-042', name: 'Prisoner of Impel Down' },
    { id: 'OP16-056', name: 'Mr.3(Galdino)' }, { id: 'OP16-045', name: 'Crocodile' },
  ],
  'raw.test/st30.json': () => [{ id: 'ST30-014', name: 'Mr.3(Galdino)' }],
};
const YG_API = {
  'yaml-yugi/cards.json': () => [
    { name: { ja: '<ruby>灰流<rt>はる</rt></ruby>うらら', en: 'Ash Blossom & Joyous Spring' } },
    { name: { ja: '増殖するＧ', en: 'Maxx "C"' } },
    { name: { ja: '無限泡影', en: 'Infinite Impermanence' } },
    { name: { ja: 'アクセスコード・トーカー', en: 'Accesscode Talker' } },
    { name: { ja: '有限と無限のアルス・マグナ', en: 'Ars Magna the Finite and the Infinite' } },
  ],
};
const DM_WIKI = {
  'Deadly Fighter Braid Claw': ["{{Ruby|凶|きょう}}{{Ruby|戦|せん}}{{Ruby|士|し}}ブレイズ・クロー ''(Berserker Blaze Claw)''"],
  'Great Sonic': ['グレイト“{{Ruby|S-駆|ソニック}}”'],
  'Perfect, Domination Elemental / Galaxy Charger': ['{{Ruby|支|し}}{{Ruby|配|はい}}の{{Ruby|精|せい}}{{Ruby|霊|れい}}ペルフェクト', 'ギャラクシー・チャージャー'],
  'Bolshack Dragon': ['ボルシャック・ドラゴン'],
};
const dmPlain = s => s.replace(/\{\{Ruby\|([^|}]*)\|[^}]*\}\}/g, '$1');
const DM_API = {
  'duelmasters.fandom.com': u => {
    const q = u.searchParams;
    if (q.get('list') === 'search') {
      const s = q.get('srsearch');
      return { query: { search: Object.keys(DM_WIKI).filter(t => { const j = dmPlain(DM_WIKI[t][0]); return j.includes(s.slice(0, 3)) || s.includes(j.slice(0, 3)); }).map(title => ({ title })) } };
    }
    return { query: { pages: q.get('titles').split('|').map(t => ({ title: t, revisions: [{ slots: { main: { content: `{{Cardtable\n| jpname = ${DM_WIKI[t][0]}\n` + (DM_WIKI[t][1] ? `| jpname2 = ${DM_WIKI[t][1]}\n` : '') } } }] })) } };
  },
};
const VG_API = {
  'cardfight.fandom.com': u => {
    if (u.searchParams.get('list') === 'search') return { query: { search: [{ title: 'DZ Test Set' }, { title: 'Chivalmya' }] } };
    return { query: { pages: [
      { title: 'DZ Test Set', revisions: [{ slots: { main: { content: '{{CardList|DZ-BT01/010|Fated One of Miracles, Rezael|3}}\n{{CardList|DZ-SS14/002|Blaster Blade (Fighter Icon)|2}}' } } }] },
      { title: 'Chivalmya', revisions: [{ slots: { main: { content: '{{DTable\n|kana = しゔぁるみゃー\n|set1 = DZ-SD04/014 (TD)\n' } } }] },
    ] } };
  },
};

// untap（ヴァイス）の見本：取り込み＋ Add Missing Card の画面（実物の表示文字・項目名をまねたもの）
const UNTAP_WS = `<div class="block desktop-fill"><div class="input-style container"><div>WSTCG</div><div>Weiß Schwarz</div>
<input class="deck-title-input" placeholder="Name ME!" value="test"><button>Save</button>
<button>Import / Export</button><div id="ie"></div><div id="failed"></div><a href="javascript:void(0)" id="amc">Add Missing Card</a></div></div>
<div id="dlg"></div>
<script>
const DB = [{ name: 'Kotone Fujita, Started Being Cute', sets: ['gim/w124-t02'] }];
document.querySelectorAll('button').forEach(b => { if (b.textContent === 'Import / Export') b.onclick = () => { document.getElementById('ie').innerHTML = '<button id="pd">Paste Deck</button>'; document.getElementById('pd').onclick = openDlg; }; });
function openDlg() { const d = document.createElement('div'); d.innerHTML = '<textarea placeholder="Paste your cards here"></textarea><label><input type="checkbox"> Clear existing cards in deck.</label><button id="ic">Import Cards</button>'; document.body.appendChild(d);
  document.getElementById('ic').onclick = () => { const v = d.querySelector('textarea').value; window.__imported = v; d.remove();
    const bad = v.split('\\n').filter(l => /^\\d+ /.test(l)).filter(l => !DB.some(c => l.includes(c.name)));
    document.getElementById('failed').innerHTML = bad.length ? '<div>Cards Failed Import<br><span>Clear Failed</span>' + bad.map(l => '<div>' + l + '</div>').join('') + '</div>' : ''; }; }
const dlg = document.getElementById('dlg'); let mode = '';
const H = s => '<div><div>Add Missing Card</div>' + s + '</div>';
document.getElementById('amc').onclick = () => { dlg.innerHTML = '<div>Please read <button id="und">I understand</button></div>'; document.getElementById('und').onclick = step1; };
function step1() {
  dlg.innerHTML = H('<div>Card Name</div><input placeholder="Name exactly as printed on the card"><div id="res"></div>');
  dlg.querySelector('input').addEventListener('input', e => { const v = e.target.value.toLowerCase(), hits = DB.filter(c => c.name.toLowerCase().includes(v));
    const res = document.getElementById('res');
    res.innerHTML = (hits.length ? '<div>These Are Already In The Database</div>' + hits.map((c, i) => '<div><div>' + c.name + '</div><div>' + c.sets.join(', ') + '</div><button data-rp>Add reprint</button><button>Add fan art</button></div>').join('') + '<div>Not One Of Those</div>' : '<div>Nothing Matched That Name</div>') +
      '<button type="submit" id="nw">It\\'s a new card, not in the database</button><button type="submit">It\\'s a custom, non-legal card</button>';
    res.querySelectorAll('[data-rp]').forEach(b => b.onclick = () => { mode = 'reprint'; step2(); });
    document.getElementById('nw').onclick = () => { mode = 'new'; step2(); }; }); }
function step2() {
  dlg.innerHTML = H('<div>Card Image</div><button>Upload an image</button><input id="img1" placeholder="...or paste an image URL"><div>Alternate Face Image</div><input placeholder="...or paste an image URL"><button id="cont" disabled>Continue</button>');
  const i1 = document.getElementById('img1'); i1.addEventListener('input', () => { window.__img = i1.value; setTimeout(() => { document.getElementById('cont').disabled = !/^https:/.test(i1.value); }, 300); });
  document.getElementById('cont').onclick = step3; }
function field(label, inner) { return '<div><div><div>' + label + '</div></div>' + inner + '</div>'; }
function step3() {
  dlg.innerHTML = H((mode === 'new' ? field('Title On Card', '<input id="f-title" value="ocr junk">') : '') +
    field('Set / Release Identifier', '<input id="f-id">') +
    field('Print Type', '<select id="f-pt"><option value="official">Official print</option><option value="token">Token</option><option value="testing">Testing print</option></select>') +
    field('Card Image Orientation', '<select id="f-or"><option value="landscape-left">Left Side Down</option><option value="portrait">Portrait</option><option value="landscape-right">Right Side Down</option></select>') +
    (mode === 'new' ? field('Front', '<textarea id="f-front">€3 GMW124-032 CR ocr</textarea>') : '') +
    '<button id="addc">Add Card</button>');
  document.getElementById('f-pt').value = 'testing'; document.getElementById('f-or').value = 'landscape-left';
  document.getElementById('addc').onclick = () => { window.__added = true; }; }
window.__form = () => { const g = id => { const e = document.getElementById(id); return e ? e.value : null; }; return { mode, image: window.__img, title: g('f-title'), id: g('f-id'), printType: g('f-pt'), orientation: g('f-or'), front: g('f-front') }; };
</script>`;

// ---------- ケース ----------
export default [
  {
    name: 'op-tcgportal', url: 'https://tcg-portal.jp/onepiece/tournament-results/x', api: OP_API,
    html: `<h1>緑青ルフィ</h1><main><h3>リーダーカード</h3>${tbl([[1, 'モンキー・D・ルフィOP16-022']])}<h3>メインデッキ</h3>${tbl([[8, 'インペルダウンの囚人OP16-042'], [8, 'インペルダウンの囚人OP16-042'], [8, 'インペルダウンの囚人OP16-042'], [8, 'インペルダウンの囚人OP16-042'], [4, 'Mr.3(ギャルディーノ)OP16-056'], [4, 'Mr.3(ギャルディーノ)ST30-014'], [4, 'クロコダイルOP16-045'], [8, 'インペルダウンの囚人OP16-042'], [2, '謎のカードOP99-001']])}</main>`,
  },
  {
    name: 'op-cardrush', url: 'https://cardrush.media/onepiece/decks/123', api: OP_API,
    html: nextData({ props: { pageProps: { deck: { id: 123, name: '優勝', tournament_name: 'テスト大会', recipes: [
      { count: 1, card: { card_number: 'OP16-022', name: 'モンキー・D・ルフィ', category: 'リーダー' } },
      { count: 50, card: { card_number: 'OP16-042', name: 'インペルダウンの囚人', category: 'キャラ' } },
    ] } } } }),
  },
  {
    name: 'op-don-custom', url: 'https://tcg-portal.jp/onepiece/tournament-results/x', api: OP_API,
    html: `<h1>ドン変更</h1><main><h3>リーダーカード</h3>${tbl([[1, 'モンキー・D・ルフィOP16-022']])}<h3>メインデッキ</h3>${tbl([[50, 'インペルダウンの囚人OP16-042']])}</main>`,
    steps: async p => {
      await p.click('#c2u-body button'); await p.waitForSelector('.c2u-info input');
      await p.fill('.c2u-info input', 'Don!! Card - Luffy (op01)');
      await p.click('.c2u-info div[style*="dashed"] button'); await p.waitForTimeout(300);
    },
  },
  {
    name: 'yg-tcgportal', url: 'https://tcg-portal.jp/yugioh/tournament-results/x', api: YG_API,
    html: `<h1>テスト遊戯王</h1><main><h3>メインデッキ</h3>${tbl([[3, '灰流うらら'], [3, '増殖するG'], [3, '無限泡影'], [31, '謎の魔法']])}<h3>EXデッキ</h3>${tbl([[1, 'アクセスコード・トーカー'], [1, '有限と無限のアルス・マグナ']])}<h3>サイドデッキ</h3>${tbl([[2, '無限泡影']])}</main>`,
  },
  {
    name: 'yg-deckmaker', url: 'https://deck-maker.com/decks/new/', api: YG_API,
    html: `<div class="DeckArea"></div><script>
      window.$nuxt={$store:{state:{yg:{cards:{a:{mainCardId:1,name:'灰流うらら'},b:{mainCardId:2,name:'増殖するG'},c:{mainCardId:3,name:'アクセスコード・トーカー'}}},dm:{cards:{}}}}};
      document.querySelector('.DeckArea').__vue__={mainCards:[...Array(20)].map(()=>({mainCardId:1})).concat([...Array(20)].map(()=>({mainCardId:2}))),extraCards:[{mainCardId:3}],sideCards:[]};
    </script>`,
  },
  {
    name: 'pk-tcgportal', url: 'https://tcg-portal.jp/pokemon/tournament-results/x',
    html: `<h1>おまつりおんど</h1><main><h3>メインデッキ</h3>${tbl([[4, 'ドロンチ'], [4, 'ボスの指令'], [4, 'ハイパーボール'], [4, 'なかよしポフィン'], [8, '基本草エネルギー'], [1, '謎カード']])}</main>`,
  },
  {
    name: 'pk-official', url: 'https://www.pokemon-card.com/deck/confirm.html/deckID/TEST-DECK',
    html: `<input type="hidden" name="deck_pke" value="40001_4_1"><input type="hidden" name="deck_gds" value="40002_4_1"><input type="hidden" name="deck_ene" value="40003_8_1">
      <script>window.PCGDECK={searchItemName:{40001:'ドロンチ',40002:'ハイパーボール',40003:'基本草エネルギー'},searchItemCardPict:{40001:'/assets/images/card_images/large/SV6/040001_P.jpg',40002:'/assets/images/card_images/large/SV1/040002_T.jpg',40003:'/assets/images/card_images/large/ENE/040003_E.jpg'}}</script>`,
  },
  {
    name: 'pk-cardrush', url: 'https://cardrush.media/pokemon/decks/9',
    html: nextData({ props: { pageProps: { deck: { name: 'サーナイトex', recipes: [{ count: 4, card: { id: 1, name: 'ドロンチ' } }, { count: 4, card: { id: 2, name: 'ボスの指令' } }] } } } }),
  },
  {
    name: 'dm-tcgportal', url: 'https://tcg-portal.jp/duelmasters/tournament-results/x', api: DM_API,
    html: `<h1>火単</h1><main><h3>メインデッキ</h3>${tbl([[4, '凶戦士ブレイズ・クロー'], [4, 'グレイト“Ｓ-駆”'], [4, '悪なき侵略 レッドアウト']])}<h3>超次元ゾーン</h3>${tbl([[1, 'ボルシャック・ドラゴン']])}</main>`,
  },
  {
    name: 'dm-deckmaker', url: 'https://deck-maker.com/dm/decks/new/', api: DM_API,
    html: `<div class="DeckArea"></div><script>
      window.$nuxt={$store:{state:{dm:{cards:{a:{mainCardId:1,name:'支配の精霊ペルフェクト/ギャラクシー・チャージャー'},b:{mainCardId:2,name:'凶戦士ブレイズ・クロー'},c:{mainCardId:3,name:'ボルシャック・ドラゴン'}}},yg:{cards:{}}}}};
      document.querySelector('.DeckArea').__vue__={mainCards:[{mainCardId:1},{mainCardId:1},{mainCardId:2}],grCards:[],hyperSpatialCards:[{mainCardId:3}],dorumagedon:false,zeron:false};
    </script>`,
  },
  {
    name: 'vg-official', url: 'https://cf-vanguard.com/deckrecipe/events/x/', api: VG_API,
    html: `<p>DECK LOGコード：ABC</p><p>先鋒 テスト 選手</p><p>国家：ケテルサンクチュアリ</p><div class="recipe-single-list"><ul>
      <li><div class="ride"></div><a href="/cardlist/?cardno=DZ-SS14/002R" title="ブラスター・ブレード"><img alt="x"></a></li>
      <li><a href="/cardlist/?cardno=DZ-BT01/010" title="奇跡の運命者 レザエル"><img alt="x"><span class="num">3</span></a></li>
      <li><a href="/cardlist/?cardno=DZ-SD04/014" title="しゔぁるみゃー"><span class="num">4</span></a></li>
      <li><a href="/cardlist/?cardno=DZ-XX99/001" title="未知のカード"><span class="num">1</span></a></li></ul></div>`,
  },
  {
    name: 'vg-decklog', url: 'https://decklog.bushiroad.com/view/ABC12', api: VG_API,
    html: `デッキ名「テスト」のデッキ<div class="card-item card-item-is-ride"><img src="https://cf-vanguard.com/a.png" title="DZ-SS14/002 : ブラスター・ブレード"><span class="num">1</span></div><div class="card-item"><img src="https://cf-vanguard.com/b.png" title="DZ-BT01/010 : 奇跡の運命者 レザエル"><span class="num">4</span></div>`,
  },
  {
    name: 'ws-decklog', url: 'https://decklog.bushiroad.com/view/6472W',
    api: { 'moimolm.github.io/untap_deck_moi1/ws-names.json': () => ({ names: { 'GU/WE46-39': 'Magician of the Smiling Cafe' } }) },
    html: `デッキ名「ごちうさタイカプ」のデッキ
      <div class="card-item"><img src="https://ws-tcg.com/x.png" title="GU/WE46-60GUR : マヤ・スロウス"><span class="num">2</span></div>
      <div class="card-item"><img src="https://ws-tcg.com/y.png" title="GU/WE46-39 : にっこりカフェの魔法使い"><span class="num">4</span></div>`,
    steps: async p => {
      await p.click('#c2u-body button'); await p.waitForSelector('#c2u-panel input[data-i]');
      await p.fill('#c2u-panel input[data-i="0"]', '"Bath Time" Rize');
      await p.click('[data-a="copy"]'); await p.waitForTimeout(200);
    },
  },
  {
    name: 'ws-official', url: 'https://ws-tcg.com/deckrecipe/?x=1',
    html: `<div class="deckrecipeBlock">成績\n優勝\nハンドルネーム\nパスタ\nデッキコード\n6472W\nデッキ名\nごちうさ門扉\n<div class="js-recipe-detail-container"></div>
      <a class="js-recipe-load-detail" href="javascript:;" onclick="setTimeout(()=>{this.parentElement.querySelector('.js-recipe-detail-container').innerHTML='<table><tr><th>番号</th><th>カード名</th><th>LV</th><th>枚数</th></tr><tr><td>GU/WE46-62GUR</td><td>チノ・エンヴィ</td><td>3/2</td><td>4枚</td></tr><tr><td>GU/WE46-66</td><td>その一歩は</td><td>-/-</td><td>4枚</td></tr></table>'},100)">詳細を開く</a></div>`,
    steps: async p => {
      await p.click('#c2u-body button'); await p.waitForSelector('#c2u-panel input[data-i]');
      await p.fill('#c2u-panel input[data-i="1"]', 'That One Step');
      await p.click('[data-a="copy"]'); await p.waitForTimeout(200);
    },
  },
  {
    name: 'untap-import', url: 'https://untap.in/deck/abc',
    clipboard: '//play-1\n1 Monkey.D.Luffy [op16-022]\n\n//deck-1\n49 Prisoner of Impel Down [op16-042]\n1 謎カード [op99-001]\n\n//deck-2\n10 Don!! Card (don-000)\n\n//c2u 緑青ルフィ | 優勝 | https://tcg-portal.jp/onepiece/x',
    html: `<div class="block desktop-fill"><div class="input-style container"><div>OPCG</div><div>One Piece Card Game</div>
      <input class="deck-title-input" placeholder="Name ME!" value="test"><button>Save</button>
      <button>Deck Options</button><button>Import / Export</button><div id="ie"></div><div id="failed"></div></div></div>
      <script>
      document.querySelectorAll('button').forEach(b=>{ if(b.textContent==='Import / Export') b.onclick=()=>{ document.getElementById('ie').innerHTML='<button id="pd">Paste Deck</button>'; document.getElementById('pd').onclick=openDlg; }; });
      function openDlg(){ const d=document.createElement('div'); d.innerHTML='<textarea placeholder="Paste your cards here"></textarea><label><input type="checkbox"> Clear existing cards in deck.</label><button id="ic">Import Cards</button>'; document.body.appendChild(d);
        document.getElementById('ic').onclick=()=>{ const v=d.querySelector('textarea').value; window.__imported=v; d.remove();
          const bad=v.split('\\n').filter(l=>/^\\d+ .*謎/.test(l)); document.getElementById('failed').innerHTML=bad.length?'<div>Cards Failed Import<br><span>Clear Failed</span>'+bad.map(l=>'<div>'+l+'</div>').join('')+'</div>':''; }; }
      </script>`,
    steps: async p => {
      await p.waitForSelector('[data-clip]');
      await p.click('[data-clip]');
      await p.waitForFunction(() => { const o = document.querySelector('.c2u-ut-out'); return o && /完了|失敗|できません|取り込み/.test(o.innerText) && !/中…/.test(o.innerText); }, null, { timeout: 15000 });
      await p.waitForTimeout(500);
    },
    result: async p => [
      '=== 取り込まれた内容 ===', await p.evaluate(() => window.__imported),
      '=== デッキ名 ===', await p.inputValue('.deck-title-input'),
      '=== 表示 ===', await p.innerText('.c2u-ut-out'),
    ].join('\n'),
  },
  ...['reprint', 'new'].map(kind => ({
    name: 'untap-ws-register-' + kind, url: 'https://untap.in/deck/ws1',
    api: { 'moimolm.github.io/untap_deck_moi1/ws-names.json': () => ({ names: { 'GIM/W124-T02': 'Kotone Fujita, Started Being Cute' } }) },
    clipboard: '//deck-1\n4 カワイイ♡はじめました 藤田ことね (gim/w124-t02)\n2 かぜったい追いついてやる (gim/w124-032)\n\n//c2u 学マス | 優勝 | https://ws-tcg.com/deckrecipe/1/',
    html: UNTAP_WS,
    steps: async p => {
      await p.waitForSelector('[data-clip]');
      await p.click('[data-clip]');
      await p.waitForSelector('[data-req]', { timeout: 15000 });
      await p.click('[data-req]'); await p.waitForTimeout(200);
      await p.evaluate(() => { window.__req = window.__clip; });
      await p.click('[data-reg] summary');
      await p.fill('[data-regin]', '```json\n[{"no":"GIM/W124-T02","name":"Kotone Fujita, Started Being Cute"},{"no":"GIM/W124-032","name":"I Will Definitely Catch Up","text":"[C] Draw 1."}]\n```');
      await p.click('[data-regload]');
      await p.click(`[data-fill="${kind === 'reprint' ? 0 : 1}"]`);
      await p.waitForFunction(() => /入力しました|ff7b7b/.test(document.querySelector('.c2u-reg').innerHTML), null, { timeout: 20000 });
    },
    result: async p => [
      '=== 取り込まれた内容 ===', await p.evaluate(() => window.__imported),
      '=== 作成依頼 ===', await p.evaluate(() => window.__req),
      '=== フォームの中身 ===', await p.evaluate(() => JSON.stringify(window.__form(), null, 1)),
      '=== Add Card を押したか ===', String(await p.evaluate(() => !!window.__added)),
      '=== アシストの表示 ===', await p.innerText('.c2u-reg'),
    ].join('\n'),
  })),
];

