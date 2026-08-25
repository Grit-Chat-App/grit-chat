// The channel store: hps:// channels (group conversations) and their messages, persisted through
// the KV seam so history survives restart, and reconciled against the node's own topic list at
// boot. The node's store is the source of truth for WHICH topics exist (hpsMyTopics reads it);
// this store owns labels, read state, and the message history the UI renders.
//
// A Hop group message is a single content-key-encrypted publication flooded once, NOT one-to-one
// fan-out, so a channel message has no per-recipient delivery state to track. There is no hps
// status query at all: what exists is "the core took the publication" (published) and, for a
// topic we host, how many members have acked (reach). The UI states exactly those and nothing
// else. Revocation is key rotation (hpsRekey), so nothing here pretends a message was unsent.

import {KeyValueStore} from './kv';

export type ChannelKind = 'channel' | 'service';
export type ChannelAccess = 'open' | 'requestToJoin' | 'invite';

export interface StoredChannel {
  /** Topic path. Unique per node store; publishing addresses a topic by path alone. */
  path: string;
  /** Base58 host address. For a topic we host, our own address. */
  host: string;
  kind: ChannelKind;
  access: ChannelAccess;
  /** True when this node hosts the topic (and so can moderate it). */
  hosting: boolean;
  label: string;
  createdAt: number;
  /** When membership became real (the topic appeared in the node's own list). Null while a join is still only requested. */
  joinedAt: number | null;
}

export type ChannelPublishState = 'publishing' | 'published' | 'failed';

export interface StoredChannelMessage {
  /** Base64 publication id. Stable store key. */
  id: string;
  path: string;
  /** Base58 writer. Null for our own publications, which carry no sender. */
  sender: string | null;
  body: string;
  at: number;
  /** Outbound only. A channel post has no delivery state; this is the core's take only. */
  publishState?: ChannelPublishState;
  /** Set when the user has read this message; unread drives the badge. */
  readAt?: number;
}

/**
 * An invite a host sent us, persisted THE MOMENT it arrives: the core's invite queue is
 * take-and-clear, so anything not written down here is gone forever.
 */
export interface StoredChannelInvite {
  host: string;
  path: string;
  kind: string;
  receivedAt: number;
}

export interface ChannelSummary {
  channel: StoredChannel;
  last?: StoredChannelMessage;
  unread: number;
}

const CHANNELS_KEY = 'grit.channels.v1';
const CHANNEL_INVITES_KEY = 'grit.channelInvites.v1';
const CHANNEL_MESSAGES_KEY = 'grit.channelMessages.v1';

// Same cap rationale as the 1:1 store: a month of playa traffic must not grow the blob unbounded.
const MAX_CHANNEL_MESSAGES = 2000;

/** A topic as the seam reads it from the node (hpsMyTopics), for reconciliation. */
export interface SeamTopic {
  host: string;
  path: string;
  kind: string;
  hosting: boolean;
  access: string;
}

function labelFor(path: string): string {
  return path.length > 0 ? path : 'unnamed channel';
}

export class ChannelStore {
  private channels: StoredChannel[] = [];
  private invites: StoredChannelInvite[] = [];
  private messages: StoredChannelMessage[] = [];
  private loaded = false;
  private readonly listeners = new Set<() => void>();
  version = 0;
  private write: Promise<void> = Promise.resolve();

