# TSTA Reserve 体験デモ｜GitHub Pages 公開手順

このリポジトリには、最新の体験デモ Ver.0.11 と GitHub Pages 用の紹介ページが登録されています。

## 1. リポジトリの公開状態を決める

GitHub FreeでGitHub Pagesを使う場合は、リポジトリを **Public** にする必要があります。
GitHub Proなど、PrivateリポジトリでPagesを利用できるプランもあります。
**注意：GitHub Pagesで公開したサイトは、Privateリポジトリから作っても基本的にインターネット上で一般公開されます。**

Publicに切り替える場合：
1. [リポジトリ Settings](https://github.com/TSTA-0909/tsta-reserve-portfolio/settings) を開く
2. **General** の下部 **Danger Zone** を開く
3. **Change repository visibility → Make public** を選択して、GitHubの確認に従う

一般公開するとソースコードや履歴も閲覧できるようになるため、切り替え前に内容を確認してください。

## 2. GitHub Pagesを有効にする

1. [Settings → Pages](https://github.com/TSTA-0909/tsta-reserve-portfolio/settings/pages) を開く
2. **Build and deployment → Source** を **Deploy from a branch** にする
3. **Branch** を **main**、フォルダを **/docs** にする
4. **Save** を押す

## 3. 公開を確認する

GitHubが公開処理を完了したら、下記URLを開きます。

- 紹介ページ： https://tsta-0909.github.io/tsta-reserve-portfolio/
- 体験デモ： https://tsta-0909.github.io/tsta-reserve-portfolio/experience/
- Actions： https://github.com/TSTA-0909/tsta-reserve-portfolio/actions

初回は公開処理に時間がかかる場合があります。ページが表示されないときは、Settings → Pages の状態と Actions のPagesビルド結果を確認してください。

## 4. 採用担当者へ渡すとき

紹介ページを最初に渡すのがおすすめです。ソースコードを見たい方にはGitHubリポジトリのURLも併記してください。

> TSTA Reserveは、実際のソフトテニス団体の運営で生じた課題を解決するために開発したシステムです。ポートフォリオでは架空データを使い、予約→管理者確認→キャンセル待ち→繰り上がり通知を体験できます。本番の会員データ・Firebase・通知配信には接続しません。

## 公開前のチェック

- [ ] 操作デモで予約から管理者の反映確認まで問題なく進められる
- [ ] READMEに記載した機能と公開デモの内容が一致する
- [ ] 本番Firebase、実名、通知トークン、機密データは含まれない
- [ ] Gitのコミット履歴に表示される作成者名・メールアドレスも確認した
- [ ] 公開後のURLをChromeなどのブラウザで開き、正常に表示される

GitHub Pagesの仕様は公式ドキュメントを参照：
https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
