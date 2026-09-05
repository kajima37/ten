# 管理画面（TEN. admin）の公開と運用

TEN. の運用（プレイヤーの利用停止、不正スコアの非表示、監査ログの確認）は、**ゲーム API とは別の専用 Worker** で動く管理画面から行います。curl での管理 API 操作は廃止しました。

## 1. 全体の構成

管理画面は、staging 用と production 用に分かれた専用 Worker として公開され、環境ごとの D1 データベースへ直接接続します。

未認証のリクエストには最小限のログイン画面だけを返します。管理画面の HTML、JavaScript、CSS は承認済みセッションを確認してから配信するため、URL を知っているだけでは管理 UI や操作フローを取得できません。API はこの配信制御とは別に、すべて Worker 側でセッションと承認状態を検証します。

```
[運用管理者ブラウザ] ──→ [Google / GitHub ログイン]
                                   ↓ 認証成功・管理者承認の確認
                         [ten-admin-staging]   ──→ ステージング DB (ten-db-staging)
                         [ten-admin-production] ──→ 本番 DB (ten-db-production)

[ゲーム / アプリ]     ──→ [ten-api-*] ──→ 同じ DB / キャッシュ
```

| 項目             | staging                                              | production                                           |
| ---------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| **Worker 名**    | `ten-admin-staging`                                  | `ten-admin-production`                               |
| **公開 URL**     | `https://ten-admin-staging.<account>.workers.dev`    | `https://ten-admin-production.<account>.workers.dev` |
| **対象データ**   | ステージング D1（`ten-db-staging`）                  | 本番 D1（`ten-db-production`）                       |
| **ログイン**     | Google / GitHub OAuth                                | Google / GitHub OAuth                                |
| **利用できる人** | Web プレビュー承認済みの全員（`preview_identities`） | `admin_identities` で承認された少数の管理者のみ      |
| **更新契機**     | `main` ブランチへのマージ時に自動デプロイ            | `production` ブランチへのマージ時に自動デプロイ      |

## 2. できること（機能）

管理画面にログインすると、次の操作ができます。**すべての変更操作には理由の入力が必須**で、実行者・対象・変更前後の状態・件数が `admin_audit_logs`（監査ログ）に記録されます。

- **プレイヤー検索**: プレイヤー ID、表示名、IP ハッシュで検索
- **プレイヤー詳細**: 状態、登録日時、IP ハッシュ、日次スコア履歴の表示
- **利用停止 / 解除**: プレイヤー単位。期限の指定も可能（空なら無期限）
- **IP 停止 / 解除**: 同一 IP ハッシュに紐づく既存アカウントを一括停止し、**その IP からの今後のアカウント作成・利用も拒否**します。解除しても、個別に停止されたアカウントは停止されたままです
- **スコアの非表示 / 再表示**: スコアは物理削除せず、ランキングから除外（論理削除）します。日次単位または全期間を指定できます
- **監査ログ**: 過去の操作を一覧で確認

production 環境では画面全体に警告色のバナーを表示し、危険な操作（IP 停止、全期間のスコア非表示）では確認用の入力を求めます。

## 3. 通常の運用フロー

1. 公開 URL を開き、Google または GitHub でログインします（セッションは 8 時間有効）。
2. 未ログイン・セッション切れの場合はログイン画面が表示されるので、再度ログインします。
3. 「プレイヤー検索」から対象を検索し、詳細画面で操作します。
4. 操作後は「監査ログ」で記録内容を確認します。

手動で再デプロイする場合は、GitHub の **Actions → Pipeline → Run workflow** から実行します。staging は `main`、production は `production` ブランチを選択してください。手動実行では Worker と管理画面を再デプロイします。

## 4. 初回のみ必要な準備（管理者向け）

プロジェクト立ち上げ時に一度だけ実施する作業です。`pnpm setup` で自動化できます。手動で行う場合は以下の手順に従います。詳細は[初回セットアップガイド](./setup.md)を参照してください。

### ステップ 1: OAuth アプリの準備

OAuth App は **staging と production で別々のものを使用します**。staging は、プレビュー用に作成した OAuth App（[ステージング Web プレビューの公開](./cloudflare-worker-preview.md)で作成したもの）に管理画面分の callback URL を追加して使い回します。production は staging とは別の OAuth App を新規作成し、シークレットの漏洩や更新の影響が環境をまたがないようにします。両プロバイダとも callback URL は複数登録できます（GitHub は Settings → Developer settings → OAuth Apps、Google は Google Cloud Console → 認証情報 → 承認済みリダイレクト URI）。

