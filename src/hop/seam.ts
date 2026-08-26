// THE SEAM. Every Hop touchpoint in this app lives here or in this directory: node lifecycle,
// identity persistence, the relay bearer, the pump, send, delivery status, and inbound handling.
// Nothing outside src/hop/ imports @hop-mesh/react-native; screens and stores talk to GritSeam only.
//
// Lifecycle, in order, each step load-bearing:
//   1. Load the identity secret from the platform keystore (or mint a fresh node and save it, with
//      a read-back proof: a silent write failure here is the bug class that cost the Swift app an
//      identity per launch).
//   2. Open the persistent node at a writable db path, restoring that secret.
//   3. Publish a prekey bundle (an untraceable send cannot seal to us without one).
//   4. Subscribe to inbound BEFORE starting the pump: the first message can land before a listener
//      registered afterwards exists, and then simply never appears.
//   5. Start the pump.
//   6. Dial the relay, async: an unreachable relay must not stop the app from working, and its state
//      is reported honestly on screen instead.
//
// Channels: hps:// landed through the bridge at ABI 6 (vendored dev SDK from hop main 54a2e82).
// The seam exposes host/join/publish/leave beside one-to-one send, exactly as promised below.
// A group message is a single content-key-encrypted publication flooded once, so there is no
// per-recipient delivery state and no hps status query; revocation is key rotation, and the UI
// says that rather than implying anything was unsent.

import {
  Hop,
  HopAddress,
  HopNode,
  HopStatus,
  fromBase64,
  toBase64,
} from '@hop-mesh/react-native';

import {SeamTopic} from '../store/channels';
// NOT the SDK's bytesToUtf8: that one calls TextDecoder, which Hermes does not have. See utf8.ts.
import {utf8Decode} from './utf8';
import {KeyValueStore} from '../store/kv';
import {IdentityStore} from './identityStore';
import {RelayLink, RelayState, connectRelay} from './relayBearer';

/** The SDK binding point. Tests inject a fake factory; production binds the real bridge. */
export interface HopFactory {
  open(opts: {dbPath: string; secret?: Uint8Array}): Promise<HopNode | null>;
  ephemeral(): Promise<HopNode>;
  validateAddress(text: string): Promise<boolean>;
}

export const sdkFactory: HopFactory = {
  open: (opts) => Hop.open(opts),
  ephemeral: () => Hop.ephemeral(),
  async validateAddress(text) {
    return (await HopAddress.fromBase58(text)) != null;
  },
};

export interface SeamDeps {
  factory: HopFactory;
  identity: IdentityStore;
  kv: KeyValueStore;
  /** Absolute path to a writable directory for the node's persistent store. */
  documentsPath: string;
  /**
   * The relay endpoint from build-time config, or null when none was configured. A value the user
   * has saved in the app wins over this; nothing at all is a state, not a reason to invent a URL.
   */
  relayUrl?: string | null;
  /** Pump tick interval; the reference app and SDK default is 250ms. */
  pumpIntervalMs?: number;
  /**
   * Delivery status poll cadence and cap. Injectable because the honest behaviour under a peer that
   * never confirms is a bounded wait, and a test must be able to reach that boundary without
   * spending the production budget of about thirty seconds.
   */
  statusPollMs?: number;
  statusPollTries?: number;
}

/** An inbound message, decoded, as the rest of the app sees it. */
export interface SeamInbound {
  /** Base64 inbox id, usable as a stable store key. */
  id: string;
  from: string;
  body: string;
  /** The MIME-ish type the sender declared. Text is 'text/plain' when unset. */
  contentType: string;
  /** Original inbound bytes, retained without a copy so bounded control payloads can validate them. */
  bodyBytes?: Uint8Array;
  hops: number;
  at: number;
}

export interface SendOutcome {
  /** Base64 bundle id. */
  id: string;
  delivered: boolean;
  final: HopStatus;
  /** True when polling hit its cap without a delivery confirmation. */
  timedOut: boolean;
  /** Every distinct status snapshot, in order: the honest life of the message. */
  history: HopStatus[];
}

