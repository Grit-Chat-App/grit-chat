// Subsets the four brand faces from the React Native app's font directory into web woff2, and
// generates the matching @font-face CSS.
//
// Why this exists at all: the app already committed its type pairing (Barlow, Barlow Condensed,
// IBM Plex Mono, all SIL OFL) and ships the TTFs at src/design/fonts. The site inherits that
// pairing, so the site must serve the same outlines, not a lookalike from a CDN. Serving the raw
// TTFs would cost roughly half a megabyte on a connection that, for this audience, is a phone with
// one bar at the edge of a festival. Subsetting to the characters a Latin marketing site can
// actually set, then compressing to woff2, is most of that weight gone.
//
// Why subset-font: it is harfbuzz and the woff2 encoder compiled to WebAssembly. No woff2_compress,
// no fonttools, no brotli python module, nothing to install outside npm.
//
// This script is the single source of truth for BOTH the subset and the @font-face declarations,
// including unicode-range. Generating the CSS here is the only way the declared coverage and the
// real coverage cannot drift.
//
// Usage:
//   node scripts/fonts.mjs            regenerate (idempotent, writes only on change)
//   node scripts/fonts.mjs --force    rewrite outputs even when byte-identical
//   node scripts/fonts.mjs --verify   check the committed outputs exist, build gate, no work done

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const here = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(here, '..');
const sourceDir = resolve(siteRoot, '../src/design/fonts');
const outDir = resolve(siteRoot, 'public/fonts');
const cssPath = resolve(siteRoot, 'src/styles/fonts.css');

// ---- coverage -------------------------------------------------------------------------------
//
// Inclusive codepoint ranges kept in every face. Latin, the punctuation real copy uses, the arrows
// a hop trace draws, and the geometric marks a delivery state uses. Everything else in these fonts
// (Cyrillic, Greek, Vietnamese, Latin Extended beyond the few below) is dropped: this site is
// English.
const KEEP = [
  [0x0020, 0x007e], // basic latin, printable
  [0x00a0, 0x00ff], // latin-1 supplement: accented latin, degree, section, guillemets, times
  [0x0131, 0x0131], // dotless i
  [0x0152, 0x0153], // OE, oe
  [0x0160, 0x0161], // S, s with caron
  [0x0178, 0x0178], // Y with diaeresis
  [0x017d, 0x017e], // Z, z with caron
  [0x02bb, 0x02bc], // turned comma, modifier apostrophe
  [0x2009, 0x2009], // thin space
  [0x200b, 0x200b], // zero width space
  [0x2010, 0x2011], // hyphen, non-breaking hyphen
  [0x2018, 0x201a], // single quotes
  [0x201c, 0x201e], // double quotes
  [0x2020, 0x2022], // dagger, double dagger, bullet
  [0x2026, 0x2026], // ellipsis
  [0x2030, 0x2030], // per mille
  [0x2032, 0x2033], // prime, double prime
  [0x2039, 0x203a], // single guillemets
  [0x2044, 0x2044], // fraction slash
  [0x2060, 0x2060], // word joiner
  [0x20ac, 0x20ac], // euro
  [0x2190, 0x2194], // arrows: a hop trace is drawn with these
  [0x2212, 0x2212], // true minus
  [0x25aa, 0x25aa], // black small square
  [0x25cb, 0x25cb], // white circle: unconfirmed
  [0x25cf, 0x25cf], // black circle: the trace dot
  [0x25e6, 0x25e6], // white bullet
  [0xfeff, 0xfeff], // byte order mark
  [0xfffd, 0xfffd], // replacement character
];

// Deliberately absent, with reasons. Removing a codepoint from the subset is not a style guide, it
// is a fact about the shipped binary: these characters cannot be set in the brand faces at all.
const DROP = new Map([
  [0x2013, 'en dash: house rule, use a comma or a colon'],
  [0x2014, 'em dash: house rule, use a comma or a colon'],
  [0x2015, 'horizontal bar: same rule'],
  [0x00ae, 'registered sign: the Grit mark is not cleared, never imply registration'],
  [0x2120, 'service mark: same reason'],
  [0x2122, 'trade mark sign: same reason'],
]);

// ---- faces ----------------------------------------------------------------------------------

const FACES = [
  {
    source: 'BarlowCondensed-Bold.ttf',
    out: 'barlow-condensed-bold.woff2',
    family: 'Barlow Condensed',
    weight: 700,
    style: 'normal',
    role: 'display and headings, the sunlit-highway face',
    preload: true,
  },
  {
    source: 'Barlow-Regular.ttf',
    out: 'barlow-regular.woff2',
    family: 'Barlow',
    weight: 400,
    style: 'normal',
    role: 'body copy',
    preload: true,
  },
  {
    source: 'Barlow-SemiBold.ttf',
    out: 'barlow-semibold.woff2',
    family: 'Barlow',
    weight: 600,
    style: 'normal',
    role: 'UI emphasis, buttons, labels',
    preload: false,
  },
  {
    source: 'IBMPlexMono-Regular.ttf',
    out: 'ibm-plex-mono-regular.woff2',
    family: 'IBM Plex Mono',
    weight: 400,
    style: 'normal',
    role: 'the machine layer: addresses, hop counts, relay URLs, delivery traces',
    preload: false,
  },
];

