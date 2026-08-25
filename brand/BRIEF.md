# Grit Chat brief

This is the decision record. It says what Grit Chat is, who it is for, and why every visible choice
went the way it did. It is not a sales document and it is not the brand guide. The guide is the
specimen sheet and the usage rules: marks, sizes, palette, type, clear space, do-nots. It answers
"how do I set this correctly". This answers "why is it like this at all", which is the question a
guide cannot answer and the one that actually governs the next decision.

Every fact below is sourced from this repository. Where something is not settled, it says so and
names who settles it. Nothing here is aspiration written in the present tense.

## What Grit Chat is

A consumer messenger built on Hop, a delay tolerant mesh protocol, where a message is built to
travel device to device instead of through a carrier.

Its second job, and the reason it exists now rather than later, is to field test that transport. The
acceptance bar this project converged on is not a feature list. It is a delivery proof, from
`PATH.md`:

> Grit Chat, running on the physical BushidoPhone, exchanges a real message with a second
> independent Hop node through a running relay, and the sender sees delivery confirmed with a hop
> count greater than one.

So the honest description is an instrument that looks like a product. Both halves of that are load
bearing, and the tension between them is the single most useful thing to understand about this
project. The instrument half is why every feature has tests and a proof trace. The product half is
what was missing, and `docs/ux-audit.md` states the cost plainly: the app was built feature by
feature to prove protocol capability, and nobody sat down and used it as a person who wants to
message a friend.

Design work here is the correction to that, not decoration on top of it.

## Who it is for

A consumer who has used WhatsApp or Signal and has never heard of a mesh. That is the target named
in `docs/ux-audit.md`, and it sets the whole register: match their conventions where the convention
is load bearing, diverge only where this product is genuinely different.

The situations it names are ones where an ordinary phone gives up. A festival where nobody has bars.
The basement of a venue. A canyon. A campground three switchbacks past the last tower.

## Who it is not for

Mine sites, search and rescue, disaster recovery, and anything else industrial or emergency
services.

This is a deliberate exclusion, not an oversight, and it is recorded as a copy rule in
`site/src/pages/index.astro`: those markets belong to Hop, they are sold to a different buyer, and
putting them in front of a consumer app makes it read like procurement collateral. The correction
produced the copy the site ships today. A messenger that opens by talking about incident response is
not a messenger anyone installs for a music festival.

Hop keeps those markets. Grit Chat does not sell them.

## How it relates to Hop

Segmented, with an endorsement.

Hop is the network this app runs on, not part of its name. The approved endorsement shape is fixed
in `site/src/branding.ts` as **Runs on Hop**. Hop is credited and linked wherever it comes up,
because serious infrastructure underneath is the right posture for a product whose entire claim is
about how a message travels.

What this rules out: naming the app after the protocol, implying the app is Hop's official client,
or leaning on Hop's credibility to make a claim Grit Chat cannot make on its own.

## The name

**Grit Chat is chosen. It is not cleared.**

From `brand/README.md`, which is where the trademark position lives:

- A live **Class 38** registration held by Grit Media LLC, covering television broadcasting. Class
  38 is the telecommunications class, which is the class a messaging app files in. That is the
  collision that matters, and it is not a distant one.
- A Garmin Class 9 mark for athletic training software.
- A mobile game called Team Grit.
- No messaging app named Grit exists in either app store.
- No trademark opinion has been obtained.

The field is crowded rather than clear. A crowded field cuts both ways: it weakens anyone's claim to
the bare word, and it means this one is not free either.

What follows from that, and is already enforced in code: no `(R)`, no `(TM)`, no trademark symbol
anywhere, and nothing that implies the mark is registered. The brand faces do not contain those
glyphs at all. Every user-visible product string lives in one module on each side, `src/branding.ts`
in the app and `site/src/branding.ts` on the site, so a forced rename stays cheap.

**What it replaced.** The placeholder was Mesh Chat. That is an existing shipping mesh messenger on
Google Play, so it had to go regardless of what replaced it. Grit Chat is not a preference over a
safe option, it is a replacement for an unusable one.

**Domain: `grit.chat`, bought.** The registrar transfer completed 2026-08-25T00:16:37Z, moving it to
GoDaddy with the one-year expiry extension a transfer adds, and the nameservers left the broker's
Afternic pair at 02:21:27Z the same morning. An earlier revision of this brief recorded "Domains,
none bought" and surveyed the alternatives: `gritchat.com` taken, `gritchat.app` and `gritchat.io`
free, `grit.chat` a paid premium registration. That survey was accurate when made and is now moot.
The site still does not hardcode a domain: `site/src/config.ts` falls back to a reserved `.invalid`
host so a build that was never told its origin looks like a preview build, which matters more now
rather than less, because `grit.chat` publishes no A record yet.

