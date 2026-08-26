// The seam is the only thing in this app that talks to Hop, so these tests drive it against a fake
// node and assert the orderings and refusals that are load-bearing:
//   - a first launch persists the minted identity, and startup FAILS if that cannot be proven
//   - a later launch restores the saved secret rather than minting a new one
//   - inbound messages are accepted, or the core repeats them forever
//   - send reports what the core said, including "not delivered", and never invents a confirmation
//   - an unconfigured relay is a state, never a default endpoint

import {GritSeam, SendError, resolveRelayUrl} from '../src/hop/seam';
import {IdentityStore, KeychainLike} from '../src/hop/identityStore';
import {memoryKv} from '../src/store/kv';

const ADDRESS = 'GrfdBYiMsvMvRFeZ4BVmRzXQ8sivHB4wYtQ9pKcTn3Ab';
const SECRET_B64 = 'c2VjcmV0LWJ5dGVzLWhlcmUtdGhpcnR5LXR3bw==';

interface FakeStatus {
  relayed: number;
  delivered: boolean;
  forwardHops: number;
  forwardMs: number;
}

interface FakeNodeOptions {
  statuses?: FakeStatus[];
  sendReturnsNull?: boolean;
}

class FakeNode {
  started = false;
  pumpInterval = 0;
  closed = false;
  prekeyPublished = false;
  accepted: string[] = [];
  sent: {to: string; body: string; requestAck: boolean}[] = [];
  linkUps: {link: number; role: string}[] = [];
  messageHandler: ((m: unknown) => void | Promise<void>) | null = null;
  private statusReads = 0;

  constructor(private readonly options: FakeNodeOptions = {}) {}

  async address(): Promise<string> {
    return ADDRESS;
  }
  async secret(): Promise<Uint8Array> {
    return new Uint8Array([1, 2, 3, 4]);
  }
  async isPersistent(): Promise<boolean> {
    return true;
  }
  async publishPrekey(): Promise<boolean> {
    this.prekeyPublished = true;
    return true;
  }
  async setName(): Promise<void> {}
  async send(opts: {to: string; body: string; requestAck?: boolean}): Promise<Uint8Array | null> {
    this.sent.push({to: opts.to, body: opts.body, requestAck: opts.requestAck === true});
    return this.options.sendReturnsNull === true ? null : new Uint8Array([9, 9, 9]);
  }
  async status(): Promise<FakeStatus> {
    const list = this.options.statuses ?? [
      {relayed: 1, delivered: true, forwardHops: 2, forwardMs: 42},
    ];
    const at = Math.min(this.statusReads, list.length - 1);
    this.statusReads += 1;
    return list[at];
  }
  async acceptInbox(id: Uint8Array): Promise<boolean> {
    this.accepted.push(String(id));
    return true;
  }
  onMessage(cb: (m: unknown) => void | Promise<void>): {remove(): void} {
    this.messageHandler = cb;
    return {remove: () => {}};
  }
  onOutgoing(): {remove(): void} {
    return {remove: () => {}};
  }
  async start(intervalMs: number): Promise<void> {
    this.started = true;
    this.pumpInterval = intervalMs;
  }
  async stop(): Promise<void> {
    this.started = false;
  }
  async close(): Promise<void> {
    this.closed = true;
  }
  async linkUp(link: number, role: string): Promise<void> {
    this.linkUps.push({link, role});
  }
  async linkDown(): Promise<void> {}
  async bytesReceived(): Promise<void> {}

  // ---- hps:// + relay pool (the ABI 6 bridge surface) ----
  registered: {path: string; kind: string; access: string; visibility: string}[] = [];
  subscribed: {host: string; path: string}[] = [];
  published: {path: string; body: string}[] = [];
  leftPaths: string[] = [];
  relayAdds: {url: string; configured: boolean}[] = [];
  relayReports: {url: string; ok: boolean}[] = [];
  poolValue = {total: 0, available: 0};
  nextValue: string | null = null;
  hpsHandler: ((m: unknown) => void | Promise<void>) | null = null;
  inviteHandler: ((i: unknown) => void) | null = null;

