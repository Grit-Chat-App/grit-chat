// The proof run sends one real message from THIS app's node to a second independent node and
// records the delivery state the protocol reports. It can run through a configured relay or through
// one explicitly isolated native local bearer. The trace names which one ran so no "connected" state
// is mistaken for a transport proof.
//
// It deliberately uses the ORDINARY product path: seam.send plus the conversation store, so the
// message appears in its conversation with the hop trace exactly as a human's message would. The
// only addition is launch-argument trigger and a trace file that a host can read without screen taps.

import RNFS from 'react-native-fs';

import {AppConfig} from '../config';
import {ConversationStore, shortAddress} from '../store/conversations';
import {GritSeam, LocalBearerSnapshot} from './seam';

export interface ProofTrace {
  ok: boolean;
  selfAddress: string;
  peerAddress: string;
  nonce: string;
  body: string;
  bundleId: string;
  relayUrl: string | null;
  relayState: string;
  /** The path selected at startup. A local value means relay was withheld before the node opened. */
  bearer: 'relay' | 'ble' | 'lan';
  /** The native state captured immediately before a local proof send. */
  bearerSnapshot?: LocalBearerSnapshot;
  relayDetail?: string;
  /** Every delivery snapshot the core reported, in order. */
  statusHistory: {relayed: number; delivered: boolean; forwardHops: number; forwardMs: number}[];
  delivered: boolean;
  relayed: number;
  forwardHops: number;
  forwardMs: number;
  timedOut: boolean;
  isPersistent: boolean;
  prekeyPublished: boolean;
  elapsedMs: number;
  error?: string;
  proves: string;
  doesNotProve: string;
}

/** Where the trace lands so a host can read it without the screen. */
export const PROOF_TRACE_FILENAME = 'grit-proof.json';

interface ProofClaims {
  proves: string;
  doesNotProve: string;
}

function proofClaims(bearer: 'relay' | 'ble' | 'lan'): ProofClaims {
  if (bearer === 'relay') {
    return {
      proves:
        'A real message left this device, crossed a running hop-relayd as sealed bytes, reached a ' +
        'second independent Hop node, and the destination confirmed delivery back to this sender ' +
        'with a forward hop count from the protocol.',
      doesNotProve:
        'Radio discovery or a second handset. The peer may be a command-line node reached by relay.',
    };
  }
  return {
    proves:
      `The native ${bearer.toUpperCase()} bearer was active while the other local bearer and relay ` +
      'were disabled, then a real message left this device and the destination confirmed delivery ' +
      'back to the sender with a forward hop count from the protocol.',
    doesNotProve:
      'A different local bearer, relay delivery, discovery beyond this linked peer, channels, or ' +
      'background delivery.',
  };
}

export async function runProof(
  seam: GritSeam,
  store: ConversationStore,
  config: AppConfig,
): Promise<ProofTrace | null> {
  const peer = config.proofPeer;
  if (peer == null) {
    return null;
  }
  const nonce = config.proofNonce ?? `no-nonce-${Date.now()}`;
  const startedAt = Date.now();
  const bearer: ProofTrace['bearer'] = config.proofBearer ?? 'relay';
  const claims = proofClaims(bearer);
  const relay = seam.relayState();
  const body = `grit proof ${nonce}`;
  let bearerSnapshot: LocalBearerSnapshot | undefined;

  const base = {
    selfAddress: seam.address,
    peerAddress: peer,
    nonce,
    body,
    relayUrl: seam.relayUrl(),
    relayState: relay.state,
    relayDetail: relay.detail,
    bearer,
    isPersistent: seam.isPersistent,
    prekeyPublished: seam.prekeyPublished,
    proves: claims.proves,
    doesNotProve: claims.doesNotProve,
  };

  try {
    if (config.proofBearer != null) {
      if (seam.relayUrl() != null || seam.relayState().state !== 'unconfigured') {
        throw new Error('A local bearer proof requires relay to be withheld before node startup.');
      }
      bearerSnapshot = await seam.waitForIsolatedBearer(config.proofBearer);
    }

    // The peer becomes a real contact, so the message lands in a real conversation rather than in a
    // side channel that only the proof can see.
    await store.addContact(peer, shortAddress(peer));

    const outcome = await seam.send(peer, body, {
      onAccepted: (id) => store.appendOutbound(peer, body, id),
      onUpdate: (id, status) => store.applyDelivery(id, status),
    });
    await store.applyDelivery(outcome.id, outcome.final);

    const after = seam.relayState();
    const trace: ProofTrace = {
      ...base,
      relayState: after.state,
      relayDetail: after.detail,
      prekeyPublished: seam.prekeyPublished,
      bearerSnapshot,
      ok: outcome.delivered,
      bundleId: outcome.id,
      statusHistory: outcome.history,
      delivered: outcome.delivered,
      relayed: outcome.final.relayed,
      forwardHops: outcome.final.forwardHops,
      forwardMs: outcome.final.forwardMs,
      timedOut: outcome.timedOut,
      elapsedMs: Date.now() - startedAt,
    };
    await writeTrace(trace);
    return trace;
  } catch (e) {
    const trace: ProofTrace = {
      ...base,
      bearerSnapshot,
      ok: false,
      bundleId: '',
      statusHistory: [],
      delivered: false,
      relayed: 0,
      forwardHops: 0,
      forwardMs: 0,
      timedOut: false,
      elapsedMs: Date.now() - startedAt,
      error: String(e),
    };
    await writeTrace(trace);
    return trace;
  }
}

async function writeTrace(trace: ProofTrace): Promise<void> {
  try {
    await RNFS.writeFile(
      `${RNFS.DocumentDirectoryPath}/${PROOF_TRACE_FILENAME}`,
      JSON.stringify(trace, null, 2),
      'utf8',
    );
  } catch {
    // A trace that cannot be written must not fail the run: the on-screen panel still shows it, and
    // the file is a convenience for a command line, not the result itself.
  }
}

/** One line summarising a trace, for the on-screen panel and for a host reading the file. */
export function proofSummary(t: ProofTrace): string {
  if (t.error != null) {
    return `FAIL: ${t.error}`;
  }
  const verdict = t.ok && t.forwardHops > 1 ? 'PASS' : 'FAIL';
  return (
    `${verdict}: delivered=${t.delivered} relayed=${t.relayed} forwardHops=${t.forwardHops} ` +
    `via ${t.bearer}${t.bearer === 'relay' ? ` ${t.relayUrl ?? 'no relay'}` : ', relay=disabled'} ` +
    `in ${t.elapsedMs} ms`
  );
}
