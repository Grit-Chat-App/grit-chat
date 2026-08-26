# The working path

The one sentence everyone working on Grit Chat converges on:

> Grit Chat, running on the physical BushidoPhone, exchanges a real message with a second independent
> Hop node through a running relay, and the sender sees delivery confirmed with a hop count greater
> than one.

**Status: MET.** Rung 2 passed on the physical BushidoPhone (iPhone 17 Pro,
`[REDACTED-DEVICE-UDID]`): one to one `delivered=true` with `forwardHops=2`, and a channel
round trip with the writer verified, both traces pulled off the device and quoted below. Rungs 0,
1 and 1c passed earlier on a SIMULATOR, and a simulator pass is still not the bar; the handset run
is what met it. One thing the pass does NOT include: nobody has read the rendered screen on the
handset (no tool on this Mac can capture a wirelessly attached iPhone; see rung 2).

The proof, end to end, is this repo's React Native path: `PATH.md` rung 2 for the handset, and for
a regression net on the simulator:

```
npx tsc --noEmit && npx jest
npx detox test --configuration ios.sim.debug -- --profile full
```

## The app identifier, and why the recorded commands below still say the old one

The bundle identifier is **`chat.grit.app`** on both platforms, chosen by Jason as the reverse DNS
form of `grit.chat` so that a future web app at `app.grit.chat` and the mobile app are one identity
rather than two products that happen to look alike. It replaced `com.jwaldrip.gritchat` on iOS and
`com.burnchat` on Android, which were never even the same string as each other: the two platforms
were already shipping under different identities, and that latent defect is fixed here as a side
effect.

**`grit.chat` is Jason's. The purchase completed on 2026-08-25.** An earlier revision of this file
recorded it as registered to a third party and listed for sale. That was accurate when it was
measured and is now superseded by the registry itself. Confirmed by RDAP against
`rdap.identitydigital.services`, the IANA-bootstrapped RDAP server for `.chat`:

- A `transfer` event at **2026-08-25T00:16:37.909Z**, and the registrar is now **GoDaddy.com, LLC**
  where it was Sav.com.
- The expiry moved from 2027-01-19 to **2028-01-19T15:15:15.312Z**, the one-year extension a
  registrar transfer adds. Registration date is unchanged at 2026-01-19.
- Status now carries all four client locks plus `transferPeriod`.
- The nameservers left the broker at **2026-08-25T02:21:27.587Z**: `ns1.afternic.com` and
  `ns2.afternic.com` are gone, replaced by `ns1.hosting.businessidentity.llc` and
  `ns2.hosting.businessidentity.llc`, and the SOA is no longer `dns.jomax.net`. The new zone
  publishes no A, MX or TXT at all yet, so the parked lander that still answers over HTTP is a
  stale cached answer rather than live content. [INFERENCE]

The registrant field is redacted, as it is for every post-GDPR gTLD, so the registry does not name
the holder. Jason has confirmed the domain is in his GoDaddy account and that this transfer was his
purchase completing. That confirmation is the evidence for ownership; the registry is the evidence
for the transfer.

**A separate defect survives the purchase, and it is about `grit.app`, not `grit.chat`.** The bundle
id `chat.grit.app` is a host under `grit.app`, which is a different registration and is not his:
registered **2021-07-23T16:46:41Z**, expiring 2027-07-23, registrar **Global Domains International,
Inc. DBA DomainCostClub.com**, status `autoRenewPeriod` and `clientTransferProhibited`, nameservers
`park1-4.dns.ws`, serving a parking page. Read from
`pubapi.registry.google/rdap/domain/grit.app`. The reverse-DNS form of `grit.chat` happens to spell
`chat.grit.app` only because of the two TLDs; it is not a subdomain of `grit.chat` and owning
`grit.chat` confers nothing over it.

**The identifier still works, and the distinction is worth being precise about:** a bundle id is a
free form reverse DNS string, and neither Apple nor Google verifies it against domain ownership.
Nothing about this build depends on either domain.

**Where it does become load bearing:** Universal Links need an `apple-app-site-association` file
served over HTTPS from the domain named in the app's associated-domains entitlement, and Android App
Links need `assetlinks.json` the same way. Those files have to live on a domain Jason controls. He
controls `grit.chat`; he does not control `grit.app`. So deep linking has to be associated with
`grit.chat` (or `app.grit.chat`) regardless of what the bundle id spells, or the id has to change.
**That is an open question on this pull request, not a decision taken here.**

**The commands recorded in the rungs below are left exactly as they were run, naming the old id.**
They are evidence of what happened, not instructions, and editing them to say `chat.grit.app` would
make this file claim proofs that were never performed under that identifier. To repeat any of them
today, substitute the new id.

Three consequences, none of them cosmetic:

- **A new bundle id is a different app.** iOS and Android both key an installed app by identifier, so
  a build under the new id installs ALONGSIDE the old one rather than upgrading it. Nothing is
  migrated: container, keychain identity, contacts and message history stay with the old app.
- **The rung 2 hardware proof lives in the old app's container on BushidoPhone.** That proof is
  already recorded here with its real values, and the trace files it produced are quoted below, so
  the evidence survives. What does not survive is the ability to open that app and see its history
  under the new id: it is a different app, with an empty store and a new node identity.
- **Any store record under the old id does not carry over.** A bundle id is the primary key of an App
  Store record, which is why this was done before submission rather than after.

