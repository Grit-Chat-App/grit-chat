// The conversation store is what stands between a sent message and a message the user believes they
// sent. These tests cover the properties that matter when the app is killed, backgrounded, or fed the
// same inbox item twice by the core.

import {ConversationStore, shortAddress} from '../src/store/conversations';
import {KeyValueStore, memoryKv} from '../src/store/kv';

const ADDR_A = 'GrfdBYiMsvMvRFeZ4BVmRzXQ8sivHB4wYtQ9pKcTn3Ab';
const ADDR_B = 'DwDmNvpnaZa95JLeHXbVBd5RUgUJWJkE2WB4RZKbRBv2';

async function loadedStore(): Promise<{store: ConversationStore; kv: KeyValueStore}> {
  const kv = memoryKv();
  const store = new ConversationStore(kv);
  await store.load();
  return {store, kv};
}

describe('using the store before load', () => {
  it('throws instead of reporting an empty history', async () => {
    const store = new ConversationStore(memoryKv());
    // An empty list here would read to a user as "your messages are gone".
    expect(() => store.conversations()).toThrow(/load\(\) must complete/);
  });
});

describe('contacts', () => {
  it('creates an address-only contact when no local name is given', async () => {
    const {store} = await loadedStore();
    const {added, contact} = await store.addContact(ADDR_A);
    expect(added).toBe(true);
    expect(contact.localAlias).toBeUndefined();
    expect(store.displayNameFor(ADDR_A)).toBe(shortAddress(ADDR_A));
  });

  it('updates a local alias without creating a second conversation', async () => {
    const {store} = await loadedStore();
    await store.addContact(ADDR_A, 'Ada');
    const second = await store.addContact(ADDR_A, 'Ada Lovelace');
    expect(second.added).toBe(false);
    expect(store.conversations()).toHaveLength(1);
    expect(store.displayNameFor(ADDR_A)).toBe('Ada Lovelace');
  });

  it('uses an accepted shared name only when the recipient has no local alias', async () => {
    const {store} = await loadedStore();
    await store.addContact(ADDR_A);
    await store.stageProfile(ADDR_A, {
      name: 'Lyra',
      contact: 'lyra@example.test',
      revision: 1,
      receivedAt: 10,
      messageId: 'profile-1',
    });
    await store.acceptPendingProfile(ADDR_A);
    expect(store.displayNameFor(ADDR_A)).toBe('Lyra');

    await store.setLocalAlias(ADDR_A, 'Camp radio');
    expect(store.displayNameFor(ADDR_A)).toBe('Camp radio');
    expect(store.contactByAddress(ADDR_A)?.sharedProfile?.name).toBe('Lyra');
  });

  it('keeps a local alias when a newer sender profile is accepted', async () => {
    const {store} = await loadedStore();
    await store.addContact(ADDR_A, 'Local name');
    await store.stageProfile(ADDR_A, {
      name: 'Sender name',
      revision: 3,
      receivedAt: 20,
      messageId: 'profile-3',
    });
    await store.acceptPendingProfile(ADDR_A);
    expect(store.displayNameFor(ADDR_A)).toBe('Local name');
    expect(store.contactByAddress(ADDR_A)?.localAlias).toBe('Local name');
  });

  it('rejects a pending profile without changing an accepted profile or local alias', async () => {
    const {store} = await loadedStore();
    await store.addContact(ADDR_A, 'Local name');
    await store.stageProfile(ADDR_A, {name: 'Ignored', revision: 1, receivedAt: 10, messageId: 'profile-1'});
    await store.rejectPendingProfile(ADDR_A);
    expect(store.contactByAddress(ADDR_A)?.pendingProfile).toBeUndefined();
    expect(store.contactByAddress(ADDR_A)?.sharedProfile).toBeUndefined();
    expect(store.displayNameFor(ADDR_A)).toBe('Local name');
  });

  it('migrates legacy labels to local aliases and persists the normalized record', async () => {
    const kv = memoryKv({
      'grit.contacts.v1': JSON.stringify([
        {address: ADDR_A, label: 'Old local name', createdAt: 1},
        {address: ADDR_B, label: shortAddress(ADDR_B), createdAt: 2},
      ]),
      'grit.messages.v1': '[]',
    });
    const store = new ConversationStore(kv);
    await store.load();
    expect(store.contactByAddress(ADDR_A)?.localAlias).toBe('Old local name');
    expect(store.contactByAddress(ADDR_B)?.localAlias).toBeUndefined();
    const saved = JSON.parse((await kv.getItem('grit.contacts.v1')) ?? '[]') as Array<Record<string, unknown>>;
    expect(saved[0].label).toBeUndefined();
    expect(saved[0].localAlias).toBe('Old local name');
  });
});

