// Typesetting for the wordmark, with optical letterspacing computed rather than guessed.
//
// WHY NOT METRIC SPACING. A font's built-in sidebearings are tuned for running text at reading size.
// A logotype is nine characters at display size, read once, and the eye is unforgiving there: metric
// spacing leaves a hole after a diagonal like A and jams a pair of flat stems like I and T. So this
// module measures each glyph's own white space and gives every glyph the sidebearings that make its
// margins equal. That is what "optical" means, done as arithmetic instead of by nudging.
//
// THE METHOD, which is the classic one:
//   1. Look only inside a vertical zone that matters for the case being set: baseline to cap height
//      for caps, baseline to x-height for lowercase. White above and below that band is not what the
//      eye is judging.
//   2. Walk scanlines across that zone and record where each glyph's ink actually starts and ends.
//      This is the glyph's silhouette, not its bounding box, which is the whole point: a bounding box
//      cannot tell A from H.
//   3. For each side, measure how far the ink recedes from its own extreme, scanline by scanline, and
//      average it. That average is the white the glyph already carries on that side. Recession is
//      clamped at maxDepth, because the deep inside of a C is not white that touches its neighbour,
//      and letting it count would blow the C wide open.
//   4. Give each side the sidebearing that brings its total white to one target. Flat-sided glyphs
//      like I and H carry no white of their own and get the full target. Open glyphs like A, T and C
//      already carry white and get less, so they tuck in. Pairs where both sides are open, the classic
//      A then T, tuck twice and close up on their own, with no hand kerning.
//
// The two knobs are stated, not hidden: `target` is the overall tightness of the logotype, and
// `maxDepth` is how deep a counter is allowed to count as neighbouring white. Both are in the same
// units as capHeight, so they read as fractions of the letter size.

import { readFileSync } from 'node:fs';
import openType from 'opentype.js';

const FONT_DIR = '../../src/design/fonts';
const fonts = new Map();

export function loadFont(file) {
  if (!fonts.has(file)) {
    const buf = readFileSync(new URL(`${FONT_DIR}/${file}`, import.meta.url).pathname);
    fonts.set(
      file,
      openType.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)),
    );
  }
  return fonts.get(file);
}

/**
 * Characters that must never be typeset into a brand asset even though every face can render them.
 *
 * MEASURED, NOT ASSUMED. An earlier version of this file claimed the brand faces do not contain
 * these glyphs, so a `.notdef` check would catch them. That was wrong in every face: registered and
 * trade mark sit at glyph index 632 and 633 in all six Barlow faces and 113 and 114 in all three
 * IBM Plex Mono faces. They render perfectly, which is precisely why they need naming here.
 */
const FORBIDDEN_CHARS = new Map([
  ['\u00ae', 'U+00AE REGISTERED SIGN'],
  ['\u2122', 'U+2122 TRADE MARK SIGN'],
]);

/**
 * Look up one glyph, or fail loudly. EVERY charToGlyph in this file goes through here.
 *
 * TWO CHECKS THAT CATCH DIFFERENT THINGS, and neither substitutes for the other:
 *
 *   1. A DENYLIST, for symbols the face HAS. A registration symbol renders perfectly and then
 *      becomes outline geometry, so no code point survives in the emitted SVG for any scanner to
 *      find. site/scripts/check-trademark.mjs is structurally blind to it for that reason. This is
 *      the only place it can be stopped, which makes the typesetter's input the real boundary.
 *   2. THE .notdef CHECK, for characters the face LACKS. opentype.js returns the `.notdef` glyph
 *      rather than throwing, so a character the face does not map typesets a tofu box or an empty
 *      advance and EXITS ZERO. U+2011 NON-BREAKING HYPHEN is unmapped in all nine faces here and is
 *      what proves this half is not dead code.
 *
 * Sibling build.mjs already refuses to guess at a renamed palette token rather than emitting an
 * empty palette. This is the same rule applied to glyphs.
 */
