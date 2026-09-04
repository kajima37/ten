# TEN. 初回セットアップガイド

TEN. をはじめてセットアップする際の手順です。**`pnpm setup` ウィザード**を使うと、ブラウザでの OAuth App 作成を除くすべての初期設定を自動で完了できます。

## 前提条件

TEN. には Node.js 26、pnpm 11、age、sops、gh CLI が必要です。環境管理ツールで自動セットアップできます。

```bash
# Linux / macOS (direnv)
direnv allow

# Windows / クロスプラットフォーム (mise)
mise install

# パッケージのインストール
pnpm install

# GitHub CLI の認証 (必須)
gh auth login
```

他に Cloudflare アカウントと API トークンが必要です（ステップで入力します）。

## 自動セットアップ (推奨)

以下のコマンドで対話式のセットアップが開始します。

```bash
pnpm setup
```

ウィザードは次の 10 ステップを順に進めます。ブラウザでの OAuth App 作成（ステップ 6）を除き、各ステップはツール内で完結します。

| #   | ステップ       | 内容                                           | ツール内で完結  |
| --- | -------------- | ---------------------------------------------- | --------------- |
| 1   | `tools`        | 必要ツールと gh 認証を確認                     | ✅              |
| 2   | `keys`         | age 秘密鍵の生成と `.sops.yaml` の更新         | ✅              |
| 3   | `secrets`      | シークレットの対話入力と SOPS による暗号化保存 | ✅              |
| 4   | `cloudflare`   | D1 / KV の作成と `wrangler.jsonc` の更新       | ✅              |
| 5   | `local`        | ローカル Worker 環境 (`.dev.vars`) の作成      | ✅              |
| 6   | `github`       | GitHub Environments と Pages の設定            | ✅              |
| 7   | `admin`        | D1 マイグレーションと初回管理者登録            | ✅              |
| 8   | `deploy`       | git push とステージングのヘルスチェック        | ✅              |
| 9   | `release`      | リリース用 (Android / iOS) シークレットの登録  | ✅              |
| 10  | `instructions` | 残りの手動手順 (OAuth Apps) を表示             | ⚠️ ブラウザ必須 |

シークレットの暗号化 (SOPS) や Cloudflare / GitHub の設定は、すべてウィザード内で自動実行されます。**ユーザーが `sops` や `wrangler` を直接叩く必要はありません。**

### オプション

```bash
pnpm setup -- --help            # 使用法を表示
pnpm setup -- --dry-run         # 実際の変更を行わずに確認
pnpm setup -- --only <step>     # 指定ステップのみ実行
pnpm setup -- --non-interactive # 非対話モード (CI/エージェント向け)
```

### 進捗管理

ウィザードは完了ステップを `.setup-state.json` (Git 管理外) に記録します。中断した場合は `pnpm setup` を再実行すると、完了済みステップをスキップします。

---

## ステップ 6 の詳細: OAuth Apps の作成 (唯一の手動操作)

OAuth App の作成だけは、GitHub / Google のブラウザ操作が必須のため自動化できません。

### Staging (プレビュー + 管理画面)

- **GitHub**: Settings > Developer settings > OAuth Apps > New OAuth App
- コールバック URL:
  ```
  https://ten-api-staging.<account>.workers.dev/auth/callback/github
  https://ten-admin-staging.<account>.workers.dev/auth/callback/github
  ```
- **Google** (任意): Google Cloud Console > APIs & Services > Credentials
  - リダイレクト URI:
  ```
  https://ten-api-staging.<account>.workers.dev/auth/callback/google
  https://ten-admin-staging.<account>.workers.dev/auth/callback/google
  ```

### Production (staging とは別の App)

- コールバック URL:
  ```
  https://ten-admin-production.<account>.workers.dev/auth/callback/github
  https://ten-admin-production.<account>.workers.dev/auth/callback/google
  ```

### Client ID / Secret の登録

作成した OAuth App の Client ID / Secret は、**セットアップを再実行して登録**します（sops を直接操作する必要はありません）。

```bash
pnpm setup --only secrets
```