describe('messages', () => {
  it('persists through the kv seam so history survives a restart', async () => {
    const {store, kv} = await loadedStore();
    await store.addContact(ADDR_A, 'Ada');
    await store.appendOutbound(ADDR_A, 'meet at the trash fence', 'bundle-1');

    const reopened = new ConversationStore(kv);
    await reopened.load();
    const messages = reopened.messagesFor(ADDR_A);
    expect(messages).toHaveLength(1);
    expect(messages[0].body).toBe('meet at the trash fence');
    expect(messages[0].sendState).toBe('sending');
  });

  it('folds a delivery snapshot into the message it belongs to', async () => {
    const {store} = await loadedStore();
    await store.addContact(ADDR_A);
    await store.appendOutbound(ADDR_A, 'hello', 'bundle-1');
    await store.applyDelivery('bundle-1', {
      relayed: 1,
      delivered: true,
      forwardHops: 2,
      forwardMs: 84,
    });

    const [message] = store.messagesFor(ADDR_A);
    expect(message.sendState).toBe('delivered');
    expect(message.forwardHops).toBe(2);
    expect(message.relayed).toBe(1);
  });

  it('does not let an earlier snapshot overwrite a confirmed delivery', async () => {
    const {store} = await loadedStore();
    await store.addContact(ADDR_A);
    await store.appendOutbound(ADDR_A, 'hello', 'bundle-1');
    await store.applyDelivery('bundle-1', {
      relayed: 1,
      delivered: true,
      forwardHops: 2,
      forwardMs: 84,
    });
    await store.applyDelivery('bundle-1', {
      relayed: 0,
      delivered: false,
      forwardHops: 0,
      forwardMs: 0,
    });
    const [message] = store.messagesFor(ADDR_A);
    expect(message.sendState).toBe('delivered');
    expect(message.forwardHops).toBe(2);
    expect(message.relayed).toBe(1);
  });

  it('records relayed progress without claiming delivery', async () => {
    const {store} = await loadedStore();
    await store.addContact(ADDR_A);
    await store.appendOutbound(ADDR_A, 'hello', 'bundle-1');
    await store.applyDelivery('bundle-1', {
      relayed: 2,
      delivered: false,
      forwardHops: 0,
      forwardMs: 0,
    });

    const [message] = store.messagesFor(ADDR_A);
    expect(message.sendState).toBe('sent');
    expect(message.delivered).toBe(false);
  });

  it('collapses a repeated outbound id on load so the list cannot render a duplicate key', async () => {
    const kv = memoryKv();
    await kv.setItem(
      'grit.messages.v1',
      JSON.stringify([
        {
          id: 'same',
          contact: ADDR_A,
          direction: 'out',
          body: 'hello',
          at: 1000,
          sendState: 'sent',
          relayed: 1,
          delivered: false,
        },
        {
          id: 'same',
          contact: ADDR_A,
          direction: 'out',
          body: 'hello',
          at: 2000,
          sendState: 'sending',
        },
      ]),
    );
    await kv.setItem(
      'grit.contacts.v1',
      JSON.stringify([{address: ADDR_A, label: 'a', createdAt: 1}]),
    );
    const store = new ConversationStore(kv);
    await store.load();
    const rows = store.messagesFor(ADDR_A);
    expect(rows).toHaveLength(1);
    expect(rows[0].sendState).toBe('sent');
    expect(rows[0].relayed).toBe(1);
    expect(rows[0].at).toBe(1000);
  });

  it('reset drops every contact and message', async () => {
    const {store} = await loadedStore();
    await store.addContact(ADDR_A);
    await store.appendOutbound(ADDR_A, 'hello', 'bundle-1');
    await store.reset();
    expect(store.conversations()).toHaveLength(0);
    expect(store.messagesFor(ADDR_A)).toHaveLength(0);
  });

  it('ignores a repeated inbox id, because the core repeats items until accepted', async () => {
    const {store} = await loadedStore();
    const first = await store.appendInbound(ADDR_B, 'dust storm', 2, 'inbox-1', 1000);
    const again = await store.appendInbound(ADDR_B, 'dust storm', 2, 'inbox-1', 1000);
    expect(first).not.toBeNull();
    expect(again).toBeNull();
    expect(store.messagesFor(ADDR_B)).toHaveLength(1);
  });

  it('never downgrades a delivered message to failed', async () => {
    const {store} = await loadedStore();
    await store.addContact(ADDR_A);
    await store.appendOutbound(ADDR_A, 'hello', 'bundle-1');
    await store.applyDelivery('bundle-1', {
      relayed: 1,
      delivered: true,
      forwardHops: 2,
      forwardMs: 10,
    });
    await store.markFailed('bundle-1');
    expect(store.messagesFor(ADDR_A)[0].sendState).toBe('delivered');
  });
});

describe('conversation list', () => {
  it('orders by most recent activity and counts unread inbound only', async () => {
    const {store} = await loadedStore();
    await store.addContact(ADDR_A, 'Ada');
    await store.addContact(ADDR_B, 'Bob');
    await store.appendOutbound(ADDR_A, 'first', 'bundle-1');
    await store.appendInbound(ADDR_B, 'later', 1, 'inbox-1', Date.now() + 5000);

    const list = store.conversations();
    expect(list[0].contact.address).toBe(ADDR_B);
    expect(list[0].unread).toBe(1);
    expect(list[1].unread).toBe(0);

    await store.markRead(ADDR_B);
    expect(store.conversations()[0].unread).toBe(0);
  });
});

describe('short address', () => {
  it('keeps both ends so two addresses cannot be confused', () => {
    const short = shortAddress(ADDR_A);
    expect(short.startsWith(ADDR_A.slice(0, 6))).toBe(true);
    expect(short.endsWith(ADDR_A.slice(-5))).toBe(true);
  });

  it('leaves an already short string alone', () => {
    expect(shortAddress('abc')).toBe('abc');
  });
});
