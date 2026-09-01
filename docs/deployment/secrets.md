# 秘密情報の一元管理

TEN. のデプロイとアプリ公開に必要な秘密情報（APIトークン、署名キー、証明書など）を、
**SOPS + age** の暗号化ファイルでリポジトリ内に一元管理します。

- 暗号化ファイルはコミットできます（リポジトリが公開でも平文は漏れません）
- 復号できるのは **age 秘密鍵を持っている人**だけです
- GitHub Actions では、復号鍵を各 Environment の secret `SOPS_AGE_KEY` から渡します
- 環境ごとに鍵を分離し、staging の job が本番の秘密を読めないようにします

## ファイル構成

```text
secrets/
  .sops.yaml                         # ファイルごとの暗号化ルール
  secrets.staging.age.env            # staging 用（staging鍵で復号）
  secrets.production.age.env         # 本番 Worker 用（本番系鍵で復号）
  secrets.android-release.age.env    # Android 署名・Play提出用（本番系鍵）
  secrets.ios-release.age.env        # iOS 署名・TestFlight提出用（本番系鍵）
  .private/                          # age 秘密鍵（gitignore済み、コミット禁止）
  .decrypted/                        # 復号の一時出力（gitignore済み）
```

各ファイルは dotenv 形式です。改行を含む値（keystore、証明書、service account JSON など）は
**base64 にして1行**で保存してください。

## 環境と鍵の対応

| ファイル                          | 復号鍵     | 用途                                           |
| --------------------------------- | ---------- | ---------------------------------------------- |
| `secrets.staging.age.env`         | staging 鍵 | main からの staging Worker デプロイ            |
| `secrets.production.age.env`      | 本番系鍵   | production Worker デプロイ                     |
| `secrets.android-release.age.env` | 本番系鍵   | `Android Release` workflow（署名・Play提出）   |
| `secrets.ios-release.age.env`     | 本番系鍵   | `iOS Release` workflow（署名・TestFlight提出） |

公開鍵は `secrets/.sops.yaml` に記載してコミットしています。秘密鍵はリポジトリに
**コミットしません**。

各リリース workflow は、`secrets/` の対応するファイルを復号して署名や提出に使います。
値の一覧は [モバイルデプロイ](./mobile.md) を参照してください。

## 初回設定

### 1. ツールを入れる

このリポジトリでは `mise.toml` と `flake.nix` に `age` / `sops` を追加済みです。

```bash
# Linux / Nix
direnv allow
# Windows / mise
mise install
```

### 2. 鍵を生成し、バックアップする

鍵ペアは `secrets/.private/` に生成済みです。**この秘密鍵が無いと復号できません。**

1. `secrets/.private/staging.agekey` を個人の秘密情報マネージャー（1Password / Bitwarden など）へ保存
2. `secrets/.private/production.agekey` も同様に保存
3. ファイルを失ってもよいよう、バックアップを確認する

生成し直す場合は次を実行します。新しい鍵を `.sops.yaml` の `age:` に反映し、再暗号化してください。

```bash
age-keygen -o secrets/.private/staging.agekey
age-keygen -o secrets/.private/production.agekey
```

### 3. 値を入力する

暗号化ファイルを編集します。保存時に SOPS が再暗号化します。

```bash
sops secrets/secrets.staging.age.env
sops secrets/secrets.production.age.env
sops secrets/secrets.android-release.age.env
sops secrets/secrets.ios-release.age.env
```

`<set-me>` のままの値はデプロイや提出で失敗するため、必ず実値に置き換えます。

## GitHub Actions への登録

各 Environment の secret に `SOPS_AGE_KEY` を登録します。

| Environment         | 登録する秘密鍵       |
| ------------------- | -------------------- |
| `staging`           | staging 秘密鍵の内容 |
| `production-worker` | 本番系秘密鍵の内容   |
| `release`           | 本番系秘密鍵の内容   |

登録は GitHub の `Settings → Environments → 各環境 → Environment secrets` から行います。
`SOPS_AGE_KEY` の値は秘密鍵ファイルの**内容全体**（`AGE-SECRET-KEY-1...` の行）です。

## ローカルでの利用

age 秘密鍵は、SOPS が読める次の場所のいずれかに置きます。

- 既定の鍵ファイル（Linux: `~/.config/sops/age/keys.txt`、Windows: `%APPDATA%\sops\age\keys.txt`）
- 環境変数 `SOPS_AGE_KEY`

例:

```bash
export SOPS_AGE_KEY="$(cat secrets/.private/staging.agekey)"

# 復号結果を環境変数として特定コマンドへ注入
sops exec-env secrets/secrets.staging.age.env 'pnpm dev:worker'

# Cloudflare Worker の秘密情報を登録するとき
sops exec-env secrets/secrets.staging.age.env \
  'pnpm --filter @ten/worker exec wrangler secret put AUTH_SECRET --env staging'
```

## GitHub Actions での利用

workflow では `jdx/mise-action` が `mise.toml` から `sops` を導入するため、次のように復号します。

```yaml
- name: Decrypt staging secrets
  run: |-
    sops -d secrets/secrets.staging.age.env > "$RUNNER_TEMP/staging.env"
    sed -E '/^[[:space:]]*(#|$)/d' "$RUNNER_TEMP/staging.env" >> "$GITHUB_ENV"
  env:
    SOPS_AGE_KEY: ${{ secrets.SOPS_AGE_KEY }}
```

`$GITHUB_ENV` へ展開した変数は、後続の step の環境変数として使えます。workflow には
復号した値をログへ出力する step を入れないでください。

## 鍵と値のローテーション

### 値（トークン・パスワードなど）の変更

```bash
sops secrets/secrets.production.age.env
```

編集して保存し、コミットします。Cloudflare やストア側の値も同時に更新してください。

### 鍵の失効・交換

1. 新しく鍵を生成する
2. `secrets/.sops.yaml` の `age:` を新しい公開鍵へ置き換える（環境ごと）
3. 対象ファイルを再暗号化する

   ```bash
   sops updatekeys secrets/secrets.staging.age.env
   ```

4. 新しい秘密鍵をマネージャーへ保存し、GitHub の `SOPS_AGE_KEY` を更新する
5. 古い秘密鍵はマネージャーから削除する

## セキュリティ上の注意

- `secrets/.private/` と `secrets/.decrypted/` はコミットしない（.gitignore 済み）
- 秘密鍵をチャットやログへ貼らない
- GitHub Actions のログに復号値を出力しない
- バイナリ値は base64 にし、改行を含まない形で保存する
- リポジトリを公開のままにする場合も、この構成は有効です。ただし平文コミットはしないこと

## 困ったとき

- `Failed to get the data key` → `SOPS_AGE_KEY` がそのファイルの復号鍵でない。環境と鍵の対応を確認
- `sops: command not found` → `mise install` または `direnv allow` を実行
- 復号結果が文字化けする → 値が改行を含んでいないか確認し、base64 を使う
- 鍵を失った → 復号不能。バックアップから復元するか、`secrets/` を再生成して各サービスに再登録
