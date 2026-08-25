# Grit Chat UX audit

A task-by-task audit of the app as a person with a phone would use it, written after Jason's verdict:
bad UX first, somewhat bad UI second. The verdict is treated as ground truth and is not re-litigated
here. The frame is the predictable one: this app was built feature by feature to prove protocol
capability, and every feature has tests, but nobody sat down and used it as a person who wants to
message a friend. The marketing line "a real messenger, not a protocol demo with a chat window bolted
on" is currently a claim rather than a fact. This document is the work to close that gap.

## Evidence and its limits

Read for this audit:

- `App.tsx`, `src/app/navigation.ts`, `src/app/GritContext.tsx`, `src/config.ts`
- every screen in `src/screens/`
- `src/components/chrome.tsx`, `src/components/HopTrace.tsx`, `src/components/AddressText.tsx`
- `src/store/conversations.ts`, `src/store/channels.ts`
- `src/hop/seam.ts`, `src/hop/relayBearer.ts`
- `src/contacts/acceptAddress.ts`
- `PATH.md`

Screenshots read, and what they show:

- `/tmp/gc-android-shots/01-launch.png` and `02-fonts.png`: the empty home screen.
- `/tmp/gc-android-shots/screen-identity2.png`: the "Your address" screen.
- `/tmp/gc-android-shots/s-add-contact.png`: the Add contact screen.
- `/tmp/gc-android-shots/s-new-channel.png`: the New channel screen.

Evidence discarded rather than reasoned from:

- `/tmp/gc-android-shots/pixel7-01.png` is a fully black frame captured before the app drew. Worthless.
- `/tmp/gc-android-shots/screen-identity.png`, `screen-scan-contact.png`, `screen-new-channel.png` and
  `screen-add-contact.png` are byte-identical captures of the empty home screen, mislabeled. They are
  not scans of those screens.

What I have NOT seen, and therefore do not describe as observed:

- No screenshot of the Chat screen exists. Chat findings below come from `ChatScreen.tsx` only.
- No capture from the physical BushidoPhone exists yet; it is being fetched by another agent. Nothing
  in this document claims to have read a real device screen.
- `01-launch.png` shows Font Awesome glyphs rendering as tofu boxes in that build while `02-fonts.png`
  shows them correctly, so the tofu is a build/asset state, not a design choice. It is cited as a
  cosmetic finding with that caveat.

## Task-by-task audit

### Install and get an identity

What a person does: install, open, wait for "restoring your identity", land on the empty list.

What they must already know: nothing should be required, but the screen demands they understand a
relay. The first thing rendered is a pill reading "relay retrying" and a mono telemetry line
"relay pool: 1 endpoint(s) known, 0 dialable, next try in 16s"
(`src/screens/ConversationsScreen.tsx:78-90`, string built in `src/hop/seam.ts:417`). A consumer has no
idea what a relay is, what "dialable" means, or what to do about 0.

Where they get stuck: the relay is the only transport, and without it nothing moves. The only way to
fix it is to tap the pill, which opens "Your address" (`IdentityScreen`), scroll past the QR to a
field labelled "Endpoint" holding a value like `ws://10.0.2.2:18765/`, and tap "Use this relay". That
is a WebSocket URL a person must type. On the Android emulator `10.0.2.2` is the host alias and a real
phone can never reach it. There is deliberately no default
(`src/config.ts:9-12`), which is honest but dead-ends a first-timer with no out-of-band source for a
relay URL. There is no onboarding that explains "this app talks through a relay today, here is how to
get one".

### Add your first contact

What a person does: choose paste or scan. Paste needs the other person to transmit a 44 character
base58 string through some other channel, which is the one thing this app exists to replace. Scan
needs line of sight and a camera.

What they must already know: that an "address" is a base58 string, that nothing is discovered
automatically, and that the other person has a screen called "identity" to show theirs
(`AddContactScreen.tsx:67-71`).

