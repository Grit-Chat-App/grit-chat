// The single home of every user-visible product string on the site, mirroring the React Native
// app's src/branding.ts. The old "BurnChat" codename is retired, including the repository and
// module names. User-visible strings never carried it and still do not.
//
// Nothing may hardcode the product name in a template. If the pending trademark position on
// "Grit Chat" changes, this module is the one seam a rename goes through. Note that the mark is
// NOT cleared: never render (R), (TM), or any trademark symbol next to it, and never imply
// registration.
//
// Two artifacts, and only one of them is protected. The SHIPPED WEB FACES cannot set those
// symbols: scripts/fonts.mjs drops U+00AE, U+2120 and U+2122 from the subset deliberately,
// fonts.css records the drop, and that generator carries its own gate proving the drop reached
// the binary. The SOURCE TTFs in src/design/fonts contain all three, in all nine faces, and
// brand/tools/typeset.mjs reads those rather than the subsets. So a symbol set into a generated
// wordmark renders perfectly and leaves no codepoint behind in the outlined SVG for any scanner
// to find.
//
// This comment previously claimed the brand faces do not contain those glyphs at all, which was
// true of the subset and false of the source. That is the same mistake fonts.css exists to avoid,
// where it reads unicode-range back out of the real cmap rather than trusting what was requested,
// because claiming coverage a file does not have is worse than claiming none.
//
// The source path is closed by the typesetter's own denylist in brand/tools/typeset.mjs, and the
// rendered-copy path by site/scripts/check-trademark.mjs.

export const Branding = {
  /** The product name. Every page title, meta tag and heading reads this, never a literal. */
  displayName: 'Grit Chat',

  /** What the product does, stated as a fact and nothing more. */
  tagline: 'Messages carried device to device',

  /** The approved endorsement shape. Hop is the network this app runs on, not part of its name. */
  runsOn: 'Runs on Hop',
} as const;