既存の値は保持され、未設定の OAuth キー（`GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`）のみ対話入力して暗号化保存します。

---

## ステップ 9 の詳細: リリース用シークレットの登録

ストア提出用の署名鍵やサービスアカウント情報（keystore、Google Play service account JSON、Apple 配布証明書、App Store Connect キー）を登録します。これもステップ 3 と同様にウィザード内で完結し、sops を直接操作する必要はありません。

```bash
pnpm setup --only release
```

- **keystore / JSON / 証明書などファイル系の値は、ファイルパスを入力するだけで自動で Base64 変換**して暗号化保存します（手動で `base64` を叩く必要はありません）。
- App Store Connect の `.p8` 秘密鍵はファイルパスを入力するとその内容をそのまま登録します。
- パスワード類はマスク入力、Team ID 等はテキスト入力です。

登録対象のキー一覧は [シークレット管理](./secrets.md) を参照してください。

---

## 自動セットアップが実行する内容

参考情報として、`pnpm setup` が各ステップで内部実行する作業を記載します。手動で行う場合は後述の「手動セットアップ」を参照してください。

### 1. ツール確認

`node`, `pnpm`, `age`, `sops`, `wrangler`, `gh` の存在と gh 認証状態を確認します。不足があれば案内を表示します。

### 2. 暗号鍵の生成

`secrets/.private/` に staging / production 用の age 鍵ペアを生成し、`secrets/.sops.yaml` の公開鍵を更新します。暗号化の仕組みは [シークレット管理](./secrets.md) を参照してください。

### 3. シークレットの登録

各シークレットを対話入力し、SOPS で暗号化して `secrets/*.age.env` に保存します。自動生成可能な鍵（`AUTH_SECRET` など）は自動生成します。登録キーの一覧は [シークレット管理](./secrets.md) を参照してください。

### 4. Cloudflare リソースの作成

D1 データベースと KV 名前空間を作成し、`apps/worker/wrangler.jsonc` と `apps/admin/wrangler.jsonc` の ID を更新します。詳細は [Cloudflare Worker](./cloudflare-worker.md) を参照してください。

### 5. ローカル Worker 環境

`apps/worker/.dev.vars` を作成します。

### 6. GitHub Environments の設定

`gh` CLI で staging / production / release 環境を作成し、`SOPS_AGE_KEY` シークレットと `TEN_API_URL` 等の変数を設定し、GitHub Pages を有効化します。詳細は本ページの「ステップ 6 の詳細」と [管理画面](./admin.md) を参照してください。

### 7. 管理者の登録

D1 マイグレーションを適用し、現在の gh ユーザーを初回管理者として登録します。詳細は [管理画面](./admin.md) を参照してください。

### 8. ステージングへのデプロイ

`git push origin main` で CI を起動し、ステージングのヘルスチェックが通るまで待機して確認します。

### 9. リリース用シークレットの登録

Android / iOS のストア提出用シークレットを `secrets.android-release.age.env` と `secrets.ios-release.age.env` に保存します。ファイル系の値はファイルパス入力から自動で Base64 変換します。詳細は本ページの「ステップ 9 の詳細」を参照してください。

---

## 手動セットアップ (任意)

自動セットアップを使わず、各ステップを個別コマンドで実行する場合の手順です。自動セットアップが内部で行う作業と同じ内容です。

### Step 1: ツールの準備

自動セットアップの「前提条件」と同じです。

### Step 2: 暗号鍵の生成 (age)

```bash
mkdir -p secrets/.private
age-keygen -o secrets/.private/staging.agekey
age-keygen -o secrets/.private/production.agekey
```

各ファイルの公開鍵 (`public key: age1...`) を `secrets/.sops.yaml` に設定します。暗号化の仕組みは [シークレット管理](./secrets.md) を参照してください。

### Step 3: シークレットの登録

**推奨**: `sops` を直接使う前に、`pnpm setup --only secrets` で対話登録してください。手動で編集する場合のみ:

```bash
export SOPS_AGE_KEY="$(cat secrets/.private/staging.agekey)"
sops secrets/secrets.staging.age.env
```

