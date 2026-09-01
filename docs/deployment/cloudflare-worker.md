# Cloudflare Worker の公開

このページは、TEN. のオンライン機能を公開するための手順です。
Cloudflare Worker が、デイリー盤面、ランキング、プレイヤー名、スコアの検証を担当します。

## 先に確認すること

- Cloudflare アカウントがあること
- このリポジトリを実行できるパソコンがあること
- Node.js と pnpm をセットアップ済みであること
- staging 用と production 用に、それぞれ2つの秘密の文字列を用意していること

準備が済んでいない場合は、リポジトリのルートで次を実行します。

```bash
pnpm install
```

## 環境の構成

`main` は開発用、`production` は本番昇格用です。GitHub Pages は staging Worker を使い、公開済みアプリは production Worker を使います。

| 環境       | Worker            | D1               | KV            | デプロイ元   |
| ---------- | ----------------- | ---------------- | ------------- | ------------ |
| staging    | `ten-api-staging` | `ten-db-staging` | staging 用    | `main`       |
| production | `ten-api`         | `ten-db`         | production 用 | `production` |

staging と production は Worker、D1、KV、`AUTH_SECRET`、`ADMIN_SECRET` を共有しません。

## Worker の構成

| 部品   | 役割                                               |
| ------ | -------------------------------------------------- |
| Worker | APIを実行するサーバー                              |
| D1     | プレイヤー、スコア、検証記録を保存するデータベース |
| KV     | 当日の盤面を一時保存するキャッシュ                 |

設定ファイルは `apps/worker/wrangler.jsonc` です。公開前に、staging と production それぞれの Cloudflare リソース ID を設定します。

- staging D1 の `database_id` と KV の `id`
- production D1 の `database_id` と KV の `id`

## 初回設定

以下は管理者が最初に一度だけ行う手順です。GitHub Actions の実行ごとに Cloudflare へログインする必要はありません。

作業後に `apps/worker/wrangler.jsonc` のプレースホルダー ID が残っていないことを確認してください。

### 1. Cloudflareへログインする

リポジトリのルートで次を実行し、ブラウザの案内に従います。

```bash
pnpm --filter @ten/worker exec wrangler login
```

### 2. staging と production の D1 を作成する

```bash
pnpm --filter @ten/worker exec wrangler d1 create ten-db-staging
pnpm --filter @ten/worker exec wrangler d1 create ten-db
```

表示された ID を `apps/worker/wrangler.jsonc` の `env.staging` と `env.production` の D1 設定へ、それぞれ設定します。

### 3. staging と production の KV namespace を作成する

```bash
pnpm --filter @ten/worker exec wrangler kv namespace create DAILY_CACHE
pnpm --filter @ten/worker exec wrangler kv namespace create DAILY_CACHE
```

1回目の ID を staging、2回目の ID を production の `kv_namespaces[0].id` に設定します。同じ ID を設定しないでください。

### 4. Worker の秘密情報を登録する

秘密情報はリポジトリや `wrangler.jsonc` に書かず、Cloudflareへ登録します。2つは別々の長いランダム文字列にしてください。

```bash
pnpm --filter @ten/worker exec wrangler secret put AUTH_SECRET --env staging
pnpm --filter @ten/worker exec wrangler secret put ADMIN_SECRET --env staging
pnpm --filter @ten/worker exec wrangler secret put AUTH_SECRET --env production
pnpm --filter @ten/worker exec wrangler secret put ADMIN_SECRET --env production
```

入力した文字列は表示されません。`ADMIN_SECRET` は管理APIを操作できる鍵です。関係者以外に共有しないでください。

### 5. staging データベースへテーブルを作成する

```bash
pnpm --filter @ten/worker db:migrate:staging
```

マイグレーションは番号順に適用されます。適用済みのSQLファイルは編集せず、新しい変更は新しい番号のファイルとして追加します。

### 6. production データベースへテーブルを作成する

production の migration は通常 GitHub Actions から実行します。初回確認や復旧時に手元から実行する場合は、対象を明示した script を使います。

```bash
pnpm --filter @ten/worker db:migrate:production
```

## 公開する

設定と秘密情報を確認したら、次を実行します。

```bash
pnpm --filter @ten/worker deploy:staging
```

production を手元から公開する場合は、必ず次を使います。

```bash
pnpm --filter @ten/worker deploy:production
```

staging は `https://ten-api-staging.<account>.workers.dev`、production は `https://ten-api.<account>.workers.dev` のような URL になります。末尾に `/` は付けません。

## 公開後の確認

表示されたURLを `API_URL` に置き、次を実行します。

```bash
API_URL="https://ten-api.<account>.workers.dev"
curl "$API_URL/api/health"
```

次のような結果ならWorkerは動作しています。

```json
{ "status": "ok" }
```

続けて、デイリー盤面も確認します。

```bash
curl "$API_URL/api/daily"
```

`dateKey` と25個の数字からなる `board` が返れば、基本設定は完了です。

## Web版・モバイル版と接続する

