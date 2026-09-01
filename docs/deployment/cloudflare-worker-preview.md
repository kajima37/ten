# ステージング Web プレビューの公開・確認

TEN. の開発中バージョンを、**Cloudflare Workers Static Assets** と **Cloudflare Access** を使って関係者限定の Web プレビューとして安全に公開・確認する手順です。

## 1. 全体の構成

Web 画面とステージング API を同一の Worker 上でホストし、Worker 全体を Cloudflare Access で保護することで、安全に関係者のみへ最新の開発版を提供します。

```
[関係者ブラウザ] ──(メール/IdP認証)──→ [Cloudflare Access]
                                            ↓ 認証成功
                                  [ten-api-staging (Worker)]
                                  ├── Web 画面 (Static Assets)
                                  └── API (/api/*) ──→ ステージング DB / キャッシュ
```

| 項目             | 設定内容                                                   |
| ---------------- | ---------------------------------------------------------- |
| **公開 URL**     | `https://ten-api-staging.<account>.workers.dev`            |
| **アクセス制限** | Cloudflare Access（許可されたメンバー・メールのみ閲覧可）  |
| **接続先 API**   | 同一オリジンの `/api/*`（CORS 不要、ステージング DB 接続） |
| **更新契機**     | `main` ブランチへのマージ時に自動デプロイ                  |

※ Web 画面（HTML/JS/CSS/画像）は Workers の静的アセットとして高速配信され、ゲーム API のみ Worker が処理します。存在しない画面パスは `index.html` へフォールバックするため、SPA の直接アクセスや画面遷移も正常に動作します。

## 2. 通常の開発・プレビュー確認の流れ

GitHub 上でコードが `main` ブランチにマージされると、GitHub Actions が自動でビルドとデプロイを実行します。

1. **自動反映**: `main` ブランチに変更がマージされると、ステージング環境が自動更新されます。
2. **プレビュー確認**: ブラウザで公開 URL（`https://ten-api-staging.<account>.workers.dev`）を開き、Cloudflare Access でログインすると最新の画面を確認できます。

手動で再デプロイしたい場合は、GitHub の **Actions → Deploy Staging Worker → Run workflow** から実行できます。

## 3. 初回のみ必要な準備（管理者向け）

プロジェクト立ち上げ時や環境再構築時に一度だけ実施する作業です。

### ステップ 1: Cloudflare Access の有効化（Worker 保護）

1. Cloudflare ダッシュボードの **Workers & Pages** から `ten-api-staging` を選択します。
2. **Access** タブを開き、**Protect this Worker behind Access** を設定します。
3. 対象トラフィックで **All traffic** を選択します。
4. 閲覧を許可するアカウント、組織の IdP、またはメールアドレスを Access ポリシーに登録します。

※ `workers.dev` や将来のカスタムドメインを含む全経路を保護するため、特定ドメインではなく必ず Worker 全体（Worker-level Access: All traffic）に設定してください。本番 Worker（`ten-api-production`）には設定しません。

### ステップ 2: CI 用 Service Token の発行と登録

GitHub Actions によるデプロイ後のヘルスチェック（`/api/health`）を通すための認証トークンを発行・登録します。

1. Cloudflare Zero Trust の **Access → Service credentials** で `ten-staging-ci-healthcheck` を作成します。
2. `ten-api-staging` の Access 設定に、このトークンを許可する **Service Auth** ポリシーを追加します。
3. 発行された Client ID と Client Secret を、[秘密情報の初回設定・管理手順](./secrets.md) に従って `secrets/secrets.staging.age.env` に登録します。

| 項目名                 | 内容                                          | 備考                  |
| ---------------------- | --------------------------------------------- | --------------------- |
| `ACCESS_CLIENT_ID`     | staging ヘルスチェック用 Access Client ID     | CI ヘルスチェック専用 |
| `ACCESS_CLIENT_SECRET` | staging ヘルスチェック用 Access Client Secret | 上記トークンの Secret |

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

モバイルアプリ実機からステージング Worker に接続してテストする場合は、検証端末に **Cloudflare One Client (WARP)** を導入し、Access の **Authenticate with Cloudflare One Client** で認証します。

※ Access Service Token をアプリ本体（APK / IPA）に埋め込んではいけません。WARP を使わないモバイル staging 検証が必要になった場合は、利用者向けの短命トークン認証を別途設計します。

## 6. 動作確認とトラブルシューティング

### 動作確認の手順

1. ブラウザでステージング公開 URL にアクセスします。
2. Cloudflare Access の認証画面が表示されたら、許可されたメールアドレス等でログインします。
3. ゲームプレイ、デイリー盤面取得、ランキング送信が正常に行えるか確認します。

### よくあるトラブルと対処法

- **Access のログイン画面が出ない / 認証なしでアクセスできてしまう**: `ten-api-staging` の Access タブで Worker-level Access（All traffic）が有効になっているか確認してください。
- **CI のヘルスチェックが失敗する**: Service Token の有効期限、Access 側の Service Auth ポリシー、`secrets.staging.age.env` の認証情報、`TEN_API_URL` の設定を確認してください。
- **Web 画面が表示されない / API 通信エラー**: `TEN_API_URL` の末尾に余計なスラッシュ `/` が付いていないか、ステージング D1 / KV のマイグレーションが正しく適用されているか確認してください。
- **モバイル staging が接続できない**: 端末の Cloudflare One Client (WARP) のログイン状態と Access の端末認証設定を確認してください。
