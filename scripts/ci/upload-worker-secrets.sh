#!/usr/bin/env bash
set -euo pipefail
set +x

environment="$1"

require() {
  local name="$1"
  [[ -n "${!name:-}" ]] || { echo "missing required secret: $name" >&2; exit 1; }
}

put() {
  local name="$1" value="${!1:-}" line
  require "$name"
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -n "$line" ]] && printf '::add-mask::%s\n' "$line"
  done <<< "$value"
  printf '%s' "$value" | pnpm --filter @ten/worker exec wrangler secret put "$name" --env "$environment"
}

put AUTH_SECRET
put PREVIEW_SESSION_SECRET
put GITHUB_OAUTH_CLIENT_ID
put GITHUB_OAUTH_CLIENT_SECRET

if [[ -n "${GOOGLE_OAUTH_CLIENT_ID:-}" || -n "${GOOGLE_OAUTH_CLIENT_SECRET:-}" ]]; then
  put GOOGLE_OAUTH_CLIENT_ID
  put GOOGLE_OAUTH_CLIENT_SECRET
fi