  constructor(private readonly kv: KeyValueStore) {}

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
    const [channelsRaw, messagesRaw, invitesRaw] = await Promise.all([
      this.kv.getItem(CHANNELS_KEY),
      this.kv.getItem(CHANNEL_MESSAGES_KEY),
      this.kv.getItem(CHANNEL_INVITES_KEY),
    ]);
    this.channels = channelsRaw ? (JSON.parse(channelsRaw) as StoredChannel[]) : [];
    this.invites = invitesRaw ? (JSON.parse(invitesRaw) as StoredChannelInvite[]) : [];
    this.messages = messagesRaw ? (JSON.parse(messagesRaw) as StoredChannelMessage[]) : [];
    // Drop messages whose channel disappeared (left channels must not resurrect through history).
    const known = new Set(this.channels.map((c) => c.path));
    const before = this.messages.length;
    this.messages = this.messages.filter((m) => known.has(m.path));
    this.loaded = true;
    if (this.messages.length !== before) {
      await this.persist();
    }
  }

  private assertLoaded(): void {
    if (!this.loaded) {
      throw new Error('ChannelStore.load() must complete before use');
    }
  }

  private async persist(): Promise<void> {
    const run = async () => {
      await Promise.all([
        this.kv.setItem(CHANNELS_KEY, JSON.stringify(this.channels)),
        this.kv.setItem(CHANNEL_MESSAGES_KEY, JSON.stringify(this.messages)),
        this.kv.setItem(CHANNEL_INVITES_KEY, JSON.stringify(this.invites)),
      ]);
      this.notify();
    };
    this.write = this.write.then(run, run);
    return this.write;
  }

  /**
   * Fold the node's own topic list into ours. The node's store is the truth for existence and
   * membership: a topic the node no longer lists is one we left or were removed from, so its row
   * goes. A topic the node lists but we do not (first boot on this store, or keys that arrived
   * after a join request) gains one.
   */
  async reconcile(topics: SeamTopic[], now: number = Date.now()): Promise<void> {
    this.assertLoaded();
    const live = topics.filter((t) => t.kind === 'channel');
    const livePaths = new Set(live.map((t) => t.path));
    let changed = false;

    this.channels = this.channels.filter((c) => livePaths.has(c.path));
    for (const topic of live) {
      const existing = this.channels.find((c) => c.path === topic.path);
      if (existing == null) {
        this.channels.push({
          path: topic.path,
          host: topic.host,
          kind: 'channel',
          access: (topic.access as ChannelAccess) ?? 'open',
          hosting: topic.hosting,
          label: labelFor(topic.path),
          createdAt: now,
          joinedAt: now,
        });
        changed = true;
      } else if (
        existing.host !== topic.host ||
        existing.hosting !== topic.hosting ||
        existing.access !== topic.access ||
        existing.joinedAt == null
      ) {
        existing.host = topic.host;
        existing.hosting = topic.hosting;
        existing.access = (topic.access as ChannelAccess) ?? existing.access;
        existing.joinedAt = existing.joinedAt ?? now;
        changed = true;
      }
    }
    if (changed || this.messages.some((m) => !livePaths.has(m.path))) {
      this.messages = this.messages.filter((m) => livePaths.has(m.path));
      await this.persist();
    }
  }

  /** Record a channel we just asked to HOST (hpsRegister succeeded). */
  async addHosted(path: string, host: string, access: ChannelAccess): Promise<StoredChannel> {
    this.assertLoaded();
    const existing = this.channels.find((c) => c.path === path);
    if (existing) {
      existing.hosting = true;
      existing.host = host;
      existing.access = access;
      existing.joinedAt = existing.joinedAt ?? Date.now();
      await this.persist();
      return existing;
    }
    const channel: StoredChannel = {
      path,
      host,
      kind: 'channel',
      access,
      hosting: true,
      label: labelFor(path),
      createdAt: Date.now(),
      joinedAt: Date.now(),
    };
    this.channels.push(channel);
    await this.persist();
    return channel;
  }

  /** Record a join REQUEST (hpsSubscribe accepted by the core). Not membership yet. */
  async addJoinRequested(path: string, host: string): Promise<StoredChannel> {
    this.assertLoaded();
    const existing = this.channels.find((c) => c.path === path);
    if (existing) {
      // A second request for a topic we already follow is not an error and not a state change.
      return existing;
    }
    const channel: StoredChannel = {
      path,
      host,
      kind: 'channel',
      access: 'open',
      hosting: false,
      label: labelFor(path),
      createdAt: Date.now(),
      joinedAt: null,
    };
    this.channels.push(channel);
    await this.persist();
    return channel;
  }

  /** Drop every channel, message, and invite. Used by --grit-reset-store so a screenshot is not a debug log. */
  async reset(): Promise<void> {
    this.assertLoaded();
    this.channels = [];
    this.invites = [];
    this.messages = [];
    await this.persist();
  }

  async removeChannel(path: string): Promise<void> {
    this.assertLoaded();
    this.channels = this.channels.filter((c) => c.path !== path);
    this.messages = this.messages.filter((m) => m.path !== path);
    await this.persist();
  }

  channelByPath(path: string): StoredChannel | undefined {
    this.assertLoaded();
    return this.channels.find((c) => c.path === path);
  }

  listChannels(): StoredChannel[] {
    this.assertLoaded();
    return [...this.channels];
  }

  summaries(): ChannelSummary[] {
    this.assertLoaded();
    return [...this.channels]
      .map((channel) => {
        const mine = this.messages.filter((m) => m.path === channel.path);
        const unread = mine.filter((m) => m.sender != null && m.readAt == null).length;
        const last = mine.length > 0 ? mine[mine.length - 1] : undefined;
        return {channel, last, unread};
      })
      .sort((a, b) => {
        const aAt = a.last?.at ?? a.channel.createdAt;
        const bAt = b.last?.at ?? b.channel.createdAt;
        return bAt - aAt;
      });
  }

  /** Persist an invite the instant the core hands it over. Take-and-clear upstream. */
  async addInvite(host: string, path: string, kind: string): Promise<void> {
    this.assertLoaded();
    if (this.invites.some((i) => i.host === host && i.path === path)) {
      return;
    }
    this.invites.push({host, path, kind, receivedAt: Date.now()});
    await this.persist();
  }

  listInvites(): StoredChannelInvite[] {
    this.assertLoaded();
    return [...this.invites];
  }

  async clearInvite(host: string, path: string): Promise<void> {
    this.assertLoaded();
    this.invites = this.invites.filter((i) => !(i.host === host && i.path === path));
    await this.persist();
  }

  messagesFor(path: string): StoredChannelMessage[] {
    this.assertLoaded();
    return this.messages.filter((m) => m.path === path);
  }

  /** Record our own publication the moment the core took it. */
  async appendPublished(path: string, body: string, id: string): Promise<StoredChannelMessage> {
    this.assertLoaded();
    const existing = this.messages.find((m) => m.id === id);
    if (existing) {
      return existing;
    }
    const message: StoredChannelMessage = {
      id,
      path,
      sender: null,
      body,
      at: Date.now(),
      publishState: 'published',
    };
    this.messages.push(message);
    this.trim(path);
    await this.persist();
    return message;
  }

  /**
   * An inbound publication. Repeats until accepted, so a repeated id is ignored. Returns null
   * when the caller should NOT accept the item (unknown channel), so the core redelivers it
   * until the channel exists to hold it.
   */
  async appendInbound(
    path: string,
    sender: string,
    body: string,
    id: string,
  ): Promise<StoredChannelMessage | null> {
    this.assertLoaded();
    if (this.messages.some((m) => m.id === id)) {
      return this.messages.find((m) => m.id === id) ?? null;
    }
    const message: StoredChannelMessage = {id, path, sender, body, at: Date.now()};
    this.messages.push(message);
    this.trim(path);
    await this.persist();
    return message;
  }

  async markFailed(id: string): Promise<void> {
    this.assertLoaded();
    const message = this.messages.find((m) => m.id === id && m.sender == null);
    if (message && message.publishState !== 'published') {
      message.publishState = 'failed';
      await this.persist();
    }
  }

  async markRead(path: string): Promise<void> {
    this.assertLoaded();
    let changed = false;
    for (const m of this.messages) {
      if (m.path === path && m.sender != null && m.readAt == null) {
        m.readAt = Date.now();
        changed = true;
      }
    }
    if (changed) {
      await this.persist();
    }
  }

  private trim(path: string): void {
    const mine = this.messages.filter((m) => m.path === path);
    if (mine.length > MAX_CHANNEL_MESSAGES) {
      const drop = new Set(mine.slice(0, mine.length - MAX_CHANNEL_MESSAGES).map((m) => m.id));
      this.messages = this.messages.filter((m) => !drop.has(m.id));
    }
  }
}