Signing was verified rather than assumed, because a wildcard is not automatically a match. The
profile `iOS Team Provisioning Profile: *` under team `8H7HVPHS87` carries `application-identifier`
`8H7HVPHS87.*`, which is a true wildcard and therefore does match `chat.grit.app`. It is a
development profile (`get-task-allow` true), expires 2027-08-20, provisions five devices INCLUDING
BushidoPhone `[REDACTED-DEVICE-UDID]`, and its `keychain-access-groups` entry `8H7HVPHS87.*`
covers the new id, which is what `react-native-keychain` needs to store the node identity. It
carries no `aps-environment`, so remote push would need a real App ID; local notifications, which is
all this app raises, need no entitlement.

**What that evidence is scoped to.** Every string above is keyed to team `8H7HVPHS87`: the wildcard
is `8H7HVPHS87.*` and so is the keychain access group. A sibling agent researching store enrolment
reports that Apple does not document whether converting an individual account to an organization
preserves the team id, and that transferring an app is unavailable until it has shipped at least one
release. If that team id ever changes, this verification does not carry over: the wildcard, the
keychain access group and the provisioned device list all move with it, and they would need
re-checking rather than assuming. The check itself is cheap to repeat: decode the profile and read
`application-identifier`, `get-task-allow`, `ProvisionedDevices` and `keychain-access-groups`.

### What was verified under the new id, on a SIMULATOR

Simulator `39D75162-899C-4D3D-A2FB-9067E8463644`, not a phone. Release build with the relay baked,
installed and launched by `simctl` under `chat.grit.app`, sending through a `hop-relayd` on
`127.0.0.1:18765` to a `grit-relay-node listen` second party:

```
delivered: True | forwardHops: 2
relayUrl: ws://127.0.0.1:18765/ | relayState: up
body: grit proof RENAME1
```

And the second party's own log, so this is not only the app's account of itself:

```
INBOX from=3J5SsCUgssUtYzc8mNyAss3wJbE4N2BHwo1R5UJq1Mha hops=2 accepted=true body=grit proof RENAME1
```

Artifact level, both platforms: `CFBundleIdentifier` in the built `.app` reads `chat.grit.app`, and
the packaged `AndroidManifest.xml` inside `app-debug.apk` contains `chat.grit.app` and no
`com.burnchat`. The Kotlin package tree moved to `chat/grit/app` and `:app:compileDebugKotlin`
succeeds, which is the check that would have caught a half-renamed package.

The Detox suite was run against the renamed app: **13 of 14, 81 of 83 steps**. The one failure is
`Refused location permission is said plainly`, which is red on `main` for reasons that predate this
change and is fixed on another branch. Three earlier failures in the same run were NOT this rename
either: they were the media and location scenarios on a machine whose hand-made `/tmp` fixtures had
been deleted, and they passed once the fixtures existed. Attributing them to the rename would have
been the easy and wrong conclusion.

## The ladder

Each rung is reported separately and never in words that could be read as the rung above it. A
simulator is never called a phone.

