# TEN.

数字をなぞって合計10を作る、60秒のミニマル数字パズルです。

プロダクト仕様と参考画像は [`docs/product`](./docs/product/README.md) にあります。

## 技術構成

- mise
- Node.js / pnpm
- TanStack Start / TanStack Router / Vite
- React / TypeScript
- i18next / react-i18next
- Tailwind CSS
- PixiJS / `@pixi/react`
- Phosphor Icons
- shadcn/ui
- ESLint / Prettier

ツールチェーンは **pnpm 11** に統一しています（`node` / `pnpm` のバージョンは `package.json`・`pnpm-lock.yaml`・`mise.toml`・`flake.nix` で固定・記録）。

- NixOS / Linux：`flake.nix`（nixpkgs）が `nodejs_26` と `pnpm`（11.x）を提供します
- Windows 等他環境：`mise.toml` がバージョン目安を提供します（mise は `mise.toml` に従って node / pnpm を管理）

## セットアップ

### NixOS / Linux（direnv）

```bash
direnv allow
pnpm install
```

direnv を入れていない場合は `nix develop` でも同じ環境に入れます。ツールチェーン（node 26.x / pnpm 11.x）は nixpkgs から cache 済みのバイナリを取得するため、ネットワーク待ちやソースビルドは発生しません。

### Windows（mise）

このリポジトリには Windows 用の mise ランチャーを `.tools/mise/mise.exe` に置けます。バイナリ自体はGit管理対象外です。miseをグローバルに導入済みの場合は、以下の `.\\.tools\\mise\\mise.exe` を `mise` に読み替えられます。

```powershell
.\.tools\mise\mise.exe install
.\.tools\mise\mise.exe run install
```

## 開発

NixOS / Linux：

```bash
pnpm dev
```

Windows：

```powershell
.\.tools\mise\mise.exe run dev
```

開発画面は通常 `http://localhost:3000/` で起動します。

## 品質チェック

NixOS / Linux：

```bash
pnpm check
pnpm build
```

Windows：

```powershell
.\.tools\mise\mise.exe run check
.\.tools\mise\mise.exe run build
```

個別に実行する場合：

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## モバイル

AndroidとiOSにはCapacitor 8を使って配布します。モバイル用SPAをビルドし、両方のネイティブプロジェクトへ同期するには次を実行します。

Windows：

```powershell
.\.tools\mise\mise.exe exec -- pnpm mobile:sync
```

NixOS / Linux：Android SDK（java + android-sdk）は現時点で未セットアップです。必要になったら `flake.nix` に nixpkgs の `jdk` / `androidsdk` を追加してください（または `mise.toml` の `java` / `android-sdk` を他環境で利用）。

ローカル環境、GitHub Actionsの成果物、ストア署名については [`docs/deployment/mobile.md`](./docs/deployment/mobile.md) を参照してください。

## バックエンド（Cloudflare Worker）

デイリー盤面の配信、スコア提出（リプレイ検証）、デイリーランキング、プレイヤー名の保存を `apps/worker`（Cloudflare Worker + D1 + KV）で提供します。ゲームルールは `packages/game-core` を Web と共有し、提出された操作イベントをサーバ側で再現してスコアを検証します（不正対策）。

### セキュリティ・不正対策

- **入力検証**: zod スキーマ（`src/schemas.ts`）で全リクエストを検証。score/maxCombo は整数、events は形式・件数（≤500）を制限、ボディは 64KB 上限
- **認証**: サーバが発行する不透明な `player_id`（UUID）を HMAC-SHA256 署名トークンにバインド。クライアントの `deviceId` は重複防止キーとしてのみ使用し、**ID を偽装することはできない**
- **リプレイ検証**: 盤面シード + 操作イベント列をサーバで再現し、スコア・最大コンボと突合（手動改ざんを拒否）
- **レート制限**: プレイヤー 5回/分、IP 30回/分（提出）、IP 20アカウント/日（登録）
- **IP 秘匿化**: クライアント IP は `CF-Connecting-IP` を HMAC でハッシュ化して保存（生 IP は保存しない）
- **監査 proof**: 提出イベント列を `score_proofs` に保存し、後から任意スコアを再検証可能
- **モバイル CORS**: Capacitor の WebView（`https://localhost` / `capacitor://localhost` 等）を許可
- リプレイ検証は「改ざん防止」であり、自動プレイの bot やデイリーの最適解コピー（盤面が公開のため原理的に検出不能）は防げません。検知は**事後モデレーション**で行います

### 管理 API（モデレーション）

`ADMIN_SECRET`（env / secret）を Bearer トークンとして渡すと、不正記録の調査・削除ができます。アプリ側の UI はありません（curl / スクリプトで操作）。