function glyphFor(font, char, where) {
  const face = font.names.fullName ? Object.values(font.names.fullName)[0] : 'the loaded font';
  const hex = char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');

  const forbidden = FORBIDDEN_CHARS.get(char);
  if (forbidden != null) {
    throw new Error(
      `refusing to typeset ${forbidden}, asked for by ${where}. "Grit" is NOT a federally ` +
        `registered mark, and using a registration symbol on an unregistered mark is a FALSE CLAIM ` +
        `OF REGISTRATION, a legal exposure separate from infringement. Note ${face} HAS this glyph, ` +
        `so it would render perfectly and then be flattened to outlines, leaving no code point in ` +
        `the SVG for any scanner to find. This is the only place it can be caught. Remove the ` +
        `character; do not add it to an allowlist.`,
    );
  }

  const glyph = font.charToGlyph(char);
  // opentype.js gives .notdef index 0. Name is checked too because a subset can be built without
  // glyph names, in which case the index is the only signal, and vice versa.
  if (glyph == null || glyph.index === 0 || glyph.name === '.notdef') {
    throw new Error(
      `${face} has no glyph for ${JSON.stringify(char)} (U+${hex}), asked for by ${where}. ` +
        `opentype returns .notdef rather than throwing, so this would otherwise typeset a tofu ` +
        `box or an empty advance and exit zero. Either the character does not belong in this ` +
        `string, or the face is the wrong one. Not guessing either way.`,
    );
  }
  return glyph;
}

export function metrics(file) {
  const f = loadFont(file);
  const os2 = f.tables.os2 ?? {};
  return {
    name: f.names.fullName ? Object.values(f.names.fullName)[0] : file,
    unitsPerEm: f.unitsPerEm,
    capHeight: os2.sCapHeight || glyphFor(f, 'H', `capHeight fallback for ${file}`).getBoundingBox().y2,
    xHeight: os2.sxHeight || glyphFor(f, 'x', `xHeight fallback for ${file}`).getBoundingBox().y2,
    ascender: f.ascender,
    descender: f.descender,
  };
}

// ---- outlines ----------------------------------------------------------------------------------

/**
 * Flatten one glyph to polygons in SVG space (y down, baseline at y=0), scaled so that the font's
 * cap height equals `capHeight`. opentype's getPath already negates y, so nothing here flips again.
 */
function glyphPolys(font, char, scale) {
  const glyph = glyphFor(font, char, 'outline flattening');
  const path = glyph.getPath(0, 0, font.unitsPerEm);
  const polys = [];
  let cur = null;
  let px = 0;
  let py = 0;
  const STEPS = 24;
  const push = (x, y) => {
    cur.push({ x: x * scale, y: y * scale });
    px = x;
    py = y;
  };
  for (const c of path.commands) {
    if (c.type === 'M') {
      if (cur && cur.length > 2) polys.push(cur);
      cur = [];
      push(c.x, c.y);
    } else if (c.type === 'L') {
      push(c.x, c.y);
    } else if (c.type === 'C') {
      const x0 = px;
      const y0 = py;
      for (let i = 1; i <= STEPS; i += 1) {
        const t = i / STEPS;
        const u = 1 - t;
        push(
          u * u * u * x0 + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
          u * u * u * y0 + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y,
        );
      }
    } else if (c.type === 'Q') {
      const x0 = px;
      const y0 = py;
      for (let i = 1; i <= STEPS; i += 1) {
        const t = i / STEPS;
        const u = 1 - t;
        push(u * u * x0 + 2 * u * t * c.x1 + t * t * c.x, u * u * y0 + 2 * u * t * c.y1 + t * t * c.y);
      }
    } else if (c.type === 'Z') {
      if (cur && cur.length > 2) polys.push(cur);
      cur = null;
    }
  }
  if (cur && cur.length > 2) polys.push(cur);
  return { polys, advance: glyph.advanceWidth * scale, pathData: path.toPathData(4), glyph };
}

/** Ink extents per scanline across a vertical zone. Returns null where the glyph has no ink. */
function extents(polys, yTop, yBottom, samples) {
  const rows = [];
  for (let i = 0; i < samples; i += 1) {
    // Sample at row centres so a horizontal edge never lands exactly on a scanline.
    const y = yTop + ((i + 0.5) * (yBottom - yTop)) / samples;
    let lo = Infinity;
    let hi = -Infinity;
    for (const poly of polys) {
      for (let j = 0; j < poly.length; j += 1) {
        const a = poly[j];
        const b = poly[(j + 1) % poly.length];
        if (a.y === b.y) continue;
        const t = (y - a.y) / (b.y - a.y);
        if (t < 0 || t >= 1) continue;
        const x = a.x + t * (b.x - a.x);
        if (x < lo) lo = x;
        if (x > hi) hi = x;
      }
    }
    rows.push(Number.isFinite(lo) ? { lo, hi } : null);
  }
  return rows;
}

