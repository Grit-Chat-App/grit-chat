// Channels: the store that keeps channel history honest, and the seam semantics that are silent
// bugs if gotten wrong. The three that matter most:
//   - hpsRegister on a CHANNEL resolves an EMPTY key (success); null is failure. Falsy-checking
//     that reports every successful create as an error.
//   - an inbound publication is accepted only after it is persisted; a refusal withholds the
//     accept so the core redelivers.
//   - an invite is take-and-clear upstream: the store must hold it the moment it arrives.

import {ChannelStore, SeamTopic} from '../src/store/channels';
import {GritSeam} from '../src/hop/seam';
import {IdentityStore, KeychainLike} from '../src/hop/identityStore';
import {memoryKv} from '../src/store/kv';

const ADDRESS = 'GrfdBYiMsvMvRFeZ4BVmRzXQ8sivHB4wYtQ9pKcTn3Ab';
const PEER = 'DwDmNvpnaZa95JLeHXbVBd5RUgUJWJkE2WB4RZKbRBv2';

// The seam tests' FakeNode, with the knobs the channel cases need.
class ChannelFakeNode {
  started = false;
  closed = false;
  registerReturns: Uint8Array | null = new Uint8Array(0);
  subscribeReturns: Uint8Array | null = new Uint8Array(32);
  publishReturns: Uint8Array | null = new Uint8Array(32).fill(7);
  registered: string[] = [];
  published: {path: string; body: string}[] = [];
  acceptedHps: number[] = [];
  topics: SeamTopic[] = [];
  pool = {total: 0, available: 0};
  next: string | null = null;
  relayAdds: {url: string; configured: boolean}[] = [];
  private hpsHandler: ((m: unknown) => void | Promise<void>) | null = null;
  private inviteHandler: ((i: unknown) => void) | null = null;

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
    return true;
  }
  async setName(): Promise<void> {}
  async send(): Promise<Uint8Array | null> {
    return null;
  }
  async status(): Promise<{relayed: number; delivered: boolean; forwardHops: number; forwardMs: number}> {
    return {relayed: 0, delivered: false, forwardHops: 0, forwardMs: 0};
  }
  async acceptInbox(): Promise<boolean> {
    return true;
  }
  onMessage(): {remove(): void} {
    return {remove: () => {}};
  }
  onOutgoing(): {remove(): void} {
    return {remove: () => {}};
  }
  async start(): Promise<void> {
    this.started = true;
  }
  async stop(): Promise<void> {}
  async close(): Promise<void> {
    this.closed = true;
  }
  async linkUp(): Promise<void> {}
  async linkDown(): Promise<void> {}
  async bytesReceived(): Promise<void> {}

  async relayAdd(url: string, configured: boolean): Promise<boolean> {
    this.relayAdds.push({url, configured});
    return true;
  }
  async relayNext(): Promise<string | null> {
    return this.next;
  }
  async relayReport(): Promise<void> {}
  async relayPool(): Promise<{total: number; available: number}> {
    return this.pool;
  }

  async hpsRegister(path: string): Promise<Uint8Array | null> {
    if (this.registerReturns == null) {
      return null;
    }
    this.registered.push(path);
    return this.registerReturns;
  }
  async hpsSubscribe(): Promise<Uint8Array | null> {
    return this.subscribeReturns;
  }
  async hpsPublish(path: string, body: string): Promise<Uint8Array | null> {
    if (this.publishReturns == null) {
      return null;
    }
    this.published.push({path, body});
    return this.publishReturns;
  }
  async acceptHpsMessage(id: Uint8Array): Promise<boolean> {
    this.acceptedHps.push(id.length);
    return true;
  }
  async hpsLeave(): Promise<boolean> {
    return true;
  }
  async hpsReach(): Promise<number> {
    return 2;
  }
  async hpsMyTopics(): Promise<SeamTopic[]> {
    return this.topics;
  }
  onHpsMessage(cb: (m: unknown) => void | Promise<void>): {remove(): void} {
    this.hpsHandler = cb;
    return {remove: () => {}};
  }
  onHpsInvite(cb: (i: unknown) => void): {remove(): void} {
    this.inviteHandler = cb;
    return {remove: () => {}};
  }

  // Test drivers: deliver an hps message / invite the way the pump would.
  async deliverHps(m: {id: Uint8Array; path: string; sender: string; body: Uint8Array}): Promise<void> {
    await this.hpsHandler?.(m);
  }
  deliverInvite(i: {host: string; path: string; kind: string}): void {
    this.inviteHandler?.(i);
  }
}

