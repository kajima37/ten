# TEN.

数字をなぞって合計10を作る、60秒のミニマル数字パズルです。

プロダクト仕様と参考画像は [`docs/product`](./docs/product/README.md) にあります。

## 技術構成

- mise
- Node.js / pnpm
- TanStack Start / TanStack Router / Vite
- React / TypeScript
- Tailwind CSS
- PixiJS / `@pixi/react`
- shadcn/ui
- ESLint / Prettier

バージョンは `mise.toml`、`package.json`、`pnpm-lock.yaml` で固定・記録しています。

## セットアップ

このリポジトリには Windows 用の mise ランチャーを `.tools/mise/mise.exe` に置けます。バイナリ自体はGit管理対象外です。miseをグローバルに導入済みの場合は、以下の `.\\.tools\\mise\\mise.exe` を `mise` に読み替えられます。

```powershell
.\.tools\mise\mise.exe install
.\.tools\mise\mise.exe run install
```

## 開発

```powershell
.\.tools\mise\mise.exe run dev
```

開発画面は通常 `http://localhost:3000/` で起動します。

## 品質チェック

```powershell
.\.tools\mise\mise.exe run check
.\.tools\mise\mise.exe run build
```

個別に実行する場合：

```powershell
.\.tools\mise\mise.exe exec -- pnpm format
.\.tools\mise\mise.exe exec -- pnpm lint
.\.tools\mise\mise.exe exec -- pnpm typecheck
.\.tools\mise\mise.exe exec -- pnpm build
```

## 主な場所

- `src/routes` — TanStack Routerのファイルベースルート
- `src/components/game-board.tsx` — PixiJSゲーム盤面の初期描画
- `src/components/ui` — shadcn/uiコンポーネント
- `src/styles.css` — TailwindとTEN.のデザイントークン
- `docs/product` — 企画・仕様・生成画像

## 参照した公式ドキュメント

- [TanStack Start: Getting Started](https://tanstack.com/start/latest/docs/framework/react/getting-started)
- [TanStack CLI: Quick Start](https://tanstack.com/cli/latest/docs/quick-start)
- [Tailwind CSS: Vite installation](https://tailwindcss.com/docs/installation/using-vite)
- [shadcn/ui: TanStack Start](https://ui.shadcn.com/docs/installation/tanstack)
- [PixiJS React: Getting Started](https://react.pixijs.io/getting-started)
- [mise: Node.js cookbook](https://mise.jdx.dev/mise-cookbook/nodejs.html)
- [ESLint: Getting Started](https://eslint.org/docs/latest/use/getting-started)
- [Prettier: Install](https://prettier.io/docs/install)
