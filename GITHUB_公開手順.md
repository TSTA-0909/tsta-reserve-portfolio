# GitHubへ新規公開する手順（作業者向け）

## 1. まず GitHub 上で新規リポジトリを作る

1. https://github.com/new にアクセス
2. Owner: `TSTA-0909`（ご自身のアカウントであることを確認）
3. Repository name: `tsta-reserve-portfolio`
4. 初回は **Private** を選択（公開前の最終確認用）
5. 「Add a README」「Add .gitignore」「Choose a license」は **設定しない**（READMEと.gitignoreはこのZIPに含まれています。ライセンスは未選択です）
6. Create repository を押す

## 2. ZIPを解凍してGitHubへ登録

`TSTA_Reserve_Portfolio_GitHub_Ready_20261106.zip` を解凍し、`tsta-reserve-portfolio` フォルダをGit Bashで開きます。

以下を **上から順番に** 実行してください。

```bash
git init
git branch -M main
git add .
git commit -m "Add TSTA Reserve JavaScript portfolio"
git remote add origin https://github.com/TSTA-0909/tsta-reserve-portfolio.git
git push -u origin main
```

※ GitHubへのログインが必要な場合はブラウザの画面に従って認証してください。パスワードや秘密鍵をこのチャットに貼らないでください。

## 3. 公開前の最終確認

GitHub 上で次のファイルが存在し、開けることを確認します。

- `README.md`
- `src/domain/guestIdentityPolicy.js`
- `demo/index.html`
- `tests/guest-policy.test.mjs`
- `.github/workflows/node-tests.yml`

GitHub Actions の **Node.js tests** が成功すれば、同じ回帰テストがGitHub環境でも通ったことを示せます。

## 4. 採用担当者に見せるとき

公開してよいことを自分でも確認してから、GitHubのSettings > General > Danger Zone > Change repository visibility で Public に変更できます（UI表記は変わることがあります）。

公開URL: https://github.com/TSTA-0909/tsta-reserve-portfolio

このURLはリポジトリ作成・公開の後から有効になります。作成前はリンク先がありません。

**注意**：ソース抜粋は本番予約サイトではありません。READMEに書いているとおり、実際の利用者データや本番Firebaseには接続しません。公開URLを太田さんに渡す時にも、その点を併記してください。