function keychain(): KeychainLike {
  // Carry the written value: the identity store PROVES its write by reading back, and a stub
  // that always reads null fails that proof by design.
  let stored: string | null = null;
  return {
    read: async () => stored,
    write: async (value: string) => {
      stored = value;
      return true;
    },
  };
}

async function seamWith(node: ChannelFakeNode): Promise<GritSeam> {
  return GritSeam.start({
    factory: {
      open: async () => node as never,
      ephemeral: async () => node as never,
      validateAddress: async (text: string) => text === ADDRESS || text === PEER,
    },
    identity: new IdentityStore(keychain()),
    kv: memoryKv(),
    documentsPath: '/tmp/grit-test',
    relayUrl: null,
    pumpIntervalMs: 5,
    statusPollMs: 1,
    statusPollTries: 2,
  });
}

function text(bytes: string): Uint8Array {
  return new Uint8Array([...bytes].map((c) => c.charCodeAt(0)));
}

describe('channel store', () => {
  it('reconciles the node topic list as the truth for membership', async () => {
    const store = new ChannelStore(memoryKv());
    await store.load();
    await store.addJoinRequested('camp-radio', ADDRESS);
    expect(store.channelByPath('camp-radio')?.joinedAt).toBeNull();

    const topics: SeamTopic[] = [
      {host: ADDRESS, path: 'camp-radio', kind: 'channel', hosting: false, access: 'open'},
    ];
    await store.reconcile(topics, 1234);
    // Keys arrived: the join is real now.
    expect(store.channelByPath('camp-radio')?.joinedAt).toBe(1234);

    await store.reconcile([], 2000);
    // The node no longer lists it (left or removed): the row goes.
    expect(store.channelByPath('camp-radio')).toBeUndefined();
  });

  it('ignores service topics: this store is channels only', async () => {
    const store = new ChannelStore(memoryKv());
    await store.load();
    await store.reconcile([
      {host: ADDRESS, path: 'feed', kind: 'service', hosting: true, access: 'open'},
    ]);
    expect(store.listChannels()).toHaveLength(0);
  });

  it('ignores a repeated publication id, because the core repeats until accepted', async () => {
    const store = new ChannelStore(memoryKv());
    await store.load();
    await store.addHosted('lobby', ADDRESS, 'open');
    const first = await store.appendInbound('lobby', PEER, 'gm', 'pub-1');
    const again = await store.appendInbound('lobby', PEER, 'gm', 'pub-1');
    expect(first).not.toBeNull();
    expect(again?.id).toBe('pub-1');
    expect(store.messagesFor('lobby')).toHaveLength(1);
  });

  it('persists an invite the moment it arrives, because upstream is take-and-clear', async () => {
    const store = new ChannelStore(memoryKv());
    await store.load();
    await store.addInvite(ADDRESS, 'vip', 'channel');
    await store.addInvite(ADDRESS, 'vip', 'channel');
    expect(store.listInvites()).toHaveLength(1);

    // Same kv: the invite survives a restart, which is the whole point of writing it immediately.
    const kv = memoryKv();
    const persisted = new ChannelStore(kv);
    await persisted.load();
    await persisted.addInvite(ADDRESS, 'vip', 'channel');
    const reloaded = new ChannelStore(kv);
    await reloaded.load();
    expect(reloaded.listInvites()).toHaveLength(1);
  });
});

