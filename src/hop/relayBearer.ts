// A real relay bearer: it carries the core's opaque link packets over hop-relayd's WebSocket front
// door. This is what lets a message leave THIS device and reach a node on another device.
//
// Adapted from the HopDemo reference app (apps/react-native/HopDemo/src/relayBearer.ts in the Hop
// monorepo), which pinned the contract against hop-relayd's own tests: `--ws host:port` means "each
// link packet is exactly one WS binary frame, so WS supplies the framing", and the link's Noise XX
// handshake happens inside the node, so the bearer carries opaque bytes and knows nothing about the
// protocol.
//
// This file adds NOTHING to the wire: no length prefix, no hello, no auth message, no envelope. One
// core packet in, one binary frame out, and the reverse. Inventing any of those would make the relay
// drop the link during the handshake, which reads as a crypto failure rather than the framing
// mistake it is.
//
// What it proves and what it does not: a message that arrives through this bearer really crossed a
// real relay, sealed by the real Rust core on one device and opened by the real core on the other.
// It does not prove radio discovery: the React Native SDK ships no BLE or LAN bearer at all, so
// reaching a peer means knowing its address.

import type {HopNode, Subscription} from '@hop-mesh/react-native';

/**
 * Where the link is. `unconfigured` is not a transport state: it means no endpoint has been set, so
 * there is nothing to dial. It exists as a first-class state because the alternative is showing
 * "down" for a relay that was never asked for, which reads as a failure rather than a setting.
 *
 * `retrying` is the relay pool's degraded state: every candidate endpoint is backed off, but the
 * pool still knows where to retry and the backoff always eventually recovers, so it is NOT
 * offline and must never be shown as "down".
 */
export type RelayState = 'unconfigured' | 'connecting' | 'up' | 'down' | 'retrying';

/** A live relay link. `link` is the core link id the packets flow on. */
export interface RelayLink {
  readonly link: number;
  /** Current state, without notifying. */
  state(): RelayState;
  close(): Promise<void>;
}

/**
 * State callback. `detail` carries the reason a transition happened, and reports anything that would
 * otherwise read as silence: a socket that never opens, a send that failed, packets dropped after
 * the link went down.
 */
export type RelayStateListener = (state: RelayState, detail?: string) => void;

// A socket that never opens is the failure that shows up as a spinner forever: a TCP connect to an
// address with nothing listening can hang for a long time before the platform gives up, and against
// a LAN IP that is the common case. Bounded here so it surfaces as a rejection carrying the reason.
const CONNECT_TIMEOUT_MS = 10_000;

// The seam runs its in-process path-check pair on links 1 and 2. Relay links start well clear of
// those: two bearers sharing one core link id "works" until it silently corrupts session state, so
// they must never overlap.
const FIRST_RELAY_LINK = 1000;
let nextRelayLink = FIRST_RELAY_LINK;

/** The slice of WebSocket this bearer uses. Structural on purpose, resolved at call time. */
interface RelaySocket {
  binaryType: string;
  send(data: Uint8Array): void;
  close(): void;
  onopen: (() => void) | null;
  onerror: ((event: {message?: string}) => void) | null;
  onclose: ((event: {code?: number; reason?: string}) => void) | null;
  onmessage: ((event: {data?: unknown}) => void) | null;
}

type RelaySocketCtor = new (url: string) => RelaySocket;

/**
 * Resolve the WebSocket constructor from the global scope at CALL time so tests can install one on
 * globals before dialing, and so importing this module never touches platform globals.
 */
function socketConstructor(): RelaySocketCtor {
  const ctor = (globalThis as unknown as {WebSocket?: RelaySocketCtor}).WebSocket;
  if (ctor == null) {
    throw new Error('no WebSocket implementation on this platform');
  }
  return ctor;
}