登録キーの一覧と詳細は [シークレット管理](./secrets.md) を参照してください。

### Step 4: Cloudflare リソースの作成

```bash
pnpm --filter @ten/worker exec wrangler login
pnpm --filter @ten/worker exec wrangler d1 create ten-db-staging
pnpm --filter @ten/worker exec wrangler d1 create ten-db-production
pnpm --filter @ten/worker exec wrangler kv namespace create DAILY_CACHE_STAGING
pnpm --filter @ten/worker exec wrangler kv namespace create DAILY_CACHE_PRODUCTION
```

出力された ID を `apps/worker/wrangler.jsonc` と `apps/admin/wrangler.jsonc` に設定します。詳細は [Cloudflare Worker](./cloudflare-worker.md) を参照してください。

### Step 5: GitHub Environments の設定

```bash
gh secret set SOPS_AGE_KEY --env staging --body "$(cat secrets/.private/staging.agekey)"
gh variable set TEN_API_URL --env staging --body "https://ten-api-staging.<account>.workers.dev"
gh variable set TEN_ADMIN_URL --env staging --body "https://ten-admin-staging.<account>.workers.dev"

gh secret set SOPS_AGE_KEY --env production --body "$(cat secrets/.private/production.agekey)"
gh variable set TEN_API_URL --env production --body "https://ten-api-production.<account>.workers.dev"
gh variable set TEN_ADMIN_URL --env production --body "https://ten-admin-production.<account>.workers.dev"

gh secret set SOPS_AGE_KEY --env release --body "$(cat secrets/.private/production.agekey)"
gh variable set TEN_API_URL --env release --body "https://ten-api-production.<account>.workers.dev"
gh variable set ADMOB_APP_ID --env release --body "<your AdMob App ID>"

gh api repos/{owner}/{repo}/pages -X POST -f build_type=workflow
```

### Step 6: 管理者の登録

```bash
pnpm --filter @ten/worker exec wrangler d1 migrations apply ten-db-production --remote --env production

pnpm --filter @ten/admin exec wrangler d1 execute ten-db-production \
  --remote --env production \
  --command "INSERT INTO admin_identities \
    (provider, subject, approved_at, approved_by) \
    VALUES \
    ('github', '<your-github-user-id>', \
     strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), \
     'initial-bootstrap');"
```

`<your-github-user-id>` は GitHub の数値ユーザー ID に置き換えてください (`https://api.github.com/users/<username>` で確認可能)。

---

## 環境一覧

| 環境       | Worker               | データベース        | 用途                 |
| ---------- | -------------------- | ------------------- | -------------------- |
| staging    | `ten-api-staging`    | `ten-db-staging`    | プレビュー、開発検証 |
| production | `ten-api-production` | `ten-db-production` | ストア公開アプリ     |

## トラブルシューティング

- **`Failed to get the data key`**: SOPS の age 鍵が暗号化ファイルと一致していません。staging 鍵と本番系鍵を取り違えていないか確認してください。
- **`sops: command not found`**: `direnv allow` または `mise install` を実行してください。
- **`wrangler: command not found`**: `pnpm install` を実行してください。
- **`gh: command not found`**: https://cli.github.com/ からインストールしてください。
- **`gh auth status` がエラー**: `gh auth login` を実行して認証してください。
- **Wrangler ログインに失敗する**: `CLOUDFLARE_API_TOKEN` が設定されているか、`wrangler login` でブラウザ認証を行ってください。
- **D1 マイグレーションエラー**: `wrangler.jsonc` のデータベース ID が作成したデータベースと一致しているか確認してください。

詳細は各ドキュメントを参照してください:

- [シークレット管理](./secrets.md) - 暗号化、鍵ローテーション
- [Cloudflare Worker](./cloudflare-worker.md) - Worker 運用、トラブルシューティング
- [管理画面](./admin.md) - 管理者アクセス、プレイヤー管理
- [ステージングプレビュー](./cloudflare-worker-preview.md) - プレビュー公開
- [モバイル公開](./mobile.md) - ストア提出
