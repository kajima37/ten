#!/usr/bin/env bash
set -euo pipefail
set +x

deadline=$((SECONDS + 3600))

while [ "$SECONDS" -lt "$deadline" ]; do
  run="$(gh api "repos/$GITHUB_REPOSITORY/actions/workflows/pipeline.yml/runs?branch=production&head_sha=$GITHUB_SHA&per_page=100" \
    --jq '[.workflow_runs[]] | sort_by(.created_at) | last // empty | [.id, .status, .conclusion] | @tsv')"

  if [ -n "$run" ]; then
    IFS=$'\t' read -r run_id status conclusion <<< "$run"
    case "$status:$conclusion" in
      completed:success) exit 0 ;;
      completed:*)
        echo "production Pipeline $run_id concluded: $conclusion" >&2
        exit 1
        ;;
    esac
  fi

  sleep 30
done

echo 'timed out waiting for the production Pipeline' >&2
exit 1
