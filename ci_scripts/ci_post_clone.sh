#!/bin/sh

set -eu

REPOSITORY_ROOT="${CI_PRIMARY_REPOSITORY_PATH:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$REPOSITORY_ROOT"

# Xcode Cloud images don't guarantee that third-party build tools are installed.
# Expo SDK 54 requires a modern Node.js runtime.
if ! command -v node >/dev/null 2>&1; then
  brew install node@22
  export PATH="$(brew --prefix node@22)/bin:$PATH"
fi

if ! command -v pod >/dev/null 2>&1; then
  brew install cocoapods
fi

NODE_BINARY="$(command -v node)"
NODE_MAJOR="$("$NODE_BINARY" -p 'Number(process.versions.node.split(".")[0])')"

if [ "$NODE_MAJOR" -lt 20 ]; then
  brew install node@22
  NODE_BINARY="$(brew --prefix node@22)/bin/node"
  export PATH="$(dirname "$NODE_BINARY"):$PATH"
fi

echo "Using Node.js $("$NODE_BINARY" --version)"
echo "Using CocoaPods $(pod --version)"

npm ci --no-audit --no-fund

# React Native's Xcode build phase reads this ignored, machine-local file.
printf 'export NODE_BINARY="%s"\n' "$NODE_BINARY" > ios/.xcode.env.local

cd ios
pod install
