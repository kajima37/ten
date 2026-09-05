# 秘密情報の初回設定・管理手順（SOPS + age）

TEN. では、アプリの署名鍵や Cloudflare の API トークンなどの機密情報を、**暗号化されたファイルとして Git リポジトリ内で安全に一元管理**しています。

`pnpm setup` を実行すると、鍵生成とシークレット登録を対話式に進められます。手順の詳細は [初回セットアップガイド](./setup.md) を参照してください。この文書では、暗号化の仕組みと運用時の管理手順を説明します。

## 1. 秘密情報管理の全体像

暗号化ファイルは Git リポジトリに直接保存（コミット）されますが、**対応する復号鍵（age 秘密鍵）を持つ人や GitHub Actions だけが中身を読める**ため安全です。

```
[開発者 / CI] ──(age秘密鍵)──→ [暗号化ファイル (secrets/*.age.env)] ──→ [平文の設定値]
```

### ファイルと復号鍵の対応表

| ファイル名                                | 役割                                       | 復号に必要な鍵 |
| ----------------------------------------- | ------------------------------------------ | -------------- |
| `secrets/secrets.staging.age.env`         | ステージング用 Worker のデプロイ・認証設定 | **staging 鍵** |
| `secrets/secrets.production.age.env`      | 本番用 Worker のデプロイ・認証設定         | **本番系鍵**   |
| `secrets/secrets.android-release.age.env` | Android アプリ署名・Google Play 提出用     | **本番系鍵**   |
| `secrets/secrets.ios-release.age.env`     | iOS アプリ署名・TestFlight 提出用          | **本番系鍵**   |

※ AdMob の App ID や Worker 接続先 URL は公開されても安全な情報のため、暗号化ファイルではなく GitHub の Environment Variables（通常環境変数）として設定します。

## 2. 【初回作業】ツールの準備と復号鍵の生成

### ステップ 1: 暗号化ツール（SOPS / age）の用意

リポジトリ直下で開発環境を有効化すると、必要なツール（`age`, `sops`）が自動で使えるようになります。

```bash
# Linux / macOS (direnv を利用している場合)
direnv allow

# Windows または mise を利用している場合
mise install
```

### ステップ 2: 復号鍵（age key）の確認または新規生成

ローカルの `secrets/.private/` に鍵ファイル（`staging.agekey` / `production.agekey`）が存在するか確認します。

- **既存の鍵がある場合**: その鍵を安全なパスワードマネージャー（1Password、Bitwarden など）にバックアップします。
- **新規に生成し直す場合**:

```bash
# 鍵を保存するフォルダを作成
mkdir -p secrets/.private

# staging 用と本番用の2つの鍵を生成
age-keygen -o secrets/.private/staging.agekey
age-keygen -o secrets/.private/production.agekey
```

生成されたファイルを開くと、次のように公開鍵（`public key: age1...`）と秘密鍵（`AGE-SECRET-KEY-1...`）が記載されています。

```text
# public key: age1zzkrk3dhmm3m6ygpvmv68dvn09jutlzdpp86v40zdepyuvqz2dqs0rr4h8
AGE-SECRET-KEY-1...
```

新規生成した場合は、`secrets/.sops.yaml` の公開鍵（`age: age1...`）を新しい公開鍵に書き換えてください。

## 3. 【初回作業】秘密情報の登録と暗号化

**初回登録は、セットアップツールで行うのが推奨です。**

- ステージング / 本番の通常シークレット: `pnpm setup --only secrets`
- Android / iOS のストア提出用シークレット: `pnpm setup --only release`

ファイル系（keystore、service account JSON、証明書）はファイルパスを入力するだけで自動で Base64 変換して暗号化保存します。手動で `base64` や `export SOPS_AGE_KEY` を操作する必要はありません。手順は [初回セットアップガイド](./setup.md) を参照してください。

以下は、既存値を編集・確認する場合など、`sops` コマンドを直接使う運用方法です。`sops` コマンドを使うと、ファイルを自動的に復号してエディタが開き、**保存時に自動で再暗号化**されます。

### 1. ステージング環境の設定 (`secrets.staging.age.env`)

