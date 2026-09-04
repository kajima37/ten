# ステージング Web プレビューの公開・確認

TEN. の開発中バージョンを、**Cloudflare Workers Static Assets** と Google / GitHub ログインを使って関係者限定の Web プレビューとして公開・確認する手順です。

## 1. 全体の構成

Web 画面とステージング API を同一の Worker 上でホストし、Worker が OAuth ログインと承認済み identity の確認を行います。未認証または未承認の利用者は Web 画面と API を利用できません。`/api/health` のみ、稼働確認用に認証対象外です。

```
[関係者ブラウザ] ──→ [Google / GitHub ログイン]
                                      ↓ 認証成功・許可確認
                            [ten-api-staging (Worker)]
                            ├── Web 画面 (Static Assets)
                            └── API (/api/*) ──→ ステージング DB / キャッシュ
```

| 項目             | 設定内容                                                                        |
| ---------------- | ------------------------------------------------------------------------------- |
| **公開 URL**     | `https://ten-api-staging.<account>.workers.dev`                                 |
| **アクセス制限** | Google または GitHub の個人アカウントでログインし、個別に承認された人のみ閲覧可 |
| **接続先 API**   | 同一オリジンの `/api/*`（CORS 不要、ステージング DB 接続）                      |
| **更新契機**     | `main` ブランチへのマージ時に自動デプロイ                                       |

※ Web 画面を保護するため、静的アセットを含む全リクエストは Worker が認証後に返します。Workers Free の実行回数上限を超えると Web 画面も `429` になるため、内部プレビューの利用量を Cloudflare Dashboard で確認してください。

※ プレビュー用の画面とアセットには `Cache-Control: private, no-store` を付与し、Service Worker も無効化しています。ログアウト・承認取り消し後もブラウザにコンテンツが残りにくくしています。

## 2. 通常の開発・プレビュー確認の流れ

GitHub 上でコードが `main` ブランチにマージされると、GitHub Actions が自動でビルドとデプロイを実行します。

1. **自動反映**: `main` ブランチに変更がマージされると、ステージング環境が自動更新されます。
2. **プレビュー確認**: ブラウザで公開 URL を開き、Google または GitHub でログインします。承認済みのアカウントなら最新の画面を確認できます。
3. **管理画面**: プレビュー承認済みのアカウントは、staging の管理画面（[管理画面の公開と運用](./admin.md)）にも同じログインで入れます。
4. **ログアウト**: `https://ten-api-staging.<account>.workers.dev/auth/logout` の画面からログアウトできます。

手動で再デプロイしたい場合は、GitHub の **Actions → Pipeline → Run workflow** を開き、`main` ブランチを選択して実行します。手動実行では Worker と管理画面を再デプロイします。

## 3. 初回のみ必要な準備（管理者向け）

プロジェクト立ち上げ時や環境再構築時に一度だけ実施する作業です。

### ステップ 1: OAuth アプリの作成

**GitHub**（必須）の **Settings → Developer settings → OAuth Apps** で OAuth App を作成し、Authorization callback URL に次の URI を登録します。

```text
https://ten-api-staging.<account>.workers.dev/auth/callback/github
```

**Google**（任意）の OAuth Client を後日追加する場合は、Google Cloud Console で Web application の OAuth Client を作成し、次の URI を承認済みリダイレクト URI に登録します。

```text
https://ten-api-staging.<account>.workers.dev/auth/callback/google
```

Google の Client ID / Client Secret が未設定でもデプロイは成功します。その場合、ログイン画面に Google のボタンは表示されず、Google のログイン開始・callback は `503` を返します。導入時に両方の値を登録すれば、追加のデプロイで有効になります。

各 Client ID / Client Secret、および `PREVIEW_SESSION_SECRET` は、[秘密情報の初回設定・管理手順](./secrets.md)に従って `secrets/secrets.staging.age.env` へ登録します。

※ ここで作成する OAuth App は staging（プレビューと管理画面）専用です。production の管理画面では、staging と別の OAuth App を作成してください（[管理画面の公開と運用](./admin.md) を参照）。

### ステップ 2: 利用者の承認

利用者は公開 URL から Google または GitHub で一度ログインします。未承認の場合は、次のような識別子と本人確認用の情報が表示されます。

```text
github:12345678 (octocat)
```

または

```text
google:123456789012345678901 (tester@example.com)
```

初回ログイン時に、この identity が `preview_identities` へ保留状態（`approved_at` が空）で記録されます。管理者は staging の管理画面で「アクセス管理」を開き、保留一覧を確認して本人確認のうえ承認します。利用を停止する場合も同じ画面から取り消します。操作には理由が必要で、実行者と変更内容が監査ログに記録されます。

