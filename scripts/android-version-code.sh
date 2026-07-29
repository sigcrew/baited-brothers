#!/usr/bin/env bash
set -euo pipefail

MAX_ANDROID_VERSION_CODE=2100000000

if [ -n "${ANDROID_VERSION_CODE:-}" ]; then
  VERSION_CODE="$ANDROID_VERSION_CODE"
else
  VERSION_CODE="$(($(date -u +%s) / 60))"
fi

if ! [[ "$VERSION_CODE" =~ ^[0-9]+$ ]]; then
  echo "ANDROID_VERSION_CODE는 양의 정수여야 합니다." >&2
  exit 1
fi

if [ "$VERSION_CODE" -le 0 ] || [ "$VERSION_CODE" -gt "$MAX_ANDROID_VERSION_CODE" ]; then
  echo "ANDROID_VERSION_CODE는 1 이상 ${MAX_ANDROID_VERSION_CODE} 이하여야 합니다." >&2
  exit 1
fi

printf '%s\n' "$VERSION_CODE"
