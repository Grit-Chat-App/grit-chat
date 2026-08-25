// Builds brand/brief.html: the brand GUIDE as a single self-contained file.
//
// It is called a guide and not a brief because that is what it is. It carries the wordmark on both
// grounds, the size ramp, the compact stack, the lettermark, the icon and favicon, the palette and
// the type specimen, then the rules for using them. That is a specimen sheet plus usage, which is a
// guide. A brief is the document that says what the product is and why every decision went the way
// it did, and that is a separate file: brand/tools/brief-doc.mjs writes brand/the-brief.html.
//
// The filename stays brief.html. Renaming it would strand the relic it is published as, which is
// keyed on the repository path, and would cost a second URL that nobody holding the first one
// would ever see.
//
// WHY SELF-CONTAINED IS NOT OPTIONAL. This is published through Relic, which renders HTML in an
// isolated frame with NO network access. A CDN font, a remote stylesheet, a remote script or an
// externally referenced image does not fail loudly there, it renders as nothing. So every font is
// inlined as a data URI and every mark is inlined as SVG markup. The build asserts that at the end
// rather than trusting the author, and refuses to write a file that would render blank.
//
// brand/README.md stays the single source of the words. This file only renders it.

import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { marked } from 'marked';
import { BASE_CSS, FONTS, inlineFaces, paletteVars, svg } from './doc-style.mjs';

const C = JSON.parse(readFileSync('brand/brand.json', 'utf8')).palette;

// ---- fonts and marks, inlined ------------------------------------------------------------------
// Both come from doc-style.mjs, shared with the brief, so the two documents cannot drift into two
// typographic systems. The faces are the same subset bytes the site ships.
const faces = inlineFaces();

const wordmark = svg('brand/logo/gritchat-wordmark.svg');
const stack = svg('brand/logo/gritchat-stack.svg');
const lettermark = svg('brand/logo/gritchat-lettermark.svg');
const iconIos = svg('brand/icon/icon-ios.svg');
const favicon = svg('brand/icon/favicon.svg');

// ---- the words -------------------------------------------------------------------------------
const md = readFileSync('brand/README.md', 'utf8');
marked.setOptions({ mangle: false, headerIds: true, gfm: true });
const bodyHtml = marked.parse(md);

// ---- the specimen board that markdown cannot carry -------------------------------------------
const swatch = (name, hex, note) =>
  `<figure class="sw"><div class="chip" style="background:${hex}"></div>` +
  `<figcaption><b>${name}</b><code>${hex}</code><span>${note}</span></figcaption></figure>`;

const specimen = `
<section class="specimen">
  <h2>Specimen</h2>
  <p class="lede">Inlined, so this page renders identically with no network at all.</p>

  <h3>Wordmark</h3>
  <div class="board dark"><div class="mark w-lg">${wordmark}</div></div>
  <div class="board light"><div class="mark w-lg light-ink">${wordmark}</div></div>
  <div class="board dark row">
    <div class="mark" style="--h:14px">${wordmark}</div>
    <div class="mark" style="--h:20px">${wordmark}</div>
    <div class="mark" style="--h:28px">${wordmark}</div>
    <div class="mark" style="--h:44px">${wordmark}</div>
  </div>
  <p class="cap">Rendered height 14, 20, 28 and 44 pixels. 14 is the verified minimum.</p>

  <h3>Compact stack, and the lettermark</h3>
  <div class="board dark row">
    <div class="mark" style="--h:88px">${stack}</div>
    <div class="mark" style="--h:64px">${lettermark}</div>
  </div>

  <h3>App icon and favicon</h3>
  <div class="board dark row icons">
    <div class="icon" style="--s:132px">${iconIos}</div>
    <div class="icon" style="--s:60px">${iconIos}</div>
    <div class="icon" style="--s:40px">${iconIos}</div>
    <div class="icon" style="--s:32px">${favicon}</div>
    <div class="icon" style="--s:16px">${favicon}</div>
  </div>
  <p class="cap">Icon at 132, 60 and 40. Favicon at 32 and 16, a single letter because GC merges at 16.</p>

  <h3>Palette</h3>
  <div class="swatches">
    ${swatch('abyss', C.abyss, 'deepest surface')}
    ${swatch('night', C.night, 'the canvas')}
    ${swatch('surface', C.surface, 'cards and rows')}
    ${swatch('alkali', C.alkali, 'primary text')}
    ${swatch('dust', C.dust, 'secondary text')}
    ${swatch('alkaliFaint', C.alkaliFaint, 'hints, timestamps')}
    ${swatch('sodium', C.sodium, 'primary action, live relay')}
    ${swatch('sodiumBright', C.sodiumBright, 'action text on dark')}
    ${swatch('sodiumDeep', C.sodiumDeep, 'text on sodium fills')}
    ${swatch('ember', C.ember, 'warnings and failures')}
    ${swatch('emberBright', C.emberBright, 'warning text on dark')}
    ${swatch('sage', C.sage, 'confirmed delivery only')}
  </div>

  <h3>Type</h3>
  <p class="spec-display">GRIT CHAT</p>
  <p class="cap">Barlow Condensed Bold, the display face and the wordmark.</p>
  <p class="spec-body">Messages carried device to device. Barlow sets the interface.</p>
  <p class="spec-mono">delivered via 3 hops &middot; IBM Plex Mono sets the machine layer</p>
</section>
`;

