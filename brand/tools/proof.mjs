// Proof sheet for the shipped assets. Renders every variant at every size it has to survive, on
// every ground it has to survive, so the claim "it works at 16px on light and dark" is something a
// human can check by looking rather than something this repo asserts.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { squirclePath, androidZoneOverlay, IOS } from './masks.mjs';

const read = (p) => readFileSync(p, 'utf8');
const b64 = (s) => Buffer.from(s).toString('base64');
const img = (svg, h, aspect, label) =>
  `<div class="s"><img src="data:image/svg+xml;base64,${b64(svg)}" style="height:${h}px;width:${Math.round(h * aspect)}px"><span>${label ?? h}</span></div>`;

const brand = JSON.parse(read('brand/brand.json'));
const C = brand.palette;

const wordAspect = brand.wordmark.width / brand.wordmark.height;
const stackSvg = read('brand/logo/gritchat-stack.svg');
const stackVB = stackSvg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
const stackAspect = Number(stackVB[1]) / Number(stackVB[2]);
const letterAspect = brand.lettermark.aspect;

// currentColor variants tinted by a wrapping <g fill>, which is exactly how the site will use them.
const tint = (svg, colour) => svg.replace('<svg ', `<svg color="${colour}" `);

const WORD = read('brand/logo/gritchat-wordmark.svg');
const STACK = read('brand/logo/gritchat-stack.svg');
const LETTER = read('brand/logo/gritchat-lettermark.svg');
const ICON_IOS = read('brand/icon/icon-ios.svg');
const ICON_FG = read('brand/icon/icon-android-foreground.svg');
const FAVICON = read('brand/icon/favicon.svg');
const ICON_MONO = read('brand/icon/icon-mono.svg');

const SIZES = [14, 16, 20, 28, 44, 80, 160];

function section(title, note, inner) {
  return `<section><h2>${title}</h2>${note ? `<p class="note">${note}</p>` : ''}${inner}</section>`;
}

function grounds(svg, aspect, sizes, label) {
  return [
    { id: 'night', bg: C.night, ink: C.alkali },
    { id: 'abyss', bg: C.abyss, ink: C.alkali },
    { id: 'surface', bg: C.surface, ink: C.alkali },
    { id: 'alkali (light)', bg: C.alkali, ink: C.night },
    { id: 'sodium', bg: C.sodium, ink: C.night },
  ]
    .map(
      (g) =>
        `<div class="row" style="background:${g.bg}"><h3 style="color:${g.ink}">${label} on ${g.id}</h3>` +
        `<div class="strip">${sizes.map((s) => img(tint(svg, g.ink), s, aspect)).join('')}</div></div>`,
    )
    .join('');
}

// A home screen strip: the icon has to hold its own next to saturated neighbours, which is the real
// test of whether a dark icon or an amber one was the right call.
const NEIGHBOURS = ['#1D9BF0', '#25D366', '#E1306C', '#FF3B30', '#5856D6', '#34C759'];
const homeRow = (iconSvg, size) =>
  `<div class="home">` +
  NEIGHBOURS.slice(0, 3)
    .map(
      (c) =>
        `<svg viewBox="0 0 108 108" width="${size}" height="${size}"><defs><clipPath id="n${c.slice(1)}${size}"><path d="${squirclePath(108)}"/></clipPath></defs><g clip-path="url(#n${c.slice(1)}${size})"><rect width="108" height="108" fill="${c}"/></g></svg>`,
    )
    .join('') +
  `<div class="mine"><svg viewBox="0 0 1024 1024" width="${size}" height="${size}"><defs><clipPath id="mine${size}"><path d="${squirclePath(1024)}"/></clipPath></defs><g clip-path="url(#mine${size})">${iconSvg.replace(/<\/?svg[^>]*>/g, '').replace(/<title>.*?<\/title>|<desc>.*?<\/desc>/gs, '')}</g></svg></div>` +
  NEIGHBOURS.slice(3)
    .map(
      (c) =>
        `<svg viewBox="0 0 108 108" width="${size}" height="${size}"><defs><clipPath id="m${c.slice(1)}${size}"><path d="${squirclePath(108)}"/></clipPath></defs><g clip-path="url(#m${c.slice(1)}${size})"><rect width="108" height="108" fill="${c}"/></g></svg>`,
    )
    .join('') +
  `</div>`;

