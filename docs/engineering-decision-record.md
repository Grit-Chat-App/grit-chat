# Engineering decision record, carried over from the pre-seed history

This repository begins at one commit. The history it replaced is not lost: it lives in a durable
mirror outside this repository, and this file carries the reasoning from it so that "why is it done
this way" survives the reset.

**What this is.** The subject and body of every engineering commit from the previous repository, in
order, with its SHA. The diffs are not here. To read one, use the mirror:

```sh
git -C <mirror> show <sha>
```

**Why the previous history was replaced.** It carried company, entity and tax documents that were
written while the repository was private, and GitHub serves a merged pull request's file list
permanently on four separate surfaces, so removing them from branches did not remove them from the
repository. Reseeding was the only way to close that. The company documents themselves are preserved
in a separate private repository; they are deliberately not here and not in this log.

**What is deliberately missing, and this is two filters rather than one.**

The first filter, applied when this file was generated: 47 of the 151 original commits are excluded,
being every commit that touched the company documents and every commit whose message discussed
entity, tax, legal, trademark or store enrolment matters.

The second filter was added afterwards, because the first one had a gap worth naming. It screened for
company and tax material and for a device identifier, and it had no filter for **infrastructure
identity**, so this file shipped a second copy of a class the audit had just finished cataloguing
elsewhere: a cloud project id and number, a Workload Identity arrangement, service account emails, a
state bucket, another private repository, and email addresses spanning three organisations. One
commit body carried it. Its offending paragraph is removed and marked in place; the other eight
paragraphs of that entry, and every other entry, are untouched. No entry was dropped by this pass.

**One thing deliberately left in.** The Apple Team ID appears in some entries. It is recoverable from
any shipped application binary, so publishing it discloses little, and whether to carry it is a
deliberate decision rather than an oversight.

**Provenance.** Generated from the mirror rather than transcribed, then screened to confirm it
carries no entity identifier, no tax identifier, no device identifier and no infrastructure identity.


Commits below: **104** of 151 original, oldest first.


## 2026-08-22

### `3855de762f3c` chore: initialize repository

### `8016afbdc356` feat: bootstrap BurnChat as a standalone Hop consumer

> BurnChat is its own repo, not part of the mesh monorepo. Hop arrives as a published SwiftPM dependency pinned exactly at v0.0.2, because the SDK's public Swift surface differs between that tag and its default branch and a range would silently change the contract between builds.
>
> BurnChatCore is the only code that touches the SDK, so publishing a bearers package later is a one-file change. LoopbackBearer conforms to the published Bearer seam to prove the node, handshake, messaging and delivery-status path without forking the monorepo's radio code.
>
> Proven by swift run burnchat-smoke: two nodes, one real text message, relayed=1 delivered=true hops=1. PATH.md carries the command and the observed output, and states what the run does not prove.

### `ee1976735745` feat: add UI surface, test suite, and CI gate

> The app is now a real iOS app, not a library plus a smoke test. Verified on a
> booted iPhone 17 Pro simulator: it launches, the identity view renders a QR from
> the live node address, and the status view states plainly that no transports are
> registered in this build.
>
> Three honesty constraints are enforced in the UI rather than documented:
>
> - No security affordance anywhere. isSecured is never called from a view, because
>   it returns false in our own passing run while delivery succeeds, so its meaning
>   is unknown. An unknown is not rendered as a lock.
> - Loop-only, or in this build no-transport, reads as a statement of fact about
>   what is published, not a warning glyph implying the user can fix it.
> - Delivery state has four visually distinct states including stranded, and a
>   pending status never renders as a checkmark.
>
> The codename stays out of every user-visible string: brand copy routes through one
> AppBranding type, so the rename Jason has not made yet is a one-file edit.
>
> Tests are 18 XCTest cases over the node seam, the loopback bearer, transport
> enablement, delivery state and persistence. They were mutation-checked: flipping
> the transport kill switch made six assertions fail with counter-carrying
> messages, so they fail for the real reason rather than passing by construction.
>
> CI runs build, test, and the working path as its own step, and greps the smoke
> output so a vacuous exit zero cannot pass.

### `5a2e2927fee0` feat: bootstrap BurnChat as a standalone Hop consumer (#1)

> * feat: bootstrap BurnChat as a standalone Hop consumer
>
> BurnChat is its own repo, not part of the mesh monorepo. Hop arrives as a published SwiftPM dependency pinned exactly at v0.0.2, because the SDK's public Swift surface differs between that tag and its default branch and a range would silently change the contract between builds.
>
> BurnChatCore is the only code that touches the SDK, so publishing a bearers package later is a one-file change. LoopbackBearer conforms to the published Bearer seam to prove the node, handshake, messaging and delivery-status path without forking the monorepo's radio code.
>
> Proven by swift run burnchat-smoke: two nodes, one real text message, relayed=1 delivered=true hops=1. PATH.md carries the command and the observed output, and states what the run does not prove.
>
> * feat: add UI surface, test suite, and CI gate
>
> The app is now a real iOS app, not a library plus a smoke test. Verified on a
> booted iPhone 17 Pro simulator: it launches, the identity view renders a QR from
> the live node address, and the status view states plainly that no transports are
> registered in this build.
>
> Three honesty constraints are enforced in the UI rather than documented:
>
> - No security affordance anywhere. isSecured is never called from a view, because
>   it returns false in our own passing run while delivery succeeds, so its meaning
>   is unknown. An unknown is not rendered as a lock.
> - Loop-only, or in this build no-transport, reads as a statement of fact about
>   what is published, not a warning glyph implying the user can fix it.
> - Delivery state has four visually distinct states including stranded, and a
>   pending status never renders as a checkmark.
>
> The codename stays out of every user-visible string: brand copy routes through one
> AppBranding type, so the rename Jason has not made yet is a one-file edit.
>
> Tests are 18 XCTest cases over the node seam, the loopback bearer, transport
> enablement, delivery state and persistence. They were mutation-checked: flipping
> the transport kill switch made six assertions fail with counter-carrying
> messages, so they fail for the real reason rather than passing by construction.
>
> CI runs build, test, and the working path as its own step, and greps the smoke
> output so a vacuous exit zero cannot pass.

### `68c2d9c90bf2` fix: stop the address rendering a dash, and stop identity loss on relaunch

> Two defects found by looking at the running app rather than at the code.
>
> 1. The wrapped address rendered an inserted hyphen. base58 contains no dash, so
>    the screen showed a character that is not in the value. Copy was correct, but
>    the screen is what someone reads aloud, retypes from a photo, or compares
>    against a peer's device.
>
>    SwiftUI has no hyphenation control: there is no modifier in the SDK, and an
>    AttributedString carrying hyphenationFactor 0 with byCharWrapping is ignored
>    by Text. That was tried first and the dash still rendered on device. So the
>    address now draws in a non-scrolling UITextView that honours the paragraph
>    style, wraps at character boundaries, and keeps selection.
>
>    Verified on a booted simulator at default text size (one line, no dash) and at
>    accessibility-extra-large, which forces the wrap case: it folds across lines
>    with no inserted glyph. Two regressions found and fixed during that check: the
>    font was pinned to a fixed point size and ignored Dynamic Type, and the view
>    claimed its single-line intrinsic width so long addresses were clipped rather
>    than wrapped.
>
> 2. The node minted a NEW identity on every launch, so every contact who saved the
>    address would silently stop being able to reach this device.
>
>    IdentityStore.saveSecret passed its full query, kSecClass included, as the
>    attribute dictionary of SecItemUpdate. Keychain rejects that with errSecParam,
>    which is neither success nor errSecItemNotFound, so the guard took the silent
>    early return and the add never ran. Both statuses were discarded, so the
>    failure was invisible and presented as a healthy first launch, forever.
>
>    saveSecret now updates with only the value, adds with an explicit accessibility
>    attribute, and THROWS with the OSStatus and a plain explanation of the
>    consequence. Startup propagates it: a node whose identity was not persisted
>    fails loudly instead of looking fine and losing every contact later.
>
>    Verified on the simulator: address and QR are byte-identical across terminate
>    and relaunch, where before every launch produced a different address.

### `2fc1d2a98243` fix: stop the address rendering a dash, and stop identity loss on relaunch (#2)

> Two defects found by looking at the running app rather than at the code.
>
> 1. The wrapped address rendered an inserted hyphen. base58 contains no dash, so
>    the screen showed a character that is not in the value. Copy was correct, but
>    the screen is what someone reads aloud, retypes from a photo, or compares
>    against a peer's device.
>
>    SwiftUI has no hyphenation control: there is no modifier in the SDK, and an
>    AttributedString carrying hyphenationFactor 0 with byCharWrapping is ignored
>    by Text. That was tried first and the dash still rendered on device. So the
>    address now draws in a non-scrolling UITextView that honours the paragraph
>    style, wraps at character boundaries, and keeps selection.
>
>    Verified on a booted simulator at default text size (one line, no dash) and at
>    accessibility-extra-large, which forces the wrap case: it folds across lines
>    with no inserted glyph. Two regressions found and fixed during that check: the
>    font was pinned to a fixed point size and ignored Dynamic Type, and the view
>    claimed its single-line intrinsic width so long addresses were clipped rather
>    than wrapped.
>
> 2. The node minted a NEW identity on every launch, so every contact who saved the
>    address would silently stop being able to reach this device.
>
>    IdentityStore.saveSecret passed its full query, kSecClass included, as the
>    attribute dictionary of SecItemUpdate. Keychain rejects that with errSecParam,
>    which is neither success nor errSecItemNotFound, so the guard took the silent
>    early return and the add never ran. Both statuses were discarded, so the
>    failure was invisible and presented as a healthy first launch, forever.
>
>    saveSecret now updates with only the value, adds with an explicit accessibility
>    attribute, and THROWS with the OSStatus and a plain explanation of the
>    consequence. Startup propagates it: a node whose identity was not persisted
>    fails loudly instead of looking fine and losing every contact later.
>
>    Verified on the simulator: address and QR are byte-identical across terminate
>    and relaunch, where before every launch produced a different address.


## 2026-08-23

### `edbe9fe4dd44` chore: scaffold React Native app beside the Swift app

> Vendored @hop-mesh/react-native 0.0.2 as a pinned tarball under vendor/
> (npm pack output; the package is private and unpublished, so the tarball
> is the only reproducible source). RN 0.87.0 and React 19.2.3, matching
> the HopDemo reference app toolchain. The Swift app stays in the tree
> until React Native proves a real message round trip, per the plan.

### `5b87f53be9d7` feat: wire the Hop Apple SDK into the React Native app for iOS

> The SDK README tells consumers to fetch three podspecs from hop-sdk-apple.
> They are not published there: that URL and main both 404, and a clone at
> v0.0.2 carries Package.swift, Sources and LICENSE.md with no podspec. The
> specs exist only in the monorepo, read Package.swift from their own
> directory, and cannot be consumed from a URL.
>
> So this repo declares its own, pinned at v0.0.2 with the same release asset
> and SHA-256 the Swift package resolves, in ios/hop-pods. pod install now
> resolves the full graph: HopMesh (the vendored tarball, autolinked) ->
> HopSDK -> CHop plus HopContract, with the simulator slice of
> libhop.xcframework present.
>
> Also: iOS floor raised to 16.0 (the Hop SDK's own floor, below which
> CocoaPods refuses the graph), bundle id set to com.jwaldrip.gritchat, and
> the display name set to Grit Chat on both platforms.

### `b0c00b9d719c` feat: build the Grit Chat app surface on a single Hop seam

> The seam (src/hop) owns every Hop touchpoint: node lifecycle, identity in
> the platform keystore, the relay bearer, the pump, send with delivery
> status, and inbound routing. Nothing outside it imports the SDK.
>
> Identity is written and then READ BACK before startup continues. The Swift
> app lost an identity per launch because a keystore write failed silently,
> and a new address orphans every contact who saved the old one, so the
> write has to prove it landed.
>
> The relay endpoint is config with no default. wss://relay.hopme.sh is off
> and answers with hop-endpoint behind Google Frontend, so a socket that
> completes an upgrade there reports up while carrying nothing. Unset is a
> state the UI shows, and an endpoint cleared by hand stays cleared.
>
> Status is designed rather than defaulted (src/design/status.ts): shape
> first, then position, then words, then colour. A hollow ring means the
> core holds it and nobody is carrying it; a run of nodes with a chevron
> means carried but unconfirmed; a run terminated by a cap and a check means
> the destination confirmed, with the forward hop count. Font Awesome
> throughout, no emoji as interface icons.
>
> Design tokens are the only source of colour, type, spacing and motion.
> Barlow for interface text with Barlow Condensed for display, IBM Plex Mono
> for the machine layer: addresses, hop counts, relay state.

### `e25073198700` test: cover the seam, the store and the status vocabulary; document the path

> 44 tests, all passing, over the parts where being wrong is expensive: the
> keystore write that must prove it landed, the store that must survive a
> restart and reject a repeated inbox id, the send path that must report
> relayed-but-unconfirmed rather than inventing a delivery, and the status
> vocabulary that must keep those states visually distinct.
>
> The delivery poll budget is injectable so the bounded-wait case is
> reachable without spending thirty real seconds in a unit test.
>
> The AsyncStorage binding moved out of kv.ts into its own adapter:
> importing it there dragged a native module into every store test, and a
> suite that cannot load is a suite that stops being run.
>
> PATH.md states the acceptance sentence, the rung ladder, and the exact
> commands, and says plainly that the bar is NOT yet proven. The Swift app's
> own path is kept verbatim as a section, since it is still the only proven
> one in this tree.

### `60b23981738b` feat: wire the config module, the fonts and the scoped ATS exceptions into iOS

> project.pbxproj is the load-bearing half of the previous commit: without
> these entries GritConfig has no Sources entry, the fonts have no Copy
> Bundle Resources entries, and there is no GRIT_RELAY_URL build setting, so
> the files would sit in the tree compiling into nothing.
>
> GritConfig reads the relay endpoint from Info.plist and exposes process
> launch arguments, which is how a proof run is driven without a rebuild and
> without tapping a screen.
>
> App Transport Security stays on: NSAllowsArbitraryLoads remains false and
> the exceptions are scoped to 127.0.0.1, localhost and the LAN host, since
> ATS governs ws:// as well as http:// and the local relay speaks plain ws.
> NSLocalNetworkUsageDescription is present because iOS 14 and later refuse
> a LAN address without it.
>
> Verified: plutil -lint passes on Info.plist, and xcodebuild -list parses
> the workspace. NOT verified: a build with these entries, or a launch.

### `fe9ea423043f` fix: publish the prekey only after the relay link is up

> Publishing at startup, before any link existed, left the app's prekey
> absent from the relay directory. A control pair of HEAD-core harness
> nodes on the same relay delivered with hops=2; every run that involved
> the app did not. The publish now fires when the relay reports up.
>
> Also: wait for that state before a proof send; add grit-relay-node, a
> matching-core listener pinned to hop-sdk-apple v0.0.2, because a HEAD
> libhop harness completes Noise with the app and then cannot decrypt;
> depend on @react-native/assets-registry so Metro can resolve
> react-native-svg; rewrite PATH.md from the measured results. Rung 1
> FAILED (relayed=0 or delivered=false). Rung 2 was not run.

### `5fae930cbd78` fix: isolate rung 1, run it on a matching relay, record the SIMULATOR pass

> Two grit-relay-node processes (both hop-sdk-apple v0.0.2) through today's
> hop-relayd: relayed=1, delivered=false, no INBOX. Same pair through
> hop-relayd built from hop commit 699ba51: delivered=true, forwardHops=2.
>
> That control says the earlier delivery failures were v0.0.2 core against a
> HEAD relay, not an app defect. grit-relay-node now has a send mode so that
> control is a command, not a memory.
>
> The app, on SIMULATOR 40E844EA, then sent V002APP-1 through that matching
> relay to a grit-relay-node listener: delivered=true, relayed=1,
> forwardHops=2. Listener INBOX hops=2. That is rung 1. It is not BushidoPhone.
>
> PATH.md rewritten from those measurements.

### `702766389d18` fix: stop delivery snapshots from overwriting a later confirmation

> A fire-and-forget onUpdate could persist an early relayed=0 snapshot after
> the protocol had already confirmed delivery, so the chat showed "nobody
> carrying it" for a message that had arrived. applyDelivery no longer
> downgrades, load collapses repeated bundle ids (which also tripped a
> React duplicate-key banner over the composer), and --grit-screen opens
> chat, add-contact, and identity without a tap.
>
> The conversation row no longer prints the short address twice, and an
> unnamed contact is marked with a hop node instead of the first two
> letters of a base58 string.

### `0d51891b4fbb` fix: bottom-anchor chat and persist a real delivered hop trace

> The conversation sat at the top of the canvas with a slab of night above
> the composer. Messages now grow up out of the composer.
>
> Sage had never rendered because onAccepted was fire-and-forget:
> applyDelivery ran against a row that did not exist yet, and when the
> first snapshot was already delivered the poll never ran again. send()
> now awaits the outbound persist before the first status read.
>
> A fresh proof against the matching v0.0.2 relay landed delivered=true
> forwardHops=2 through that path. The empty first-launch screen is
> designed as "you have an address, nobody has it yet" rather than as a
> debug inbox of leftover proof peers.

### `812b42e0fc25` fix: stop showing forwardMs as if it were a transit time

> The protocol field arrived as tens of thousands of milliseconds while the
> sender wall clock for the same send was about a second. The two nodes in
> this setup do not share a clock, so that number is not a duration. The
> bubble now shows only the hop count. The store no longer persists
> forwardMs. PATH.md states why.

### `b249ab797e5c` docs: rung 1 delivered through a relay built from current main

> hop PR #64 widened is_supported_bundle_version to the byte-identical
> v13..v16 family, so the app's v14 bundles are accepted again. Rebuilt
> hop-relayd from origin/main at 2252587 with no workspace surgery, ran
> the proof: delivered=true forwardHops=2, listener INBOX hops=2, sage on
> screen. The 699ba51 relay is now history, not the path.

### `c49ad7d1a4f2` feat: channels through the hps bridge, on a dev-pinned ABI 6 SDK

> Channels reached React Native in hop PR #62 (C ABI 5 to 6). No published
> hop-sdk-apple release carries them, so this branch pins local dev
> artifacts and says so everywhere: the RN SDK re-vendored from hop main
> 54a2e82, libhop built from the same commit (ABI 6 probed, hps and relay
> pool symbols verified), the Swift SDK sources vendored beside their
> podspecs, and grit-relay-node pointed at a local SwiftPM package.
> Shipping channels needs a real release; ios/hop-pods/README.md carries
> the revert plan.
>
> The seam owns the whole hps surface: host, join, publish, leave,
> myChannels, reach, plus the two semantics that are silent bugs if got
> wrong. An EMPTY register key is a channel's success (null is failure),
> and a publication is accepted only after the store has it, so a
> listener that refuses leaves it queued for redelivery. Invites are
> persisted in the arrival handler because the core's queue is
> take-and-clear.
>
> Channel store, channel screens, and a channels-aware conversation list
> follow the existing design system. A channel post shows what the core
> reported (published) and nothing per-recipient, because a group message
> is one encrypted publication flooded once.
>
> Relay pool is wired with paced redial. The unpaced version reset its
> backoff on every attempt and was measured opening 162 connections to a
> local relay in under two minutes, which also knocked other clients off
> that relay.

### `f28355f12219` docs: record rung 1c, channels, and what it does and does not prove

> Hosting, the node's own topic list, publication acceptance and the
> on-screen state pass on the simulator. No publication reached a
> subscribed second node: reply null, reach 0, and the relay held one
> undelivered bundle while both peers were connected, so the hps path and
> the one to one path do not behave alike here. PATH.md carries both
> traces, the GRIT_RELAY_URL build setting the proof needs, and the two
> defects found in this repo while chasing it.

### `5aa5fe5c49d9` fix: decode inbound UTF-8 without TextDecoder, and prove the channel round trip

> The SDK's bytesToUtf8 is new TextDecoder().decode(bytes) and Hermes has
> no TextDecoder. It threw inside the inbound handlers, which are what
> accept an item, so every inbound message and every channel publication
> died before the store saw it, the core never got its accept, and the
> item was redelivered on every pump tick: a ReferenceError every 250ms
> while the app looked like it was receiving nothing. src/hop/utf8.ts now
> owns the decode, maps malformed input to U+FFFD instead of throwing, and
> carries its own tests.
>
> That was the whole reason channels looked one-directional. With it
> fixed, rung 1c passes both ways on the simulator: ok=true, reachAfter=1,
> and the peer's publication persisted with its verified writer.
>
> The proof also publishes twice on purpose. A publication is flooded
> once, so the first post predates any member holding the key and its
> absence proves nothing; the second is published only after the host
> retains a member, and delivery is judged on that one. An earlier version
> judged the first post and wrongly called delivery broken.

### `3e1e1a41160f` docs: state the channel limits plainly and flag the Hermes decoder trap

