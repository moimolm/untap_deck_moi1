// d2u.js を組み立てる：node tools/build.mjs
//   src/deck2untap.js … 本体（読みやすい元のソース）
//   data/pokemon-jp-en.json … ポケモンの日本語名→英語名の辞書（圧縮して埋め込む）
//   → d2u.js（圧縮済み。GitHub Pages で配る本体。ブックマークはこれを読み込む）
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { minify } from 'terser';
const require = createRequire(import.meta.url);
const LZ = require('lz-string');
const root = new URL('..', import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), 'utf8');

let src = read('src/deck2untap.js');
const dict = JSON.parse(read('data/pokemon-jp-en.json'));
const z = LZ.compressToEncodedURIComponent(JSON.stringify(dict));
if (!src.includes("'__PKDICT__'")) throw new Error('src に __PKDICT__ がありません');
src = src.replace("'__PKDICT__'", () => `'${z}'`);
// lz-string（展開用）を本体の先頭に埋め込む
const lzMin = fs.readFileSync(require.resolve('lz-string/libs/lz-string.min.js'), 'utf8');
const lzCore = lzMin.slice(0, lzMin.indexOf('return i}();') + 'return i}();'.length);
const head = '(async () => {';
const k = src.indexOf(head);
if (k < 0) throw new Error('src の先頭に (async () => { がありません');
src = src.slice(0, k + head.length) + '\n' + lzCore + '\n' + src.slice(k + head.length);

const out = await minify(src, { compress: true, mangle: true });
fs.writeFileSync(new URL('d2u.js', root), out.code);
const ver = (read('src/deck2untap.js').match(/C2U_VER = '([^']+)'/) || [])[1];
console.log(`d2u.js を作りました（${ver}・${Buffer.byteLength(out.code)} バイト・ポケモン辞書 ${Object.keys(dict).length} 件）`);
