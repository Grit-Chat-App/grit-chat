// Status, designed rather than defaulted.
//
// This app has states most messengers do not, and collapsing them into one grey dot would throw away
// the only honest information it has. A message can be accepted by the core but not yet handed to
// anyone, handed to some number of peers with no confirmation, or confirmed by the destination with a
// known forward hop count. A relay can be unset, dialing, carrying, or gone.
//
// ENCODING RULES, in priority order:
//   1. Shape first. Each state has a distinct silhouette: a hollow ring, a run of filled nodes, a
//      terminal cap, a gap. Sunlight, dust and colourblindness all survive shape.
//   2. Position second. The terminal marker sits at the END of the run, so "confirmed" reads as a
//      journey that finished rather than as a colour change.
//   3. Words third. Every state carries a short label in the mono face, because a glyph alone is a
//      guess and this is information a human acts on.
//   4. Colour last, and never load-bearing on its own.
//
// These are pure functions so the vocabulary can be tested without rendering anything.

export type SendState = 'sending' | 'sent' | 'delivered' | 'failed';

export interface OutboundStatus {
  sendState: SendState;
  relayed?: number;
  forwardHops?: number;
}


/** How many node glyphs to draw, and what terminates the run. */
export type TraceCap = 'none' | 'travelling' | 'confirmed' | 'broken';

export interface TraceView {
  /** 'ring' draws one hollow node: accepted, carried by nobody yet. */
  kind: 'ring' | 'run';
  /** Filled node glyphs to draw. */
  nodes: number;
  cap: TraceCap;
  label: string;
  /** Semantic tone, resolved to a palette entry by the component. Never the only difference. */
  tone: 'quiet' | 'moving' | 'confirmed' | 'failed';
}

// There was a MAX_TRACE_NODES = 8 here, the ceiling on how many dots the trace would draw before a
// run got wider than a phone. The trace no longer draws one glyph per peer: it draws the count as a
// numeral in a fixed circle, so width is constant and there is nothing to cap. Keeping the constant
// would have left a comment describing a drawing that does not exist.

/**
 * Which glyph terminates the trace, per state. Font Awesome names, the same convention relayView
 * already uses. Three distinct silhouettes on purpose: if two ever collapse to one shape, the
 * states are told apart by colour alone, which is what the encoding rule forbids.
 *
 * This lives here rather than in the component because it is a decision, not a drawing, and this
 * module is pure so the decision can be tested without a renderer.
 */
export function terminalGlyph(cap: TraceCap): string {
  switch (cap) {
    case 'confirmed':
      return 'check';
    case 'broken':
      return 'times';
    default:
      // Travelling, and the no-cap sending state: the journey is not finished, so it points onward.
      return 'chevron-right';
  }
}

/**
 * The widest string countLabel can return, in characters. The trace's count circle is sized from
 * this rather than from a guess, so the circle can always hold what this function can produce.
 *
 * It is 3 because the clamp is "99+" rather than "99". Reporting 99 for a message that took 150
 * hops is a false measurement, and this app does not round protocol facts into something tidier;
 * the plus sign is the honest form, so the circle is built to fit it.
 */
export const COUNT_MAX_CHARS = 3;

/**
 * What the trace's count circle shows, or null when it shows nothing and is drawn hollow.
 *
 * Null for 'ring', which means the core holds the message and no peer has a copy: there is no count
 * to report, and a printed 0 would read as a measured value rather than as nothing yet.
 *
 * Clamped at two digits plus a marker, never wider than COUNT_MAX_CHARS, so the circle cannot be
 * overflowed by a hop count. A count that high is a protocol anomaly and the caption beside the
 * trace still carries the exact number.
 */
export function countLabel(view: TraceView): string | null {
  if (view.kind === 'ring' || view.nodes <= 0) {
    return null;
  }
  return view.nodes > 99 ? '99+' : String(view.nodes);
}