> PATH.md leads with the symptom now: an app that receives nothing while
> looking idle, with a ReferenceError repeating at the pump interval, is a
> throw inside an inbound handler, not a transport fault. The handler is
> what accepts an item, so a throw there means the core redelivers forever
> and the conversation stays empty.
>
> The PR body carried a stale rung row: two earlier edits targeted text
> that had already changed and silently did nothing, so the table still
> said the cross-node half failed after it had passed. Fixed, and the
> limits are now stated where they cannot be missed: simulator only, local
> relay only, no radio, locally built ABI 6 artifacts, invites and
> moderation wired but exercised nowhere, and channels cannot ship until a
> published hop-sdk-apple release carries ABI 6.

### `2fbda162ec53` docs: proofread PATH.md, fix the duplicated status line and the section order

> The status paragraph said "Rung 2 was not run" twice, from an edit that
> applied to text it had already changed. Checked the rest of the file and
> the PR body for the same class mechanically rather than by eye: no other
> stutter, no duplicate headings, no repeated prose, no stale verdicts.
>
> Read it as a reader and fixed what that turned up:
> - the body ran 0, 1, 2, then 1c, so the rung sections now follow the
>   ladder order the table promises
> - the relay identity line implied one passing run when there are two on
>   different stores, and a fresh store mints a fresh node address
> - the prerequisites never stated the store reset that made these runs
>   reproducible, including that wiping under a live relay leaves it
>   holding the old backlog
> - one bullet still said rung 1 alone was a simulator
> - a paragraph line began with "#64", which is fragile in Markdown

### `5e3007f1c3f5` test: Detox end to end suite for the proven flows, and three bugs it caught

> Seven scenarios, thirty three steps, all green on the iOS simulator:
> the designed empty state, add contact by pasted address plus refusal of
> a bad one, delivery progression to "delivered via 2 hops" against a live
> relay and listener, a channel publication with its verified writer,
> clearing the relay showing "relay not set", and the QR scan section
> saying it is not in this build. The lockstep guard (e2e/testids.test.js)
> asserts every addressed testID exists in the sources, so a rename breaks
> a fast test, not a device run.
>
> Three real bugs fell out of writing it:
>
> - The channel store had no React subscription. useStoreVersion only
>   watched the 1:1 store, so a hosted channel never appeared in the list
>   and inbound channel messages would not render live. ChannelScreen and
>   ConversationsScreen now subscribe to the channel store's version.
> - The empty state had no way to start a channel at all: the footer with
>   the new channel action only rendered when a conversation already
>   existed. The first-run surface now offers Start a channel.
> - The composer had no keyboard-aware send: with the keyboard up the send
>   button sits underneath it, so the composer now submits on the return
>   key and dismisses the keyboard with it, like every messenger.
>
> The reference app's two Detox traps are documented where they bite:
> detox 20.28 lifecycle imports live at detox/internals, and a Fabric
> ScrollView rejects programmatic scroll, so below-fold controls are
> reached with a swipe plus keyboard dismissal.

### `bc1686dfe8f1` chore: ignore detox run artifacts

### `2aafb9fdb392` docs: record the Detox suite, its sabotage proof, and the two bugs it caught

> PATH.md gains the suite, the commands, and the sabotage table: every
> scenario class was broken on purpose and failed for the right reason,
> including the delivery assertion naming the real "delivered via 2 hops"
> against a sabotaged expectation of 3.
>
> The PR body's "no Detox" line is replaced with the suite, the sabotage
> proof, and the bugs it caught: the channel store had no subscription, so
> a hosted channel never appeared and inbound messages would not render
> live, and the composer had no keyboard-aware send.

### `b0f2af2df129` feat: QR scan finishes the contact flow

> The add contact screen gains a real scanner: a camera screen that
> decodes natively, validates with the SDK's own decoder, and adds the
> contact through the same accept flow as paste. Paste stays first-class,
> because a scanner is useless when someone reads you an address over a
> radio.
>
> Verified honestly: the accept flow is unit tested (empty, own address,
> invalid, valid); the scanner screen renders on the simulator and is
> covered by a Detox scenario (with the camera permission pre-granted so
> the system alert cannot block a step); and the scenario was sabotage
> proven (renaming scan-camera fails the guard in both directions and the
> scenario with No elements found). What is NOT proven: an actual code
> through an actual camera, because a simulator has no usable camera. That
> needs the hardware pass, and PATH.md says so.
>
> The old "Not in this build" note and its scenario are gone; the note
> now tells the truth that both paths exist.

### `2b748cc169ce` feat: media in chat: photos and voice notes, end to end

> Images: the composer picks and downscales (1600px at 0.7 quality, the
> size a phone screen can show), sends bytes with a content type through
> the same seam call as text, and renders a thumbnail with a loading
> frame. Voice notes: tap to record, tap to stop and send, inline playback
> with a duration label. Delivery state is identical to text by
> construction, because it is the same send path and the same trace.
>
> Inbound media keeps its bytes raw: the decode path is split so text
> still goes through UTF-8 and media never does, the bytes persist to
> disk, and a failed save renders an honest "could not save" state rather
> than a broken image icon or a vanished message.
>
> Verified: voice record-stop-send delivered via 2 hops against a live
> relay and listener, with the play control rendered; an inbound photo
> from a second node renders with its hop trace (the harness gained a
> peer-media mode because a separate sender is a different identity, and
> media from it lands in a conversation the test is not looking at). The
> composer bottom safe area was fixed after a real clip: the row sat 2pt
> inside the home indicator zone. The pick sheet itself is out-of-process
> system UI and is not driven; the send path after it is unit tested.
>
> Also fixed a relay-timing race in the relay scenarios: the app booted
> before the relay existed and the redial backoff could outlive the
> delivery window, so relay scenarios now relaunch the app after the
> relay is live.

### `b1a6b6ff0304` test: media scenarios sabotage proven, full suite 9 scenarios 48 steps

> - voice: renaming the message-media prefix fails the guard in both
>   directions and the scenario with No elements found.
> - photo: expecting a wrong route fails with the real one named in the
>   error: "2 hops to reach you".

### `667a19791013` feat: channel invites, approval, and revocation, all proven on device

> Host side: the New Channel screen picks an access mode (open, approval,
> invite only), and a Manage screen shows join requests with approve and
> deny, the member list with removal, and invites by address. Invited
> side: an invite banner on the conversation list with accept and decline,
> persisted on arrival because the core's queue is take-and-clear.
>
> Removal is presented as what it is: the screen says a removed member
> keeps everything they already read and can decrypt nothing after,
> because nothing in Hop unsends a message.
>
> Proven end to end against a live relay: a requestToJoin subscribe lands
> in the host's pending queue, approval hands the keys, and the approved
> member receives the post and replies; an invite sent from the manage
> screen is accepted by a second node which then exchanges a publication;
> and after removal the key rotation is measured on the peer's own log as
> an absence (no new HPSINBOX after the post-removal publish).
>
> Sabotage proven: renaming the approve id fails the lockstep guard, and
> making removal a no-op in the seam fails the scenario with "the removed
> member received 1 post(s) after the rotation", so the absence assertion
> measures reality rather than asserting a timeout.
>
> Three real defects fell out and are fixed: the create callback's stale
> closure meant every channel registered as open regardless of the access
> picked; the manage screen refreshed once on mount so a request that
> travelled after the tap never appeared; and the invitee harness captured
> its reply body before the argument was parsed.

### `6c5794752dc7` fix: guard lists put templated manage ids where they belong

> The manage rows and access cards render as testID templates, so the
> fixed PLAIN list could never contain them; every guard run since they
> were added failed on ten ids, and the failure was hidden by tail -3
> cutting the count. The ids move to the prefix list, and the suite is
> 85 passing again.

### `3fdaf0f417c2` docs: the suite is 11 scenarios and the sabotage table covers every class

> PATH.md records the two honest in-suite limits (the photo pick sheet is
> out-of-process system UI; the camera decode needs hardware neither this
> suite nor a simulator has) and the relay relaunch rule that makes the
> relay scenarios deterministic. The PR body's End to end section states
> the same, and the stale honesty lines (QR absent, channels unreachable)
> are replaced with the current truth.

### `e60e5b5fd9f5` feat: location sharing, designed for no infrastructure

> A location is a one-shot snapshot: coordinates, an honest accuracy
> radius, and the time of the fix, sent as an ordinary message with its
> own content type through the same seam call, delivery state, and hop
> trace as text. There is deliberately no live sharing: it is a battery
> and privacy commitment this product has not made, and on a
> delay-tolerant network a stale live position is actively misleading.
>
> Receiving renders with no network at all: no map tiles (blank exactly
> when this matters), but the coordinates plus, when the reader has their
> own fix, a bearing and distance from where they are standing. The math
> is pure and tested against real-world vectors: Black Rock City to Reno
> is 145 km, SF to NYC is 4130 km, bearings land on the compass points.
> A malformed fix renders as words, never invented coordinates.
>
> Sharing into a channel is confirm-first: the warning names the
> fan-out (a publication goes to every member) before any position is
> read, and cancelling means no position was ever taken. A failed read
> after a confirmed intent is said plainly; nothing was published.
>
> What is proven on the simulator: inbound rendering with coordinates
> and accuracy from a real message, the fan-out warning, the permission
> degradation reaching the real UI, and every math and error branch by
> unit test. What is NOT: the GPS read itself. On this simulator
> CoreLocation never delivers a fix under a pre-granted permission (the
> app's CLLocationManager only ever issues stopUpdatingLocation; an
> unanswered prompt from an early run also squats locationd for ~9
> minutes, evidence in PATH.md), so the two scenarios needing a live fix
> are tagged @needs-gps and run on hardware. The delivery mechanics they
> would exercise are proven by the text, image, and voice scenarios
> through the same send path.

### `5a13c28e6a56` docs: the suite is 14 scenarios; location's simulator limits with evidence

> PATH.md records why the GPS read cannot be driven here (the locationd
> squat, and the stop-only CLLocationManager under a pre-granted
> permission), what is proven around it, and three new sabotage rows.

### `b19f20b280d7` test: close the location permission race with a grant and relaunch

> The install-time location grant measured once landing as UNDECIDED,
> which surfaced a system prompt mid-scenario and failed the inbound
> location assertion while adjacent runs passed. Every scenario now grants
> location and camera through simctl after install.
>
> simctl privacy grant TERMINATES a running app, which the first version
> of this change learned the hard way: granting after the launch killed
> the freshly launched app and all fourteen scenarios failed. The grant is
> followed by a clean relaunch, and the suite is 14 scenarios green again.

### `ec9d347f1831` fix: name the local network gate when a LAN relay will not come up

> On real hardware, denying (or never answering) the iOS local network
> permission makes a LAN relay fail with an ordinary "cannot connect"
> error, which reads as a dead relay on the exact path a first-time user
> hits. iOS exposes no API to query the permission, so the app does not
> diagnose: when a LAN relay is down or retrying it now shows conditional
> guidance pointing at Settings > Privacy & Security > Local Network.
> Loopback and public hosts show nothing, a carrying relay shows nothing.
>
> Same defect class as the Hermes decoder throw: a silent failure whose
> real cause lives somewhere the error never mentions.

### `d5ca1807856a` docs: rung 2 passed on BushidoPhone; the signing wall was a stale label

> The one-to-one proof delivered with two forward hops and the channel
> proof round-tripped, both from the physical handset, traces pulled out
> of the container. Records the real cause of the signing failure (a stale
> team label in a certificate name, fixed by one build setting), the three
> things that actually blocked first device attempts, and the screenshot
> gap: no CLI path captures a wireless iPhone and Apple's snapshot
> container is not plain ASTC.

### `39c81ebd8b57` chore: ignore the iphoneos device build output

### `f1c0f72e3d3a` chore: delete the Swift app; React Native is the one working path

> Rung 2 inverted the evidence: the React Native app has crossed a real
> relay from a physical iPhone with delivery confirmed at two hops, in
> both direct messages and channels. The Swift app's loopback proof (two
> nodes over an in-process pipe, no message ever leaves the device) is
> strictly weaker, so it stops being a safety net and becomes a second
> path nobody maintains.
>
> Deleted: the SwiftUI app, its core, its smoke target, its tests, and
> project.yml. Package.swift keeps exactly one target, grit-relay-node,
> the proof harness the ladder dials. CI now builds the harness,
> typechecks, and runs the unit suite; the burnchat-smoke step is gone.
> PATH.md keeps the honest history of the loopback contrast and tells no
> one to run the smoke again. Stale tracked Detox failure artifacts are
> untracked, the gitignore already covered them.

### `c7726be4c8f4` fix: CI must materialize the vendored xcframework before building

> CI has been red on this branch since the dev pin landed, and for a
> reason that had nothing to do with the app: the 43 MB libhop
> xcframework is committed once as a zip (no second copy in git) and
> SwiftPM's binaryTarget(path:) needs it unzipped inside the package, so
> every run failed with "local binary target 'CHop' does not contain a
> binary artifact". Proven at d5ca180 under the old workflow and
> reproduced locally in a fresh worktree.
>
> The workflow now runs the repo's own fetch-framework.sh first, and
> asserts the zip's sha256 against the provenance in
> ios/hop-pods/README.md so a swapped artifact fails loudly instead of
> linking something nobody vetted. The assertion was sabotage-tested with
> a wrong digest (exit 1).
>
> PATH.md's header and ladder table still said NOT MET and "rung 2, not
> run" while its own rung 2 section recorded the pass. Both corrected,
> with the screenshot gap kept explicit, and the React Native commands
> named as the proof.

### `2af1d9c68c31` feat: Grit Chat as a React Native app, on a single Hop seam (#4)

