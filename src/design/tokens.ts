// The Grit Chat design system, as tokens. Every screen builds from this module and nothing else:
// no inline magic numbers, no ad-hoc hex values, no second convention beside this one.
//
// ART DIRECTION, stated so it can be argued with:
//
// The subject is a messenger for a dust-blasted desert where the network is other people's phones.
// It is used at night, outdoors, on a battery that has to last the week. So: dark first, colour
// earned from the place rather than picked from a template, and legibility over decoration because
// the screen is read in sunlight, through dust, with gloves on.
//
// - Alkali: the dust itself. Bone whites and tans, the entire text ramp. Never pure #FFFFFF, which
//   glares at night; alkali white is what the ground reflects.
// - Dusk: deep indigo night skies, the entire surface ramp. Blue-black, not neutral black, for the
//   same reason the desert at 3am is blue.
// - Sodium: streetlight amber, the one loud colour. Primary actions and the live relay state only;
//   amber means a human infrastructure burning electricity for you.
// - Ember: firelight orange, reserved for warnings and failures.
// - Sage: the only green the playa grows, reserved strictly for confirmed delivery. If sage appears,
//   a message provably arrived.
//
// TYPE PAIRING, committed:
//
// - Barlow (Regular, Medium, SemiBold, Bold) for interface text, with Barlow Condensed (SemiBold,
//   Bold) for display and headers. Barlow is drawn from California public signage: tall condensed
//   caps that stay legible on a sunlit highway, which is the exact reading condition here. The
//   condensed cuts give large type without eating width, on a phone held at arm's length.
// - IBM Plex Mono (Regular, Medium, SemiBold) for the machine layer: addresses, hop counts, relay
//   URLs, delivery traces. These are telemetry, not prose, and setting them in an instrument face
//   keeps them from being misread as human words. Both families are SIL OFL and bundled in the app.
//
// MOTION is restrained on purpose: this runs on a battery budget. Transitions are short, and nothing
// animates forever.

import { TextStyle } from 'react-native';

// ---- colour -------------------------------------------------------------------

export const palette = {
  // Surface ramp: blue-black night, never neutral black.
  abyss: '#080911', // the deepest level: keyboard backdrop, overscroll
  night: '#12131F', // app canvas
  surface: '#191B2E', // cards, list rows, bubbles from others
  raised: '#222539', // pressed states, inputs, composer
  // There was a `raisedHigh: '#2D3148'` here, documented as "focus rings, dividers that must read".
  // It could not do that job: 1.44:1 on night, 1.18:1 on raised, so a focus ring drawn in it is
  // invisible and a divider in it does not read. Nothing used it, and a token whose comment tells
  // you to use it for something it cannot do is a trap for whoever tries. Focus rings and any
  // other boundary that carries meaning use `edge` below, which is measured for the job.

  // Text ramp: alkali dust, never pure white.
  alkali: '#EFE9DB', // primary text
  dust: '#B7B1A1', // secondary text
  // Hints, timestamps and placeholders. Measured against the surfaces it actually sits on rather
  // than a nominal background: 4.71:1 on raised (outbound bubbles, inputs), 5.05:1 on surface,
  // 5.76:1 on night, 6.20:1 on abyss. It was #7E7A6D, which was 3.51:1 on raised and 4.30:1 on
  // night, so every timestamp in the app was below AA.
  alkaliFaint: '#939083',

  // Earned accents. One job each, no borrowing.
  sodium: '#F2A93B', // primary action, live relay
  sodiumBright: '#FFC96B', // action text on dark, active indicator
  // The one inversion in the system: dark text on a sodium fill. 4.76:1 on sodium, 6.26:1 on
  // sodiumBright. It was #6B4A16, which was 4.02:1 on sodium, so every primary button label was
  // below AA.
  sodiumDeep: '#5D4012',
  ember: '#E2603C', // warnings, failures
  emberBright: '#F07B57', // warning text on dark
  sage: '#9DB380', // confirmed delivery, nothing else

  // Hairlines and edges over the night ramp.
  //
  // Two different jobs, deliberately two tokens, because one token doing both is how a 1.43:1
  // border ends up being the only thing identifying a text input.
  //
  // `line` is DECORATION: row dividers, section rules, bubble hairlines. It is 1.35:1 to 1.48:1
  // over the dusk ramp and that is fine, because WCAG 1.4.11 exempts purely decorative edges: no
  // information is lost if you cannot see it. It must never be a control's only boundary.
  line: 'rgba(239, 233, 219, 0.14)',
  lineStrong: 'rgba(239, 233, 219, 0.26)', // heavier decoration: card and frame edges
  // `edge` is the BOUNDARY OF AN INTERACTIVE THING: inputs, buttons, pills. 1.4.11 wants 3:1 for
  // the visual information that identifies a component, so this is solid rather than alpha, since
  // an alpha edge's real contrast depends on whatever happens to be behind it. 3.13:1 on raised,
  // 3.52:1 on surface, 3.83:1 on night, 4.12:1 on abyss.
  edge: '#666FA2',
} as const;