export function outboundTrace(status: OutboundStatus): TraceView {
  if (status.sendState === 'failed') {
    return {kind: 'run', nodes: 2, cap: 'broken', label: 'not sent', tone: 'failed'};
  }
  if (status.sendState === 'sending') {
    return {kind: 'ring', nodes: 1, cap: 'none', label: 'sending', tone: 'quiet'};
  }
  if (status.sendState === 'delivered') {
    const hops = status.forwardHops ?? 0;
    return {
      kind: 'run',
      nodes: Math.max(hops, 1),
      cap: 'confirmed',
      label: hops > 0 ? `delivered via ${hops} ${hops === 1 ? 'hop' : 'hops'}` : 'delivered',
      tone: 'confirmed',
    };
  }
  // Accepted and handed onward, with no confirmation from the destination yet. The distinction
  // between "nobody has it" and "two peers have it" is real and is stated.
  const relayed = status.relayed ?? 0;
  if (relayed === 0) {
    return {
      kind: 'ring',
      nodes: 1,
      cap: 'travelling',
      label: 'accepted, nobody carrying it yet',
      tone: 'quiet',
    };
  }
  return {
    kind: 'run',
    nodes: relayed,
    cap: 'travelling',
    label: `carried by ${relayed} ${relayed === 1 ? 'peer' : 'peers'}, not confirmed`,
    tone: 'moving',
  };
}

export function inboundTrace(hops: number): TraceView {
  return {
    kind: 'run',
    // NOT floored at 1. It used to be Math.max(hops, 1), because the old drawing put one dot per
    // peer and needed at least one dot to draw anything. The trace now prints this number, so a
    // floor would make the numeral say 1 while the caption beside it says "0 hops to reach you".
    // The graphic and the words have to agree, and zero renders as the hollow ring, which is the
    // same thing it means everywhere else: nobody carried this.
    nodes: hops,
    cap: 'confirmed',
    label: `${hops} ${hops === 1 ? 'hop' : 'hops'} to reach you`,
    tone: 'confirmed',
  };
}

export type RelayStateName = 'unconfigured' | 'connecting' | 'up' | 'down' | 'retrying';

export interface RelayView {
  /** Font Awesome glyph name, chosen so the states differ in silhouette. */
  glyph: string;
  label: string;
  tone: 'quiet' | 'moving' | 'confirmed' | 'failed';
  /** True when the pill draws its solid underline bar: a second, non-colour cue for carrying. */
  underline: boolean;
}

export function relayView(state: RelayStateName): RelayView {
  switch (state) {
    case 'up':
      return {glyph: 'signal', label: 'relay link open', tone: 'confirmed', underline: true};
    case 'connecting':
      return {glyph: 'circle-o', label: 'relay dialing', tone: 'moving', underline: false};
    case 'retrying':
      return {glyph: 'refresh', label: 'relay retrying', tone: 'moving', underline: false};
    case 'down':
      return {glyph: 'chain-broken', label: 'relay offline', tone: 'failed', underline: false};
    case 'unconfigured':
      return {glyph: 'ban', label: 'relay not configured', tone: 'quiet', underline: false};
  }
}

/**
 * A plain-language sentence for the expanded relay indicator, in the words a person uses. The pill
 * itself already carries the short state through relayView; this is what it says when someone asks
 * why. It is never the raw pool line: that is machine-generated and belongs under this, in the mono
 * face, not in front of a person opening a messenger.
 */
export function relayPlain(state: RelayStateName): string {
  switch (state) {
    case 'up':
      return 'A relay link is open. It can carry packets, but only a delivered message proves that a Hop relay accepted them.';
    case 'connecting':
      return 'Dialing your relay. Until the link is open, messages cannot leave this device.';
    case 'retrying':
      return 'Your relay is offline. The app retries after the interval shown below, and messages wait on this device until it answers.';
    case 'down':
      return 'Your relay is offline. Messages cannot leave this device until it is back. Check the endpoint on the connection screen.';
    case 'unconfigured':
      return 'No relay is configured, so messages cannot leave this device. Ask your relay operator for a supported WSS endpoint, then set it on the connection screen.';
  }
}

/**
 * How a peer is reachable right now, in the vocabulary this build can honestly use.
 *
 * There is no direct-radio state, because the React Native Hop SDK ships no Bluetooth or
 * local-network bearer: claiming "nearby" would be a lie. When a radio bearer lands, `direct` joins
 * this union and gets its own silhouette.
 */
export type ReachKind = 'relay' | 'norelay';

export interface ReachView {
  glyph: string;
  label: string;
  tone: 'quiet' | 'moving' | 'confirmed' | 'failed';
}

export function reachView(kind: ReachKind): ReachView {
  if (kind === 'relay') {
    return {glyph: 'exchange', label: 'reachable through the relay', tone: 'confirmed'};
  }
  return {glyph: 'ban', label: 'no path right now', tone: 'failed'};
}