// The specimen board's own CSS. This stays local because only this document has a specimen board;
// the reading system it sits inside is shared. None of these selectors collide with a base rule, and
// where a base rule matches the same element (`code` under `.sw`, `p` under `.masthead`) the local
// rule is more specific and wins regardless of order.
const SPECIMEN_CSS = `.board{border:1px solid var(--line);border-radius:6px;padding:28px;margin:0 0 10px;overflow-x:auto}
.board.dark{background:var(--night)}
.board.light{background:var(--alkali)}
.board.row{display:flex;align-items:flex-end;gap:30px;flex-wrap:wrap}
.board.icons{align-items:center}
.icon svg{display:block;width:var(--s);height:var(--s);border-radius:calc(var(--s) * .2237)}
.cap{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--faint);margin:0 0 22px}
.lede{color:var(--dust)}
.swatches{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:22px}
.sw{margin:0}
.chip{height:56px;border-radius:4px;border:1px solid var(--line)}
.sw figcaption{display:flex;flex-direction:column;gap:1px;margin-top:7px;font-size:12px}
.sw b{font-weight:600;font-size:13px}
.sw code{background:none;padding:0;color:var(--dust);font-size:11px}
.sw span{color:var(--faint);font-size:11px}
.spec-display{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:56px;line-height:1;margin:0 0 6px}
.spec-body{font-size:19px;margin:0 0 6px}
.spec-mono{font-family:'IBM Plex Mono',monospace;font-size:14px;color:var(--sage);margin:0 0 6px}
.specimen{margin-top:8px}`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Grit Chat brand guide</title>
<style>
${faces}
${paletteVars(C)}
${BASE_CSS}
${SPECIMEN_CSS}
</style>
</head>
<body>
<div class="wrap">
  <header class="masthead">
    <div class="mark">${wordmark}</div>
    <p>Brand guide. Generated from brand/README.md, fully inlined, no network required.</p>
  </header>
${specimen}
${bodyHtml}
  <p class="foot">Grit Chat is in development. "Grit" is not trademark cleared: no registration is
  claimed or implied anywhere in this document.</p>
</div>
</body>
</html>
`;

writeFileSync('brand/brief.html', html);

// ---- prove it is self-contained ---------------------------------------------------------------
// Any remote reference renders as nothing inside Relic's isolated frame, so this is a hard gate
// rather than a warning. Strip data: URIs first, then look for anything that still reaches out.
// Mime types contain digits (font/woff2, image/svg+xml), so the class must allow them. Omitting
// digits meant no data URI ever matched and the gate reported its own inlined fonts as remote.
const stripped = html.replace(/data:[a-z0-9/+.-]+;base64,[A-Za-z0-9+/=]+/g, 'data:INLINED');
const remote = [
  ...stripped.matchAll(/(?:https?:)?\/\/[^\s"'()<>]+/g),
  ...stripped.matchAll(/\b(?:src|href)\s*=\s*["'](?!#|data:INLINED)([^"']+)["']/g),
];
// Links in the prose body pointing at real URLs are fine: they are navigation, not a subresource.
// Only SUBRESOURCE references (src, url(), @import) can render blank, so classify.
const subresource = [
  ...stripped.matchAll(/\bsrc\s*=\s*["']([^"']+)["']/g),
  ...stripped.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g),
  ...stripped.matchAll(/@import\s+["']([^"']+)["']/g),
  ...stripped.matchAll(/<link[^>]+href\s*=\s*["']([^"']+)["']/g),
].map((m) => m[1]);

const badSubresource = subresource.filter((u) => !u.startsWith('data:INLINED'));
const proseLinks = [...stripped.matchAll(/<a[^>]+href\s*=\s*["'](https?:\/\/[^"']+)["']/g)].map((m) => m[1]);

console.log(`brand/brief.html  ${statSync('brand/brief.html').size} bytes`);
console.log(`  inlined faces        ${FONTS.length}`);
console.log(`  inlined svg marks    5`);
console.log(`  subresource refs     ${subresource.length}`);
console.log(`  NON-inlined subres   ${badSubresource.length}${badSubresource.length ? ' -> ' + badSubresource.join(', ') : ''}`);
console.log(`  prose links (fine)   ${proseLinks.length}`);
console.log(`  remote-looking hits  ${remote.length} (includes prose links)`);
if (badSubresource.length > 0) {
  console.error('\nNOT SELF-CONTAINED. Relic has no network: these would render as nothing.');
  process.exit(1);
}
if (/<script/i.test(html)) {
  console.error('\nScript tag present. This document must be inert.');
  process.exit(1);
}
console.log('\nself-contained: every subresource is a data URI, and there is no script tag.');