Where they get stuck: the form leads with the mechanism. "THEIR ADDRESS" is the first field with
placeholder "base58 address from the other device"; the human name is an optional afterthought
(`AddContactScreen.tsx:72-88`). For a consumer the name is the mental model and the address is the
plumbing. There is no directory, no suggestion, no way to discover anyone, and the empty state offers
no way forward beyond paste or scan, both of which require an out-of-band channel. The scan path is
the right consumer path but it is the second button, and the home empty state's primary action is
"Show my address", not "Scan someone" (`ConversationsScreen.tsx:100-120`).

### Send a first message

What a person does: open a conversation, type, send. The composer is conventional and correct: input,
image, mic, location, send, return key submits (`ChatScreen.tsx:325-380`). The placeholder "meet at the
trash fence" is a genuinely consumer touch.

What they must already know: that a first message will sit at "accepted, nobody carrying it yet" or
"carried by N peers, not confirmed" unless the relay is up and the peer is online.

Where they get stuck: to a first-timer a message that never confirms reads as broken, and the trace's
vocabulary ("carried by 2 peers, not confirmed") is protocol language, not human language. The trace
is the product's signature and is currently a debug readout. (No chat screenshot exists; this is from
`ChatScreen.tsx:293-303`.)

### Discover a message arrived

What a person does: nothing works. There is no push notification, no badge, no sound. Arrival is only
visible if the app is open and the pump is running in the foreground. Grep finds no `AppState`
handling and no push anywhere in `src/`. A backgrounded phone on a relay-only transport receives
nothing at all. This is the single largest gap for a messenger: it cannot tell you a message came.

### Start a channel

What a person does: New channel, type a "Path" (placeholder "center-camp"), pick an access card,
create.

What they must already know: that "Path" means the channel's name, that they are the host, and the
dense paragraph about flooding and open channels (`NewChannelScreen.tsx:93-97`).

Where they get stuck: "Path" is protocol vocabulary for what a consumer calls a channel name. The
screen offers Open / Approval / Invite-only as three selectable cards (`NewChannelScreen.tsx:107-127`)
while the file's own comment says the moderation UI that makes Approval and Invite meaningful has not
been built, so two of the three choices are decoration with consequences the app cannot manage. To
tell someone to join you must convey both your address and the path; there is no shareable link or QR.

### Join someone's channel

What a person does: paste the host's base58 address and the path into two separate fields
(`NewChannelScreen.tsx:150-168`). No QR, no link.

Where they get stuck: the join is a request. Membership begins when the host's keys arrive over the
relay, not on this screen, and the list shows "join requested, keys not received yet" with no progress
and no way to know if the host ever saw it (`ChannelScreen.tsx:202-209`,
`ConversationsScreen.tsx` channel preview). A person cannot tell "pending" from "lost".

### Share where you are

What a person does: tap the map marker in a chat. One-shot fix, confirm-first in channels, and the
bubble shows coordinates, accuracy, bearing and distance (`LocationBubble.tsx`). This is the best
designed task in the app.

Where they get stuck: minor. Coordinates like "36.55, -116.93" are honest but a consumer wants "near
the ice tower". Acceptable today; a map or landmark label is a later nicety, not a fix.

### Find someone in a crowd

What a person does: walk up to them and show your QR. That is the only crowd affordance, and it is the
same as add-contact QR. With no radio the app cannot find anyone at a distance. Honest, but it offers
nothing beyond line of sight.

## Structural problems, separately

1. No arrival notification, badge, sound, or background receive. The app cannot announce a message.
2. The app opens onto a protocol status screen, not a people screen. Relay telemetry is the first
   thing a consumer sees.
3. Relay is a hard prerequisite with no onboarding; the only fix is pasting a `ws://` URL on a screen
   called "Your address".
4. First-run hierarchy is backwards: the primary action is "Show my address", which is the other side
   of the exchange, not "Add someone".
5. Everything is keyed by raw base58 addresses; names are optional labels, so every list, invite,
   channel host and sender shows an unreadable address until you name it
   (`src/store/conversations.ts:8-14`, default label is the short address).
6. Joining a channel requires two pasted strings with no QR or link.
7. Access modes are offered without the moderation to make them real; invites arrive as address-only
   rows.
8. Identity conflates three jobs: share your address, configure the relay, and node diagnostics
   (`IdentityScreen.tsx:64-158`).

