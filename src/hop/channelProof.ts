// The CHANNEL proof run: one real hps:// publication from THIS app's node to a second,
// independent Hop node through a running relay, and a real publication back.
//
// It uses the ORDINARY product path end to end: the channel is created through the seam, the
// post is published through the seam into the channel store, and the reply lands through the
// same onChannelMessage handler the UI reads. The only thing the proof adds is that it is
// triggered by a launch argument and writes its trace to a file.
//
// What it proves: a channel message is a single content-key-encrypted publication flooded once,
// and two independent nodes exchange one over a relay with the writer verified.
// What it does not prove: moderation (invites, approval, rekey/revocation), and any radio path.

import RNFS from 'react-native-fs';

import {ChannelStore} from '../store/channels';
import {KeyValueStore} from '../store/kv';
import {SeamChannelMessage, GritSeam} from './seam';

export interface ChannelProofTrace {
  ok: boolean;
  selfAddress: string;
  path: string;
  nonce: string;
  body: string;
  /** Base64 publication id of the FIRST post, published before any member had joined. */
  publishId: string;
  /**
   * Base64 publication id of a SECOND post, published only after the host retained a member.
   *
   * This is the one that tests delivery. A Hop publication is flooded once, so the first post
   * predates membership and a subscriber who joined afterwards has no claim on it; treating its
   * absence as a delivery defect would be wrong. Empty when no member ever appeared.
   */
  postJoinPublishId: string;
  /** Whether a member appeared (join handoff completed) inside the window. */
  memberJoined: boolean;
  /** Our channel visible in the node's own topic list after hosting. */
  listedAfterRegister: boolean;
  /** The peer's reply, when one arrived inside the window. */
  reply: {sender: string; body: string; at: number} | null;
  /** Host-side reach (members who acked) after the exchange. */
  reachAfter: number;
  /**
   * Host-side member set after the exchange, base58. Non-empty means the join handoff completed
   * (the host handed a subscriber the content key); empty means it did not, which is upstream of
   * publication routing entirely.
   */
  membersAfter: string[];
  /** Host-side pending join requests. Always empty for an open channel; recorded to prove it. */
  pendingAfter: string[];
  relayUrl: string | null;
  relayState: string;
  error?: string;
  elapsedMs: number;
  proves: string;
  doesNotProve: string;
}

export const CHANNEL_PROOF_FILENAME = 'grit-channel-proof.json';

const PROVES =
  'A channel message left this device as one content-key-encrypted publication, crossed a ' +
  'running hop-relay as sealed bytes the relay cannot read, reached a second independent Hop ' +
  'node subscribed to the channel, and that node published back through the same path, with the ' +
  'writer verified by the channel keys.';
const DOES_NOT_PROVE =
  'Moderation: invites, request approval, and revocation (hpsRekey) are not exercised. Nor any ' +
  'radio bearer: both nodes spoke through the relay. The second node is a command line process.';

// The peer needs to subscribe, receive the flooded publication, and publish back. A relay hop
// measured about a second; this window is generous without being a hang.
const REPLY_WINDOW_MS = 45_000;
const REPLY_POLL_MS = 500;
// How long to wait for the host to retain a member (the join handoff) before publishing the post
// that actually tests delivery.
const MEMBER_WINDOW_MS = 30_000;
const MEMBER_POLL_MS = 1_000;