## What was rejected, and why that matters more than what shipped

**A pictorial mark, built from the product's own geometry, and killed.**

The first identity took the hop trace, the run of node glyphs and connectors that renders under
every message to show the route it physically took, and built a mark out of it. The reasoning was
sound: it was derived from the product rather than invented, and it was constructed from real
geometry rather than generated.

It read as a robot arm.

That is fatal rather than fixable. A symbol people misread on first sight has failed, and you cannot
explain your way out of a symbol. It is deleted, not parked.

This is why the identity is wordmark led, and that is worth stating as a positive rather than a
consolation. It means the type choice, the spacing and the optical corrections do all the work, and
there is nowhere to hide. A symbol has to earn its existence and this one did not.

Also rejected, with the reasons that make the shipped choice an argument rather than a preference:

| Direction | Why not |
|---|---|
| Barlow Condensed Bold, mixed case | Condensed lowercase came out cramped. Lost the signage authority without gaining warmth. |
| Barlow Bold, mixed case | Genuinely good, the most legible small, and the most generic. It could be any app. Kept as the runner up. |
| IBM Plex Mono | Reads as a developer tool, which is exactly wrong for a consumer messenger. |
| G over C stacked icon | 0.28:1, so it fits only 17.9 by 63.5 inside Android's guaranteed safe circle. An illegible smudge at 40px. |
| Justified GRIT over CHAT as primary | Dies below roughly 40px, and the tracking GRIT needs to match CHAT's width is visible. Kept as a compact secondary. |

## The wordmark, and why that typeface

**Barlow Condensed Bold, all capitals.**

Barlow is drawn from California public signage: tall condensed capitals that stay legible on a
sunlit highway. That is the literal reading condition for this product, which is used outdoors, in
dust, at arm's length, sometimes with gloves on. Condensed caps is also how field equipment is
marked, so the register is right before any styling happens.

It is already the app's display face, set in `src/design/tokens.ts`. A logotype that matches the
interface it labels is one less thing to explain.

The spacing is computed, not nudged. `brand/tools/typeset.mjs` measures each glyph's silhouette
scanline by scanline inside the cap band, averages the white each side already carries, and assigns
the sidebearings that equalise those margins. The classic loose pair, A followed by T, closes to
-11.17 at cap height 100 with no hand kerning anywhere in the system. The word space between GRIT
and CHAT measures 26.26 rather than the nominal 30, because T's arm overhangs into the gap and the
gap is measured rather than assumed.

A wordmark cannot be an app icon, so the icon is a lettermark cut from the same face: **GC** for the
app, a lone **G** for the favicon, because at 16px GC merges into one dark smudge as its counters
close.

## The palette, and the rule inside it

Dark first, and taken from the place rather than from a colour wheel.

| Role | Token | Value |
|---|---|---|
| Ink | alkali | `#EFE9DB` |
| Darkest ground | abyss | `#080911` |
| Surfaces | night, surface | `#12131F`, `#191B2E` |
| Action, and a live relay | sodium | `#F2A93B` |
| Confirmed delivery | sage | `#9DB380` |
| Failure | ember | `#E2603C` |

**The rule that matters: sage means confirmed delivery and nothing else.** Not "good", not
"positive", not a section accent, not a hover state. Everywhere, including marketing. The moment
sage appears next to something that is not a confirmed delivery, the one signal in this product that
carries real information stops carrying it.

**Sodium is the one loud colour**, reserved for a primary action and a live relay, which is to say a
human burning their own battery to carry someone else's message. Spending it anywhere else is
spending the product's only emphasis.

**Ember is failure**, and failure only.

There is no pure white and no neutral black in the system. The lightest ink is alkali `#EFE9DB` and
the darkest ground is abyss `#080911`. Alkali on white is not a legible combination and is not a
supported treatment.

Status is encoded **shape first, then position, then words, then colour**, so the hop trace is
readable without colour vision: a hollow ring for accepted, a run of nodes ending in a chevron for
carried but unconfirmed, a run with a terminal cap and check for delivered, a run broken by a gap for
failed. Colour is the last layer, never the only one.

