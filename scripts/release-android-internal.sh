#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f ".env" ]; then
  echo ".env가 없습니다. EXPO_PUBLIC_SUPABASE_URL과 EXPO_PUBLIC_SUPABASE_ANON_KEY를 설정하세요."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "node_modules가 없습니다. 먼저 npm install을 실행하세요."
  exit 1
fi

node -e '
  require("dotenv").config({ path: ".env", quiet: true });
  const required = ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY"];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    console.error(`필수 환경변수가 없습니다: ${missing.join(", ")}`);
    process.exit(1);
  }
'

if ! (cd android && bundle --version >/dev/null 2>&1); then
  echo "android/Gemfile.lock에 맞는 Bundler가 없습니다. scripts/README-android-release.md의 최초 설정을 확인하세요."
  exit 1
fi

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
export ANDROID_VERSION_CODE="$(bash scripts/android-version-code.sh)"

echo "Android internal release"
echo "  versionCode: $ANDROID_VERSION_CODE"
echo "  ABIs: armeabi-v7a, arm64-v8a"

cd android
bundle check || bundle install --path vendor/bundle
bundle exec fastlane internal