  async relayAdd(url: string, configured: boolean): Promise<boolean> {
    this.relayAdds.push({url, configured});
    return true;
  }
  async relayNext(): Promise<string | null> {
    return this.nextValue;
  }
  async relayReport(url: string, ok: boolean): Promise<void> {
    this.relayReports.push({url, ok});
  }
  async relayPool(): Promise<{total: number; available: number}> {
    return this.poolValue;
  }
  async hpsRegister(path: string, kind: string, access: string, visibility: string): Promise<Uint8Array | null> {
    this.registered.push({path, kind, access, visibility});
    // The real ABI: an EMPTY key is a channel's success (no service signing key); null is failure.
    return new Uint8Array(0);
  }
  async hpsSubscribe(host: string, path: string): Promise<Uint8Array | null> {
    this.subscribed.push({host, path});
    return new Uint8Array(32);
  }
  async hpsPublish(path: string, body: string): Promise<Uint8Array | null> {
    this.published.push({path, body});
    return new Uint8Array(32).fill(7);
  }
  async acceptHpsMessage(): Promise<boolean> {
    return true;
  }
  async hpsInvite(): Promise<Uint8Array | null> {
    return new Uint8Array(32);
  }
  async hpsAcceptInvite(): Promise<Uint8Array | null> {
    return new Uint8Array(32);
  }
  async hpsDeclineInvite(): Promise<boolean> {
    return true;
  }
  async hpsLeave(path: string): Promise<boolean> {
    this.leftPaths.push(path);
    return true;
  }
  async hpsPending(): Promise<string[]> {
    return [];
  }
  async hpsApprove(): Promise<Uint8Array | null> {
    return new Uint8Array(32);
  }
  async hpsDeny(): Promise<boolean> {
    return true;
  }
  async hpsRekey(): Promise<string[]> {
    return [];
  }
  async hpsReach(): Promise<number> {
    return 0;
  }
  async hpsMembers(): Promise<string[]> {
    return [];
  }
  async hpsMyTopics(): Promise<
    {host: string; path: string; kind: string; hosting: boolean; access: string}[]
  > {
    return this.registered.map((r) => ({
      host: ADDRESS,
      path: r.path,
      kind: r.kind,
      hosting: true,
      access: r.access,
    }));
  }
  async hpsBrowse(): Promise<unknown[]> {
    return [];
  }
  onHpsMessage(cb: (m: unknown) => void | Promise<void>): {remove(): void} {
    this.hpsHandler = cb;
    return {remove: () => {}};
  }
  onHpsInvite(cb: (i: unknown) => void): {remove(): void} {
    this.inviteHandler = cb;
    return {remove: () => {}};
  }
}

function keychain(seed: string | null): KeychainLike & {stored: string | null} {
  const state = {
    stored: seed,
    async read() {
      return state.stored;
    },
    async write(secret: string) {
      state.stored = secret;
      return true;
    },
  };
  return state;
}

function deps(node: FakeNode, chain: KeychainLike, relayUrl: string | null = null) {
  return {
    factory: {
      open: async () => node as never,
      ephemeral: async () => node as never,
      validateAddress: async (text: string) => text === ADDRESS,
    },
    identity: new IdentityStore(chain),
    kv: memoryKv(),
    documentsPath: '/tmp/grit-test',
    relayUrl,
    pumpIntervalMs: 5,
    // Small on purpose: these tests must be able to reach the bounded-wait boundary, and the
    // production budget of about thirty seconds is not a thing to spend in a unit test.
    statusPollMs: 1,
    statusPollTries: 3,
  };
}

describe('starting the node', () => {
  it('persists a minted identity, defers the prekey until a link exists, starts the pump', async () => {
    const node = new FakeNode();
    const chain = keychain(null);
    const seam = await GritSeam.start(deps(node, chain));

    expect(chain.stored).not.toBeNull();
    // Publishing before any link was measured to leave the prekey absent from the relay's
    // directory, which made every delivery to this node unconfirmable. It now fires on relay 'up',
    // so at startup, with no link, it must not have happened.
    expect(node.prekeyPublished).toBe(false);
    expect(seam.prekeyPublished).toBe(false);
    expect(node.started).toBe(true);
    expect(seam.address).toBe(ADDRESS);
    // A listener must exist before the pump runs, or the first inbound message is lost.
    expect(node.messageHandler).not.toBeNull();
  });

  it('restores a saved secret instead of minting a new identity', async () => {
    const node = new FakeNode();
    const chain = keychain(SECRET_B64);
    await GritSeam.start(deps(node, chain));
    expect(chain.stored).toBe(SECRET_B64);
  });

  it('fails startup and closes the node when the identity cannot be persisted', async () => {
    const node = new FakeNode();
    const refusing: KeychainLike = {read: async () => null, write: async () => false};
    // Continuing here is what silently orphans every saved contact on the next launch.
    await expect(GritSeam.start(deps(node, refusing))).rejects.toThrow(/refused the identity write/);
    expect(node.closed).toBe(true);
  });

  it('reports an unconfigured relay as its own state rather than dialing something', async () => {
    const seam = await GritSeam.start(deps(new FakeNode(), keychain(null), null));
    expect(seam.relayUrl()).toBeNull();
    expect(seam.relayState().state).toBe('unconfigured');
  });
});

