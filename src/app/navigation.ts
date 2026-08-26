// Navigation shape. Six screens, one stack, no tabs: this app has one job, a settings-shaped
// identity screen, and channels beside one to one conversations. A tab bar would spend permanent
// screen height on that.

import type {LocationFix} from '../hop/location';

export type RootStackParamList = {
  Conversations: undefined;
  Chat: {address: string};
  AddContact: undefined;
  Identity: undefined;
  /** A channel conversation, keyed by topic path. */
  Channel: {path: string};
  /** Create a channel, or join one by host address and path. */
  NewChannel: undefined;
  /** Scan a QR code from another device's identity screen. */
  ScanContact: undefined;
  /** Host management for a channel: pending joins, members, invites. */
  ChannelManage: {path: string};
  /** Offline compass for a received location message. Coordinates come from persisted message data. */
  Compass: {target: LocationFix};
};
