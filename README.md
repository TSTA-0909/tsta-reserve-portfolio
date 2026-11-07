# TSTA Reserve | JavaScript 開発ポートフォリオ

![JavaScript](https://img.shields.io/badge/JavaScript-ES%20Modules-F7DF1E?logo=javascript&logoColor=000)
![Tests](https://img.shields.io/badge/Tests-Node.js-339933?logo=node.js&logoColor=fff)
![Demo](https://img.shields.io/badge/Demo-local%20only-0F766E)

**実際のソフトテニス団体で運用される予約システム「TSTA Reserve」の設計・実装から、人物情報の誤紐付けを防ぐロジックを抜粋した、採用・技術紹介用リポジトリです。**

> **このリポジトリは本番システム全体ではありません。** 本番環境に接続しないよう、Firebase構成、実会員データ、管理者機能、通知資格情報を除外し、説明・テスト可能なロジックのみ収録しています。一部は公開用に配置やテストデータを調整しています。

## 開発の背景

団体運営で、予約管理、友達の代理参加、同姓・同名の利用者、参加履歴・試合結果の紐付け、キャンセル待ちの通知先の確認といった課題が発生しました。

単なる画面入力の自動化ではなく、**「同じ名前だから同じ人物」と決めつけないこと**、**紹介者と参加者を別の人として扱うこと**、**管理者が確認した根拠なしに戦績を移し替えないこと**を重要な設計条件としました。

## 収録した実装

| モジュール | 実装内容・技術的な工夫 |
| --- | --- |
| `src/domain/guestIdentityPolicy.js` | 紹介参加者の仮ID判定、氏名の正規化、有効期限、紹介者所有チェック、同一人物の候補検出（自動統合しない） |
| `src/domain/identityDeliveryService.js` | UIDと正本人物IDの突合、氏名衝突の保留、通知トークンの重複や誤配送への対処 |
| `src/domain/matchIdentityReviewPolicy.js` | 管理者が承認した試合・選手単位の照合記録の再検証 |
| `src/domain/matchStatsPersonIdentityProjection.js` | 試合記録原本を変更せず、表示時に人物照合と保留判定を行う |
| `src/domain/reservationHistoryTriggers.js` | 予約履歴のイベント化と、友達紹介者へ別人の履歴を付けない処理 |
| `src/domain/offerEngine.js` | キャンセル待ちの繰り上げ提案、期限切れ、順番の更新。DBと通知は外部から注入する構造 |

※「実環境での運用」は本番アプリについての説明です。**この公開用抜粋には本番のDBや通知システムがありません**。一部のモジュールは単独実行用アプリではなく、実装例として含めています。

## 動くデモ（本番への接続なし）

JavaScript ES Modules の静的HTMLデモを `demo/` に収録しています。

```bash
# リポジトリのルートで実行（Pythonがある場合）
python -m http.server 8000
```

ブラウザで `http://localhost:8000/demo/` にアクセスすると、以下をローカルで試せます。

1. 紹介参加者に、紹介者とは独立した仮IDを作成する
2. 同一人物候補を判定する（自動統合はしない）
3. 試合照合の承認が、元データ変更後に流用されないことを確かめる

**すべて架空データ**で動作し、ネットワークへの書き込みやFirebase接続を行いません。

## テスト

Node.js 20以上を推奨。外部ライブラリのインストールは不要です。

```bash
npm test
```

`tests/` には人物識別、予約履歴、通知先確認、試合照合、キャンセル待ち提案の回帰検証を含みます。外部依存はモックに置き換えているため、実際のFirebase APIやデプロイ確認に代わるものではありません。

## 使用技術

- JavaScript（ES Modules、非同期処理、関数分割、依存性注入）
- Node.js（標準ライブラリでの回帰テスト）
- 本番プロジェクトでは Firebase / Cloud Firestore / Cloud Functions / Web Push を利用（**この公開用リポジトリには認証情報や接続設定を含めない**）

## 担当した範囲

要件の整理、画面・機能の企画、プログラム開発、利用者からのフィードバックに基づく改善、テスト方針の検討を担当。AIツールも補助的に活用し、コードのレビューと運用上の意思決定を行っています。

## 公開範囲と注意

- 実際の会員の氏名・UID・通知トークン・予約情報は収録していません
- 本番データへのアクセスはできません
- Firebase認証・セキュリティルール・本番運用監査の代わりとなるものではありません
- この抜粋をそのまま実環境に配置することは想定していません
- 公開されたソースコードにオープンソースライセンスは設定していません。使用・再配布の許諾については作成者へ確認してください。

**制作：Terakoya Systems / TSTA Reserve**

<!-- TSTA-RESERVE-PAGES-START -->
## 🎾 予約・管理者確認・キャンセル待ちを体験

**[ブラウザで操作できる体験デモ](https://tsta-0909.github.io/tsta-reserve-portfolio/)**

参加者として予約した内容が管理者画面に反映されることを確認し、さらに満席日のキャンセル待ち・参加取消・繰り上がり模擬通知・管理者側への予約反映まで体験できます。画面右上の操作ガイドが操作場所を順番に強調します。

- **動くデモ**：`docs/experience/`（模擬データ専用。Firebase本番環境には接続しません）
- **紹介ページ**：`docs/index.html`（GitHub Pages公開用）
- **開発コードとテスト**：`src/domain/`、`tests/`、`docs/experience/*.test.mjs`

デモは本番のWeb Pushや個人データに接続しません。通知は画面内の模擬表示です。GitHub Pagesを有効にしていない間は上記のデモURLにはアクセスできません。
<!-- TSTA-RESERVE-PAGES-END -->