> * chore: scaffold React Native app beside the Swift app
>
> Vendored @hop-mesh/react-native 0.0.2 as a pinned tarball under vendor/
> (npm pack output; the package is private and unpublished, so the tarball
> is the only reproducible source). RN 0.87.0 and React 19.2.3, matching
> the HopDemo reference app toolchain. The Swift app stays in the tree
> until React Native proves a real message round trip, per the plan.
>
> * feat: wire the Hop Apple SDK into the React Native app for iOS
>
> The SDK README tells consumers to fetch three podspecs from hop-sdk-apple.
> They are not published there: that URL and main both 404, and a clone at
> v0.0.2 carries Package.swift, Sources and LICENSE.md with no podspec. The
> specs exist only in the monorepo, read Package.swift from their own
> directory, and cannot be consumed from a URL.
>
> So this repo declares its own, pinned at v0.0.2 with the same release asset
> and SHA-256 the Swift package resolves, in ios/hop-pods. pod install now
> resolves the full graph: HopMesh (the vendored tarball, autolinked) ->
> HopSDK -> CHop plus HopContract, with the simulator slice of
> libhop.xcframework present.
>
> Also: iOS floor raised to 16.0 (the Hop SDK's own floor, below which
> CocoaPods refuses the graph), bundle id set to com.jwaldrip.gritchat, and
> the display name set to Grit Chat on both platforms.
>
> * feat: build the Grit Chat app surface on a single Hop seam
>
> The seam (src/hop) owns every Hop touchpoint: node lifecycle, identity in
> the platform keystore, the relay bearer, the pump, send with delivery
> status, and inbound routing. Nothing outside it imports the SDK.
>
> Identity is written and then READ BACK before startup continues. The Swift
> app lost an identity per launch because a keystore write failed silently,
> and a new address orphans every contact who saved the old one, so the
> write has to prove it landed.
>
> The relay endpoint is config with no default. wss://relay.hopme.sh is off
> and answers with hop-endpoint behind Google Frontend, so a socket that
> completes an upgrade there reports up while carrying nothing. Unset is a
> state the UI shows, and an endpoint cleared by hand stays cleared.
>
> Status is designed rather than defaulted (src/design/status.ts): shape
> first, then position, then words, then colour. A hollow ring means the
> core holds it and nobody is carrying it; a run of nodes with a chevron
> means carried but unconfirmed; a run terminated by a cap and a check means
> the destination confirmed, with the forward hop count. Font Awesome
> throughout, no emoji as interface icons.
>
> Design tokens are the only source of colour, type, spacing and motion.
> Barlow for interface text with Barlow Condensed for display, IBM Plex Mono
> for the machine layer: addresses, hop counts, relay state.
>
> * test: cover the seam, the store and the status vocabulary; document the path
>
> 44 tests, all passing, over the parts where being wrong is expensive: the
> keystore write that must prove it landed, the store that must survive a
> restart and reject a repeated inbox id, the send path that must report
> relayed-but-unconfirmed rather than inventing a delivery, and the status
> vocabulary that must keep those states visually distinct.
>
> The delivery poll budget is injectable so the bounded-wait case is
> reachable without spending thirty real seconds in a unit test.
>
> The AsyncStorage binding moved out of kv.ts into its own adapter:
> importing it there dragged a native module into every store test, and a
> suite that cannot load is a suite that stops being run.
>
> PATH.md states the acceptance sentence, the rung ladder, and the exact
> commands, and says plainly that the bar is NOT yet proven. The Swift app's
> own path is kept verbatim as a section, since it is still the only proven
> one in this tree.
>
> * feat: wire the config module, the fonts and the scoped ATS exceptions into iOS
>
> project.pbxproj is the load-bearing half of the previous commit: without
> these entries GritConfig has no Sources entry, the fonts have no Copy
> Bundle Resources entries, and there is no GRIT_RELAY_URL build setting, so
> the files would sit in the tree compiling into nothing.
>
> GritConfig reads the relay endpoint from Info.plist and exposes process
> launch arguments, which is how a proof run is driven without a rebuild and
> without tapping a screen.
>
> App Transport Security stays on: NSAllowsArbitraryLoads remains false and
> the exceptions are scoped to 127.0.0.1, localhost and the LAN host, since
> ATS governs ws:// as well as http:// and the local relay speaks plain ws.
> NSLocalNetworkUsageDescription is present because iOS 14 and later refuse
> a LAN address without it.
>
> Verified: plutil -lint passes on Info.plist, and xcodebuild -list parses
> the workspace. NOT verified: a build with these entries, or a launch.
>
> * fix: publish the prekey only after the relay link is up
>
> Publishing at startup, before any link existed, left the app's prekey
> absent from the relay directory. A control pair of HEAD-core harness
> nodes on the same relay delivered with hops=2; every run that involved
> the app did not. The publish now fires when the relay reports up.
>
> Also: wait for that state before a proof send; add grit-relay-node, a
> matching-core listener pinned to hop-sdk-apple v0.0.2, because a HEAD
> libhop harness completes Noise with the app and then cannot decrypt;
> depend on @react-native/assets-registry so Metro can resolve
> react-native-svg; rewrite PATH.md from the measured results. Rung 1
> FAILED (relayed=0 or delivered=false). Rung 2 was not run.
>
> * fix: isolate rung 1, run it on a matching relay, record the SIMULATOR pass
>
> Two grit-relay-node processes (both hop-sdk-apple v0.0.2) through today's
> hop-relayd: relayed=1, delivered=false, no INBOX. Same pair through
> hop-relayd built from hop commit 699ba51: delivered=true, forwardHops=2.
>
> That control says the earlier delivery failures were v0.0.2 core against a
> HEAD relay, not an app defect. grit-relay-node now has a send mode so that
> control is a command, not a memory.
>
> The app, on SIMULATOR 40E844EA, then sent V002APP-1 through that matching
> relay to a grit-relay-node listener: delivered=true, relayed=1,
> forwardHops=2. Listener INBOX hops=2. That is rung 1. It is not BushidoPhone.
>
> PATH.md rewritten from those measurements.
>
> * fix: stop delivery snapshots from overwriting a later confirmation
>
> A fire-and-forget onUpdate could persist an early relayed=0 snapshot after
> the protocol had already confirmed delivery, so the chat showed "nobody
> carrying it" for a message that had arrived. applyDelivery no longer
> downgrades, load collapses repeated bundle ids (which also tripped a
> React duplicate-key banner over the composer), and --grit-screen opens
> chat, add-contact, and identity without a tap.
>
> The conversation row no longer prints the short address twice, and an
> unnamed contact is marked with a hop node instead of the first two
> letters of a base58 string.
>
> * fix: bottom-anchor chat and persist a real delivered hop trace
>
> The conversation sat at the top of the canvas with a slab of night above
> the composer. Messages now grow up out of the composer.
>
> Sage had never rendered because onAccepted was fire-and-forget:
> applyDelivery ran against a row that did not exist yet, and when the
> first snapshot was already delivered the poll never ran again. send()
> now awaits the outbound persist before the first status read.
>
> A fresh proof against the matching v0.0.2 relay landed delivered=true
> forwardHops=2 through that path. The empty first-launch screen is
> designed as "you have an address, nobody has it yet" rather than as a
> debug inbox of leftover proof peers.
>
> * fix: stop showing forwardMs as if it were a transit time
>
> The protocol field arrived as tens of thousands of milliseconds while the
> sender wall clock for the same send was about a second. The two nodes in
> this setup do not share a clock, so that number is not a duration. The
> bubble now shows only the hop count. The store no longer persists
> forwardMs. PATH.md states why.
>
> * docs: rung 1 delivered through a relay built from current main
>
> hop PR #64 widened is_supported_bundle_version to the byte-identical
> v13..v16 family, so the app's v14 bundles are accepted again. Rebuilt
> hop-relayd from origin/main at 2252587 with no workspace surgery, ran
> the proof: delivered=true forwardHops=2, listener INBOX hops=2, sage on
> screen. The 699ba51 relay is now history, not the path.
>
> * feat: channels through the hps bridge, on a dev-pinned ABI 6 SDK
>
> Channels reached React Native in hop PR #62 (C ABI 5 to 6). No published
> hop-sdk-apple release carries them, so this branch pins local dev
> artifacts and says so everywhere: the RN SDK re-vendored from hop main
> 54a2e82, libhop built from the same commit (ABI 6 probed, hps and relay
> pool symbols verified), the Swift SDK sources vendored beside their
> podspecs, and grit-relay-node pointed at a local SwiftPM package.
> Shipping channels needs a real release; ios/hop-pods/README.md carries
> the revert plan.
>
> The seam owns the whole hps surface: host, join, publish, leave,
> myChannels, reach, plus the two semantics that are silent bugs if got
> wrong. An EMPTY register key is a channel's success (null is failure),
> and a publication is accepted only after the store has it, so a
> listener that refuses leaves it queued for redelivery. Invites are
> persisted in the arrival handler because the core's queue is
> take-and-clear.
>
> Channel store, channel screens, and a channels-aware conversation list
> follow the existing design system. A channel post shows what the core
> reported (published) and nothing per-recipient, because a group message
> is one encrypted publication flooded once.
>
> Relay pool is wired with paced redial. The unpaced version reset its
> backoff on every attempt and was measured opening 162 connections to a
> local relay in under two minutes, which also knocked other clients off
> that relay.
>
> * docs: record rung 1c, channels, and what it does and does not prove
>
> Hosting, the node's own topic list, publication acceptance and the
> on-screen state pass on the simulator. No publication reached a
> subscribed second node: reply null, reach 0, and the relay held one
> undelivered bundle while both peers were connected, so the hps path and
> the one to one path do not behave alike here. PATH.md carries both
> traces, the GRIT_RELAY_URL build setting the proof needs, and the two
> defects found in this repo while chasing it.
>
> * fix: decode inbound UTF-8 without TextDecoder, and prove the channel round trip
>
> The SDK's bytesToUtf8 is new TextDecoder().decode(bytes) and Hermes has
> no TextDecoder. It threw inside the inbound handlers, which are what
> accept an item, so every inbound message and every channel publication
> died before the store saw it, the core never got its accept, and the
> item was redelivered on every pump tick: a ReferenceError every 250ms
> while the app looked like it was receiving nothing. src/hop/utf8.ts now
> owns the decode, maps malformed input to U+FFFD instead of throwing, and
> carries its own tests.
>
> That was the whole reason channels looked one-directional. With it
> fixed, rung 1c passes both ways on the simulator: ok=true, reachAfter=1,
> and the peer's publication persisted with its verified writer.
>
> The proof also publishes twice on purpose. A publication is flooded
> once, so the first post predates any member holding the key and its
> absence proves nothing; the second is published only after the host
> retains a member, and delivery is judged on that one. An earlier version
> judged the first post and wrongly called delivery broken.
>
> * docs: state the channel limits plainly and flag the Hermes decoder trap
>
> PATH.md leads with the symptom now: an app that receives nothing while
> looking idle, with a ReferenceError repeating at the pump interval, is a
> throw inside an inbound handler, not a transport fault. The handler is
> what accepts an item, so a throw there means the core redelivers forever
> and the conversation stays empty.
>
> The PR body carried a stale rung row: two earlier edits targeted text
> that had already changed and silently did nothing, so the table still
> said the cross-node half failed after it had passed. Fixed, and the
> limits are now stated where they cannot be missed: simulator only, local
> relay only, no radio, locally built ABI 6 artifacts, invites and
> moderation wired but exercised nowhere, and channels cannot ship until a
> published hop-sdk-apple release carries ABI 6.
>
> * docs: proofread PATH.md, fix the duplicated status line and the section order
>
> The status paragraph said "Rung 2 was not run" twice, from an edit that
> applied to text it had already changed. Checked the rest of the file and
> the PR body for the same class mechanically rather than by eye: no other
> stutter, no duplicate headings, no repeated prose, no stale verdicts.
>
> Read it as a reader and fixed what that turned up:
> - the body ran 0, 1, 2, then 1c, so the rung sections now follow the
>   ladder order the table promises
> - the relay identity line implied one passing run when there are two on
>   different stores, and a fresh store mints a fresh node address
> - the prerequisites never stated the store reset that made these runs
>   reproducible, including that wiping under a live relay leaves it
>   holding the old backlog
> - one bullet still said rung 1 alone was a simulator
> - a paragraph line began with "#64", which is fragile in Markdown
>
> * test: Detox end to end suite for the proven flows, and three bugs it caught
>
> Seven scenarios, thirty three steps, all green on the iOS simulator:
> the designed empty state, add contact by pasted address plus refusal of
> a bad one, delivery progression to "delivered via 2 hops" against a live
> relay and listener, a channel publication with its verified writer,
> clearing the relay showing "relay not set", and the QR scan section
> saying it is not in this build. The lockstep guard (e2e/testids.test.js)
> asserts every addressed testID exists in the sources, so a rename breaks
> a fast test, not a device run.
>
> Three real bugs fell out of writing it:
>
> - The channel store had no React subscription. useStoreVersion only
>   watched the 1:1 store, so a hosted channel never appeared in the list
>   and inbound channel messages would not render live. ChannelScreen and
>   ConversationsScreen now subscribe to the channel store's version.
> - The empty state had no way to start a channel at all: the footer with
>   the new channel action only rendered when a conversation already
>   existed. The first-run surface now offers Start a channel.
> - The composer had no keyboard-aware send: with the keyboard up the send
>   button sits underneath it, so the composer now submits on the return
>   key and dismisses the keyboard with it, like every messenger.
>
> The reference app's two Detox traps are documented where they bite:
> detox 20.28 lifecycle imports live at detox/internals, and a Fabric
> ScrollView rejects programmatic scroll, so below-fold controls are
> reached with a swipe plus keyboard dismissal.
>
> * chore: ignore detox run artifacts
>
> * docs: record the Detox suite, its sabotage proof, and the two bugs it caught
>
> PATH.md gains the suite, the commands, and the sabotage table: every
> scenario class was broken on purpose and failed for the right reason,
> including the delivery assertion naming the real "delivered via 2 hops"
> against a sabotaged expectation of 3.
>
> The PR body's "no Detox" line is replaced with the suite, the sabotage
> proof, and the bugs it caught: the channel store had no subscription, so
> a hosted channel never appeared and inbound messages would not render
> live, and the composer had no keyboard-aware send.
>
> * feat: QR scan finishes the contact flow
>
> The add contact screen gains a real scanner: a camera screen that
> decodes natively, validates with the SDK's own decoder, and adds the
> contact through the same accept flow as paste. Paste stays first-class,
> because a scanner is useless when someone reads you an address over a
> radio.
>
> Verified honestly: the accept flow is unit tested (empty, own address,
> invalid, valid); the scanner screen renders on the simulator and is
> covered by a Detox scenario (with the camera permission pre-granted so
> the system alert cannot block a step); and the scenario was sabotage
> proven (renaming scan-camera fails the guard in both directions and the
> scenario with No elements found). What is NOT proven: an actual code
> through an actual camera, because a simulator has no usable camera. That
> needs the hardware pass, and PATH.md says so.
>
> The old "Not in this build" note and its scenario are gone; the note
> now tells the truth that both paths exist.
>
> * feat: media in chat: photos and voice notes, end to end
>
> Images: the composer picks and downscales (1600px at 0.7 quality, the
> size a phone screen can show), sends bytes with a content type through
> the same seam call as text, and renders a thumbnail with a loading
> frame. Voice notes: tap to record, tap to stop and send, inline playback
> with a duration label. Delivery state is identical to text by
> construction, because it is the same send path and the same trace.
>
> Inbound media keeps its bytes raw: the decode path is split so text
> still goes through UTF-8 and media never does, the bytes persist to
> disk, and a failed save renders an honest "could not save" state rather
> than a broken image icon or a vanished message.
>
> Verified: voice record-stop-send delivered via 2 hops against a live
> relay and listener, with the play control rendered; an inbound photo
> from a second node renders with its hop trace (the harness gained a
> peer-media mode because a separate sender is a different identity, and
> media from it lands in a conversation the test is not looking at). The
> composer bottom safe area was fixed after a real clip: the row sat 2pt
> inside the home indicator zone. The pick sheet itself is out-of-process
> system UI and is not driven; the send path after it is unit tested.
>
> Also fixed a relay-timing race in the relay scenarios: the app booted
> before the relay existed and the redial backoff could outlive the
> delivery window, so relay scenarios now relaunch the app after the
> relay is live.
>
> * test: media scenarios sabotage proven, full suite 9 scenarios 48 steps
>
> - voice: renaming the message-media prefix fails the guard in both
>   directions and the scenario with No elements found.
> - photo: expecting a wrong route fails with the real one named in the
>   error: "2 hops to reach you".
>
> * feat: channel invites, approval, and revocation, all proven on device
>
> Host side: the New Channel screen picks an access mode (open, approval,
> invite only), and a Manage screen shows join requests with approve and
> deny, the member list with removal, and invites by address. Invited
> side: an invite banner on the conversation list with accept and decline,
> persisted on arrival because the core's queue is take-and-clear.
>
> Removal is presented as what it is: the screen says a removed member
> keeps everything they already read and can decrypt nothing after,
> because nothing in Hop unsends a message.
>
> Proven end to end against a live relay: a requestToJoin subscribe lands
> in the host's pending queue, approval hands the keys, and the approved
> member receives the post and replies; an invite sent from the manage
> screen is accepted by a second node which then exchanges a publication;
> and after removal the key rotation is measured on the peer's own log as
> an absence (no new HPSINBOX after the post-removal publish).
>
> Sabotage proven: renaming the approve id fails the lockstep guard, and
> making removal a no-op in the seam fails the scenario with "the removed
> member received 1 post(s) after the rotation", so the absence assertion
> measures reality rather than asserting a timeout.
>
> Three real defects fell out and are fixed: the create callback's stale
> closure meant every channel registered as open regardless of the access
> picked; the manage screen refreshed once on mount so a request that
> travelled after the tap never appeared; and the invitee harness captured
> its reply body before the argument was parsed.
>
> * fix: guard lists put templated manage ids where they belong
>
> The manage rows and access cards render as testID templates, so the
> fixed PLAIN list could never contain them; every guard run since they
> were added failed on ten ids, and the failure was hidden by tail -3
> cutting the count. The ids move to the prefix list, and the suite is
> 85 passing again.
>
> * docs: the suite is 11 scenarios and the sabotage table covers every class
>
> PATH.md records the two honest in-suite limits (the photo pick sheet is
> out-of-process system UI; the camera decode needs hardware neither this
> suite nor a simulator has) and the relay relaunch rule that makes the
> relay scenarios deterministic. The PR body's End to end section states
> the same, and the stale honesty lines (QR absent, channels unreachable)
> are replaced with the current truth.
>
> * feat: location sharing, designed for no infrastructure
>
> A location is a one-shot snapshot: coordinates, an honest accuracy
> radius, and the time of the fix, sent as an ordinary message with its
> own content type through the same seam call, delivery state, and hop
> trace as text. There is deliberately no live sharing: it is a battery
> and privacy commitment this product has not made, and on a
> delay-tolerant network a stale live position is actively misleading.
>
> Receiving renders with no network at all: no map tiles (blank exactly
> when this matters), but the coordinates plus, when the reader has their
> own fix, a bearing and distance from where they are standing. The math
> is pure and tested against real-world vectors: Black Rock City to Reno
> is 145 km, SF to NYC is 4130 km, bearings land on the compass points.
> A malformed fix renders as words, never invented coordinates.
>
> Sharing into a channel is confirm-first: the warning names the
> fan-out (a publication goes to every member) before any position is
> read, and cancelling means no position was ever taken. A failed read
> after a confirmed intent is said plainly; nothing was published.
>
> What is proven on the simulator: inbound rendering with coordinates
> and accuracy from a real message, the fan-out warning, the permission
> degradation reaching the real UI, and every math and error branch by
> unit test. What is NOT: the GPS read itself. On this simulator
> CoreLocation never delivers a fix under a pre-granted permission (the
> app's CLLocationManager only ever issues stopUpdatingLocation; an
> unanswered prompt from an early run also squats locationd for ~9
> minutes, evidence in PATH.md), so the two scenarios needing a live fix
> are tagged @needs-gps and run on hardware. The delivery mechanics they
> would exercise are proven by the text, image, and voice scenarios
> through the same send path.
>
> * docs: the suite is 14 scenarios; location's simulator limits with evidence
>
> PATH.md records why the GPS read cannot be driven here (the locationd
> squat, and the stop-only CLLocationManager under a pre-granted
> permission), what is proven around it, and three new sabotage rows.
>
> * test: close the location permission race with a grant and relaunch
>
> The install-time location grant measured once landing as UNDECIDED,
> which surfaced a system prompt mid-scenario and failed the inbound
> location assertion while adjacent runs passed. Every scenario now grants
> location and camera through simctl after install.
>
> simctl privacy grant TERMINATES a running app, which the first version
> of this change learned the hard way: granting after the launch killed
> the freshly launched app and all fourteen scenarios failed. The grant is
> followed by a clean relaunch, and the suite is 14 scenarios green again.
>
> * fix: name the local network gate when a LAN relay will not come up
>
> On real hardware, denying (or never answering) the iOS local network
> permission makes a LAN relay fail with an ordinary "cannot connect"
> error, which reads as a dead relay on the exact path a first-time user
> hits. iOS exposes no API to query the permission, so the app does not
> diagnose: when a LAN relay is down or retrying it now shows conditional
> guidance pointing at Settings > Privacy & Security > Local Network.
> Loopback and public hosts show nothing, a carrying relay shows nothing.
>
> Same defect class as the Hermes decoder throw: a silent failure whose
> real cause lives somewhere the error never mentions.
>
> * docs: rung 2 passed on BushidoPhone; the signing wall was a stale label
>
> The one-to-one proof delivered with two forward hops and the channel
> proof round-tripped, both from the physical handset, traces pulled out
> of the container. Records the real cause of the signing failure (a stale
> team label in a certificate name, fixed by one build setting), the three
> things that actually blocked first device attempts, and the screenshot
> gap: no CLI path captures a wireless iPhone and Apple's snapshot
> container is not plain ASTC.
>
> * chore: ignore the iphoneos device build output
>
> * chore: delete the Swift app; React Native is the one working path
>
> Rung 2 inverted the evidence: the React Native app has crossed a real
> relay from a physical iPhone with delivery confirmed at two hops, in
> both direct messages and channels. The Swift app's loopback proof (two
> nodes over an in-process pipe, no message ever leaves the device) is
> strictly weaker, so it stops being a safety net and becomes a second
> path nobody maintains.
>
> Deleted: the SwiftUI app, its core, its smoke target, its tests, and
> project.yml. Package.swift keeps exactly one target, grit-relay-node,
> the proof harness the ladder dials. CI now builds the harness,
> typechecks, and runs the unit suite; the burnchat-smoke step is gone.
> PATH.md keeps the honest history of the loopback contrast and tells no
> one to run the smoke again. Stale tracked Detox failure artifacts are
> untracked, the gitignore already covered them.
>
> * fix: CI must materialize the vendored xcframework before building
>
> CI has been red on this branch since the dev pin landed, and for a
> reason that had nothing to do with the app: the 43 MB libhop
> xcframework is committed once as a zip (no second copy in git) and
> SwiftPM's binaryTarget(path:) needs it unzipped inside the package, so
> every run failed with "local binary target 'CHop' does not contain a
> binary artifact". Proven at d5ca180 under the old workflow and
> reproduced locally in a fresh worktree.
>
> The workflow now runs the repo's own fetch-framework.sh first, and
> asserts the zip's sha256 against the provenance in
> ios/hop-pods/README.md so a swapped artifact fails loudly instead of
> linking something nobody vetted. The assertion was sabotage-tested with
> a wrong digest (exit 1).
>
> PATH.md's header and ladder table still said NOT MET and "rung 2, not
> run" while its own rung 2 section recorded the pass. Both corrected,
> with the screenshot gap kept explicit, and the React Native commands
> named as the proof.

### `385263bfbe1b` feat: Android build, design parity fixes, and an honest e2e block

> Android builds and launches on the Pixel 6a emulator with the same
> seam, screens and design system as iOS. The Hop Android artifact is
> sh.hop:hop:0.0.5, built by sdk/android/build-aar-dev.sh from hop main
> 54a2e82, the same commit the iOS artifacts came from, so one C ABI
> serves both platforms. Vendored as one archive with a checksum gate,
> provenance and revert plan in vendor/README-android-artifact.md. It is
> unsigned and published nowhere; shipping Android needs a real release.
>
> Two parity defects found by reading the rendered screen:
> - icons were tofu boxes and every font fell back to system, because
>   Android resolves a fontFamily by file name under assets/fonts and
>   nothing put them there. Fixed with a build-time copy from
>   src/design/fonts plus the vector-icons fonts.gradle; ten TTFs
>   verified inside the APK.
> - textTransform uppercase measures the original string and draws the
>   transformed one on Android, so labels wrapped or clipped. Uppercasing
>   in JS at the render site fixed the class; the action label also lost
>   its letter spacing because Android's ellipsizer does not account for
>   the spacing it adds after the final character.
>
> The Android Detox harness (androidTest source set, runner, dependency,
> android.emu.debug configuration) is wired and cannot run: Detox
> reflects React Native's OkHttpClient by the field name mClient, which
> does not exist in RN 0.87's Kotlin NetworkingModule (client), in every
> Detox version including 22.0.0-rc.0. The suite dies at launch with a
> NullPointerException. Disabling synchronization would make it run and
> make it untrustworthy, so Android has no e2e coverage today and the iOS
> suite remains the regression net. The harness stays because it is
> correct and will run when upstream fixes that field name.
>
> Deliberately not in this commit: the two design token contrast fixes
> belong to the brand branch, and the Podfile.lock churn was this
> machine's CocoaPods version, not a code change.


## 2026-08-24

### `a00fa3a5a12f` fix: pin Detox to the version the iOS suite is proven on, and stop the suite depending on hand-made files

> Two defects that both surfaced as false product failures.
>
> Detox was pinned at 20.34.2 by the previous commit. That version fails
> all fourteen iOS scenarios at the isReady handshake: the app launches
> and renders correctly on screen while never answering Detox, so the run
> burns twenty eight minutes timing out fourteen Before hooks at 120
> seconds each. Pinned back to exactly 20.28.0, which is green, and
> exactly rather than a caret range because ^20.28.0 lets a fresh install
> resolve 20.34.2 and reintroduce the failure silently. Android is blocked
> either way, on getReactNativeHost at 20.28.0 and on the mClient
> reflection at 20.34.2, so the version that keeps the iOS regression net
> alive wins. CI never runs Detox, so this would have merged green.
>
> The media and location scenarios sent /tmp/grit-fixture.png and
> /tmp/grit-fixture-location.json, which nothing in the repo created. They
> existed only because they had been made by hand on one machine, so the
> suite was green here and would be red on any fresh checkout or after
> /tmp was cleared, failing as "message-media-0 was not visible" which
> reads like broken inbound media rather than a missing input. world.js
> now writes both in BeforeAll: a real PNG, verified to decode rather than
> a placeholder, and a location payload shaped by decodeFix.
>
> Suite after both fixes: 14 scenarios, 81 steps, all passing.
>
> Also dropped a contrast ratio from a comment in chrome.tsx. The token
> values are owned by the design work on another branch, so a number in
> that comment would go stale the moment it lands.

### `f3f9698d9684` Android bring-up, two label fixes, and an honest e2e block (#7)

