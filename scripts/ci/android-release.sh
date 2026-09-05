#!/usr/bin/env bash
set -euo pipefail
set +x

umask 077
keystore_file="$RUNNER_TEMP/release.jks"
service_account_file="$RUNNER_TEMP/service-account.json"

# The workflow uploads the service-account file after this script completes.
# Keep it until the workflow's final cleanup step; remove the keystore here.
trap 'rm -f "$keystore_file"' EXIT

: "${ANDROID_KEYSTORE_BASE64:?missing Android keystore}"
: "${ANDROID_KEYSTORE_PASSWORD:?missing Android keystore password}"
: "${ANDROID_KEY_ALIAS:?missing Android key alias}"
: "${ANDROID_KEY_PASSWORD:?missing Android key password}"
: "${GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64:?missing Google Play service account}"

printf '%s' "$ANDROID_KEYSTORE_BASE64" | base64 --decode > "$keystore_file"
printf '%s' "$GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64" |
  base64 --decode > "$service_account_file"
jq -e . "$service_account_file" >/dev/null

export TEN_KEYSTORE_FILE="$keystore_file"
export TEN_KEYSTORE_PASSWORD="$ANDROID_KEYSTORE_PASSWORD"
export TEN_KEY_ALIAS="$ANDROID_KEY_ALIAS"
export TEN_KEY_PASSWORD="$ANDROID_KEY_PASSWORD"

chmod +x apps/web/android/gradlew
pnpm mobile:sync
./apps/web/android/gradlew -p apps/web/android bundleRelease --no-daemon