export type Palette = typeof palette;

// ---- type scale ---------------------------------------------------------------

// Font families map 1:1 to the bundled TTFs (src/design/fonts, wired into iOS resources and the
// Android res/font directory). A missing file here fails loudly at render, which is what we want.
export const font = {
  barlow: {
    regular: 'Barlow-Regular',
    medium: 'Barlow-Medium',
    semiBold: 'Barlow-SemiBold',
    bold: 'Barlow-Bold',
  },
  barlowCondensed: {
    semiBold: 'BarlowCondensed-SemiBold',
    bold: 'BarlowCondensed-Bold',
  },
  plexMono: {
    regular: 'IBMPlexMono-Regular',
    medium: 'IBMPlexMono-Medium',
    semiBold: 'IBMPlexMono-SemiBold',
  },
} as const;

export const type = {
  // Display: screen titles, in Barlow Condensed. Big on purpose: sunlight and gloves.
  display: {
    fontFamily: font.barlowCondensed.bold,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: 0.4,
  } satisfies TextStyle,
  title: {
    fontFamily: font.barlow.semiBold,
    fontSize: 22,
    lineHeight: 28,
  } satisfies TextStyle,
  // Body: the message reading size, generous.
  body: {fontFamily: font.barlow.regular, fontSize: 17, lineHeight: 24} satisfies TextStyle,
  bodyStrong: {fontFamily: font.barlow.semiBold, fontSize: 17, lineHeight: 24} satisfies TextStyle,
  secondary: {fontFamily: font.barlow.regular, fontSize: 14, lineHeight: 20} satisfies TextStyle,
  action: {fontFamily: font.barlow.semiBold, fontSize: 16, lineHeight: 20} satisfies TextStyle,
  // The machine layer.
  mono: {fontFamily: font.plexMono.regular, fontSize: 13, lineHeight: 18} satisfies TextStyle,
  monoMedium: {fontFamily: font.plexMono.medium, fontSize: 13, lineHeight: 18} satisfies TextStyle,
  monoSmall: {fontFamily: font.plexMono.regular, fontSize: 11, lineHeight: 15} satisfies TextStyle,
} as const;

// ---- spacing, size, radii -----------------------------------------------------

export const space = {
  xxs: 2,
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
  huge: 48,
} as const;

export const size = {
  // Touch targets: a gloved thumb is the unit of measure. Interactive elements are at least this.
  touchMin: 48,
  icon: 22,
  iconSmall: 16,
  // The signature hop trace occupies this band under a bubble.
  traceDot: 7,
  traceGap: 7,
  avatar: 44,
  composerHeight: 52,
  headerHeight: 96,
} as const;

export const radius = {
  chip: 4, // tags, trace chips: squared, instrument-like
  bubble: 10, // message bubbles, kept shallow: no rounded card soup
  panel: 16, // sheets, QR frame
  pill: 999,
} as const;

export const motion = {
  fast: 120,
  base: 220,
  slow: 360,
} as const;

export const layout = {
  screenGutter: space.xl,
  listRowHeight: 76,
  maxContentWidth: 640,
} as const;