describe('inbound messages', () => {
  it('decodes, dispatches, then accepts so the core stops repeating the item', async () => {
    const node = new FakeNode();
    const seam = await GritSeam.start(deps(node, keychain(null)));
    const seen: {from: string; body: string; hops: number}[] = [];
    seam.onInbound((m) => {
      seen.push({from: m.from, body: m.body, hops: m.hops});
    });

    // The seam's handler is async and returns its promise, so the test awaits the real signal
    // rather than sleeping for a guessed duration.
    await node.messageHandler?.({
      id: new Uint8Array([7]),
      from: 'peer-address',
      contentType: 'text/plain',
      body: new Uint8Array([104, 105]),
      hops: 2,
      createdAt: 1234,
    });

    expect(seen).toEqual([{from: 'peer-address', body: 'hi', hops: 2}]);
    expect(node.accepted).toHaveLength(1);
  });

  it('withholds acknowledgement until an async inbound write finishes', async () => {
    const node = new FakeNode();
    const seam = await GritSeam.start(deps(node, keychain(null)));
    const persisted = Promise.withResolvers<void>();
    let stored = false;
    seam.onInbound(async () => {
      await persisted.promise;
      stored = true;
    });

    const delivery = node.messageHandler?.({
      id: new Uint8Array([8]),
      from: 'profile-sender',
      contentType: 'application/vnd.grit-chat.profile+json',
      body: new Uint8Array([123, 125]),
      hops: 1,
      createdAt: 2,
    });
    await Promise.resolve();
    expect(node.accepted).toHaveLength(0);
    persisted.resolve();
    await delivery;
    expect(stored).toBe(true);
    expect(node.accepted).toHaveLength(1);
  });

  it('routes a reserved address away from the app listeners', async () => {
    const node = new FakeNode();
    const seam = await GritSeam.start(deps(node, keychain(null)));
    const app: string[] = [];
    const service: string[] = [];
    seam.onInbound((m) => {
      app.push(m.body);
    });
    seam.routeInboundFrom('service-address', (m) => service.push(m.body));

    await node.messageHandler?.({
      id: new Uint8Array([1]),
      from: 'service-address',
      contentType: 'text/plain',
      body: new Uint8Array([111, 107]),
      hops: 1,
      createdAt: 1,
    });

    expect(service).toEqual(['ok']);
    expect(app).toEqual([]);
  });
});

describe('sending', () => {
  it('asks for an acknowledgement and reports the delivery the core confirmed', async () => {
    const node = new FakeNode();
    const seam = await GritSeam.start(deps(node, keychain(null)));
    const updates: number[] = [];
    let acceptedId: string | null = null;

    const outcome = await seam.send(ADDRESS, 'meet at dawn', {
      onAccepted: (id) => {
        acceptedId = id;
      },
      onUpdate: (_id, s) => updates.push(s.forwardHops),
    });

    expect(node.sent[0].requestAck).toBe(true);
    // The id must reach the caller before polling, so a message can be stored the moment it exists.
    expect(acceptedId).not.toBeNull();
    expect(outcome.delivered).toBe(true);
    expect(outcome.final.forwardHops).toBe(2);
    expect(outcome.timedOut).toBe(false);
    expect(updates.length).toBeGreaterThan(0);
  });

  it('reports relayed progress and a timeout rather than claiming delivery', async () => {
    const node = new FakeNode({
      statuses: [{relayed: 2, delivered: false, forwardHops: 0, forwardMs: 0}],
    });
    const seam = await GritSeam.start(deps(node, keychain(null)));
    const outcome = await seam.send(ADDRESS, 'hello');

    expect(outcome.delivered).toBe(false);
    expect(outcome.timedOut).toBe(true);
    expect(outcome.final.relayed).toBe(2);
  });

  it('throws when the core refuses the send outright', async () => {
    const node = new FakeNode({sendReturnsNull: true});
    const seam = await GritSeam.start(deps(node, keychain(null)));
    await expect(seam.send('not-an-address', 'hello')).rejects.toThrow(SendError);
  });
});

describe('relay endpoint resolution', () => {
  it('prefers a saved endpoint over build-time config', () => {
    expect(resolveRelayUrl('ws://saved/', 'ws://config/')).toBe('ws://saved/');
  });

  it('falls back to config only when nothing has been saved', () => {
    expect(resolveRelayUrl(null, 'ws://config/')).toBe('ws://config/');
  });

  it('keeps an endpoint the user cleared cleared, even when config has one', () => {
    // Re-dialing a host somebody deliberately removed would misreport where messages go.
    expect(resolveRelayUrl('', 'ws://config/')).toBeNull();
    expect(resolveRelayUrl('   ', 'ws://config/')).toBeNull();
  });

  it('has no default at all when neither exists', () => {
    expect(resolveRelayUrl(null, null)).toBeNull();
  });
});
