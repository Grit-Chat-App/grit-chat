// Geolocation binding, configured once, plus a one-read primitive and a foreground-only watch.
//
// Configuration is the library default (the explicit authorization request), which is the
// battle-tested path on real devices: the request both triggers the system prompt for an undecided
// user and fires the authorization-changed callback that starts monitoring.
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
// Both APIs use the existing foreground location permission. Neither asks for background access.

import Geolocation from '@react-native-community/geolocation';

export interface ReadFix {
  lat: number;
  lon: number;
  accuracy: number;
  at: number;
}

function toReadFix(position: {
  coords: {latitude: number; longitude: number; accuracy: number | null};
  timestamp: number;
}): ReadFix {
  return {
    lat: position.coords.latitude,
    lon: position.coords.longitude,
    accuracy: position.coords.accuracy ?? 0,
    at: position.timestamp,
  };
}

/** Read one position fix, or fail with the library's error. The watch ends when one arrives. */
export function readOneFix(timeoutMs = 10000): Promise<ReadFix> {
  const {promise, resolve, reject} = Promise.withResolvers<ReadFix>();
  let watchId: number | undefined;
  let done = false;
  const finish = (result: () => void) => {
    if (done) {
      return;
    }
    done = true;
    clearTimeout(timer);
    if (watchId !== undefined) {
      Geolocation.clearWatch(watchId);
    }
    result();
  };
  const timer = setTimeout(() => {
    finish(() => reject({code: 3, message: `Unable to fetch location within ${timeoutMs / 1000.0}s.`}));
  }, timeoutMs);
  watchId = Geolocation.watchPosition(
    (position) => finish(() => resolve(toReadFix(position))),
    (error) => finish(() => reject(error)),
    {enableHighAccuracy: true, distanceFilter: 0, timeout: timeoutMs, maximumAge: 5000},
  );
  return promise;
}

/**
 * Watch foreground position for the compass screen. It returns the one operation the caller needs
 * to clean up, rather than exposing a numeric native watch id through every screen.
 *
 * The screen owns its lifetime: mounting starts the watch; unmounting stops it. No update is kept
 * in a store, no background task is registered, and no sensor result crosses a network boundary.
 */
export function watchForegroundFix(
  onFix: (fix: ReadFix) => void,
  onError: (error: {code: number; message?: string}) => void,
): () => void {
  const watchId = Geolocation.watchPosition(
    (position) => onFix(toReadFix(position)),
    onError,
    {enableHighAccuracy: true, distanceFilter: 1, timeout: 10000, maximumAge: 5000},
  );
  return () => Geolocation.clearWatch(watchId);
}
