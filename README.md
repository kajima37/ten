# TEN.

**MAKE 10. BEAT YOUR BEST.**  
数字をなぞって合計「10」を作る、60秒の大人向けミニマル数字パズルです。

## はじめに

このリポジトリは、スマートフォン向けアプリ（iOS / Android）および Web プレビュー版のソースコードと、オンライン対戦・ランキング用バックエンド（Cloudflare Worker）を含むモノレポです。

### 構成一覧

| フォルダ             | 役割                                                                  |
| -------------------- | --------------------------------------------------------------------- |
| `apps/web`           | ゲーム画面、Web プレビュー版、Capacitor モバイルアプリ                |
| `apps/worker`        | デイリー盤面配信、ランキング集計、スコア検証 API（Cloudflare Worker） |
| `packages/game-core` | ゲームのルール、盤面生成、スコア計算（共有モジュール）                |
| `docs/product`       | プロダクト仕様書、ゲームルール、画面設計                              |
| `docs/deployment`    | モバイルアプリ配布、サーバー公開、秘密情報の初期設定手順              |

## 開発環境のセットアップ

### 前提条件

- **Node.js**: 26系
- **pnpm**: 11系

環境管理ツールを使うと、必要なツール（Node.js、pnpm、暗号化ツール等）が自動でセットアップされます。NixOS では `flake.nix` が Playwright の Chromium 実行環境も提供します。

```bash
# Linux / macOS (direnv を利用している場合)
direnv allow

# Windows または mise を利用している場合
mise install
```

### パッケージのインストール

```bash
pnpm install
```

### ローカルでゲームを起動する

```bash
# Web 開発サーバーを起動 (通常 http://localhost:3000 で起動)
pnpm dev

# (任意) ローカル Worker API サーバーも動かす場合 (別のターミナルで実行)
pnpm --filter @ten/worker db:migrate:local
pnpm dev:worker
```

## コード品質チェック・テスト

プルリクエスト前や動作確認には、以下のコマンドを実行します。

```bash
pnpm check   # フォーマット確認、静的解析、型チェック、全テストを一括実行
pnpm build   # プロダクションビルドの確認

# Chromium を使うブラウザスモークテスト（NixOS）
nix develop --command pnpm test:e2e
```

## 公開・デプロイ手順

目的に応じて各ドキュメントを参照してください。

- **[モバイルアプリの公開・ビルド](./docs/deployment/mobile.md)**:  
  `production` ブランチでバージョンタグ（例: `v1.0.0`）をプッシュするだけで、Android（Google Play 内部テスト）と iOS（TestFlight）へ自動提出されます。
- **[Cloudflare Worker の公開と運用](./docs/deployment/cloudflare-worker.md)**:  
  バックエンド API、データベース（D1）、キャッシュ（KV）の設定と自動デプロイについて説明しています。
- **[ステージング Web プレビューの公開](./docs/deployment/cloudflare-worker-preview.md)**:
  Cloudflare Workers Static Assets と Cloudflare Access による、関係者限定 Web プレビューの公開手順です。
- **[秘密情報の初回設定手順（SOPS + age）](./docs/deployment/secrets.md)**:  
  署名キーストア、証明書、API トークンなどの暗号化ファイルの準備や、GitHub リポジトリへの環境設定方法をステップ・バイ・ステップで解説しています。

## 仕様・デザイン

ゲームの詳しいルール、画面構成、実装済み機能やロードマップは **[プロダクト説明書](./docs/product/README.md)** をご覧ください。