```bash
ADMIN="dev-only-admin-secret-change-before-deploy"   # 本番は wrangler secret で上書き
BASE="https://ten-api.<account>.workers.dev"

# 特定 IP（ハッシュ値）に紐づくプレイヤーとスコアを調べる
curl "$BASE/api/admin/players?ipHash=<hash>" -H "authorization: Bearer $ADMIN"

# プレイヤーを ban（リーダーボードから除外・提出を拒否）
curl -X POST "$BASE/api/admin/players/<player_id>/ban" -H "authorization: Bearer $ADMIN"
curl -X POST "$BASE/api/admin/players/<player_id>/unban" -H "authorization: Bearer $ADMIN"

# IP 単位で全アカウントを ban
curl -X POST "$BASE/api/admin/ip/<ip_hash>/ban" -H "authorization: Bearer $ADMIN"

# 不正記録を削除（scores と score_proofs）
curl -X DELETE "$BASE/api/admin/players/<player_id>/scores?date=YYYY-MM-DD" -H "authorization: Bearer $ADMIN"
```

`ip_hash` は `HMAC-SHA256(AUTH_SECRET, IP)` の base64url で、クライアント IP から再現できます。

ローカル開発（Web は `http://localhost:3000`、API は `http://localhost:8787`）：

```bash
pnpm dev:worker       # API を起動
pnpm --filter @ten/worker db:migrate:local   # 初回のみ: ローカル D1 へスキーマ適用
pnpm dev              # Web アプリを起動
```

Web アプリの API 接続先は `apps/web/src/lib/config.ts` が `VITE_API_URL`（未指定時は `http://localhost:8787`）を使います。GitHub Pages / モバイル向けビルドではリポジトリ変数 `TEN_API_URL` をビルド時に注入します。

デプロイ：

1. Cloudflare で `wrangler d1 create ten-db` と KV ネームスペースを作成し、得られた ID を `apps/worker/wrangler.jsonc` の `database_id` / KV の `id` に設定
2. `wrangler secret put AUTH_SECRET` と `wrangler secret put ADMIN_SECRET` で秘密鍵を設定（`wrangler.jsonc` の `vars` はローカル開発用の初期値。必ず本番では上書き）
3. GitHub リポジトリの Settings → Secrets and variables → Actions に `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`（シークレット）と `TEN_API_URL`（変数）を設定
4. `main` への `apps/worker/**` の変更で `.github/workflows/deploy-worker.yml` がマイグレーション適用 + `wrangler deploy` を実行。手動実行も可能

API は `https://ten-api.<account>.workers.dev` で公開されます。CORS は `localhost:3000`・`kajima37.github.io`・Capacitor を許可します。

## Web公開

GitHub Pagesへの公開方法は [`docs/deployment/github-pages.md`](./docs/deployment/github-pages.md) を参照してください。`main`へのプッシュ時に自動で公開され、手動実行にも対応しています。

## リポジトリ構成

pnpm workspace モノレポです。Web アプリを `apps/web`、ゲームルールの共有ロジックを `packages/game-core`、API バックエンドを `apps/worker`（Cloudflare Worker）に置きます。

## 主な場所

- `apps/web/src/routes` — TanStack Routerのファイルベースルート
- `apps/web/src/components/ten-game.tsx` — ゲーム全体の状態（フック群）と画面遷移を束ねるオーケストレータ
- `apps/web/src/components/screens` — 各画面（ホーム / ゲーム / 結果 / デイリー / 統計 / マイページ / チュートリアル）
- `apps/web/src/components/shared` — 画面横断で使う共通UI（Metric / ScreenTitle / BottomNavigation 等）
- `apps/web/src/components/game-board.tsx` — PixiJSゲーム盤面の描画
- `apps/web/src/components/ui` — shadcn/uiコンポーネント
- `apps/web/src/hooks` — `use-game` / `use-player` / `use-settings` / `use-account` / `use-server-daily`（状態管理・API 連携）
- `apps/web/src/lib` — 純粋ロジック（`player-state` / `backup` / `themes` / `storage` / `gesture` / `api` 等）
- `apps/web/src/styles.css` — TailwindとTEN.のデザイントークン（テーマ変数は `src/lib/themes.ts` から注入）
- `packages/game-core` — 盤面生成・消去・スコア等の純粋ゲームロジック（Web / Worker で共有）
- `apps/worker` — Cloudflare Worker（`src` にルーター・認証・検証・DB 層、`migrations` に D1 スキーマ）
- `flake.nix` / `.envrc` — NixOS / Linux の開発環境（nixpkgs で node / pnpm を提供）
- `mise.toml` — Windows 等他環境向けのバージョン目安
- `docs/product` — 企画・仕様・生成画像
- `apps/web/android` / `apps/web/ios` — Capacitorネイティブプロジェクト
- `.github/workflows` — Web・Android・iOS・Worker の継続的インテグレーション / デプロイ

## 参照した公式ドキュメント

- [TanStack Start: Getting Started](https://tanstack.com/start/latest/docs/framework/react/getting-started)
- [TanStack CLI: Quick Start](https://tanstack.com/cli/latest/docs/quick-start)
- [Tailwind CSS: Vite installation](https://tailwindcss.com/docs/installation/using-vite)
- [shadcn/ui: TanStack Start](https://ui.shadcn.com/docs/installation/tanstack)
- [PixiJS React: Getting Started](https://react.pixijs.io/getting-started)
- [mise: Node.js cookbook](https://mise.jdx.dev/mise-cookbook/nodejs.html)
- [ESLint: Getting Started](https://eslint.org/docs/latest/use/getting-started)
- [Prettier: Install](https://prettier.io/docs/install)