未承認の画面にはログインボタンが表示されます。管理者が承認したあとは、利用者がそのボタンから再度ログインするだけでアクセスできるようになります。

取消は次のリクエストから反映され、既存セッションも無効になります。

### ステップ 3: GitHub Environment Variables の設定

GitHub リポジトリの **Settings → Environments → staging → Variables** に接続先 URL を登録します。

| 項目名        | 値の例                                          | 備考                            |
| ------------- | ----------------------------------------------- | ------------------------------- |
| `TEN_API_URL` | `https://ten-api-staging.<account>.workers.dev` | 末尾のスラッシュ `/` は不要です |

## 4. 手元（ローカル PC）でのビルド確認

Worker Static Assets 用の Web ファイル一式を手元でビルドして確認したい場合の手順です。

```bash
# Web ファイルと Worker をビルド
pnpm build:worker
```

実行後、`apps/web/dist/client/` に静的配信用の Web ファイル一式が生成されます。

### ローカルでの Worker 起動

`pnpm dev:worker` は staging と同じ `PREVIEW_MODE=required` で起動するため、`apps/worker/.dev.vars`（Git 管理外）がないと全リクエストが `503` になります。目的に応じて `apps/worker/.dev.vars` を作成してください。

通常の API 開発では、プレビュー認証を無効化します:

```text
PREVIEW_MODE=disabled
```

プレビュー認証ごとローカルで確認する場合は、次の値を設定します。GitHub OAuth App の Authorization callback URL に `http://localhost:8787/auth/callback/github` を登録し、承認済み identity をローカル用 D1 に登録してください。

```text
PREVIEW_MODE=required
PREVIEW_SESSION_SECRET=<openssl rand -hex 32 などで生成したランダムな長い文字列>
GITHUB_OAUTH_CLIENT_ID=<GitHub OAuth App の Client ID>
GITHUB_OAUTH_CLIENT_SECRET=<GitHub OAuth App の Client Secret>
```

## 5. モバイル staging の確認

モバイルアプリ実機からステージング Worker に接続する認証は、将来の staging モバイルビルドで対応します。Web プレビューの Cookie を APK / IPA に埋め込んだり、OAuth Client Secret をアプリ本体へ含めたりしてはいけません。

モバイル staging が必要になった場合は、Google / GitHub のネイティブ OAuth と PKCE を使い、Worker が短命のモバイル用セッションを発行する方式を追加します。

## 6. 動作確認とトラブルシューティング

### 動作確認の手順

1. ブラウザでステージング公開 URL にアクセスします。
2. ログイン画面で Google または GitHub を選択します。
3. 承認済み identity でログインし、ゲームプレイ、デイリー盤面取得、ランキング送信が正常に行えるか確認します。
4. トップページの「管理画面」ボタンから、staging の管理画面を新しいタブで開けます（テスターが承認状況の確認や問い合わせに使うための導線です。GitHub Pages 版やモバイル版には表示されません）。
5. `curl --fail https://ten-api-staging.<account>.workers.dev/api/health` が `{"status":"ok","version":"..."}` を返すか確認します。`version` はデプロイしたコミット SHA です。

### よくあるトラブルと対処法

- **OAuth プロバイダで `redirect_uri_mismatch` が出る**: OAuth アプリに登録した callback URL が公開 URL と完全に一致するか確認してください。
- **ログイン後に承認待ち画面が出る**: 保留一覧を確認し、`approved_at` を設定して承認してください。`revoked_at` が設定されていないかも確認してください。
- **ログイン画面に Google / GitHub のボタンが出ない**: 対応する Client ID / Client Secret が `secrets/secrets.staging.age.env` に登録されているか確認してください。両方が無いプロバイダのボタンは表示されません。
- **プレビュー自体が `503` になる**: `PREVIEW_SESSION_SECRET` や OAuth 設定の不足、または `PREVIEW_MODE` の設定漏れが考えられます。staging の Worker 設定を確認してください。
- **CI のヘルスチェックが失敗する**: CI は `/api/health` の `version` がデプロイしたコミット SHA と一致すること、および未ログインで `/` を開くとログイン画面が返ることを確認します。`TEN_API_URL` が `https://...workers.dev` になっているか確認してください。ヘルスチェックは認証不要ですが、`/api/health` 以外の API と Web 画面は認証必須です。
- **Web 画面が表示されない / API 通信エラー**: ステージング D1 のマイグレーションが適用済みか、Workers Free の実行回数上限に達していないか確認してください。
