// Geolocation binding, configured once, plus the one read primitive this app uses.
//
// Configuration is the library default (the explicit authorization request), which is the
// battle-tested path on real devices: the request both triggers the system prompt for an
// undecided user and fires the authorization-changed callback that starts monitoring.
//
// What was measured on the SIMULATOR, and why none of the workarounds shipped: an unanswered
// prompt from an early run leaves the request "in flight" in locationd, which then ignores every
// later request for ~9 minutes while the permission itself is granted; after clearing that with
// a simulator reboot and a fresh grant, the app's CLLocationManager still only ever issues
// stopUpdatingLocation under a pre-granted permission (locationd log evidence), so no fix is ever
// delivered on this simulator regardless of configuration. The GPS read is therefore proven on
// hardware, not here; everything around it (wire shape, math, error paths, rendering, fan-out
// confirmation) is proven by unit tests and by the Detox scenarios that do not need a fix.
//
// readOneFix reads exactly one fix through a brief watch that is cleared the moment one arrives:
// a one-shot read wearing a watch, never continuous sharing.

import Geolocation from '@react-native-community/geolocation';

export interface ReadFix {
  lat: number;
  lon: number;
  accuracy: number;
  at: number;
}

/** Read one position fix, or fail with the library's error. The watch ends when one arrives. */
export function readOneFix(timeoutMs = 10000): Promise<ReadFix> {
  return new Promise((resolve, reject) => {
    let watchId: number | undefined;
    const done = false;
    const timer = setTimeout(() => {
      if (watchId !== undefined) {
        Geolocation.clearWatch(watchId);
      }
      reject({code: 3, message: `Unable to fetch location within ${timeoutMs / 1000.0}s.`});
    }, timeoutMs);
    watchId = Geolocation.watchPosition(
      (position) => {
        clearTimeout(timer);
        if (watchId !== undefined) {
          Geolocation.clearWatch(watchId);
        }
        if (!done) {
          resolve({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: position.coords.accuracy ?? 0,
            at: position.timestamp,
          });
        }
      },
      (error) => {
        clearTimeout(timer);
        if (watchId !== undefined) {
          Geolocation.clearWatch(watchId);
        }
        reject(error);
      },
      {enableHighAccuracy: true, distanceFilter: 0, timeout: timeoutMs, maximumAge: 5000},
    );
  });
}