## Cosmetic problems, separately

1. Primary button text wraps to two lines ("SHOW MY ADDRESS") making the primary action look broken
   (`02-fonts.png`, `screen-identity2.png`).
2. Two full-width sodium primaries on Add contact (ADD CONTACT and SCAN A QR CODE) compete; there
   should be one primary (`s-add-contact.png`).
3. Tofu glyph boxes in `01-launch.png` where Font Awesome icons belong, a build/asset state.
4. Dense protocol paragraphs set at body size with no hierarchy; walls of text.
5. The relay telemetry line in mono at the top of home is visually loud.

## Proposal: what the app should be

The target is a consumer who has used WhatsApp or Signal and has never heard of a mesh. Match their
conventions where the convention is load-bearing; diverge only where the product is genuinely
different, and keep the hop trace as the signature.

Launch and onboarding. A first-run flow that explains in plain words "this app talks through a relay
today; here is how to get one" and asks for a relay before showing the list. Match Signal's setup
simplicity. Diverge on identity: no phone number, no account, no username search; the address is the
identity and that is the point, but it is presented as "your code", not as a base58 string.

Home is people. Open onto a list of people and channels. One primary action, "Scan someone", with
paste secondary. Relay status demoted to a small quiet indicator, a dot plus one word, that expands on
tap into a plain-language explanation. Raw telemetry ("endpoint(s) known, dialable") never renders on
the home screen.

Add a person. Lead with "Scan their code" as the primary; paste as secondary. The name is required and
shown everywhere; the address is hidden behind a detail view and copied from there, never typed.

Identity, split. "Your code" is QR plus copy plus share, and nothing else. Relay configuration and
node diagnostics move to a separate Connection screen, with diagnostics behind an advanced disclosure.

Chat. Keep the composer; it is already right. Keep the hop trace but make it legible: a one-line plain
caption under each message ("arrived via 2 hops", "still travelling") with the raw trace available on
tap. The trace is the one thing no other messenger can show; preserve it and make it read as a feature,
not a debug readout.

Channels. Rename "Path" to "Channel name" in the UI while keeping path on the wire. Provide a
shareable join affordance, a QR or link encoding host plus path, so joining is one scan instead of two
pastes. Do not offer access modes until the moderation screen that makes them real exists.

Arrival. Local notification and badge driven by the foreground pump now, clearly labelled as what it
is. Background push is named as future work that needs a relay push service; it is not claimed today.

Where we must not match. No phone number, no cloud backup of identity, no "online / last seen", no
username or directory search. The product's difference is address-as-identity and provable routes;
those are kept, not designed away.

Nothing in this proposal claims or implies mesh delivery works today. Every message still goes through
a relay, and the copy says so. No new brand elements are introduced; the wordmark, palette and type
are settled and reused as-is.

## Ranked work, by how much of the verdict each explains

Structural, in order:

1. Arrival notification, badge and sound from the foreground pump, plus honest naming of background
   push as future. Explains the most of "bad UX": a messenger that never tells you a message came is
   broken by definition.
2. Home becomes a people screen; relay telemetry leaves the home screen and becomes a quiet expandable
   indicator. Explains both the confusion and the "looks like a dev tool" read.
3. Relay onboarding: a first-run flow that explains the relay and asks for one, instead of a dead-end
   ws:// field on "Your address". Explains "can't even get it to work".
4. Address-first architecture replaced by name-first: names required and shown everywhere, addresses
   hidden behind detail views. Explains lists feeling alien.
5. First-run hierarchy fixed: "Scan someone" primary, "Show my code" secondary.
6. Channel join as one scan via a shareable link encoding host plus path; "Path" renamed to "Channel
   name" in the UI.
7. Access modes hidden until moderation exists; invites show names once contacts are named.

Cosmetic, in order:

8. One primary per screen; stop the primary button text wrapping.
9. Fix the tofu glyph build state so icons always render.
10. Break protocol walls of text into hierarchy: a headline, a plain sentence, and an advanced
    disclosure.

The first item is the one that changes his mind. Build it first.
