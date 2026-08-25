// The shared look for every self-contained brand document: the guide (brand/brief.html) and the
// brief (brand/grit-chat-brief.html).
//
// It lives in one module because two documents that go out under the same name must not drift into
// two typographic systems. The alternative was copying sixty lines of CSS into a second generator,
// and the first time one of them changed, the pair would disagree about what the brand looks like.
//
// The faces are the SAME BYTES the site ships, subset by site/scripts/fonts.mjs, so a document and
// the product are provably set in the same type rather than in two things that look similar.

import { readFileSync } from 'node:fs';

export const FONTS = [
  ['Barlow Condensed', 700, 'site/public/fonts/barlow-condensed-bold.woff2'],
  ['Barlow', 400, 'site/public/fonts/barlow-regular.woff2'],
  ['Barlow', 600, 'site/public/fonts/barlow-semibold.woff2'],
  ['IBM Plex Mono', 400, 'site/public/fonts/ibm-plex-mono-regular.woff2'],
];

/** Every face as a data URI. Relic's frame has no network, so a font URL renders as nothing. */
export function inlineFaces() {
  return FONTS.map(([family, weight, path]) => {
    const b64 = readFileSync(path).toString('base64');
    return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2')}`;
  }).join('\n');
}

/**
 * Custom properties from the generated palette, so a document can never carry a hex the brand
 * does not have. C is the palette object out of brand/brand.json.
 */
export function paletteVars(C) {
  return `:root{
  --abyss:${C.abyss};--night:${C.night};--surface:${C.surface};
  --alkali:${C.alkali};--dust:${C.dust};--faint:${C.alkaliFaint};
  --sodium:${C.sodium};--sodium-bright:${C.sodiumBright};--sage:${C.sage};--ember:${C.emberBright};
  --line:rgba(239,233,219,.14);--line-strong:rgba(239,233,219,.26);
  color-scheme:dark;
}`;
}

/** The reading system: prose, headings, tables, code. Shared by both documents verbatim. */
export const BASE_CSS = `*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:var(--abyss);color:var(--alkali);
  font-family:'Barlow',system-ui,sans-serif;font-size:17px;line-height:1.6;
  -webkit-font-smoothing:antialiased}
.wrap{max-width:52rem;margin:0 auto;padding:56px 24px 96px}
h1,h2,h3,h4{font-family:'Barlow Condensed',sans-serif;font-weight:700;line-height:1.1;
  letter-spacing:.01em;margin:0}
h1{font-size:clamp(40px,8vw,68px);margin-bottom:8px}
h2{font-size:clamp(28px,5vw,38px);margin:56px 0 16px;padding-bottom:10px;border-bottom:2px solid var(--line-strong)}
h3{font-size:23px;margin:36px 0 12px}
h4{font-size:19px;margin:28px 0 8px}
p,ul,ol{margin:0 0 16px}
ul,ol{padding-left:22px}
li{margin-bottom:6px}
a{color:var(--sodium-bright);text-decoration:underline;text-underline-offset:2px}
strong,b{font-weight:600}
code{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:.86em;color:var(--sodium-bright);
  background:rgba(239,233,219,.06);padding:1px 5px;border-radius:3px}
hr{border:0;border-top:1px solid var(--line);margin:40px 0}
blockquote{margin:0 0 16px;padding-left:16px;border-left:3px solid var(--sodium);color:var(--dust)}
table{width:100%;border-collapse:collapse;margin:0 0 20px;font-size:15px}
th,td{text-align:left;padding:8px 12px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-weight:600;color:var(--dust);font-size:13px;text-transform:uppercase;letter-spacing:.07em}
td code{white-space:nowrap}
.masthead{border-bottom:1px solid var(--line);padding-bottom:28px;margin-bottom:8px}
.masthead .mark{--h:40px}
.masthead p{color:var(--dust);margin:18px 0 0;font-family:'IBM Plex Mono',monospace;font-size:13px}
.mark svg{display:block;height:var(--h,28px);width:auto;color:var(--alkali);fill:currentColor}
.mark.w-lg{--h:74px}
.mark.light-ink svg{color:var(--night)}
.foot{margin-top:64px;padding-top:20px;border-top:1px solid var(--line);
  font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--faint)}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}`;

/** Read an SVG as inline markup, stripped of the prolog and comments. */
export function svg(path) {
  return readFileSync(path, 'utf8')
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
}
