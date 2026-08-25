// The local conversation store: contacts, messages, delivery state, and read state, persisted
// through the KV seam so history survives restart and backgrounding. Every mutation awaits its
// write before resolving: a message that "sent" but never landed on disk is a message the user
// believes they sent and the app cannot prove.

import {KeyValueStore} from './kv';

export interface Contact {
  /** The conversation key IS the peer's base58 address. One conversation per address. */
  address: string;
  /** Human label, defaults to a short form of the address until the user names it. */
  label: string;
  createdAt: number;
}

export type SendState = 'sending' | 'sent' | 'delivered' | 'failed';

export interface StoredMessage {
  /** Outbound: the Hop bundle id (base64). Inbound: the Hop inbox id (base64). */
  id: string;
  /** Peer address: whose conversation this message belongs to. */
  contact: string;
  direction: 'out' | 'in';
  body: string;
  /** Clock at creation. Inbound messages carry the sender's clock in Hop's createdAt. */
  at: number;
  sendState?: SendState;
  /** MIME-ish content type. Text rows leave it undefined; media rows carry image/* or audio/*. */
  contentType?: string;
  /** file:// URI for media rows: the picked image for outbound, the persisted bytes for inbound. */
  mediaUri?: string;
  /** Voice note duration in seconds, when the row is audio. */
  durationSecs?: number;
  // Delivery telemetry for outbound messages, filled in as status snapshots arrive.
  relayed?: number;
  delivered?: boolean;
  forwardHops?: number;
  // The physical route an inbound message took to reach this device.
  hops?: number;
  /** Set when the user has read this inbound message; unread drives the badge. */
  readAt?: number;
}

export interface DeliverySnapshot {
  relayed: number;
  delivered: boolean;
  forwardHops: number;
  forwardMs: number;
}

/** A conversation as the list screen sees it. */
export interface ConversationSummary {
  contact: Contact;
  last?: StoredMessage;
  unread: number;
}

const CONTACTS_KEY = 'grit.contacts.v1';
const MESSAGES_KEY = 'grit.messages.v1';

// A hard cap so a month of playa traffic cannot grow the JSON blob without bound. Oldest messages
// go first; this is stated in the UI's honesty notes rather than hidden.
const MAX_MESSAGES = 2000;

export class ConversationStore {
  private contacts: Contact[] = [];
  private messages: StoredMessage[] = [];
  private loaded = false;
  private readonly listeners = new Set<() => void>();
  /** Bumped on every persisted mutation; the version useSyncExternalStore reads. */
  version = 0;
  /** Serialises disk writes so overlapping applyDelivery calls cannot clobber a later snapshot. */
  private write: Promise<void> = Promise.resolve();

  constructor(private readonly kv: KeyValueStore) {}

  /** React binding: subscribe to persisted mutations. Returns an unsubscribe function. */
  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify(): void {
    this.version += 1;
    for (const cb of this.listeners) {
      cb();
    }
  }

  async load(): Promise<void> {
    const [contactsRaw, messagesRaw] = await Promise.all([
      this.kv.getItem(CONTACTS_KEY),
      this.kv.getItem(MESSAGES_KEY),
    ]);
    this.contacts = contactsRaw ? (JSON.parse(contactsRaw) as Contact[]) : [];
    this.messages = messagesRaw ? (JSON.parse(messagesRaw) as StoredMessage[]) : [];
    const before = this.messages.length;
    const hadForwardMs = this.messages.some((m) => 'forwardMs' in m);
    for (const message of this.messages) {
      delete (message as {forwardMs?: number}).forwardMs;
    }
    this.messages = collapseDuplicateMessages(this.messages);
    this.loaded = true;
    if (this.messages.length !== before || hadForwardMs) {
      await this.persist();
    }
  }

  /**
   * Every read and write goes through this. Using the store before load() would silently report an
   * empty history, which for a messenger reads as "your messages are gone" rather than as a bug.
   */
  private assertLoaded(): void {
    if (!this.loaded) {
      throw new Error('ConversationStore.load() must complete before use');
    }
  }

