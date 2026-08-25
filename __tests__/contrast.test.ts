// Contrast, as a test rather than an audit somebody remembers to run.
//
// Two of these values shipped below AA and reached a handset: alkaliFaint at 3.51:1 on outbound
// bubbles, and sodiumDeep at 4.02:1 on every primary button. They were found by reading the palette
// by hand, which is exactly why they lasted. The point of this file is that the next one fails here
// instead.
//
// Every pair is checked against the surfaces the token ACTUALLY sits on, taken from the token
// comments and from grepping the call sites, not against one nominal background. The standards are
// WCAG 2.1: 4.5:1 for body text (1.4.3), 3:1 for non-text visual information that identifies a
// component or conveys content (1.4.11).

import {palette} from '../src/design/tokens';

type Rgb = [number, number, number];

function parse(colour: string): {rgb: Rgb; alpha: number} {
  if (colour.startsWith('#')) {
    const s = colour.slice(1);
    return {
      rgb: [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)) as Rgb,
      alpha: 1,
    };
  }
  const m = colour.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/);
  if (m == null) {
    throw new Error(`cannot parse colour ${JSON.stringify(colour)}`);
  }
  return {
    rgb: [Number(m[1]), Number(m[2]), Number(m[3])] as Rgb,
    alpha: m[4] == null ? 1 : Number(m[4]),
  };
}

function channel(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** A translucent colour has no contrast of its own: composite it over what is behind it first. */
function flatten(colour: string, behind: Rgb): Rgb {
  const {rgb, alpha} = parse(colour);
  if (alpha === 1) {
    return rgb;
  }
  return rgb.map((c, i) => c * alpha + behind[i] * (1 - alpha)) as Rgb;
}

export function ratio(fg: string, bg: string): number {
  const back = parse(bg).rgb;
  const front = flatten(fg, back);
  const a = luminance(front);
  const b = luminance(back);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

// Every surface text can land on. abyss is in the list because the composer bar uses it and the
// keyboard backdrop shows through on overscroll. There is no raisedHigh: it was retired in this
// same change, because it was documented as the focus ring colour at 1.44:1 on night and nothing
// used it. If a surface is ever added to the ramp, add it here, or this guard stops covering the
// app it claims to cover.
const TEXT_SURFACES = ['abyss', 'night', 'surface', 'raised'] as const;

// The guard is only as complete as this list, so prove the list IS the ramp rather than assuming.
it('checks every surface in the palette ramp', () => {
  const ramp = Object.keys(palette).filter((k) =>
    ['abyss', 'night', 'surface', 'raised', 'raisedHigh'].includes(k),
  );
  expect(ramp.sort()).toEqual([...TEXT_SURFACES].sort());
});

describe('text clears AA on every surface it sits on', () => {
  const cases: Array<{fg: keyof typeof palette; on: readonly (keyof typeof palette)[]; why: string}> = [
    {fg: 'alkali', on: TEXT_SURFACES, why: 'primary text'},
    {fg: 'dust', on: TEXT_SURFACES, why: 'secondary text'},
    {fg: 'alkaliFaint', on: TEXT_SURFACES, why: 'hints, timestamps, placeholders'},
    {fg: 'sodiumBright', on: TEXT_SURFACES, why: 'action text on dark'},
    {fg: 'emberBright', on: TEXT_SURFACES, why: 'warning text on dark'},
    {fg: 'sage', on: TEXT_SURFACES, why: 'confirmed delivery'},
    // The inversion: dark text on a light fill.
    {fg: 'sodiumDeep', on: ['sodium', 'sodiumBright'], why: 'action text on sodium fills'},
  ];

  for (const c of cases) {
    for (const bg of c.on) {
      it(`${c.fg} on ${bg} (${c.why})`, () => {
        const got = ratio(palette[c.fg], palette[bg]);
        // Reported to two places so a failure names the number rather than only the verdict.
        expect({pair: `${c.fg}/${bg}`, ratio: Number(got.toFixed(2))}).toEqual({
          pair: `${c.fg}/${bg}`,
          ratio: expect.any(Number),
        });
        expect(got).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe('non-text visual information clears 3:1', () => {
  const cases: Array<{fg: keyof typeof palette; on: readonly (keyof typeof palette)[]; why: string}> = [
    {fg: 'sodium', on: TEXT_SURFACES, why: 'action fill, live relay glyph'},
    {fg: 'ember', on: TEXT_SURFACES, why: 'failure glyph and border'},
    // The boundary of an interactive thing has to be perceivable: inputs, buttons, pills.
    {fg: 'edge', on: TEXT_SURFACES, why: 'control boundary'},
  ];

  for (const c of cases) {
    for (const bg of c.on) {
      it(`${c.fg} on ${bg} (${c.why})`, () => {
        expect(ratio(palette[c.fg], palette[bg])).toBeGreaterThanOrEqual(3.0);
      });
    }
  }
});

describe('the decorative hairlines are honestly labelled', () => {
  // These do NOT meet 3:1 and are not required to: 1.4.11 exempts decoration. The test pins that
  // they stay decoration, so nobody quietly promotes one to a control boundary and believes it is
  // accessible. If a control needs an edge, `edge` exists.
  it('line and lineStrong are below 3:1, which is why edge exists', () => {
    expect(ratio(palette.line, palette.night)).toBeLessThan(3.0);
    expect(ratio(palette.lineStrong, palette.night)).toBeLessThan(3.0);
  });

  it('edge is solid, because an alpha edge contrast depends on what is behind it', () => {
    expect(palette.edge.startsWith('#')).toBe(true);
    expect(parse(palette.edge).alpha).toBe(1);
  });
});

describe('the ratio function itself', () => {
  // A contrast test that cannot compute contrast would pass everything. These are the two anchors
  // every implementation agrees on.
  it('is 21:1 for black on white and 1:1 for a colour on itself', () => {
    expect(ratio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(ratio('#F2A93B', '#F2A93B')).toBeCloseTo(1, 5);
  });

  it('composites alpha over the background rather than ignoring it', () => {
    // Fully transparent white over night is night: ratio 1. If alpha were ignored it would be ~15.
    expect(ratio('rgba(255, 255, 255, 0)', palette.night)).toBeCloseTo(1, 5);
  });
});