| Rung | What it is | State |
|---|---|---|
| 0 | The app builds and launches on an iPhone 17 Pro **simulator** | **Passed on SIMULATOR `40E844EA-723C-430F-ADFE-F8C29AA21722`.** Conversation list rendered and was read. |
| 1 | **Simulator** plus a command line node, through a local relay | **Passed on that same SIMULATOR**, through a hop-relayd built from current `origin/main` (merge `2252587`, hop PR #64). `delivered=true`, `forwardHops=2`. Trace below. |
| 1c | **Channels** (hps://) on the SIMULATOR: host, join, publish, and a second node reading and replying | **Passed on that SIMULATOR, both directions.** `ok=true`: host to member delivery acked (`reachAfter=1`), and the member's own publication reached the app and was persisted with its verified writer. Trace below. |
| 2 | **BushidoPhone** (physical) plus a command line node, through the local relay over the LAN | **PASSED on the handset.** One to one `delivered=true`, `forwardHops=2`, bundle `tnvLRo3HB/ZM5gdS5qm2m09fGA5Joq18Ij4IVSwH4y0=`; channel `center-camp` round trip `ok=true` with the reply's writer verified. Traces below. |
| 3 | Physical iPhone XR fingerprint `47677f5c8bf3` and physical Pixel 7 fingerprint `99fee17211cb` through the relay | **PASSED.** The Pixel rendered `GCPHYS-BEB09E02-2FF3-4032-BD3C-6C5B69457DE6`; the sender trace reported `delivered=true`, `forwardHops=2`. Relay transport only. |


## The Android ladder

Same rule: an emulator is never called a phone, and a Pixel is not an iPhone. Android exists because
Jason chose React Native to get both platforms from one codebase, and it arrived after the iOS bar
was met, not instead of it.

| Rung | What it is | State |
|---|---|---|
| A0 | Builds and launches on the `Pixel_6a_API_34` **emulator** | **Passed on EMULATOR.** Every screen rendered and was read. Two real parity defects found and fixed, below. |
| A1 | **Emulator** plus a command line node, through a local relay | not run yet. The emulator build carries `ws://10.0.2.2:18765/`, which is the emulator's route to this Mac. |
| A2 | Physical Pixel 7 fingerprint `99fee17211cb`, Android 17, with Grit Chat's embedded proof bundle | **PASSED.** Fresh install, first-run local-network permission, relay connection, and an inbound message were exercised. Build `0d58b8c` displayed in the app. |
| A3 | Physical iPhone XR fingerprint `47677f5c8bf3` to physical Pixel 7 fingerprint `99fee17211cb` through `hop-relayd` | **PASSED.** A fresh nonce reached the Pixel and its rendered conversation. The sender trace returned two-hop delivery. |

### The Hop Android artifact

`sh.hop:hop:0.0.5`, built by `sdk/android/build-aar-dev.sh` from hop main `54a2e82`, the SAME commit
the iOS artifacts came from, so one C ABI (6) serves both platforms. Vendored as one archive with a
checksum gate, provenance and revert plan in `vendor/README-android-artifact.md`. It is unsigned,
published nowhere, and **shipping Android needs a real release**, exactly as channels do on iOS.

### Two Android parity defects, found by looking at the screen

1. **Every icon was a tofu box and every font fell back to system.** iOS gets the nine TTFs from a
   Copy Bundle Resources phase and Font Awesome from the vector-icons pod; Android resolves a
   `fontFamily` by FILE NAME under `assets/fonts` and nothing put them there. The wordmark came up
   in Roboto instead of Barlow Condensed and the mono relay line was proportional. Fixed by a
   build-time copy from `src/design/fonts` (still the single source of truth, no committed second
   copy) plus the vector-icons `fonts.gradle`. Verified: ten TTFs inside the APK, and the rendered
   screen now shows Barlow Condensed, IBM Plex Mono and all five glyphs.
2. **`textTransform: 'uppercase'` measures wrong on Android.** "Show my address" rendered as
   "SHOW MY / ADDRESS" over two lines inside a full width button with room to spare, while the two
   ghost buttons beside it, which carry no transform, sat on one line: Android measures the original
   string and draws the transformed one. Uppercasing in JS at the render site fixed the class (four
   sites: header, primary button, field label, section title). A second, separate Android quirk
   surfaced underneath it: with `numberOfLines`, Android's ellipsizer does not account for the
   letter spacing it adds after the final character, so the label clipped to "SHOW MY ADDRE..." in a
   box its own measurement said was wide enough. Tracking on that one label is now 0, measured both
   ways.

### Android end to end: blocked upstream, and not faked

The androidTest source set, runner, Detox dependency and `android.emu.proof` configuration are
wired, and the suite still cannot run. Two upstream walls, in order:

1. Detox 20.28.0's `ReactNativeLoadingMonitor` calls `getReactNativeHost()`, and RN 0.87's New
   Architecture throws `You should not use ReactNativeHost directly in the New Architecture` on that
   call. Detox 20.34.2 clears that one: its monitor uses `reactHost as ReactHostImpl`.
2. Detox then dies in `NetworkIdlingResource`, and this one has no version to upgrade to. Detox
   reflects React Native's OkHttpClient by the field name `mClient`:
   `NetworkingModuleReflected.kt` line 13, identical in 20.28.0, 20.34.2 and 22.0.0-rc.0. RN 0.87
   rewrote `NetworkingModule` in Kotlin, and `javap` on the artifact the app actually links
   (`react-android-0.87.0-debug.aar`) shows `private final okhttp3.OkHttpClient client`. No
   `mClient` exists, the reflection returns null, and `getHttpClient().dispatcher()` throws a
   NullPointerException before any scenario starts. The upstream fix is one line: try `client` and
   fall back to `mClient`.

**So the pin stays at exactly 20.28.0, and that decision is the interesting part.** Upgrading to
20.34.2 to clear wall 1 breaks iOS: every one of the fourteen scenarios fails at the `isReady`
handshake, the app renders correctly on screen while never answering Detox, and the suite burns
twenty eight minutes timing out fourteen `Before` hooks at 120 seconds each. Measured both ways on
this machine: 20.34.2 red on iOS and still blocked on Android, 20.28.0 green on iOS and blocked on
Android at wall 1 instead of wall 2. Since Android cannot run either way, the version that keeps
the iOS regression net alive wins. The pin is exact rather than a caret range, because `^20.28.0`
lets a fresh install resolve 20.34.2 and reintroduce the iOS failure silently, which is exactly how
it got in: CI runs the xcframework materialize, `swift build`, `tsc` and `jest`, and never Detox, so
that regression would have merged under a green check.

What was deliberately NOT done: Detox accepts a launch argument that disables synchronization
entirely (`enableSynchronization=0`), which makes the suite run by turning off the idle waiting that
makes Detox trustworthy. A suite that goes green because it stopped synchronising is worse than no
suite, so Android has NO end to end coverage today and the iOS suite remains the only regression
net. The harness stays in the tree because it is correct and will run the day upstream fixes that
field name.

## If the app receives nothing while looking perfectly idle, read this first

**Symptom:** outbound works, inbound never appears, no error on screen, and the console repeats
`ReferenceError: Property 'TextDecoder' doesn't exist` at the pump interval (every 250ms).
**Cause:** a throw inside an inbound handler. The handler is what ACCEPTS an inbox item or an hps
publication, so a throw means the item is never accepted, the core redelivers it on the next poll,
and the loop repeats forever while the UI shows an empty conversation. Hermes has no `TextDecoder`,
which is why the SDK's `bytesToUtf8` threw there; `src/hop/utf8.ts` owns that decode now and never
throws. It cost most of a session and read exactly like a transport fault, so suspect the handler
before the relay.

## The failure that used to block current relays, now fixed upstream

The app's node is hop-sdk-apple v0.0.2 and speaks bundle wire v14. Until hop PR #64 merged,
`is_supported_bundle_version` in hop-core accepted exactly ONE version, and the v13 to v15 bumps
had changed no wire layout and no semantics at all: they existed because a guard script hashes
those source files whole, so editing a comment cost a version bump. A v15 relay therefore rejected
byte-identical v14 bundles at `verify()` and dropped them with no log, no counter, no error to the
sender. That produced exactly the shape measured here against a then-current relay: send sealed,
`relayed=1`, delivery never confirmed, listener INBOX silent.

On main now: `BUNDLE_VERSION = 16`, `MIN_SUPPORTED_BUNDLE_VERSION = 13`, and the whole
byte-identical family is accepted. Verified in the build worktree before the rung 1 run below.

### History: the `699ba51` relay, and why it is no longer needed

Before PR #64, rung 1 could only pass against a relay built from hop commit
`699ba51` (workspace 0.0.2, the Apple checksum pin), which still accepted v14.
Building it needed two absent workspace members (`services/hop-billingd`,
`services/hop-accountd`) dropped from `Cargo.toml` in a throwaway worktree.
That workaround is retired: current main delivers, below, with none of that
surgery.

## Prerequisites

Build a relay from current main. Nothing is removed from the workspace; this is a plain build:

```
git worktree add /tmp/hop-relayd-main origin/main   # from the hop checkout, does not edit it
cd /tmp/hop-relayd-main && CARGO_TARGET_DIR=/tmp/relayd-main cargo build -p hop-relayd --release
```

`rustup`-managed cargo must be on PATH for this and for the xcframework build
(`export PATH="$HOME/.cargo/bin:$PATH"`). Homebrew Rust ships host std only: it cannot
cross-compile the iOS slices, and the failure reads as a missing rustup target rather than as the
wrong cargo, which costs a build cycle to work out.

**Start the relay on an EMPTY store, in this order, and check the boot line.** A relay that has
accumulated undelivered bundles from earlier runs floods them at the first peer to connect, and
that interacts badly enough with a reconnecting client to drop other clients' links. Every run
recorded below started from `held=0`:

```
# stop any relay already on the port FIRST, then wipe, then start: wiping under a live relay
# leaves it holding the old store and the boot line still shows a backlog
rm -rf /tmp/gc-relay-run && mkdir -p /tmp/gc-relay-run
/tmp/relayd-main/release/hop-relayd --ws 0.0.0.0:18765 --db /tmp/gc-relay-run/hop-relay.db
```

```
18:42:15 relay up: region=local node=<fresh identity per store>
18:42:16 stats: peers=0 held=0        <- held=0 is the check
```

Then confirm it answers and identify it:

```
curl -sS http://127.0.0.1:18765/healthz        # ok
curl -sS --max-time 8 http://127.0.0.1:18765/  # banner names the relay node
```

The relay identity is a property of the STORE, so a fresh store means a fresh node address; the
rung 1 run below used `4M7UZYCQbKqu1m87h7emXSF5rdP16tyVaYdqgqQ8wUnG`, and the rung 1c run used a
different one. Neither value is something to match against.

`wss://relay.hopme.sh/` is not a substitute. The production fleet is off.

## The Detox suite, and how it was proven to fail

Fourteen scenarios, eighty three steps, against the iOS simulator only, covering the flows the rungs
above prove: the designed empty state, add contact by pasted address and refusal of a bad one,
delivery progression to `delivered via 2 hops` against a live relay and listener, a channel
publication with its verified writer, a voice note recorded and delivered with its play control, a
photo arriving with its route, a join request waiting for approval, an invite accepted and removal
measured as an absence, clearing the relay showing `relay not set`, the scanner screen rendering
with the camera permission pre-granted, an inbound location rendering with its accuracy, refused
location permission said plainly, and sharing into a channel naming the fan-out.

```
npm run e2e:build:ios                                  # builds the app with GRIT_RELAY_URL baked in
npm run e2e:ios                                        # full suite, 14 scenarios
npm run e2e:guard                                      # the testids lockstep check, no device
```

Relay scenarios spawn hop-relayd (empty store) and this repo's `grit-relay-node` from
`e2e/support/world.js`, and they relaunch the app AFTER the relay is live: the app boots before
the relay exists, its first dial fails, and the redial backoff can outlive the delivery window.
The peer binary path is the one in Prerequisites; a missing binary fails loudly with the build
command rather than skipping. Every scenario gets a fresh app (`delete: true`, with camera,
microphone, photos and location permissions pre-granted so a system alert can never block a
step), and a failure leaves a screenshot under `artifacts/` plus the peer's own log in the step's
error.

The suite is trusted because every scenario class was watched FAIL, and each feature's new
scenarios were sabotaged again as they landed:

| Sabotage | Failure |
|---|---|
| rename `chat-input` in a screen | the fast guard fails in both directions and names the id |
| rename `conversations-empty` | "element not visible" on the empty-state step |
| rename `add-contact-save` | the add-contact step cannot find the button |
| expect `delivered via 3 hops` | `never reached "delivered via 3 hops"; last trace was "delivered via 2 hops"` |
| expect a reply body that never arrives | `no reply with a writer appeared; last row body was "grit channel reply from the peer"` |
| rename `identity-relay-apply` | the clear-relay step cannot find the button |
| rename `add-contact-scan-note` | the scan step cannot find the note |
| rename `scan-camera` | the guard fails in both directions; the scanner scenario fails with No elements found |
| rename the `message-media-` prefix | the guard fails in both directions; the voice scenario fails with No elements found |
| expect a wrong inbound route | `inbound trace does not name the route: "2 hops to reach you"` |
| rename `manage-approve-` | the guard fails naming the id |
| make removal a no-op in the seam | `the removed member received 1 post(s) after the rotation` |
| rename the location `-coords` id | the guard fails; the inbound-location scenario fails with No elements found |
| rewrite the fan-out copy to say host-only | `fan-out not named plainly: "SABOTAGE: ..."` |
| break the permission message to a generic one | the unit test fails: expected "Location permission is off", got the sabotage text |

After every restore the full suite runs green again (14 scenarios, 83 steps).

What the suite does not claim: the composer's send BUTTON is not driven (any text entry raises the
keyboard and the button sits under it; the composer submits on the return key, which is the path
the scenarios use, and the button is covered by the lockstep guard); the photo PICK sheet is
out-of-process system UI Detox cannot tap (the send path after it is unit tested, inbound photos
are proven from a second node); the camera DECODE path needs a real camera, which a simulator does
not have. Nothing on Android, nothing on a handset, nothing on a radio.

## Location on a simulator: what cannot be proven, and the evidence

The GPS READ cannot be driven on this simulator. CoreLocation never delivers a fix to the app
under a pre-granted permission, and two distinct mechanisms were measured:

1. An unanswered authorization prompt from an early run leaves the request "in flight" in
   locationd, which then ignores every later request from the app for about nine minutes while
   the permission itself is granted the whole time:
   `"Authorization request ignored because another authorization effort is already in flight",
   InflightRequestSquattingDurationSeconds: 538`. A simulator reboot clears it.
2. After the reboot, with permission granted (locationd shows `newAuthContext: InUse:5`) and a
   streaming location scenario running, the app's CLLocationManager only ever issues
   `stopUpdatingLocation` and never `startUpdatingLocation`, so no fix is ever delivered, under
   both the library's `getCurrentPosition` and a one-shot `watchPosition`, and with the explicit
   authorization request both skipped and not skipped.

The two scenarios that need a live fix (`@needs-gps` in the feature file) are excluded from the
simulator profiles and run on hardware. Everything around the read IS proven: the wire shape and
validation, the distance and bearing math against real-world vectors, every error branch, inbound
rendering from a real message, the fan-out confirmation, and the permission degradation reaching
the real UI. The delivery mechanics the GPS scenarios would exercise are proven by the text,
image, and voice scenarios through the same send path.

## Rung 0, what was on the SIMULATOR screen

Device: freshly created iPhone 17 Pro **simulator** `40E844EA-723C-430F-ADFE-F8C29AA21722`.
The originally named simulator `490DDBFC-B605-421B-857C-8473E138090C` wedged on a black boot
spinner with no app installed and was abandoned. Both are simulators. Neither is BushidoPhone.

Conversation list (`/tmp/gc-r1-pass.png`, read):

- Dark dusk-indigo canvas.
- "GRIT CHAT" in condensed bone-white caps. Barlow Condensed resolved.
- Font Awesome glyphs as real icons, not tofu: QR, signal bars, user-plus.
- Relay pill: "relay carrying" with an amber underline.
- After the passing proof: row `ASR1Ah...swGsx` / `you: grit proof V002APP-1`.
- No redbox. No emoji used as an icon.

## Rung 1, the SIMULATOR command (passed through a current main relay)

```
swift run grit-relay-node listen ws://127.0.0.1:18765/
xcrun simctl launch 40E844EA-723C-430F-ADFE-F8C29AA21722 com.jwaldrip.gritchat \
  --grit-reset-store --grit-proof-peer <listen address> --grit-proof-nonce <NONCE> \
  --grit-screen chat --grit-chat-peer <listen address>
```

The passing run, relay built from `origin/main` at merge `2252587` (hop PR #64),
listener `HMo95mLa9SiKoF7A239eyc8G398EioSkFvF4sHEFfRoi`, nonce `MAINRLY-1`:

```
{
  "selfAddress": "Hdz4vNYkPBqS9zqofAqpRWi5cLGzNa2ZRdRV6RJNK3V5",
  "peerAddress": "HMo95mLa9SiKoF7A239eyc8G398EioSkFvF4sHEFfRoi",
  "nonce": "MAINRLY-1",
  "body": "grit proof MAINRLY-1",
  "relayUrl": "ws://127.0.0.1:18765/",
  "relayState": "up",
  "isPersistent": true,
  "prekeyPublished": true,
  "ok": true,
  "delivered": true,
  "relayed": 1,
  "forwardHops": 2,
  "forwardMs": 13783,
  "timedOut": false,
  "elapsedMs": 796,
  "statusHistory": [
    {"relayed": 0, "delivered": false, "forwardHops": 0, "forwardMs": 0},
    {"relayed": 1, "delivered": false, "forwardHops": 0, "forwardMs": 0},
    {"relayed": 1, "delivered": true, "forwardHops": 2, "forwardMs": 13783}
  ]
}
```

Listener, same run:

```
INBOX from=Hdz4vNYkPBqS9zqofAqpRWi5cLGzNa2ZRdRV6RJNK3V5 hops=2 accepted=true body=grit proof MAINRLY-1
```

On screen (`/tmp/gc-r1-main.png`, read): one outbound bubble, sage run of two
nodes with the terminal check, `delivered via 2 hops`, no duration. Bottom
anchored above the composer. Header is the short address, one line.

Earlier passes `V002APP-1` and `V002UI-2` delivered identically
(`forwardHops=2`) but through the `699ba51` relay described in the history note
above. The current relay is the documented path.

`40E844EA-...` is a **simulator**. It is not the handset.

## `forwardMs` is not a duration you can show

The protocol field `forwardMs` arrived as `57120` (`V002APP-1`), `41910`
(`V002UI-2`) and `13783` (`MAINRLY-1`) while the sender's own wall clock for the
same sends (`elapsedMs`) was under or about a second. The clocks in this setup
are not a shared time base, so `forwardMs` is not a measured transit time.
Showing it as `42 s` would have told the user the message took forty two
seconds, which is not what happened.

The product UI therefore does not display `forwardMs`, and the conversation store
does not persist it. The hop count (`forwardHops`) is the number that is real.
`grit-proof.json` still records the raw protocol field so a later investigation
can see what the core reported.

If clocks are later proven sane across a real relay, that is the moment to put a
duration back on the bubble, with evidence. Not before.


## Rung 1c, channels (hps://): passed, both directions

Channels reached React Native in hop PR #62 (C ABI 5 to 6). No published `hop-sdk-apple` release
carries them, so this branch pins local development artifacts built from hop main `54a2e82`. What
they are, how they were verified, and how to rebuild or revert them: `ios/hop-pods/README.md`.
**Shipping Grit Chat with channels requires a new published hop-sdk-apple release, which does not
exist yet.**

The command:

```
# relay: stop any old one, EMPTY its store, start, and confirm held=0 in the boot line
/tmp/relayd-main/release/hop-relayd --ws 0.0.0.0:18765 --db /tmp/gc-relay-zero/hop-relay.db

# app: the relay endpoint is a BUILD SETTING, not a default. Without it the app runs with no relay
# and every proof reports relayState=unconfigured.
xcodebuild -workspace ios/GritChat.xcworkspace -scheme GritChat -configuration Debug \
  -sdk iphonesimulator -destination 'id=40E844EA-723C-430F-ADFE-F8C29AA21722' \
  GRIT_RELAY_URL='ws://127.0.0.1:18765/' build
xcrun simctl install 40E844EA-723C-430F-ADFE-F8C29AA21722 <GritChat.app>
xcrun simctl launch  40E844EA-723C-430F-ADFE-F8C29AA21722 com.jwaldrip.gritchat \
  --grit-channel-proof center-camp --grit-screen channel --grit-channel-path center-camp

# second node, subscribing to the app's channel
swift run -c release grit-relay-node channel-peer ws://127.0.0.1:18765/ <app address> center-camp \
  "grit channel reply from the peer"
```

Both halves of the join are instrumented, because the two candidate causes of a silent channel
(no content key vs no delivery) look identical from the outside. The proof also publishes TWICE on
purpose: see "why the second post exists" below.

The subscriber joined, received the post-join publication, and published a reply:

```
status joined=false topics=0 received=false replied=false
subscribe id=... path=center-camp
HPSINBOX from=Hdz4vNYkPBqS9zqofAqpRWi5cLGzNa2ZRdRV6RJNK3V5 path=center-camp body=grit channel proof ch-w594ol post-join
reply id=... body="grit channel reply from the peer"
status joined=true topics=1 received=true replied=true
```

The app's trace (`Documents/grit-channel-proof.json`):

```
ok                  = True
listedAfterRegister = True
memberJoined        = True
publishId           = ...                 <- published before any member joined
postJoinPublishId   = 2IUj6dIlxk4hl+abE4O0kapmkkoI38+4o0F32UZhhbg=
membersAfter        = ['6S4EvhAjmcLkS9TgrF5FWdTQ4JKmGqhs9SnJBMsBkdrP']
reachAfter          = 1
reply               = {'sender': '6S4EvhAjmcLkS9TgrF5FWdTQ4JKmGqhs9SnJBMsBkdrP',
                       'body': 'grit channel reply from the peer'}
relayState          = up
```

The app's channel store after the run, three messages, the third from the peer:

```
sender: None                                          body: grit channel proof ch-w594ol
sender: None                                          body: grit channel proof ch-w594ol post-join
sender: 6S4EvhAjmcLkS9TgrF5FWdTQ4JKmGqhs9SnJBMsBkdrP  body: grit channel reply from the peer
```

On screen (`/tmp/gc-channel-roundtrip.png`, read): two outbound posts marked published in sage,
the inbound reply on the leading edge with its verified writer labelled, header "you host, 1
acked", no redbox.

### Why the second post exists

A Hop publication is flooded ONCE. The first post is published as soon as the relay link is up,
which is before any subscriber has the content key, so a member who joins afterwards has no claim
on it and its absence proves nothing about delivery. An earlier version of this proof published
only that first post and reported "publication delivery is broken", which was wrong: the relay log
showed the subscriber connecting about nine seconds AFTER the publish. The proof now waits for the
host to retain a member and publishes again, and that second post is the one delivery is judged on.

### What this proves

- The app hosts a channel through the seam: `hpsRegister` returns an EMPTY key, which is a
  channel's success shape, and the app treats it as success rather than as falsy failure.
- The node's own store lists the topic (`listedAfterRegister=true`), which is what channel
  survival across restarts rests on, and the app reconciles its channel list from that list.
- The join key handoff completes: the host retains the subscriber as a member and the subscriber
  independently reports `joined=true`.
- **A channel message crosses in BOTH directions.** The post published while a member held the key
  reached that member and was acked back to the host (`reachAfter=1`), and the member's own
  publication reached the app, which persisted it with the verified writer address. Both halves are
  single content-key-encrypted publications flooded once through a relay, between two independent
  nodes.
- The ABI 6 pairing links and runs: the app builds against the dev pods, and `hop_abi_version()`
  in the vendored framework probes as 6 with `hop_hps_register` and `hop_relay_add` present.

### What it still does not prove

- **Invites, approval, revocation.** `hpsInvite`, `hpsApprove`, `hpsDeny`, `hpsRekey` are wired in
  the seam, exercised nowhere, and no moderation UI exists.
- **Anything on a handset, or any radio.** This is a simulator plus a command line node, over a
  relay.

### Three defects in THIS repo found while chasing that, all fixed

- **Inbound decoding threw on Hermes.** The SDK's `bytesToUtf8` is `new TextDecoder().decode(...)`,
  and Hermes has no `TextDecoder`. That threw inside the inbound handlers, which are what accept an
  item, so EVERY inbound message and channel publication died before the store saw it, the core
  never got its accept, and the item was redelivered every pump tick: `ReferenceError: Property
  'TextDecoder' doesn't exist` repeating every 250ms while the app looked like it was simply
  receiving nothing. `src/hop/utf8.ts` now owns the decode and never throws. This was the entire
  reason the inbound half of the channel looked broken.
- **Relay redial had no backoff.** Every attempt reset the counter, so a failed connect was retried
  immediately, forever: measured 162 connections to a local relay in under two minutes, and that
  storm dropped OTHER clients' connections to the same relay within about 300ms of their
  connecting. Retries are now paced (2s doubling to 30s) and only a link that actually carries
  clears the counter.
- **The channel proof could hang forever.** It awaited a promise that only resolved when a reply
  arrived, so a run with no reply never wrote its trace and looked exactly like a proof that never
  ran. The deadline is now the only thing that ends that wait, and phase markers are persisted as
  the run progresses.

## Rung 2, the bar (PASSED on BushidoPhone, physical iPhone 17 Pro)

BushidoPhone is paired:

```
marketingName: iPhone 17 Pro
udid: [REDACTED-DEVICE-UDID]
developerModeStatus: enabled
osVersionNumber: 26.6
CoreDevice id: [REDACTED-DEVICE-IDENTIFIER]
```

The relay ran from an operator-controlled local endpoint. Its address and node identity are retained
in the private evidence record.

### The signing wall, corrected

An earlier version of this section recorded the wrong cause. The build error was
`No Account for Team "LY77W79566"` and that note blamed a missing identity plus profiles owned by
another team. The truth: a stale team label baked into a certificate name. The only Apple
Development identity in the keychain is named `Apple Development: Jason Waldrip (LY77W79566)`, but
that certificate IS the development identity for team `8H7HVPHS87` (Jason Waldrip, Individual,
paid): it is the certificate embedded in that team's on-disk wildcard profile, fingerprint-matched.
With no `DEVELOPMENT_TEAM` set in the project, signing resolved its team from the certificate's
name, found no account for `LY77W79566`, and stopped. The fix was one build setting:

```
xcodebuild ... DEVELOPMENT_TEAM=8H7HVPHS87
```

That builds fully offline against the existing wildcard profile
(`iOS Team Provisioning Profile: *`, UUID `[REDACTED-PROFILE-IDENTIFIER]`, app id
`8H7HVPHS87.*`, expires 2027-08-20, five devices including this exact UDID). No password prompt,
no network round trip, no App ID registered with Apple. A dev install on his own phone under his
own profile commits him to nothing; the which-team-ships decision is still unspent.

### What actually blocked the first device attempts (three findings)

1. **A Debug build cannot run headless on hardware.** Launched outside an Xcode debug session it
   has no route to Metro, so JS never loaded and the app never dialed the relay; the install looked
   fine and the screen sat inert. The proof build is Release, `main.jsbundle` embedded.
2. **`devicectl device process launch` takes positional arguments.** There is no `--arguments`
   flag: `--grit-proof-peer,X` as one comma-glued token lands in argv as a single element that
   never matches, the proof silently never fires, and no trace file appears. The working form is
   `... <bundle-id> --grit-proof-peer <addr> --grit-proof-nonce <n>`.
3. **iOS launches are refused while the device is locked** (`the device was not, or could not be,
   unlocked`). The phone has to be unlocked by hand; retries are useless until it is.

### The one-to-one proof, real values off the handset

Second party: `grit-relay-node listen` on the operator workstation. The raw app-container trace is
retained privately:

```text
selfAddress: [REDACTED]
peerAddress: [REDACTED]
relayUrl:     [REDACTED-OPERATOR-ENDPOINT]
bundleId:     [REDACTED]
ok: true  delivered: true  timedOut: false  elapsedMs: 1121
statusHistory: relayed=0 -> relayed=1,delivered=false -> relayed=1,delivered=true,forwardHops=2,forwardMs=3791
```

Delivery confirmed by the destination, two forward hops: the bar. One earlier attempt against a
listener that had been connected for eleven minutes timed out at `relayed=0` (the bundle never
entered the relay); a fresh listener on a fresh relay passed in 1.1 seconds. The failure was not
reproduced with the public event stream on, and if it recurs `HOP_PUBLIC_LOG_STREAM=1` on the
relay is the tool that will catch it.

### The channel proof, real values off the handset

Second party: `grit-relay-node channel-peer` on the Mac, subscribed to `center-camp` hosted by the
handset. Trace pulled from `Documents/grit-channel-proof.json`:

```
path: center-camp  ok: true  elapsedMs: 1589
publishId:       KqqV5qQyQrJYi/Gub69pMwfq/X5SWa1MV4QJWWJFUEk=
postJoinPublishId: tRNS4LY4CRbZStuhR0H1y8iczw0MrUMkJ86PA+KrSmY=
memberJoined: true  listedAfterRegister: true  reachAfter: 1
reply: {sender: 9fmG4Hm9PdZFPV27H5aLYaDQVA7b816xS2Cd3gYykxjm,
        body: "campfire answers from the Mac"}
```

One content-key-encrypted publication crossed the relay to a second independent node, that node
published back through the same path, and the writer verified under the channel keys.

### Local network permission, named before it bit

The first LAN dial on real hardware can be blocked by the iOS local network permission, and the
OS error reads as a dead relay: the same silent-misdiagnosis class as the Hermes decoder throw.
iOS exposes no query API, so the app cannot diagnose; when a LAN relay is down or retrying it now
says so conditionally and points at Settings > Privacy & Security > Local Network (commit
`ec9d347`, loopback and public hosts excluded). On this run the phone connected one second after
launch, so the gate was already open here.

### Still open on the handset

**Screenshots were not readable from this Mac.** The phone is attached over Wi-Fi (CoreDevice),
not USB: `devicectl` has no screenshot verb, `idevicescreenshot` needs USB plus the old disk-image
screenshot service, and QuickTime mirroring needs a cable. The SplashBoard app-switcher snapshots
were pulled from the container, but Apple's `AAPL` container is not plain ASTC (every standard
block size and offset decoded to noise; the tagged `astc` section is 3,440,656 bytes at 0x4000,
which fits no standard block grid for 1206x2622). Reading the real screen at real density needs
one of: the phone on USB, or Jason pressing side + volume up and sharing the shots.

## History: the Swift app this repo once carried, and why it is gone

The first app in this repo was SwiftUI, and its proof was `swift run burnchat-smoke`: two Hop
nodes over an in-process `LoopbackBearer` pair. That proof was worth exactly what it said, no
more: no message ever left the device, no relay was crossed, and no phone was involved. It stayed
in the tree as a safety net only while it was the more-proven path. Rung 2 inverted that: the
React Native app has now crossed a real relay, from a physical iPhone, with delivery confirmed at
two hops, in both direct messages and channels. A loopback pipe is not a safety net for that, so
the Swift app, its tests, and its smoke target are deleted (the manifest keeps exactly one target:
`grit-relay-node`, the second node every rung on this ladder dials). Nothing here should ever tell
you to run `burnchat-smoke` again; if a message needs proving, this ladder is the proof.

## What the proven paths do not prove

- **Radio discovery or direct local delivery.** Current proof builds package native Bluetooth and
  LAN bearers, but no physical BLE-only or LAN-only nonce receipt is recorded in this ladder yet.
  The physical Test iPhone XR reports iOS Local Network `NoAuth` pending interactive approval.
  Every claimed direct message rung above crossed a relay.
- **The production `wss://` fleet.** The relay here is local, and the fleet is off. The bundle
  version fix (hop PR #64) means current-main relays accept this app's v14 bundles, so the fleet
  is no longer a version-compatibility question, but it has not been dialed.
- **A delivery duration.** `forwardMs` in this setup is not a transit time. See the section
  above. The hop count is the proven number.
- **Channel moderation.** The round trip is proven (rung 1c on the simulator, rung 2 on the
  handset); invites, approval and revocation are wired in the seam and unexercised beyond the
  suite's scenarios, and no moderation UI exists.
- **A published SDK.** Channels run on locally built dev artifacts (hop main `54a2e82`), not on any
  released `hop-sdk-apple`. That release does not exist yet.

One rule for anyone re-running the ladder: **the Detox suite and a staged device relay must never
hold port 18765 at the same time.** A relay left up during a suite run fails every relay scenario
and it reads like a product regression; it is not, it is this port.

## Cross-platform physical handset proof

The proof build is `0d58b8c`, based on public `main` `bc56033` after PR #8. Both packages identify
as `chat.grit.app`, version `1.0` build `1`.

- **Physical iPhone XR**, device fingerprint `47677f5c8bf3`.
- **Physical Pixel 7**, device fingerprint `99fee17211cb`.
- **Simulator inventory** was enumerated separately and did not supply either endpoint.

The relay health check returned `ok`; the non-service control refused its connection. The iPhone and
Pixel each used the RelayBearer to reach that verified relay. The fresh nonce
`GCPHYS-BEB09E02-2FF3-4032-BD3C-6C5B69457DE6` arrived on the Pixel, whose rendered conversation
reported `Received. 2 hops to reach you.` The sender trace returned `delivered=true`, `relayed=1`,
`forwardHops=2`, and `timedOut=false`.

The operator record, raw trace, hierarchy, exact commands, and reviewed physical receipt screenshot
are stored in the private evidence record at
`Grit-Chat-App/grit-chat-company-records` PR #2.

### Limits

The React Native SDK exports a relay pool and no mobile BLE or LAN bearer implementation.
`src/hop/relayBearer.ts` is the only transport implementation. Radio discovery requires source
implementation before it can be claimed. Channels remain blocked for release by the missing
published ABI 6 SDK.
