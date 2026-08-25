// Refinement round, and the lettermark for the icon.
//
// Round one of the wordmark settled two things by looking: the monospace probe reads as a developer
// tool rather than a consumer messenger (and my optical pass actively fights a monospace face, since
// it reads mono's large built-in sidebearings as carried white and strips them), and the justified
// stack shows its forced tracking on GRIT and dies below about 40px because each line is half height.
//
// What was NOT tested is condensed MIXED CASE, which is the combination that might carry both the
// signage lineage and the small-size legibility. So test it, and settle the finalists at matched cap
// height on both grounds.

import { mkdirSync, writeFileSync } from 'node:fs';
import { setLine, setJustifiedStack, round } from './typeset.mjs';
import {
  ANDROID,
  IOS,
  squirclePath,
  androidZoneOverlay,
  inscribeInCircle,
  clearsRoundedRect,
  clearsSuperellipse,
} from './masks.mjs';

const INK = { dark: '#EFE9DB', light: '#12131F' };
const BG = { dark: '#12131F', light: '#EFE9DB' };
const CAP = 100;
const PAD = 8;

function wrap(line, ink, extraLines = []) {
  const all = [{ line, dx: 0, baseline: 0, fill: ink }, ...extraLines];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const l of all) {
    minX = Math.min(minX, l.dx);
    maxX = Math.max(maxX, l.dx + l.line.width);
    minY = Math.min(minY, l.baseline + l.line.top);
    maxY = Math.max(maxY, l.baseline + l.line.bottom);
  }
  const w = maxX - minX + PAD * 2;
  const h = maxY - minY + PAD * 2;
  const body = all
    .map(
      (l) =>
        `<g transform="translate(${round(l.dx - minX + PAD)} ${round(l.baseline - minY + PAD)})">` +
        l.line.body(l.fill) +
        `</g>`,
    )
    .join('');
  return { w, h, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(w)} ${round(h)}">${body}</svg>` };
}

// ---- wordmark finalists, matched cap height ----------------------------------------------------
const FINALISTS = [
  {
    id: 'A-cond-caps',
    label: 'A. Condensed Bold, CAPS',
    note: 'the app display face, signage lineage',
    make: (ink) => wrap(setLine('GRIT CHAT', { capHeight: CAP, target: 0.078 }), ink),
  },
  {
    id: 'B-cond-mixed',
    label: 'B. Condensed Bold, mixed case',
    note: 'untested until now: condensed plus approachable',
    make: (ink) =>
      wrap(setLine('Grit Chat', { capHeight: CAP, target: 0.058, zone: 'x', wordSpace: 0.24 }), ink),
  },
  {
    id: 'C-barlow-mixed',
    label: 'C. Barlow Bold, mixed case',
    note: 'a different cut: wider, warmest, most legible small',
    make: (ink) =>
      wrap(
        setLine('Grit Chat', { capHeight: CAP, target: 0.05, file: 'Barlow-Bold.ttf', zone: 'x', wordSpace: 0.26 }),
        ink,
      ),
  },
  {
    id: 'D-barlow-caps',
    label: 'D. Barlow Bold, CAPS',
    note: 'a different cut, set as caps: widest, most solid',
    make: (ink) => wrap(setLine('GRIT CHAT', { capHeight: CAP, target: 0.072, file: 'Barlow-Bold.ttf' }), ink),
  },
  {
    id: 'E-stack',
    label: 'E. Condensed Bold, justified stack',
    note: 'compact lockup only, dies small',
    make: (ink) => {
      const s = setJustifiedStack('GRIT', 'CHAT', { capHeight: CAP, target: 0.078 });
      return wrap(s.a, ink, [{ line: s.b, dx: 0, baseline: CAP * 1.06, fill: ink }]);
    },
  },
];

// ---- lettermark candidates for the icon --------------------------------------------------------
// Drawn from the wordmark type, so the icon invents no new symbol and stays in the family.
const LETTERMARKS = [
  { id: 'G-cond', label: 'G, Condensed Bold', build: () => setLine('G', { capHeight: CAP, target: 0 }) },
  { id: 'G-barlow', label: 'G, Barlow Bold', build: () => setLine('G', { capHeight: CAP, target: 0, file: 'Barlow-Bold.ttf' }) },
  { id: 'GC-cond', label: 'GC, Condensed Bold', build: () => setLine('GC', { capHeight: CAP, target: 0.045 }) },
  { id: 'GC-barlow', label: 'GC, Barlow Bold', build: () => setLine('GC', { capHeight: CAP, target: 0.04, file: 'Barlow-Bold.ttf' }) },
  { id: 'Gc-barlow', label: 'Gc, Barlow Bold mixed', build: () => setLine('Gc', { capHeight: CAP, target: 0.04, file: 'Barlow-Bold.ttf', zone: 'x' }) },
];

mkdirSync('brand/explore', { recursive: true });

// Report clearance arithmetic rather than asserting it.
console.log('lettermark      ink w x h    aspect   android 66 circle fit   ios rr 22.37%   ios superellipse');
const iconRows = [];
for (const lm of LETTERMARKS) {
  const line = lm.build();
  const w = line.width;
  const h = line.bottom - line.top;
  const a = w / h;
  const fitA = inscribeInCircle(a, ANDROID.safeCircle);
  // iOS: fit inside a centred box that is 76% of the canvas in BOTH dimensions. Scaling by width
  // alone overflows any glyph taller than it is wide, which a single cap always is.
  const S = 108;
  const targetBox = S * 0.76;
  const s = Math.min(targetBox / w, targetBox / h);
  const iw = w * s;
  const ih = h * s;
  const okRR = clearsRoundedRect(iw, ih, S, S * IOS.radiusRatio);
  const okSE = clearsSuperellipse(iw, ih, S);
  console.log(
    `${lm.label.padEnd(24)} ${w.toFixed(1).padStart(5)} x ${h.toFixed(1).padStart(5)}  ${a.toFixed(2).padStart(5)}   ` +
      `${fitA.w.toFixed(1).padStart(5)} x ${fitA.h.toFixed(1).padStart(5)}     ${iw.toFixed(0).padStart(3)} x ${ih.toFixed(0).padStart(3)}   ` +
      `${okRR ? 'clears' : 'CLIPS '}   ${okSE ? 'clears' : 'CLIPS '}`,
  );
  iconRows.push({ ...lm, line, w, h, a, fitA, iosScale: s });
}