describe('seam channels', () => {
  it('treats an EMPTY register key as success, because a channel has no service key', async () => {
    const node = new ChannelFakeNode();
    const seam = await seamWith(node);
    node.registerReturns = new Uint8Array(0);
    const created = await seam.createChannel('lobby');
    expect(created.path).toBe('lobby');
    expect(created.host).toBe(ADDRESS);
    expect(node.registered).toContain('lobby');
  });

  it('throws on a null register, which is the real failure shape', async () => {
    const node = new ChannelFakeNode();
    const seam = await seamWith(node);
    node.registerReturns = null;
    await expect(seam.createChannel('lobby')).rejects.toThrow(/refused to host/);
  });

  it('refuses a join whose host is not a valid address', async () => {
    const node = new ChannelFakeNode();
    const seam = await seamWith(node);
    await expect(seam.joinChannel('not-an-address', 'lobby')).rejects.toThrow(/valid Hop address/);
  });

  it('returns the publication id as the receipt, and throws when the core refuses', async () => {
    const node = new ChannelFakeNode();
    const seam = await seamWith(node);
    const id = await seam.publishChannel('lobby', 'gm all');
    expect(id.length).toBeGreaterThan(0);
    node.publishReturns = null;
    await expect(seam.publishChannel('lobby', 'gm all')).rejects.toThrow(/refused the publication/);
  });

  it('accepts an hps message only after the listener persisted it', async () => {
    const node = new ChannelFakeNode();
    const seam = await seamWith(node);
    const seen: string[] = [];
    seam.onChannelMessage((m) => {
      seen.push(m.body);
      return true;
    });
    await node.deliverHps({
      id: new Uint8Array(32).fill(1),
      path: 'lobby',
      sender: PEER,
      body: text('gm'),
    });
    expect(seen).toEqual(['gm']);
    expect(node.acceptedHps).toHaveLength(1);
  });

  it('withholds the accept when a listener refuses, so the core redelivers', async () => {
    const node = new ChannelFakeNode();
    const seam = await seamWith(node);
    seam.onChannelMessage(() => false);
    await node.deliverHps({
      id: new Uint8Array(32).fill(2),
      path: 'unknown-channel',
      sender: PEER,
      body: text('gm'),
    });
    expect(node.acceptedHps).toHaveLength(0);
  });

  it('hands invites to listeners: the arrival handler is the only chance to persist', async () => {
    const node = new ChannelFakeNode();
    const seam = await seamWith(node);
    const got: {host: string; path: string}[] = [];
    seam.onChannelInvite((invite) => {
      got.push({host: invite.host, path: invite.path});
    });
    node.deliverInvite({host: ADDRESS, path: 'vip', kind: 'channel'});
    expect(got).toEqual([{host: ADDRESS, path: 'vip'}]);
  });

  it('adds the configured relay to the pool as a configured, never-demoted endpoint', async () => {
    const node = new ChannelFakeNode();
    await GritSeam.start({
      factory: {
        open: async () => node as never,
        ephemeral: async () => node as never,
        validateAddress: async () => true,
      },
      identity: new IdentityStore(keychain()),
      kv: memoryKv(),
      documentsPath: '/tmp/grit-test',
      relayUrl: 'ws://127.0.0.1:18765/',
      pumpIntervalMs: 5,
      statusPollMs: 1,
      statusPollTries: 2,
    });
    expect(node.relayAdds).toEqual([{url: 'ws://127.0.0.1:18765/', configured: true}]);
  });

  it('myChannels passes the node topic list through unchanged', async () => {
    const node = new ChannelFakeNode();
    const seam = await seamWith(node);
    node.topics = [{host: ADDRESS, path: 'lobby', kind: 'channel', hosting: true, access: 'open'}];
    expect(await seam.myChannels()).toEqual(node.topics);
  });
});
