// Produces every shipped Grit Chat brand asset from the committed geometry and type metrics.
// Nothing here is drawn by hand, and nothing here came out of an image model. Run: npm run build.
//
// THE IDENTITY, in one paragraph. Grit Chat is wordmark-led. There is no pictorial symbol, on
// purpose: an earlier attempt built a mark from the app's hop-trace geometry and it read as a robot
// arm, which is fatal, because a symbol people misread on first sight cannot be explained away. A
// wordmark carries the identity in the letterforms instead, which means the type choice, the spacing
// and the optical corrections do all the work. The app icon, which cannot be a wordmark at 60 points,
// is a lettermark cut from the same type, so it invents no new symbol.
//
// See brand/README.md for the directions that were rejected and why.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { setLine, setJustifiedStack, metrics, round } from './typeset.mjs';
import { ANDROID, IOS, squirclePath, inscribeInCircle, clearsRoundedRect, clearsSuperellipse } from './masks.mjs';
import { table, contrast } from './contrast.mjs';

// ---- the palette, READ from the app rather than mirrored ---------------------------------------
//
// This used to be a hand-written copy of src/design/tokens.ts, and it went stale exactly the way a
// hand-written copy does. The app's second contrast pass moved alkaliFaint to #939083 and sodiumDeep
// to #5D4012 and deleted raisedHigh, and this file sat on #95917F and #5E4013 afterwards. That is
// not a cosmetic problem: brand.json and the contrast table in brand/README.md are generated from
// here, and brand/brief.html is published from that README, so the stale copy would have shipped a
// document stating ratios for values the product no longer uses.
//
// So it is read out of the source now. The app is where these values are consumed and where a test
// computes every pair from them and fails below standard, which makes it the only copy that is
// enforced. Everything else is a picture of it.
//
// Extracted with a regex rather than imported, because tokens.ts is TypeScript importing
// react-native and this is a plain .mjs script with neither in scope. The extraction is guarded: a
// missing key throws, so a refactor of tokens.ts breaks this build loudly instead of silently
// mirroring nothing.
const TOKENS = 'src/design/tokens.ts';
const EXPECTED = [
  'abyss',
  'night',
  'surface',
  'alkali',
  'dust',
  'alkaliFaint',
  'sodium',
  'sodiumBright',
  'sodiumDeep',
  'ember',
  'emberBright',
  'sage',
];

const tokensSource = readFileSync(TOKENS, 'utf8');
// The block closes with `} as const;` rather than `};`. Matching only the latter is what made this
// guard fire on its first run, which is the guard doing its job: it refused to build rather than
// quietly producing a palette with nothing in it.
const paletteBlock = /export const palette = \{([\s\S]*?)\n\}(?: as const)?;/.exec(tokensSource);
if (paletteBlock == null) {
  throw new Error(
    `could not find "export const palette = {" in ${TOKENS}. The brand assets are generated from ` +
      'that palette, so this build refuses to guess at it.',
  );
}

const C = {};
for (const m of paletteBlock[1].matchAll(/^\s*([a-zA-Z][a-zA-Z0-9]*):\s*'(#[0-9a-fA-F]{6})'/gm)) {
  C[m[1]] = m[2].toUpperCase();
}

const missing = EXPECTED.filter((k) => C[k] == null);
if (missing.length > 0) {
  throw new Error(
    `${TOKENS} no longer defines: ${missing.join(', ')}. Either the token was renamed, in which ` +
      'case update EXPECTED deliberately, or the extraction broke. Not guessing either way.',
  );
}

// ---- the committed type specification --------------------------------------------------------
//
// Barlow Condensed Bold, all caps. It is already the app's display face, chosen because Barlow is
// drawn from California public signage: tall condensed caps that stay legible on a sunlit highway,
// which is the literal reading condition for this product. A logotype that matches the interface it
// labels is one less thing to explain. Caps rather than mixed case because condensed lowercase came
// out cramped and gave up the signage authority without buying real warmth.
//
// The tracking numbers are the two knobs of the optical pass in typeset.mjs, stated so they can be
// argued with. `target` is the white every glyph side is brought to, as a fraction of cap height.
const SPEC = {
  file: 'BarlowCondensed-Bold.ttf',
  capHeight: 100,
  wordmark: { target: 0.078, wordSpace: 0.3 },
  stack: { target: 0.078 },
  lettermark: { target: 0.045 },
};

