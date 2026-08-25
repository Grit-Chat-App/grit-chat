import type { ImageMetadata } from 'astro';

/**
 * App screens, as swappable assets.
 *
 * THE POINT OF THIS FILE. The screens change: the composer, the hop trace, the home screen and the
 * first run were all rebuilt recently and will move again. So the page must never hardcode a
 * screenshot. Dropping a new PNG into `src/assets/screens/` and pointing an entry here at it is the
 * whole swap, and nothing in `index.astro` needs editing to do it.
 *
 * EVERY SHOT IS A REAL CAPTURE FROM A RUNNING BUILD. Nothing here is a mockup, an illustration, a
 * vector redraw or a marketing render. If a screen cannot be captured it is absent from this file
 * rather than faked, and the layout renders without it.
 *
 * EVERY PERSON AND EVERY MESSAGE ON THESE SCREENS IS INVENTED for the captures. Nothing came from a
 * real contact, a real address book or any message on the machine that took them. The base58
 * addresses are real but belong to throwaway relay node processes the capture rig started and then
 * stopped, so they are not anyone's account.
 *
 * PROVENANCE IS NOT OPTIONAL. `capturedOn` renders under the frame, because a simulator is not a
 * handset and a page that lets a reader assume otherwise is lying quietly. `commit` is recorded for
 * the reader of this file rather than rendered, so a stale shot is identifiable rather than guessed
 * at.
 *
 * THE RIG, identical for all three: a dedicated iPhone 17 Pro simulator, iOS 26.5, UDID
 * 2B7A4ADD-518A-4907-8E1E-185B4DBA4C9E, Release configuration with the JS bundle embedded and no
 * Metro in the loop, against a relay started on an empty store. Captured at 1206x2622 native, no
 * crop, no scaling. The deliveries shown are real: typed into the composer, sent through the app's
 * own UI, across a relay, confirmed by independent Hop nodes.
 */
export interface Screen {
  id: string;
  src: ImageMetadata;
  /** What a reader who cannot see it needs to know, describing the screen and not the feature. */
  alt: string;
  /** One short line under the frame. Sentence case, no full stop needed. */
  caption: string;
  /** Exactly what hardware or simulator this came off. Rendered, not just recorded. */
  capturedOn: string;
  /** The commit the build came from, so a stale capture is identifiable. */
  commit: string;
}

/**
 * THE NEXT CAPTURE RUN, recorded here rather than rediscovered.
 *
 * PR 10 on feat/ux-audit-2 restructures four screens: identity, new channel, scan, and add contact.
 * None of them are placed on the page, so nothing here goes stale when it merges. The two that ARE
 * placed, the conversation list and the chat, are confirmed unchanged by that branch's owner.
 *
 * Capture from a MAIN sha once it merges, never from the branch tip. Capturing a tip is what put an
 * earlier run on the interface Jason had already rejected.
 *
 * TWO SHOTS WORTH ADDING, both because they show the protocol doing the work instead of the page
 * asserting it:
 *
 *   1. The channel share panel on a hosted channel. It draws a QR and the real link,
 *      hps://<host address>/<channel name>, which is the channel's actual address on the network
 *      rather than an invite service. The page currently spends words on that claim; a screenshot of
 *      a real link is worth more than the paragraph.
 *   2. The identity screen with "Protocol detail" open. It contains, in the app's own words, the
 *      sentence this site's honesty callout paraphrases: no phone number, no account, no server that
 *      can read your messages, and relay only with no Bluetooth or local network bearer yet. The
 *      product saying it is better evidence than the marketing copy saying it.
 *
 * THREE TRAPS, all paid for already by the runs that hit them:
 *
 *   - simctl and Detox capture the VIEWPORT ONLY. That disclosure sits below the fold, so a launch
 *     argument cannot reach it. Drive it: tap the row with testID `identity-protocol`, whose body is
 *     `identity-protocol-body`. Forcing a scroll offset in a throwaway build is fine for looking at
 *     and must not produce a shipped pixel.
 *   - Do NOT assert a QR is visible in any Detox check built around these. Detox reports "View does
 *     not pass visibility percent threshold (75)" against a QR frame that is plainly drawn on
 *     screen. Nobody has worked out why, so nobody should guess. Assert it exists, and assert the
 *     link text, which is the string the code encodes anyway.
 *   - The IDENTITY SCREEN LEAKS THE CAPTURE RIG'S RELAY. Its ENDPOINT field renders whatever relay
 *     the build was pointed at, so a shot taken on a rig with a local relay puts something like
 *     ws://127.0.0.1:18766/ on a marketing page. That is a property of the screen rather than a
 *     mistake in any one run, and it is why the existing identity capture was declined rather than
 *     cropped. Point the rig at a presentable endpoint before shooting it, or do not ship it.
 *
 * The app icon is already on main: it landed in 0911a9e, inside merge ddadbd6, and CI regenerates
 * and diffs the rasters so one that drifts from its source fails the build. So a springboard or app
 * tile shot is safe today and shows the real icon rather than a grey placeholder. 22 iOS PNGs and 2
 * Android adaptive layers, all generated from brand/icon/*.svg by scripts/app-icons.mjs. If the page
 * ever wants to claim the icon is derived rather than drawn, that is the claim and it is checkable.
 */

