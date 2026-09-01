# GitHub Pages への公開

Web プレビュー版を **GitHub Pages** に公開する手順です。開発チームや関係者がブラウザから最新のゲーム体験を確認するために利用します。

## 1. 概要

- **公開 URL**: `https://kajima37.github.io/ten/`
- **接続先サーバー**: 自動的に **ステージング Worker**（`ten-api-staging`）に接続されます。本番データには影響を与えません。
- **更新タイミング**: `main` ブランチへ変更がマージされるたびに、GitHub Actions が自動で最新版をビルドして公開します。

## 2. 初回のみ必要な設定（リポジトリ管理者）

1. **GitHub Pages の有効化**:
   - リポジトリの **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選択します。
2. **接続先 API URL の登録**:
   - **Settings → Environments → staging → Variables** に `TEN_API_URL` を追加します。
   - 値の例: `https://ten-api-staging.<account>.workers.dev`（末尾のスラッシュ `/` は不要です）

## 3. 手動での更新とローカル確認

通常はプッシュ時に自動更新されますが、手動で再実行したい場合は GitHub の **Actions → GitHub Pages → Run workflow** から実行できます。

### 手元でビルドを確認する場合

```bash
pnpm build:pages
```

実行後、`apps/web/dist/client/` に GitHub Pages 用の Web ファイル一式が生成されます。