function sleep(ms: number): Promise<void> {
  const {promise, resolve} = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

/** Where the phase marker and the trace copy land, so a host can read progress without the screen. */
export const CHANNEL_PROOF_PHASE_KEY = 'grit.channelProof.phase.v1';
export const CHANNEL_PROOF_TRACE_KEY = 'grit.channelProof.trace.v1';

export async function runChannelProof(
  seam: GritSeam,
  channels: ChannelStore,
  path: string,
  kv?: KeyValueStore,
): Promise<ChannelProofTrace> {
  // Phase markers exist because a filesystem trace alone cannot tell you WHERE a run stopped: the
  // first attempt at this proof published successfully and then wrote no trace at all, which is
  // indistinguishable from never running unless the phases are recorded as they happen.
  const phase = async (name: string): Promise<void> => {
    try {
      await kv?.setItem(CHANNEL_PROOF_PHASE_KEY, `${name} @ ${new Date().toISOString()}`);
    } catch {
      // A phase marker is diagnostics. Never let it change the outcome it is describing.
    }
  };
  const startedAt = Date.now();
  const nonce = `ch-${Math.random().toString(36).slice(2, 8)}`;
  const body = `grit channel proof ${nonce}`;
  const relay = seam.relayState();

  const base = {
    selfAddress: seam.address,
    path,
    nonce,
    body,
    relayUrl: seam.relayUrl(),
    relayState: relay.state,
    proves: PROVES,
    doesNotProve: DOES_NOT_PROVE,
  };

  try {
    await phase('start');
    // Host the channel through the same call the New Channel screen uses.
    const created = await seam.createChannel(path);
    await phase('registered');
    await channels.addHosted(created.path, created.host, 'open');

    // The node's own store is the truth for topic existence; the proof records that it lists the
    // channel, which is also what channel survival across restarts rests on.
    const topics = await seam.myChannels();
    const listedAfterRegister = topics.some((t) => t.path === path && t.hosting);
    await phase(`listed=${listedAfterRegister}`);

    // Publish through the ordinary path, so the post lands in the store like any human's.
    const publishId = await seam.publishChannel(path, body);
    await channels.appendPublished(path, body, publishId);
    await phase('published');

    // Wait for the join handoff to land a member, THEN publish again.
    //
    // The post above was flooded before any subscriber had the content key, and a publication is
    // flooded once: a member who joins later has no claim on it, so its absence proves nothing
    // about delivery. The post below is the one that tests delivery, because it is published while
    // a member is known and holding the key.
    let members: string[] = [];
    const memberDeadline = Date.now() + MEMBER_WINDOW_MS;
    while (Date.now() < memberDeadline) {
      members = await seam.channelMembers(path).catch(() => []);
      if (members.length > 0) {
        break;
      }
      await sleep(MEMBER_POLL_MS);
    }
    const memberJoined = members.length > 0;
    await phase(`members=${members.length}`);

    let postJoinPublishId = '';
    if (memberJoined) {
      const postJoinBody = `${body} post-join`;
      postJoinPublishId = await seam.publishChannel(path, postJoinBody);
      await channels.appendPublished(path, postJoinBody, postJoinPublishId);
      await phase('published after join');
    }

    // Wait for a reply on this path from the second node. The store-level handler persists it
    // independently; this listener only observes, so the proof cannot eat the message.
    //
    // A holder rather than a bare let: assignment happens inside a closure, and TypeScript's
    // control-flow narrowing would otherwise read `reply` as permanently null at the use site.
    //
    // The wait is the loop below and NOTHING else. An earlier version also awaited a promise that
    // resolved only on receipt, so a run with no reply hung there forever: the phase marker stayed
    // at "published" and the trace was never written, which reads exactly like a proof that never
    // ran. The deadline is the only thing that ends this wait.
    const box: {reply: SeamChannelMessage | null} = {reply: null};
    const unsubscribe = seam.onChannelMessage((m) => {
      if (m.path === path && m.sender !== seam.address) {
        box.reply = m;
      }
      return true;
    });
    const deadline = Date.now() + REPLY_WINDOW_MS;
    while (box.reply == null && Date.now() < deadline) {
      await sleep(REPLY_POLL_MS);
    }
    unsubscribe();
    const reply = box.reply;
    await phase(`waited reply=${reply != null}`);

    const reachAfter = await seam.channelReach(path).catch(() => -1);
    const membersAfter = await seam.channelMembers(path).catch(() => []);
    const pendingAfter = await seam.channelPending(path).catch(() => []);
    await phase(`reach=${reachAfter} members=${membersAfter.length} pending=${pendingAfter.length}`);

    const trace: ChannelProofTrace = {
      ...base,
      relayState: seam.relayState().state,
      ok: reply != null && listedAfterRegister && postJoinPublishId.length > 0,
      publishId,
      postJoinPublishId,
      memberJoined,
      listedAfterRegister,
      reply:
        reply != null
          ? {sender: reply.sender, body: reply.body, at: reply.at}
          : null,
      reachAfter,
      membersAfter,
      pendingAfter,
      elapsedMs: Date.now() - startedAt,
    };
    await writeTrace(trace, kv);
    await phase('wrote trace');
    return trace;
  } catch (e) {
    await phase(`threw ${String(e)}`);
    const trace: ChannelProofTrace = {
      ...base,
      ok: false,
      publishId: '',
      postJoinPublishId: '',
      memberJoined: false,
      listedAfterRegister: false,
      reply: null,
      reachAfter: -1,
      membersAfter: [],
      pendingAfter: [],
      elapsedMs: Date.now() - startedAt,
      error: String(e),
    };
    await writeTrace(trace, kv);
    return trace;
  }
}

async function writeTrace(trace: ChannelProofTrace, kv?: KeyValueStore): Promise<void> {
  const json = JSON.stringify(trace, null, 2);
  // Two destinations on purpose: the file is what a host reads, and the kv copy survives a
  // filesystem write that fails for a reason the app cannot see.
  try {
    await kv?.setItem(CHANNEL_PROOF_TRACE_KEY, json);
  } catch {
    // Diagnostics only.
  }
  try {
    await RNFS.writeFile(`${RNFS.DocumentDirectoryPath}/${CHANNEL_PROOF_FILENAME}`, json, 'utf8');
  } catch (e) {
    try {
      await kv?.setItem(CHANNEL_PROOF_PHASE_KEY, `trace file write failed: ${String(e)}`);
    } catch {
      // Diagnostics only.
    }
  }
}

/** One line summarising a channel trace, for the on-screen panel and a host reading the file. */
export function channelProofSummary(t: ChannelProofTrace): string {
  if (t.error != null) {
    return `FAIL: ${t.error}`;
  }
  const verdict = t.ok ? 'PASS' : 'FAIL';
  const reply = t.reply != null ? `reply="${t.reply.body}"` : 'no reply in window';
  return (
    `${verdict}: channel ${t.path} published=${t.publishId.length > 0} ` +
    `postJoinPublished=${t.postJoinPublishId.length > 0} listed=${t.listedAfterRegister} ` +
    `${reply} reach=${t.reachAfter} members=${t.membersAfter.length} ` +
    `via ${t.relayUrl ?? 'no relay'}`
  );
}