const PAD = 6; // breathing room inside the viewBox, in cap-height units of 100

function svgDoc({ w, h, body, title, desc }) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(w)} ${round(h)}" role="img" aria-label="${title}">\n` +
    `  <title>${title}</title>\n  <desc>${desc}</desc>\n  ${body}\n</svg>\n`
  );
}

/** Place lines into a tight viewBox with uniform padding. */
function frame(lines, pad = PAD) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const l of lines) {
    minX = Math.min(minX, l.dx);
    maxX = Math.max(maxX, l.dx + l.line.width);
    minY = Math.min(minY, l.baseline + l.line.top);
    maxY = Math.max(maxY, l.baseline + l.line.bottom);
  }
  return {
    w: maxX - minX + pad * 2,
    h: maxY - minY + pad * 2,
    body: (fills) =>
      lines
        .map(
          (l, i) =>
            `<g transform="translate(${round(l.dx - minX + pad)} ${round(l.baseline - minY + pad)})">` +
            l.line.body(typeof fills === 'string' ? fills : fills[i]) +
            `</g>`,
        )
        .join('\n  '),
  };
}

mkdirSync('brand/logo', { recursive: true });
mkdirSync('brand/icon', { recursive: true });

const out = [];
const write = (path, content) => {
  writeFileSync(path, content);
  out.push({ path, bytes: Buffer.byteLength(content) });
};

// ---- 1. the wordmark ---------------------------------------------------------------------------
const wordLine = setLine('GRIT CHAT', { ...SPEC.wordmark, file: SPEC.file, capHeight: SPEC.capHeight });
const word = frame([{ line: wordLine, dx: 0, baseline: 0 }]);
const WORD_DESC =
  'The words GRIT CHAT set in Barlow Condensed Bold capitals with optical letterspacing.';

for (const [name, fill] of [
  ['gritchat-wordmark.svg', 'currentColor'],
  ['gritchat-wordmark-dark.svg', C.alkali],
  ['gritchat-wordmark-light.svg', C.night],
]) {
  write(
    `brand/logo/${name}`,
    svgDoc({ ...word, body: word.body(fill), title: 'Grit Chat', desc: WORD_DESC }),
  );
}

// ---- 2. the compact stack ----------------------------------------------------------------------
// Both words are four characters and both end in T, so they can be forced to identical width with
// tracking alone, never by scaling a word. That produces a solid block for square placements.
const stack = setJustifiedStack('GRIT', 'CHAT', { ...SPEC.stack, file: SPEC.file, capHeight: SPEC.capHeight });
const STACK_LEADING = SPEC.capHeight * 1.06;
const stackFrame = frame([
  { line: stack.a, dx: 0, baseline: 0 },
  { line: stack.b, dx: 0, baseline: STACK_LEADING },
]);
const STACK_DESC =
  'The words GRIT and CHAT stacked on two lines, tracked to identical width, in Barlow Condensed Bold capitals.';
for (const [name, fill] of [
  ['gritchat-stack.svg', 'currentColor'],
  ['gritchat-stack-dark.svg', C.alkali],
  ['gritchat-stack-light.svg', C.night],
]) {
  write(
    `brand/logo/${name}`,
    svgDoc({ ...stackFrame, body: stackFrame.body(fill), title: 'Grit Chat', desc: STACK_DESC }),
  );
}

// ---- 3. the lettermark -------------------------------------------------------------------------
const letterLine = setLine('GC', { ...SPEC.lettermark, file: SPEC.file, capHeight: SPEC.capHeight });
const letter = frame([{ line: letterLine, dx: 0, baseline: 0 }], 4);
const LETTER_DESC = 'The letters GC in Barlow Condensed Bold, cut from the Grit Chat wordmark.';
for (const [name, fill] of [
  ['gritchat-lettermark.svg', 'currentColor'],
  ['gritchat-lettermark-dark.svg', C.alkali],
  ['gritchat-lettermark-light.svg', C.night],
]) {
  write(
    `brand/logo/${name}`,
    svgDoc({ ...letter, body: letter.body(fill), title: 'Grit Chat', desc: LETTER_DESC }),
  );
}