function iconSvg(row, ink, { mode }) {
  const S = ANDROID.canvas;
  // Android fits the guaranteed 66dp circle; iOS fits a centred box clear of the corner mask.
  const scale = mode === 'android' ? Math.min(row.fitA.w / row.w, row.fitA.h / row.h) : row.iosScale;
  const dx = S / 2 - (row.w * scale) / 2;
  const dy = S / 2 - ((row.line.top + row.line.bottom) / 2) * scale;
  return `<g transform="translate(${round(dx)} ${round(dy)}) scale(${round(scale)})">${row.line.body(ink)}</g>`;
}

const HEIGHTS = [14, 20, 28, 56, 132];

for (const mode of ['dark', 'light']) {
  const ink = INK[mode];
  const words = FINALISTS.map((f) => {
    const built = f.make(ink);
    const enc = Buffer.from(built.svg).toString('base64');
    const shots = HEIGHTS.map((h) => {
      const w = Math.round((h * built.w) / built.h);
      return `<div class="s"><img src="data:image/svg+xml;base64,${enc}" style="height:${h}px;width:${w}px"><span>${h}</span></div>`;
    }).join('');
    return `<div class="row"><h3>${f.label} <em>${f.note}</em></h3><div class="strip">${shots}</div></div>`;
  }).join('');

  const icons = iconRows
    .map((row) => {
      const inner = iconSvg(row, ink, { mode: 'android' });
      const innerIos = iconSvg(row, ink, { mode: 'ios' });
      const cell = (size, clip, body, bg) =>
        `<svg viewBox="0 0 108 108" width="${size}" height="${size}">` +
        `<defs><clipPath id="c-${row.id}-${size}-${clip}">` +
        (clip === 'circle'
          ? `<circle cx="54" cy="54" r="36"/>`
          : clip === 'sq'
            ? `<path d="${squirclePath(108)}"/>`
            : clip === 'rr'
              ? `<rect width="108" height="108" rx="${(108 * IOS.radiusRatio).toFixed(2)}"/>`
              : `<rect x="18" y="18" width="72" height="72" rx="14"/>`) +
        `</clipPath></defs><g clip-path="url(#c-${row.id}-${size}-${clip})">` +
        `<rect width="108" height="108" fill="${bg}"/>${body}</g></svg>`;
      const dusk = mode === 'dark' ? '#12131F' : '#12131F';
      return `<div class="row"><h3>${row.label} <em>${row.a.toFixed(2)}:1</em></h3><div class="strip">
      <div class="s"><svg viewBox="0 0 108 108" width="132" height="132"><rect width="108" height="108" fill="#191B2E"/>${inner}${androidZoneOverlay()}</svg><span>zones 66/72</span></div>
      <div class="s">${cell(132, 'circle', inner, dusk)}<span>android circle</span></div>
      <div class="s">${cell(132, 'sq', inner, dusk)}<span>android squircle</span></div>
      <div class="s">${cell(132, 'rounded', inner, dusk)}<span>android rounded</span></div>
      <div class="s">${cell(132, 'sq', innerIos, dusk)}<span>ios squircle</span></div>
      <div class="s">${cell(132, 'rr', innerIos, dusk)}<span>ios rr 22.37%</span></div>
      <div class="s">${cell(60, 'sq', innerIos, dusk)}<span>ios 60</span></div>
      <div class="s">${cell(40, 'sq', innerIos, dusk)}<span>ios 40</span></div>
    </div></div>`;
    })
    .join('');

  writeFileSync(
    `brand/explore/refine-${mode}.html`,
    `<!doctype html><meta charset="utf-8"><title>finalists and lettermarks, ${mode}</title>
<style>
 body{background:${BG[mode]};color:${INK[mode]};font:14px/1.4 -apple-system,sans-serif;margin:0;padding:28px}
 h2{font:700 13px/1 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;margin:30px 0 14px;padding-bottom:8px;border-bottom:2px solid ${INK[mode]}44}
 h3{font:400 11px/1.3 ui-monospace,monospace;letter-spacing:.05em;opacity:.55;margin:0 0 9px}
 h3 em{opacity:.65;font-style:normal}
 .row{margin-bottom:22px}
 .strip{display:flex;align-items:flex-end;gap:22px;flex-wrap:wrap}
 .s{display:flex;flex-direction:column;align-items:flex-start;gap:4px}
 .s span{font:10px/1 ui-monospace,monospace;opacity:.35}
 img,svg{display:block}
</style>
<h2>wordmark finalists, matched cap height</h2>${words}
<h2>lettermarks for the icon, in the real masks</h2>
<p style="font:11px/1.5 ui-monospace,monospace;opacity:.5;max-width:80ch">Amber dashed circle is Android's 66dp guaranteed-visible zone inside the 108dp layer. Ember dashed square is the 72dp maximum mask. iOS columns clip with a superellipse standing in for the continuous-corner mask, and with a plain rounded rect at 22.37 percent.</p>
${icons}`,
  );
}
console.log('\nwrote brand/explore/refine-{dark,light}.html');
