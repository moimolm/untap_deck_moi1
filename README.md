# untapへ転送

日本のカードゲームのデッキページ（tier表・大会結果・公式レシピなど）から、[untap.in](https://untap.in/) に貼れる英語名のデッキリストを作るブックマークレット。untap のデッキ画面では自動取り込みと履歴も使える。

- インストールページ（ブックマークの登録・使い方）：claude.ai のアーティファクト「untapデッキ転送」
- 配布している本体：`https://moimolm.github.io/untap_deck_moi1/d2u.js`（GitHub Pages）

## ファイル

| パス | 中身 |
|---|---|
| `d2u.js` | 配布用の本体（圧縮済み）。**ブックマークはこれを読み込む**。`tools/build.mjs` で作る |
| `ws-names.json` | ヴァイスの英語名データ（番号 → untap の登録名）。登録担当が更新する。名前は untap.in の登録名、または公式の日本語からの自訳 |
| `src/deck2untap.js` | 本体の元のソース（読みやすい版）。修正はここに入れる |
| `src/loader.js` | ブックマークに登録する短いコード（`d2u.js` を読み込むだけ） |
| `data/pokemon-jp-en.json` | ポケモンの日本語名→英語名の辞書（1747件、2026/9 時点）。組み立て時に圧縮して埋め込む |
| `tools/build.mjs` | 組み立てスクリプト |
| `docs/registration-guide.md` | 未登録カードを soogoo で untap に登録する手順（登録担当チャット向け） |
| `CHANGELOG.md` | 更新履歴（版を上げたら1行足す） |
| `tools/install-page.html` | インストールページの控え（予備ブックマーク用に全部入りの版も埋め込み済み） |
| `test/cases.mjs` ・ `test/run.mjs` ・ `test/snap/` | テスト。各サイトの見本ページで `d2u.js` を動かし、コピー内容を `test/snap/*.txt`（正しい結果）と比べる |
| `.github/workflows/build.yml` | 自動ビルド。`src/` などを GitHub 上で直すと、テスト → `d2u.js` の作り直し → コミットまで自動 |
| `check/check.mjs` ・ `.github/workflows/check.yml` | 対応サイトの自動点検（毎週月曜 9:00・GitHub Actions） |

## 更新のしかた

いちばん簡単なのは、作り直した `d2u.js` をもらって上書きアップロードするだけ（数分で全員のブックマークに反映。パネル右上の版番号で確認できる）。アップロードするときは、ダウンロードフォルダに古い `d2u.js` が残っていないか注意（新しい方が `d2u (1).js` になることがある。v14 は約80KB）。

**GitHub 上で直す（おすすめ）**：`src/deck2untap.js` を GitHub の画面で編集して Commit するだけ。`build.yml` が1〜3分で `d2u.js` を作り直してコミットする（Actions タブで進み具合が見える）。テストに落ちたら ❌ になり、`d2u.js` は差し替わらない（＝友人のブックマークは前の版のまま動く）。

自分の PC で組み立てるとき：

```
npm install
npx playwright install chromium   # 初回のみ（テスト用）
npm run build        # → d2u.js ができる
npm test             # 見本どおりか確認
```

### テスト

- `npm test`：全ケースを実行（約15秒）。`node test/run.mjs vg-` のように名前の頭を付けるとそのケースだけ
- 違いがあると ❌ と最初に違った行を表示し、今回の結果を `test/snap/<名前>.new.txt` に保存する
- 出力を**わざと**変えたとき（英語名の直し・見出しの変更など）は `npm run test:update` で見本を作り直して、`test/snap/` ごとコミットする
- ケースの追加は `test/cases.mjs` に1つ足して `npm test`（見本が無いケースは初回に自動保存）
- 本物のサイトには繋がない。本物のサイトの構造が変わったかは、毎週の自動点検（`check`）で見る

`src/deck2untap.js` の `C2U_VER` を上げてから組み立てると、どの版が動いているか分かりやすい（上げたら `CHANGELOG.md` にも1行）。

## 対応サイトと英語名の出どころ

| ゲーム | サイト | 英語名 |
|---|---|---|
| ONE PIECE | cardrush.media、tcg-portal.jp | punk-records（GitHub）の公式英語名。型番は `[op16-042]` の角括弧で指定 |
| 遊戯王 | tcg-portal.jp、deck-maker.com | yaml-yugi（約100MB、7日キャッシュ）＋一部の別名対応 |
| ポケモン | cardrush.media、tcg-portal.jp、pokemon-card.com（デッキ表示） | `data/pokemon-jp-en.json`（Limitless の日本版一覧＋英語版トレーナーズ名） |
| デュエマ | tcg-portal.jp、deck-maker.com | Duel Masters Wiki を検索し、ページの日本語名と照合 |
| ヴァンガード | cf-vanguard.com（入賞者レシピ）、decklog.bushiroad.com | Cardfight!! Vanguard Wiki をカード番号で照合 |
| ヴァイス | ws-tcg.com（デッキレシピ）、decklog.bushiroad.com | ws-names.json で英語名に変換。パネルで untap に登録済みかを判定し、未登録はその場で作成依頼 |

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
- ブラウザに保存する設定（ドン!!の選択など）はサイトごと・ブラウザごと。untap の履歴は untap 側に保存
