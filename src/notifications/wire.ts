// Arrival wiring: register listeners on the seam that turn a persisted arrival into a local
// notification and keep the badge honest. These run in parallel to, and do not replace, the persist
// listeners in GritContext. The seam fans every arrival to all registered listeners, so adding a
// notification listener never changes what gets stored.
//
// The badge is computed as the current unread total plus this arrival, because the persist listener
// that actually writes the row is fire-and-forget and may not have finished when we run. That makes
// the number honest about the arrival we are announcing, not one behind it.

import {AppState} from 'react-native';

import type {GritSeam} from '../hop/seam';
import type {ConversationStore} from '../store/conversations';
import type {ChannelStore} from '../store/channels';
import {shortAddress} from '../store/conversations';
import {decideArrival, previewOf} from './notify';
import {presentArrival, setUnreadBadge} from './bridge';
import {focus} from './focus';

function totalUnread(store: ConversationStore, channels: ChannelStore): number {
  const direct = store.conversations().reduce((sum, c) => sum + c.unread, 0);
  const topics = channels.summaries().reduce((sum, c) => sum + c.unread, 0);
  return direct + topics;
}

export function wireArrivals(seam: GritSeam, store: ConversationStore, channels: ChannelStore): void {
  focus.start();

  // Deliberately NOT asking for notification permission here. Asking at boot puts a system modal
  // over the first screen of a new install, before the person has anyone who could message them.
  // The ask lives in askToNotifyOnce, called when a conversation is first opened. See bridge.ts.
  // Keep the badge honest whenever the person comes back to the app: recompute from the stores,
  // which by then have persisted everything the pump accepted.
  const refreshBadge = () => {
    void setUnreadBadge(totalUnread(store, channels));
  };

  seam.onInbound((m) => {
    const contact = store.contactByAddress(m.from);
    const label =
      contact != null && contact.label !== shortAddress(m.from) ? contact.label : shortAddress(m.from);
    const notice = decideArrival({
      appActive: focus.isAppActive(),
      openConversation: focus.reading().conversation,
      openChannel: focus.reading().channel,
      key: m.from,
      isChannel: false,
      fromLabel: label,
      preview: previewOf(m.body, m.contentType),
      unreadTotal: totalUnread(store, channels) + 1,
    });
    if (notice.notify) {
      void presentArrival(notice.title ?? label, notice.body ?? '');
    }
    void setUnreadBadge(notice.badge ?? 0);
  });

  seam.onChannelMessage((m) => {
    const channel = channels.channelByPath(m.path);
    if (channel == null) {
      return true;
    }
    const senderContact = m.sender != null ? store.contactByAddress(m.sender) : null;
    const senderLabel =
      m.sender != null
        ? senderContact != null && senderContact.label !== shortAddress(m.sender)
          ? senderContact.label
          : shortAddress(m.sender)
        : null;
    const notice = decideArrival({
      appActive: focus.isAppActive(),
      openConversation: focus.reading().conversation,
      openChannel: focus.reading().channel,
      key: m.path,
      isChannel: true,
      fromLabel: channel.label,
      senderLabel,
      preview: previewOf(m.body, null),
      unreadTotal: totalUnread(store, channels) + 1,
    });
    if (notice.notify) {
      void presentArrival(notice.title ?? channel.label, notice.body ?? '');
    }
    void setUnreadBadge(notice.badge ?? 0);
    return true;
  });

  seam.onChannelInvite((invite) => {
    const notice = decideArrival({
      appActive: focus.isAppActive(),
      openConversation: focus.reading().conversation,
      openChannel: focus.reading().channel,
      key: invite.path,
      isChannel: true,
      fromLabel: `Invited to ${invite.path}`,
      senderLabel: shortAddress(invite.host),
      preview: 'channel invite',
      unreadTotal: totalUnread(store, channels),
    });
    if (notice.notify) {
      void presentArrival(notice.title ?? 'Channel invite', notice.body ?? '');
    }
  });

  // When the app returns to the foreground, set the badge to whatever is actually unread.
  AppState.addEventListener('change', (next: string) => {
    if (next === 'active') {
      refreshBadge();
    }
  });
}