> * feat: Android build, design parity fixes, and an honest e2e block
>
> Android builds and launches on the Pixel 6a emulator with the same
> seam, screens and design system as iOS. The Hop Android artifact is
> sh.hop:hop:0.0.5, built by sdk/android/build-aar-dev.sh from hop main
> 54a2e82, the same commit the iOS artifacts came from, so one C ABI
> serves both platforms. Vendored as one archive with a checksum gate,
> provenance and revert plan in vendor/README-android-artifact.md. It is
> unsigned and published nowhere; shipping Android needs a real release.
>
> Two parity defects found by reading the rendered screen:
> - icons were tofu boxes and every font fell back to system, because
>   Android resolves a fontFamily by file name under assets/fonts and
>   nothing put them there. Fixed with a build-time copy from
>   src/design/fonts plus the vector-icons fonts.gradle; ten TTFs
>   verified inside the APK.
> - textTransform uppercase measures the original string and draws the
>   transformed one on Android, so labels wrapped or clipped. Uppercasing
>   in JS at the render site fixed the class; the action label also lost
>   its letter spacing because Android's ellipsizer does not account for
>   the spacing it adds after the final character.
>
> The Android Detox harness (androidTest source set, runner, dependency,
> android.emu.debug configuration) is wired and cannot run: Detox
> reflects React Native's OkHttpClient by the field name mClient, which
> does not exist in RN 0.87's Kotlin NetworkingModule (client), in every
> Detox version including 22.0.0-rc.0. The suite dies at launch with a
> NullPointerException. Disabling synchronization would make it run and
> make it untrustworthy, so Android has no e2e coverage today and the iOS
> suite remains the regression net. The harness stays because it is
> correct and will run when upstream fixes that field name.
>
> Deliberately not in this commit: the two design token contrast fixes
> belong to the brand branch, and the Podfile.lock churn was this
> machine's CocoaPods version, not a code change.
>
> * fix: pin Detox to the version the iOS suite is proven on, and stop the suite depending on hand-made files
>
> Two defects that both surfaced as false product failures.
>
> Detox was pinned at 20.34.2 by the previous commit. That version fails
> all fourteen iOS scenarios at the isReady handshake: the app launches
> and renders correctly on screen while never answering Detox, so the run
> burns twenty eight minutes timing out fourteen Before hooks at 120
> seconds each. Pinned back to exactly 20.28.0, which is green, and
> exactly rather than a caret range because ^20.28.0 lets a fresh install
> resolve 20.34.2 and reintroduce the failure silently. Android is blocked
> either way, on getReactNativeHost at 20.28.0 and on the mClient
> reflection at 20.34.2, so the version that keeps the iOS regression net
> alive wins. CI never runs Detox, so this would have merged green.
>
> The media and location scenarios sent /tmp/grit-fixture.png and
> /tmp/grit-fixture-location.json, which nothing in the repo created. They
> existed only because they had been made by hand on one machine, so the
> suite was green here and would be red on any fresh checkout or after
> /tmp was cleared, failing as "message-media-0 was not visible" which
> reads like broken inbound media rather than a missing input. world.js
> now writes both in BeforeAll: a real PNG, verified to decode rather than
> a placeholder, and a location payload shaped by decodeFix.
>
> Suite after both fixes: 14 scenarios, 81 steps, all passing.
>
> Also dropped a contrast ratio from a comment in chrome.tsx. The token
> values are owned by the design work on another branch, so a number in
> that comment would go stale the moment it lands.

### `b72559b13b93` feat: make a build say which commit it came from

> MARKETING_VERSION is 1.0 and CURRENT_PROJECT_VERSION is 1 in both
> configurations, and versionName and versionCode are frozen at 1.0 and 1
> on Android, so every build this repo has ever produced is
> indistinguishable from every other. Answering "which build is on that
> phone" cost a forensic session: reading container timestamps out of an
> app data container and bracketing them against commit times, because
> nothing in the artifact could answer it.
>
> Now the commit and the build time are baked in and shown on the
> identity screen, under This node, with the other machine-generated
> facts.
>
> iOS reads two new Info.plist keys substituted from GRIT_BUILD_SHA and
> GRIT_BUILD_TIME, through the same reader as the relay URL so the three
> cannot drift apart in how they treat "not configured". Android works
> the sha out from git itself at configuration time, so no build command
> has to remember to pass it, and it marks a dirty tree as such: a build
> from a modified tree is not the commit it names.
>
> A build that was never told stays honest and says "build unknown"
> rather than rendering an unexpanded substitution token that would read
> like a commit. That screening is unit tested, and the test was
> sabotage-checked by removing the screening: three tests fail.
>
> Proven end to end rather than by construction: an iOS Release build
> with the settings passed shows "build f3f9698-dirty, 2026-08-24T14:30Z"
> on the identity screen, and Android's generated BuildConfig carries
> GRIT_BUILD_SHA "f3f9698-dirty" with a build time.

### `1b483a66b7ee` feat: make a build say which commit it came from (#8)

> MARKETING_VERSION is 1.0 and CURRENT_PROJECT_VERSION is 1 in both
> configurations, and versionName and versionCode are frozen at 1.0 and 1
> on Android, so every build this repo has ever produced is
> indistinguishable from every other. Answering "which build is on that
> phone" cost a forensic session: reading container timestamps out of an
> app data container and bracketing them against commit times, because
> nothing in the artifact could answer it.
>
> Now the commit and the build time are baked in and shown on the
> identity screen, under This node, with the other machine-generated
> facts.
>
> iOS reads two new Info.plist keys substituted from GRIT_BUILD_SHA and
> GRIT_BUILD_TIME, through the same reader as the relay URL so the three
> cannot drift apart in how they treat "not configured". Android works
> the sha out from git itself at configuration time, so no build command
> has to remember to pass it, and it marks a dirty tree as such: a build
> from a modified tree is not the commit it names.
>
> A build that was never told stays honest and says "build unknown"
> rather than rendering an unexpanded substitution token that would read
> like a commit. That screening is unit tested, and the test was
> sabotage-checked by removing the screening: three tests fail.
>
> Proven end to end rather than by construction: an iOS Release build
> with the settings passed shows "build f3f9698-dirty, 2026-08-24T14:30Z"
> on the identity screen, and Android's generated BuildConfig carries
> GRIT_BUILD_SHA "f3f9698-dirty" with a build time.


## 2026-08-23

### `cb5b0c3dfe79` docs: task-by-task UX audit of Grit Chat as a person uses it

> Jason's verdict, treated as ground truth: bad UX first, somewhat bad UI
> second. The audit walks the real jobs, install and identity, first contact,
> first message, discovering a message, starting and joining a channel,
> sharing location, finding someone in a crowd, and cites the file and code
> path that produces each problem.
>
> Structural problems are named separately from cosmetic ones because he
> ranked them. The single largest gap is that the app cannot announce a
> message: no push, no badge, no background receive, so arrival is only
> visible with the app open.
>
> The proposal is a consumer messenger that matches WhatsApp and Signal
> where their conventions are load-bearing and diverges only where the
> product is genuinely different, keeping the per-message hop trace as the
> signature and making it legible rather than designing it away.
>
> Nothing in the proposal claims or implies mesh delivery works today, and
> no new brand elements are introduced.
>
> Evidence limits are stated: no chat screenshot exists, the BushidoPhone
> capture is still being fetched, and four mislabeled byte-identical
> captures plus one black frame were discarded rather than reasoned from.


## 2026-08-24

### `ed2d6758ac78` feat: arrival notification, badge and sound off the foreground pump

> A messenger that never tells you a message came is broken by definition,
> and this was the largest part of the bad-UX verdict. Wire a local
> notification, an unread badge and a sound off the same pump that feeds the
> stores, on both platforms.
>
> The rule is honest by construction: a local notification is produced by
> this process from the foreground pump, so it can only fire while the
> process is alive. It never banners while the app is active, and never for
> a conversation or channel that is on screen. Background push is named as
> future work in docs/ux-audit.md, not faked, and no copy implies the app
> receives while closed.
>
> The decision is pure and unit-tested (src/notifications/notify.ts): nine
> tests pin the two load-bearing refusals and the badge math without a
> device, a permission, or a native module. The native boundary
> (src/notifications/bridge.ts) no-ops when the module is absent so a bare
> build still runs.
>
> Native: iOS gets a small UNUserNotificationCenter module (no new pod);
> Android gets a platform NotificationManager module (no androidx, no gradle
> change) registered with a single append-only line in MainApplication, per
> the agreement with the Android agent. The notification icon is the hop
> trace motif as a monochrome vector.
>
> Full unit suite passes: 134 tests.

### `0c38a0617187` feat: explain the relay in plain language on the first screen, and ask for one

> Audit item 3. The app talks through a relay today and cannot deliver anything
> without one, but nothing on the first screen said so. A new person met an empty
> list, a pill reading "relay not set", and no way to understand what a relay is or
> why they need one. That is the second largest reason the first run reads as a
> developer tool: the app knew it could not send and made the person work out why.
>
> When no relay is configured, the empty state now carries a short card that says
> what a relay is in the words a person uses, says plainly that messages stay on
> this device until one is set, refuses to treat that as a fault to hide, and
> offers a button to go set one. It appears only in the unconfigured state, so it
> is onboarding rather than furniture.
>
> It does not claim mesh delivery. It says a relay is a small server that carries
> sealed messages, which is exactly what this build does.

### `e40868c63428` feat: the relay state becomes a quiet indicator instead of the first thing you read

> Audit item 2. Opening the app used to greet a person with the relay pool line,
> rendered unconditionally under the header: "relay pool: 1 endpoint(s) known, 0
> dialable, next try in 16s". That single line is most of why the app reads as a
> protocol demo with a chat window bolted on, and it is the first sentence a new
> user sees.
>
> Now the home screen shows the pill and nothing else. The pill is unchanged: it
> keeps the app's own encoding, a distinct glyph per state first, then position,
> then words, then colour, so the states survive dust and colourblindness. Tapping
> it expands a plain sentence saying what is happening and where messages are, and
> the pool line is still there underneath in the mono face, because it is genuinely
> useful and machine-generated, just not what a person needs first.
>
> relayPlain lives beside relayView so the vocabulary has one home. Its tests pin
> the two things that matter: every state says something, and no state claims
> device to device delivery, because this build has no radio bearer. That test was
> proved by planting a mesh claim in the down state and watching two assertions
> fail before restoring it.
>
> Tapping the pill no longer navigates away. The expansion carries a button to the
> connection screen for someone who wants to act on it.

### `24cd519a1b14` feat: name people everywhere a person looks, and keep the address where it matters

> Audit item 4. The app knew people's names and then showed base58 anyway. A
> channel read as a wall of GrfdBY...cTn3Ab talking to DwDmNv...KbRBv2. An invite
> said it came from a string. The manage screen, where you grant and revoke access,
> identified humans only by address. The conversation list was already name-first,
> which is what made the rest inconsistent rather than merely terse.
>
> The resolver is now one function, ConversationStore.labelFor, because three
> screens resolving names three ways is how a messenger shows you a name in one
> place and a base58 string for the same person in another. It returns the contact
> label when there is a real one, and the short address otherwise, so a stranger
> still renders as something a person can compare rather than as a blank.
>
> Applied to: channel publication senders, the channel header host, channel
> previews on the home screen, invite senders, and both manage rows.
>
> The address is demoted, not deleted. On the manage screen it stays on screen
> under the name, in the mono face, because approving or removing someone is a
> cryptographic act and the string is what you check against a peer reading theirs
> aloud. Identity, add contact and scan are unchanged: they are about the address
> itself.
>
> Both channel screens now subscribe to store version as well as channels version,
> because a rename has to reach a screen whose data lives in the other store.
>
> One Detox assertion was reworded, not weakened: the channel writer check still
> requires the short address, and now says why, because that peer is the proof node
> and was never added as a contact.

### `3804ff3ec644` feat: the first run leads with scanning someone, and says what the app is honestly

> Audit item 5. The first screen's primary action was "Show my address", which asks
> a new person to do the half of contact exchange that needs a second channel: read
> a base58 string to someone, or paste it into another app. Scanning is the half
> that needs nothing, works standing next to someone with no signal, and is the
> path a consumer already understands from every other app.
>
> So the hierarchy inverts: "Scan someone" is primary, "Show my address" is the
> first secondary, and paste stays where it was. Nothing is removed; the address
> path is still one tap away, which matters because an address read over a radio has
> to have a home.
>
> The closing note stops quoting the transport reality string at a first-time user
> and says the same thing in plainer words: no phone number, no account, no server
> that can read your messages, a relay carries them today, and the radio that would
> let phones reach each other directly is not built yet. That last clause is the
> honest one and it stays.
>
> The feature file gained a step for the new primary action rather than having an
> existing assertion loosened: "the first action offers my address" still passes,
> because that button still exists, it is just no longer first.

### `f31535f1d896` fix: take the palette to AA on the surfaces it actually sits on

> Two token values shipped below AA and reached a handset, and the audit that
> produced them was not systematic, so this checks all 52 pairs rather than the two
> we knew about. It found 15 below the line, of which 4 are real defects.
>
> alkaliFaint #7E7A6D to #939083. It carries hints, timestamps and placeholders.
> Measured against what it actually sits on, not a nominal background:
>
>   surface     before   after
>   abyss       4.63     6.20
>   night       4.30     5.76
>   surface     3.95     5.05
>   raised      3.51     4.71
>
> Three of four were below 4.5, so every timestamp in a bubble and every input
> placeholder was below AA. The worst case is raised, which is outbound bubbles and
> the composer, and that is the pair the value was solved against.
>
> sodiumDeep #6B4A16 to #5D4012. It is the only inversion in the system, dark text
> on a sodium fill, so it is measured against the fill:
>
>   on sodium         4.02 to 4.76
>   on sodiumBright   5.28 to 6.26
>
> At 4.02 every primary button label in the app was below AA.
>
> The other 11 failures are the two hairlines, and they are NOT all defects. The
> line and lineStrong tokens are 1.35:1 to 2.16:1 over the dusk ramp, which is fine
> for row dividers and section rules: WCAG 1.4.11 exempts purely decorative edges.
> It is not fine where the same token was drawing the boundary of a text input, an
> icon button, a pill or a selectable card, because 1.4.11 wants 3:1 for the visual
> information that identifies a component, and a 1.43:1 border is not a boundary a
> person can see. One token was doing two jobs, which is how that happened.
>
> So there is now an edge token at #666FA2: 3.13:1 on raised, 3.52:1 on surface,
> 3.83:1 on night, 4.12:1 on abyss. Solid rather than alpha, because an alpha
> edge's real contrast is a function of whatever happens to be behind it. Migrated
> to it: the Field input, both composer inputs, the composer icon buttons, the
> confirm cancel button, GhostButton, RelayPill and the channel access cards.
> Dividers and bubble hairlines keep the line token, and the token comment now says
> which job each has, and that line must never be a control's only boundary.
>
> raisedHigh #2D3148 is deleted. It was documented as "focus rings, dividers that
> must read" and it is 1.44:1 on night and 1.18:1 on raised, so it could not do
> either job. Nothing in the app used it. A token whose comment tells you to use it
> for something it cannot do is a trap for whoever tries, so it is gone and the
> comment points at the edge token instead.
>
> The tests in __tests__/contrast.test.ts are the part that stops this recurring:
> 43 assertions computing every pair from the tokens themselves, plus a check that
> the surface list IS the palette ramp so the guard cannot silently stop covering a
> new surface, plus anchors on the ratio function so a broken calculator cannot
> pass everything. Proved by restoring both old values and watching the four real
> failures fire.

### `909cae4980fd` fix: stop asking for notification permission at boot, ask where it means something

> My own item 1 shipped a defect and the Detox suite caught it, which is the suite
> doing exactly its job. wireArrivals asked the OS for notification permission at
> startup, so a brand new install opened onto a system modal:
>
>   "Grit Chat Would Like to Send You Notifications"
>
> sitting on top of the first screen, over an empty conversation list, asking to
> announce messages from people the person does not yet have a single one of. It is
> the worst first impression available and it directly contradicts item 3, where
> that same screen is supposed to be explaining what a relay is.
>
> It also made the entire iOS suite unrunnable. An app behind a system alert never
> reports idle to Detox, so every launchApp sat at "app is busy, 1 work item pending
> on the Main Queue" until it timed out. 14 scenarios, 14 failed, 83 steps all
> skipped, 27 minutes to learn one thing. I confirmed the cause by launching the app
> on the simulator and looking at the screen rather than reasoning about the log:
> the home screen renders correctly, with the modal over it.
>
> The ask now happens the first time a conversation or channel is opened, once per
> process, via askToNotifyOnce. That is the first moment a banner would mean
> anything, because by then somebody exists who can write to you. A refusal is still
> not an error: the app does not banner and the badge still tracks unread.
>
> Two tests, and I proved the second can fail by moving the ask back into boot:
>   - it asks once however many conversations are opened
>   - it does not ask while wiring arrivals, because that runs at boot
>
> HARNESS, the same defect one layer out. The Before hook pre-grants camera,
> microphone, photos and location precisely so no system alert can block a step.
> Notifications was a fourteenth way for one to appear, so it is granted too.
>
> More useful than that one line: Detox APPLIES the permissions object it is given,
> so a launch that passes a partial set silently resets everything it omits. The
> location refusal scenario relaunches mid-scenario and hand-wrote four permissions
> without notifications, so notifications went back to undetermined, the app asked on
> the conversation screen it had just navigated to, and the alert covered the very
> note the scenario asserts on. That is a footgun that reads as a product bug in
> whatever assertion comes next.
>
> So the set lives in one place, world.PERMISSIONS, frozen, and a scenario that needs
> a different value spreads and overrides one key instead of writing its own partial
> set.
>
> Result: 14 scenarios, 13 passed, 1 failed, 7m35s, up from 0 of 14. The one
> remaining failure is the location refusal scenario, which is what this partial-set
> fix addresses, verified next run.

### `46abfd40df33` fix: make two of my own checks able to catch what they claim to catch

> Both of these were found in review, and both are the same defect I have been
> fixing elsewhere: a check whose comment claims more than its assertion does.
>
> THE RELAY INDICATOR STEP could not catch its own regression. Item 2 exists to stop
> the raw pool line greeting a person on the home screen, and the step said so:
> "the telemetry line must never render on the home screen". It then asserted only
> that relay-detail does not exist before the tap. But the pool line renders in a
> SIBLING node, relay-telemetry, so the exact regression it guards against, the pool
> line coming back onto the collapsed home screen, would have passed.
>
> It now requires all three of relay-expanded, relay-detail and relay-telemetry to be
> absent before the tap, and the expansion plus a non-telemetry sentence after it.
>
> THE ICON CHECK WAS NOT A GATE. The generator has had a --check mode since it was
> written and I described it as a check that fails on drift, but nothing invoked it:
> it was a script I ran by hand, which is exactly the thing that rots. It is now a CI
> step next to typecheck and the unit suite, so a refined mark that updates nine of
> eleven rasters fails the build rather than shipping.
>
> Two supporting changes so that step is honest:
>
>   The generator now preflights ImageMagick and says so in a sentence. Without it,
>   a runner missing the tool fails with an ENOENT from deep inside a render call,
>   which reads as a broken icon rather than a missing dependency. Verified by
>   running with a PATH that has node and not magick.
>
>   The workflow header claimed the unit suite is 125 tests. It is 199. A comment
>   that quotes a number goes stale silently, so it now says what CI verifies
>   without quoting a count.

### `96fb42e4d389` ci: run the fourteen Detox scenarios where they can block a merge

> The suite existed and ran on one laptop, so it protected nothing. This job
> runs it on every push, and the proof that the gap was real: a Detox bump to
> 20.34.2 broke all fourteen scenarios at the readiness handshake and passed
> CI, because CI ran the xcframework materialize, swift build, tsc and jest,
> and never Detox.
>
> Three things had to be true for the suite to run on a machine that is not
> this one.
>
> Release, not Debug. A Debug build fetches JavaScript from whatever process
> owns 8081, which on this machine meant one agent's binary running another
> agent's code, twice, with failures that read as product defects. Release
> embeds the bundle, so the class is gone rather than avoided.
>
> A relay in the repo. world.js preferred a hand-built binary under /tmp, so a
> fresh clone failed every relay scenario on a missing file. The pinned copy is
> committed and its sha256 is asserted before the suite runs. Local runs still
> prefer the /tmp build when it exists, because that is the run that catches
> upstream drift, and startRelay now prints which one it used: the two say
> different things and the reader should not have to guess.
>
> Fixtures the repo creates. The media and location scenarios sent two /tmp
> files nothing ever created; they existed because a human made them once.
> BeforeAll writes both, and the PNG is a real decodable image rather than a
> byte string that looks like one.
>
> It fails fast and it says why. The ci profile sets failFast, measured at 87
> seconds to red with the relay path broken, against 28 minutes for the same
> class before. The harness chain is pinned exactly, no carets, because a
> floating detox is what drifted forward and broke everything.
>
> Not done, and stated rather than papered over: required stays off. Both
> location scenarios alternate failures run to run, one mechanism, proven from
> screenshots to be an unanswered system location alert stopping Detox from
> settling while the app is correct underneath it. A flaky gate is worse than
> no gate.

### `262ffb0a8d58` ci: trust the applesimutils formula so brew will load it

> Current Homebrew refuses a formula from an untrusted third-party tap, so the
> step failed with 'Refusing to load formula wix/brew/applesimutils from
> untrusted tap'. Scoped to the one formula rather than the whole tap, and the
> version is printed so a silent no-install cannot pass this step.

### `049d5dd8cbcc` ci: boot the simulator in its own step and name it to Detox

> The suite reached BeforeAll and died on 'function timed out, ensure the
> promise resolves within 300000 milliseconds'. The cost was booting a
> simulator the runner had to create cold, inside a hook that reports nothing
> about what it was doing.
>
> The job creates the device, waits with bootstatus until it is actually
> usable, and passes the udid in CI_SIM_UDID, which the CI device entry uses
> when set. So a slow boot is now a slow step with a time next to it, and the
> run records which device it used instead of picking among devices of a type.
> Both branches of that config are exercised: with the variable set it pins by
> id, without it falls back to type for a local run.

