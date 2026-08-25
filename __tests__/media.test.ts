// Media plumbing: the store keeps media fields through a reload, the seam hands the content
// type and raw bytes to the core without touching them, and inbound media is NEVER utf8-decoded
// (that path would corrupt a JPEG into replacement characters; it is the exact bug the decode
// was split to prevent).

import {isMedia, mediaExtension} from '../src/hop/media';
import {ConversationStore} from '../src/store/conversations';
import {GritSeam} from '../src/hop/seam';
import {IdentityStore, KeychainLike} from '../src/hop/identityStore';
import {memoryKv} from '../src/store/kv';

const ADDR_A = 'GrfdBYiMsvMvRFeZ4BVmRzXQ8sivHB4wYtQ9pKcTn3Ab';

describe('media vocabulary', () => {
  it('maps the types this app sends to extensions', () => {
    expect(mediaExtension('image/jpeg')).toBe('jpg');
    expect(mediaExtension('image/png')).toBe('png');
    expect(mediaExtension('audio/m4a')).toBe('m4a');
    expect(mediaExtension('audio/mp4')).toBe('m4a');
    expect(mediaExtension('application/pdf')).toBe('bin');
  });

  it('treats image and audio as media and nothing else', () => {
    expect(isMedia('image/jpeg')).toBe(true);
    expect(isMedia('audio/m4a')).toBe(true);
    expect(isMedia('text/plain')).toBe(false);
    expect(isMedia(undefined)).toBe(false);
  });
});

describe('store media rows', () => {
  it('keeps content type, media uri and duration through a reload', async () => {
    const kv = memoryKv();
    const store = new ConversationStore(kv);
    await store.load();
    await store.addContact(ADDR_A);
    await store.appendOutbound(ADDR_A, '', 'img-1', {
      contentType: 'image/jpeg',
      mediaUri: 'file:///tmp/picked.jpg',
    });
    await store.appendInbound(ADDR_A, '', 2, 'aud-1', 1000, 'audio/m4a', 'file:///tmp/grit-media/aud-1.m4a');

    const reloaded = new ConversationStore(kv);
    await reloaded.load();
    const rows = reloaded.messagesFor(ADDR_A);
    expect(rows).toHaveLength(2);
    // Reload sorts by timestamp, not insertion order; match by id instead.
    const image = rows.find((m) => m.id === 'img-1');
    const audio = rows.find((m) => m.id === 'aud-1');
    expect(image?.contentType).toBe('image/jpeg');
    expect(image?.mediaUri).toBe('file:///tmp/picked.jpg');
    expect(audio?.contentType).toBe('audio/m4a');
    expect(audio?.mediaUri).toBe('file:///tmp/grit-media/aud-1.m4a');
  });
});

describe('seam media handling', () => {
  function keychain(): KeychainLike {
    let stored: string | null = null;
    return {
      read: async () => stored,
      write: async (value: string) => {
        stored = value;
        return true;
      },
    };
  }

  class MediaFakeNode {
    sent: {to: string; contentType?: string; body: unknown}[] = [];
    private handler: ((m: unknown) => void | Promise<void>) | null = null;
    async address(): Promise<string> {
      return ADDR_A;
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
    async send(opts: {to: string; contentType?: string; body: unknown; requestAck?: boolean}): Promise<Uint8Array | null> {
      this.sent.push({to: opts.to, contentType: opts.contentType, body: opts.body});
      return new Uint8Array(32).fill(5);
    }
    async status(): Promise<{relayed: number; delivered: boolean; forwardHops: number; forwardMs: number}> {
      return {relayed: 1, delivered: true, forwardHops: 2, forwardMs: 10};
    }
    async acceptInbox(): Promise<boolean> {
      return true;
    }
    onMessage(cb: (m: unknown) => void | Promise<void>): {remove(): void} {
      this.handler = cb;
      return {remove: () => {}};
    }
    onOutgoing(): {remove(): void} {
      return {remove: () => {}};
    }
    onHpsMessage(): {remove(): void} {
      return {remove: () => {}};
    }
    onHpsInvite(): {remove(): void} {
      return {remove: () => {}};
    }
    async start(): Promise<void> {}
    async stop(): Promise<void> {}
    async close(): Promise<void> {}
    async linkUp(): Promise<void> {}
    async linkDown(): Promise<void> {}
    async bytesReceived(): Promise<void> {}
    async relayAdd(): Promise<boolean> {
      return true;
    }
    async relayNext(): Promise<string | null> {
      return null;
    }
    async relayReport(): Promise<void> {}
    async relayPool(): Promise<{total: number; available: number}> {
      return {total: 0, available: 0};
    }
    async hpsMyTopics(): Promise<never[]> {
      return [];
    }

    async deliver(m: unknown): Promise<void> {
      await this.handler?.(m);
    }
  }

  async function seamWith(node: MediaFakeNode): Promise<GritSeam> {
    return GritSeam.start({
      factory: {
        open: async () => node as never,
        ephemeral: async () => node as never,
        validateAddress: async () => true,
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

  it('hands the content type and the bytes to the core unchanged', async () => {
    const node = new MediaFakeNode();
    const seam = await seamWith(node);
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // a JPEG header, not text
    await seam.send(ADDR_A, bytes, undefined, 'image/jpeg');
    expect(node.sent).toHaveLength(1);
    expect(node.sent[0].contentType).toBe('image/jpeg');
    expect(node.sent[0].body).toBe(bytes);
  });

  it('keeps inbound media bytes raw and never utf8-decodes them', async () => {
    const node = new MediaFakeNode();
    const seam = await seamWith(node);
    const seen: {body: string; contentType: string; bodyBytes?: Uint8Array}[] = [];
    seam.onInbound((m) => {
      seen.push(m);
    });
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    await node.deliver({
      id: new Uint8Array(32).fill(9),
      from: ADDR_A,
      contentType: 'image/jpeg',
      body: jpeg,
      hops: 2,
      createdAt: 1000,
    });
    expect(seen).toHaveLength(1);
    expect(seen[0].contentType).toBe('image/jpeg');
    expect(seen[0].bodyBytes).toBe(jpeg);
    // The text body is empty for media: nothing here passed through the decoder.
    expect(seen[0].body).toBe('');
  });

  it('decodes text as text, so the two paths cannot drift into each other', async () => {
    const node = new MediaFakeNode();
    const seam = await seamWith(node);
    const seen: {body: string; contentType: string; bodyBytes?: Uint8Array}[] = [];
    seam.onInbound((m) => {
      seen.push(m);
    });
    await node.deliver({
      id: new Uint8Array(32).fill(3),
      from: ADDR_A,
      contentType: 'text/plain',
      body: new Uint8Array([0x67, 0x6d]), // "gm"
      hops: 1,
      createdAt: 1000,
    });
    expect(seen[0].body).toBe('gm');
    expect(seen[0].bodyBytes).toBeUndefined();
  });
});