  private async persist(): Promise<void> {
    const run = async () => {
      await Promise.all([
        this.kv.setItem(CONTACTS_KEY, JSON.stringify(this.contacts)),
        this.kv.setItem(MESSAGES_KEY, JSON.stringify(this.messages)),
      ]);
      this.notify();
    };
    this.write = this.write.then(run, run);
    return this.write;
  }

  /** Contacts ordered by most recent activity, contacts with no traffic last. */
  conversations(): ConversationSummary[] {
    this.assertLoaded();
    return [...this.contacts]
      .map((contact) => {
        const mine = this.messages.filter((m) => m.contact === contact.address);
        const unread = mine.filter((m) => m.direction === 'in' && m.readAt == null).length;
        const last = mine.length > 0 ? mine[mine.length - 1] : undefined;
        return {contact, last, unread};
      })
      .sort((a, b) => {
        const aAt = a.last?.at ?? a.contact.createdAt;
        const bAt = b.last?.at ?? b.contact.createdAt;
        return bAt - aAt;
      });
  }

  messagesFor(address: string): StoredMessage[] {
    this.assertLoaded();
    return this.messages.filter((m) => m.contact === address);
  }

  contactByAddress(address: string): Contact | undefined {
    this.assertLoaded();
    return this.contacts.find((c) => c.address === address);
  }

  /**
   * What to CALL someone on screen. Name-first: a person reads a name, and a base58 string is not
   * one. When a contact has a real label, that is the answer; otherwise the short address is, since
   * an unnamed peer has nothing else to be called. This lives here, once, so every screen that shows
   * a person agrees, and so the address is demoted rather than deleted: the detail views still print
   * it in full, which is what someone compares against a peer reading theirs aloud.
   */
  labelFor(address: string): string {
    const short = shortAddress(address);
    const contact = this.contactByAddress(address);
    return contact != null && contact.label !== short ? contact.label : short;
  }

  /**
   * Add a contact, or rename an existing one. Duplicate adds by address are the common case (the
   * peer already exists) and are reported as such rather than thrown.
   */
  async addContact(address: string, label?: string): Promise<{added: boolean; contact: Contact}> {
    this.assertLoaded();
    const existing = this.contactByAddress(address);
    if (existing) {
      if (label != null && label.length > 0 && label !== existing.label) {
        existing.label = label;
        await this.persist();
      }
      return {added: false, contact: existing};
    }
    const contact: Contact = {
      address,
      label: label != null && label.length > 0 ? label : shortAddress(address),
      createdAt: Date.now(),
    };
    this.contacts.push(contact);
    await this.persist();
    return {added: true, contact};
  }

  async removeContact(address: string): Promise<void> {
    this.assertLoaded();
    this.contacts = this.contacts.filter((c) => c.address !== address);
    this.messages = this.messages.filter((m) => m.contact !== address);
    await this.persist();
  }

  /** Drop every contact and message. Used by --grit-reset-store so a screenshot is not a debug log. */
  async reset(): Promise<void> {
    this.assertLoaded();
    this.contacts = [];
    this.messages = [];
    await this.persist();
  }

  /** Record an outbound message the moment the core accepted it (id assigned). */
  async appendOutbound(
    contact: string,
    body: string,
    id: string,
    extras?: {contentType?: string; mediaUri?: string; durationSecs?: number},
  ): Promise<StoredMessage> {
    this.assertLoaded();
    const existing = this.messages.find((m) => m.id === id);
    if (existing) {
      return existing;
    }
    const message: StoredMessage = {
      id,
      contact,
      direction: 'out',
      body,
      at: Date.now(),
      sendState: 'sending',
      contentType: extras?.contentType,
      mediaUri: extras?.mediaUri,
      durationSecs: extras?.durationSecs,
    };
    this.messages.push(message);
    this.trim();
    await this.persist();
    return message;
  }

  /** Record an inbound message. Returns null on a duplicate inbox id: Hop repeats inbox items
   * until accepted, and a slow accept can surface the same message twice. */
  async appendInbound(
    from: string,
    body: string,
    hops: number,
    id: string,
    at: number,
    contentType?: string,
    mediaUri?: string,
  ): Promise<StoredMessage | null> {
    this.assertLoaded();
    if (this.messages.some((m) => m.id === id)) {
      return null;
    }
    const message: StoredMessage = {
      id,
      contact: from,
      direction: 'in',
      body,
      at,
      hops,
      contentType,
      mediaUri,
    };
    this.messages.push(message);
    this.trim();
    await this.persist();
    return message;
  }