### `868ab21d1bcf` feat: rebuild the composer as one surface, and redraw the hop trace as a count

> Both are the chat screen, so they land together and were captured together.
>
> THE COMPOSER WAS UNUSABLE. The input and four buttons were laid out as peers on a
> single row, so the field got whatever width the buttons left it: "meet at the
> trash fence" wrapped to three lines inside a box about a quarter of the screen
> wide while location, image, voice and send took the rest.
>
> It is now one bounded surface holding two rows. The text spans the full width on
> its own row at the top, because the text is the primary object. The controls sit
> on a second row inside the same container, utilities left, send right, subordinate
> to the text instead of competing with it for horizontal space.
>
> The three attachment actions stay visible as icons rather than collapsing behind a
> plus menu. A menu is the closer copy of the reference, and it is the wrong trade:
> being able to see location, photo and voice is the part that was already liked.
>
> Growth: the field grows with content to a cap and then scrolls, so a long message
> cannot push the control row off the bottom. Verified at 297 characters, where the
> trailing words stop rendering and the control row is still on screen.
>
> SEND WAS UNDER THE KEYBOARD, which the audit already found and which the Detox
> suite had quietly worked around: the send step tapped the return key with a
> comment saying the button "is not drivable on a phone-sized screen". That comment
> was documentation of a defect.
>
> KeyboardAvoidingView did not fix it. Wrapping only the composer does nothing, and
> wrapping the content with behavior padding was measured on the simulator lifting
> the composer by LESS than the keyboard's height, leaving the control row
> underneath: the same defect surviving the rebuild. Its correction depends on where
> the avoider's frame sits relative to the window, which this screen cannot know
> from inside a header layout.
>
> So the keyboard height is tracked as a number and spent as padding on the
> container between the header and the composer. The list shrinks by exactly that
> amount and the composer rides up by exactly that amount. The composer's standing
> bottom margin, which clears the home indicator, collapses while the keyboard is up
> rather than stacking on top of the lift.
>
> Return inserts a newline, as multiline implies. Sending is the button, which is now
> always on screen. The return key no longer has to double as the only way out of a
> focused composer.
>
> Two Detox steps changed deliberately, not loosened: "I send" and "I publish" now
> tap the send and publish buttons instead of the return key, because the button
> path is the real one now and tapping it is what proves the fix.
>
> THE HOP TRACE loses the pipe. It drew one dot per peer plus a vertical bar before
> the terminal mark, so it was as wide as the journey was long and the count had to
> be counted. It now reads as three things in fixed positions: a circle for the
> sender, an arrow to a circle carrying the hop count as a numeral, an arrow to a
> terminal glyph. Constant width whatever the count.
>
>   Terminal glyphs are Font Awesome and differ in silhouette, not just colour:
>   chevron-right in flight, check delivered, times failed. Colour follows the
>   committed semantics unchanged: sage confirmed, sodium moving, ember failed.
>
>   Zero carriers gets a HOLLOW ring and no numeral rather than a circle containing
>   0. The vocabulary already signals that state as kind 'ring', meaning the core
>   holds the message and no peer has a copy, so there is no count to report. A
>   printed 0 reads as a measured value; an empty ring reads as nothing yet.
>
>   Two digits fit without reflow or clipping: the circle is sized for two digits so
>   a single digit sits in the same footprint, and the numeral clamps at 99 rather
>   than the circle growing.
>
>   The numeral is abyss on the tone fill: 9.94:1 on sodium, 8.69:1 on sage, 7.26:1
>   on ember, 6.20:1 on the quiet grey. One ink rule that clears AA on all four, at
>   a legible 13px rather than shrunk to fit.
>
>   The whole trace carries an accessible label stating the meaning in words, since
>   it is more iconic than what it replaced. The plain-language caption stays.
>
> MAX_TRACE_NODES is deleted. It capped how many dots would be drawn before a run
> outgrew a phone; nothing draws one glyph per peer any more, so it capped nothing
> and its comment described a drawing that no longer exists.
>
> VERIFIED BY RENDERING on the iPhone 17 Pro simulator, which is a simulator and not
> a handset. Composer empty, with a short message, at the growth cap, and with the
> keyboard up. Trace in all five states: delivered, carried but unconfirmed,
> accepted with nobody carrying, not sent, and a 12 hop count.
>
> Two capture defects caught while doing it, both mine, both worth recording. The
> first captures were of the wrong build entirely: another agent had installed a
> Release build from main over mine, and a Release build embeds its bundle and
> ignores Metro, so the screen showed the OLD design while Metro served the new one.
> Reinstalling the Debug build fixed it. And a system alert left unanswered by an
> earlier launch persists across launches, so two captures showed a modal that the
> current code had not raised.

### `67fa87479228` fix: grant permissions to the device under test, not a hardcoded one

> world.js read the simulator udid from .detoxrc.js devices.simulator.device.id
> and passed it to every simctl call, so the harness granted permissions and
> set location on ONE specific simulator on ONE laptop no matter which device
> the run was driving.
>
> CI found it as `Invalid device: 40E844EA-...`, which is the lucky case. The
> unlucky case is local and silent: a run on any other simulator granted to a
> device it was not using, so the explicit grant that exists because the
> install-time permissions map was once measured landing UNDECIDED was doing
> nothing at all. That is the same silent-substitution class as a Debug build
> loading another worktree's bundle from 8081.
>
> Both call sites now ask Detox which device it allocated, and the run prints
> `[world] simulator under test: <udid>` for the same reason it prints which
> relay binary it used: a harness that reconfigures a device nobody expected is
> how this survived unnoticed.
>
> This also retracts part of my own evidence. My fresh-simulator differential
> was driving one device while granting to another, so the location alert in
> that failure is explained by ungranted location, and the single-mechanism
> story in the PR body is not supported by that run. Re-running it with correct
> grants is the next step, and the PR body is corrected either way.

### `025ab9cce8ce` test: refuse location for real, and stop asserting a screen root behind a keyboard

> Three fixes, all in the harness, all found by running the suite rather than by
> reading it.
>
> REFUSAL NOW REFUSES. The scenario named "Refused location permission is said
> plainly" never refused anything. It launched with location unset and asserted the
> POSITION_UNAVAILABLE copy, "No location available. Nothing was sent.", because the
> step comment said denial "needs a human tap on the system prompt, and Detox can
> only grant or unset". That is out of date: Detox 20 taps system alerts through
> by.system.label. The step now taps the refusal, both apostrophe spellings tried
> because iOS uses a right single quotation mark, and fails loudly if no alert
> appeared at all, since the premise of the scenario is that one does.
>
> With the alert actually answered the app takes the PERMISSION_DENIED branch and
> says "Location permission is off. Enable it in Settings to share where you are."
> So the assertion changed to that copy. This is a strengthening: the scenario now
> exercises the branch its own name claims instead of a degradation standing in for
> it.
>
> A BLANKET ALERT SWEEP IN THE AFTER HOOK WAS A MISTAKE, mine, and it is worth
> recording rather than quietly deleting. The idea was that a leaked alert should be
> cleaned up centrally. Detox has no cheap existence check for a system alert, so
> each candidate label WAITS for one to appear: five labels spent the hook's entire
> 60 second budget on a machine whose normal case is no alert. Measured result was 14
> of 14 scenarios failing in After while 66 of 83 steps passed. A guard that fails
> every run is worse than the leak it guards against. The alert is answered where it
> is raised instead.
>
> A SCREEN ROOT IS NOT VISIBLE BEHIND A KEYBOARD. "I remove the member" waited for
> screen-channel to be visible after navigating back. That began failing when sending
> changed from the return key to the send button, because a button tap does not
> dismiss the keyboard and a return key did. Keeping the keyboard up is correct
> messenger behaviour, so the app is right; the assertion was wrong. With the keyboard
> up the ROOT view falls under Detox's 75 percent visibility threshold, so
> toBeVisible fails on a screen that is plainly there. It now asserts on channel-input,
> which sits above the keyboard by design and is unambiguous proof of which screen
> this is. The failure screenshot is what showed this: the channel was on screen the
> whole time.
>
> Also: the channel composer's icon buttons are borderless now, matching chat. The
> previous commit claimed the two composers mirror each other and they did not, since
> the channel one kept the old bordered buttons.
>
> Full suite after: 14 scenarios, 14 passed, 83 steps, 83 passed, 7m09s, on the
> iPhone 17 Pro simulator, which is a simulator and not a handset.

### `7b23786a598b` fix: install ImageMagick in CI, restore the destructive control's silhouette, test the trace

> Three corrections, all from review, all cases of a claim outrunning its evidence.
>
> THE ICON GATE WOULD HAVE BLOCKED MAIN. I wired npm run icons:check into CI with a
> comment asserting "it needs ImageMagick, which the macOS runner image ships". That
> is false. The macos-26 image manifest lists no ImageMagick anywhere, so the step
> would have failed for a missing tool and my own gate would have been the thing
> breaking every build: strictly worse than not wiring it at all. It now installs
> imagemagick before the check, and the comment records that I asserted the
> availability rather than looking it up.
>
> THE DESTRUCTIVE CONTROL LOST ITS SILHOUETTE. Rebuilding the channel composer, I
> gave every control in the tools row the same borderless treatment, including leave
> and retire. That control destroys a channel irreversibly for a host, it sits in the
> row a thumb rests on while typing, and it was left differing from the location icon
> by icon colour ALONE. This app's own encoding rule is shape first, position second,
> words third, colour last, and I had reduced the one destructive control to the last
> of the four. It previously had an ember outline and I flattened it without saying so.
>
> It now has its own silhouette again, an ember outline, plus a gap separating it from
> the utilities cluster so a thumb resting there is not already on it. Captured on the
> simulator: the outlined box reads as a different kind of thing at a glance.
>
> Worth saying plainly rather than burying: this control probably does not belong in
> the composer at all. Leaving a channel is management, not composition, and the host
> already has a manage affordance in the header. Moving it is a product call, so it is
> in the PR body for a decision rather than made here.
>
> THE TRACE HAD NO UNIT COVERAGE. Its five states were proven by looking at a device,
> which proves those five renders and nothing else. Two of the rules the redesign
> introduced are exactly the kind that a screenshot cannot generalise: what the count
> circle shows when no peer holds a copy, and what it shows when the number would not
> fit. Both are new cases, because the old drawing had one dot per peer and neither
> case existed.
>
> So terminalGlyph and countLabel moved into src/design/status.ts, which is the pure
> vocabulary module, and __tests__/trace.test.ts covers them: three distinct
> silhouettes with the set size asserted so two states can never collapse to one
> shape, null rather than a printed 0 for both no-carrier states, two digits kept
> whole, clamping past 99, and a guard that the label is never an empty string, which
> would draw a filled circle with nothing in it.
>
> They live in status.ts rather than the component for two reasons: they are decisions
> rather than drawing, and importing the component into a test pulls in
> react-native-vector-icons, which Jest cannot transform. Proved the tests fail by
> planting both regressions, a printed zero and a shared glyph, and watching the two
> assertions that name them go red.
>
> Verified after the move by running rather than by reasoning: the delivery scenario
> that asserts the trace on device passes, 1 scenario, 6 steps. Unit suite 206 tests
> across 15 suites.

### `a08faa42080c` fix: size the count circle from what the label can actually contain

> I encoded a case instead of resolving it. The circle was sized for two digits while
> countLabel could return "99+", which is three characters, so a hop count over 99
> would have overflowed the shape it was supposedly clamped to fit. The clamp and the
> circle were two numbers that had to agree and nothing made them agree.
>
> Resolved by choosing the honest option and making the relationship structural
> rather than a comment. "99" for a message that took 150 hops is a false
> measurement, and this app does not round protocol facts into something tidier, so
> the label keeps the plus sign and the CIRCLE grows to hold it: COUNT_MAX_CHARS = 3
> lives beside countLabel, and the component computes its diameter from it. IBM Plex
> Mono advances 0.6em, so three characters at 13px is 23.4px of ink and the circle is
> 28px. Widen the budget and the circle follows; the two cannot drift apart.
>
> The boundary table is now in the test at 0, 1, 9, 10, 99 and 100, plus a sweep to
> 1000 asserting no label ever exceeds COUNT_MAX_CHARS, plus a pin on the constant so
> widening it has to be deliberate in both places. Proved by planting an unclamped
> label and watching both assertions fire.
>
> That test then caught a second thing, which is why boundary tables are worth
> writing. inboundTrace floored its count at Math.max(hops, 1), so a zero hop message
> would have printed 1 in the circle while the caption beside it read "0 hops to reach
> you": the graphic contradicting the words. The floor was correct for the old
> drawing, which put one dot per peer and needed at least one dot to draw anything.
> The number is now printed, so the floor is gone and zero renders as the hollow ring,
> which already means nobody carried this.
>
> DELIBERATE TEST CHANGE, named because it asserted the old shape:
> __tests__/status.test.ts had "draws at least one node even for a zero hop count"
> asserting inboundTrace(0).nodes === 1. That requirement belonged to the dot
> drawing. It now asserts the count is 0 and that the caption agrees, under the name
> "does not invent a hop that the protocol did not report".
>
> Verified by rendering: 7, 12, 99, 150 and 0 hops on the iPhone 17 Pro simulator,
> which is a simulator and not a handset. 12 and 99 sit comfortably; "99+" for the
> 150 hop case sits inside the circle with a small margin, tight but not clipped;
> 0 draws the hollow ring with no numeral and its caption reads "0 hops to reach you".
> The delivery scenario that asserts the trace on device passes at the new diameter.
>
> 211 unit tests across 15 suites.

### `e1720c936d75` test: name what holds 18765 instead of timing out on it

> A run whose After hook did not reap its relay left one listening, and the
> NEXT run failed as "a relay is running" after a full healthz timeout, with
> nothing in the message about a port. Two orphans were found that way, both
> from one failed run on a machine under load average 42.
>
> startRelay now refuses up front and prints the pid and command holding the
> port, and says which of the two fixes applies: kill an orphan of this suite,
> or wait for another agent to announce a release rather than killing theirs.
> Proven by sabotage: with a relay held on 18765 the guard fires and names the
> holder.

### `5103170a6e27` docs: record the assertion that passed for the wrong reason

> A step waited on a screen root after typing and passed for months, because
> the return key dismissed the keyboard. It broke when sending moved to a
> button tap, which does not, and the root then falls under Detox's 75 percent
> visibility threshold on a screen the screenshot shows plainly present. Found
> by the UX agent on their branch; the class belongs with the other four.

### `0cfdbeb84495` Identity screen: hierarchy over a wall of protocol prose

> The identity screen opened with three paragraphs set at one size, with a
> line reading 'prekey published: false' among them. All true, none of it
> readable, and a person looking for their own address had to read a
> protocol summary to find it.
>
> Restructured into three steps. What a person needs: their address, as a
> code to scan and a string to copy, under one plain sentence. What they
> may need to act on: the relay endpoint, which is NOT behind the
> disclosure and moves above the address when nothing is set, because an
> address nobody can reach is not the thing to fix first. Then the machine
> layer behind a new disclosure: transport reality, what carrying does and
> does not prove, node state, relay pool telemetry, the build. Every line
> that was on the screen is still on it.
>
> New in chrome: Disclosure, a real button whose chevron swaps silhouette
> in the same ink, carrying accessibilityState.expanded, a full touch
> target, mounting its body only when open. MachineFact, a raw value in
> the mono face under a plain sentence saying what it means.

### `a5fc978e936e` One primary per screen, and a gate that measures action labels against the font the app ships

> Ranked audit item 8, swept rather than spot fixed.
>
> Add contact carried two full width sodium primaries competing for the same job. The screen is
> reached deliberately to paste an address, and "Add contact" is the only control on it that
> finishes anything: scan and "show my address instead" both navigate away. So the paste stays
> primary here and scan drops to the app's existing secondary, keeping its pinned add-contact-scan
> id on the element that inherits its meaning. Scan remains primary where it belongs, on the home
> empty state, and it is still the recommended path in the note above it.
>
> The other half of the item was a primary label wrapping to two lines, which reads as a broken
> control. That one is now a gate instead of a fix. __tests__/primaryHierarchy.test.js enumerates
> src/screens from the filesystem, refuses to run vacuously on an empty read, and asserts two
> things: at most one PrimaryButton per screen, and every Primary and Ghost label fitting the button
> that holds it at 360dp. Widths come from the advance widths in the bundled Barlow SemiBold, so the
> gate measures what the text engine measures rather than agreeing with its own guess. Its one
> calibration point is the Android measurement recorded in chrome.tsx, 389px at 2.625 density, and
> it reproduces that to within a third of a dp. Button geometry is read out of chrome.tsx's own
> StyleSheet and throws if a property it expects is gone, so a refactor there cannot leave the
> budget quietly asserting last week's numbers.
>
> Both halves were proven able to fail: a planted second primary on Add contact reddens the count
> half, and a planted long label reddens the fit half. No label needed shortening; all seventeen in
> the tree fit, the tightest being 218.7dp of 228dp available.

### `3618d3d2a6af` Channel join is one scan: a shareable hps:// link, and Path becomes Channel name

> Joining a channel took two pasted strings, a 44 character base58 host address and
> a path, in two fields. Nobody reads base58 aloud across a camp at night, so the
> consumer path was a dead end. This is ranked item 6 of the UX audit.
>
> src/hop/channelLink.ts is the new pure module. A channel is a host address plus a
> path, so the link is the protocol's own scheme carrying both:
> hps://<host>/<path>. Decoding is strict in the discipline of location.decodeFix:
> null for anything malformed, no repair, no invented path, because a half-read
> link joins a DIFFERENT channel. It refuses an empty path, a trailing slash, an
> empty step, whitespace, a query and a fragment, tolerates whitespace around the
> whole string, and matches the scheme case-insensitively while preserving host and
> path byte for byte. It deliberately does NOT judge the address: that is the SDK
> decoder on join, so a structurally sound link with a nonsense host is refused by
> name instead of mistaken for a contact code. channelNameProblem gates create with
> the same rules, so this app cannot mint a channel it would refuse to hand out.
>
> NewChannelScreen leads with the join and has exactly ONE PrimaryButton, the scan.
> The link field is the fallback for someone not in the room, and the host plus name
> fields survive behind a disclosure because an address read over a radio still
> needs a home. Create is a ghost with its own section, same testID, still creating.
> Path is renamed to Channel name in create and in join; the value is still the path
> and hps:// is untouched underneath. Nothing in src/hop or the stores was renamed.
>
> One camera now reads both codes. ScanContactScreen tries the channel link first
> and routes a hit to the join, and the contact path is byte for byte what it was:
> same accept function, same SDK validation, same refusals. Both join entry points
> go through one accept function, so a scanned code and a pasted link cannot drift.
>
> ChannelScreen gains the share affordance the host needed: a header action opening
> a panel with the QR, the link text and copy, reusing the identity screen's QR
> component and its 188 sizing rather than inventing a second convention. Two of the
> three access modes make a code less than the whole story, so the panel says so at
> the moment someone hands it over. A channel whose path cannot go in a link shows
> its two facts instead of a QR that decodes to something else.
>
> e2e: three new scenarios drive the new flow. The link join is proven end to end
> (decode, the core taking the request, the store row, and the screen stating that
> the keys have not arrived), the scan is proven present and primary, the by-hand
> path is proven still there, and the share panel is proven to render this channel's
> own address rather than a placeholder. The three create steps gained a swipe that
> brings a control on screen before using it, because the create form moved below
> the join section; it swipes zero times when the control is already visible, and no
> assertion was weakened. New ids are pinned in the guard, and the guard was proven
> to catch a rename of one of them.
>
> Nothing here claims mesh or device to device delivery. Every join request travels
> over the relay, and every string on these screens says so.

### `47f63ff51f4f` Prove the identity screen's order, not just the primitive

> Renders IdentityScreen and pins what the audit asked for: the address
> leads, the connection follows, the protocol row is last; the connection
> moves above the address when no endpoint is set; the endpoint, its
> warning and the pill are never behind the disclosure; the protocol state
> is absent until the row is opened and all of it is there once it is; and
> every machine value carries a sentence in the reading face above it.
>
> Each assertion was proven to fail: inverting the reorder flag breaks the
> three order tests, mounting the disclosure body unconditionally breaks
> the hiding test, a colour-only chevron breaks the shape test, swapping
> the two faces breaks the pairing test, and a 32dp row breaks the touch
> target test.

### `6078b4251802` Say it in the active voice: have someone scan this code

### `549190390f8c` UX audit: channel join by scan, one primary per screen, hierarchy over protocol prose

