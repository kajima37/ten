# GitHub Pages への公開

TEN. はバックエンドを使わないSPAとしてビルドし、GitHub Pagesで公開します。

## 公開の流れ

`main` ブランチへのプッシュ時に `.github/workflows/pages.yml` が次を実行します。

1. 依存関係をインストールする
2. GitHub Pages用のサブパスを設定してSPAをビルドする
3. `dist/client` をPages成果物としてアップロードする
4. `github-pages` 環境へデプロイする

Actions画面から `GitHub Pages` ワークフローを手動実行することもできます。

## 初回のみ必要なGitHub設定

リポジトリの **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選択します。リポジトリが非公開の場合は、契約中のGitHubプランで非公開リポジトリのPagesが利用できる必要があります。

公開先は通常、次のURLです。

```text
https://kajima37.github.io/ten/
```

## ローカル確認

```powershell
.\.tools\mise\mise.exe exec -- pnpm build:pages
```

`dist/client/index.html` が生成され、HTML内のアセットURLが `/ten/` から始まることを確認します。
