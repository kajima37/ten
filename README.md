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

## Web公開

GitHub Pagesへの公開方法は [`docs/deployment/github-pages.md`](./docs/deployment/github-pages.md) を参照してください。`main`へのプッシュ時に自動で公開され、手動実行にも対応しています。

## 主な場所

- `src/routes` — TanStack Routerのファイルベースルート
- `src/components/ten-game.tsx` — ゲーム全体の状態（フック群）と画面遷移を束ねるオーケストレータ
- `src/components/screens` — 各画面（ホーム / ゲーム / 結果 / デイリー / 統計 / マイページ / チュートリアル）
- `src/components/shared` — 画面横断で使う共通UI（Metric / ScreenTitle / BottomNavigation 等）
- `src/components/game-board.tsx` — PixiJSゲーム盤面の描画
- `src/components/ui` — shadcn/uiコンポーネント
- `src/hooks` — `use-game` / `use-player` / `use-settings`（盤面・記録・設定の状態管理）
- `src/lib` — 純粋ロジック（`game-logic` / `player-state` / `backup` / `themes` / `storage` / `gesture` 等）
- `src/styles.css` — TailwindとTEN.のデザイントークン（テーマ変数は `src/lib/themes.ts` から注入）
- `flake.nix` / `.envrc` — NixOS / Linux の開発環境（nixpkgs で node / pnpm を提供）
- `mise.toml` — Windows 等他環境向けのバージョン目安
- `docs/product` — 企画・仕様・生成画像
- `android` / `ios` — Capacitorネイティブプロジェクト
- `.github/workflows` — Web・Android・iOSの継続的インテグレーション

## 参照した公式ドキュメント

- [TanStack Start: Getting Started](https://tanstack.com/start/latest/docs/framework/react/getting-started)
- [TanStack CLI: Quick Start](https://tanstack.com/cli/latest/docs/quick-start)
- [Tailwind CSS: Vite installation](https://tailwindcss.com/docs/installation/using-vite)
- [shadcn/ui: TanStack Start](https://ui.shadcn.com/docs/installation/tanstack)
- [PixiJS React: Getting Started](https://react.pixijs.io/getting-started)
- [mise: Node.js cookbook](https://mise.jdx.dev/mise-cookbook/nodejs.html)
- [ESLint: Getting Started](https://eslint.org/docs/latest/use/getting-started)
- [Prettier: Install](https://prettier.io/docs/install)