  /** Fold a delivery snapshot into the outbound message it belongs to.
   * Never downgrades: overlapping persist() calls from fire-and-forget onUpdate
   * handlers were measured to write an early relayed=0 snapshot over a later
   * delivered=true one, so the chat showed "nobody carrying it" for a message
   * the protocol had already confirmed. */
  async applyDelivery(id: string, snapshot: DeliverySnapshot): Promise<void> {
    this.assertLoaded();
    const message = this.messages.find((m) => m.id === id && m.direction === 'out');
    if (!message) {
      return;
    }
    if (message.sendState === 'delivered' || message.delivered === true) {
      if (snapshot.delivered) {
        message.forwardHops = Math.max(message.forwardHops ?? 0, snapshot.forwardHops);
        message.relayed = Math.max(message.relayed ?? 0, snapshot.relayed);
        delete (message as {forwardMs?: number}).forwardMs;
        await this.persist();
      }
      return;
    }
    message.relayed = Math.max(message.relayed ?? 0, snapshot.relayed);
    message.delivered = snapshot.delivered;
    if (snapshot.delivered) {
      message.forwardHops = snapshot.forwardHops;
      delete (message as {forwardMs?: number}).forwardMs;
    }
    message.sendState = message.delivered ? 'delivered' : 'sent';
    await this.persist();
  }

  async markFailed(id: string): Promise<void> {
    this.assertLoaded();
    const message = this.messages.find((m) => m.id === id && m.direction === 'out');
    if (message && message.sendState !== 'delivered') {
      message.sendState = 'failed';
      await this.persist();
    }
  }

  async markRead(contact: string): Promise<void> {
    this.assertLoaded();
    let changed = false;
    for (const m of this.messages) {
      if (m.contact === contact && m.direction === 'in' && m.readAt == null) {
        m.readAt = Date.now();
        changed = true;
      }
    }
    if (changed) {
      await this.persist();
    }
  }

  private trim(): void {
    if (this.messages.length > MAX_MESSAGES) {
      this.messages = this.messages.slice(this.messages.length - MAX_MESSAGES);
    }
  }
}

/** Short display form of a base58 address: first 6 and last 5 characters around a marker. */
export function shortAddress(address: string): string {
  if (address.length <= 13) {
    return address;
  }
  return `${address.slice(0, 6)}...${address.slice(-5)}`;
}

/** One row per bundle id. Proof re-runs were measured to append the same id twice, which
 * React then refuses to render (duplicate key) and which made the older delivery snapshot
 * look like a second message still in flight. */
function collapseDuplicateMessages(messages: StoredMessage[]): StoredMessage[] {
  const byId = new Map<string, StoredMessage>();
  for (const message of messages) {
    const existing = byId.get(message.id);
    byId.set(message.id, existing == null ? message : mergeSameId(existing, message));
  }
  return [...byId.values()].sort((a, b) => a.at - b.at);
}

function deliveryRank(message: StoredMessage): number {
  if (message.sendState === 'delivered' || message.delivered === true) {
    return 3;
  }
  if (message.sendState === 'sent') {
    return 2;
  }
  if (message.sendState === 'failed') {
    return 0;
  }
  return 1;
}

function mergeSameId(a: StoredMessage, b: StoredMessage): StoredMessage {
  const preferred = deliveryRank(a) >= deliveryRank(b) ? a : b;
  const other = preferred === a ? b : a;
  return {
    ...preferred,
    at: Math.min(a.at, b.at),
    relayed: Math.max(a.relayed ?? 0, b.relayed ?? 0),
    delivered: preferred.delivered === true || other.delivered === true,
    forwardHops: Math.max(a.forwardHops ?? 0, b.forwardHops ?? 0),
    sendState:
      preferred.delivered === true || other.delivered === true
        ? 'delivered'
        : preferred.sendState === 'sent' || other.sendState === 'sent'
          ? 'sent'
          : preferred.sendState,
  };
}
