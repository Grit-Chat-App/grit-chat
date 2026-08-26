import {isLanRelayUrl, localNetworkHint} from '../src/hop/localNetwork';

describe('isLanRelayUrl', () => {
  test.each([
    'ws://192.168.1.50:18765/',
    'ws://192.168.1.51:9000',
    'ws://172.20.0.2:18765/',
    'ws://172.16.0.1:18765/',
    'ws://169.254.1.2:18765/',
    'ws://my-mac.local:18765/',
  ])('LAN host %s is recognised', (url) => {
    expect(isLanRelayUrl(url)).toBe(true);
  });

  test.each([
    'ws://127.0.0.1:18765/',
    'ws://localhost:18765/',
    'ws://[::1]:18765/',
    'wss://relay.hop.example/',
    'ws://8.8.8.8:18765/',
    'ws://172.32.0.1:18765/',
    'not a url',
  ])('non-LAN or unparseable %s is not', (url) => {
    expect(isLanRelayUrl(url)).toBe(false);
  });

  test('null is not a LAN relay', () => {
    expect(isLanRelayUrl(null)).toBe(false);
  });
});

describe('localNetworkHint', () => {
  it('names the settings path for a failing LAN relay', () => {
    const hint = localNetworkHint('ws://192.168.1.50:18765/', 'down');
    expect(hint).toContain('Settings');
    expect(hint).toContain('Local Network');
  });

  it('shows while retrying too: the gate failing looks exactly like a flaky relay', () => {
    expect(localNetworkHint('ws://192.168.1.50:18765/', 'retrying')).not.toBeNull();
  });

  it('stays silent when the relay is carrying: the gate was passed', () => {
    expect(localNetworkHint('ws://192.168.1.50:18765/', 'up')).toBeNull();
  });

  it('stays silent while dialing: nothing has failed yet', () => {
    expect(localNetworkHint('ws://192.168.1.50:18765/', 'connecting')).toBeNull();
  });

  it('stays silent when unconfigured: no relay means no gate to trip', () => {
    expect(localNetworkHint('ws://192.168.1.50:18765/', 'unconfigured')).toBeNull();
  });

  it('stays silent for loopback: the permission does not apply there', () => {
    expect(localNetworkHint('ws://127.0.0.1:18765/', 'down')).toBeNull();
  });

  it('stays silent for a public host: the permission does not apply there either', () => {
    expect(localNetworkHint('wss://relay.hop.example/', 'down')).toBeNull();
  });
});
