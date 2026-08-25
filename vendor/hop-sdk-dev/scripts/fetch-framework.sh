#!/usr/bin/env bash
# Materialize the dev xcframework for the SwiftPM package in this directory.
#
# The single committed artifact is vendor/libhop-main-54a2e82.xcframework.zip (see
# ios/hop-pods/README.md for provenance). SwiftPM binaryTarget(path:) needs the unzipped
# directory inside the package, so this expands it once; Frameworks/ is gitignored.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
zip="$here/../libhop-main-54a2e82.xcframework.zip"
dest="$here/Frameworks"
mkdir -p "$dest"
if [ -d "$dest/libhop.xcframework" ]; then
  echo "already present: $dest/libhop.xcframework"
  exit 0
fi
echo "unzipping $zip"
unzip -q "$zip" -d "$dest"
echo "ok: $dest/libhop.xcframework"