/** The two physical radios the native bridge owns. Relay is deliberately outside this manager. */
export type LocalBearer = 'ble' | 'lan';

/**
 * The native bridge's complete bearer state. It is recorded with a proof so "radio enabled" cannot
 * be mistaken for an isolated transport.
 */
export interface LocalBearerSnapshot {
  readonly revision: number;
  readonly states: Readonly<{
    ble: 'disabled' | 'enabled' | 'active';
    lan: 'disabled' | 'enabled' | 'active';
    relay: 'disabled';
  }>;
}


export class SendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SendError';
  }
}

/** An inbound hps:// publication, decoded, as the app sees it. */
export interface SeamChannelMessage {
  /** Base64 publication id. */
  id: string;
  path: string;
  /** Base58 writer of the post (channels are per-writer-signed). */
  sender: string;
  body: string;
  at: number;
}

/** An invite a host sent us. Take-and-clear at the core: persist it or it is gone. */
export interface SeamChannelInvite {
  host: string;
  path: string;
  kind: string;
}

export class ChannelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChannelError';
  }
}

const PUMP_INTERVAL_MS = 250;
const STATUS_POLL_MS = 350;
const STATUS_POLL_TRIES = 85; // ~30s, then the outcome says timedOut rather than lying
const RELAY_URL_KEY = 'grit.relayUrl.v1';
// Relay redial pacing. The first retry waits two seconds and each consecutive failure doubles it to
// a thirty second ceiling. This is load-bearing rather than cosmetic: an unpaced retry was measured
// to open 162 connections to a local relay in under two minutes and to knock other clients off it.
const RELAY_REDIAL_BASE_MS = 2_000;
const RELAY_REDIAL_MAX_MS = 30_000;
const RELAY_REDIAL_MAX_ATTEMPT = 4;

