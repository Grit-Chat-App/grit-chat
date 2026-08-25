// The proof run: one real message from THIS app's node to a second, independent Hop node, through a
// running relay, with the delivery status the protocol reports.
//
// WHY THIS REPLACED A LOOPBACK CHECK. An in-process loopback pair proves the bridge and the core on
// one device, and nothing whatsoever about two devices: both ends share a process, so the bytes never
// touch a network. The bar for this app is a message that leaves the device, crosses a relay, and
// comes back confirmed. So the proof run sends through the configured relay to an address given at
// launch, and reports what the core says happened.
//
// It deliberately uses the ORDINARY product path: seam.send plus the conversation store, so the
// message appears in the conversation with its hop trace exactly as a human's message would. The only
// thing the proof adds is that it is triggered by a launch argument and writes its trace to a file, so
// a run can be driven and read from a command line without tapping the screen.

import RNFS from 'react-native-fs';

import {AppConfig} from '../config';
import {ConversationStore, shortAddress} from '../store/conversations';
import {GritSeam} from './seam';

export interface ProofTrace {
  ok: boolean;
  selfAddress: string;
  peerAddress: string;
  nonce: string;
  body: string;
  bundleId: string;
  relayUrl: string | null;
  relayState: string;
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

const PROVES =
  'A real message left this device, crossed a running hop-relayd as sealed bytes the relay cannot ' +
  'read, reached a second independent Hop node, and the destination confirmed delivery back to this ' +
  'sender with a forward hop count from the protocol.';
const DOES_NOT_PROVE =
  'Radio discovery. This build has no Bluetooth or local-network bearer, so the peer was reached by ' +
  'knowing its address and every packet went through the relay. It also proves nothing about a ' +
  'second handset: the other node here is a command line process.';

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
  const relay = seam.relayState();
  const body = `grit proof ${nonce}`;

  const base = {
    selfAddress: seam.address,
    peerAddress: peer,
    nonce,
    body,
    relayUrl: seam.relayUrl(),
    relayState: relay.state,
    relayDetail: relay.detail,
    isPersistent: seam.isPersistent,
    prekeyPublished: seam.prekeyPublished,
    proves: PROVES,
    doesNotProve: DOES_NOT_PROVE,
  };

  try {
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
    `via ${t.relayUrl ?? 'no relay'} in ${t.elapsedMs} ms`
  );
}