/** Bytes of one inbound frame, or null if the frame was not binary. */
function frameBytes(data: unknown): Uint8Array | null {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  // React Native may deliver view types; treat anything array-like with a byteLength as bytes.
  if (data != null && typeof data === 'object' && 'byteLength' in (data as object)) {
    const view = data as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  return null;
}

/**
 * Dial `url` and bridge it to `node` as a bearer link.
 *
 * Inbound frames queue and then drain through one place, because the core rejects bytes on a link it
 * has not brought up (frames arriving before linkUp are held, not dropped) and because the bridge
 * calls must be issued in frame order: reordered packets break the ratchet.
 */
export async function connectRelay(
  node: HopNode,
  url: string,
  onState?: RelayStateListener,
): Promise<RelayLink> {
  const Socket = socketConstructor();
  const link = nextRelayLink;
  nextRelayLink += 1;

  let state: RelayState = 'connecting';
  let finished = false;
  let carrying = false;
  let dropped = 0;
  const inbound: Uint8Array[] = [];

  const report = (next: RelayState, detail?: string): void => {
    if (state === next && detail === undefined) {
      return;
    }
    state = next;
    onState?.(next, detail);
  };

  let failOpen: ((error: Error) => void) | null = null;
  let markOpen: (() => void) | null = null;
  const opened = new Promise<void>((resolve, reject) => {
    markOpen = resolve;
    failOpen = reject;
  });

  const ws = new Socket(url);
  ws.binaryType = 'arraybuffer';

  let outgoing: Subscription | null = null;

  const timer = setTimeout(() => {
    void teardown(`no open within ${CONNECT_TIMEOUT_MS} ms`);
  }, CONNECT_TIMEOUT_MS);

  // The single exit. Every failure and every close funnels through here, so the core never keeps a
  // link whose socket is gone, and so `close()` is idempotent.
  function teardown(detail: string): Promise<void> {
    if (finished) {
      return Promise.resolve();
    }
    finished = true;
    clearTimeout(timer);
    outgoing?.remove();
    outgoing = null;
    try {
      ws.close();
    } catch {
      // Already gone. Closing a dead socket is not a failure worth surfacing.
    }
    report('down', detail);
    // A no-op once `opened` has settled, which is exactly right: a drop after open is a state
    // transition, a drop before open is the reason connectRelay rejects.
    failOpen?.(new Error(`relay ${url}: ${detail}`));
    return carrying ? node.linkDown(link) : Promise.resolve();
  }

  function drain(): void {
    if (!carrying) {
      return;
    }
    for (const bytes of inbound) {
      node.bytesReceived(link, bytes).catch((e: unknown) => {
        report(state, `bytesReceived failed: ${String(e)}`);
      });
    }
    inbound.length = 0;
  }

  ws.onopen = () => {
    markOpen?.();
  };
  ws.onerror = (event) => {
    const message = event?.message;
    void teardown(message && message.length > 0 ? `socket error: ${message}` : 'socket error');
  };
  ws.onclose = (event) => {
    const code = event?.code;
    const reason = event?.reason;
    const why = code == null ? 'closed' : `closed (${code})`;
    void teardown(reason && reason.length > 0 ? `${why}: ${reason}` : why);
  };
  ws.onmessage = (event) => {
    const bytes = frameBytes(event?.data);
    if (bytes == null) {
      report(state, `ignored a non-binary frame from ${url}`);
      return;
    }
    inbound.push(bytes);
    drain();
  };

  // Subscribe BEFORE linkUp. The core can emit the handshake's first packet the instant the link is
  // up, and a subscription registered after that misses it, which surfaces later as a session that
  // never completes rather than as an obviously dropped packet.
  outgoing = node.onOutgoing((out) => {
    if (out.link !== link) {
      return;
    }
    if (finished) {
      dropped += 1;
      report(state, `dropped ${dropped} outbound packet(s): the link is down`);
      return;
    }
    try {
      // Exactly one binary frame carrying the packet's bytes and nothing else. React Native's send
      // honours a typed array's byteOffset, so no copy is needed here.
      ws.send(out.bytes);
    } catch (e: unknown) {
      dropped += 1;
      void teardown(`send failed, ${dropped} packet(s) dropped: ${String(e)}`);
    }
  });

  await opened;
  await node.linkUp(link, 'dialer');
  if (finished) {
    // The socket died while the core was bringing the link up. Take the link back down before
    // failing, or the core keeps driving a link with nothing behind it.
    await node.linkDown(link).catch(() => {});
    throw new Error(`relay ${url}: the link went down while coming up`);
  }
  carrying = true;
  clearTimeout(timer);
  drain();
  report('up');

  return {
    link,
    state: () => state,
    close: () => teardown('closed by the app'),
  };
}
