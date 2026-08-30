# TEN. モバイルデプロイ

TEN. は Capacitor 8 を使用し、既存の TanStack Start アプリケーションを
Android および iOS 向けにパッケージ化します。Web 版は引き続き SSR に対応し、
モバイルビルドでは TanStack Start の SPA モードを使用して
`dist/client/index.html` を生成します。

## アプリケーション情報

- アプリ名: `TEN.`
- Bundle ID / Application ID: `com.ten.game`

正式な逆ドメイン形式の識別子が決まっている場合は、最初にストアへ申請する前に
Application ID を変更してください。公開後に変更すると、ストア上では別の
アプリケーションとして扱われます。

## ローカルでのビルド手順

```sh
pnpm build:mobile
pnpm mobile:sync
pnpm mobile:open:android
pnpm mobile:open:ios
```

`pnpm mobile:sync` はモバイル用 SPA を生成して両方のネイティブプロジェクトへ
コピーし、Capacitor プラグインを同期します。Android の端末向けビルドには
Android Studio が必要です。iOS の端末向けビルドには macOS 上の Xcode が
必要です。

## 継続的インテグレーション

- `CI`: push および pull request ごとに、フォーマット、lint、型、Web ビルド、
  モバイル用 Web バンドルを検証します。
- `Android`: 手動実行時にデバッグ APK を生成します。
- `iOS`: 手動実行時に署名なしの Simulator アプリを生成します。

Android と iOS のネイティブビルドは実行時間とコストを抑えるため、push や
pull request では自動実行されません。GitHub のリポジトリで
**Actions → Android または iOS → Run workflow** を選択して実行してください。

生成されたビルド成果物は GitHub Actions に14日間保存されます。

## ストア用の署名

現在の workflow は、意図的に署名なしの開発用成果物を生成します。
Google Play 向けには、GitHub Environment のシークレットを使ってアップロード用
keystore を追加し、Android App Bundle（`bundleRelease`）をビルドしてください。
App Store Connect 向けには、Apple Distribution 証明書、Provisioning Profile、
Team ID を追加し、保護された GitHub Environment 上で Xcode Archive を作成します。

推奨する GitHub Environment:

- `android-release`
- `ios-release`

どちらの Environment にも手動承認を必須とし、署名情報はリポジトリへ保存せず、
必ず Environment のシークレットで管理してください。