```bash
# staging 鍵を環境変数にセットして編集
export SOPS_AGE_KEY="$(cat secrets/.private/staging.agekey)"
sops secrets/secrets.staging.age.env
```

開いたエディタで `<set-me>` の箇所を実際の値に書き換えて保存します。

| 項目名                       | 内容                                     | 取得方法・備考                                                               |
| ---------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`       | Cloudflare の API トークン               | Cloudflare ダッシュボードで「Workers デプロイ」「D1 編集」権限を付与して作成 |
| `CLOUDFLARE_ACCOUNT_ID`      | Cloudflare アカウント ID                 | Cloudflare ダッシュボードの Workers 概要画面で確認                           |
| `AUTH_SECRET`                | ユーザー認証トークンの署名用シークレット | ランダムな長い文字列（例: `openssl rand -hex 32`）                           |
| `ADMIN_SESSION_SECRET`       | 管理画面セッションの署名鍵               | ランダムな長い文字列（例: `openssl rand -hex 32`）。必須                     |
| `PREVIEW_SESSION_SECRET`     | プレビューセッションの署名鍵             | ランダムな長い文字列（例: `openssl rand -hex 32`）。必須                     |
| `GOOGLE_OAUTH_CLIENT_ID`     | Google OAuth Client ID                   | 任意。Google Cloud Console で作成した Web application の Client ID           |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth Client Secret               | 任意。上記 Client ID とセットで登録する。アプリへ含めない                    |
| `GITHUB_OAUTH_CLIENT_ID`     | GitHub OAuth App Client ID               | GitHub の OAuth App 設定で作成した Client ID。必須                           |
| `GITHUB_OAUTH_CLIENT_SECRET` | GitHub OAuth App Client Secret           | 上記 OAuth App の Client Secret。必須。アプリへ含めない                      |

※ かつて管理 API 用に使われていた `ADMIN_SECRET` は廃止しました。ファイルに残っていても無視されます。

### 2. 本番環境の設定 (`secrets.production.age.env`)

```bash
# 本番系鍵を環境変数にセットして編集
export SOPS_AGE_KEY="$(cat secrets/.private/production.agekey)"
sops secrets/secrets.production.age.env
```

staging と同様に、本番専用の Cloudflare API トークンと `AUTH_SECRET` を登録します（※ staging と同じシークレットを使い回さないでください）。加えて、管理画面（production）のために `ADMIN_SESSION_SECRET` と、**staging とは別に作成した** production 専用 OAuth App の Client 情報（`GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET`、必要なら Google のペア）を登録します。OAuth App は環境ごとに分離し、staging の Client ID / Secret を使い回さないでください。詳細は [管理画面の公開と運用](./admin.md) を参照してください。

### 3. Android リリース設定 (`secrets.android-release.age.env`)

```bash
sops secrets/secrets.android-release.age.env
```

| 項目名                                    | 内容                                      | 形式・備考                                                |
| ----------------------------------------- | ----------------------------------------- | --------------------------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`                 | 署名用キーストアファイル (`.keystore`)    | `base64 -w 0 your.keystore` で 1 行に変換した文字列       |
| `ANDROID_KEYSTORE_PASSWORD`               | キーストアのパスワード                    | 文字列                                                    |
| `ANDROID_KEY_ALIAS`                       | 署名鍵のエイリアス名                      | 文字列                                                    |
| `ANDROID_KEY_PASSWORD`                    | 署名鍵のパスワード                        | 文字列                                                    |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64` | Google Play 提出用サービスアカウント JSON | JSON ファイル全体を `base64 -w 0` で 1 行に変換した文字列 |

Google Play の JSON は、JSON ファイル全体を Base64 化して設定します。Linux では `base64 -w 0 service-account.json`、macOS では `base64 < service-account.json | tr -d '\n'` を使います。SOPS の dotenv 値にはクォートや実改行を含めず、生成された 1 行をそのまま設定してください。

### 4. iOS リリース設定 (`secrets.ios-release.age.env`)

```bash
sops secrets/secrets.ios-release.age.env
```

| 項目名                          | 内容                         | 形式・備考                                            |
| ------------------------------- | ---------------------------- | ----------------------------------------------------- |
| `APPLE_CERTIFICATE_BASE64`      | 配布用証明書 (`.p12`)        | `base64 -w 0 certificate.p12` で 1 行に変換した文字列 |
| `APPLE_CERTIFICATE_PASSWORD`    | 配布用証明書のパスワード     | 文字列                                                |
| `APPLE_TEAM_ID`                 | Apple Developer Team ID      | 10桁の文字列（Apple Developer サイトで確認）          |
| `APP_STORE_CONNECT_KEY_ID`      | App Store Connect API Key ID | App Store Connect の「ユーザーとアクセス」で確認      |
| `APP_STORE_CONNECT_ISSUER_ID`   | App Store Connect Issuer ID  | App Store Connect の「ユーザーとアクセス」で確認      |
| `APP_STORE_CONNECT_PRIVATE_KEY` | API 秘密鍵 (`.p8`) の中身    | `-----BEGIN PRIVATE KEY-----...` を含む内容全体       |

## 4. 【初回作業】GitHub リポジトリへの鍵・環境変数登録

GitHub Actions がビルド時に自動で暗号化ファイルを復号できるように、GitHub リポジトリの **Settings → Environments** に設定を行います。

### 必要な Environment 一覧

1. **`staging`**
   - **Secret**: `SOPS_AGE_KEY` = `secrets/.private/staging.agekey` の中身全体（`AGE-SECRET-KEY-1...`）
   - **Variable**: `TEN_API_URL` = `https://ten-api-staging.<account>.workers.dev`
   - **Variable**: `TEN_ADMIN_URL` = `https://ten-admin-staging.<account>.workers.dev`

