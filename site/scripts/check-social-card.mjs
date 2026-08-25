// Asserts that the social card the built HTML advertises exists as a file in the build.
//
//   node scripts/check-social-card.mjs      (run from site/, after npm run build)
//
// WHY THIS EXISTS. An og:image that resolves to nothing is the difference between a link that looks
// real when it is shared and one that does not, and it is invisible from a green build: the tag is
// present, the markup is valid, and the file simply is not there. That failure has a name here
// because the site spent a while pointing its card at a host that cannot resolve.
//
// This is the LOCAL half of the check: the URL is well formed and the bytes are in the build. The
// live half, fetching the deployed URL over HTTP, can only run against a real host and lives in the
// deploy job of .github/workflows/site.yml. Neither claims to be the other.
//
// It lives in a file rather than inline in the workflow so it can be run and proven by hand, which
// is the whole difference between a check and a hope.

import { existsSync, readFileSync, statSync } from 'node:fs';

const HTML = 'dist/index.html';

if (!existsSync(HTML)) {
  console.error(`no build to check: ${HTML} does not exist. Run npm run build first.`);
  process.exit(1);
}

const html = readFileSync(HTML, 'utf8');

const found = /<meta\s+property="og:image"\s+content="([^"]+)"/.exec(html);
if (found == null) {
  console.error('no og:image meta tag in the build. A page with no social card has nothing to check.');
  process.exit(1);
}
const advertised = found[1];

let url;
try {
  url = new URL(advertised);
} catch {
  console.error(
    `og:image is not an absolute URL: ${JSON.stringify(advertised)}. ` +
      'A relative social card is ignored by most unfurlers, so this must be absolute.',
  );
  process.exit(1);
}

// The served path carries the base, the build directory does not. Astro's BASE_URL is not readable
// from here, so the base is taken from the same place the URL came from: whatever prefix the
// advertised path has beyond the file that exists in dist. Try the full path first, then strip one
// leading segment, which covers both a root deployment and a project subpath.
const servedPath = url.pathname;
const candidates = [servedPath, servedPath.replace(/^\/[^/]+/, '')];

const hit = candidates.map((p) => `dist${p}`).find((p) => existsSync(p));

if (hit == null) {
  console.error(`og:image advertises ${advertised}`);
  console.error('but no file matches it in the build. Looked at:');
  for (const c of candidates) {
    console.error(`  dist${c}`);
  }
  process.exit(1);
}

const bytes = statSync(hit).size;
if (bytes === 0) {
  console.error(`${hit} exists but is empty, so the card would render as nothing.`);
  process.exit(1);
}

// A social card that is not actually an image is the same failure wearing a different hat.
const head = readFileSync(hit).subarray(0, 8);
const isPng = head[0] === 0x89 && head.subarray(1, 4).toString('latin1') === 'PNG';
const isJpeg = head[0] === 0xff && head[1] === 0xd8;
if (!isPng && !isJpeg) {
  console.error(`${hit} is not a PNG or JPEG. Unfurlers will not render it.`);
  process.exit(1);
}

// Both Open Graph and Twitter want a large card. Below 600 wide it renders as a small square
// thumbnail instead, which is not the shape this image was made for.
const width = isPng ? readFileSync(hit).readUInt32BE(16) : null;
const height = isPng ? readFileSync(hit).readUInt32BE(20) : null;

console.log(`og:image      ${advertised}`);
console.log(`file          ${hit}`);
console.log(`bytes         ${bytes}`);
if (width != null) {
  console.log(`dimensions    ${width}x${height}`);
  if (width < 600) {
    console.error(`\n${width}px wide is below the 600px unfurlers want for a large card.`);
    process.exit(1);
  }
}
console.log('\nsocial card present in the build. The live fetch happens in the deploy job.');