- **staging**（既存 App に追加登録）:
  ```text
  https://ten-admin-staging.<account>.workers.dev/auth/callback/github
  https://ten-admin-staging.<account>.workers.dev/auth/callback/google
  ```
- **production**（新規作成した App に登録）:
  ```text
  https://ten-admin-production.<account>.workers.dev/auth/callback/github
  https://ten-admin-production.<account>.workers.dev/auth/callback/google
  ```

### ステップ 2: 秘密情報の登録

[秘密情報の初回設定・管理手順](./secrets.md) に従い、`ADMIN_SESSION_SECRET` と OAuth クライアント情報を `secrets/secrets.staging.age.env` と `secrets/secrets.production.age.env` に登録します。production には、ステップ 1 で新規作成した production 専用 OAuth App の Client ID / Secret を登録してください（staging の値を使い回さないでください）。

### ステップ 3: GitHub Environment の設定

リポジトリの **Settings → Environments** に接続先 URL を登録します。

| Environment  | Variable        | 値の例                                               |
| ------------ | --------------- | ---------------------------------------------------- |
| `staging`    | `TEN_ADMIN_URL` | `https://ten-admin-staging.<account>.workers.dev`    |
| `production` | `TEN_ADMIN_URL` | `https://ten-admin-production.<account>.workers.dev` |

※ Environment 一覧と `SOPS_AGE_KEY` の登録手順は [秘密情報の初回設定・管理手順](./secrets.md) を参照してください。必要に応じて `production` Environment に「Required reviewers」を設定します。

### ステップ 4: 管理者の承認

- **staging**: Web プレビューの承認済みアカウントなら、そのまま管理画面にもログインできます。承認手順は[プレビューの利用者承認](./cloudflare-worker-preview.md)と共通です。
- **production**: 承認された管理者のみログインできます。対象者がログインを試みた後、既存の管理者が管理画面の「アクセス管理」を開き、保留中の識別子（`github:12345678` など）を本人確認のうえ承認します。承認・取消には理由が必要で、実行者と変更内容が監査ログに記録されます。承認済みの管理者は全員、他の管理者を管理できます。

  取消は次のリクエストから反映され、既存セッションも無効になります。最後に有効な管理者は管理画面から取り消せません。

  初回だけは承認済み管理者がいないため、ブートストラップとして Wrangler で最初の identity を `admin_identities` に承認登録します。その後の通常運用では Wrangler は不要です。

  ```bash
  pnpm --filter @ten/admin exec wrangler d1 execute ten-db-production --remote --env production \
    --command "INSERT INTO admin_identities (provider, subject, approved_at, approved_by) VALUES ('github', '12345678', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'initial-bootstrap');"
  ```

## 5. 動作確認とトラブルシューティング

### 動作確認の手順

1. `curl --fail https://ten-admin-<env>.<account>.workers.dev/api/health` が `{"status":"ok",...}` を返すことを確認します（`version` はデプロイしたコミット SHA）。
2. 公開 URL を開き、ログイン → プレイヤー検索ができることを確認します。

### よくあるトラブルと対処法

- **OAuth プロバイダで `redirect_uri_mismatch` が出る**: 管理画面用の callback URL が OAuth アプリへ登録済みか、URL が公開 URL と完全に一致しているか確認してください。
- **「管理者として未承認です」と表示される**（production）: ステップ 4 の承認 SQL を実行してください。staging で表示される場合は、プレビューとして未承認です。
- **操作が 401 になる**: セッション（8 時間）が切れています。再ログインしてください。
- **UI は表示されるが操作が失敗する**: Worker が D1 マイグレーション未適用の可能性があります。`pnpm --filter @ten/admin db:migrate:staging`（または `db:migrate:production`）を実行して、`admin_audit_logs` などのテーブルが作成されているか確認してください。
- **管理画面自体が 503 になる**: `ADMIN_SESSION_SECRET` や OAuth 設定が未登録です。sops ファイルと Worker secrets を確認してください。
- **CI のヘルスチェックが失敗する**: Environment 変数 `TEN_ADMIN_URL` が正しい workers.dev の URL（末尾に `/` を含まない）か確認してください。