// ---- 4. app icons ------------------------------------------------------------------------------
const lw = letterLine.width;
const lh = letterLine.bottom - letterLine.top;
const lAspect = lw / lh;

/** Centre the lettermark in a square canvas at a given scale. */
function letterInSquare(S, scale, ink) {
  const dx = S / 2 - (lw * scale) / 2;
  const dy = S / 2 - ((letterLine.top + letterLine.bottom) / 2) * scale;
  return `<g transform="translate(${round(dx)} ${round(dy)}) scale(${round(scale)})">${letterLine.body(ink)}</g>`;
}

// iOS: a square with 90 degree corners, per Apple, because the system applies its own squircle and
// pre-rounding double-masks. Content is sized to clear both the 22.37% rounded rect and the
// superellipse approximation, checked below rather than assumed.
const IOS_SIZE = 1024;
const iosBox = IOS_SIZE * 0.62;
const iosScale = Math.min(iosBox / lw, iosBox / lh);
const iosW = lw * iosScale;
const iosH = lh * iosScale;
const iosClearsRR = clearsRoundedRect(iosW, iosH, IOS_SIZE, IOS_SIZE * IOS.radiusRatio);
const iosClearsSE = clearsSuperellipse(iosW, iosH, IOS_SIZE);
write(
  'brand/icon/icon-ios.svg',
  svgDoc({
    w: IOS_SIZE,
    h: IOS_SIZE,
    body:
      `<rect width="${IOS_SIZE}" height="${IOS_SIZE}" fill="${C.sodium}"/>\n  ` +
      letterInSquare(IOS_SIZE, iosScale, C.night),
    title: 'Grit Chat app icon',
    desc: 'The letters GC in dusk indigo on a sodium amber field. Square with ninety degree corners: iOS applies its own mask.',
  }),
);

// Android adaptive: two 108dp layers. Only the centred 66dp circle is guaranteed visible, so the
// lettermark is fitted to that circle, not to the 72dp mask and not to the full layer.
//
// BREATHING is 0.95 rather than 1.0 on purpose. Fitting the glyph's bounding box exactly to the
// circle puts its corners on the boundary, and while the corners of a G and a C are empty, sitting
// precisely on a guaranteed-visible line is a bad place to be when the guarantee is somebody else's
// mask. Five percent back costs nothing at 40px, checked by rendering.
const ANDROID_BREATHING = 0.95;
const fitCircle = inscribeInCircle(lAspect, ANDROID.safeCircle);
const androidScale = Math.min(fitCircle.w / lw, fitCircle.h / lh) * ANDROID_BREATHING;
write(
  'brand/icon/icon-android-background.svg',
  svgDoc({
    w: ANDROID.canvas,
    h: ANDROID.canvas,
    body: `<rect width="${ANDROID.canvas}" height="${ANDROID.canvas}" fill="${C.sodium}"/>`,
    title: 'Grit Chat icon background',
    desc: 'Solid sodium amber. Fully opaque, as Android requires of a background layer.',
  }),
);
write(
  'brand/icon/icon-android-foreground.svg',
  svgDoc({
    w: ANDROID.canvas,
    h: ANDROID.canvas,
    body: letterInSquare(ANDROID.canvas, androidScale, C.night),
    title: 'Grit Chat icon foreground',
    desc: 'The letters GC in dusk indigo, fitted inside Android\u2019s guaranteed 66dp safe circle.',
  }),
);

// Monochrome icon, for a single ink: no field, letters only, so it survives one-colour print and
// Android 13 themed icons.
write(
  'brand/icon/icon-mono.svg',
  svgDoc({
    w: ANDROID.canvas,
    h: ANDROID.canvas,
    body: letterInSquare(ANDROID.canvas, androidScale, 'currentColor'),
    title: 'Grit Chat icon, one colour',
    desc: 'The letters GC in a single ink, no field.',
  }),
);

