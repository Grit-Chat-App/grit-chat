// Generates the raster favicons from the brand SVG.
//
//   node scripts/favicons.mjs            (run from site/)
//   node scripts/favicons.mjs --verify   (fails if an output is missing or stale)
//
// WHY RASTERS AT ALL, when the SVG icon already works. Two requests a browser makes that an SVG
// cannot answer:
//
//   1. A bare GET /favicon.ico at the site root, which browsers and crawlers issue whether or not
//      the document links one. Without a file there it is a 404 in every log and, on some clients,
//      no icon at all.
//   2. Sized PNG hints. Some clients pick from `sizes` rather than scaling an SVG, and a few older
//      ones ignore SVG icons entirely.
//
// So the SVG stays the primary and these are the fallbacks, generated from the same source rather
// than drawn again. Nothing here is hand-made, which is the rule for every asset in this project:
// the single G cut is deliberate and documented in brand/README.md, because at 16px the app icon's
// GC merges into one dark smudge.

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import sharp from 'sharp';

const SOURCE = 'src/assets/brand/favicon.svg';
const OUT_DIR = 'public';
const SIZES = [16, 32, 48];
const ICO = join(OUT_DIR, 'favicon.ico');

const verify = process.argv.includes('--verify');

if (!existsSync(SOURCE)) {
  console.error(`no favicon source at ${SOURCE}`);
  process.exit(1);
}

const svg = readFileSync(SOURCE);

/**
 * Rasterise at a high density and then resize down, rather than asking the rasteriser for the final
 * pixel size directly. A 16px direct render of a letterform loses the counter; supersampling then
 * downscaling keeps it.
 */
async function pngAt(size) {
  return sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

const pngs = new Map();
for (const size of SIZES) {
  pngs.set(size, await pngAt(size));
}

/**
 * An ICO is a tiny container: a 6 byte directory header, then one 16 byte entry per image, then the
 * image payloads. PNG payloads have been legal inside ICO since Windows Vista, so these are the
 * same bytes as the standalone files rather than a second encoding of them.
 *
 * Written by hand because sharp has no ICO encoder, and pulling a dependency in to lay out 6 plus
 * 16n bytes would be the larger cost.
 */
function buildIco(images) {
  const entries = [...images.entries()].sort((a, b) => a[0] - b[0]);
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 is an icon
  header.writeUInt16LE(entries.length, 4);

  const directory = Buffer.alloc(16 * entries.length);
  let offset = header.length + directory.length;
  const payloads = [];

  entries.forEach(([size, data], i) => {
    const at = i * 16;
    // 0 means 256 in this field. Nothing here is that large, but encode it correctly anyway.
    directory.writeUInt8(size >= 256 ? 0 : size, at);
    directory.writeUInt8(size >= 256 ? 0 : size, at + 1);
    directory.writeUInt8(0, at + 2); // palette size, 0 for truecolour
    directory.writeUInt8(0, at + 3); // reserved
    directory.writeUInt16LE(1, at + 4); // colour planes
    directory.writeUInt16LE(32, at + 6); // bits per pixel
    directory.writeUInt32LE(data.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += data.length;
    payloads.push(data);
  });

  return Buffer.concat([header, directory, ...payloads]);
}

const ico = buildIco(pngs);

const outputs = [
  ...SIZES.map((size) => [join(OUT_DIR, `favicon-${size}.png`), pngs.get(size)]),
  [ICO, ico],
];

if (verify) {
  const stale = outputs.filter(([path, data]) => {
    if (!existsSync(path)) return true;
    return !readFileSync(path).equals(data);
  });
  if (stale.length > 0) {
    console.error('favicons are missing or stale:');
    for (const [path] of stale) {
      console.error(`  ${path}`);
    }
    console.error('\nRun: node scripts/favicons.mjs');
    process.exit(1);
  }
  console.log(`favicons current: ${outputs.map(([p]) => p.split('/').pop()).join(', ')}`);
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const [path, data] of outputs) {
  writeFileSync(path, data);
  console.log(`${path}  ${statSync(path).size} bytes`);
}
console.log(`\n${outputs.length} files from ${SOURCE}. Sizes in the .ico: ${SIZES.join(', ')}.`);
