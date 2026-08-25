// The arrival decision is the honest core of the notification work: when to banner, when to stay
// quiet, and what the badge says. These tests pin the two load-bearing refusals and the badge math,
// without a device, a permission, or a native module.

import {decideArrival, previewOf} from '../src/notifications/notify';

const base = {
  appActive: false,
  openConversation: null,
  openChannel: null,
  isChannel: false,
  fromLabel: 'the studio',
  preview: 'meet at the trash fence',
  unreadTotal: 3,
};

describe('decideArrival', () => {
  it('banners a backgrounded arrival with the name first', () => {
    const notice = decideArrival({...base, key: 'addr-a'});
    expect(notice.notify).toBe(true);
    expect(notice.title).toBe('the studio');
    expect(notice.body).toBe('meet at the trash fence');
  });

  it('never banners while the app is active, but still sets the badge', () => {
    const notice = decideArrival({...base, appActive: true, key: 'addr-a'});
    expect(notice.notify).toBe(false);
    expect(notice.badge).toBe(3);
  });

  it('never banners for a conversation that is on screen', () => {
    const notice = decideArrival({...base, openConversation: 'addr-a', key: 'addr-a'});
    expect(notice.notify).toBe(false);
  });

  it('banners for a conversation that is not the one on screen', () => {
    const notice = decideArrival({...base, openConversation: 'addr-b', key: 'addr-a'});
    expect(notice.notify).toBe(true);
  });

  it('never banners for a channel that is on screen', () => {
    const notice = decideArrival({
      ...base,
      isChannel: true,
      openChannel: 'center-camp',
      key: 'center-camp',
      fromLabel: 'center-camp',
    });
    expect(notice.notify).toBe(false);
  });

  it('names the sender inside a channel', () => {
    const notice = decideArrival({
      ...base,
      isChannel: true,
      key: 'center-camp',
      fromLabel: 'center-camp',
      senderLabel: 'Ada',
      preview: 'sunrise sync at six',
    });
    expect(notice.notify).toBe(true);
    expect(notice.title).toBe('center-camp');
    expect(notice.body).toBe('Ada: sunrise sync at six');
  });

  it('carries the unread total as the badge', () => {
    expect(decideArrival({...base, key: 'addr-a', unreadTotal: 0}).badge).toBe(0);
    expect(decideArrival({...base, key: 'addr-a', unreadTotal: 7}).badge).toBe(7);
  });
});

describe('previewOf', () => {
  it('names media instead of leaking bytes', () => {
    expect(previewOf('', 'image/jpeg')).toBe('sent a photo');
    expect(previewOf('', 'audio/m4a')).toBe('sent a voice note');
    expect(previewOf('', 'application/grit-location+json')).toBe('shared a location');
  });

  it('collapses whitespace and bounds the preview', () => {
    expect(previewOf('a\n\nb', null)).toBe('a b');
    const long = 'x'.repeat(200);
    const preview = previewOf(long, null);
    expect(preview.length).toBeLessThanOrEqual(80);
    expect(preview.endsWith('...')).toBe(true);
  });
});

// The permission ASK, as opposed to the arrival decision. This exists because asking at boot
// shipped once and was the worst kind of defect: it put a system modal over the first screen of a
// new install, and it made all fourteen Detox scenarios time out because an app behind an alert
// never reports idle. The rule is now "once per process, and never from boot", so it gets a test.
describe('asking to notify', () => {
  const nativeMock = (count: {asks: number}) => ({
    AppState: {addEventListener: () => ({remove: () => {}})},
    NativeModules: {
      GritNotifications: {
        requestPermission: async () => {
          count.asks += 1;
          return true;
        },
        present: async () => {},
        setBadge: async () => {},
      },
    },
  });

  it('asks once however many conversations are opened', () => {
    const count = {asks: 0};
    jest.resetModules();
    jest.doMock('react-native', () => nativeMock(count));
    const bridge = require('../src/notifications/bridge');
    bridge.askToNotifyOnce();
    bridge.askToNotifyOnce();
    bridge.askToNotifyOnce();
    expect(count.asks).toBe(1);
  });

  it('does not ask while wiring arrivals, because that runs at boot', () => {
    // The regression itself. If the ask moves back into boot, this fails.
    const count = {asks: 0};
    jest.resetModules();
    jest.doMock('react-native', () => nativeMock(count));
    const {wireArrivals} = require('../src/notifications/wire');
    wireArrivals(
      {onInbound: () => () => {}, onChannelMessage: () => () => {}, onChannelInvite: () => () => {}},
      {conversations: () => [], contactByAddress: () => undefined},
      {summaries: () => []},
    );
    expect(count.asks).toBe(0);
  });
});