// ---- helpers --------------------------------------------------------------------------------

function codepoints() {
  const points = [];
  for (const [from, to] of KEEP) {
    for (let cp = from; cp <= to; cp += 1) {
      if (!DROP.has(cp)) points.push(cp);
    }
  }
  return points;
}

/**
 * Every codepoint an sfnt actually maps, read from its cmap. This is what makes the generated
 * unicode-range honest: the request list is what we ASKED for, this is what the binary DELIVERS,
 * and the two differ whenever a source face simply has no such glyph. Declaring coverage a file
 * does not have is worse than declaring none, because the browser then picks that face for the
 * character and renders a missing glyph instead of falling through the font stack.
 */
function coveredCodepoints(sfnt) {
  const tableCount = sfnt.readUInt16BE(4);
  let cmap = -1;
  for (let i = 0; i < tableCount; i += 1) {
    const record = 12 + i * 16;
    if (sfnt.toString('ascii', record, record + 4) === 'cmap') cmap = sfnt.readUInt32BE(record + 8);
  }
  if (cmap < 0) throw new Error('subset font has no cmap table');

  // Prefer the highest format among the Unicode subtables: format 12 covers beyond the BMP,
  // format 4 does not.
  let subtable = -1;
  let format = -1;
  const subtableCount = sfnt.readUInt16BE(cmap + 2);
  for (let i = 0; i < subtableCount; i += 1) {
    const record = cmap + 4 + i * 8;
    const platform = sfnt.readUInt16BE(record);
    const encoding = sfnt.readUInt16BE(record + 2);
    const offset = cmap + sfnt.readUInt32BE(record + 4);
    const isUnicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    const thisFormat = sfnt.readUInt16BE(offset);
    if (isUnicode && thisFormat > format) {
      subtable = offset;
      format = thisFormat;
    }
  }
  if (subtable < 0) throw new Error('subset font has no Unicode cmap subtable');

  const covered = new Set();
  if (format === 4) {
    const segments = sfnt.readUInt16BE(subtable + 6) / 2;
    const endBase = subtable + 14;
    const startBase = endBase + segments * 2 + 2;
    for (let s = 0; s < segments; s += 1) {
      const end = sfnt.readUInt16BE(endBase + s * 2);
      const start = sfnt.readUInt16BE(startBase + s * 2);
      // The final segment is the required 0xFFFF terminator, not real coverage.
      for (let cp = start; cp <= end && cp !== 0xffff; cp += 1) covered.add(cp);
    }
  } else if (format === 12) {
    const groups = sfnt.readUInt32BE(subtable + 12);
    for (let g = 0; g < groups; g += 1) {
      const record = subtable + 16 + g * 12;
      const end = sfnt.readUInt32BE(record + 4);
      for (let cp = sfnt.readUInt32BE(record); cp <= end; cp += 1) covered.add(cp);
    }
  } else {
    throw new Error(`unhandled cmap format ${format}`);
  }
  return covered;
}

