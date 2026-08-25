// The hop trace's DECISIONS, as opposed to its drawing.
//
// The drawing is proven by looking at a device: five states were captured and read on the simulator.
// But three of those states rest on rules rather than on pixels, and a rule proven only by a
// screenshot is proven for exactly one screenshot. These are the rules:
//
//   which glyph terminates the run, per state
//   what the count circle shows when no peer holds a copy
//   what it shows when the count would not fit
//
// The redesign replaced a run of one dot per peer with a single numeral, so "handle zero" and
// "handle two digits" became real cases rather than emergent ones. They are tested here.

import {
  COUNT_MAX_CHARS,
  countLabel,
  inboundTrace,
  outboundTrace,
  terminalGlyph,
} from '../src/design/status';

describe('the terminal glyph', () => {
  it('gives each state its own silhouette, never three colours of one shape', () => {
    const glyphs = [
      terminalGlyph('confirmed'),
      terminalGlyph('travelling'),
      terminalGlyph('broken'),
    ];
    expect(glyphs).toEqual(['check', 'chevron-right', 'times']);
    // The load-bearing property: all three differ. If two ever collapse to the same glyph, the
    // states are told apart by colour alone, which is what the encoding rule forbids.
    expect(new Set(glyphs).size).toBe(3);
  });

  it('points onward when there is no cap at all', () => {
    // 'none' is the sending state: the journey has not finished, so it must not read as finished.
    expect(terminalGlyph('none')).toBe('chevron-right');
    expect(terminalGlyph('none')).not.toBe('check');
  });
});

describe('the count circle', () => {
  it('shows nothing when no peer holds a copy, rather than a zero', () => {
    // Both of the states that mean "nobody is carrying this" must come out numeral-free. A printed
    // 0 would read as a measured value.
    expect(countLabel(outboundTrace({sendState: 'sending'}))).toBeNull();
    expect(countLabel(outboundTrace({sendState: 'sent', relayed: 0}))).toBeNull();
  });

  it('shows the count once a peer is carrying', () => {
    expect(countLabel(outboundTrace({sendState: 'sent', relayed: 2}))).toBe('2');
    expect(countLabel(outboundTrace({sendState: 'delivered', relayed: 1, forwardHops: 3}))).toBe('3');
  });

  // The boundary table. These are the values where the rules change, and the last row is the one
  // that matters: the circle is sized from COUNT_MAX_CHARS, so a label wider than that would
  // overflow the shape it is supposedly clamped to fit. An earlier version sized the circle for two
  // digits while this function could return "99+", which is three characters.
  it.each([
    [0, null],
    [1, '1'],
    [9, '9'],
    [10, '10'],
    [99, '99'],
    [100, '99+'],
  ])('inbound %i hops shows %s', (hops, expected) => {
    expect(countLabel(inboundTrace(hops))).toBe(expected);
  });

  it('never returns more characters than the circle is built to hold', () => {
    // Swept rather than spot checked, because the failure mode is one value slipping past.
    for (let hops = 0; hops <= 1000; hops += 1) {
      const label = countLabel(inboundTrace(hops));
      if (label != null) {
        expect(label.length).toBeLessThanOrEqual(COUNT_MAX_CHARS);
      }
    }
    // Pinned so a widened budget has to be a deliberate edit here and in the circle together.
    expect(COUNT_MAX_CHARS).toBe(3);
  });

  it('never returns an empty string, which would draw a filled circle with nothing in it', () => {
    for (const view of [
      outboundTrace({sendState: 'sending'}),
      outboundTrace({sendState: 'failed'}),
      outboundTrace({sendState: 'sent', relayed: 0}),
      outboundTrace({sendState: 'sent', relayed: 7}),
      outboundTrace({sendState: 'delivered', relayed: 1, forwardHops: 0}),
      inboundTrace(0),
      inboundTrace(1),
      inboundTrace(150),
    ]) {
      const label = countLabel(view);
      expect(label === null || label.length > 0).toBe(true);
    }
  });
});
