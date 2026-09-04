# GitHub Pages版の公開

## 概要

`main` ブランチのWeb変更がPipelineで検証されると、GitHub PagesへAPIなしの公開デモが自動デプロイされます。

- 公開URL: `https://kajima37.github.io/ten/`
- 公開範囲: URLを知っている人が認証なしでアクセス可能
- API: 使用しない
- データ: ブラウザのローカルストレージへ保存

ランキング、週間ランキング、フレンド、サーバーへのスコア送信はGitHub Pages版では利用できません。通常のWeb版、staging Worker、モバイル版のAPI動作には影響しません。

マイページにはプライバシーポリシーと利用規約へのリンクが表示されます。リンク先はstaging Workerの法務ページで、表示はプレビュー認証が必要です。リンク先は `VITE_LEGAL_BASE_URL` で変更できます（既定: `https://ten-api-staging.kajima37.workers.dev`）。

## 初回設定

GitHubリポジトリの **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選択します。

以後は `main` の変更時に `.github/workflows/pipeline.yml` がPagesを更新します。Pages用の追加シークレットやstaging APIのCORS設定は不要です。

## 確認

1. `main` にWeb変更をpushします。
2. GitHubの **Actions → Pipeline** で `build-pages` と `Deploy GitHub Pages demo` が成功することを確認します。
3. 公開URLを開き、通常ゲームとデイリーゲームを開始します。
4. ブラウザの開発者ツールで、ゲーム開始時に `/api/` へのリクエストが発生しないことを確認します。

## トラブルシューティング

- Pagesのデプロイ権限エラー: PagesのSourceが **GitHub Actions** になっているか確認します。
- 画面が読み込めない: `/ten/` 付きの公開URLを使用し、PipelineのPages artifactを確認します。
- デイリーゲームが開始できない: `build-pages` の `Verify Pages bundle` とブラウザコンソールを確認します。