// Favicon: its own cut, and a single letter rather than two.
//
// This is not laziness, it is the size. Rendered at 16px and inspected at 4x, GC merges into one
// dark smudge: the counters close up and the two letters stop being two letters. A lone G stays
// unambiguous. An app icon is never shown below 29px so it can afford both letters; a favicon has to
// survive 16, so it gets the cut that works there. Same face, same colours, so it still reads as the
// same brand.
//
// 0.70 of the box rather than 0.78: at 48px the larger fill crowded the rounded corners, checked by
// rendering both.
const favLine = setLine('G', { target: 0, file: SPEC.file, capHeight: SPEC.capHeight });
const fw = favLine.width;
const fh = favLine.bottom - favLine.top;
const favScale = Math.min((32 * 0.7) / fw, (32 * 0.7) / fh);
write(
  'brand/icon/favicon.svg',
  svgDoc({
    w: 32,
    h: 32,
    body:
      `<rect width="32" height="32" rx="5" fill="${C.sodium}"/>\n  ` +
      `<g transform="translate(${round(32 / 2 - (fw * favScale) / 2)} ` +
      `${round(32 / 2 - ((favLine.top + favLine.bottom) / 2) * favScale)}) scale(${round(favScale)})">` +
      favLine.body(C.night) +
      `</g>`,
    title: 'Grit Chat',
    desc: 'The letter G in dusk indigo on sodium amber, drawn for small sizes.',
  }),
);

// ---- 4b. the site's copies ---------------------------------------------------------------------
//
// The site needs a handful of these inside its own src tree, because Astro's asset pipeline only
// reaches files under the Vite root and brand/ sits outside it. Rather than let someone copy them by
// hand and create a second source of truth, this generator writes them. They are build output:
// site/src/assets/brand/ is regenerated, never edited.
const SITE_ASSETS = 'site/src/assets/brand';
mkdirSync(SITE_ASSETS, { recursive: true });
for (const [from, to] of [
  ['brand/logo/gritchat-wordmark.svg', 'gritchat-wordmark.svg'],
  ['brand/logo/gritchat-lettermark.svg', 'gritchat-lettermark.svg'],
  ['brand/logo/gritchat-stack.svg', 'gritchat-stack.svg'],
  ['brand/icon/favicon.svg', 'favicon.svg'],
  ['brand/icon/icon-ios.svg', 'icon-ios.svg'],
]) {
  const body = out.find((o) => o.path === from);
  if (!body) throw new Error(`build order: ${from} must be written before it is copied to the site`);
  write(`${SITE_ASSETS}/${to}`, readFileSync(from, 'utf8'));
}

// ---- 5. report ---------------------------------------------------------------------------------
const m = metrics(SPEC.file);
console.log(`face: ${m.name}, upm ${m.unitsPerEm}, cap ${m.capHeight}, x-height ${m.xHeight}`);
console.log(
  `\nwordmark  ${wordLine.width.toFixed(1)} x ${(wordLine.bottom - wordLine.top).toFixed(1)}  ` +
    `aspect ${(wordLine.width / (wordLine.bottom - wordLine.top)).toFixed(2)}:1`,
);
console.log(
  `stack     ${stack.width.toFixed(1)} x ${(STACK_LEADING + stack.b.bottom - stack.a.top).toFixed(1)}  ` +
    `GRIT tracked +${(stack.trackA * SPEC.capHeight).toFixed(2)}/gap, CHAT +${(stack.trackB * SPEC.capHeight).toFixed(2)}/gap`,
);
console.log(`lettermark ${lw.toFixed(1)} x ${lh.toFixed(1)}  aspect ${lAspect.toFixed(2)}:1`);

console.log('\noptical letterspacing, GRIT CHAT (gap before each glyph, cap height 100):');
for (const g of wordLine.glyphs) {
  console.log(
    `  ${g.ch}  ink ${g.inkWidth.toFixed(1).padStart(5)}  carries L ${g.carriedLeft.toFixed(2).padStart(5)} ` +
      `R ${g.carriedRight.toFixed(2).padStart(5)}  sidebearing L ${g.leftSB.toFixed(2).padStart(6)} ` +
      `R ${g.rightSB.toFixed(2).padStart(6)}  gap before ${g.gapBefore.toFixed(2).padStart(7)}`,
  );
}

