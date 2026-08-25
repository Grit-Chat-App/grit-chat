// Turns site/dist into ONE self-contained HTML file: site/dist/gritchat-site.html
//
//   node tools/inline.mjs                (run from site/, after npm run build)
//   node tools/inline.mjs --check FILE   (audit a file that already exists, build nothing)
//
// WHY. This is the REVIEW ARTIFACT. CI builds it on every pull request and uploads it, so a reviewer
// can open the exact page that was audited without cloning, installing and building, and without a
// server. The site itself lives at a domain and is deployed by .github/workflows/site.yml; this file
// is not how it ships.
//
// So the requirement is that the file renders correctly with NO NETWORK AT ALL. Every stylesheet,
// font and image has to already be in it. A CDN reference, a /_astro/ path or a /fonts/ path renders
// as nothing, and a page that looks fine opened over file:// can still render blank somewhere
// stricter, because file:// resolves relative paths and an isolated frame does not.
//
// That requirement arrived from publishing this page through Relic, which renders HTML in an
// isolated frame with no network. The page is no longer published that way, because a marketing site
// belongs at a domain rather than behind a link whose preview fetches nothing. The requirement
// outlived the medium: an artifact that needs a network is not reviewable offline, and the gate
// below is the only thing that proves this one does not.
//
// WHAT IT IS NOT. It is not a second version of the site with different content. It is the built
// output with subresources substituted for their bytes, so what a reviewer sees is what the deployed
// site renders. srcset is preserved in full, every candidate width inlined, rather than collapsing
// to one image: collapsing would change which source a browser picks and make the snapshot a
// different page from the real one. That makes the file several megabytes, which is the correct
// trade for a shareable proof of a photographic site.

