// The decision of whether an arrival becomes a local notification, and what that notification says.
// Pure on purpose: the pump, the stores and the native bridge are all side effects, and the rule
// itself must be testable without a device, a permission, or a native module.
//
// The rule is honest about what a local notification is. It is produced by THIS process, from the
// foreground pump. It can therefore only fire while the process is alive. When the app is fully
// closed, nothing arrives and nothing is announced, and no copy anywhere implies otherwise.
// Background push is future work that needs a relay push service; it is named as such in
// docs/ux-audit.md, not faked here.
//
// Two refusals are load-bearing:
//   1. Never notify while the app is active. The list already shows the arrival, and a banner on top
//      of the screen you are looking at is noise, not information.
//   2. Never notify for an arrival the user is currently reading. If the conversation is on screen,
//      the message is visibly there.

export interface ArrivalNotice {
  /** Whether a local notification should be posted at all. */
  notify: boolean;
  /** The notification title: who it is from, name first. */
  title?: string;
  /** One line of body: a short preview, never the raw address. */
  body?: string;
  /** The badge count to set, which is the total unread after this arrival. */
  badge?: number;
}

export interface ArrivalInput {
  /** True while the app is in the foreground and active. */
  appActive: boolean;
  /** The 1:1 conversation address on screen, if any. */
  openConversation: string | null;
  /** The channel path on screen, if any. */
  openChannel: string | null;
  /** For a 1:1 arrival: the peer address. For a channel arrival: the channel path. */
  key: string;
  /** Whether this arrival is a channel publication rather than a direct message. */
  isChannel: boolean;
  /** The sender's display name for a 1:1 message, or the channel label for a publication. */
  fromLabel: string;
  /** The sender label inside a channel, when known. */
  senderLabel?: string | null;
  /** A short human preview of the content. */
  preview: string;
  /** Total unread across the app after this arrival is persisted. */
  unreadTotal: number;
}

export function decideArrival(input: ArrivalInput): ArrivalNotice {
  // The badge is always maintained, even when we do not banner: it is the honest count of what is
  // unread, and it must clear when everything is read.
  const badge = input.unreadTotal;

  if (input.appActive) {
    return {notify: false, badge};
  }

  const looking = input.isChannel
    ? input.openChannel === input.key
    : input.openConversation === input.key;
  if (looking) {
    return {notify: false, badge};
  }

  const title = input.fromLabel;
  const body =
    input.isChannel && input.senderLabel != null
      ? `${input.senderLabel}: ${input.preview}`
      : input.preview;

  return {notify: true, title, body, badge};
}

// A preview that stays a preview: one line, bounded, and never the raw address. Media and location
// are named rather than leaked, because their bodies are bytes or JSON, not words.
export function previewOf(body: string, contentType: string | null | undefined): string {
  if (contentType != null && contentType.startsWith('image/')) {
    return 'sent a photo';
  }
  if (contentType != null && contentType.startsWith('audio/')) {
    return 'sent a voice note';
  }
  if (contentType === 'application/grit-location+json') {
    return 'shared a location';
  }
  const oneLine = body.replace(/\s+/g, ' ').trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 77)}...` : oneLine;
}
