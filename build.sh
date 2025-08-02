#!/bin/bash

# A script to build the browser extension for Chrome and Firefox.
#
# Usage:
#   ./build.sh chrome      - Builds the Chrome extension
#   ./build.sh firefox     - Builds the Firefox extension
#   ./build.sh clean       - Removes build artifacts

set -e

clean() {
  echo "🧹 Cleaning up previous build artifacts..."
  rm -rf dist
  rm -f link-previewer-*.zip
}

build_chrome() {
  local target="link-previewer-chrome.zip"

  echo "🚀 Building for Chrome..."
  clean
  mkdir -p dist

  # Use rsync to copy Common files while excluding .gif files.
  echo "📂 Copying Common files (excluding .gif)..."
  rsync -a --exclude='*.gif' Common/ dist/

  echo "📂 Copying Chrome-specific files..."
  cp -r Chrome/* dist/

  echo "📎 Zipping into ${target}..."
  (cd dist && zip -r ../${target} .) > /dev/null 2>&1

  echo
  echo "✅ Chrome build complete: ${target}"
}

build_firefox() {
  local target="link-previewer-firefox.zip"

  echo "🚀 Building for Firefox..."
  clean
  mkdir -p dist

  echo "📂 Copying Common files (excluding .gif)..."
  rsync -a --exclude='*.gif' Common/ dist/

  echo "📂 Copying Firefox-specific files..."
  cp -r Firefox/* dist/

  # macOS's sed requires an extension for the -i flag, even if it's empty.
  local sed_inplace
  if [[ "$(uname)" == "Darwin" ]]; then
    sed_inplace="sed -i ''"
  else
    sed_inplace="sed -i"
  fi

  echo "🔧 Replacing 'chrome' with 'browser' for Firefox compatibility..."
  find ./dist -type f -name '*.js' -print0 | xargs -0 $sed_inplace 's/chrome/browser/g'

  echo "📎 Zipping into ${target}..."
  (cd dist && zip -r ../${target} .) > /dev/null 2>&1

  echo "✅ Firefox build complete: ${target}"
}



case "$1" in
  chrome)
    build_chrome
    ;;
  firefox)
    build_firefox
    ;;
  clean)
    clean
    echo "✅ Cleanup complete."
    ;;
  *)
    echo "Usage: $0 {chrome|firefox|clean}"
    exit 1
    ;;
esac
