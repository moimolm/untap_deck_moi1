# untap カード登録の手順（登録担当チャット向け）

このチャットの役割：**「untap カード作成依頼」を受け取り、未登録カードを soogoo（DB 登録用アカウント）で untap に登録する**。
ツール（ブックマーク「untapへ転送」）の開発は別チャットで行う。ここではツールを使うだけ。

## 前提

- ブラウザ：Chrome の **mopmop** プロフィール（Claude の拡張機能の名前は「mopmop-testspace」）。untap には **soogoo** でログイン済み
  - いつものプロフィール（keiek）では絶対に登録しない。登録者名が記録されるため
  - ブラウザを選ぶときは mopmop-testspace を使う
- untap はタブが前面にないと画面を描画しない。作業中は mopmop のウィンドウを前面に出してもらう
- ブックマーク本体：`https://moimolm.github.io/untap_deck_moi1/d2u.js`（v15 以降）
  - ページで直接読み込む場合：`const s=document.createElement('script');s.src='https://moimolm.github.io/untap_deck_moi1/d2u.js?t='+Date.now();document.body.appendChild(s)`
  - 読み込むと、untap のデッキ編集画面では右上にパネルが出て、`window.c2u` が使えるようになる

## 依頼の入口と流れ

- **友人**：untap で取り込めないカードがあると「作成依頼を送る」ボタンが出る → Google フォーム（依頼内容が入った状態）で送信
  - フォーム：https://docs.google.com/forms/d/e/1FAIpQLSfBI-qi51bINoY5ou9_KaH1jOK5RMtb8Yp7GXHrmlPU8xMRtw/viewform
  - 回答シート：Google ドライブ「untap カード作成依頼 （回答）」
- **定期処理**：スケジュールされた作業「untap カード作成依頼の処理」が1時間おきにシートを読み、入力内容を用意して確認ボードに載せ、Key のスマホに通知する
- **確認ボード**：https://claude.ai/artifact/MbhZfR5qWFJ7zw4AcTbbjp （Key 専用。各カードに「直してほしいこと」を書ける）
- **許可**：通知から開いた会話で Key が「OK <依頼ID>」と書いたときだけ、その依頼のカードを登録する（Add Card を押す）
- **手動**：LINE などで届いた依頼や、自分で見つけた未登録カードは、この手順どおりチャットで処理してよい

## 依頼の形

ユーザーが貼る依頼はこういう形：

```
【untap カード作成依頼】
ゲーム: ヴァイス（WSTCG）
デッキ: 学マス | https://ws-tcg.com/deckrecipe/…
untap の作業用デッキ: https://untap.in/deck/…
未登録カード（2 行）:
- GIM/W124-032 | かぜったい追いついてやる | 2枚 | https://ws-tcg.com/wordpress/…/gim_w124_032.png
```

## 手順

1. **カード情報を集める**：番号ごとに公式サイトのカード詳細を開き、カード名とテキストを読む
   - ヴァイス：`https://ws-tcg.com/cardlist/?cardno=<番号>`
2. **英語版が出ているか確かめる**：untap の Add Missing Card でキャラ名などを入れ、出てきた既存カードを見る
   - 同じカード（効果が同じ）が英語名で登録済みなら、**その英語名を一字一句そのまま**使う（`Add reprint` になり、重複を作らない）
3. **英語版が無いカードは自分で英訳する**
   - 名前：`キャラ名, 肩書き` の順（例：`Kotone Fujita, Started Being Cute`）。キャラ名は公式のローマ字表記に合わせる
   - テキスト：公式英語版の書き方に合わせる（`[A]` `[C]` `[S]`、`When this is placed from hand to the Stage,` など）
   - **Heart of the Cards（HoC）の訳は見ない・写さない**。HoC は転載禁止のため。公式の日本語から自分で訳す
4. **登録用データを作る**（JSON の配列）：

   ```json
   [
     {"no":"GIM/W124-T02","name":"Kotone Fujita, Started Being Cute"},
     {"no":"GIM/W124-032","name":"I Will Definitely Catch Up","text":"[C] …"}
   ]
   ```

   - `no`：カード番号（依頼に書かれたとおり）
   - `name`：英語名（既存カードに足す場合は既存の名前と完全一致させる）
   - `text`：英語テキスト（新規登録のときだけ。既存に足すときは不要）
   - `image`：省略可（省略すると公式画像の URL を番号から自動で作る）
   - `reprint`：省略可。`true`＝必ず既存に足す、`false`＝必ず新規
5. **soogoo の作業用デッキでフォームに入力する**
   - 依頼に書かれた「untap の作業用デッキ」を開き、ブックマーク本体を読み込む
   - `window.c2u.load('<登録用データ>')` で読み込み、パネルの「フォームに入力」を上から1枚ずつ押す（または `await window.c2u.fillCard({...})`）
   - 自動で Add Missing Card を開き、I understand → 名前で既存カードを検索 → Add reprint／It's a new card → 画像 URL → Continue → 番号・英語名・英語テキスト・Official print・Portrait まで入力する
6. **「Add Card」は押さない**：オレンジ枠で光らせてあるので、ユーザーに確認して押してもらう
   - ユーザーが一覧を見て「全部 OK」と明言したときだけ、こちらで押してよい
7. **全部登録したら**：パネルの「登録後にもう一度取り込む」（`window.c2u.reimport()`）。取り込めなかったカードが残っていないか確認する
8. **英語名データを書き出す**：パネルの「英語名データを書き出す」で ws-names.json を保存し、GitHub（moimolm/untap_deck_moi1 の一番上）に上書きアップロードしてもらう。友人の環境でも英語名が自動で入るようになる
9. ユーザーに完了を報告する。メインアカウント（keiek）では、soogoo のデッキの公開範囲を Friends／Public にして「Import from URL」で取り込める

## 登録のルール

| 項目 | 入れる値 |
|---|---|
| Print Type | 常に **Official print**（日本だけで発売のカードも正規品なので Official） |
| Card Image Orientation | 常に **Portrait**（クライマックスも縦で登録。場ではタップして横にする） |
| Set / Release Identifier | カード番号を小文字で（例 `gim/w124-032`）。デッキの貼り付けの `(番号)` と一致させるため |
| 画像 | 公式サイトの画像 URL（ツールが自動で入れる） |
| 自作・非公式カード | 登録しない（`It's a custom, non-legal card` は使わない） |

## 注意

- untap の登録は全ユーザーに公開され、登録者も記録される。名前・番号・画像の取り違えがないか、Add Card の前に必ず確認する
- 画像から自動で読み取られる文字（崩れた日本語）は、ツールが英語テキストで上書きする。テキストが無いときはそのまま残る
- うまく動かないときは、パネル下の「状況を報告用にコピー」の内容をツール開発のチャットに渡す
