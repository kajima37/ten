# Google Play 公開手順

この文書は、TEN. を Google Play で一般公開するための準備、Play Console 上の作業、CI で自動化できる範囲をまとめたものです。Google Play の要件は変更されるため、公開時には必ず公式ドキュメントも確認してください。

## 現在のアプリ構成

| 項目                 | 現在の設定                                             |
| -------------------- | ------------------------------------------------------ |
| Application ID       | `net.sajima.ten`                                       |
| 表示名               | `TEN.`                                                 |
| min SDK              | 24                                                     |
| target / compile SDK | 36                                                     |
| 配布形式             | Android App Bundle (`.aab`)                            |
| 権限                 | `INTERNET` のみ（Manifest上）                          |
| 広告                 | Google AdMob（リワード広告、インタースティシャル広告） |
| 現在のCI配布先       | Google Play 内部テストトラック                         |

2026年8月31日以降、新規アプリと更新は Android 16（API 36）以上が必要です。TEN. は現在 target SDK 36 のため、この要件を満たしています。将来の要件変更は公式ページで再確認してください。

## 公開前の必須作業

### 1. 開発者アカウント

1. Google Play Console 開発者アカウントを作成します。
2. Developer Distribution Agreement に同意し、登録料を支払います。
3. 個人または組織のアカウント種別を選択します。
4. 開発者本人・組織情報、連絡先、必要な本人確認を完了します。
5. 新しい個人アカウントの場合は、Play Console のデバイス確認も完了します。

個人アカウントを2023年11月13日以降に作成した場合、一般公開前に、12人以上が14日間継続して参加するクローズドテストと、production access の申請が必要です。内部テストだけではこの条件を満たしません。

### 2. Play Consoleでアプリを作成

1. **Home → Create app** を開きます。
2. デフォルト言語、アプリ名 `TEN.`、種別 `Game`、無料/有料、連絡先メールアドレスを入力します。
3. Developer Program Policies、US export laws、Play App Signing の宣言を確認します。
4. Package name が `net.sajima.ten` になることを確認します。Package name は一度作成すると削除・再利用できないため、変更しないでください。
5. Play App Signing を有効にし、アップロード鍵とアプリ署名鍵の管理方法を確定します。

初回のアプリ登録、Play App Signing の初期設定、アプリの所有権・開発者情報確認は手動作業です。

### 3. ストア掲載情報

**Main store listing** に以下を入力します。

- アプリ名: 最大30文字
- Short description: 最大80文字
- Full description: 最大4,000文字
- カテゴリとタグ
- サポート用メールアドレス（必須）
- サポートWebサイト（推奨）
- アプリのアイコン、スクリーンショット、必要に応じてFeature graphicや動画
- 必要な言語ごとの翻訳と画像

掲載文言と画像は実際の機能、広告表示、料金、データ取扱いと一致させます。キーワードの過剰な反復や、実装していない機能の記載は避けます。

### 4. プライバシーポリシー

公開前に、Play Console の **Policy and programs → App content → Privacy Policy** に、誰でもアクセスできるHTTPS URLを登録します。URLはログイン不要、地域制限なし、常時アクセス可能なHTMLページにします。PDFや、後から内容を変更できるだけの未確定ページは使用しません。

プライバシーポリシーには少なくとも次を含めます。

- 開発者名、アプリ名、問い合わせ先
- 収集、利用、保存、共有するデータの種類と目的
- AdMobなど第三者SDKと共有先
- 通信・保存時のセキュリティ対策
- 保存期間、削除方法、削除できない場合の正当な理由
- アカウントと関連データの削除方法

本番Workerに次のページを実装しています。`TEN_API_URL` はPlay Consoleへ登録する本番Worker URLです。

- Privacy Policy: `${TEN_API_URL}/privacy`
- Terms of Service: `${TEN_API_URL}/terms`
- Account deletion: `${TEN_API_URL}/account-deletion`

現在の開発者名と問い合わせ先は仮値（Kajima / `kajima37@example.com`）です。公開前に必ず実際の情報へ変更し、法的内容を確認してください。ポリシーはPlay Consoleだけでなく、アプリからもアクセスできるようにしてください。

### 5. アカウント削除

TEN. は初回起動時に端末識別子を使ってサーバー上のプレイヤーを作成し、名前、スコア、フレンド情報などを保存します。Google Play のアカウント削除要件の対象となる可能性が高いため、安全側ではアプリ内アカウントとして扱います。

公開前に次を実装・確認します。

- アプリ内の設定などから削除を開始できる
- アプリをアンインストールしたユーザー向けに、Webから削除を申請できる
- 削除時にプレイヤー、スコア、スコア証跡、フレンドコード、フレンド申請など関連データを削除する
- Play Console の Data safety にWeb削除URLを登録する
- セキュリティ・法令上保持するデータがあれば、対象と期間を明示する

プレイヤー削除API、アプリ内削除UI、外部削除フォームを実装済みです。アプリのマイページから外部削除ページを発行でき、リンクは30日間有効な削除コードを含みます。

### 6. App content と Data safety

Play Console の **Policy and programs → App content** で、次を実際のアプリ挙動に合わせて申告します。

- Privacy Policy
- Ads: **Yes**（AdMobを利用しているため）
- App access: 一般利用にログインが不要なら、その旨を記載。制限機能がある場合は審査用手順を用意
- Target audience and content: 対象年齢と子ども向けかどうか
- Content rating: 質問票に回答し、未レーティング状態を残さない
- Data safety: 収集、共有、暗号化、削除請求の有無
- Financial features、News、COVID-19など該当する追加申告

