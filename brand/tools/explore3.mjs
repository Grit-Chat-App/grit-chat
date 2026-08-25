// Final icon round. Two open questions, both cheap to settle by looking.
//
// 1. Is a two-line G over C better than GC side by side? It echoes the stacked lockup and it is
//    squarer still, which matters because the guaranteed Android zone is a circle.
// 2. Should the icon be alkali on dusk, or dusk on sodium? Sodium is the product's one loud colour,
//    reserved in the app for a primary action and a live relay. A home screen is a wall of colour, and
//    a very dark icon can either read as restrained or vanish.

import { mkdirSync, writeFileSync } from 'node:fs';
import { setLine, setJustifiedStack, round } from './typeset.mjs';
import { ANDROID, IOS, squirclePath, androidZoneOverlay, inscribeInCircle, clearsRoundedRect, clearsSuperellipse } from './masks.mjs';

const CAP = 100;
const S = ANDROID.canvas;

// Candidate glyph groups, each returning a list of lines with baselines.
const CANDIDATES = {
  'GC side by side': () => {
    const l = setLine('GC', { capHeight: CAP, target: 0.045 });
    return { lines: [{ line: l, dx: 0, baseline: 0 }], w: l.width, top: l.top, bottom: l.bottom };
  },
  'GC tighter': () => {
    const l = setLine('GC', { capHeight: CAP, target: 0.02 });
    return { lines: [{ line: l, dx: 0, baseline: 0 }], w: l.width, top: l.top, bottom: l.bottom };
  },
  'G over C, justified': () => {
    const s = setJustifiedStack('G', 'C', { capHeight: CAP, target: 0.045 });
    const lead = CAP * 1.0;
    return {
      lines: [
        { line: s.a, dx: 0, baseline: 0 },
        { line: s.b, dx: 0, baseline: lead },
      ],
      w: s.width,
      top: s.a.top,
      bottom: lead + s.b.bottom,
    };
  },
  'G alone': () => {
    const l = setLine('G', { capHeight: CAP, target: 0 });
    return { lines: [{ line: l, dx: 0, baseline: 0 }], w: l.width, top: l.top, bottom: l.bottom };
  },
};

const FIELDS = [
  { id: 'alkali on dusk', bg: '#12131F', ink: '#EFE9DB' },
  { id: 'alkali on surface', bg: '#191B2E', ink: '#EFE9DB' },
  { id: 'dusk on sodium', bg: '#F2A93B', ink: '#12131F' },
  { id: 'alkali on abyss', bg: '#080911', ink: '#EFE9DB' },
];

mkdirSync('brand/explore', { recursive: true });

console.log('candidate              w x h      aspect   android 66 fit    ios box    rr     se');
const rows = [];
for (const [name, build] of Object.entries(CANDIDATES)) {
  const c = build();
  const h = c.bottom - c.top;
  const a = c.w / h;
  const fitA = inscribeInCircle(a, ANDROID.safeCircle);
  const androidScale = Math.min(fitA.w / c.w, fitA.h / h);
  const box = S * 0.76;
  const iosScale = Math.min(box / c.w, box / h);
  const iw = c.w * iosScale;
  const ih = h * iosScale;
  const okRR = clearsRoundedRect(iw, ih, S, S * IOS.radiusRatio);
  const okSE = clearsSuperellipse(iw, ih, S);
  console.log(
    `${name.padEnd(22)} ${c.w.toFixed(0).padStart(3)} x ${h.toFixed(0).padStart(3)}   ${a.toFixed(2).padStart(5)}   ` +
      `${fitA.w.toFixed(1).padStart(5)} x ${fitA.h.toFixed(1).padStart(5)}   ${iw.toFixed(0).padStart(3)} x ${ih.toFixed(0).padStart(3)}  ` +
      `${okRR ? 'ok  ' : 'CLIP'}  ${okSE ? 'ok' : 'CLIP'}`,
  );
  rows.push({ name, c, h, a, androidScale, iosScale });
}

function group(row, ink, scale) {
  const dx = S / 2 - (row.c.w * scale) / 2;
  const dy = S / 2 - ((row.c.top + row.c.bottom) / 2) * scale;
  const inner = row.c.lines
    .map((l) => `<g transform="translate(${round(l.dx)} ${round(l.baseline)})">${l.line.body(ink)}</g>`)
    .join('');
  return `<g transform="translate(${round(dx)} ${round(dy)}) scale(${round(scale)})">${inner}</g>`;
}

const clips = {
  circle: `<circle cx="54" cy="54" r="36"/>`,
  sq: `<path d="${squirclePath(108)}"/>`,
  rr: `<rect width="108" height="108" rx="${(108 * IOS.radiusRatio).toFixed(2)}"/>`,
};

let html = '';
for (const row of rows) {
  html += `<h3>${row.name} <em>${row.a.toFixed(2)}:1</em></h3><div class="strip">`;
  html +=
    `<div class="s"><svg viewBox="0 0 108 108" width="120" height="120"><rect width="108" height="108" fill="#191B2E"/>` +
    group(row, '#EFE9DB', row.androidScale) +
    androidZoneOverlay() +
    `</svg><span>zones</span></div>`;
  for (const f of FIELDS) {
    for (const [ck, cd] of Object.entries(clips)) {
      const id = `${row.name}-${f.id}-${ck}`.replace(/[^a-z0-9]/gi, '');
      const sizes = ck === 'sq' ? [120, 60, 40] : [120];
      for (const size of sizes) {
        html +=
          `<div class="s"><svg viewBox="0 0 108 108" width="${size}" height="${size}">` +
          `<defs><clipPath id="${id}${size}">${cd}</clipPath></defs>` +
          `<g clip-path="url(#${id}${size})"><rect width="108" height="108" fill="${f.bg}"/>` +
          group(row, f.ink, ck === 'circle' ? row.androidScale : row.iosScale) +
          `</g></svg><span>${f.id.split(' on ')[1]} ${ck} ${size}</span></div>`;
      }
    }
  }
  html += `</div>`;
}

writeFileSync(
  'brand/explore/icons.html',
  `<!doctype html><meta charset="utf-8"><title>icon field and lettermark</title>
<style>
 body{background:#080911;color:#EFE9DB;font:14px/1.4 -apple-system,sans-serif;margin:0;padding:26px}
 h3{font:400 11px/1.3 ui-monospace,monospace;letter-spacing:.05em;opacity:.6;margin:26px 0 9px}
 h3 em{opacity:.6;font-style:normal}
 .strip{display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap}
 .s{display:flex;flex-direction:column;align-items:center;gap:4px}
 .s span{font:9px/1 ui-monospace,monospace;opacity:.35}
 svg{display:block}
</style>
${html}`,
);
console.log('\nwrote brand/explore/icons.html');
