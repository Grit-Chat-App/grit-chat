// Raster deliverables: the social card and the Apple touch icon.
//
// These are the only two brand assets that cannot be SVG. Safari ignores an SVG apple-touch-icon,
// and no social platform renders SVG in a card. Everything else in brand/ stays vector.
//
// Rasterising needs librsvg (`brew install librsvg`). If it is missing this exits non-zero and says
// so, rather than quietly writing nothing and letting the site build with a broken icon link.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { setLine, round } from './typeset.mjs';

const C = { abyss: '#080911', night: '#12131F', alkali: '#EFE9DB', dust: '#B7B1A1', sodium: '#F2A93B' };

function haveRsvg() {
  try {
    execFileSync('rsvg-convert', ['--version'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

if (!haveRsvg()) {
  console.error('rsvg-convert not found. Install librsvg, then re-run: brew install librsvg');
  process.exit(1);
}

mkdirSync('brand/social', { recursive: true });

// ---- the social card ---------------------------------------------------------------------------
// 1200 by 630 is the size every platform crops from. Type is set as outlines through the same
// optical pass as the wordmark, so the card and the site are the same object.
const W = 1200;
const H = 630;
const CAP = 96;

// The name is a logotype, so it gets the optical pass.
const name = setLine('GRIT CHAT', { capHeight: CAP, target: 0.078, wordSpace: 0.3 });

// These two are prose, so they get the font's own metric spacing and kern pairs. Running the optical
// pass over a sentence collided the letters and ate the space after the full stop, because a period
// is nearly all white inside the x-height band and the pass takes carried white back. Verified by
// rendering the card and looking at it.
const tagline = setLine('Messages carried device to device', {
  capHeight: 34,
  optical: false,
  file: 'Barlow-Regular.ttf',
  zone: 'x',
});
const status = setLine('Relay only today. No radio yet.', {
  capHeight: 22,
  optical: false,
  file: 'IBMPlexMono-Regular.ttf',
  zone: 'x',
});

const left = 88;
const nameBase = 300;
const card =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
  `<rect width="${W}" height="${H}" fill="${C.night}"/>` +
  // A single sodium hairline along the bottom: the one loud colour, used once.
  `<rect x="0" y="${H - 6}" width="${W}" height="6" fill="${C.sodium}"/>` +
  `<g transform="translate(${left} ${nameBase})">${name.body(C.alkali)}</g>` +
  `<g transform="translate(${left} ${nameBase + 92})">${tagline.body(C.dust)}</g>` +
  `<g transform="translate(${left} ${nameBase + 168})">${status.body(C.sodium)}</g>` +
  `</svg>\n`;

writeFileSync('brand/social/og-image.svg', card);
execFileSync('rsvg-convert', [
  '-w', String(W), '-h', String(H),
  'brand/social/og-image.svg',
  '-o', 'brand/social/og-image.png',
]);

// ---- the Apple touch icon ----------------------------------------------------------------------
// 180 square, from the same iOS icon source. No rounded corners: iOS masks it.
execFileSync('rsvg-convert', [
  '-w', '180', '-h', '180',
  'brand/icon/icon-ios.svg',
  '-o', 'brand/social/apple-touch-icon.png',
]);

// The site needs both inside its own src tree for Astro's asset pipeline. Build output, not source.
mkdirSync('site/src/assets/brand', { recursive: true });
for (const [from, to] of [
  ['brand/social/apple-touch-icon.png', 'site/src/assets/brand/apple-touch-icon.png'],
  ['brand/social/og-image.png', 'site/src/assets/brand/og-image.png'],
]) {
  execFileSync('cp', [from, to]);
}

for (const f of [
  'brand/social/og-image.svg',
  'brand/social/og-image.png',
  'brand/social/apple-touch-icon.png',
  'site/src/assets/brand/apple-touch-icon.png',
  'site/src/assets/brand/og-image.png',
]) {
  console.log(`${f.padEnd(46)} ${String(statSync(f).size).padStart(7)} bytes`);
}
console.log(`\ncard type set at cap ${CAP}, name ${round(name.width)} wide, tagline ${round(tagline.width)} wide`);