const iconCell = (svg, size, vb, clip) => {
  const id = `c${clip}${size}${vb}`.replace(/\./g, '');
  const path = clip === 'sq' ? squirclePath(vb) : null;
  return (
    `<div class="s"><svg viewBox="0 0 ${vb} ${vb}" width="${size}" height="${size}">` +
    `<defs><clipPath id="${id}">` +
    (clip === 'sq'
      ? `<path d="${path}"/>`
      : clip === 'rr'
        ? `<rect width="${vb}" height="${vb}" rx="${(vb * IOS.radiusRatio).toFixed(2)}"/>`
        : `<circle cx="${vb / 2}" cy="${vb / 2}" r="${vb * 0.3333}"/>`) +
    `</clipPath></defs><g clip-path="url(#${id})">` +
    svg.replace(/<\/?svg[^>]*>/g, '').replace(/<title>.*?<\/title>|<desc>.*?<\/desc>/gs, '') +
    `</g></svg><span>${clip} ${size}</span></div>`
  );
};

const contrastRows = brand.contrast
  .map(
    (r) =>
      `<tr><td>${r.label}</td><td><code>${r.fg}</code></td><td><code>${r.bg}</code></td>` +
      `<td class="num">${r.ratio.toFixed(2)}:1</td><td class="${r.verdict === 'FAIL' ? 'fail' : 'pass'}">${r.verdict}</td>` +
      `<td><span class="chip" style="background:${r.bg};color:${r.fg}">Grit Chat</span></td></tr>`,
  )
  .join('');

