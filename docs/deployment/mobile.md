# モバイルアプリの公開・ビルド（Android / iOS）

TEN. は Capacitor 8 を使い、Web アプリをスマートフォン（Android / iOS）向けにビルドします。

## 1. 全体の公開フロー

TEN. では GitHub Actions を使い、**タグを打つだけで Android・iOS の両方が自動でビルドされ、ストアのテスト配信（Google Play 内部テスト / TestFlight）へ提出**されます。

```
[コード修正]
    ↓
[main ブランチへマージ] ──→ 開発版・ステージング環境へ反映
    ↓
[production ブランチへマージ] ──→ 本番コードとして確定
    ↓
[バージョンタグ作成 (例: v1.0.0)]
    ↓
[GitHub Actions 自動実行] ──→ 署名・ビルド・ストア自動提出
```

### バージョンの付け方

タグ名は必ず `v1.2.3` のように `v` から始まる形式にします。

- **表示バージョン** (`1.2.3`): タグの数字がそのままアプリのバージョンになります。
- **ビルド番号**: GitHub Actions の実行番号から自動で重複しない番号が割り振られます。

## 2. 初回のみ必要な準備（管理者向け）

自動リリースを動かすには、ストアのアカウントと暗号化された秘密情報の登録が必要です。

### 必要なアカウント・設定

1. **Android (Google Play Console)**
   - Google Play Developer アカウント
   - API 操作用の「サービスアカウント」（Google Cloud で作成）
   - アプリの初回手動登録と、内部テストトラックへの初版 AAB アップロード
   - アプリ署名用のキーストアファイル (`.keystore`)

2. **iOS (Apple Developer / App Store Connect)**
   - Apple Developer Program アカウント
   - App Store Connect でのアプリ登録
   - API 操作用の App Store Connect API キー (`.p8`)
   - 配布用証明書 (`.p12`)

### 秘密情報・変数の登録

GitHub リポジトリの `Settings → Environments → release` に以下を設定します。

| 項目           | 種類     | 内容                                                                         | 備考                               |
| -------------- | -------- | ---------------------------------------------------------------------------- | ---------------------------------- |
| `TEN_API_URL`  | Variable | 本番 Worker の URL（例: `https://ten-api-production.<account>.workers.dev`） | 公開情報                           |
| `ADMOB_APP_ID` | Variable | 本番 AdMob のアプリ ID                                                       | 公開情報                           |
| `SOPS_AGE_KEY` | Secret   | 本番系の age 秘密鍵                                                          | 署名キーや証明書を復号するための鍵 |

※ キーストア本体や証明書などの機密データは、[秘密情報の一元管理](./secrets.md) の暗号化ファイル（`secrets/secrets.android-release.age.env` / `secrets/secrets.ios-release.age.env`）に保管します。

## 3. アプリをリリースする手順（通常運用）

本番コードが `production` ブランチに反映されたら、以下のコマンドでリリースを開始します。

```bash
# 1. production ブランチの最新コミットを取得
git checkout production
git pull origin production

# 2. 新しいバージョンのタグを作成してプッシュ
git tag v1.0.0
git push origin v1.0.0
```

プッシュ後、GitHub の **Actions** タブで `Android Release` と `iOS Release` のワークフローが起動します。環境承認（Environment Protection Rule）を設定している場合は、承認後にビルドとストア提出が行われます。

## 4. 手元（ローカル PC）でアプリを動かす・確認する

実機やエミュレータで開発・動作確認を行いたい場合の手順です。

### 必要なツール

- **Android**: Android Studio
- **iOS**: macOS + Xcode

### 手順

```bash
# 1. 接続先 API サーバーを指定（ローカル Worker またはステージング URL）
export VITE_API_URL=http://localhost:8787

# 2. モバイル用 Web ファイルのビルドとネイティブへの同期
pnpm mobile:sync

# 3. エディタを開いて起動
pnpm mobile:open:android   # Android Studio を起動
pnpm mobile:open:ios       # Xcode を起動（Mac のみ）
```

### 広告（AdMob）の動作

- **ローカルビルド時**: 広告 ID が未設定の場合、Google 公式の「テスト広告 ID」で安全に動作します。実広告の誤タップペナルティ等の心配はありません。
- **Web 開発プレビュー (`pnpm dev`)**: 画面右下に `Ads: MOCK ⇄ OFF` トグルが表示され、実機と同じタイミングでモックの広告ダイアログを確認できます。URL に `?ads=off` または `?ads=fail` を付けることでも挙動を切り替えられます。