Webアプリはビルド時の `VITE_API_URL` を使ってWorkerへ接続します。次の値には、公開したWorkerのURLを設定します。

```text
TEN_API_URL=https://ten-api-staging.<account>.workers.dev
```

- GitHub Pages: `staging` Environment の Variable に登録
- モバイル開発ビルド: staging URL を指定
- モバイルリリースビルド: production URL を指定

接続先を変更したら、Web版またはモバイル版をもう一度ビルドしてください。公開済みのWebページやアプリは自動では変更されません。

## GitHub Actionsで自動公開する

GitHub の `Settings → Environments` で、`staging` と `production-worker` を作成します。`production-worker` には必須 reviewer を設定し、許可する branch を `production` に限定します。

`staging` Environment には `main`、`production-worker` Environment には `production` を deployment branch として設定します。Pages の `github-pages` Environment は既存の設定を使います。

| 名前                    | 種類     | 内容                                     |
| ----------------------- | -------- | ---------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Secret   | Workerを公開できるCloudflare APIトークン |
| `CLOUDFLARE_ACCOUNT_ID` | Secret   | CloudflareのアカウントID                 |
| `TEN_API_URL`           | Variable | その環境の Worker URL（末尾 `/` なし）   |

Cloudflare APIトークンには、対象アカウントのWorkersデプロイ権限とD1マイグレーションに必要な権限を付けます。

`main` ブランチへ Worker 関連の変更を反映すると、`.github/workflows/deploy-worker.yml` が staging に対して次を自動実行します。

1. staging D1へマイグレーションを適用
2. staging Workerを公開

`production` ブランチへ Worker 関連の変更を反映すると、`.github/workflows/deploy-worker-production.yml` が production に対して同じ処理を実行します。production Environment の承認後に実行されます。

GitHub Actions には各 Environment の secrets として、次を登録します。

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

staging と production で API Token を分け、対象 Worker と D1 に必要な最小権限だけを付与します。

staging の `TEN_API_URL` は `https://ten-api-staging.<account>.workers.dev`、production-worker の `TEN_API_URL` は `https://ten-api.<account>.workers.dev` です。これは公開情報なので Secret にはしません。

手動実行時も、staging は `Deploy Worker`、production は `Deploy Production Worker` を選び、実行 ref を確認します。

### production ブランチの初回設定

GitHub 上で `production` ブランチを作成し、branch protection を設定します。

- PR 必須
- `validate` CI check 必須
- reviewer 必須
- force-push 禁止
- ブランチ削除禁止

通常は `main` から `production` への PR をレビューして merge します。production への push が本番 Worker のデプロイ開始になります。

### 初回設定の確認

1. `main` に Worker の変更を push し、`Deploy Worker` が staging に成功する
2. staging URL の `/api/health` と `/api/daily` が応答する
3. GitHub Pages が staging URL を使って表示される
4. `main` から `production` への PR を作成する
5. CI 成功後に PR を merge する
6. `Deploy Production Worker` が承認待ちになり、承認後に production へ成功する
7. production URL の `/api/health` と `/api/daily` が応答する

staging で作成したプレイヤーやスコアが production に存在しないことも確認します。

## 管理API

不正なプレイヤーの調査やスコア削除には、`ADMIN_SECRET` をBearerトークンとして使います。管理画面はありません。

```bash
ADMIN_SECRET='本番のADMIN_SECRET'
API_URL='https://ten-api.<account>.workers.dev'

curl "$API_URL/api/admin/players?ipHash=<ip_hash>" \
  -H "Authorization: Bearer $ADMIN_SECRET"

curl -X POST "$API_URL/api/admin/players/<player_id>/ban" \
  -H "Authorization: Bearer $ADMIN_SECRET"

curl -X DELETE "$API_URL/api/admin/players/<player_id>/scores?date=YYYY-MM-DD" \
  -H "Authorization: Bearer $ADMIN_SECRET"
```

`ADMIN_SECRET` をコマンド履歴やチャットへ残さないでください。IPハッシュは生のIPアドレスではなく、`AUTH_SECRET` を使ったハッシュ値です。

## 困ったとき

- `wrangler login` が失敗する: Cloudflareのアカウントと対象アカウントを確認する
- D1マイグレーションが失敗する: `database_id` とCloudflareアカウントを確認する
- KV関連で失敗する: KVの本番 `id` を設定したか確認する
- WebからAPIに接続できない: `TEN_API_URL` に末尾 `/` がないか、Workerの許可オリジンに公開先が含まれるか確認する
- `401` が返る: プレイヤートークンの期限切れや、別環境のAPI URLを確認する
- `403` が返る: プレイヤーがBANされていないか、管理APIの鍵が正しいか確認する

Workerのログは次で確認できます。

```bash
pnpm --filter @ten/worker exec wrangler tail ten-api
```

本番DBのデータを直接削除したり、`AUTH_SECRET` を変更したりする前に影響を確認してください。`AUTH_SECRET` を変更すると既存のログイン用トークンが使えなくなります。
