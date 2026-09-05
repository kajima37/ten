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

Google Playで一般公開するための掲載情報、プライバシーポリシー、Data safety、テスト要件、CI自動化の範囲は、[Google Play公開手順](./google-play.md)にまとめています。

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

| 項目                         | 種類     | 内容                                                                         | 備考                               |
| ---------------------------- | -------- | ---------------------------------------------------------------------------- | ---------------------------------- |
| `TEN_API_URL`                | Variable | 本番 Worker の URL（例: `https://ten-api-production.<account>.workers.dev`） | 公開情報                           |
| `ADMOB_APP_ID`               | Variable | 本番 AdMob のアプリ ID                                                       | 公開情報                           |
| `ADMOB_REWARDED_UNIT_ID`     | Variable | 本番 AdMob のリワード広告ユニット ID                                         | Productionビルドで必須             |
| `ADMOB_INTERSTITIAL_UNIT_ID` | Variable | 本番 AdMob のインタースティシャル広告ユニット ID                             | Productionビルドで必須             |
| `SOPS_AGE_KEY`               | Secret   | 本番系の age 秘密鍵                                                          | 署名キーや証明書を復号するための鍵 |

※ キーストア本体や証明書などの機密データは、[秘密情報の一元管理](./secrets.md) の暗号化ファイル（`secrets/secrets.android-release.age.env` / `secrets/secrets.ios-release.age.env`）に保管します。

## 3. アプリをリリースする手順（通常運用）

本番コードが `production` ブランチに反映されたら、以下のコマンドでリリースを開始できます。release workflow は対象コミットの **Production ready** が成功するまで最大 60 分待機してから、署名とストア提出へ進みます。Production ready には format、lint、型検査、テスト、E2E、変更があった Worker / 管理画面のデプロイとヘルスチェックが含まれます。

```bash
# 1. production ブランチの最新コミットを取得
git checkout production
git pull origin production

# 2. 新しいバージョンのタグを作成してプッシュ
git tag v1.0.0
git push origin v1.0.0
```

プッシュ後、GitHub の **Actions** タブで `Android Release` と `iOS Release` のワークフローが起動します。両 workflow は、タグのコミットで **Production ready** が成功するまで待機してから、環境承認とビルド・ストア提出へ進みます。Production ready が失敗するか、60 分以内に完了しない場合だけ release は停止します。

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