/**
 * The white a glyph already carries on one side, as a mean recession from its own extreme.
 * Scanlines with no ink count as a full maxDepth of white, which is what makes a T behave like a T.
 */
function carriedWhite(rows, side, maxDepth) {
  let ext = side === 'left' ? Infinity : -Infinity;
  for (const r of rows) {
    if (!r) continue;
    if (side === 'left') ext = Math.min(ext, r.lo);
    else ext = Math.max(ext, r.hi);
  }
  if (!Number.isFinite(ext)) return { white: maxDepth, extreme: 0 };
  let sum = 0;
  for (const r of rows) {
    const d = !r ? maxDepth : side === 'left' ? r.lo - ext : ext - r.hi;
    sum += Math.max(0, Math.min(maxDepth, d));
  }
  return { white: sum / rows.length, extreme: ext };
}

// ---- the typesetter ---------------------------------------------------------------------------

/**
 * Set a single line.
 *
 * `optical` picks the spacing model, and picking the wrong one is a real mistake:
 *
 *   optical: true  is for a LOGOTYPE. A handful of capitals at display size, where the eye is
 *                  unforgiving and the font's text-tuned sidebearings leave visible holes.
 *   optical: false is for PROSE. It uses the font's own advance widths and kern pairs, which is
 *                  exactly what a type designer tuned them for.
 *
 * Do not run the optical pass over a sentence. It measures the white a glyph carries and takes that
 * much back, which is right for G against R and wrong for a full stop: a period is mostly white
 * inside the x-height band, so it reads as carrying almost everything, goes sharply negative, and
 * swallows the word space after it. Lowercase rounds suffer the same way, more mildly. The pass is
 * scoped to the logotype on purpose and does not handle punctuation.
 *
 * `target` and `maxDepth` are fractions of capHeight, and apply only when optical. `zone` picks the
 * band the eye judges: 'cap' for all caps, 'x' for mixed case.
 * `wordSpace` is a fraction of capHeight, applied at spaces when optical; metric mode uses the
 * font's own space advance.
 * `extraTrack` is added to every gap in both modes, so a caller can loosen or tighten a whole line
 * without losing the relationships underneath. Forced justification uses it.
 */