import {existsSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';

const DIST = resolve('dist');
const SRC = join(DIST, 'index.html');
const OUT = join(DIST, 'gritchat-site.html');

const MIME = {
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Every format that can arrive as a base64 payload, and how to tell a whole one from a wreck.
//
// This table is the load-bearing part of the gate. A payload can be flawless base64, sit in a
// perfectly formed data URI, satisfy every reference check below, and still decode to nothing,
// which is precisely the way this page renders blank with no network. Checking that the bytes are the
// format they claim, and that all of them are present, is the only way to see that.
//
//   magic     the signature that says which format this actually is
//   size      total byte count the container declares for itself, when it declares one
//   tail      terminator that must close the file, for formats that carry no total size
const FORMAT = {
  'image/webp': {
    magic: (b) => b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP',
    size: (b) => b.readUInt32LE(4) + 8,
  },
  'font/woff2': {
    magic: (b) => b.length > 12 && b.toString('latin1', 0, 4) === 'wOF2',
    size: (b) => b.readUInt32BE(8),
  },
  'font/woff': {
    magic: (b) => b.length > 12 && b.toString('latin1', 0, 4) === 'wOFF',
    size: (b) => b.readUInt32BE(8),
  },
  'image/png': {
    magic: (b) => b.length > 8 && b[0] === 0x89 && b.toString('latin1', 1, 4) === 'PNG',
    tail: (b) => b.length > 12 && b.toString('latin1', b.length - 8, b.length - 4) === 'IEND',
  },
  'image/jpeg': {
    magic: (b) => b.length > 4 && b[0] === 0xff && b[1] === 0xd8,
    tail: (b) => b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9,
  },
  'image/x-icon': {
    magic: (b) => b.length > 6 && b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0,
  },
};

const inlined = new Map();
let bytesIn = 0;

/**
 * The base path this build was made with, if any.
 *
 * A GitHub Pages project site is served under one, so Astro emits `/burnchat/_astro/x.css` while the
 * file sits at `dist/_astro/x.css`. Stripping the leading slash and joining is then wrong by exactly
 * one segment, which surfaced as "stylesheet missing from build" on the first base-path build.
 *
 * Read from the same single setting the build read, so the two cannot disagree about it.
 */
const BASE = (() => {
  const configured = process.env.PUBLIC_SITE_ORIGIN;
  if (!configured) return '';
  try {
    return new URL(configured).pathname.replace(/\/+$/, '');
  } catch {
    return '';
  }
})();

/** Every place in dist a reference might actually live, most specific first. */
function candidatesFor(clean) {
  const bare = clean.replace(/^\//, '');
  const paths = [join(DIST, bare)];
  // With a base, the served path carries a prefix the build directory does not.
  if (BASE && clean.startsWith(`${BASE}/`)) {
    paths.push(join(DIST, clean.slice(BASE.length + 1)));
  }
  return paths;
}

/** Resolve a path to a built file, or fail loudly: a miss must never become a URL. */
function bytesFor(url) {
  const clean = url.split('?')[0].split('#')[0];
  const tried = candidatesFor(clean);
  const path = tried.find((p) => existsSync(p));
  if (path == null) {
    throw new Error(
      `referenced subresource is not in the build: ${url} (looked at ${tried.join(', ')})`,
    );
  }
  const ext = clean.slice(clean.lastIndexOf('.')).toLowerCase();
  const mime = MIME[ext];
  if (mime == null) {
    throw new Error(`no mime type known for ${url}. Add it deliberately rather than guessing.`);
  }
  const buf = readFileSync(path);
  bytesIn += buf.length;
  inlined.set(clean, buf.length);
  return `data:${mime};base64,${buf.toString('base64')}`;
}

/**
 * Is this attribute value a subresource this build can inline?
 *
 * Site absolute (/_astro/x.webp) and build relative (_astro/x.webp, ./_astro/x.webp) both count:
 * Astro emits absolute paths today, but a base path or a config change makes them relative, and a
 * rewriter that only matches a leading slash would leave those fetching nothing.
 *
 * Anything carrying a scheme is left alone, so data:, https: and mailto: survive untouched, as does
 * an in-page anchor. Anything without a known subresource extension is navigation, not a fetch.
 */
function isBuildSubresource(url) {
  if (url.length === 0 || url.startsWith('#') || url.startsWith('//')) {
    return false;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    return false;
  }
  const clean = url.split('?')[0].split('#')[0];
  const dot = clean.lastIndexOf('.');
  return dot >= 0 && MIME[clean.slice(dot).toLowerCase()] != null;
}

/** Rewrite every url() in a block of CSS to the bytes it points at. */
function inlineCssUrls(css) {
  return css.replace(/url\(\s*["']?([^"')]+)["']?\s*\)/g, (m, u) => (
    u.startsWith('data:') ? m : `url(${bytesFor(u)})`
  ));
}

function build() {
  if (!existsSync(SRC)) {
    console.error(`no build to inline: ${SRC} does not exist. Run npm run build first.`);
    process.exit(1);
  }

  let html = readFileSync(SRC, 'utf8');

  // 1. Stylesheets become inline style blocks, with their own url() references resolved first. The
  //    font URLs live inside the CSS, so this has to happen before the generic pass.
  html = html.replace(
    /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi,
    (_m, href) => {
      const clean = href.split('?')[0];
      const tried = candidatesFor(clean);
      const path = tried.find((p) => existsSync(p));
      if (path == null) {
        throw new Error(`stylesheet missing from build: ${href} (looked at ${tried.join(', ')})`);
      }
      const css = readFileSync(path, 'utf8');
      bytesIn += Buffer.byteLength(css);
      inlined.set(clean, Buffer.byteLength(css));
      return `<style>${inlineCssUrls(css)}</style>`;
    },
  );

  // 2. Style blocks that were already inline. Astro emits a <style> rather than a <link> whenever a
  //    stylesheet falls under its inline threshold, and those url() references are invisible to the
  //    pass above and to the attribute pass below. Without this, a build whose CSS shrinks past the
  //    threshold silently ships four font references that fetch nothing. Blocks produced by step 1
  //    are already data URIs and are skipped.
  html = html.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_m, open, css, close) => open + inlineCssUrls(css) + close,
  );

  // 3. srcset, every candidate. Done before src so the shared parser does not see a half-rewritten
  //    attribute. This covers <source srcset> inside a <picture> as well as <img srcset>, which is
  //    the shape Astro emits for a responsive image.
  html = html.replace(/\bsrcset=["']([^"']+)["']/gi, (_m, value) => {
    const rewritten = value
      .split(',')
      .map((candidate) => {
        const parts = candidate.trim().split(/\s+/);
        const url = parts[0];
        if (!isBuildSubresource(url)) {
          return candidate.trim();
        }
        return [bytesFor(url), ...parts.slice(1)].join(' ');
      })
      .join(', ');
    return `srcset="${rewritten}"`;
  });

  // 4. Everything else that points at a built file: img src, favicon and apple-touch-icon links,
  //    preloads, and href on an SVG <image> or <use>. Absolute http(s) links in prose are
  //    navigation, not subresources, and stay.
  html = html.replace(/\b(src|href|xlink:href)=["']([^"']+)["']/gi, (m, attr, url) => (
    isBuildSubresource(url) ? `${attr}="${bytesFor(url)}"` : m
  ));

  // A preload for a font that is now inlined in the stylesheet would make the isolated frame fetch
  // nothing and warn; the inlined data URI is harmless but pointless, so drop those links entirely.
  html = html.replace(/<link\b[^>]*\brel=["']preload["'][^>]*>/gi, '');

  writeFileSync(OUT, html);
  return html;
}

// ---- the hard gate ------------------------------------------------------------------------------
// Same discipline as brand/tools/brief.mjs: the artifact has no network, so a remaining subresource
// reference is a defect that renders as nothing, not a warning. But a gate is only useful if it
// classifies correctly, so this separates the kinds of reference and only fails on the ones that
// can render blank.
//
// Three earlier versions of this gate got something wrong, which is worth recording because the
// first two were the gate crying wolf about correct output and the third was far worse:
//  - It only stripped `;base64,` data URIs, so an inline SVG carried as a URL-encoded data URI
//    (data:image/svg+xml,%3csvg...) read as a remote reference. Astro emits exactly that.
//  - It treated every <link href> as a subresource. rel=canonical is metadata: nothing fetches it
//    while rendering, and neither are the og: and twitter: meta URLs.
//  - It checked only that each reference was spelled `data:`, never that the payload was a whole
//    file. Corrupting twelve bytes of one webp inside dist left the output the same size, every
//    reference still a data URI, the gate still printing "self-contained" and exiting 0, and the
//    relay plate rendering as nothing. A gate that cannot see that manufactures confidence, which
//    is worse than having no gate, so payloads are now decoded and checked against their format.
//
// This runs as a pure audit of a string, so it can be pointed at any file with --check and can be
// tested by deliberately breaking one. It reads and never writes.
function auditSelfContained(html) {
  // Strip BOTH data URI spellings before classifying references: base64 and URL-encoded.
  const stripped = html
    .replace(/data:[a-z0-9/+.=-]+;base64,[A-Za-z0-9+/=]+/gi, 'data:INLINED')
    .replace(/data:[a-z0-9/+.=-]+,[^"')\s]+/gi, 'data:INLINED');

  // Things the rendering frame actually fetches. These MUST be inlined.
  const subresource = [
    ...stripped.matchAll(/\bsrc\s*=\s*["']([^"']+)["']/g),
    ...stripped.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/g),
    ...stripped.matchAll(/<(?:image|use)\b[^>]*?\b(?:xlink:)?href\s*=\s*["']([^"']+)["']/gi),
    ...stripped.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g),
    ...stripped.matchAll(/@import\s+["']([^"']+)["']/g),
    // Only fetching rel values. canonical, alternate and friends are metadata.
    ...stripped.matchAll(/<link[^>]*\brel=["'](?:stylesheet|preload|modulepreload|prefetch|icon|apple-touch-icon|manifest)["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi),
  ].flatMap((m) => m[1].split(',').map((s) => s.trim().split(/\s+/)[0]));

  const badSubresource = subresource.filter((u) => u.length > 0 && !u.startsWith('data:INLINED'));

  // Every base64 payload, decoded and checked against the format it claims to be. A reference that
  // is spelled data: proves nothing about whether the bytes behind it are a whole file.
  const payloads = [];
  const badPayload = [];
  let n = 0;
  for (const m of html.matchAll(/data:([a-z0-9/+.=-]+);base64,([A-Za-z0-9+/=]*)/gi)) {
    n += 1;
    const mime = m[1].toLowerCase();
    const b64 = m[2];
    const where = `payload ${n} (${mime})`;

    if (b64.length === 0) {
      badPayload.push(`${where}: empty base64`);
      continue;
    }
    if (b64.length % 4 !== 0) {
      badPayload.push(`${where}: base64 length ${b64.length} is not a multiple of 4, so it is truncated`);
      continue;
    }
    const buf = Buffer.from(b64, 'base64');
    // Node decodes leniently, so compare against the length the base64 implies.
    const expectBytes = (b64.length / 4) * 3 - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
    if (buf.length !== expectBytes) {
      badPayload.push(`${where}: base64 decoded to ${buf.length} bytes, expected ${expectBytes}`);
      continue;
    }

    const format = FORMAT[mime];
    if (format == null) {
      badPayload.push(`${where}: no format check known. Add one deliberately rather than guessing.`);
      continue;
    }
    if (!format.magic(buf)) {
      badPayload.push(`${where}: ${buf.length} bytes that are not ${mime}. The signature is wrong, so this renders as nothing.`);
      continue;
    }
    if (format.size != null) {
      const declared = format.size(buf);
      if (declared !== buf.length) {
        badPayload.push(`${where}: container declares ${declared} bytes but carries ${buf.length}, so it is incomplete`);
        continue;
      }
    }
    if (format.tail != null && !format.tail(buf)) {
      badPayload.push(`${where}: ${buf.length} bytes with no terminator, so it is incomplete`);
      continue;
    }
    payloads.push({mime, bytes: buf.length});
  }

  // The mime group excludes ';', so a `;base64,` URI can never match here: this finds only the
  // URL-encoded spelling, which is how Astro carries the inline SVG favicon.
  const urlEncoded = [...html.matchAll(/data:([a-z0-9/+.=-]+),([^"')\s]*)/gi)];
  for (const [i, m] of urlEncoded.entries()) {
    if (m[2].length === 0) {
      badPayload.push(`url-encoded payload ${i + 1} (${m[1]}): empty`);
    }
  }

  // Everything that still looks remote, then explain each one or fail.
  const remote = [...stripped.matchAll(/(?:https?:)?\/\/[^\s"'()<>]+/g)].map((m) => m[0]);
  const proseLinks = [...stripped.matchAll(/<a[^>]+href\s*=\s*["'](https?:\/\/[^"']+)["']/g)].map((m) => m[1]);
  const namespaces = remote.filter((u) => /w3\.org\/\d{4}\//.test(u));
  // Metadata: canonical, og:*, twitter:*. Never fetched while rendering, so they cannot render blank.
  // They still point at whatever origin the build was configured with, which is reported below rather
  // than hidden, because publishing a snapshot whose canonical names an unchosen domain is a fact a
  // reviewer should see.
  const metadata = [
    ...stripped.matchAll(/<link[^>]*\brel=["'](?:canonical|alternate)["'][^>]*\bhref=["']([^"']+)["']/gi),
    ...stripped.matchAll(/<meta[^>]*\b(?:property|name)=["'](?:og:[a-z:]+|twitter:[a-z:]+)["'][^>]*\bcontent=["']([^"']+)["']/gi),
  ].map((m) => m[1]).filter((u) => /^https?:\/\//.test(u));
  const unexplained = remote.filter(
    (u) => !proseLinks.includes(u) && !namespaces.includes(u) && !metadata.includes(u),
  );

  const scripts = [...html.matchAll(/<script\b[^>]*>/gi)].map((m) => m[0].slice(0, 80));

  return {
    subresource, badSubresource, payloads, badPayload,
    urlEncoded: urlEncoded.length,
    proseLinks, namespaces, metadata, unexplained, scripts,
  };
}

function report(html, path, size) {
  const a = auditSelfContained(html);
  const payloadBytes = a.payloads.reduce((sum, p) => sum + p.bytes, 0);
  const byMime = new Map();
  for (const p of a.payloads) {
    byMime.set(p.mime, (byMime.get(p.mime) || 0) + 1);
  }
  const mimeSummary = [...byMime].sort().map(([m, c]) => `${c} ${m}`).join(', ');

  console.log(`${path}  ${(size / 1024 / 1024).toFixed(2)} MB (${size} bytes)`);
  if (inlined.size > 0) {
    console.log(`  inlined subresources   ${inlined.size} (${(bytesIn / 1024 / 1024).toFixed(2)} MB raw)`);
  }
  console.log(`  subresource refs       ${a.subresource.length}`);
  console.log(`  NON-inlined subres     ${a.badSubresource.length}${a.badSubresource.length ? ' -> ' + a.badSubresource.join(', ') : ''}`);
  console.log(`  base64 payloads        ${a.payloads.length + a.badPayload.length} (${mimeSummary || 'none'}), ${(payloadBytes / 1024 / 1024).toFixed(2)} MB decoded`);
  console.log(`  url-encoded payloads   ${a.urlEncoded}`);
  console.log(`  BROKEN payloads        ${a.badPayload.length}`);
  for (const b of a.badPayload) {
    console.log(`                         ${b}`);
  }
  console.log(`  prose links (fine)     ${a.proseLinks.length}`);
  console.log(`  metadata urls          ${a.metadata.length}${a.metadata.length ? ' -> ' + [...new Set(a.metadata)].join(', ') : ''}`);
  console.log(`  xmlns identifiers      ${a.namespaces.length}`);
  console.log(`  unexplained remote     ${a.unexplained.length}${a.unexplained.length ? ' -> ' + a.unexplained.join(', ') : ''}`);
  console.log(`  script tags            ${a.scripts.length}`);

  const failures = [];
  if (a.badSubresource.length > 0) {
    failures.push('NOT SELF-CONTAINED. This artifact has no network: these would render as nothing.');
  }
  if (a.badPayload.length > 0) {
    failures.push('BROKEN PAYLOAD. These data URIs are inlined but do not decode, so they render as nothing.');
  }
  if (a.unexplained.length > 0) {
    failures.push('Remote references that are neither prose links nor xmlns identifiers.');
  }
  if (a.scripts.length > 0) {
    // The site ships zero client JS. If a build ever emits one, this fails rather than shipping a
    // page whose behaviour depends on a script the isolated frame may or may not run.
    failures.push('Script tag present. This site is meant to ship no client JS.');
  }

  if (failures.length > 0) {
    console.error('');
    for (const f of failures) {
      console.error(f);
    }
    process.exit(1);
  }

  console.log('\nself-contained: every subresource is a data URI, every payload decodes, and there is no script tag.');
}

const args = process.argv.slice(2);
if (args[0] === '--check') {
  const path = args[1] ?? OUT;
  if (!existsSync(path)) {
    console.error(`nothing to check: ${path} does not exist.`);
    process.exit(1);
  }
  report(readFileSync(path, 'utf8'), path, statSync(path).size);
} else {
  const html = build();
  report(html, 'dist/gritchat-site.html', statSync(OUT).size);
}
