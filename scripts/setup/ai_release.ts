import type { SetupConfig, StepResult } from './types.ts'
import { printBlock } from './prompt.ts'
import { collectSopsFields } from './sops.ts'
import type { SopsField } from './sops.ts'

const ANDROID_FIELDS: SopsField[] = [
  {
    key: 'ANDROID_KEYSTORE_BASE64',
    label: 'Android 署名キーストア',
    required: true,
    kind: 'base64-file',
    hint: '(.keystore / .jks ファイルパスを指定、自動で Base64 化)',
  },
  {
    key: 'ANDROID_KEYSTORE_PASSWORD',
    label: 'キーストアのパスワード',
    required: true,
    kind: 'password',
  },
  {
    key: 'ANDROID_KEY_ALIAS',
    label: '署名鍵のエイリアス名',
    required: true,
    kind: 'text',
  },
  {
    key: 'ANDROID_KEY_PASSWORD',
    label: '署名鍵のパスワード',
    required: true,
    kind: 'password',
  },
  {
    key: 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64',
    label: 'Google Play サービスアカウント JSON',
    required: true,
    kind: 'base64-file',
    hint: '(service-account.json を指定、自動で Base64 化)',
  },
]

const IOS_FIELDS: SopsField[] = [
  {
    key: 'APPLE_CERTIFICATE_BASE64',
    label: 'Apple 配布用証明書',
    required: true,
    kind: 'base64-file',
    hint: '(.p12 ファイルを指定、自動で Base64 化)',
  },
  {
    key: 'APPLE_CERTIFICATE_PASSWORD',
    label: '配布用証明書のパスワード',
    required: true,
    kind: 'password',
  },
  {
    key: 'APPLE_TEAM_ID',
    label: 'Apple Developer Team ID',
    required: true,
    kind: 'text',
    hint: '(10桁)',
  },
  {
    key: 'APP_STORE_CONNECT_KEY_ID',
    label: 'App Store Connect API Key ID',
    required: true,
    kind: 'text',
  },
  {
    key: 'APP_STORE_CONNECT_ISSUER_ID',
    label: 'App Store Connect Issuer ID',
    required: true,
    kind: 'text',
  },
  {
    key: 'APP_STORE_CONNECT_PRIVATE_KEY',
    label: 'App Store Connect API 秘密鍵',
    required: true,
    kind: 'raw-file',
    hint: '(.p8 ファイルパスを指定)',
  },
]

export async function runReleaseStep(config: SetupConfig): Promise<StepResult> {
  printBlock('リリース用シークレット登録 (Android / iOS)', [
    'ストア提出用の署名鍵やサービスアカウント情報を登録します。',
    'keystore / JSON / 証明書などのファイルはパスを指定すると',
    '自動で Base64 変換して暗号化保存します。',
    '',
    '必須: Android 署名一式, Google Play サービスアカウント,',
    '      Apple 配布証明書, App Store Connect キー一式',
  ])

  await collectSopsFields(
    'Android リリースシークレット',
    'secrets.android-release.age.env',
    ANDROID_FIELDS,
    config,
  )
  await collectSopsFields(
    'iOS リリースシークレット',
    'secrets.ios-release.age.env',
    IOS_FIELDS,
    config,
  )

  return {
    step: 'release',
    status: 'completed',
    message: 'リリース用シークレットを登録しました',
  }
}