import chatDelivered from './screens/chat-delivered.png';
import conversationsEmpty from './screens/conversations-empty.png';
import conversationsPopulated from './screens/conversations-populated.png';

export const screens = {
  /**
   * The hero. Chosen over the chat shot because it is DENSE: three named people, three real
   * deliveries, and the hop trace visible three times. The reference sites are wall to wall with
   * populated screens, and an app with three conversations in it answers "what is this" faster than
   * one with a single message and a lot of canvas.
   */
  conversationsPopulated: {
    id: 'conversations-populated',
    src: conversationsPopulated,
    alt: 'The Grit Chat conversation list with three conversations. Each row leads with a person\'s name, then the last message sent, then their shortened address in a monospace face, and on the right a small route graphic reading two hops with a tick.',
    caption: 'Three conversations, three real deliveries. Names lead; the address is demoted',
    capturedOn: 'iPhone 17 Pro simulator, iOS 26.5',
    commit: 'a08faa4',
  },

  /**
   * The signature. This sits in the section about the route, where a single message with its trace
   * is the actual subject and the empty canvas above it is just the app being bottom anchored.
   *
   * The 2 is RELAY hops. This build has no radio bearer, so nothing on this screen shows two phones
   * reaching each other directly, and no caption near it may imply that.
   */
  chatDelivered: {
    id: 'chat-delivered',
    src: chatDelivered,
    alt: 'A conversation with Rosa Ibarra in the Grit Chat app. One sent message reads "At the gate now, walking north past the lantern line." Underneath it a small route graphic shows a dot, an arrow, a circle holding the numeral two, an arrow and a tick, beside the words "delivered via 2 hops".',
    caption: 'A real delivery, confirmed at two relay hops. No other messenger can show you this',
    capturedOn: 'iPhone 17 Pro simulator, iOS 26.5',
    commit: 'a08faa4',
  },

  /**
   * Available and deliberately NOT placed on the page. The designed empty state is honest and it is
   * the worst possible advertisement, and its slot went to the two shots above. Kept here because it
   * is one line from being used if a section ever wants it, and because deleting a real capture to
   * save four lines is a bad trade.
   *
   * One commit behind the other two, on a component it does not render.
   */
  conversationsEmpty: {
    id: 'conversations-empty',
    src: conversationsEmpty,
    alt: 'The Grit Chat app on first run. A heading reads "Nobody here yet", with a filled amber button labelled "Scan someone" above three quieter buttons: show my address, add someone by address, and start a channel.',
    caption: 'First run. Scanning someone leads, because it needs no second channel',
    capturedOn: 'iPhone 17 Pro simulator, iOS 26.5',
    commit: '7b23786',
  },
} satisfies Record<string, Screen>;

export type ScreenName = keyof typeof screens;

/**
 * The screen the hero leads with. One name in one place, so changing which shot leads is a one line
 * edit here rather than a change to the page.
 */
export const heroScreen: ScreenName = 'conversationsPopulated';

/** The screen shown beside the route explanation. */
export const traceScreen: ScreenName = 'chatDelivered';
