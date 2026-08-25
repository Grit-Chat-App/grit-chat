# The Hop pods, and what this directory is right now

This directory vendors the three Hop Apple pods this app consumes (`CHop`, `HopContract`,
`HopSDK`). The RN SDK's own README tells consumers to fetch podspecs from the hop-sdk-apple
repo; those URLs 404 and a clone at the release tag ships no podspecs at all, so this repo
declares its own. That much is permanent.

## Right now this is a DEVELOPMENT pin, not a release pin

The `feat/react-native-app` branch adds hps:// channels to the app. Channels shipped in the
monorepo (hop PR #62, C ABI 5 to 6) but **no hop-sdk-apple release carries them**: the newest
tag, v0.0.2, is ABI v5 with no hps exports, and the Swift wrapper asserts its expected ABI
against `hop_abi_version()`, so an SDK-v0.0.2 pairing against an ABI v6 binary fails loudly
rather than half-working. Re-vendoring the RN SDK's JavaScript alone would give TypeScript
methods that call native functions the linked binary does not have.

So while channels are in development, this directory pins local artifacts built from hop main:

| What | Where | Provenance |
|---|---|---|
| `libhop.xcframework` (ABI 6, hps + relay pool) | `vendor/libhop-main-54a2e82.xcframework.zip` | `bash sdk/apple/build-xcframework.sh` in a hop worktree at `origin/main` commit `54a2e82`; `hop_abi_version()` probed as 6; `hop_hps_register` and `hop_relay_add` verified present in the slices; sha256 `a88b346646ceb34164d45ec32554e6a4b10a9efab09fd6ea1e31baf89b0539eb` |
| `HopContract` / `HopSDK` Swift sources | `HopContract/Sources`, `HopSDK/Sources` | copied from `sdk/apple/Sources` at the same commit |

The React Native SDK is re-vendored alongside it:
`vendor/hop-mesh-react-native-main-54a2e82.tgz` (`npm pack` on `sdk/react-native` at the same
commit), which carries the 48-method bridge including the hps and relay-pool surface.

**Shipping Grit Chat with channels requires a new published hop-sdk-apple release, which does
not exist yet.** Until it does, this tree is development-only against these local artifacts.

## Rebuilding the framework zip

```
git worktree add /tmp/hop-relayd-main origin/main     # from the hop checkout, does not edit it
cd /tmp/hop-relayd-main && bash sdk/apple/build-xcframework.sh
cd /tmp && zip -rq libhop-main.zip \
  /tmp/hop-relayd-main/sdk/apple/Frameworks/libhop.xcframework
# place at vendor/libhop-main-<shortsha>.xcframework.zip, update CHop.podspec's
# file:// path and sha256, and refresh the Sources copies + RN tarball at the same commit.
```

`rustup`-managed cargo must be on PATH (`export PATH="$HOME/.cargo/bin:$PATH"`), or the build
silently uses Homebrew Rust, which cannot cross-compile the iOS slices.

## The revert plan

When hop-sdk-apple publishes a release with ABI 6: restore the v0.0.2 form recorded in git
history (CHop sourcing the GitHub release asset with `:sha256`; HopContract/HopSDK sourcing the
tag; `@hop-mesh/react-native` vendored from the release tag's tarball), at the new tag, and
delete the local-artifact notes. Nothing else in the app depends on the dev pin.
