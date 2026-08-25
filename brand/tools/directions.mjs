// Three wordmark directions, plus the probes that argue against a fourth.
//
// Rendered so they can be looked at rather than reasoned about: each direction at display size, at
// nav size, at favicon-adjacent size, on dark and on light, and in one ink.

import { mkdirSync, writeFileSync } from 'node:fs';
import { setLine, setJustifiedStack, metrics, round } from './typeset.mjs';

const INK = { dark: '#EFE9DB', light: '#12131F' };
const MUTED = { dark: '#B7B1A1', light: '#5F5A4C' };
const BG = { dark: '#12131F', light: '#EFE9DB' };
const CAP = 100;
const PAD = 8;

function doc(lines, { ink, muted }) {
  // lines: [{ line, fill, dx, baseline }]
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
  const w = maxX - minX + PAD * 2;
  const h = maxY - minY + PAD * 2;
  const body = lines
    .map(
      (l) =>
        `<g transform="translate(${round(l.dx - minX + PAD)} ${round(l.baseline - minY + PAD)})">` +
        l.line.body(l.fill === 'muted' ? muted : ink) +
        `</g>`,
    )
    .join('');
  return {
    w,
    h,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(w)} ${round(h)}">${body}</svg>`,
  };
}

const variants = [];
const add = (group, label, note, build) => variants.push({ group, label, note, build });

// ---- direction 1: SIGNAGE ---------------------------------------------------------------------
// The app's own display face, one line, all caps. Barlow is drawn from California public signage,
// which is the literal reading condition for this product.
for (const t of [0.055, 0.075, 0.095]) {
  add('1 SIGNAGE', `condensed bold caps, target ${t}`, 'one line, optical', ({ ink, muted }) => {
    const line = setLine('GRIT CHAT', { capHeight: CAP, target: t });
    return doc([{ line, fill: 'ink', dx: 0, baseline: 0 }], { ink, muted });
  });
}
add('1 SIGNAGE', 'METRIC spacing, for comparison', 'font defaults, no optical pass', ({ ink, muted }) => {
  // Metric: every gap identical, which is what the font ships for running text.
  const line = setLine('GRIT CHAT', { capHeight: CAP, target: 0.075, maxDepth: 0 });
  return doc([{ line, fill: 'ink', dx: 0, baseline: 0 }], { ink, muted });
});
add('1 SIGNAGE', 'CHAT recedes, colour', 'GRIT primary, CHAT one step down the ramp', ({ ink, muted }) => {
  const a = setLine('GRIT', { capHeight: CAP, target: 0.075 });
  const b = setLine('CHAT', { capHeight: CAP, target: 0.075 });
  const gap = CAP * 0.26;
  return doc(
    [
      { line: a, fill: 'ink', dx: 0, baseline: 0 },
      { line: b, fill: 'muted', dx: a.width + gap, baseline: 0 },
    ],
    { ink, muted },
  );
});
add('1 SIGNAGE', 'CHAT recedes, weight', 'GRIT bold, CHAT semibold', ({ ink, muted }) => {
  const a = setLine('GRIT', { capHeight: CAP, target: 0.075 });
  const b = setLine('CHAT', { capHeight: CAP, target: 0.075, file: 'BarlowCondensed-SemiBold.ttf' });
  const gap = CAP * 0.26;
  return doc(
    [
      { line: a, fill: 'ink', dx: 0, baseline: 0 },
      { line: b, fill: 'ink', dx: a.width + gap, baseline: 0 },
    ],
    { ink, muted },
  );
});

// ---- direction 2: STACK -----------------------------------------------------------------------
// Both words are four characters and both end in T. Force them to identical width with tracking
// alone and you get a solid rectangular block: equipment marking, shipping crate, survey stencil.
// It is also nearly square, which is the shape an app icon and a compact nav both want.
for (const lead of [0.86, 1.0, 1.14]) {
  add('2 STACK', `justified block, leading ${lead}`, 'GRIT over CHAT, tracked to equal width', ({ ink, muted }) => {
    const s = setJustifiedStack('GRIT', 'CHAT', { capHeight: CAP, target: 0.075 });
    return doc(
      [
        { line: s.a, fill: 'ink', dx: 0, baseline: 0 },
        { line: s.b, fill: 'ink', dx: 0, baseline: CAP * lead },
      ],
      { ink, muted },
    );
  });
}
add('2 STACK', 'justified block, CHAT recedes', 'leading 1.0, CHAT one step down', ({ ink, muted }) => {
  const s = setJustifiedStack('GRIT', 'CHAT', { capHeight: CAP, target: 0.075 });
  return doc(
    [
      { line: s.a, fill: 'ink', dx: 0, baseline: 0 },
      { line: s.b, fill: 'muted', dx: 0, baseline: CAP },
    ],
    { ink, muted },
  );
});
add('2 STACK', 'NOT justified, for comparison', 'natural widths, ragged right', ({ ink, muted }) => {
  const a = setLine('GRIT', { capHeight: CAP, target: 0.075 });
  const b = setLine('CHAT', { capHeight: CAP, target: 0.075 });
  return doc(
    [
      { line: a, fill: 'ink', dx: 0, baseline: 0 },
      { line: b, fill: 'ink', dx: 0, baseline: CAP },
    ],
    { ink, muted },
  );
});

