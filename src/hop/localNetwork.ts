/**
 * The local network permission failure iOS never names.
 *
 * On a real phone, the first connection to a LAN address can be blocked by the OS's local
 * network permission. Denied or left unanswered, the dial fails with an ordinary "cannot
 * connect" style error, which reads as a dead relay on the exact path a first-time user hits.
 * iOS exposes no API to query the permission state, so this module does not diagnose: it
 * recognises a LAN relay in a failing state and names the one check that could be the cause,
 * in conditional language, without claiming it is.
 */

import type {RelayState} from './relayBearer';

/** True when the URL points at a LAN host, where the iOS local network gate applies. */
export function isLanRelayUrl(url: string | null): boolean {
  if (url == null) {
    return false;
  }
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  // Loopback does not need the permission and a hint there would be noise.
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    return false;
  }
  if (host.endsWith('.local')) {
    return true;
  }
  const m = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(host);
  if (m == null) {
    return false;
  }
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  return false;
}

/**
 * The honest note for a LAN relay that will not come up. Shown only when the relay is actually
 * failing: a carrying relay proves the gate was passed, and a retry hint under an up pill would
 * undermine the status it sits next to.
 */
export function localNetworkHint(url: string | null, state: RelayState): string | null {
  if (state !== 'down' && state !== 'retrying') {
    return null;
  }
  if (!isLanRelayUrl(url)) {
    return null;
  }
  return (
    'If this is the first launch on this phone, iOS may be blocking local network access. ' +
    'Allow Grit Chat in Settings > Privacy & Security > Local Network, then give the relay a few seconds.'
  );
}