console.log('\nicon clearance, measured:');
console.log(
  `  ios      lettermark ${iosW.toFixed(0)} x ${iosH.toFixed(0)} in ${IOS_SIZE} square  ` +
    `rounded rect ${IOS.radiusRatio * 100}%: ${iosClearsRR ? 'clears' : 'CLIPS'}  superellipse: ${iosClearsSE ? 'clears' : 'CLIPS'}`,
);
console.log(
  `  android  lettermark ${(lw * androidScale).toFixed(1)} x ${(lh * androidScale).toFixed(1)} ` +
    `inside the guaranteed ${ANDROID.safeCircle}dp circle on a ${ANDROID.canvas}dp layer`,
);
if (!iosClearsRR || !iosClearsSE) {
  console.error('\nICON CLIPS ITS MASK. Refusing to report success.');
  process.exit(1);
}

const t = table([
  { label: 'wordmark on night (default)', fg: C.alkali, bg: C.night, kind: 'large' },
  { label: 'wordmark on abyss', fg: C.alkali, bg: C.abyss, kind: 'large' },
  { label: 'wordmark on surface', fg: C.alkali, bg: C.surface, kind: 'large' },
  { label: 'wordmark light, night on alkali', fg: C.night, bg: C.alkali, kind: 'large' },
  { label: 'icon, night on sodium', fg: C.night, bg: C.sodium, kind: 'large' },
  { label: 'stack CHAT muted, dust on night', fg: C.dust, bg: C.night, kind: 'large' },
  { label: 'body text, alkali on night', fg: C.alkali, bg: C.night, kind: 'body' },
  { label: 'secondary text, dust on night', fg: C.dust, bg: C.night, kind: 'body' },
  { label: 'hint text, alkaliFaint on night', fg: C.alkaliFaint, bg: C.night, kind: 'body' },
  { label: 'accent text, sodium on night', fg: C.sodium, bg: C.night, kind: 'body' },
  { label: 'accent text, sodiumBright on night', fg: C.sodiumBright, bg: C.night, kind: 'body' },
  { label: 'on sodium fill, sodiumDeep', fg: C.sodiumDeep, bg: C.sodium, kind: 'body' },
  { label: 'delivered, sage on night', fg: C.sage, bg: C.night, kind: 'body' },
  { label: 'failure, emberBright on night', fg: C.emberBright, bg: C.night, kind: 'body' },
  { label: 'failure, ember on night', fg: C.ember, bg: C.night, kind: 'body' },
]);
console.log('\ncontrast, computed (WCAG 2.x relative luminance):');
console.log(t.text);

const failures = t.rows.filter((r) => r.verdict === 'FAIL');
console.log(`\n${t.rows.length} pairs checked, ${failures.length} below their threshold`);
for (const f of failures) console.log(`  BELOW: ${f.label} at ${f.ratio.toFixed(2)}:1`);

// Machine readable, so the site and the README quote the same numbers instead of drifting.
writeFileSync(
  'brand/brand.json',
  `${JSON.stringify(
    {
      note: 'Generated by brand/tools/build.mjs. Do not edit by hand.',
      face: { ...m, spec: SPEC },
      palette: C,
      wordmark: { width: wordLine.width, height: wordLine.bottom - wordLine.top },
      lettermark: { width: lw, height: lh, aspect: lAspect },
      icon: {
        ios: { size: IOS_SIZE, glyph: [iosW, iosH], clearsRoundedRect: iosClearsRR, clearsSuperellipse: iosClearsSE },
        android: { canvas: ANDROID.canvas, mask: ANDROID.mask, safeCircle: ANDROID.safeCircle, glyph: [lw * androidScale, lh * androidScale] },
      },
      contrast: t.rows.map((r) => ({ label: r.label, fg: r.fg, bg: r.bg, ratio: Number(r.ratio.toFixed(2)), verdict: r.verdict })),
    },
    null,
    2,
  )}\n`,
);

console.log('\nwrote:');
for (const f of out) console.log(`  ${f.path.padEnd(46)} ${String(f.bytes).padStart(6)} bytes`);
console.log(`  brand/brand.json`);