## The honesty constraint

This is a rule, not a caveat, and it does not get quieter in a different genre or a smaller
typeface.

**Nothing in this product or its marketing may claim or imply that mesh delivery works today.**

The facts it comes from, all recorded in `PATH.md` and PR 4: this build ships no Bluetooth bearer and
no local network bearer. Nothing is discovered automatically. Nothing reaches a nearby phone
directly. Every message leaves the device through a relay, and a relay needs internet. Device to
device is the whole point of the product and it is not built.

What that governs:

- **Copy.** The headline is a claim about what the product is FOR, never about what it currently
  does. The honest status sits high on the page, not buried at the bottom.
- **UI.** The relay is shown as what it is. A message that is accepted but uncarried says so.
- **Imagery.** A picture of two phones talking across a desert is a claim. It is not available.

What is still true and worth saying, because underselling is its own kind of dishonesty: today this
is a messenger with no phone number, no account, and no server that can read your messages. That is
worth something. It is just not mesh delivery, and we are not going to call it that.

If a future build ships a radio bearer, this rule relaxes on the evidence and not before.

## Imagery

**People, not equipment.** The photography's job is to say where this is for. A photograph of
machinery says who it is sold to instead, which is the procurement read the positioning exists to
avoid. This rule came from replacing exactly that: an industrial plate that contradicted the
consumer copy sitting beside it.

- No industrial or job site signals. No hard hats, no plant, no vehicles as subject.
- No Burning Man trademarked imagery. The playa is a place and it photographs well; the event has a
  mark and it is not ours to borrow.
- Faces and figures at human scale, in the conditions the product is actually used in: dust, dusk,
  low light, distance.
- Captions describe what is in the frame and what is true, not what we wish were true. The relay
  plate's caption names the relay still sitting between two people.

## The one thing that must never be designed away

**The per message hop trace.**

It is the only thing in this product that no other messenger can show. `docs/ux-audit.md` is blunt
about the current state and the instruction: the trace is the product's signature and it currently
reads as a debug readout, so make it legible and make it read as a feature. Make it legible, never
remove it.

The wrong correction is to hide it because it looks technical. The right correction is a plain
caption a person understands, with the raw trace one tap away. "Arrived via 2 hops" is human. "Carried
by 2 peers, not confirmed" is protocol vocabulary wearing a human's clothes.

Everything else in this product is a table stake that WhatsApp does better. This is the difference.

## Status, honestly

From `PATH.md` and PR 4, not from optimism.

**Proven.** A physical iPhone 17 Pro exchanged a real message with a second independent Hop node
through a running relay, with `delivered=true` and `forwardHops=2`, traces pulled off the device. A
channel round trip on the same handset, with the reply's writer verified under the channel keys.

**Not proven, and not implied anywhere.**

- No radio at all. Every packet in every pass went through a relay.
- Two handsets talking to each other is the next rung and needs radio work that does not exist yet.
- Android has never been built.
- Channels work but cannot ship: they need a published `hop-sdk-apple` release carrying ABI 6, and
  no such release exists.
- Nobody has read the rendered screen on the handset. No tool on that machine can capture a
  wirelessly attached iPhone.
- The production relay fleet was never dialled. Every pass used a local relay.

**One number that is deliberately not shown.** The protocol reports `forwardMs` in tens of thousands
of milliseconds while the sender's own wall clock for the same send is about a second. The two nodes
do not share a clock, so that field is not a transit time and showing it would tell a person their
message took forty seconds when it did not. The hop count is the number that is real.

**The product verdict, treated as ground truth.** Bad UX first, somewhat bad UI second. The largest
single gap is that the app cannot tell you a message arrived: no notification, no badge, no sound,
no background receive. A messenger that never announces a message is broken by definition. That work
is in flight on a separate branch and this brief does not claim it landed.

## What this brief does not decide

These are open, and they are not the designer's to close:

- **The domain.** Nothing is bought and the site names none.
- **Whether the wordmark ships as caps or as the mixed case runner up.** Caps is recommended and
  argued above. Mixed case is more legible small and more consumer neutral, which makes it a
  positioning call rather than a craft one.
- **Whether CHAT recedes** one step down the ink ramp, making Grit the brand and Chat the category.
- **Trademark.** Not cleared, and nothing here implies otherwise.
- **Whether background push is in scope** at all.
- **Whether channel access modes stay hidden** until the moderation screen that makes them real
  exists.
