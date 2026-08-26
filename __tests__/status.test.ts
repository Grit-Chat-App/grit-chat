// The status vocabulary is the app's honesty surface: it decides whether a message reads as
// "confirmed" or "carried by two peers, not confirmed". These tests pin the distinctions that must
// never collapse into one another, because collapsing them is exactly how a messenger starts lying.

import {
  inboundTrace,
  outboundTrace,
  relayPlain,
  relayView,
  reachView,
} from '../src/design/status';

describe('outbound trace states stay distinguishable', () => {
  it('separates accepted-but-uncarried from carried-but-unconfirmed', () => {
    const uncarried = outboundTrace({sendState: 'sent', relayed: 0});
    const carried = outboundTrace({sendState: 'sent', relayed: 2});

    expect(uncarried.kind).toBe('ring');
    expect(uncarried.label).toContain('nobody carrying');
    expect(carried.kind).toBe('run');
    expect(carried.nodes).toBe(2);
    expect(carried.label).toContain('carried by 2 peers');
    // The two must differ in shape, not only in wording or colour.
    expect(carried.kind).not.toBe(uncarried.kind);
  });

  it('marks delivery with a terminal cap and reports the hop count', () => {
    const view = outboundTrace({
      sendState: 'delivered',
      relayed: 1,
      forwardHops: 2,
    });
    expect(view.cap).toBe('confirmed');
    expect(view.nodes).toBe(2);
    expect(view.label).toBe('delivered via 2 hops');
    expect(view.tone).toBe('confirmed');
  });

  it('does not put a forward duration on the delivered label', () => {
    const view = outboundTrace({
      sendState: 'delivered',
      forwardHops: 2,
    });
    expect(view.label).toBe('delivered via 2 hops');
    expect(view.label).not.toMatch(/\d+\s*(ms|s)\b/);
  });



  it('never claims delivery for a message still travelling', () => {
    const travelling = outboundTrace({sendState: 'sent', relayed: 3});
    expect(travelling.cap).toBe('travelling');
    expect(travelling.label).toContain('not confirmed');
    expect(travelling.tone).not.toBe('confirmed');
  });

  it('shows a broken run for a failed send', () => {
    const failed = outboundTrace({sendState: 'failed'});
    expect(failed.cap).toBe('broken');
    expect(failed.label).toBe('not sent');
  });

  it('shows sending as a hollow ring with no cap', () => {
    const sending = outboundTrace({sendState: 'sending'});
    expect(sending.kind).toBe('ring');
    expect(sending.cap).toBe('none');
  });

  it('says one hop in the singular', () => {
    expect(outboundTrace({sendState: 'delivered', forwardHops: 1}).label).toBe('delivered via 1 hop');
  });
});

describe('inbound trace', () => {
  it('reports the physical route that reached this device', () => {
    expect(inboundTrace(3).label).toBe('3 hops to reach you');
    expect(inboundTrace(1).label).toBe('1 hop to reach you');
  });

  // DELIBERATE CHANGE. This asserted `inboundTrace(0).nodes === 1`, titled "draws at least one node
  // even for a zero hop count", which was correct for a drawing that put one dot per peer and needed
  // something to draw. The trace now prints this number in a circle, so a floor of 1 would make the
  // numeral read 1 while the caption beside it reads "0 hops to reach you". The graphic and the words
  // have to agree, so the floor is gone and zero renders as the hollow ring.
  it('does not invent a hop that the protocol did not report', () => {
    expect(inboundTrace(0).nodes).toBe(0);
    expect(inboundTrace(0).label).toBe('0 hops to reach you');
  });
});

describe('relay states', () => {
  it('gives all four states different glyphs', () => {
    const glyphs = (['unconfigured', 'connecting', 'up', 'down'] as const).map(
      (s) => relayView(s).glyph,
    );
    expect(new Set(glyphs).size).toBe(4);
  });

  it('distinguishes an unset relay from an offline endpoint', () => {
    const unset = relayView('unconfigured');
    expect(unset.label).toBe('relay not configured');
    expect(unset.tone).not.toBe('failed');
    expect(relayView('down').label).toBe('relay offline');
    expect(relayView('down').tone).toBe('failed');
  });

  it('only draws the underline cue when the link is carrying', () => {
    expect(relayView('up').underline).toBe(true);
    expect(relayView('connecting').underline).toBe(false);
    expect(relayView('down').underline).toBe(false);
    expect(relayView('unconfigured').underline).toBe(false);
  });
});

describe('peer reachability vocabulary', () => {
  it('offers no direct-radio state, because this build has no radio bearer', () => {
    // If a radio bearer ever lands, this test should fail and be updated deliberately rather than
    // the UI quietly gaining a "nearby" claim it cannot support.
    expect(reachView('relay').label).toBe('reachable through the relay');
    expect(reachView('norelay').label).toBe('no path right now');
  });
});

describe('the plain relay sentence a person reads', () => {
  const states = ['up', 'connecting', 'retrying', 'down', 'unconfigured'] as const;

  it('says something for every state', () => {
    for (const state of states) {
      expect(relayPlain(state).length).toBeGreaterThan(20);
    }
  });

  it('never claims device to device delivery, because there is no radio bearer', () => {
    // The hard product constraint, as a test rather than a promise: this build reaches other people
    // through a relay and nothing else. If a radio bearer lands, this fails and gets rewritten on
    // purpose instead of the copy quietly drifting into a claim the transport cannot support.
    for (const state of states) {
      const sentence = relayPlain(state);
      expect(sentence).not.toMatch(/mesh|device to device|nearby|peer to peer|bluetooth|offline delivery/i);
    }
  });

  it('is a sentence, not the pool telemetry line', () => {
    // The pool line is machine-generated and belongs in the mono face under the sentence. If it ever
    // becomes the plain text, the home screen is back to reading as a protocol demo.
    for (const state of states) {
      expect(relayPlain(state)).not.toMatch(/endpoint\(s\)|dialable|next try in/);
    }
  });

  it('names the relay as the thing that carries, in every state that is not carrying', () => {
    for (const state of ['connecting', 'retrying', 'down', 'unconfigured'] as const) {
      expect(relayPlain(state)).toMatch(/relay/i);
      // Each non-carrying state has to say where messages actually are: on this device.
      expect(relayPlain(state)).toMatch(/this device/i);
    }
  });
});
