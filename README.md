# untapへ転送

日本のカードゲームのデッキページ（tier表・大会結果・公式レシピなど）から、[untap.in](https://untap.in/) に貼れる英語名のデッキリストを作るブックマークレット。untap のデッキ画面では自動取り込みと履歴も使える。

- インストールページ（ブックマークの登録・使い方）：claude.ai のアーティファクト「untapデッキ転送」
- 配布している本体：`https://moimolm.github.io/untap_deck_moi1/d2u.js`（GitHub Pages）

## ファイル

| パス | 中身 |
|---|---|
| `d2u.js` | 配布用の本体（圧縮済み）。**ブックマークはこれを読み込む**。`tools/build.mjs` で作る |
| `ws-names.json` | （任意）ヴァイスの英語名データ。パネルの「書き出す」で作ったファイルを置くと自動で読み込まれる |
| `src/deck2untap.js` | 本体の元のソース（読みやすい版）。修正はここに入れる |
| `src/loader.js` | ブックマークに登録する短いコード（`d2u.js` を読み込むだけ） |
| `data/pokemon-jp-en.json` | ポケモンの日本語名→英語名の辞書（1747件、2026/9 時点）。組み立て時に圧縮して埋め込む |
| `tools/build.mjs` | 組み立てスクリプト |
| `tools/install-page.html` | インストールページの控え（予備ブックマーク用に全部入りの版も埋め込み済み） |
| `check/check.mjs` ・ `.github/workflows/check.yml` | 対応サイトの自動点検（毎週月曜 9:00・GitHub Actions） |

## 更新のしかた

いちばん簡単なのは、作り直した `d2u.js` をもらって上書きアップロードするだけ（数分で全員のブックマークに反映。パネル右上の版番号で確認できる）。アップロードするときは、ダウンロードフォルダに古い `d2u.js` が残っていないか注意（新しい方が `d2u (1).js` になることがある。v14 は約80KB）。

自分で組み立てるとき：

```
npm install
npm run build        # → d2u.js ができる
```

`src/deck2untap.js` の `C2U_VER` を上げてから組み立てると、どの版が動いているか分かりやすい。

## 対応サイトと英語名の出どころ

| ゲーム | サイト | 英語名 |
|---|---|---|
| ONE PIECE | cardrush.media、tcg-portal.jp | punk-records（GitHub）の公式英語名。型番は `[op16-042]` の角括弧で指定 |
| 遊戯王 | tcg-portal.jp、deck-maker.com | yaml-yugi（約100MB、7日キャッシュ）＋一部の別名対応 |
| ポケモン | cardrush.media、tcg-portal.jp、pokemon-card.com（デッキ表示） | `data/pokemon-jp-en.json`（Limitless の日本版一覧＋英語版トレーナーズ名） |
| デュエマ | tcg-portal.jp、deck-maker.com | Duel Masters Wiki を検索し、ページの日本語名と照合 |
| ヴァンガード | cf-vanguard.com（入賞者レシピ）、decklog.bushiroad.com | Cardfight!! Vanguard Wiki をカード番号で照合 |
| ヴァイス | ws-tcg.com（デッキレシピ）、decklog.bushiroad.com | 自動変換なし。パネルで HoC を見て英語名を入力（ブラウザに保存・書き出し可） |

## untap の貼り付け形式（調べて分かったこと）

- 1行 `枚数 名前`。`(版)` は untap の版と完全一致すればその版、しなければ同名の別版に黙って置き換わる。`[番号]` は内部の名前＋番号で照合（ワンピースで使用）
- 置き場の見出し：`//deck-1` メイン、`//play-1` 場（ワンピースのリーダー、デュエマの禁断など）
  - 遊戯王：`//deck-2` EX、`//sideboard-1` サイド（`//extra-1` は隠しゾーンになるので使わない）
  - ワンピース：`//deck-2` ドン!!（既定 `10 Don!! Card (don-000)`）
  - デュエマ：`//deck-2` 超GR、`//pile-public` 超次元
  - ヴァンガード：`//pile-facedown` ライドデッキ
- 名前の丸括弧は版と見なされるので、ワンピースの `Mr.3(Galdino)` は `Mr.3[Galdino]` と書く
- 末尾の `//c2u デッキ名 | 成績 | 元のURL` の行は untap に無視される（自動取り込み・履歴用のメモ）

## 知っている制限

- 新しい弾のカードは、英語名のデータや untap の登録が追いつくまで取り込めない（パネルにオレンジで出て、調べるページへのリンクが付く）
- ヴァイスの日本版の新しい弾は untap に未登録のことが多い（カスタム登録が必要。登録は全ユーザーに公開される）
- cardrush は海外からのアクセスを拒否するため、自動点検の対象外（🚫 BLOCK と表示）
- ブラウザに保存する設定（ヴァイスの英語名、ドン!!の選択）はサイトごと・ブラウザごと。untap の履歴は untap 側に保存