mkdirSync('brand/proof', { recursive: true });
writeFileSync(
  'brand/proof/index.html',
  `<!doctype html><html lang="en"><meta charset="utf-8"><title>Grit Chat brand proof</title>
<style>
 :root{color-scheme:dark}
 body{background:#080911;color:${C.alkali};font:14px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;margin:0;padding:30px}
 h1{font:600 20px/1 ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;margin:0 0 6px}
 h2{font:700 12px/1 ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;margin:38px 0 6px;padding-bottom:8px;border-bottom:2px solid ${C.alkali}33}
 h3{font:400 10px/1 ui-monospace,monospace;letter-spacing:.08em;opacity:.6;margin:0 0 10px}
 .note{font:12px/1.5 ui-monospace,monospace;opacity:.5;max-width:88ch;margin:0 0 14px}
 .row{padding:16px 18px;margin-bottom:2px;border-radius:3px}
 .strip{display:flex;align-items:flex-end;gap:22px;flex-wrap:wrap}
 .s{display:flex;flex-direction:column;align-items:flex-start;gap:5px}
 .s span{font:9px/1 ui-monospace,monospace;opacity:.4}
 img,svg{display:block}
 .home{display:flex;align-items:center;gap:18px;padding:20px;background:#2a2b38;border-radius:8px;margin-bottom:12px}
 .mine{position:relative}
 table{border-collapse:collapse;font:12px/1.5 ui-monospace,monospace;margin-top:8px}
 td,th{padding:5px 12px;border-bottom:1px solid ${C.alkali}1a;text-align:left}
 .num{text-align:right}
 .pass{color:${C.sage}}
 .fail{color:${C.emberBright};font-weight:700}
 code{opacity:.7}
 .chip{padding:3px 9px;border-radius:3px;font:600 12px/1 sans-serif}
</style>
<h1>Grit Chat brand proof</h1>
<p class="note">Every asset below is generated by brand/tools/build.mjs from the type metrics and the committed spacing spec. Wordmark-led identity: no pictorial symbol. The app icon is a lettermark cut from the same face, because a wordmark is unreadable at 60 points.</p>

${section(
  'wordmark, primary',
  `Barlow Condensed Bold capitals, optically letterspaced. ${brand.wordmark.width.toFixed(0)} by ${brand.wordmark.height.toFixed(0)} units, ${wordAspect.toFixed(2)} to 1. Sizes are rendered height in CSS pixels.`,
  grounds(WORD, wordAspect, SIZES, 'wordmark'),
)}

${section(
  'compact stack, secondary',
  `GRIT over CHAT, tracked to identical width. For square placements only: it loses legibility below roughly 40px, which is visible in the first two columns and is why it is not the primary.`,
  grounds(STACK, stackAspect, SIZES, 'stack'),
)}

${section(
  'lettermark',
  `The letters GC, ${letterAspect.toFixed(2)} to 1. This is what the app icon is built from.`,
  grounds(LETTER, letterAspect, [14, 16, 20, 28, 44, 80], 'lettermark'),
)}

${section(
  'app icon, in the real masks',
  `iOS asset is a 1024 square with ninety degree corners, as Apple requires, and is shown here clipped by a superellipse and by a rounded rect at ${(IOS.radiusRatio * 100).toFixed(2)} percent. Android foreground is a 108dp layer; the amber dashed circle is the 66dp zone guaranteed visible on every OEM mask and the ember dashed square is the 72dp maximum mask.`,
  `<div class="row" style="background:${C.surface}">
    <h3>ios 1024 asset, clipped both ways</h3>
    <div class="strip">
      ${[180, 120, 60, 40, 29].map((s) => iconCell(ICON_IOS, s, 1024, 'sq')).join('')}
      ${[180, 60].map((s) => iconCell(ICON_IOS, s, 1024, 'rr')).join('')}
    </div>
  </div>
  <div class="row" style="background:${C.surface}">
    <h3>android adaptive, foreground over background, every mask shape</h3>
    <div class="strip">
      <div class="s"><svg viewBox="0 0 108 108" width="180" height="180"><rect width="108" height="108" fill="${C.sodium}"/>${ICON_FG.replace(/<\/?svg[^>]*>/g, '').replace(/<title>.*?<\/title>|<desc>.*?<\/desc>/gs, '')}${androidZoneOverlay()}</svg><span>zones 66 and 72</span></div>
      ${[180, 60, 40].map((s) => iconCell(`<svg><rect width="108" height="108" fill="${C.sodium}"/>${ICON_FG.replace(/<\/?svg[^>]*>/g, '').replace(/<title>.*?<\/title>|<desc>.*?<\/desc>/gs, '')}</svg>`, s, 108, 'circle')).join('')}
      ${[180, 60, 40].map((s) => iconCell(`<svg><rect width="108" height="108" fill="${C.sodium}"/>${ICON_FG.replace(/<\/?svg[^>]*>/g, '').replace(/<title>.*?<\/title>|<desc>.*?<\/desc>/gs, '')}</svg>`, s, 108, 'sq')).join('')}
    </div>
  </div>
  <div class="row" style="background:${C.surface}">
    <h3>favicon, its own cut, and the one-colour icon</h3>
    <div class="strip">
      ${[16, 24, 32, 64].map((s) => img(FAVICON, s, 1, `favicon ${s}`)).join('')}
      ${[32, 64].map((s) => img(tint(ICON_MONO, C.alkali), s, 1, `mono ${s}`)).join('')}
      <div class="s"><span style="background:${C.alkali};padding:6px;display:block;border-radius:3px">${[32, 64].map((s) => `<img src="data:image/svg+xml;base64,${b64(tint(ICON_MONO, C.night))}" style="height:${s}px;width:${s}px;display:inline-block">`).join('')}</span><span>mono on light</span></div>
    </div>
  </div>`,
)}

${section(
  'the icon against a home screen',
  'A dark icon reads as restrained at 180px and disappears at 40px next to saturated neighbours. That is why the field is sodium: it is the product\u2019s one loud colour, and on a home screen the field carries more identity than the letters do.',
  `${homeRow(ICON_IOS, 60)}${homeRow(ICON_IOS, 40)}`,
)}

${section(
  'contrast, computed not asserted',
  'WCAG 2.x relative luminance. Large-text and non-text thresholds are 3:1, normal body text is 4.5:1, AAA body is 7:1.',
  `<table><tr><th>pair</th><th>foreground</th><th>ground</th><th class="num">ratio</th><th>verdict</th><th>sample</th></tr>${contrastRows}</table>`,
)}
</html>`,
);
console.log('wrote brand/proof/index.html');