/** The CSS unicode-range for a sorted codepoint list, collapsed into spans. */
function unicodeRange(points) {
  const spans = [];
  let start = points[0];
  let previous = points[0];
  for (const cp of points.slice(1)) {
    if (cp === previous + 1) {
      previous = cp;
      continue;
    }
    spans.push([start, previous]);
    start = cp;
    previous = cp;
  }
  spans.push([start, previous]);
  const hex = (cp) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;
  return spans.map(([a, b]) => (a === b ? hex(a) : `${hex(a)}-${hex(b).slice(2)}`)).join(', ');
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
const pad = (text, width) => text.padEnd(width, ' ');

async function sizeOf(path) {
  const info = await stat(path);
  return info.size;
}

async function readIfPresent(path) {
  try {
    return await readFile(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

// ---- verify ---------------------------------------------------------------------------------

async function verify() {
  const missing = [];
  for (const face of FACES) {
    const path = resolve(outDir, face.out);
    const size = await sizeOf(path).catch(() => 0);
    if (size === 0) missing.push(relative(siteRoot, path));
  }
  if ((await readIfPresent(cssPath)) === null) missing.push(relative(siteRoot, cssPath));

  if (missing.length > 0) {
    console.error('');
    console.error('  Cannot build: generated web fonts are missing.');
    console.error('');
    for (const path of missing) console.error(`    missing  site/${path}`);
    console.error('');
    console.error('  These files are committed. Regenerate them with:');
    console.error('');
    console.error('      npm run fonts');
    console.error('');
    console.error(`  That reads the source TTFs from ${relative(siteRoot, sourceDir)} .`);
    console.error('');
    process.exit(1);
  }
  console.log(`fonts: ${FACES.length} woff2 faces present, fonts.css present.`);
}

// ---- generate -------------------------------------------------------------------------------

async function generate({ force }) {
  const requested = codepoints();
  const text = String.fromCodePoint(...requested);

  await mkdir(outDir, { recursive: true });
  await mkdir(dirname(cssPath), { recursive: true });

  console.log(`fonts: requesting ${requested.length} codepoints (${DROP.size} deliberately dropped)`);
  console.log('');
  console.log(`  ${pad('face', 30)}${pad('ttf', 11)}${pad('woff2', 11)}${pad('saving', 9)}glyphs`);

  let sourceTotal = 0;
  let outTotal = 0;
  const declarations = [];
  const gaps = [];

  for (const face of FACES) {
    const sourcePath = resolve(sourceDir, face.source);
    const original = await readIfPresent(sourcePath);
    if (original === null) {
      console.error('');
      console.error(`  Cannot subset: source font not found at ${sourcePath}`);
      console.error("  The site inherits the app's committed type pairing from src/design/fonts.");
      process.exit(1);
    }

    // Two passes over the same subset operation. The sfnt is what harfbuzz produced and what gets
    // compressed into the woff2, so reading its cmap tells us the shipped coverage exactly.
    const sfnt = await subsetFont(original, text, { targetFormat: 'truetype' });
    const subset = await subsetFont(original, text, { targetFormat: 'woff2' });
    const covered = coveredCodepoints(sfnt);

    // A gate, not a comment: prove the drop list reached the binary.
    const leaked = [...DROP.keys()].filter((cp) => covered.has(cp));
    if (leaked.length > 0) {
      const names = leaked.map((cp) => `U+${cp.toString(16).toUpperCase()}`).join(', ');
      throw new Error(`${face.out} still maps deliberately dropped codepoints: ${names}`);
    }

    // Not a failure, but worth saying out loud: the source face simply has no such glyph, so the
    // site cannot set that character in this family whatever the copy says.
    const absent = requested.filter((cp) => !covered.has(cp));
    if (absent.length > 0) gaps.push([face, absent]);

    const outPath = resolve(outDir, face.out);
    const existing = await readIfPresent(outPath);
    const changed = force || existing === null || !existing.equals(subset);
    if (changed) await writeFile(outPath, subset);

    sourceTotal += original.length;
    outTotal += subset.length;

    const saving = `${(100 - (subset.length / original.length) * 100).toFixed(1)}%`;
    const note = changed ? '' : '  (unchanged)';
    console.log(
      `  ${pad(face.out, 30)}${pad(kb(original.length), 11)}${pad(kb(subset.length), 11)}` +
        `${pad(saving, 9)}${covered.size}${note}`,
    );

    declarations.push(
      [
        `/* ${face.role} */`,
        '@font-face {',
        `  font-family: '${face.family}';`,
        `  font-style: ${face.style};`,
        `  font-weight: ${face.weight};`,
        '  font-display: swap;',
        `  src: url('/fonts/${face.out}') format('woff2');`,
        `  unicode-range: ${unicodeRange([...covered].sort((a, b) => a - b))};`,
        '}',
      ].join('\n'),
    );
  }

  console.log('');
  console.log(
    `  total ${kb(sourceTotal)} of TTF becomes ${kb(outTotal)} of woff2, ` +
      `${(100 - (outTotal / sourceTotal) * 100).toFixed(1)}% smaller.`,
  );

  if (gaps.length > 0) {
    console.log('');
    console.log('  Requested but not present in the source face, so unavailable to the site:');
    for (const [face, absent] of gaps) {
      const names = absent.map((cp) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`);
      console.log(`    ${pad(face.out, 30)} ${names.join(' ')}`);
    }
  }

  const header = [
    '/* GENERATED by scripts/fonts.mjs. Do not edit: run `npm run fonts`.',
    ' *',
    ' * Each unicode-range below is read back out of the cmap of the font it declares, not from the',
    ' * list of characters the subsetter was asked for. Those two differ: a source face does not',
    ' * necessarily contain every character requested, and claiming coverage a file does not have is',
    ' * worse than claiming none, because the browser would then pick that face and render a missing',
    ' * glyph instead of falling through the stack. Stated honestly, the ranges also let a browser',
    ' * skip the download entirely for text these files cannot set.',
    ' *',
    ' * Deliberately not in the subset, so they cannot be set in the brand faces at all:',
    ...[...DROP.entries()].map(
      ([cp, why]) => ` *   U+${cp.toString(16).toUpperCase().padStart(4, '0')}  ${why}`,
    ),
    ' */',
    '',
    '',
  ].join('\n');

  const css = `${header}${declarations.join('\n\n')}\n`;
  const existingCss = await readIfPresent(cssPath);
  const cssChanged = force || existingCss === null || existingCss.toString() !== css;
  if (cssChanged) await writeFile(cssPath, css);
  console.log('');
  console.log(`  ${relative(siteRoot, cssPath)}${cssChanged ? '' : ' (unchanged)'}`);
}

// ---- entry ----------------------------------------------------------------------------------

const args = new Set(process.argv.slice(2));
if (args.has('--verify')) {
  await verify();
} else {
  await generate({ force: args.has('--force') });
}