> Three ranked items from docs/ux-audit.md, plus a navigation defect a sibling agent
> found while driving the simulator, plus two gates for the classes those fixes belong to.
>
> Item 6, joining a channel. Joining needed two pasted strings, no QR and no link, which
> is a dead end for a consumer. A channel is now reachable by one scan: the same camera
> reads a contact code or a channel link, decided from the code itself rather than from a
> route param, so the contact path is byte for byte what it was. The link is hps://host/path,
> the protocol's own scheme, because a grit:// invention would be a brand doing a
> protocol's job. Decode refuses the shapes that are different topics on the network but
> look identical to read: a trailing slash, an empty step, whitespace inside, a query or a
> fragment. It tolerates what a paste actually carries: surrounding whitespace, and a
> capitalised scheme, with host and path preserved byte for byte because base58 and a topic
> path are both case sensitive. The create form is gated on the same rules it would refuse,
> so this app cannot mint a channel whose own link it will not read. "Path" is "Channel
> name" in the UI; the hps:// path underneath is unchanged.
>
> Item 8, one primary per screen. Add contact had two full width sodium primaries fighting
> each other; the save is now the only one and scan is a ghost, since scan stays primary
> where it belongs, on the home empty state. Every Primary and Ghost label in the app is
> measured against the bundled Barlow SemiBold at 360dp: a primary has 222dp uppercased, a
> ghost has 228dp. One label overflowed at 248.4dp and was cut rather than the type being
> shrunk, because the scale is deliberate: this app is read in sunlight with gloves on.
>
> Item 10, the protocol walls of text. The identity screen opened with three paragraphs and
> a line reading "prekey published: false". The honesty is demoted, not deleted: each node
> fact now has a plain sentence over its raw value, and the sentences are state aware so
> neither reads as a lie when the value flips. Behind a disclosure: the transport paragraph,
> the relay meaning paragraph, node state, pool telemetry, build sha. Deliberately NOT
> behind it: the endpoint field and its apply button, since hiding the one setting that
> decides whether a message can leave the device would be the same defect in a different
> costume. When no relay is set the connection block moves above the address, because an
> address nobody can reach is not the thing to fix first. The disclosure's cue is a chevron
> that swaps silhouette in identical ink, so no colour is load bearing, and the body mounts
> on open so a screen reader cannot walk into collapsed content.
>
> The navigation defect, reported by the capture agent and confirmed here by structure:
> AddContactScreen pushed the new chat on top of itself while both its siblings replaced, so
> one back tap from a conversation landed on a form still holding the previous address and
> the next paste joined it. One word, and now gated.
>
> Two gates, both proven able to fail before being trusted:
>
> __tests__/primaryHierarchy.test.js enumerates screens from the filesystem rather than a
> list, so a new screen is covered the moment it exists, and derives button geometry from
> chrome.tsx's own StyleSheet, throwing by name if a property it expects is gone, so a
> refactor there cannot leave it asserting stale numbers. It measures both branches of a
> busy state label, not just the resting one: that gap was found during integration when the
> gate correctly flagged two ternary labels as unmeasurable rather than passing them.
>
> __tests__/navigationStack.test.js asserts a finishing screen replaces itself, and states
> the list screen's exemption as an assertion rather than an omission, because opening a
> conversation from the list must push or there is nothing to go back to.


## 2026-08-23

### `6c0ce3fe45b3` site: marketing site for Grit Chat, plus brand refinements

