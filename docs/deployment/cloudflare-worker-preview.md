# ステージング Web プレビューの公開・確認

TEN. の開発中バージョンを、**Cloudflare Workers Static Assets** と Google / GitHub ログインを使って関係者限定の Web プレビューとして公開・確認する手順です。

## 1. 全体の構成

Web 画面とステージング API を同一の Worker 上でホストし、Worker が OAuth ログインと許可済み identity の確認を行います。未認証または未承認の利用者は Web 画面と API を利用できません。

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

## 2. 通常の開発・プレビュー確認の流れ

GitHub 上でコードが `main` ブランチにマージされると、GitHub Actions が自動でビルドとデプロイを実行します。

1. **自動反映**: `main` ブランチに変更がマージされると、ステージング環境が自動更新されます。
2. **プレビュー確認**: ブラウザで公開 URL を開き、Google または GitHub でログインします。承認済みのアカウントなら最新の画面を確認できます。

手動で再デプロイしたい場合は、GitHub の **Actions → Deploy Staging Worker → Run workflow** から実行できます。

## 3. 初回のみ必要な準備（管理者向け）

プロジェクト立ち上げ時や環境再構築時に一度だけ実施する作業です。

### ステップ 1: OAuth アプリの作成

Google Cloud Console で Web application の OAuth Client を作成し、次の URI を承認済みリダイレクト URI に登録します。

```text
https://ten-api-staging.<account>.workers.dev/auth/callback/google
```

GitHub の **Settings → Developer settings → OAuth Apps** で OAuth App を作成し、Authorization callback URL に次の URI を登録します。

```text
https://ten-api-staging.<account>.workers.dev/auth/callback/github
```

Google と GitHub の Client ID / Client Secret、および `PREVIEW_SESSION_SECRET` と `PREVIEW_HEALTHCHECK_SECRET` は、[秘密情報の初回設定・管理手順](./secrets.md)に従って `secrets/secrets.staging.age.env` へ登録します。

### ステップ 2: 利用者の承認

利用者は公開 URL から Google または GitHub で一度ログインします。未承認の場合は、次のような識別子が表示されます。

```text
google:123456789012345678901
```

または

```text
github:12345678
```

管理者は表示された識別子を確認し、リポジトリのルートから次の SQL を実行して利用を許可します。`provider` と `subject` は表示された値へ置き換えてください。

```bash
pnpm --filter @ten/worker exec wrangler d1 execute ten-db-staging --remote --env staging \
  --command "INSERT INTO preview_identities (provider, subject) VALUES ('google', '123456789012345678901');"
```

利用を停止する場合は、対象 identity を削除せず次の SQL で取り消します。既存のセッションも次のリクエストから無効になります。

```bash
pnpm --filter @ten/worker exec wrangler d1 execute ten-db-staging --remote --env staging \
  --command "UPDATE preview_identities SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE provider = 'google' AND subject = '123456789012345678901';"
```

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

## 5. モバイル staging の確認

モバイルアプリ実機からステージング Worker に接続する認証は、将来の staging モバイルビルドで対応します。Web プレビューの Cookie を APK / IPA に埋め込んだり、OAuth Client Secret をアプリ本体へ含めたりしてはいけません。

モバイル staging が必要になった場合は、Google / GitHub のネイティブ OAuth と PKCE を使い、Worker が短命のモバイル用セッションを発行する方式を追加します。

## 6. 動作確認とトラブルシューティング

### 動作確認の手順

1. ブラウザでステージング公開 URL にアクセスします。
2. ログイン画面で Google または GitHub を選択します。
3. 承認済み identity でログインし、ゲームプレイ、デイリー盤面取得、ランキング送信が正常に行えるか確認します。

### よくあるトラブルと対処法

- **OAuth プロバイダで `redirect_uri_mismatch` が出る**: OAuth アプリに登録した callback URL が公開 URL と完全に一致するか確認してください。
- **ログイン後に承認待ち画面が出る**: 表示された identity を `preview_identities` へ登録しているか、`revoked_at` が設定されていないか確認してください。
- **CI のヘルスチェックが失敗する**: `PREVIEW_HEALTHCHECK_SECRET` と `TEN_API_URL` の設定を確認してください。
- **Web 画面が表示されない / API 通信エラー**: ステージング D1 のマイグレーションが適用済みか、Workers Free の実行回数上限に達していないか確認してください。
