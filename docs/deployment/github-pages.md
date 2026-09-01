# GitHub Pagesへの公開

Web版をGitHub Pagesへ公開します。`main` は開発確認用なので、Pages は staging Worker に接続します。初回の Worker 設定は [Cloudflare Worker](./cloudflare-worker.md) を参照してください。

## 初回設定

1. GitHubの **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選びます。
2. **Settings → Environments → staging → Variables** に、staging Worker の URL を `TEN_API_URL` として登録します。

```text
TEN_API_URL=https://ten-api-staging.<account>.workers.dev
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

staging Worker の URL を変更した場合は、`staging` Environment の `TEN_API_URL` を更新してから Pages を再実行します。Worker の処理だけを変更した場合は、Pages の再公開は不要です。

## ローカル確認

```bash
pnpm build:pages
```

`apps/web/dist/client/index.html` が生成され、アセットURLがリポジトリ名のサブパスから始まることを確認します。
