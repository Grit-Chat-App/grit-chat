# Grit Chat

A consumer chat app that runs on [Hop](https://github.com/hopmesh/hop). Its real purpose is to be a
field test of the transport, so the numbers it collects matter more than the number of installs.

The app is Grit Chat. "BurnChat" was the internal codename and is retired: the repository, the
Xcode target and the React Native module are all `GritChat` or `grit-chat` now. It survives only in
historical records, where rewriting it would falsify what actually happened.

## What the app is

React Native on iOS and Android. The seam rule from the old Swift app carries over exactly: every
Hop touchpoint lives in `src/hop/` (the seam), screens and stores never import the SDK, and the seam
is the only file that changes when the SDK surface moves.

| Path | What it is |
|---|---|
| `src/` | The app: screens, stores, seam, design system, unit-tested pure logic. |
| `ios/` | The React Native Xcode project, plus dev CocoaPods pinned in `ios/hop-pods/`. |
| `Sources/GritRelayNode/` | The proof harness. Not a product feature: it is the second, independent Hop node for the proof ladder in `PATH.md`. |
| `vendor/` | Dev-pinned Hop artifacts (SDK tarball, xcframework, local SwiftPM package), all built from hop main `54a2e82`. |
| `e2e/` | The Detox suite: 14 scenarios, 83 steps, every scenario class sabotage-proven. |

## Status, honestly

Two physical handsets exchanged a fresh direct message through the RelayBearer:

- Physical iPhone XR, device fingerprint `47677f5c8bf3`, sent
  `GCPHYS-BEB09E02-2FF3-4032-BD3C-6C5B69457DE6`.
- Physical Pixel 7, device fingerprint `99fee17211cb`, rendered that exact nonce as received.
- The sender trace returned `delivered=true`, `relayed=1`, and `forwardHops=2`.

[`PATH.md`](PATH.md) records the anonymous public proof. The raw command, device identifiers,
sender trace, receiver hierarchy, and reviewed physical receipt screenshot live in the private
operator evidence record.

## Limits

The React Native SDK carries this result over a relay. It currently has no Bluetooth or LAN bearer,
so radio discovery and direct local transport remain unproven. The production relay fleet remains
unproven. The Pixel receipt screen was read from physical hardware; no physical iPhone screenshot
was captured.

Channels run on locally built ABI 6 artifacts because no published `hop-sdk-apple` release carries
them, so channels cannot ship until one does. Direct messages are unaffected: they work on the
published `v0.0.2` SDK.

## Working path

`PATH.md` is the single ladder: rungs 0 through 3, the exact commands, and the real traces. The
Detox suite is the regression net for what the rungs prove.

```
npm ci
npx tsc --noEmit && npx jest
npx detox test --configuration ios.sim.debug -- --profile full
```

CI builds the harness, typechecks, and runs the unit suite. The Detox suite needs a simulator and
a live relay and runs locally, per `PATH.md`.

## The dependency seam, and how it is meant to change

Today the seam sits on `@hop-mesh/react-native` (vendored dev tarball, ABI 6). When a published
`hop-sdk-apple` release ships ABI 6, the vendored artifacts in `vendor/` and `ios/hop-pods/`
revert to published pins and channels can ship. Until then the dev pins are documented where they
live, with provenance and a revert plan.

## Licence

Grit Chat's own code is licensed under the **Apache License, Version 2.0**. The full text is in
[`LICENSE`](LICENSE), and `Copyright 2026 Grit Chat LLC`.

The tree also carries vendored Hop components, under `vendor/` and `ios/hop-pods/`. Those are Hop
Mesh, LLC's work rather than Grit Chat LLC's, they are also Apache-2.0, and each keeps its own
licence file where it sits. [`NOTICE`](NOTICE) lists every one of them with its copyright holder and
the path to its licence.

Apache-2.0 section 6 grants no trademark rights, and nothing here grants any right to the Grit Chat
name or marks.