Data safety はアプリ本体だけでなく、AdMobなど同梱SDKのデータ取扱いも含めて申告します。回答は実装とプライバシーポリシーに一致させ、データ取扱いを変更したときは更新します。

現行実装から確認できる申告候補は次のとおりです。最終回答は開発者がSDKの最新資料と実際の設定を確認して確定します。

| データ                              | 収集元・用途の候補                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| Device or other IDs                 | Web/アプリの端末ID、プレイヤー識別、チート対策。AdMobの広告ID等はSDK資料を確認 |
| User IDs                            | サーバーが発行するプレイヤーID                                                 |
| Name                                | ユーザーが設定する表示名                                                       |
| App activity / Other actions        | プレイ回数、スコア、コンボ、デイリー記録、ランキング                           |
| Contacts / social graphに類する情報 | フレンドコード、フレンド申請、フレンド関係                                     |
| IP address由来の情報                | サーバー側の不正対策用IPハッシュ。Data safety上の分類は用途を確認              |

端末内だけに保存するプレイ履歴・設定・バックアップファイルは、端末外へ送信しない範囲ではData safetyの「収集」とは別扱いになります。ただし、アプリ、Worker、AdMob SDKをまとめて確認してください。

### 7. テストとリリース

1. 内部テストにAABをアップロードし、署名、インストール、更新、広告同意、広告表示、デイリーゲーム、データ削除を確認します。
2. Play Console のPre-launch report、クラッシュ、ANR、互換性を確認します。
3. 必要な場合はクローズドテストを開始します。
4. 新規個人アカウントの場合、12人以上のテスターが14日間継続参加したことを確認します。
5. Dashboardから production access を申請し、テスト内容、フィードバック、修正内容、公開準備状況を回答します。
6. Productionトラックで国・地域、価格、配布範囲、管理対象公開を確認します。
7. 小さな段階的ロールアウトで公開し、クラッシュ、ANR、レビュー、サーバー負荷を監視します。
8. 問題がなければ段階的に公開率を上げます。

## 現行CIとの対応

現行の `.github/workflows/android-release.yml` は、タグを起点に次を自動化しています。

- productionブランチへの到達確認
- Production pipelineの完了待ち
- Java、Android SDK、依存関係のセットアップ
- version name / version code の設定
- 本番API URLとAdMob App IDの検証
- 署名済みAABのビルド
- AABの署名検証
- Google Play **internal** トラックへのアップロード
- AAB artifactの保存

したがって、現在のCI成功は「一般公開完了」を意味しません。Play Consoleでの掲載情報、App content、審査、production access、Productionトラックへの昇格は別途必要です。

## CI自動化の検討

### 自動化しやすい作業

Google Play Android Developer APIのEdit API、またはFastlane Supplyなどを使えば、サービスアカウントに必要最小限の権限を与えて次を自動化できます。

- AABの各テストトラックへのアップロード
- リリースノート、version code、track、段階的ロールアウト
- ストア掲載文言と翻訳
- スクリーンショットなどの掲載画像
- テスターリストとテストトラック設定
- リリースのvalidate / commit
- 内部テストからProductionへの昇格

既存のAABアップロードはすでにこの一部を実施しています。将来拡張する場合も、Production公開はGitHub Environmentの承認付き手動workflowにし、ビルドと公開を分離するのが安全です。

### 自動化しない、または手動承認を残す作業

- 開発者アカウント作成、本人確認、登録料支払い
- 初回アプリ登録とPlay App Signingの初期設定
- プライバシーポリシーの法的内容の承認
- Target audience、Content rating、Adsなどの政策申告の最終判断
- Data safetyの正確性確認と提出判断
- アカウント削除フローの実在確認
- 新規個人アカウントのproduction access申請
- 審査対応、公開停止、レビューへの対応

Google Play Android Developer APIには掲載情報、トラック、画像などの操作APIがありますが、Play Consoleのすべての政策申告や審査を置き換えるものではありません。Data safetyにはAPIの `applications.dataSafety` がありますが、入力内容の正確性をCIで保証できないため、法務・プロダクト確認なしに自動更新しない方針を推奨します。

### 推奨する将来のCI構成

1. Pull Request: format、lint、typecheck、test、Web/モバイルビルド、静的なManifest検査。
2. タグ: Production ready確認、署名、AAB作成、内部テストへのアップロード。
3. 手動workflow: 既存AABを指定トラックへ昇格し、ロールアウト率を入力。`release` Environmentの承認を必須にする。
4. 変更頻度の低い掲載情報: レビュー済みのリポジトリ内メタデータを、別の手動workflowで同期する。
5. 公開後: Play Developer Reporting API等の導入を検討し、クラッシュ・ANR・レビューの確認を自動化する。

サービスアカウントJSON、署名鍵、アップロード鍵はCIログやartifactへ出さず、既存のSOPSとEnvironment承認を継続します。

## 公式情報

- [Create and set up your app](https://support.google.com/googleplay/android-developer/answer/9859152)
- [Prepare your app for review](https://support.google.com/googleplay/android-developer/answer/9859455)
- [Provide information for Google Play's Data safety section](https://support.google.com/googleplay/android-developer/answer/10787469)
- [User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311)
- [Understanding Google Play's app account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)
- [App testing requirements for new personal developer accounts](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Target API level requirements for Google Play apps](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Google Play Android Developer API](https://developers.google.com/android-publisher/api-ref/rest)

この調査と記載内容は2026年9月4日時点の情報に基づきます。