// ---- direction 3: PLAIN -----------------------------------------------------------------------
// A different cut from the app's display face: Barlow proper, not condensed, mixed case. Friendlier,
// more consumer messenger, and the most legible of the three at small sizes.
for (const t of [0.05, 0.07]) {
  add('3 PLAIN', `Barlow Bold, mixed case, target ${t}`, 'x-height zone', ({ ink, muted }) => {
    const line = setLine('Grit Chat', { capHeight: CAP, target: t, file: 'Barlow-Bold.ttf', zone: 'x', wordSpace: 0.26 });
    return doc([{ line, fill: 'ink', dx: 0, baseline: 0 }], { ink, muted });
  });
}
add('3 PLAIN', 'Barlow SemiBold, mixed case', 'lighter, more neutral', ({ ink, muted }) => {
  const line = setLine('Grit Chat', { capHeight: CAP, target: 0.06, file: 'Barlow-SemiBold.ttf', zone: 'x', wordSpace: 0.26 });
  return doc([{ line, fill: 'ink', dx: 0, baseline: 0 }], { ink, muted });
});
add('3 PLAIN', 'Barlow Bold, caps', 'the same cut, set as caps', ({ ink, muted }) => {
  const line = setLine('GRIT CHAT', { capHeight: CAP, target: 0.075, file: 'Barlow-Bold.ttf' });
  return doc([{ line, fill: 'ink', dx: 0, baseline: 0 }], { ink, muted });
});

// ---- probe: the machine face ------------------------------------------------------------------
// IBM Plex Mono is already in the product, where it carries addresses and hop counts. Setting the
// name in it would say "infrastructure". Rendered so the argument can be settled by looking.
add('4 PROBE mono', 'IBM Plex Mono SemiBold caps', 'the app machine face', ({ ink, muted }) => {
  const line = setLine('GRIT CHAT', { capHeight: CAP, target: 0.05, file: 'IBMPlexMono-SemiBold.ttf' });
  return doc([{ line, fill: 'ink', dx: 0, baseline: 0 }], { ink, muted });
});
add('4 PROBE mono', 'IBM Plex Mono SemiBold mixed', '', ({ ink, muted }) => {
  const line = setLine('Grit Chat', { capHeight: CAP, target: 0.045, file: 'IBMPlexMono-SemiBold.ttf', zone: 'x', wordSpace: 0.24 });
  return doc([{ line, fill: 'ink', dx: 0, baseline: 0 }], { ink, muted });
});

// ---- render -----------------------------------------------------------------------------------

mkdirSync('brand/explore', { recursive: true });
console.log('faces available:');
for (const f of ['BarlowCondensed-Bold.ttf', 'BarlowCondensed-SemiBold.ttf', 'Barlow-Bold.ttf', 'Barlow-SemiBold.ttf', 'IBMPlexMono-SemiBold.ttf']) {
  const m = metrics(f);
  console.log(`  ${m.name.padEnd(28)} upm ${m.unitsPerEm} cap ${m.capHeight} x ${m.xHeight}`);
}

const stack = setJustifiedStack('GRIT', 'CHAT', { capHeight: CAP, target: 0.075 });
console.log(
  `\nstack justification: GRIT needed ${(stack.trackA * CAP).toFixed(2)} extra per gap, ` +
    `CHAT needed ${(stack.trackB * CAP).toFixed(2)}, both now ${stack.width.toFixed(2)} wide`,
);

const HEIGHTS = [14, 20, 28, 56, 132];
for (const mode of ['dark', 'light']) {
  const groups = new Map();
  for (const v of variants) {
    const built = v.build({ ink: INK[mode], muted: MUTED[mode] });
    if (!groups.has(v.group)) groups.set(v.group, []);
    groups.get(v.group).push({ ...v, built });
  }
  const html = [...groups.entries()]
    .map(([group, items]) => {
      const rows = items
        .map((it) => {
          const enc = Buffer.from(it.built.svg).toString('base64');
          const shots = HEIGHTS.map((h) => {
            const w = Math.round((h * it.built.w) / it.built.h);
            return `<div class="s"><img src="data:image/svg+xml;base64,${enc}" style="height:${h}px;width:${w}px"><span>${h}</span></div>`;
          }).join('');
          return `<div class="row"><h3>${it.label}${it.note ? ` <em>${it.note}</em>` : ''}</h3><div class="strip">${shots}</div></div>`;
        })
        .join('');
      return `<section><h2>${group}</h2>${rows}</section>`;
    })
    .join('');
  writeFileSync(
    `brand/explore/directions-${mode}.html`,
    `<!doctype html><meta charset="utf-8"><title>wordmark directions, ${mode}</title>
<style>
 body{background:${BG[mode]};color:${INK[mode]};font:14px/1.4 -apple-system,sans-serif;margin:0;padding:28px}
 h2{font:700 13px/1 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;opacity:.85;margin:34px 0 14px;padding-bottom:8px;border-bottom:2px solid ${INK[mode]}44}
 h3{font:600 11px/1.3 ui-monospace,monospace;letter-spacing:.05em;opacity:.55;margin:0 0 9px;font-weight:400}
 h3 em{opacity:.6;font-style:normal}
 .row{margin-bottom:20px}
 .strip{display:flex;align-items:flex-end;gap:24px;flex-wrap:wrap}
 .s{display:flex;flex-direction:column;align-items:flex-start;gap:4px}
 .s span{font:10px/1 ui-monospace,monospace;opacity:.35}
 img{display:block}
 section{margin-bottom:10px}
</style>
${html}`,
  );
}
console.log('\nwrote brand/explore/directions-{dark,light}.html');
