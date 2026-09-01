# Cloudflare Worker の公開

このページは、TEN. のオンライン機能を公開するための手順です。
Cloudflare Worker が、デイリー盤面、ランキング、プレイヤー名、スコアの検証を担当します。

## 先に確認すること

- Cloudflare アカウントがあること
- このリポジトリを実行できるパソコンがあること
- Node.js と pnpm をセットアップ済みであること
- 本番用の秘密の文字列を2つ用意していること

準備が済んでいない場合は、リポジトリのルートで次を実行します。

```bash
pnpm install
```

## Worker の構成

| 部品   | 役割                                               |
| ------ | -------------------------------------------------- |
| Worker | APIを実行するサーバー                              |
| D1     | プレイヤー、スコア、検証記録を保存するデータベース |
| KV     | 当日の盤面を一時保存するキャッシュ                 |

設定ファイルは `apps/worker/wrangler.jsonc` です。公開前に、ファイル内の次のIDを自分のCloudflareリソースのIDへ置き換えます。

- D1の `database_id`
- KVの `id`

## 初回設定

### 1. Cloudflareへログインする

リポジトリのルートで次を実行し、ブラウザの案内に従います。

```bash
pnpm --filter @ten/worker exec wrangler login
```

### 2. D1データベースを作成する

```bash
pnpm --filter @ten/worker exec wrangler d1 create ten-db
```

表示された `database_id` を `apps/worker/wrangler.jsonc` の `d1_databases[0].database_id` に設定します。`database_name` は `ten-db` のままにします。

### 3. KVネームスペースを作成する

```bash
pnpm --filter @ten/worker exec wrangler kv namespace create DAILY_CACHE
```

表示された本番用の `id` を、`wrangler.jsonc` の `kv_namespaces[0].id` に設定します。`preview_id` は本番公開には使いません。

### 4. 本番用の秘密情報を登録する

秘密情報はリポジトリや `wrangler.jsonc` に書かず、Cloudflareへ登録します。2つは別々の長いランダム文字列にしてください。

```bash
pnpm --filter @ten/worker exec wrangler secret put AUTH_SECRET
pnpm --filter @ten/worker exec wrangler secret put ADMIN_SECRET
```

入力した文字列は表示されません。`ADMIN_SECRET` は管理APIを操作できる鍵です。関係者以外に共有しないでください。

### 5. 本番データベースへテーブルを作成する

```bash
pnpm --filter @ten/worker db:migrate:remote
```

マイグレーションは番号順に適用されます。適用済みのSQLファイルは編集せず、新しい変更は新しい番号のファイルとして追加します。

## 公開する

設定と秘密情報を確認したら、次を実行します。

```bash
pnpm --filter @ten/worker deploy
```

成功すると `https://ten-api.<account>.workers.dev` のようなURLが表示されます。このURLを控えておきます。接続先として使うとき、末尾に `/` は付けません。

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
TEN_API_URL=https://ten-api.<account>.workers.dev
```

- GitHub Pages: GitHubの `Settings → Secrets and variables → Actions → Variables` に登録
- Android / iOS: GitHub Actionsの `TEN_API_URL` またはローカルの `VITE_API_URL` を指定

接続先を変更したら、Web版またはモバイル版をもう一度ビルドしてください。公開済みのWebページやアプリは自動では変更されません。

## GitHub Actionsで自動公開する

GitHubリポジトリの `Settings → Secrets and variables → Actions` に次を登録します。

| 名前                    | 種類     | 内容                                     |
| ----------------------- | -------- | ---------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Secret   | Workerを公開できるCloudflare APIトークン |
| `CLOUDFLARE_ACCOUNT_ID` | Secret   | CloudflareのアカウントID                 |
| `TEN_API_URL`           | Variable | 公開したWorkerのURL（末尾 `/` なし）     |

Cloudflare APIトークンには、対象アカウントのWorkersデプロイ権限とD1マイグレーションに必要な権限を付けます。

`main` ブランチへ `apps/worker/**` の変更を反映すると、`.github/workflows/deploy-worker.yml` が次を自動実行します。

1. 本番D1へマイグレーションを適用
2. Workerを公開

手動で実行する場合は、GitHubの `Actions → Deploy Worker → Run workflow` を選びます。

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
