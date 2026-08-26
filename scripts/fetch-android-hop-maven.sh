#!/usr/bin/env bash
# Materialize the development Hop Maven repository Grit Chat's Android build consumes.
#
# The one committed archive contains the Hop SDK plus the native BLE and LAN bearer AARs. Gradle needs
# their POMs, not bare AAR files: the SDK POM carries JNA and each bearer POM carries the exact SDK
# dependency. Provenance lives in vendor/README-android-artifact.md.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
zip="$root/vendor/hop-android-maven-bearers-8c2a574.zip"
expected="b10d45ce242aabddf3c183088b8e4cf4f6692ed2b8cd4e526e98a53a71db28f8"
dest="$root/vendor/hop-android-maven"

if [ ! -f "$zip" ]; then
  echo "missing $zip" >&2
  exit 1
fi

# Checksum first, even when the tree is already expanded: a swapped archive must fail before Gradle
# can link it.
echo "$expected  $zip" | shasum -a 256 -c - >/dev/null

required=(
  "$dest/maven-repository/sh/hop/hop/0.0.5/hop-0.0.5.aar"
  "$dest/maven-repository/sh/hop/bearers/bearer-ble/0.0.2/bearer-ble-0.0.2.aar"
  "$dest/maven-repository/sh/hop/bearers/bearer-lan/0.0.2/bearer-lan-0.0.2.aar"
)
needs_extract=false
for file in "${required[@]}"; do
  if [ ! -f "$file" ]; then
    needs_extract=true
    break
  fi
done
if "$needs_extract"; then
  rm -rf "$dest/maven-repository"
  mkdir -p "$dest"
  unzip -q "$zip" -d "$dest"
fi

for file in "${required[@]}"; do
  test -f "$file"
done
echo "ok: $dest/maven-repository (sh.hop:hop:0.0.5 + BLE/LAN bearers)"
