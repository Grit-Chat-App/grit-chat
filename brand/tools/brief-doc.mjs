// Builds brand/grit-chat-brief.html: THE BRIEF, as a single self-contained file.
//
//   node tools/brief-doc.mjs      (run from the repository root)
//
// WHAT THIS IS, AND WHY IT IS NOT brief.mjs. There are two documents and they answer different
// questions. brand/brief.html is the GUIDE: marks, sizes, palette, type specimen, clear space,
// do-nots. It answers "how do I set this correctly". This one is the BRIEF: what the product is,
// who it is for, and why every visible decision went the way it did. It answers "why is it like
// this at all", which is the question a specimen sheet cannot answer and the one that governs the
// next decision. The guide was titled "brand brief" for a while and was never one.
//
// WHY SELF-CONTAINED IS NOT OPTIONAL. This is published through Relic, which renders HTML in an
// isolated frame with NO network access. A CDN font, a remote stylesheet or an externally
// referenced image does not fail loudly there, it renders as nothing. So every face is inlined as
// a data URI and every mark as SVG markup. Verified afterwards by site/tools/inline.mjs --check,
// which decodes every payload and checks it against the format it claims to be, because a
// reference spelled data: proves nothing about whether the bytes behind it are a whole file.
//
// brand/BRIEF.md stays the single source of the words. This file only renders it.

import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { marked } from 'marked';
import { BASE_CSS, FONTS, inlineFaces, paletteVars, svg } from './doc-style.mjs';

const C = JSON.parse(readFileSync('brand/brand.json', 'utf8')).palette;

const faces = inlineFaces();
const wordmark = svg('brand/logo/gritchat-wordmark.svg');

// ---- the words ---------------------------------------------------------------------------------
const md = readFileSync('brand/BRIEF.md', 'utf8');
marked.setOptions({ gfm: true });

// The first line of the markdown is the document's own H1 and the masthead already carries the
// wordmark, so rendering both would print the name twice at two sizes. Drop the leading H1 and let
// the mark be the title.
const body = md.replace(/^#\s+.*\n+/, '');
const rendered = marked.parse(body);

// ---- a contents list, because this is a document people will be sent into ----------------------
// marked stopped emitting heading ids at version 8, so `headerIds: true` has been a no-op for a
// long time and an anchor list built from it silently came out empty. Slugs are generated here
// instead, in the SAME pass that collects them, so a heading and its entry in the list cannot
// disagree: there is one loop and one id per heading.
const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const sections = [];
const seen = new Map();
const bodyHtml = rendered.replace(/<h2>(.*?)<\/h2>/g, (_m, inner) => {
  const text = inner.replace(/<[^>]+>/g, '');
  let id = slug(text);
  // A duplicate heading would otherwise produce two anchors pointing at the first one.
  const n = (seen.get(id) ?? 0) + 1;
  seen.set(id, n);
  if (n > 1) {
    id = `${id}-${n}`;
  }
  sections.push({ id, text });
  return `<h2 id="${id}">${inner}</h2>`;
});

if (sections.length === 0) {
  throw new Error('no H2 headings found, so the contents list would be empty. Check BRIEF.md.');
}

const contents = `
  <nav class="toc" aria-label="Contents">
    <p class="toc-label">Contents</p>
    <ol>
${sections.map((s) => `      <li><a href="#${s.id}">${s.text}</a></li>`).join('\n')}
    </ol>
  </nav>`;

// ---- this document's own CSS, on top of the shared reading system ------------------------------
// A brief is read top to bottom rather than referred to, so it gets a contents list and a pull
// treatment for the rules that govern other people's work. Nothing here restyles the base.
const BRIEF_CSS = `.toc{border:1px solid var(--line);border-radius:6px;padding:22px 26px;margin:34px 0 8px;
  background:var(--night)}
.toc-label{font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.1em;
  text-transform:uppercase;color:var(--faint);margin:0 0 10px}
.toc ol{margin:0;padding-left:20px;font-size:15px}
.toc li{margin-bottom:4px}
.toc a{color:var(--alkali);text-decoration:none}
.toc a:hover,.toc a:focus{color:var(--sodium-bright);text-decoration:underline}
blockquote{background:var(--night);border-radius:0 4px 4px 0;padding:14px 18px;margin:0 0 20px}
blockquote p:last-child{margin-bottom:0}`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Grit Chat brief</title>
<style>
${faces}
${paletteVars(C)}
${BASE_CSS}
${BRIEF_CSS}
</style>
</head>
<body>
<div class="wrap">
  <header class="masthead">
    <div class="mark">${wordmark}</div>
    <p>The brief. What this is, who it is for, and why every decision went the way it did.</p>
  </header>
${contents}
${bodyHtml}
  <p class="foot">Generated from brand/BRIEF.md. Every fact is sourced from this repository; open
  decisions are named as open. Grit Chat is in development and "Grit" is not trademark cleared: no
  registration is claimed or implied anywhere in this document.</p>
</div>
</body>
</html>
`;

writeFileSync('brand/grit-chat-brief.html', html);

const size = statSync('brand/grit-chat-brief.html').size;
console.log(`brand/grit-chat-brief.html  ${size} bytes`);
console.log(`  inlined faces        ${FONTS.length}`);
console.log(`  inlined svg marks    1`);
console.log(`  sections             ${sections.length}`);
console.log(`  words                ${body.split(/\s+/).filter(Boolean).length}`);
console.log('\nNow audit it, which is the part that actually proves anything:');
console.log('  (cd site && node tools/inline.mjs --check ../brand/grit-chat-brief.html)');
