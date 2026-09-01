# GitHub Pagesへの公開

Web版をGitHub Pagesへ公開します。デイリー盤面やランキングを使うには、先に [Cloudflare Worker](./cloudflare-worker.md) を公開してください。

## 初回設定

1. GitHubの **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選びます。
2. **Settings → Secrets and variables → Actions → Variables** に、公開したWorkerのURLを `TEN_API_URL` として登録します。

```text
TEN_API_URL=https://ten-api.<account>.workers.dev
```

URLの末尾に `/` は付けません。

## 公開

`main` ブランチへのプッシュで `.github/workflows/pages.yml` が自動公開します。GitHubの **Actions → GitHub Pages → Run workflow** から手動実行することもできます。

ワークフローは、`TEN_API_URL` を埋め込んだSPAを作成し、`apps/web/dist/client` をGitHub Pagesへ公開します。

通常の公開先は次のURLです。

```text
https://kajima37.github.io/ten/
```

## 公開後の確認

- ページが開く
- デイリー画面に今日の盤面が表示される
- デイリーの結果送信とランキング表示が動作する

WorkerのURLを変更した場合は、`TEN_API_URL` を更新してからPagesを再実行します。Workerの処理だけを変更した場合は、Pagesの再公開は不要です。

## ローカル確認

```bash
pnpm build:pages
```

`apps/web/dist/client/index.html` が生成され、アセットURLがリポジトリ名のサブパスから始まることを確認します。
