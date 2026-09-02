# 秘密情報の初回設定・管理手順（SOPS + age）

TEN. では、アプリの署名鍵や Cloudflare の API トークンなどの機密情報を、**暗号化されたファイルとして Git リポジトリ内で安全に一元管理**しています。

この文書では、**初めて環境をセットアップする担当者**が、必要な暗号鍵を準備し、各シークレットの登録と GitHub Actions 連携を完了させるまでの具体的な手順を説明します。

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

`sops` コマンドを使うと、ファイルを自動的に復号してエディタが開き、**保存時に自動で再暗号化**されます。

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
| `ADMIN_SECRET`               | 管理者用 API の認証キー                  | ランダムな長い文字列（例: `openssl rand -hex 32`）                           |
| `PREVIEW_SESSION_SECRET`     | プレビューセッションの署名鍵             | ランダムな長い文字列（例: `openssl rand -hex 32`）。必須                     |
| `GOOGLE_OAUTH_CLIENT_ID`     | Google OAuth Client ID                   | 任意。Google Cloud Console で作成した Web application の Client ID           |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth Client Secret               | 任意。上記 Client ID とセットで登録する。アプリへ含めない                    |
| `GITHUB_OAUTH_CLIENT_ID`     | GitHub OAuth App Client ID               | GitHub の OAuth App 設定で作成した Client ID。必須                           |
| `GITHUB_OAUTH_CLIENT_SECRET` | GitHub OAuth App Client Secret           | 上記 OAuth App の Client Secret。必須。アプリへ含めない                      |

### 2. 本番環境の設定 (`secrets.production.age.env`)

```bash
# 本番系鍵を環境変数にセットして編集
export SOPS_AGE_KEY="$(cat secrets/.private/production.agekey)"
sops secrets/secrets.production.age.env
```

staging と同様に、本番専用の Cloudflare API トークン、本番用 `AUTH_SECRET` / `ADMIN_SECRET` を登録します（※ staging と同じシークレットを使い回さないでください）。

### 3. Android リリース設定 (`secrets.android-release.age.env`)

```bash
sops secrets/secrets.android-release.age.env
```

| 項目名                             | 内容                                      | 形式・備考                                          |
| ---------------------------------- | ----------------------------------------- | --------------------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`          | 署名用キーストアファイル (`.keystore`)    | `base64 -w 0 your.keystore` で 1 行に変換した文字列 |
| `ANDROID_KEYSTORE_PASSWORD`        | キーストアのパスワード                    | 文字列                                              |
| `ANDROID_KEY_ALIAS`                | 署名鍵のエイリアス名                      | 文字列                                              |
| `ANDROID_KEY_PASSWORD`             | 署名鍵のパスワード                        | 文字列                                              |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Google Play 提出用サービスアカウント JSON | Google Cloud で発行した JSON キーの中身全体         |

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

2. **`production-worker`**（本番 Worker 用）
   - **Secret**: `SOPS_AGE_KEY` = `secrets/.private/production.agekey` の中身全体
   - **Variable**: `TEN_API_URL` = `https://ten-api-production.<account>.workers.dev`
   - **Deployment branches**: `production` ブランチのみ許可、必要に応じて「Required reviewers（手動承認）」を設定

3. **`release`**（Android / iOS リリース用）
   - **Secret**: `SOPS_AGE_KEY` = `secrets/.private/production.agekey` の中身全体
   - **Variable**: `TEN_API_URL` = `https://ten-api-production.<account>.workers.dev`
   - **Variable**: `ADMOB_APP_ID` = 本番 AdMob の App ID（Android / iOS）
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
