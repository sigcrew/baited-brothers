#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f "android/keystore.properties" ]; then
  echo "android/keystore.properties 가 없습니다. android/keystore.properties.example 를 참고하세요."
  exit 1
fi

PLAY_JSON="${GOOGLE_PLAY_JSON_KEY_PATH:-$ROOT/credentials/play-submit.json}"
if [ ! -f "$PLAY_JSON" ]; then
  echo "Play 서비스 계정 JSON이 없습니다: $PLAY_JSON"
  exit 1
fi

export GOOGLE_PLAY_JSON_KEY_PATH="$PLAY_JSON"

cd android
bundle check || bundle install --path vendor/bundle
bundle exec fastlane internal
