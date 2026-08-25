#!/usr/bin/env bash
# Materialize the dev Hop Android Maven repository for the gradle build.
#
# The single committed artifact is vendor/hop-android-maven-main-54a2e82.zip (provenance in
# vendor/README-android-artifact.md). Gradle consumes sh.hop:hop as a REPOSITORY rather than a bare
# .aar, because the POM carries net.java.dev.jna:jna and the Kotlin wrapper loads libhop THROUGH
# JNA: a files() or flatDir dependency drops that transitive silently, builds green, and then dies
# at the first bridge call. So this expands the repository layout, POM and all.
#
# Expanded output is gitignored: one committed archive, no second copy of a 17 MB artifact in git.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
zip="$root/vendor/hop-android-maven-main-54a2e82.zip"
expected="1e9d36deeb4d1d8d39c152010e699edf33f25d7b2a2cdd1f28f61e08d26a5f7e"
dest="$root/vendor/hop-android-maven"

if [ ! -f "$zip" ]; then
  echo "missing $zip" >&2
  exit 1
fi

# Checksum first, always, even when the tree is already expanded: a swapped archive must fail here
# rather than link something nobody vetted.
echo "$expected  $zip" | shasum -a 256 -c - >/dev/null

if [ -d "$dest/maven-repository/sh/hop/hop" ]; then
  echo "already present: $dest/maven-repository"
  exit 0
fi

mkdir -p "$dest"
unzip -q "$zip" -d "$dest"
test -f "$dest/maven-repository/sh/hop/hop/0.0.5/hop-0.0.5.aar"
test -f "$dest/maven-repository/sh/hop/hop/0.0.5/hop-0.0.5.pom"
echo "ok: $dest/maven-repository (sh.hop:hop:0.0.5)"
