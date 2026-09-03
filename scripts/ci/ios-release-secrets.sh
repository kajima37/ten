#!/usr/bin/env bash
set -euo pipefail
set +x

output_file="$1"

write_output() {
  local name="$1" value="$2" delimiter
  delimiter="sops_${name}_$(date +%s%N)"
  {
    printf '%s<<%s\n' "$name" "$delimiter"
    printf '%s\n' "$value"
    printf '%s\n' "$delimiter"
  } >> "$output_file"
}

mask_and_output() {
  local name="$1" value="${!1}" line
  : "${value:?missing $name}"
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -n "$line" ]] && printf '::add-mask::%s\n' "$line"
  done <<< "$value"
  write_output "$name" "$value"
}

mask_and_output APPLE_CERTIFICATE_BASE64
mask_and_output APPLE_CERTIFICATE_PASSWORD
mask_and_output APP_STORE_CONNECT_PRIVATE_KEY

write_output APP_STORE_CONNECT_ISSUER_ID "${APP_STORE_CONNECT_ISSUER_ID:?missing App Store Connect issuer ID}"
write_output APP_STORE_CONNECT_KEY_ID "${APP_STORE_CONNECT_KEY_ID:?missing App Store Connect key ID}"
write_output APPLE_TEAM_ID "${APPLE_TEAM_ID:?missing Apple team ID}"