> Astro, static output, zero client JS. Fonts subset from the app's TTFs:
> 457,934 bytes down to 84,640 of woff2.
>
> The copy rule governing the page is that nothing may claim mesh delivery
> works today, because it does not. The headline is a claim about what the
> product is for, and the honest status sits in the hero rather than buried,
> with a section stating exactly what is proven and what is not.
>
> The hop trace appears as documentation of a real interface element, drawn
> from status.ts with its real labels, not as a brand mark.
>
> Brand changes alongside it: prose on the social card now uses metric
> spacing rather than the optical pass, since the pass is built for a
> logotype and a full stop is nearly all white inside the x-height band, so
> it swallowed the word space after it. Palette updated to the two fixed
> hexes from the app branch (alkaliFaint #95917F, sodiumDeep #5E4013), which
> takes the contrast matrix to 15 of 15 passing.
>
> Defects found by rendering and looking: the hero carried a baked film
> border measuring 2.5 percent for ten columns before stepping to 16, so it
> was cropped; the trace check glyph overlapped the terminal bar; the mobile
> hero was a 164px strip, so narrow viewports get a 5:4 crop; and the skip
> link only answered focus-visible, so it now answers focus too.
>
> Verified: astro check clean, axe-core 4.13.0 reports 0 violations and 43
> passes, and the audit was proven able to fail on this page by planting a
> missing alt and a low contrast paragraph.

### `13c8d1e64b11` site: replace the industrial plate with a camp at night

> The old work.webp showed a worker in a hard hat beside a heavy mining
> loader. Its subject was a machine, which is what made it read as a job
> site, and it sat directly against consumer copy about festivals and
> campgrounds. A caption could not fix a photograph.
>
> camp.webp is the same art direction as the rest of the set: a dry playa at
> night, deep indigo sky, one small warm lantern as the only warm light in
> the frame. Its subject is people. Three figures in silhouette around the
> lantern with two dome tents and a fabric shade structure, backlit so no
> face is legible, which serves both the look and the privacy question. No
> machinery, no hi-vis, no signage, no lettering, and nothing resembling a
> Burning Man mark or effigy.
>
> Alt text describes the new frame truthfully rather than selling it. The
> caption is about the absence of signal, not a claim of delivery.
>
> Verified: astro check clean, no horizontal overflow at 360, and axe-core
> reports 0 violations and 43 passes against our DOM. Auditing the whole
> document reports three violations, all of them inside
> #speechify-side-player, a browser extension injecting a player into the
> page. Every violating target sits under that root.

### `bf66f4c7a505` brand: generate the brief as a single self-contained file

> tools/brief.mjs renders brand/README.md into brand/brief.html with the
> marks, the palette and a type specimen, so the brief can be read as one
> file with no dependencies. README.md stays the single source of the words.
>
> Self-containment is a hard gate rather than a hope, because the reading
> environment is an isolated frame with no network access, where a CDN font
> or a remotely referenced image renders as nothing instead of failing
> loudly. Every face is embedded as a data URI, every mark as SVG markup, and
> the generator exits non-zero if any subresource is not a data URI or if a
> script tag appears.
>
> The gate caught its own bug on the first run: the data URI regex omitted
> digits from the mime type character class, so font/woff2 never matched and
> it reported its own inlined fonts as remote. It failed loudly rather than
> passing, which is the behaviour worth having.
>
> Verified by loading the file with request interception blocking everything
> except the document: all four inlined faces load, all fourteen inlined SVGs
> render at nonzero size, and 17 headings and 6 tables lay out. The only
> blocked requests were a browser extension script and a browser-initiated
> favicon.ico, neither declared by the document. The 14 remaining http
> references are all xmlns namespace declarations, which are identifiers and
> are never fetched.
>
> brief.html, proof/ and explore/ are derived and ignored: between them most
> of a megabyte of base64 that one command regenerates.


## 2026-08-24

### `5e4156dbc2de` site: inline the built site into one self-contained file for sharing

> The site is built to deploy, but nobody outside this machine has seen it: Jason has
> only ever seen screenshots. Relic publishes a single HTML file and renders it in an
> isolated frame with NO network, so sharing the real thing means every stylesheet,
> font and image has to already be inside the file.
>
> npm run relic builds and inlines. The output is dist/gritchat-site.html, 1.00 MB,
> 21 subresources inlined from 0.77 MB of raw assets: one stylesheet, four woff2
> faces, and sixteen image files.
>
> It is a snapshot of the built output, not a second version of the site with
> different content. srcset is preserved in full with every candidate width
> inlined, rather than collapsed to one image, because collapsing would change
> which source a browser picks and make the shared file a different page from the
> deployed one.
>
> The gate is the same discipline as brand/tools/brief.mjs and it is hard, not a
> warning, because a remote reference does not error in Relic, it renders as
> nothing. Writing it surfaced two ways a gate can cry wolf about correct output,
> both fixed here:
>
>   It only stripped base64 data URIs, so an inline SVG carried as a URL-encoded
>   data URI (data:image/svg+xml,%3csvg...) read as a remote reference. Astro emits
>   exactly that shape.
>
>   It treated every link href as a subresource, so rel=canonical failed the gate.
>   Canonical, og: and twitter: URLs are metadata: nothing fetches them while
>   rendering, so they cannot render blank. They are now classified as metadata and
>   REPORTED rather than hidden, because a snapshot whose canonical names an
>   unchosen domain is a fact a reviewer should see. Right now they name
>   domain-not-chosen.invalid, which is the honest state of the domain decision.
>
> Proved the gate can fail, in both of its paths, rather than trusting a pass:
> a planted remote stylesheet fails inside the resolver, and a planted
> protocol-relative img src, which the resolver deliberately skips, is caught by the
> classifier. Both exit non-zero and name the offending URL.
>
> Proved the OUTPUT renders with the network actually blocked, not just that the
> gate liked it. Loaded the file in a real browser with request interception
> aborting everything except the document itself. The only blocked request was a
> browser extension's content script, nothing the document asked for. All four
> webfonts report loaded, all four images decode from data URIs at their true
> natural sizes, no horizontal overflow, zero script tags. The first read said two
> images had not decoded, which was the lazy-loading false negative: they were below
> the fold and had never been requested. Scrolling them in and awaiting decode is a
> capture-time fix and does not touch the shipped file.

### `0721089c83b4` site: make the self-containment gate able to fail, and inline the shapes it was missing

> The gate checked that every subresource reference was spelled `data:`. It never
> checked that the bytes behind the spelling were a whole file, so a payload could
> be flawless base64 inside a well formed data URI, satisfy every reference check,
> and still decode to nothing. Corrupting twelve bytes of one webp in dist left the
> output the same size, every reference still a data URI, the gate still printing
> "self-contained" and exiting 0, and the relay plate rendering as nothing. A gate
> that cannot see that manufactures confidence, which is worse than no gate.
>
> Payloads are now decoded and checked against the format they claim to be:
> signature, the total size the container declares for itself, and the terminator
> for formats that carry no size. That catches both a wrong format and a truncated
> one. Truncation matters because a browser tolerates it: a cut webp keeps its
> header, so naturalWidth still reports the full dimensions and the page looks fine
> while the image is half missing. Proven by breaking one webp two ways and one
> woff2, watching the gate exit 1 naming the offending payload, then restoring and
> watching it pass with byte identical output.
>
> Two rewriter gaps closed at the same time, both latent in this build:
>
>   - Only `src` and `href` values starting with `/` were inlined. A relative
>     `_astro/x.webp` was left fetching nothing. Astro emits absolute paths today,
>     but a base path or a config change makes them relative.
>   - `url()` inside an inline `<style>` block was never rewritten. Astro emits a
>     `<style>` rather than a `<link>` whenever a stylesheet falls under its inline
>     threshold, so a build whose CSS shrinks past that threshold would silently
>     ship four font references that fetch nothing.
>
> The old tool leaves three references un-inlined across those shapes. It exits 1
> rather than shipping them, which is the gate working, but the tool should handle
> the shapes rather than complain about them.
>
> The audit is now a pure function over a string, so `--check FILE` audits an
> artifact already on disk without building. That is what makes the gate testable
> at all, and it also lets a reviewer verify the exact file that gets published
> rather than a fresh build of it.
>
> Output for the current build is byte identical: 1043369 bytes, same sha256, 21
> inlined subresources, 20 base64 payloads (15 webp, 4 woff2, 1 png) plus the
> url-encoded svg favicon, 0 broken. Verified in a network blocked render that the
> page attempts zero network requests of its own and all four images decode.
>
> No copy, layout, imagery or styling changed. The canonical placeholder is left
> alone: the domain decision is not this commit's to make.

### `969563baee4d` brand: write the brief, and stop calling the guide one

> There were supposed to be two documents and there was only ever one. What
> shipped as "Grit Chat brand brief" is a specimen sheet plus usage rules: the
> wordmark on both grounds, the size ramp, the compact stack, the lettermark, the
> icon and favicon, the palette and type tables, clear space, do-nots. That is a
> brand guide. It answers "how do I set this correctly", which is a real question
> and not the one anybody was asking.
>
> The brief, meaning the document that says what the product is and why every
> visible decision went the way it did, was never written. A guide cannot answer
> that, and it is the one that governs the next decision, so its absence is why the
> same arguments keep getting relitigated.
>
> So: the existing document is retitled honestly, in its title and its subtitle,
> and the real brief is written beside it.
>
> brand/BRIEF.md is the source of the words, rendered by brand/tools/brief-doc.mjs
> to brand/grit-chat-brief.html. Thirteen sections, sourced from brand/README.md,
> docs/ux-audit.md, PATH.md and the bodies of PRs 4, 5 and 6. Nothing invented:
> where a thing is not settled it says so and names who settles it, and the last
> section is a list of six decisions that are explicitly not the designer's to
> make.
>
> What it carries, because these are the decisions that explain the artifact: a
> consumer messenger whose second job is to field test the transport, an instrument
> that looks like a product; who it is for and the deliberate exclusion of mining,
> search and rescue and disaster recovery, which are Hop's markets and which made
> this read as procurement collateral; the endorsement posture, Runs on Hop rather
> than Hop in the name; the name chosen and NOT cleared, against a live Class 38
> mark in the messaging class, replacing a placeholder that was an app already
> shipping on Google Play; the pictorial mark killed for reading as a robot arm,
> which is why the identity is wordmark led; Barlow Condensed and why California
> signage is the right register; the palette rule that sage means confirmed
> delivery and nothing else; the honesty constraint stated as a rule rather than a
> caveat, because every message still goes through a relay and radio is unshipped;
> the imagery rules; the hop trace as the one thing no competitor can show; and
> status taken from PATH.md rather than from optimism.
>
> The filename brief.html is deliberately unchanged. It is published as a relic
> keyed on the repository path, so renaming it would strand that relic and cost a
> second URL nobody holding the first would ever see.
>
> Three things fixed while in here:
>
>   - tools/doc-style.mjs now owns the faces, the palette variables, the reading
>     CSS and the SVG reader, shared by both documents. The alternative was a
>     second copy of sixty lines of CSS, and the first time one changed the pair
>     would have disagreed about what the brand looks like. Proven behaviour
>     preserving on the guide: identical 48 rule set and a byte identical body.
>   - The contents list was silently empty. marked dropped heading ids at version
>     8, so `headerIds: true` has been a no-op for a long time and an anchor list
>     built from it found nothing. Slugs are generated in the same pass that
>     collects them, so a heading and its entry cannot disagree, duplicates get a
>     suffix, and an empty list now throws instead of shipping.
>   - brand/README.md's merge note had the source of truth backwards. It said that
>     if the contrast table and src/design/tokens.ts disagree, the site is right
>     and the app regressed. The app is right: tokens.ts is where the values are
>     consumed and __tests__/contrast.test.ts computes every pair from them and
>     fails below standard, so the table is a snapshot and the constant is
>     enforced. Note rewritten, numbers left alone deliberately so this branch does
>     not publish a third set. It is stale in both directions and now says so: this
>     branch's tokens.ts still carries the ORIGINAL failing values, and a second
>     pass on feat/ux-audit moved them again.
>
> Verified. Both documents build, both pass site/tools/inline.mjs --check with zero
> non-inlined subresources, zero broken payloads, zero unexplained remote
> references and no script tag. Both rendered with request interception blocking
> everything and no base URL at all, so a surviving relative reference could not
> resolve: zero network requests attempted by either, all four subset faces loaded,
> no horizontal overflow, 13 of 13 contents anchors resolving with no duplicates.
> Both read on screen rather than inferred.

### `a29acfaceb1b` site: make the product the hero, not the landscape

> The page opened with a photograph of a playa at dusk and then several hundred
> words of prose. The writing was good and the genre was wrong: it read as a
> manifesto rather than as an app somebody installs. whatsapp.com and telegram.org
> were named as the references, so both were measured rather than described.
>
> At 1440x900 the shared move is a structure, not a style:
>
>   - The product is the hero. WhatsApp gives its opening visual 95 percent of the
>     viewport width and inlays an app screen inside it. Telegram has no headline
>     at all and goes straight to platform tiles with device demo videos inside
>     them.
>   - The prose is short. WhatsApp's longest single block anywhere on its page is
>     36 words. Telegram's is 23. Ours was 220 in one section and 61 in the hero
>     lead.
>   - One obvious call to action, as a button. WhatsApp's measures 336 by 50.
>   - Features are tiles with icons, not paragraphs.
>
> So the hero is now a real app screen in a frame beside the copy, both above the
> fold on a laptop. Longest prose block on the whole page is 38 words, down from
> 220. Eight feature tiles with icons replace the definition grid. One filled
> sodium button.
>
> WHAT DID NOT CHANGE. The art direction is inherited, not restyled: alkali on
> abyss, Barlow Condensed for display, IBM Plex Mono for the machine layer, sodium
> for the one action, sage still reserved for confirmed delivery and used nowhere
> else. WhatsApp is green and Telegram is blue; this is neither.
>
> The photography is not deleted, it is demoted. The camp plate and the relay plate
> keep their sections, the dust bleed keeps its band, and the landscape that used to
> BE the hero now closes the page, where atmosphere is the right job for it. A
> photograph cannot answer "what is this app", which is why it stopped opening.
>
> The honesty constraint got tighter, not quieter. It is still in the hero, still
> above the fold, now 33 words with a sodium rule down its side. Sodium rather than
> ember on purpose: this is the current state of something being built, not a
> failure, and ember would make the page look broken.
>
> The call to action is a beta invitation and nothing else. There is no App Store
> listing, no Play listing, and Android has never been built, so there are no store
> badges and no download chrome. The page says "Not in any app store. Closed beta,
> iPhone only, and Android hasn't been built." Where the invitation points is one
> value in config.ts, because today the only real door is an issue on the
> repository, which is a developer-shaped door for a consumer product and should be
> replaced the moment a real list exists.
>
> SCREENS ARE SWAPPABLE ASSETS, which is the part that matters for what comes next.
> src/assets/screens.ts is a manifest: drop a PNG into src/assets/screens/ and point
> an entry at it, and the page follows. heroScreen names which one leads, so
> promoting the chat shot is a one line change. DeviceFrame refuses to render an
> empty frame, because an empty phone outline reads as a product with nothing in it
> and that failure is silent in a way a thrown error is not. Every entry carries
> capturedOn, which RENDERS under the frame: a simulator is not a handset and a page
> that lets a reader assume otherwise is lying quietly.
>
> One screen so far, and it is real. Captured from a Release build with an embedded
> bundle at commit 7b23786, on an iPhone 17 Pro simulator, iOS 26.5, 1206x2622
> native with no crop and no scaling. It shows the REDESIGNED first run rather than
> the rejected one. It is also the empty state, which is honest and is the worst
> possible advertisement, so it does not lead: a populated list and a chat showing a
> delivered message with its hop trace are still needed, and the layout has slots
> waiting.
>
> THE HOP TRACE WAS REDRAWN, because the old drawing documents a UI that no longer
> exists. Spec taken from the agent that rebuilt it, at 7b23786: five things in five
> fixed positions at constant width, filled sender circle, arrow, count circle,
> arrow, terminal glyph. The count circle is hollow with no numeral when nobody
> holds a copy, because a printed 0 would read as a measured value and an empty ring
> reads as nothing yet, and it clamps at 99+ rather than growing. Three distinct
> terminal silhouettes, check and chevron and cross, so state never rests on colour
> alone. The previous drawing was one dot per peer plus a vertical pipe, so it grew
> with the journey and the count had to be counted by eye.
>
> Icons are Font Awesome solid, inlined as SVG from the real path data rather than
> redrawn by hand. Not a webfont: this page also ships as a single self-contained
> file read in a frame with no network, where a font request renders as nothing, and
> an icon font ships every glyph to deliver a dozen. No emoji as icons anywhere; an
> emoji's shape belongs to the reader's platform rather than to this brand.
>
> Palette corrected while in here. The app's second contrast pass moved alkaliFaint
> to #939083 and sodiumDeep to #5D4012 and deleted raisedHigh, and tokens.css is the
> shipping surface so it takes them now. Both were recomputed here before adopting
> rather than copied: alkali-faint 4.71:1 on raised, 5.30 surface, 5.76 night, 6.20
> abyss; sodium-deep 4.76:1 on a sodium fill, 6.26 on sodium-bright. All clear AA
> for normal text. raisedHigh is gone rather than renamed: it was documented as the
> focus ring colour at 1.44:1 and nothing used it.
>
> Verified. astro check clean across 18 files, 0 errors 0 warnings 0 hints. Build
> green. tools/inline.mjs passes: 24 inlined subresources, 23 base64 payloads all
> decoding, zero non-inlined, zero unexplained remote, no script tag. Rendered at
> 1440x900 and at 360 wide with request interception blocking everything and no base
> URL, so a surviving relative reference could not resolve: zero network requests
> attempted at either size, zero broken images, zero horizontal overflow, zero
> scripts. Above the fold at 1440x900 the app screen sits at top 101 to 813, the
> status callout at 604, and the button at 540 measuring 214 by 48. Both captures
> were opened and read rather than assumed.

### `5ed59fa61ab5` site: build and deploy it from CI, with the domain as one setting

> The site had no way to reach anybody. It built locally and shipped as a
> self-contained snapshot through a link, which was the wrong medium for a
> marketing site: a snapshot's link preview fetches nothing, and a site is supposed
> to live at a domain. This adds the pipeline that puts it there.
>
> DEPLOYS RUN IN CI, NEVER FROM A WORKSTATION. Nothing here was run against a
> provider by hand, no CLI was authenticated on this machine, no account was
> created and no secret was added.
>
> TARGET: GITHUB PAGES, and the one line justification is that the repo is already
> on GitHub, so it needs no new vendor, no new bill and no secret at all. The deploy
> authenticates with the workflow's own OIDC token, so there is nothing to provision
> and nothing to rotate.
>
> THE PREREQUISITE, WHICH IS NOT MINE TO SATISFY. This repository is PRIVATE, which
> I confirmed rather than assumed: gh reports visibility PRIVATE, owner jwaldrip, a
> user rather than an organisation. GitHub Pages for a private repository requires a
> paid plan. I could not read the account plan through the API, so I have not
> claimed either way. Either the plan covers it, or the repo goes public, and both
> are Jason's call. If neither, the deploy job fails at configure-pages and nothing
> is published.
>
> Also worth knowing, found on the way: the repo's DEFAULT branch is feat/bootstrap,
> not main. Pull requests target main, so the workflow triggers on main as asked,
> but a default branch pointing at a bootstrap branch will surprise something
> eventually.
>
> THE DOMAIN IS ONE SETTING, and it now actually is. PUBLIC_SITE_ORIGIN may carry a
> PATH, because a Pages project site lives at /<repo>/ and Astro needs that as `site`
> plus `base`, which is two settings. astro.config.mjs splits one value into both:
>
>     https://jwaldrip.github.io/burnchat  ->  site=...github.io  base=/burnchat
>     https://gritchat.app                 ->  site=gritchat.app  no base
>
> So choosing gritchat.app, gritchat.io or grit.chat is editing one variable and a
> DNS record. Proven by building all three ways and reading the emitted tags:
> canonical, og:url, og:image, every asset path, the favicon links and the robots
> Sitemap line all follow, and with no domain set the sitemap is omitted entirely
> rather than advertising the .invalid placeholder.
>
> Two real bugs this found, both of which would have shipped silently:
>
>   - Astro's BASE_URL does NOT reliably carry a trailing slash. With
>     trailingSlash: 'ignore' it arrives as /burnchat, so the favicon links came out
>     as /burnchatfavicon.ico. Caught by building with a base and reading the tags.
>   - The robots Sitemap line joined against the bare origin and dropped the base,
>     advertising https://jwaldrip.github.io/sitemap-index.xml for a site rooted at
>     /burnchat.
>   - tools/inline.mjs could not resolve a base-prefixed path at all: it stripped the
>     leading slash and joined, which is wrong by exactly one segment, and the whole
>     inline step died with "stylesheet missing from build". It now reads the base
>     from the same single setting the build read, so the two cannot disagree.
>
> SOCIAL PREVIEW, fixed properly rather than assumed. An og:image that resolves to
> nothing is the difference between a link that looks real when Jason sends it and
> one that does not, and it is invisible from a green build: the tag is present, the
> markup is valid, the file simply is not there. So there are two checks, and neither
> pretends to be the other. scripts/check-social-card.mjs proves the card exists in
> the build, is a real PNG or JPEG, and is at least 600 wide. The deploy job then
> FETCHES the deployed page, reads og:image out of the SERVED html rather than
> assuming it, and fetches that too.
>
> Both were proven able to fail. The local one by deleting the card: exit 1 naming
> both paths it looked at, then passing again on restore. The live one against a real
> served build on a local server, three ways: card missing gives a 404 and fails;
> card replaced by an HTML body carrying a 200 fails the PNG magic bytes, which is
> the success-shaped response case; and a page served that is not this site fails the
> product-name grep. Green again once all three were restored.
>
> HYGIENE. scripts/favicons.mjs generates favicon-16, favicon-32, favicon-48 and a
> real multi-size favicon.ico from the brand SVG, supersampled at density 384 then
> downscaled so a 16px letterform keeps its counter. The .ico container is written by
> hand because sharp has no ICO encoder and pulling a dependency in to lay out 6 plus
> 16n bytes would be the larger cost; verified structurally, three entries at 16, 32
> and 48, every payload a PNG within the file bounds, and the 32 was rendered and
> looked at. --verify runs in prebuild and in CI, so a stale icon fails rather than
> ships. robots.txt is generated rather than static, because a static file cannot know
> the origin and the only line worth having is an absolute Sitemap URL. Sitemap comes
> from @astrojs/sitemap, gated on a real origin for the same reason.
>
> WHY THE WORKFLOW HAS TWO JOBS THAT BOTH BUILD. The verify job deliberately does not
> touch the Pages API, because reading the Pages URL requires Pages to be configured
> and a pull request check that reds because a deployment target is not set up yet is
> a check that fails for a reason unrelated to the code. So verify builds against the
> placeholder and proves the tree is sound; deploy builds again once it knows the real
> origin, because canonical and og:image are baked at build time. Same commands both
> times, so the deployed site and the audited snapshot cannot diverge, and the
> directory that deploys is the one the gate just passed in the same job.
>
> MERGING THIS PUBLISHES THE SITE. On a push to main the deploy job runs and the site
> becomes reachable at the Pages URL. That is stated in the PR body too, because it
> should be a decision rather than a discovery. Nothing deploys from this branch: the
> deploy job is gated on the event not being a pull request, so a fork cannot publish
> and neither can this branch.
>
> Verified locally, as CI will run it: npm ci clean, fonts and favicons verify, astro
> check 0 errors 0 warnings 0 hints across 20 files, build green, inline gate green
> with zero non-inlined subresources and zero broken payloads in all three domain
> modes, social card check green in all three. The workflow YAML parses, and all 11
> of its shell blocks pass shellcheck and bash -n. The deploy job's verification block
> was run verbatim against a locally served build rather than read.

### `9cfbf19d520e` fix: stop the app typecheck compiling the site project

> ci.yml's Typecheck step has been red on this branch since the site landed, with
> eleven errors that have nothing to do with the app:
>
>   site/src/assets/manifest.ts(1,36): Cannot find module 'astro'
>   site/src/assets/manifest.ts(11,21): Cannot find module './hero.jpg'
>   site/src/config.ts(15,52): Property 'env' does not exist on type 'ImportMeta'
>   ... and eight more of the same shape
>
> The root tsconfig.json includes `**/*.ts`, excluding only node_modules and Pods,
> so `npx tsc --noEmit` at the repository root reaches into site/ and compiles a
> separate Astro project against the APP's TypeScript config and the app's
> node_modules. In that environment `astro` is not a dependency, `.webp` and `.png`
> carry no module declarations, and `import.meta.env` does not exist. Every one of
> those errors is correct about the environment it was given and wrong about which
> environment those files live in.
>
> site/ has its own tsconfig, its own dependencies and its own typecheck, `astro
> check`, which reports 0 errors 0 warnings 0 hints and now runs in CI as part of
> the Site workflow. So the fix is to let each project typecheck itself.
>
> The rule this encodes: one typecheck per project, each against the dependencies
> that project actually has. A root typecheck that reaches into a sibling project is
> not stricter, it is just wrong.
>
> This predates my commits, which I checked rather than assumed: the CI job has
> failed on every run of this branch back to 1b74278, and my first commit was
> efd7569. It is not mine, and I am fixing it anyway, because four of the eleven
> errors are in files I added and leaving a red gate for someone else to interpret
> is worse than the two minutes it costs.
>
> Scope verified: the exclusion covers exactly the five site TypeScript files and
> leaves 49 app and test files typechecked. Not verified locally, because the root
> node_modules is not installed on this machine and installing the full React Native
> dependency tree to run one tsc pass is not a trade worth making; CI runs it on
> this commit.

### `54cb7d5fd9ea` site: land the real app screens, and match the trace to the build they came from

> The hero was the designed empty state, which is honest and is the worst possible
> advertisement. It is now a populated conversation list, and the chat screen with a
> real delivered message sits beside the route explanation.
>
> Both are real captures from a running Release build with the JS bundle embedded and
> no Metro in the loop, on a dedicated iPhone 17 Pro simulator, iOS 26.5, at 1206x2622
> native with no crop and no scaling, off commit a08faa4. a08faa4 is an ancestor of
> origin/main, which I checked rather than took on trust, so these pixels are the
> shipped interface and not an unmerged preview.
>
> The deliveries are real. Each message was typed into the composer and sent through
> the app's own UI, crossed a relay, and was confirmed by an independent Hop node.
> THE HOP COUNT IS RELAY HOPS: this build has no radio bearer, so nothing on these
> screens shows two phones reaching each other directly, and no caption near them
> implies it. The one beside the chat says "confirmed at two relay hops" for exactly
> that reason.
>
> Every person and every message on the screens is invented for the captures. Nothing
> came from a real contact, a real address book, or any message on the machine that
> took them. The base58 addresses are real but belong to throwaway relay node
> processes, so they are nobody's account.
>
> The populated list leads rather than the chat, which was a choice. It is denser:
> three named people, three real deliveries, and the hop trace visible three times.
> An app with three conversations in it answers "what is this" faster than one with a
> single message and a lot of canvas above it, and the reference sites are wall to
> wall with populated screens. The chat shot then lands where a single message with
> its trace is the actual subject, so its empty upper canvas is context rather than
> absence.
>
> TRACE GEOMETRY CORRECTED, and this is the part that would have shipped as a quiet
> contradiction. a08faa4 changed the count circle from 22px to 28px. The site was
> drawing 22, so the page's own documentation of the trace and the screenshot of that
> same trace two sections apart would have disagreed about its size. That is the exact
> defect this component was redrawn to fix, reappearing one commit later.
>
> It is now derived the way the app derives it rather than copied as a number: three
> characters maximum because the clamp is "99+" and not "99", IBM Plex Mono advancing
> 0.6em so 7.8px per character at 13px, 23.4px of ink, plus 4 for breathing room. So
> the next size change follows from the same arithmetic instead of needing to be
> noticed.
>
> The empty state is kept in the manifest and deliberately not placed. Deleting a real
> capture to save four lines is a bad trade, and it is one line from being used.
>
> Not landed: the identity screen, because its ENDPOINT field shows ws://127.0.0.1:18766,
> the capture rig's local relay, which is honest and reads as a debug detail on a
> marketing page. And a channel screen, because the only available capture carries the
> proof harness's own wording rather than invented language and its header reads "0
> acked" from a subscriber that had not finished joining. Both reported rather than
> cropped or faked.
>
> Verified. astro check clean across 21 files. Build green. Inline gate green: zero
> non-inlined subresources, zero broken payloads, zero unexplained remote, no script
> tag. Social card check green. Rendered at 1440x900 and 360 wide with request
> interception blocking everything and no base URL: zero network requests attempted at
> either size, six images all loading, zero broken, zero horizontal overflow, zero
> scripts, longest prose block still 38 words. Measured in the rendered page: two
> device frames, both rendering "iPhone 17 Pro simulator, iOS 26.5" as visible text;
> all five count circles 28px; numerals 2, 3, 2, 1 with one hollow circle for the
> nobody-carrying state; sage resolving to rgb(157, 179, 128). Captures opened and read
> at both sizes, including a side by side check that the site's drawing of the trace and
> the app's own rendering of it now agree.

### `aac9b25c8170` brand: read the palette from the app instead of mirroring it

> brand/tools/build.mjs carried a hand-written copy of src/design/tokens.ts, and it
> went stale exactly the way a hand-written copy does. The app's second contrast pass
> moved alkaliFaint to #939083 and sodiumDeep to #5D4012 and deleted raisedHigh, and
> this file sat on #95917F and #5E4013 afterwards.
>
> That is not cosmetic. brand.json and the contrast table in brand/README.md are
> generated from this palette, and brand/brief.html is generated from that README and
> published as a shareable document. So the stale copy would have published a brand
> guide stating contrast ratios for values the product no longer uses, which is worse
> than having no table.
>
> The palette is now READ out of src/design/tokens.ts at build time. The app is where
> these values are consumed and where __tests__/contrast.test.ts computes every pair
> from them and fails below standard, which makes it the only copy that is enforced.
> Everything else is a picture of it, and a picture should be taken rather than
> painted from memory.
>
> Extracted with a regex rather than imported, because tokens.ts is TypeScript
> importing react-native and this is a plain .mjs script with neither in scope. The
> extraction is guarded: a missing or renamed token throws rather than producing an
> empty palette. That guard fired on its first run, because the block closes with
> `} as const;` and my pattern only matched `};`, so it refused to build instead of
> generating assets from nothing. Which is the guard working, and is why it is known
> to work rather than assumed to.
>
> brand/README.md's contrast table is regenerated from the result, and its note is
> retired. It previously said to regenerate once the app branch merged; that branch
> merged as ddadbd6, so the condition is met and the instruction is gone. Two ratios
> moved: hint text 5.83 to 5.76, and text on a sodium fill 4.74 to 4.76. All 15 pairs
> still pass, now recomputed from the enforced values rather than from a copy.
>
> The note that remains is the one worth keeping: if the table and tokens.ts ever
> disagree, the app is right and the table is stale. It can no longer drift silently,
> which is the actual fix rather than a promise to remember.
>
> Verified. Brand build green, brand.json now carrying the canonical palette including
> raised and edge, which the hand-written copy never had. Both brand documents rebuilt
> and both pass site/tools/inline.mjs --check with zero non-inlined subresources and
> zero broken payloads. The README table checked row by row against brand.json: 15
> rows, every ratio present in the generated output, no FAIL verdicts.

### `ae6b4434f4d8` site: say what the snapshot is for, now that the site has a domain

> The inliner described itself as producing "what gets published as a Relic". That is
> no longer true and it should not be the stated purpose of a tool anyone reads next.
> A marketing site belongs at a domain, not behind a link whose preview fetches
> nothing, and the site is deployed by .github/workflows/site.yml now.
>
> What the snapshot actually is: the review artifact. CI builds it on every pull
> request and uploads it, so a reviewer can open the exact page that was audited
> without cloning, installing and building, and without a server.
>
> The requirement outlived the medium, which is why the tool and its gate stay
> exactly as they are. An artifact that needs a network is not reviewable offline, so
> the file still has to render correctly with no network at all, and the hard gate is
> still the only thing that proves this one does. One sentence records where the
> requirement came from, because a constraint with no stated origin is the kind future
> readers delete.
>
> Also renamed the npm script `relic` to `snapshot`, which is what it produces. It was
> the last thing in the tree that named the medium rather than the artifact, and it
> was referenced nowhere: not in CI, not in either README. The workflow calls `npm run
> build` and `npm run inline` separately and is untouched.
>
> No behaviour change. Verified: astro check clean, snapshot builds, gate green with
> zero non-inlined subresources, zero broken payloads, zero unexplained remote and no
> script tag, social card check green, and the workflow's npm invocations still name
> scripts that exist.

### `e34387c70839` docs: an assertion that only passes on one machine is a local habit

> Three instances in one day of the same shape, an assertion true for a reason
> other than the one it claimed: the screen root that only passed because the
> return key dismissed the keyboard, the location refusal that only passed
> because this laptop beat the app's own ten second timeout, and a QR
> visibility check that nothing had ever exercised.
>
> The middle one is worth the entry on its own. Its design rested on an
> inherited comment claiming Detox could only grant or unset location.
> applesimutils accepts location=always|inuse|never|unset, so a real denial
> with no alert was available the whole time, and the race did not need to
> exist.

### `043db2baee8a` test: launch into a real denial, and stop asserting a QR is visible

> Three harness fixes, all of them defects in assertions rather than in the app, and two of
> them mine from earlier today.
>
> THE REFUSAL SCENARIO HELD A RACE. It launched with location undetermined and answered the
> system alert by hand, on a comment I inherited and kept which claimed unset was the only
> option because NO was not a valid Detox value. That comment was wrong: applesimutils takes
> location=always|inuse|never|unset, checked here rather than believed. Because of it, the
> scenario raced Detox's tap on the alert against the app's own 10 second location timeout.
> This laptop won that race and reported denial; a CI runner lost it and reported "No
> location available", so a green run here and a red run there were testing different
> things. The relaunch now denies location outright and the alert block is gone, which
> removes the race rather than widening a wait around it. It is also nearer what the
> scenario claims: answering an alert proves the app handles a permission just revoked,
> launching denied proves it handles one that was already off, which is the state a person is
> actually in. Credit to the agent who found it, on a runner, with the exact copy in hand.
>
> Proven able to fail: granting the permission instead makes the step fail with its own
> message, naming the branch it did not reach.
>
> A QR WAS ASSERTED VISIBLE, IN TWO PLACES. Both timed out while the panel rendered
> correctly: the artifact screenshots show the note, the code, the real hps:// link and the
> copy button on screen with nothing over them. Detox's own reason is "View does not pass
> visibility percent threshold (75)" against an RCTViewComponentView. I did not determine
> why that threshold is missed for a code that is plainly drawn, and the comments say so
> rather than inventing a mechanism. No step in this suite had ever asserted a QR visible, so
> there was no precedent that the pattern worked. Both steps now assert the code EXISTS and
> assert the LINK is visible, which is the string the code encodes and the thing the scenario
> is really about: a QR nobody can decode from a screenshot proves less than the exact link,
> and the link is already checked against the channel's own host and name.
>
> THE BACK-TAP STEPS ENCODED THE STACK DEPTH. "I go back" tapped back twice and its comment
> described Conversations to AddContact to Chat as the design. That was the defect this
> branch fixes, written into the harness, and it meant a regression to push would have been
> absorbed and stayed green. One tap now, which fails by name on a regression. readMyAddress
> blind-tapped twice inside a try/catch; it is a bounded loop that checks for the list between
> taps, so it encodes no depth at all.

### `1c2f5d93e7a6` site: record the next capture run's targets and traps in the screens manifest

> Comment only, no behaviour change. The manifest is the file a capture run reads, so
> it is where this belongs rather than in a message somebody has to still have.
>
> PR 10 on feat/ux-audit-2 restructures identity, new channel, scan and add contact.
> None of those are placed on the page, so nothing here goes stale when it merges, and
> the two that ARE placed, the conversation list and the chat, are confirmed unchanged
> by that branch's owner. Recorded so the next person does not have to work that out
> by comparing screenshots.
>
> Also recorded: capture from a main sha, never a branch tip. Capturing a tip is what
> put an earlier run on the interface Jason had already rejected, and the instruction
> not to repeat it is worth more written down than remembered.
>
> TWO SHOTS WORTH ADDING, both suggested by the branch owner and both better than what
> is on the page, for the same reason: they show the protocol doing the work instead of
> the page asserting it.
>
> The channel share panel draws a QR and the real link, hps://host-address/channel-name,
> which is the channel's actual address on the network rather than an invite service.
> The page currently spends a paragraph on that claim. A screenshot of a real link is
> worth more than the paragraph.
>
> The identity screen with Protocol detail open contains, in the app's own words, the
> sentence the honesty callout paraphrases: no phone number, no account, no server that
> can read your messages, relay only, no Bluetooth or local network bearer yet. The
> product saying it is a different quality of evidence than the marketing copy saying
> it.
>
> TWO TRAPS, both already paid for by the agent that hit them, which is the only reason
> they are cheap to write down now.
>
> simctl and Detox capture the viewport only, and that disclosure sits below the fold,
> so no launch argument reaches it. It has to be driven: tap the row with testID
> identity-protocol, whose body is identity-protocol-body. Forcing a scroll offset in a
> throwaway build is fine for looking at and must not produce a shipped pixel.
>
> And do not assert a QR is visible in any Detox check built around these. Detox
> reports "View does not pass visibility percent threshold (75)" against a QR frame
> that is plainly drawn on screen. Nobody worked out why, so nobody should guess:
> assert it exists, and assert the link text, which is the string the code encodes.
>
> Verified: astro check clean across 21 files, snapshot builds, gate green with zero
> non-inlined subresources and zero broken payloads, social card check green.

### `c7c9f5b8e7ca` site: record two more facts about the screens worth capturing

> Comment only, no behaviour change, same file and same reason: the screens manifest
> is what a capture run reads, so a fact about a screen belongs there rather than in a
> message somebody has to still have.
>
> THE IDENTITY SCREEN LEAKS THE CAPTURE RIG'S RELAY. Its ENDPOINT field renders
> whatever relay the build was pointed at, so a shot taken on a rig with a local relay
> puts something like ws://127.0.0.1:18766/ on a marketing page. That is a property of
> the screen rather than a mistake in any one run, which is the part worth writing
> down: the existing identity capture was declined for exactly this and the next person
> would otherwise decline it again from scratch, or worse, crop around it. Point the
> rig at a presentable endpoint before shooting that screen, or do not ship it.
>
> THE APP ICON IS ALREADY ON MAIN, in 0911a9e inside merge ddadbd6, and CI regenerates
> and diffs the rasters so one that drifts from its source fails the build. So a
> springboard or app tile shot is safe today and shows the real icon rather than the
> grey placeholder, which is a change from what I recorded earlier. 22 iOS PNGs and 2
> Android adaptive layers, all generated from brand/icon/*.svg by
> scripts/app-icons.mjs. If the page ever wants to claim the icon is derived rather
> than drawn, that is the claim and it is checkable.
>
> Verified: astro check clean across 21 files, snapshot builds, gate green with zero
> non-inlined subresources, zero broken payloads, zero unexplained remote and no
> script tag.
>
> A note on CI for whoever reads this commit: GitHub Actions is currently refusing to
> start jobs on this repository. Both checks failed in three seconds with zero steps
> and no log, the app CI failed identically on a commit that only changed comments, a
> rerun reproduced it exactly, and the previous commit passed both. That is an
> infrastructure refusal rather than a code signal. I could not read the billing API to
> confirm the cause, it needs a scope I will not request, so this records the shape of
> the evidence and not a diagnosis. The verify job's steps were run locally in order
> instead: npm ci, fonts and favicons verify, astro check, build, inline audit, social
> card check, all green, and the artifact the job would upload exists at 1263546 bytes.

### `f0e066a3e116` feat: one app identity on both platforms, chat.grit.app

> Jason owns grit.chat, and this is its reverse DNS form. It replaces
> com.jwaldrip.gritchat on iOS and com.burnchat on Android, which were never
> even the same string as each other, so the two stores would have held what
> looked like two unrelated products. A future web app at app.grit.chat is the
> same product and now shares the same identity.
>
> Done now rather than later because a bundle id is the primary key of an App
> Store record and cannot be changed after submission.
>
> Everything that names the id moved together, since a half rename is worse
> than none: both iOS build configurations, the Android namespace and
> applicationId, the Kotlin package tree from com/burnchat to chat/grit/app
> including the androidTest entry point, and the harness, which had the id
> written out three times in two spellings and now has one APP_ID constant.
>
> The keychain service moved with it, from com.jwaldrip.gritchat.node-identity
> to chat.grit.app.node-identity, and that is safe ONLY because it changed in
> the same commit. A new bundle id is a different app to both platforms, so
> every install starts with an empty keystore and there is nothing to orphan.
> Renaming that string alone would strand existing identities, and this module
> deliberately refuses to mint a replacement rather than silently orphan every
> contact who saved the old address.
>
> Signing was checked rather than assumed, because a wildcard is not
> automatically a match: the profile "iOS Team Provisioning Profile: *" under
> team 8H7HVPHS87 carries application-identifier 8H7HVPHS87.*, a true wildcard
> that does match chat.grit.app, provisions BushidoPhone, and whose
> keychain-access-groups entry covers the new id.
>
> Verified on a SIMULATOR, not a phone: Release build installed and launched
> under the new id delivered a real message through a relay to an independent
> node, delivered=true forwardHops=2, with the second party's own INBOX line
> confirming it. Both artifacts carry the new id, the renamed Kotlin package
> compiles, and the Detox suite is 13 of 14 against the renamed app, the one
> failure being a scenario already red on main for unrelated reasons.
>
> PATH.md keeps the recorded proof commands naming the OLD id, because they are
> evidence of what was run rather than instructions, and rewriting them would
> make this repo claim proofs that never happened under this identifier.

### `6b901da8705e` docs: correct the premise under the bundle id, and name what actually depends on it

> I wrote that Jason owns grit.chat. That is not established: he believes he
> bought it, a broker purchase can complete asynchronously, and the registry
> does not show it. Measured rather than relayed: ns1/ns2.afternic.com,
> 76.223.54.146 and 13.248.169.48, and a null MX (0 ., RFC 7505), which is
> marketplace parking rather than a domain someone operates. grit.app is a
> separate domain and also not his.
>
> The decision stands and nothing is reverted. A bundle id is a free form
> reverse DNS string and neither store verifies it against domain ownership,
> so no part of this build depends on the purchase.
>
> What does depend on it, recorded so it is not a surprise later: Universal
> Links need apple-app-site-association served over HTTPS from the domain, and
> Android App Links need assetlinks.json the same way. Deep linking is gated on
> the purchase completing. The identifier is not.
>
> Also named here because it was a real latent defect rather than a cosmetic
> one: iOS shipped as com.jwaldrip.gritchat while Android shipped as
> com.burnchat, so the two platforms already had different identities before
> this change.

### `09c2aaaf625d` docs: scope the signing evidence to the team id it depends on

> Every string in that verification is keyed to team 8H7HVPHS87: the wildcard
> is 8H7HVPHS87.* and so is the keychain access group. Apple does not document
> whether converting an individual account to an organization preserves the
> team id, and app transfer is unavailable until at least one release has
> shipped, so a future account change would invalidate this reading rather than
> carry it forward. Named the cheap way to re-check it instead of leaving a
> stale claim that looks settled.

### `9f59e331d2c1` docs: state grit.chat's status as measured rather than as uncertain

> The earlier wording said the ownership was not established and that a broker
> purchase may resolve asynchronously. That understates what three agents have
> now measured independently: the domain is registered to a third party and
> actively listed for sale. DNS shows Afternic nameservers, a null MX that
> affirmatively refuses mail, an SPF hard fail at the apex and a wildcard
> answering for _dmarc. HTTP shows a 114 byte stub redirecting to a GoDaddy
> for-sale lander with utm_medium=parkedpages. RDAP shows registration
> 2026-01-19 to a redacted registrant through Sav.com with a dan.com
> marketplace verification host.
>
> The distinction is not pedantic: a later reader cannot otherwise tell
> 'nobody checked' from 'checked, and it belongs to someone else'. Jason's
> belief that a purchase completed is recorded as his, alongside the absence of
> any registry evidence for it.
>
> Nothing about the decision changes. The identifier stands, merging is safe,
> publishing is the irreversible act, and neither store verifies a bundle id
> against domain ownership.

### `2ad6419b3cc4` docs: merge plan for PR sequence post-billing

### `234b59558424` docs: correct billing claim, add e2e conflict analysis, specify re-verification commands

### `5354e21bf385` docs: add billing cost analysis showing CI may have triggered the refusal

### `8381795b16d7` Complete the DNSSEC control set in both directions

> An ad flag from a resolver that never withholds one is worth nothing. gritchat-domain flagged that I had proven only one direction, and supplied the contrast case that makes the set discriminating: grit.chat returns NOERROR with NO ad flag through the same resolver, so the flag is per zone rather than blanket. Verified all five rows myself: hopme.sh NOERROR+ad, grit.chat NOERROR no-ad, dnssec-failed.org SERVFAIL, sigfail SERVFAIL, sigok NOERROR+ad. The two domains at the centre of the decision sit on opposite sides of a control proven to go both ways.

### `0f112c18cdd3` The checker hashed a 404 body: a fifth one, inside the check for the fourth

> Applied gritchat-publish's verify-the-artifact-not-the-edit advice and it caught
> another of mine within a minute. Compared local file, pushed git blob, and what
> raw.githubusercontent serves. First two matched. Third did not.
>
> Naive reading: the push is corrupted. Actual cause: burnchat is private, so
> unauthenticated raw.githubusercontent returned a 14 byte body reading
> "404: Not Found", and md5sum hashed it cheerfully. The probe never fetched the
> document.
>
> That is the soft 404 trap again, inside the tool I had just written up for
> catching the soft 404 trap. Same shape as all the others: curl exited 0, md5sum
> ran cleanly, a hash came back. Nothing failed. The length gave it away, 14 bytes
> against 65,000. Authoritative comparison is local against pushed git blob, which
> matches at 4668d128.
>
> So a checker needs the same scepticism as the thing it checks, and "the hashes
> differ" is not a finding until both hashes are confirmed to be of the thing you
> meant to hash.
>
> Error list updated to five, and the method list corrected from two parts to
> three after the relocation dropped a block, caught by the same full-artifact
> check rather than by a scoped probe.

### `9ebf390165c8` Take gritchat-publish's sharper diagnosis and the size-assertion rule

> I called the raw.githubusercontent failure the soft 404 trap recursing. Their
> reading is better and replaces mine: I was comparing three artifacts and only
> two of them were the artifact. Local file and pushed blob are the same thing
> measured twice, which is the valid pair. The served copy was a third thing a
> private repo cannot serve anonymously, so that leg could never have been valid,
> and its invalidity looked exactly like a corrupted push.
>
> Their addition is the cheap part everybody skips: assert the size before you
> trust the comparison. In both places this class was caught the tell was LENGTH,
> not a hash. 14 bytes against 65,000 for mine; their own check passing only
> because 38,074 and 38,075 differ by a trailing newline. A hash is equal or not,
> and equality says nothing about whether you fetched a document or an error page.
>
> Combined rule now in the doc: compare the whole artifact, compare only legs
> where both sides are genuinely the artifact, and assert the size before you
> trust the comparison. Applied it to this document, size assertion included.
>
> Also took their point that settles the count better than a number: every count
> understates it, because nobody counted the errors a peer caught before
> publication. The figure that matters is not how many there were, it is that none
> of them shipped.

### `45644275fe42` The useful redundancy is in the method, not the repetition

> gritchat-publish's closing point, and it explains what I had only asserted. I
> wrote that reproduction over non-identical corpora is stronger than agreement on
> one fetch. They said why: three agents agreeing on the same fetch establishes
> only that the fetch is reproducible, which is nearly worthless, because a flaky
> fetch was never the failure mode.
>
> The failure modes this workstream actually hit were the wrong URL, a soft 404, a
> redirect collapsing two pages into one, and a subset presented as a total. Every
> one survives any number of identical re-runs and dies the moment somebody
> reaches the same claim by a different route. So the useful redundancy is in the
> method, not the repetition. That is the transferable lesson.
>
> Final verification, size asserted first: 70,576 bytes, twenty two load-bearing
> strings, five stale strings gone. One probe reported MISSING and was itself the
> error: the check string spanned a line break. Resolved by reading the context
> rather than re-matching, which is gritchat-brand's half, and the probe set should
> normalise whitespace. A checker needs the same scepticism as the thing it checks,
> one more time.

### `8aa86edb8671` docs: what moving to the Grit-Chat-App organisation buys, breaks and does not change

> The organisation exists, is on the free plan, and is empty. It can receive a
> transfer. What that transfer is worth, measured rather than assumed.
>
> Every macOS job has been refused since 19:30:53Z with GitHub's billing message,
> read from the check run annotation rather than inferred from a red X. The job
> carried zero steps, was assigned no runner and lived two seconds.
>
> The account allowance is bounded by observation, because the token lacks the
> user scope and the plan is unreadable. The last job GitHub granted a runner was
> requested with 2,465 billable minutes already debited. The first refusal came
> after 3,106. GitHub publishes four allowances and only 3,000 falls inside that
> interval, so the origin is Pro and the destination free organisation is smaller,
> not larger.
>
> The timing API reports zero billable milliseconds for all 110 runs in this
> repository, including runs that held a macOS runner for 57 minutes. The numbers
> here come from job timestamps with GitHub's documented per job round up applied.
> 53.4% of all spend is five red Detox runs.
>
> So a transfer buys a fresh 2,000 minutes, worth about three and a half Detox
> runs, against an estimated 1,940 to clear the queue in the best merge order.
> It is a float, not a fix.
>
> It also costs Pages. GitHub documents that a private repository transferred to a
> free organisation loses protected branches and Pages, and PR #5 deploys the site
> to Pages from this private repository.
>
> The breakage list is short because the repository is unusually clean: zero
> secrets, variables, environments, webhooks, deploy keys, forks, issues,
> assignees, milestones, releases and linked projects, no branch protection, no
> rulesets, and every PR is a same repository branch. All 11 worktrees resolve
> origin from one shared config file, so one set-url fixes them all.
>
> Recommends pushing the 12 unpushed commits first, flipping the default branch
> before anything else, transferring and renaming as one operation, and moving
> PR #9 from fourth to last because it is the PR that makes every later run cost
> ten times more.
>
> Nothing was executed: no transfer, no rename, no default branch change, no
> merge, no organisation or setting touched.

### `408e89b0fe34` docs: reorder PR #9 to last based on measured cost impact (1100 minutes saved)

### `b1726c7c4bb2` Prepare the grit.chat zone as Cloud DNS Terraform, provision nothing

> The registrar transfer for grit.chat is in flight. This is the reviewed step
> that happens once it completes and a credential exists, so that step is a plan
> review rather than a fresh investigation.
>
> Nothing is provisioned. No account, no zone, no token, no record, no
> delegation, no deploy. Three gates keep it that way, and the third is the one
> that matters: apply requires GRIT_DNS_APPLY_ENABLED to be set, so merging this
> branch creates nothing even after a credential exists.
>
> Measured, not assumed:
>
> grit.chat publishes no DS record. Confirmed two independent ways. A
> non-recursive query to a .chat registry nameserver returns NOERROR with an
> empty answer and the aa bit set, proved by an opt-out NSEC3 record whose span
> covers the NSEC3 hash of grit.chat, computed at 7N99QTM2J3F5TSOPBUN26RPUQVPIOA8P
> under the zone's published SHA1, 0 iteration, salt 73 parameters. The registry's
> own RDAP record agrees with delegationSigned false. That is what makes this
> cutover low risk: with no DS at the parent there is no chain of trust a
> nameserver change can break.
>
> Mail lands with the zone rather than after it, for a mechanical reason. RFC 5321
> section 5.1 treats an empty MX list as an implicit MX pointing at the address
> record, so a zone delegated with web records and no MX delivers mail to the web
> server instead of bouncing it. Silent, and unprovable afterwards, which is the
> worst shape available when Apple deems notices given when sent. So MX is never
> absent: while no provider is chosen it publishes a null MX per RFC 7505 section
> 3, and the apex TXT publishes v=spf1 -all, so the domain refuses mail loudly and
> authorises nobody to send as it.
>
> Two decisions are deliberately not made. The web host lands in web_apex_a,
> web_apex_aaaa, web_apex_alias and web_www_*. The mail provider lands in mail_mx,
> mail_spf_terms and one of mail_dkim_txt_keys or mail_dkim_cname_targets. Both
> arrive as a committed auto.tfvars file, so a decision is a reviewable file
> rather than a code change. Empty produces no record rather than a wrong one, and
> a check block warns on every plan until both are filled.
>
> No nameservers appear anywhere in this tree. Cloud DNS assigns them at zone
> creation and they cannot be known earlier, so any value written now would be
> fabricated.
>
> Verified locally, since plan and apply need a credential that does not exist:
> terraform validate passes; fmt is clean; the locals were exercised in terraform
> console in both the undecided and decided states, confirming the null MX switch,
> single composed SPF record, in-domain DMARC rua that needs no external
> destination authorisation under RFC 7489 section 7.1, and DKIM splitting at
> exactly 255 characters with the chunks reconstructing the original byte for byte;
> the workflow YAML parses and all five shell blocks pass bash -n and shellcheck;
> and the delegation report step was run against a stubbed terraform CLI in both
> branches, proving it prints the do-not-delegate warning when the zone is
> incomplete.
>
> [One paragraph removed here: it named the owning GCP project, its project number, the Workload Identity arrangement and the accounts involved. That is the operator's cloud estate rather than an engineering decision, and it is held in the private company records repository. The engineering substance of this commit is unaffected.]

### `4a8e791a3e8c` Resolve the mail tenant: the collective's account, records still unchanged

> grit.chat joins the bushido collective's Workspace account as an additional
> domain, the same way hopme.sh already sits on it. Rejected along the way: an
> alias on the personal waldrip.net tenant, and a standalone Grit Chat tenant.
>
> Three account shapes have now been proposed and two withdrawn, and not one of
> them changed a value in mail.auto.tfvars. That is a property of Google rather
> than luck, and it is now proven on the collective's own tenant instead of only
> read off a documentation page:
>
>   thebushido.co   1 aspmx.l.google.com. plus ALT1/2 at 5 and ALT3/4 at 10
>   hopme.sh        1 smtp.google.com.
>
> Both carry include:_spf.google.com and a 2048 bit DKIM key at selector google,
> and both deliver. Two domains, one tenant, two MX vintages, both working. So the
> record set tracks WHEN a domain was set up, not what role it plays or which
> tenant holds it. mail_mx stays ["1 smtp.google.com."].
>
> One distinction stays open and it is not a DNS question. Both options are called
> an additional domain and they behave very differently. An alias domain creates no
> mailbox: Google says "Each user gets an email address at both your primary domain
> and the user alias domain" and "Each mailing group also gets an email address at
> the user alias domain", so every existing user and group on the collective's
> tenant would gain an @grit.chat address into their own mailbox. A secondary domain
> creates one: "Users get a Google Workspace account, email address, and mailbox for
> their domain. Pay for each user account." A single address, which is what was
> asked for, is the second of those.
>
> The Domain Transfer paragraph is retargeted at the shape actually chosen. That
> tool merges whole environments and expects the source removed afterwards, so
> Google documents no path for extracting a single secondary domain from a shared
> tenant while leaving the rest in place. Worded as an absence of documentation
> rather than a proof of impossibility, because that is what was established.
>
> Two facts recorded about hopme.sh because they are now properties of the
> arrangement rather than incidental: its zone is already on Cloud DNS, so this
> pattern is proven rather than new, and its DMARC sits at p=none while this module
> defaults to p=reject.
>
> Documentation only. No values changed, nothing provisioned.

### `985c3004f9da` feat: three tabs, and channels and chats as two separate lists

> The app opened onto one screen that stacked a conversation list and a channel
> list on top of each other, with a single footer offering both "Add contact" and
> "New channel". Two lists sharing one screen meant two empty states could not
> exist, two sort orders could not exist, and the screen had two primary actions.
>
> Primary navigation is now three tabs: channels, chats, me. Chats is where a
> launch lands, so home stays a people screen. Channels and chats are genuinely
> two lists on two screens, not one list with a filter: the stores already kept
> them apart (ConversationStore and ChannelStore) so this is the presentation
> catching up with the data. Each tab has one empty state, one primary action and
> its own sort. Detail views push over the tab bar on the root stack.
>
> Identity is the me tab rather than a pushed screen, so the QR button that used
> to sit in the conversation list header is gone: the tab replaces it. The
> contextual routes to it (the empty state's "Show my address", the relay
> onboarding, the add and create forms) now select the tab.
>
> What survives from the UX audit, deliberately: home is a people screen, names
> come before addresses with addresses behind detail views, one primary action per
> screen, and the relay indicator stays a quiet one line pill that expands only
> when asked. It sits on the chats tab alone rather than on both lists, so there
> is exactly one element answering to relay-pill.
>
> The tab bar is drawn by the app from src/design/tokens.ts, not by the navigator:
> active state is a rule plus a filled glyph plus weight before it is colour, and
> unread counts badge chats and channels, with channel invites counted because an
> invite goes stale if nobody looks.
>
> Detox: the suite asserts the new structure. A new scenario proves the two lists
> are separate, scoped with withAncestor so a merged list fails it rather than
> passing because the other tab happens to be off screen. The
> conversation-row-0-or-channel-row-0 fallbacks are gone; they only existed
> because one list held both kinds.
>
> Adds @react-navigation/bottom-tabs, which is pure JS and needs no pod install.

### `97feff0e877f` spike: gluestack on one real screen, themed from the existing tokens

> NOT a migration and not proposed for merge. This branch exists so the question
> "can gluestack wear this art direction" is answered by a real screen in the real
> app rather than by reading marketing copy.
>
> What is here: npx gluestack-ui init --nativewind, the six components the add
> contact screen needs, the shipped neutral theme replaced by the Grit palette and
> the Grit faces, and src/screens/AddContactScreen.tsx rebuilt on gluestack
> Button, Input, Text and Divider with every testID and every behaviour unchanged.
>
> What the CLI did that had to be undone by hand, recorded because it is the
> finding: it replaced module:@react-native/babel-preset with
> module:metro-react-native-babel-preset, which is the pre 0.73 preset and is not
> installed in this project, so its own output does not build. It also pointed
> tailwind content at ./app, ./components and ./utils, none of which is where this
> app's code lives, and it wrapped only the tab navigator in GluestackUIProvider,
> leaving every pushed screen outside the theme.
>
> Measured costs are in the branch: 41 new packages for the styling engine alone
> before a single component, including react-native-reanimated and
> react-native-worklets (native, so pods and a rebuild) and lightningcss, and 19
> TypeScript errors inside the copied component source under this repo's own
> tsconfig, none of them in the ported screen.

### `930ec0959f53` fix: reserve the tab bar's height, and stop the channels subtitle truncating

> Two defects the first rendered screenshots showed, not reasoning.
>
> The tab bar is drawn below the tab roots and the roots no longer claim the
> bottom safe-area inset, so a screen's scrollable content ran under the bar: the
> me tab's last line of node state sat behind it with no way to scroll clear. The
> bar now states its height as a constant, is exactly that tall by construction
> rather than by minimum, and the three roots reserve that height plus the inset
> at the bottom of their scroll content.
>
> The channels subtitle read "Groups, flooded once to everyone holding the key"
> and the header renders a subtitle on one line, so a phone drew it as an
> ellipsis. Shortened to the same length as the chats tagline, which is measured
> to fit, with the reason recorded next to the string.