export function setLine(
  text,
  {
    file = 'BarlowCondensed-Bold.ttf',
    capHeight = 100,
    optical = true,
    target = 0.075,
    maxDepth = 0.34,
    zone = 'cap',
    wordSpace = 0.3,
    extraTrack = 0,
    samples = 140,
  } = {},
) {
  const font = loadFont(file);
  const m = metrics(file);
  const scale = capHeight / m.capHeight;
  const zoneTop = zone === 'x' ? -(m.xHeight * scale) : -capHeight;
  const targetPx = target * capHeight;
  const maxDepthPx = maxDepth * capHeight;
  const trackPx = extraTrack * capHeight;

  const chars = [...text];
  // The scanline measurement is only meaningful in optical mode, and it is the expensive part, so a
  // sentence set metrically never pays for it.
  const glyphs = !optical ? [] : chars.map((ch) => {
    if (ch === ' ') return { ch, space: true };
    const g = glyphPolys(font, ch, scale);
    const rows = extents(g.polys, zoneTop, 0, samples);
    const L = carriedWhite(rows, 'left', maxDepthPx);
    const R = carriedWhite(rows, 'right', maxDepthPx);
    return {
      ch,
      space: false,
      pathData: g.pathData,
      scale,
      inkLeft: L.extreme,
      inkRight: R.extreme,
      inkWidth: R.extreme - L.extreme,
      leftSB: targetPx - L.white,
      rightSB: targetPx - R.white,
      carriedLeft: L.white,
      carriedRight: R.white,
    };
  });

  // Metric mode: the font's own advance widths and kern pairs. This is the correct way to set a
  // sentence, and it is what the type designer tuned.
  const placed = [];
  let pen = 0;
  if (!optical) {
    const all = chars.map((ch) => ({ ch, glyph: glyphFor(font, ch, 'metric mode advance widths') }));
    for (let i = 0; i < all.length; i += 1) {
      const { ch, glyph } = all[i];
      if (ch !== ' ') {
        const g = glyphPolys(font, ch, scale);
        placed.push({
          ch,
          pathData: g.pathData,
          scale,
          x: pen,
          inkWidth: 0,
          gapBefore: 0,
          carriedLeft: 0,
          carriedRight: 0,
          leftSB: 0,
          rightSB: 0,
        });
      }
      pen += glyph.advanceWidth * scale + trackPx;
      if (i < all.length - 1) {
        pen += font.getKerningValue(glyph, all[i + 1].glyph) * scale;
      }
    }
  } else {
    // Optical mode: ink boxes separated by the sum of the facing sidebearings, plus extra tracking.
    // A space adds its own width on top of those sidebearings rather than replacing them, so a glyph
    // whose ink overhangs the gap still tucks into it. T then space then C is exactly that case:
    // T's arm reaches into the word space, so the measured gap has to shrink accordingly.
    let prev = null;
    let pendingSpace = 0;
    for (const g of glyphs) {
      if (g.space) {
        pendingSpace += wordSpace * capHeight;
        continue;
      }
      const gap = prev ? prev.rightSB + g.leftSB + trackPx + pendingSpace : 0;
      pen += gap;
      placed.push({ ...g, x: pen - g.inkLeft, gapBefore: gap });
      pen += g.inkWidth;
      prev = g;
      pendingSpace = 0;
    }
  }

  const inkW = pen;
  // Ink top and bottom over the whole line, measured, so overshoot on round caps is respected
  // instead of assumed.
  let top = Infinity;
  let bottom = -Infinity;
  for (const p of placed) {
    const g = glyphPolys(font, p.ch, scale);
    for (const poly of g.polys) {
      for (const pt of poly) {
        if (pt.y < top) top = pt.y;
        if (pt.y > bottom) bottom = pt.y;
      }
    }
  }

  return {
    width: inkW,
    top,
    bottom,
    height: bottom - top,
    capHeight,
    glyphs: placed,
    /** One path element per glyph, translated into place. Outlines, so the file is self-contained. */
    body: (fill) =>
      placed
        .map(
          (p) =>
            `<path transform="translate(${round(p.x)} 0) scale(${round(p.scale)})" ` +
            `d="${p.pathData}" fill="${fill}"/>`,
        )
        .join(''),
  };
}

/**
 * Set two lines and force them to identical width by adjusting only tracking, never scale.
 * Distorting one word to match another is the wrong fix; opening the narrower word's gaps is how a
 * typesetter does it. Returns both lines plus the tracking each needed, so the cost is visible.
 */
export function setJustifiedStack(a, b, opts = {}) {
  const A0 = setLine(a, opts);
  const B0 = setLine(b, opts);
  const wide = Math.max(A0.width, B0.width);
  const fit = (text, base) => {
    const gaps = [...text].length - 1;
    if (gaps <= 0) return { line: base, track: 0 };
    let lo = 0;
    let hi = 0.5;
    // Monotonic in extraTrack, so bisect rather than solve.
    for (let i = 0; i < 60; i += 1) {
      const mid = (lo + hi) / 2;
      const w = setLine(text, { ...opts, extraTrack: (opts.extraTrack ?? 0) + mid }).width;
      if (w < wide) lo = mid;
      else hi = mid;
    }
    const track = (lo + hi) / 2;
    return { line: setLine(text, { ...opts, extraTrack: (opts.extraTrack ?? 0) + track }), track };
  };
  const fa = A0.width >= wide - 1e-6 ? { line: A0, track: 0 } : fit(a, A0);
  const fb = B0.width >= wide - 1e-6 ? { line: B0, track: 0 } : fit(b, B0);
  return { a: fa.line, b: fb.line, trackA: fa.track, trackB: fb.track, width: wide };
}

export const round = (v) => Number(v.toFixed(3));
