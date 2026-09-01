# Cloudflare Worker の公開と運用

TEN. のオンライン機能（デイリーパズル配信、ランキング集計、スコアの不正検証など）は **Cloudflare Worker** で動作しています。

## 1. 全体の構成

TEN. では安全な運用のために **ステージング（開発検証用）** と **本番（リリースアプリ用）** を完全に分離しています。

```
[関係者限定 Web プレビュー]  ──→  ステージング Worker (`ten-api-staging`)  ──→  ステージング DB / キャッシュ
[ストア配信アプリ (本番)]   ──→  本番 Worker (`ten-api-production`)       ──→  本番 DB / キャッシュ
```

| 環境           | Worker 名            | 対象ブランチ | 用途                                        |
| -------------- | -------------------- | ------------ | ------------------------------------------- |
| **staging**    | `ten-api-staging`    | `main`       | 関係者限定 Web プレビュー、開発中の動作確認 |
| **production** | `ten-api-production` | `production` | ストアに公開された正式アプリからの接続      |

※ データベース（D1）や暗号鍵も環境ごとに独立しており、開発中のテストデータが本番ランキングに混ざることはありません。

## 2. 通常の開発・公開の流れ

GitHub 上でコードをマージすると、GitHub Actions が自動でデータベース更新とデプロイを実行します。日常的な手動デプロイ作業は不要です。

1. **開発中の反映**: `main` ブランチにプッシュすると、ステージング環境が自動更新されます。
2. **本番への反映**: `main` から `production` ブランチへ Pull Request を作成・マージすると、本番環境のデプロイが開始されます（管理者の承認後に実行）。

## 3. 初回のみ必要な準備（管理者向け）

プロジェクト立ち上げ時に一度だけ実施する作業です。

### 必要な前提

- Cloudflare アカウント
- リポジトリの手元環境（`pnpm install` 済み）

### 手順

```bash
# 1. Cloudflare へログイン
pnpm --filter @ten/worker exec wrangler login

# 2. データベース (D1) の作成
pnpm --filter @ten/worker exec wrangler d1 create ten-db-staging
pnpm --filter @ten/worker exec wrangler d1 create ten-db-production
# ※ 表示された database_id を apps/worker/wrangler.jsonc に記入

# 3. キャッシュ用ストレージ (KV) の作成
pnpm --filter @ten/worker exec wrangler kv namespace create DAILY_CACHE_STAGING
pnpm --filter @ten/worker exec wrangler kv namespace create DAILY_CACHE_PRODUCTION
# ※ 表示された id を apps/worker/wrangler.jsonc に記入

```

秘密情報の設定は、[秘密情報の初回設定・管理手順](./secrets.md) を参照してください。

## 4. 動作確認の方法

公開された Worker が正常に応答しているかは、ブラウザや `curl` コマンドで簡単に確認できます。

```bash
# ヘルスチェック (status: ok が返れば正常)
curl "https://ten-api-production.<account>.workers.dev/api/health"

# 今日のデイリー盤面取得
curl "https://ten-api-production.<account>.workers.dev/api/daily"
```

## 5. 管理・トラブルシューティング

### リアルタイムログの確認

Worker の実行ログは次のコマンドでリアルタイムに確認できます。

```bash
pnpm --filter @ten/worker exec wrangler tail ten-api-production
```

### 不正スコアと利用停止の管理

管理 API は `ADMIN_SECRET` を Bearer トークンとして要求します。トークンをシェル履歴やファイルへ直接書かず、実行時に環境変数として渡してください。実行前に対象プレイヤー ID と対象日を記録し、操作後はログとランキングを確認します。

```bash
# プレイヤーを無期限に利用停止する
curl --fail -X POST "$TEN_API_URL/api/admin/players/$PLAYER_ID/ban" \
  -H "Authorization: Bearer $ADMIN_SECRET"

# 誤った日次記録だけを削除する。date を省略すると全記録を削除するため注意する
curl --fail -X DELETE "$TEN_API_URL/api/admin/players/$PLAYER_ID/scores?date=YYYY-MM-DD" \
  -H "Authorization: Bearer $ADMIN_SECRET"

# 同一ネットワークに紐づくアカウントを利用停止する。誤検知の影響が大きいため最後の手段とする
curl --fail -X POST "$TEN_API_URL/api/admin/ip/$IP_HASH/ban" \
  -H "Authorization: Bearer $ADMIN_SECRET"
```

`IP_HASH` は平文 IP アドレスではなく、Worker のログや管理調査で得たハッシュ値です。利用停止は後から `POST /api/admin/players/:id/unban` で解除できます。誤操作時はまず解除し、必要ならスコアを再確認してください。

### よくあるトラブル

- **Web やアプリから接続できない**: Worker の URL 末尾に余計なスラッシュ `/` が付いていないか確認してください。
- **データベースエラーが出る**: D1 のテーブル作成（マイグレーション）が正しく適用されているか確認してください。
- **認証エラー (401 / 403)**: アプリ側のトークン有効期限が切れているか、ステージングと本番で接続先が食い違っていないか確認してください。