2. **`production`**（本番 Worker / 管理画面 用）
   - **Secret**: `SOPS_AGE_KEY` = `secrets/.private/production.agekey` の中身全体
   - **Variable**: `TEN_API_URL` = `https://ten-api-production.<account>.workers.dev`
   - **Variable**: `TEN_ADMIN_URL` = `https://ten-admin-production.<account>.workers.dev`
   - **Deployment branches**: `production` ブランチのみ許可、必要に応じて「Required reviewers（手動承認）」を設定

   production の更新は `Pipeline` の E2E 成功後にのみ開始されます。Worker と管理画面が同じ D1 を使うため、マイグレーションは環境ごとに直列実行されます。

3. **`release`**（Android / iOS リリース用）
   - **Secret**: `SOPS_AGE_KEY` = `secrets/.private/production.agekey` の中身全体
   - **Variable**: `TEN_API_URL` = `https://ten-api-production.<account>.workers.dev`
   - **Variable**: `ADMOB_APP_ID` = 本番 AdMob の App ID（Android / iOS）
   - **Variable**: `ADMOB_REWARDED_UNIT_ID` = 本番 AdMob のリワード広告ユニット ID（Android）
   - **Variable**: `ADMOB_INTERSTITIAL_UNIT_ID` = 本番 AdMob のインタースティシャル広告ユニット ID（Android）
   - **Deployment branches**: `v*` タグのみ許可、「Required reviewers」を設定推奨

## 5. 運用時の確認・トラブルシューティング

### 設定内容が正しく復号できるか手元でテストする

```bash
# staging の内容確認
export SOPS_AGE_KEY="$(cat secrets/.private/staging.agekey)"
sops -d secrets/secrets.staging.age.env

# 本番系の内容確認
export SOPS_AGE_KEY="$(cat secrets/.private/production.agekey)"
sops -d secrets/secrets.production.age.env
```

### よくあるエラーと対処法

- **`Failed to get the data key`**: 設定した `SOPS_AGE_KEY` が対象ファイル用の復号鍵と一致していません。staging 鍵と本番系鍵を取り違えていないか確認してください。
- **`sops: command not found`**: 開発ツールが読み込まれていません。`direnv allow` または `mise install` を実行してください。
- **改行エラー（証明書やキーストア）**: base64 形式に変換する際、途中に改行が含まれていると正しく復号できません。`base64 -w 0`（macOS の場合は `base64 | tr -d '\n'`）で 1 行にして登録してください。
- **秘密鍵の紛失**: 秘密鍵（`.agekey`）を紛失すると復号できなくなります。必ず安全なマネージャーにバックアップしてください。
