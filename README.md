# TEN.

数字をなぞって合計10を作る、60秒のミニマル数字パズルです。

## このリポジトリ

pnpm workspaceのモノレポです。

| 場所                 | 内容                                 |
| -------------------- | ------------------------------------ |
| `apps/web`           | Web版とCapacitor版の画面・ゲーム体験 |
| `apps/worker`        | Cloudflare Worker API                |
| `packages/game-core` | WebとWorkerで共有するゲームルール    |
| `docs/product`       | プロダクト仕様・デザイン資料         |
| `docs/deployment`    | 公開・運用手順                       |

## 環境構築

このリポジトリはNode.js 26.8.1とpnpm 11.21.0を使います。バージョンを自動で揃える方法は次の2つです。

- Linux / NixOS: Nix、direnvを用意し、リポジトリで `direnv allow` を実行する。`.envrc` が `flake.nix` の開発環境を読み込む
- Windowsなど: miseを用意し、リポジトリで `mise install` を実行する。`mise.toml` のNode.js、pnpm、Android SDK、Javaが用意される

どちらも使わない場合は、Node.js 26系とpnpm 11系を自分で用意してください。

依存関係をインストールします。

```bash
pnpm install
```

Nixやdirenvを使わないLinux環境では、次の方法でも開発環境に入れます。

```bash
nix develop
# 開発環境に入った後に実行
pnpm install
```

## 開発を始める

リポジトリのルートで実行します。

```bash
pnpm dev
```

Web画面は通常 `http://localhost:3000/` で開きます。Worker APIも使う場合は、別のターミナルで次を実行します。

```bash
pnpm --filter @ten/worker db:migrate:local
pnpm dev:worker
```

Workerは `http://localhost:8787` で起動します。WebとWorkerは別のターミナルで起動してください。

APIの接続先は `VITE_API_URL` で指定でき、未指定時は `http://localhost:8787` です。

## 確認コマンド

```bash
pnpm check
pnpm build
```

テストや個別の処理は次で実行できます。

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm format:check
```

## Gitフック

`pnpm install` の最後にGitフックが登録されます。登録されていない場合は次を実行します。

```bash
pnpm hooks:install
```

- commit前: 変更したJavaScript / TypeScriptなどをESLintとPrettierで確認・修正
- push前: 型チェックとテストを実行

フックで変更されたファイルは、内容を確認してからコミットしてください。

## 公開

公開手順は目的ごとに分かれています。

- [Cloudflare Worker](./docs/deployment/cloudflare-worker.md): API、D1、KVの初回設定と公開
- [GitHub Pages](./docs/deployment/github-pages.md): Web版の公開
- [モバイル](./docs/deployment/mobile.md): Android / iOSのビルドと配布

Workerを先に公開し、そのURLを `TEN_API_URL` としてPages・モバイルのビルドへ渡します。`AUTH_SECRET` と `ADMIN_SECRET` はWorker専用で、Webやモバイルへ渡しません。

## 仕様

ゲームのルール、画面、実装済み機能と将来案は [プロダクト説明書](./docs/product/README.md) を参照してください。

## ツールチェーン

- Node.js 26系
- pnpm 11系
- React / TypeScript / Vite
- TanStack Start / TanStack Router
- PixiJS / Tailwind CSS
- Cloudflare Workers / D1 / KV
- Capacitor 8
