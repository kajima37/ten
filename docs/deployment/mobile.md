# TEN. モバイルデプロイ

TEN. は Capacitor 8 を使用し、既存のWebアプリをAndroidおよびiOS向けにパッケージ化します。デイリーやランキングを使う場合は、先に [Cloudflare Worker](./cloudflare-worker.md) を公開してください。

## アプリケーション情報

- アプリ名: `TEN.`
- Bundle ID / Application ID: `com.ten.game`

正式な逆ドメイン形式の識別子が決まっている場合は、最初にストアへ申請する前に
Application ID を変更してください。公開後に変更すると、ストア上では別の
アプリケーションとして扱われます。

## 公開の流れ

リリースは `production` ブランチ上のコミットに `vX.Y.Z` 形式のタグを作成すると、
Android / iOS の両方を自動でビルドし、ストアの内部テストへ提出します。

```bash
# production へ昇格済みのコミットにタグを作成
git tag v1.2.3
git push origin v1.2.3
```

- `Android Release`: 署名済み AAB を作成し、Google Play の内部テストトラックへ提出
- `iOS Release`: 署名済み IPA を作成し、App Store Connect の TestFlight へ提出

タグが `production` ブランチの祖先でない場合、どちらの workflow も失敗します。
タグ形式は `vX.Y.Z` のみ受け付けます。

### バージョン

- `versionName` / `MARKETING_VERSION` はタグの `X.Y.Z` を使います
- `versionCode` / `CURRENT_PROJECT_VERSION`（ビルド番号）は、各リリース workflow の
  GitHub Actions `run_number` を単調増加する値として使います
- リリース workflow を削除して作り直すと `run_number` がリセットされるため、
  workflow は削除しないでください

## ローカルでのビルド

WorkerのURLを `VITE_API_URL` に指定します。ローカルWorkerを使う場合は `http://localhost:8787` に置き換えます。

```sh
export VITE_API_URL=https://ten-api-production.<account>.workers.dev
pnpm mobile:sync
```

API URLはアプリのビルドに埋め込まれます。`AUTH_SECRET` や `ADMIN_SECRET` はモバイルビルドへ絶対に入れません。

```sh
pnpm mobile:open:android
pnpm mobile:open:ios
```

`pnpm mobile:sync` はモバイル用Webファイルを生成してネイティブプロジェクトへコピーし、Capacitorプラグインを同期します。Androidの端末向けビルドにはAndroid Studio、iOSの端末向けビルドにはmacOS上のXcodeが必要です。

### 広告（AdMob）

ローカルビルドでは広告ユニット ID の環境変数が未設定のため、AdMob 公式のテスト ID が使われます。`VITE_ADMOB_REWARDED_UNIT_ID` や `VITE_ADMOB_INTERSTITIAL_UNIT_ID` を設定すると実広告で確認できます（AdMob の実機テスト設定が必要）。本番 App ID はリリース workflow が `ADMOB_APP_ID` Environment Variable からネイティブ設定へ注入します。

Web の開発プレビュー（`pnpm dev`）では、実機と同じ頻度でモック広告が表示されます。右下の `Ads: MOCK ⇄ OFF` トグルで切替え、`?ads=off`（非表示）/ `?ads=fail`（常に失敗）で挙動を上書きできます。

## 開発用ビルド

- `CI`: push および pull request ごとに、フォーマット、lint、型、Web ビルド、
  モバイル用 Web バンドルを検証します。
- `Android`: 手動実行時にデバッグ APK を生成します。
- `iOS`: 手動実行時に署名なしの Simulator アプリを生成します。

開発用 Actions は、GitHub の `staging` Environment の `TEN_API_URL`（staging Worker URL）を使います。
生成されたビルド成果物は GitHub Actions に14日間保存されます。

## リリース用の準備

### GitHub Environment

リリースには `release` Environment が必要です。必須 reviewer を設定し、
`v*` タグからのデプロイだけを許可します。Android / iOS の各 job はこの
Environment を参照するため、job ごとに承認が発生します。

| Environment | Variable                                                                      | Secret                          |
| ----------- | ----------------------------------------------------------------------------- | ------------------------------- |
| `release`   | `TEN_API_URL`（production Worker URL）<br>`ADMOB_APP_ID`（本番 AdMob App ID） | `SOPS_AGE_KEY`（本番系 age 鍵） |

広告ユニット ID（リワード／インタースティシャル）は Vite のビルド時に `VITE_ADMOB_REWARDED_UNIT_ID` / `VITE_ADMOB_INTERSTITIAL_UNIT_ID` から注入します。広告 ID は機密ではないため Environment Variable に直接登録して構いません。SOPS で暗号化する必要はありません。`VITE_ADMOB_APP_ID_IOS` / `VITE_ADMOB_APP_ID_ANDROID` を空にすると AdMob 公式のテスト ID にフォールバックするため、ローカル開発時に本番 ID を意識する必要はありません。

秘密情報の本体（keystore、証明書、ストアのサービスアカウントなど）は
[秘密情報の一元管理](./secrets.md) の暗号化ファイルへ入れます。

- `secrets/secrets.android-release.age.env`
- `secrets/secrets.ios-release.age.env`

### Android の事前準備

- Google Cloud で Play Developer API を有効にする
- サービスアカウントを作成し、JSON キーを発行する
- Play Console の Users and permissions で、そのサービスアカウントへ
  アプリの権限を付与する
- Play Console でアプリを作成し、少なくとも一度は AAB を手動アップロードする
  （内部テストトラックの初回作成）
- アップロード用 keystore を作成する

`secrets.android-release.age.env` の値:

| キー                               | 内容                             |
| ---------------------------------- | -------------------------------- |
| `ANDROID_KEYSTORE_BASE64`          | keystore ファイルの base64       |
| `ANDROID_KEYSTORE_PASSWORD`        | keystore のパスワード            |
| `ANDROID_KEY_ALIAS`                | 署名キーのエイリアス             |
| `ANDROID_KEY_PASSWORD`             | 署名キーのパスワード             |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Play 用サービスアカウントの JSON |

### iOS の事前準備

- Apple Developer Program のアカウントを用意する
- App Store Connect でアプリを作成する
- App Store Connect API キー（`.p8`）を発行し、`Issuer ID` と `Key ID` を控える
- Distribution 証明書（`.p12`）をエクスポートする
- ストア用の Provisioning Profile を用意する
  （workflow が App Store Connect API で自動取得します）

`secrets.ios-release.age.env` の値:

| キー                            | 内容                                  |
| ------------------------------- | ------------------------------------- |
| `APPLE_CERTIFICATE_BASE64`      | Distribution 証明書（.p12）の base64  |
| `APPLE_CERTIFICATE_PASSWORD`    | .p12 のパスワード                     |
| `APPLE_TEAM_ID`                 | Apple の Team ID                      |
| `APP_STORE_CONNECT_KEY_ID`      | App Store Connect API の Key ID       |
| `APP_STORE_CONNECT_ISSUER_ID`   | App Store Connect API の Issuer ID    |
| `APP_STORE_CONNECT_PRIVATE_KEY` | App Store Connect API の秘密鍵（.p8） |

## 署名情報の管理

署名情報（keystore、証明書、プロファイル）はリポジトリへ保存せず、
[秘密情報の一元管理](./secrets.md) の暗号化ファイルと、GitHub Environment の
`SOPS_AGE_KEY` で管理します。`release` Environment には手動承認を必須にし、
`production` ブランチ由来のタグだけを許可します。