function sleep(ms: number): Promise<void> {
  const {promise, resolve} = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

/**
 * Which endpoint wins: a saved value, the build-time config, or nothing.
 *
 * `saved` distinguishes three cases that a `??` chain collapses into two. Null means the user has
 * never chosen, so config applies. An empty string means the user CLEARED it, which must stick:
 * silently re-dialing the configured host after someone removed it would misreport where their
 * messages go. Anything else is their choice and outranks config.
 */
export function resolveRelayUrl(saved: string | null, configured: string | null): string | null {
  if (saved == null) {
    return configured;
  }
  const trimmed = saved.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export class GritSeam {
  private relay: RelayLink | null = null;
  private relayStateValue: RelayState = 'unconfigured';
  private relayDetailValue?: string;
  private readonly relayListeners = new Set<(state: RelayState, detail?: string) => void>();
  private readonly inboundListeners = new Set<(m: SeamInbound) => void | Promise<void>>();
  private readonly channelMessageListeners = new Set<
    (m: SeamChannelMessage) => boolean | Promise<boolean>
  >();
  private readonly channelInviteListeners = new Set<(i: SeamChannelInvite) => void>();
  private readonly serviceRoutes = new Map<string, (m: SeamInbound) => void>();
  /** Pool redial bookkeeping: a stopped loop must not fire a stale timer. */
  private redialTimer: ReturnType<typeof setTimeout> | null = null;
  private redialAttempt = 0;
  /** The configured endpoint, or null when nothing is configured. Null is never a default. */
  private relayUrlValue: string | null;
  private prekeyPublishedValue = false;
  /** Proof-only publication retry. A local peer may arrive after this node has started. */
  private localPrekeyTimer: number | null = null;


  private constructor(
    /** The running node. Exposed for seam-internal use (the proof run) ONLY. */
    public readonly node: HopNode,
    public readonly factory: HopFactory,
    readonly identity: IdentityStore,
    private readonly kv: KeyValueStore,
    public readonly address: string,
    public readonly isPersistent: boolean,
    private readonly pumpIntervalMs: number,
    private readonly statusPollMs: number,
    private readonly statusPollTries: number,
    relayUrl: string | null,
  ) {
    this.relayUrlValue = relayUrl;
  }

  /** Build and start the node. Throws loudly on any identity or storage failure. */
  static async start(deps: SeamDeps): Promise<GritSeam> {
    const pumpIntervalMs = deps.pumpIntervalMs ?? PUMP_INTERVAL_MS;
    const statusPollMs = deps.statusPollMs ?? STATUS_POLL_MS;
    const statusPollTries = deps.statusPollTries ?? STATUS_POLL_TRIES;

    const savedSecret = await deps.identity.load();
    const secretBytes = savedSecret != null ? fromBase64(savedSecret) : undefined;

    let node: HopNode | null = null;
    try {
      node = await deps.factory.open({
        dbPath: `${deps.documentsPath}/grit-hop.db`,
        secret: secretBytes,
      });
      if (node == null) {
        throw new Error(
          'Hop could not open its persistent store. The node cannot run ephemerally without ' +
            'losing sessions on every launch, so this is fatal rather than degraded.',
        );
      }

      const address = await node.address();

      if (savedSecret == null) {
        // First launch with this keystore: persist the minted identity and PROVE it landed. The
        // Swift app shipped with a silent failure here; the consequence (a new address every
        // launch, every contact silently orphaned) is why this throws instead of continuing.
        await deps.identity.save(toBase64(await node.secret()));
      }

      const isPersistent = await node.isPersistent();
      // Deliberately NOT publishing a prekey bundle here. Publication reaches the directory over a
      // live link, and at this point no link exists: publishing now was measured to leave the app's
      // prekey absent from the relay's directory, so no peer could ever seal a message or an
      // acknowledgement TO this node. The publish happens when the relay link comes up.

      // Subscribe before the pump starts (see the class comment: ordering is load-bearing).
      const seam = new GritSeam(
        node,
        deps.factory,
        deps.identity,
        deps.kv,
        address,
        isPersistent,
        pumpIntervalMs,
        statusPollMs,
        statusPollTries,
        // The configured endpoint: what the user saved in this app, else build-time config, else
        // nothing. A saved EMPTY string means the user cleared it on purpose and must not be
        // overridden by the build-time value, which is why this is not a plain ?? chain.
        resolveRelayUrl(await deps.kv.getItem(RELAY_URL_KEY), deps.relayUrl ?? null),
      );

      node.onMessage(async (m) => {
        const contentType = m.contentType ?? 'text/plain';
        const media = contentType.startsWith('image/') || contentType.startsWith('audio/');
        const inbound: SeamInbound = {
          id: toBase64(m.id),
          from: m.from,
          body: media ? '' : utf8Decode(m.body),
          contentType,
          bodyBytes: m.body,
          hops: m.hops,
          at: m.createdAt,
        };
        // Service routes (seam-internal, e.g. the path check echo) take the message instead of
        // the app listeners. Any app listener must finish durable ingestion before acknowledgement:
        // accepting first removes the core inbox record and lets a crash lose the message forever.
        const route = seam.serviceRoutes.get(inbound.from);
        if (route != null) {
          route(inbound);
        } else {
          for (const listener of seam.inboundListeners) {
            await listener(inbound);
          }
        }
        await node?.acceptInbox(m.id);
      });

      // hps:// subscriptions, same ordering rule as the inbox: register before the pump starts,
      // or the first channel message can land before any listener exists and never appear.
      //
      // Publications are accept-to-remove: each repeats on every poll until accepted, so the
      // listener chain runs to completion (the store persist) BEFORE the accept. A listener
      // returning false withholds the accept on purpose: that is the "not mine to keep yet"
      // signal, and the core redelivers.
      node.onHpsMessage(async (m) => {
        const message: SeamChannelMessage = {
          id: toBase64(m.id),
          path: m.path,
          sender: m.sender,
          body: utf8Decode(m.body),
          at: Date.now(),
        };
        let keep = true;
        for (const listener of seam.channelMessageListeners) {
          // One refusal is enough: nothing is persisted consistently, so nothing is accepted.
          if ((await listener(message)) === false) {
            keep = false;
          }
        }
        if (keep) {
          await node?.acceptHpsMessage(m.id);
        }
      });

      // Invites are TAKE-AND-CLEAR at the core's queue: draining destroys them. There is no
      // accept to withhold, so every listener must persist what it is handed synchronously
      // enough to survive a crash right after.
      node.onHpsInvite((invite) => {
        const payload: SeamChannelInvite = {
          host: invite.host,
          path: invite.path,
          kind: invite.kind,
        };
        for (const listener of seam.channelInviteListeners) {
          listener(payload);
        }
      });

      await node.start(pumpIntervalMs);

      // Async on purpose: an unreachable relay is a state to show, not a reason to fail startup.
      // With nothing configured there is nothing to dial, and the state says exactly that.
      if (seam.relayUrlValue == null) {
        seam.reportRelay('unconfigured');
      } else {
        // The configured endpoint joins the core's relay pool as a user/operator choice, which
        // the pool never demotes, so pool-driven redial can always find its way back here.
        await node.relayAdd(seam.relayUrlValue, true).catch(() => false);
        void seam.dialRelay(seam.relayUrlValue);
      }
      return seam;
    } catch (e) {
      if (node != null) {
        await node.close().catch(() => {});
      }
      throw e;
    }
  }

  // ---- relay ----

  /** Whether a prekey bundle has been published over a live link. */
  get prekeyPublished(): boolean {
    return this.prekeyPublishedValue;
  }

  /** The configured endpoint, or null when nothing is configured. */
  relayUrl(): string | null {
    return this.relayUrlValue;
  }

  relayState(): {state: RelayState; detail?: string} {
    return {state: this.relayStateValue, detail: this.relayDetailValue};
  }

  onRelayState(cb: (state: RelayState, detail?: string) => void): () => void {
    this.relayListeners.add(cb);
    return () => {
      this.relayListeners.delete(cb);
    };
  }

  private reportRelay(state: RelayState, detail?: string): void {
    this.relayStateValue = state;
    this.relayDetailValue = detail;
    for (const cb of this.relayListeners) {
      cb(state, detail);
    }
  }

  /** Cancel a pending redial. Does NOT clear the failure count: only a carrying link does that. */
  private stopRedialTimer(): void {
    if (this.redialTimer != null) {
      clearTimeout(this.redialTimer);
      this.redialTimer = null;
    }
  }

  /**
   * Pool-driven redial, paced.
   *
   * EVERY attempt waits first, and the wait grows with consecutive failures. An earlier version
   * reset the counter whenever the pool offered a URL and dialed immediately, which is not a
   * backoff at all: a link that failed on connect was redialed instantly, forever. Measured on a
   * local relay, that reached link=162 in under two minutes, and the storm was enough to kill
   * OTHER clients' connections to the same relay (a second command line node was dropped about
   * 300ms after it connected, every time). Only a link that actually reaches `up` clears the
   * counter.
   *
   * `relayNext()` returning null while the pool holds candidates is the degraded "everything is
   * backed off" state: the pool still knows where to retry, so the UI shows `retrying`, never
   * offline. An empty pool (total 0) is genuinely nothing to dial and stops the loop.
   */
  private async redialFromPool(): Promise<void> {
    if (this.relayUrlValue == null) {
      return; // unconfigured is a setting, not a failure to retry
    }
    if (this.redialTimer != null) {
      return; // one loop, never a second one racing it
    }
    let pool = {total: 0, available: 0};
    try {
      pool = await this.node.relayPool();
    } catch {
      // The pool query failing is not a reason to stop retrying.
    }
    if (pool.total === 0) {
      // Nothing to dial: asking again would return the same nothing. setRelayUrl restarts dialing.
      this.reportRelay('down', 'relay pool is empty');
      return;
    }
    const delay = Math.min(RELAY_REDIAL_BASE_MS * 2 ** this.redialAttempt, RELAY_REDIAL_MAX_MS);
    this.redialAttempt = Math.min(this.redialAttempt + 1, RELAY_REDIAL_MAX_ATTEMPT);
    this.reportRelay(
      'retrying',
      `retrying in ${Math.round(delay / 1000)}s: ${pool.total} endpoint(s) known, ${pool.available} dialable`,
    );
    this.redialTimer = setTimeout(() => {
      this.redialTimer = null;
      void (async () => {
        let next: string | null = null;
        try {
          next = await this.node.relayNext();
        } catch {
          // Treated as "nothing dialable right now".
        }
        if (next == null) {
          // Every candidate is still backed off inside the pool. Ask again, paced.
          void this.redialFromPool();
          return;
        }
        await this.dialRelay(next);
      })();
    }, delay);
  }

  private async dialRelay(url: string): Promise<void> {
    this.stopRedialTimer();
    const previous = this.relay;
    this.relay = null;
    if (previous != null) {
      await previous.close().catch(() => {});
    }
    this.reportRelay('connecting');
    try {
      this.relay = await connectRelay(this.node, url, (state, detail) => {
        this.reportRelay(state, detail);
        if (state === 'up') {
          // Only a link that actually carries clears the backoff.
          this.redialAttempt = 0;
          void this.node.relayReport(url, true).catch(() => {});
          // The directory is reachable now and not before. Publishing earlier was the defect that
          // left every delivery unconfirmable.
          void this.node.publishPrekey().then((published) => {
            this.prekeyPublishedValue = published;
          });
          return;
        }
        // A link that was carrying and then dropped: the pool decides whether and where to
        // redial. Only for the CURRENT link: a stale socket's close must not fight a newer dial,
        // and while this.relay is still null the dial's own catch path owns the failure.
        if (state === 'down' && this.relay != null) {
          this.relay = null;
          void this.redialFromPool();
        }
      });
    } catch (e) {
      void this.node.relayReport(url, false).catch(() => {});
      this.reportRelay('down', String(e));
      void this.redialFromPool();
    }
  }

  /**
   * Point the relay at a new endpoint and persist the choice. An empty string CLEARS the endpoint
   * rather than restoring some default: an app that quietly re-dials a host the user just removed
   * would be lying about where their messages go.
   */
  async setRelayUrl(url: string): Promise<void> {
    const next = url.trim();
    if (next.length === 0) {
      this.relayUrlValue = null;
      await this.kv.setItem(RELAY_URL_KEY, '');
      this.stopRedialTimer();
      this.redialAttempt = 0;
      const previous = this.relay;
      this.relay = null;
      await previous?.close().catch(() => {});
      this.reportRelay('unconfigured');
      return;
    }
    this.relayUrlValue = next;
    await this.kv.setItem(RELAY_URL_KEY, next);
    // A user asking for an endpoint is a fresh start, not a continuation of a failing streak.
    this.redialAttempt = 0;
    // A user-entered endpoint is a configured choice: the pool never demotes it.
    await this.node.relayAdd(next, true).catch(() => false);
    await this.dialRelay(next);
  }

  /** The relay pool's counts, for honest status UI. Null when the query itself failed. */
  async relayPoolInfo(): Promise<{total: number; available: number} | null> {
    try {
      return await this.node.relayPool();
    } catch {
      return null;
    }
  }

  /**
   * Isolate one native local bearer before a physical proof. Relay must have been withheld at
   * startup, rather than merely declared "off" after a socket had a chance to carry a packet.
   */
  async isolateLocalBearer(bearer: LocalBearer): Promise<LocalBearerSnapshot> {
    if (this.relay != null || this.relayUrlValue != null) {
      throw new Error('Cannot isolate a local bearer while a relay is configured.');
    }

    const other: LocalBearer = bearer === 'ble' ? 'lan' : 'ble';
    await this.node.setBearerEnabled(other, false);
    const snapshot = (await this.node.setBearerEnabled(bearer, true)) as LocalBearerSnapshot;
    if (
      snapshot.states[bearer] === 'disabled' ||
      snapshot.states[other] !== 'disabled' ||
      snapshot.states.relay !== 'disabled'
    ) {
      throw new Error(`Native bearer isolation failed for ${bearer}.`);
    }

    this.stopLocalPrekeyPublication();
    const publish = () => {
      void this.node
        .publishPrekey()
        .then((published) => {
          this.prekeyPublishedValue ||= published;
        })
        .catch(() => {});
    };
    publish();
    // The other handset can enter range after this app has started. Re-offering its prekey until
    // close makes the next real link usable without having an invisible timing dependency.
    this.localPrekeyTimer = setInterval(publish, 1_000);
    return snapshot;
  }

  /** The send side waits for an actual selected radio link, never just an enabled manager. */
  async waitForIsolatedBearer(bearer: LocalBearer, timeoutMs: number = 15_000): Promise<LocalBearerSnapshot> {
    const other: LocalBearer = bearer === 'ble' ? 'lan' : 'ble';
    const started = Date.now();
    let snapshot = (await this.node.bearerSnapshot()) as LocalBearerSnapshot;
    while (
      snapshot.states[bearer] !== 'active' ||
      snapshot.states[other] !== 'disabled' ||
      snapshot.states.relay !== 'disabled'
    ) {
      if (Date.now() - started >= timeoutMs) {
        throw new Error(
          `No active isolated ${bearer} link after ${timeoutMs} ms: ` +
            `ble=${snapshot.states.ble}, lan=${snapshot.states.lan}, relay=${snapshot.states.relay}.`,
        );
      }
      await sleep(200);
      snapshot = (await this.node.bearerSnapshot()) as LocalBearerSnapshot;
    }
    return snapshot;
  }

  // ---- messaging ----

  async validateAddress(text: string): Promise<boolean> {
    return this.factory.validateAddress(text);
  }

  /**
   * Send a text message and track its delivery. Resolves when the destination confirms (delivered)
   * or polling caps out (timedOut, with the last status). Throws SendError only when the core
   * refused the send outright.
   *
   * `hooks.onAccepted` fires the moment the core has taken the bundle and assigned it an id, before
   * any status polling. Callers persist the message there: a row written only after delivery
   * resolves would leave a sent message invisible for as long as the poll runs, and lost entirely
   * if the app were backgrounded mid-send.
   */
  async send(
    to: string,
    body: string | Uint8Array,
    hooks?: {
      onAccepted?: (id: string) => unknown;
      onUpdate?: (id: string, s: HopStatus) => unknown;
    },
    contentType?: string,
  ): Promise<SendOutcome> {
    const idBytes = await this.node.send({to, body, requestAck: true, contentType});
    if (idBytes == null) {
      throw new SendError(`Hop refused the send to ${to}. Is the address a full 32-byte Hop address?`);
    }
    const id = toBase64(idBytes);
    // The outbound row must exist before the first status snapshot is folded in. A fire-and-forget
    // onAccepted let applyDelivery no-op on a missing row, and when that first snapshot was already
    // delivered=true the poll loop never ran again, so sage never appeared.
    await hooks?.onAccepted?.(id);

    const history: HopStatus[] = [];
    let latest: HopStatus = await this.node.status(idBytes);
    history.push(latest);
    await hooks?.onUpdate?.(id, latest);

    for (let i = 0; i < this.statusPollTries && !latest.delivered; i += 1) {
      await sleep(this.statusPollMs);
      const next = await this.node.status(idBytes);
      if (
        next.relayed !== latest.relayed ||
        next.delivered !== latest.delivered ||
        next.forwardHops !== latest.forwardHops ||
        next.forwardMs !== latest.forwardMs
      ) {
        history.push(next);
        await hooks?.onUpdate?.(id, next);
      }
      latest = next;
    }

    return {id, delivered: latest.delivered, final: latest, timedOut: !latest.delivered, history};
  }

  /** Re-read the status of an earlier send, e.g. after the app returns to the foreground. */
  async statusOf(id: string): Promise<HopStatus> {
    return this.node.status(fromBase64(id));
  }

  // ---- channels (hps://) ----

  /**
   * Host a channel at `path`. A channel mints NO service signing key (every member writes under
   * their own identity), so success resolves an EMPTY key: empty and null are deliberately
   * different, and treating falsy as failure would report every successful create as an error.
   */
  async createChannel(
    path: string,
    access: 'open' | 'requestToJoin' | 'invite' = 'open',
  ): Promise<{path: string; host: string; access: string}> {
    const trimmed = path.trim();
    if (trimmed.length === 0) {
      throw new ChannelError('A channel needs a path.');
    }
    const key = await this.node.hpsRegister(trimmed, 'channel', access, 'private');
    if (key == null) {
      throw new ChannelError(`Hop refused to host a channel at ${trimmed}.`);
    }
    // Empty key (length 0) is the channel's success shape. Anything else would be a service's
    // broadcast key, which a channel does not have.
    return {path: trimmed, host: this.address, access};
  }

  /**
   * Ask to join `hps://{host}/{path}`. This is a REQUEST: the core resolves a bundle id here, but
   * membership begins when the host's keys arrive, which is a later event this call cannot see.
   * The UI shows "requested" until the topic appears in myChannels().
   */
  async joinChannel(host: string, path: string): Promise<void> {
    const trimmed = path.trim();
    if (trimmed.length === 0) {
      throw new ChannelError('A channel needs a path.');
    }
    if (!(await this.factory.validateAddress(host))) {
      throw new ChannelError('The host address is not a valid Hop address.');
    }
    const id = await this.node.hpsSubscribe(host, trimmed);
    if (id == null) {
      throw new ChannelError(`Hop refused the join request for ${trimmed}.`);
    }
  }

  /**
   * Publish to a channel we host or belong to. Resolves the base64 publication id once the core
   * has taken it. A group message is a single encrypted publication flooded once: there is no
   * per-recipient delivery state after this, and no status query, so this id is the receipt.
   */
  async publishChannel(path: string, body: string): Promise<string> {
    const id = await this.node.hpsPublish(path.trim(), body);
    if (id == null) {
      throw new ChannelError('Hop refused the publication. Do you still belong to this channel?');
    }
    return toBase64(id);
  }

  /** Leave a channel we follow, or retire one we host. */
  async leaveChannel(path: string): Promise<boolean> {
    return this.node.hpsLeave(path);
  }

  /** Every channel this node hosts or follows, read from the node's own store. */
  async myChannels(): Promise<SeamTopic[]> {
    const topics = await this.node.hpsMyTopics();
    return topics.map((t) => ({
      host: t.host,
      path: t.path,
      kind: t.kind as string,
      hosting: t.hosting,
      access: t.access as string,
    }));
  }

  /** For a channel we host: how many members have acked a publication. */
  async channelReach(path: string): Promise<number> {
    return this.node.hpsReach(path);
  }

  /** Host to contact: invite an address to a channel we host (the invite access mode). */
  async inviteToChannel(path: string, dest: string): Promise<void> {
    if (!(await this.factory.validateAddress(dest))) {
      throw new ChannelError('The invitee address is not a valid Hop address.');
    }
    const id = await this.node.hpsInvite(path.trim(), dest);
    if (id == null) {
      throw new ChannelError('Hop refused the invite.');
    }
  }

  /** Accept an invite we received: joins the channel once the host seals us the keys. */
  async acceptChannelInvite(host: string, path: string): Promise<void> {
    const id = await this.node.hpsAcceptInvite(host, path.trim());
    if (id == null) {
      throw new ChannelError('Hop refused the invite acceptance.');
    }
  }

  /** Decline an invite. Durable, so the host does not re-offer it. */
  async declineChannelInvite(host: string, path: string): Promise<boolean> {
    return this.node.hpsDeclineInvite(host, path.trim());
  }

  /** Host: approve a pending requester, which is what hands them the content key. */
  async approveChannelJoin(path: string, requester: string): Promise<void> {
    const id = await this.node.hpsApprove(path.trim(), requester);
    if (id == null) {
      throw new ChannelError('Hop refused the approval.');
    }
  }

  /** Host: deny a pending requester. No key is handed out. */
  async denyChannelJoin(path: string, requester: string): Promise<boolean> {
    return this.node.hpsDeny(path.trim(), requester);
  }

  /**
   * Host: remove members by rotating the content key and withholding it from them. This is what
   * revocation means in Hop: a removed member keeps whatever they already read and can decrypt
   * nothing published after the rotation. It is NOT an unsend, and the UI must not imply one.
   */
  async removeChannelMembers(path: string, remove: string[]): Promise<string[]> {
    const ids = await this.node.hpsRekey(path.trim(), '', remove);
    return ids.map((id) => toBase64(id));
  }

  /**
   * For a channel we host: the retained member set.
   *
   * This is the discriminator between the two ways a channel can look silent. A member here means
   * the host processed a join and handed over the content key, so silence afterwards is a routing
   * or delivery question. An EMPTY set means the join handoff never completed, and publication
   * routing is not implicated at all: a subscriber with no content key is silent even if every
   * publication arrives perfectly.
   */
  async channelMembers(path: string): Promise<string[]> {
    return this.node.hpsMembers(path);
  }

  /** For a requestToJoin channel we host: addresses waiting for approval. Empty for an open one. */
  async channelPending(path: string): Promise<string[]> {
    return this.node.hpsPending(path);
  }

  /**
   * Listen for inbound channel publications. The listener persists the message and resolves true
   * once it is on disk; resolving false withholds acceptance so the core redelivers.
   */
  onChannelMessage(cb: (m: SeamChannelMessage) => boolean | Promise<boolean>): () => void {
    this.channelMessageListeners.add(cb);
    return () => {
      this.channelMessageListeners.delete(cb);
    };
  }

  /**
   * Listen for invites. TAKE-AND-CLEAR at the core: a listener that does not persist what this
   * hands it loses the invite forever.
   */
  onChannelInvite(cb: (i: SeamChannelInvite) => void): () => void {
    this.channelInviteListeners.add(cb);
    return () => {
      this.channelInviteListeners.delete(cb);
    };
  }

  // ---- inbound routing ----

  onInbound(cb: (m: SeamInbound) => void | Promise<void>): () => void {
    this.inboundListeners.add(cb);
    return () => {
      this.inboundListeners.delete(cb);
    };
  }

  /** Reserve inbound traffic from one address for a seam-internal consumer (the path check). */
  routeInboundFrom(address: string, handler: (m: SeamInbound) => void): void {
    this.serviceRoutes.set(address, handler);
  }

  unrouteInboundFrom(address: string): void {
    this.serviceRoutes.delete(address);
  }

  private stopLocalPrekeyPublication(): void {
    if (this.localPrekeyTimer != null) {
      clearInterval(this.localPrekeyTimer);
      this.localPrekeyTimer = null;
    }
  }

  async close(): Promise<void> {
    this.serviceRoutes.clear();
    this.inboundListeners.clear();
    this.relayListeners.clear();
    this.stopLocalPrekeyPublication();
    if (this.relay != null) {
      await this.relay.close().catch(() => {});
      this.relay = null;
    }
    await this.node.stop();
    await this.node.close();
  }
}
