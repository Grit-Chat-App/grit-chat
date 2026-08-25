// Location: the one feature whose usefulness INCREASES when the network is gone. GPS is a
// receiver; it needs no infrastructure, which is the entire premise of this app.
//
// DESIGN DECISIONS, made deliberately rather than copied from other messengers:
//
// - A location is a SNAPSHOT with a timestamp and an honest accuracy radius, sent as an ordinary
//   message. There is no continuous live sharing: it is a battery and privacy commitment this
//   product has not made, and on a delay-tolerant network a stale "live" position is actively
//   misleading. What someone receives is "where I was at this time, to this accuracy".
//
// - No map tiles. A tile needs the network and renders blank exactly when this matters. What
//   carries with zero connectivity: the coordinates themselves, plus a bearing and a distance
//   computed against the RECEIVER's current fix. Those three numbers find a camp in the dark.
//
// - The bearing is the initial great-circle bearing from the receiver to the sender, labelled
//   with its compass point. It is relative to true north, not to the phone's heading: the app
//   does not pretend to know which way the holder is facing.
//
// - The distance and bearing exist only when the receiver has their own fix. Without one the
//   bubble says so and shows the coordinates alone, because inventing a reference point would be
//   a lie.

/** The wire shape, carried as JSON in the message body. */
export interface LocationFix {
  /** Decimal degrees, WGS84. */
  lat: number;
  lon: number;
  /** Horizontal accuracy in meters, as reported by the device. Honest, never guessed. */
  accuracy: number;
  /** Clock at fix time, epoch ms. */
  at: number;
}

export const LOCATION_CONTENT_TYPE = 'application/grit-location+json';

/** Serialize a fix for the wire. */
export function encodeFix(fix: LocationFix): string {
  return JSON.stringify(fix);
}

/**
 * Parse a fix from a message body. Returns null for anything that is not a well-formed fix:
 * a malformed location must render as unparseable, not as a silent coordinates-less nothing or,
 * worse, as invented coordinates.
 */
export function decodeFix(body: string): LocationFix | null {
  try {
    const value: unknown = JSON.parse(body);
    if (value == null || typeof value !== 'object') {
      return null;
    }
    const candidate = value as Partial<LocationFix>;
    if (
      typeof candidate.lat !== 'number' ||
      typeof candidate.lon !== 'number' ||
      typeof candidate.accuracy !== 'number' ||
      typeof candidate.at !== 'number' ||
      !Number.isFinite(candidate.lat) ||
      !Number.isFinite(candidate.lon) ||
      Math.abs(candidate.lat) > 90 ||
      Math.abs(candidate.lon) > 180 ||
      candidate.accuracy < 0
    ) {
      return null;
    }
    return {lat: candidate.lat, lon: candidate.lon, accuracy: candidate.accuracy, at: candidate.at};
  } catch {
    return null;
  }
}

const EARTH_RADIUS_M = 6_371_000;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Great-circle distance between two fixes, in meters. */
export function distanceMeters(from: LocationFix, to: LocationFix): number {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const dLat = toRadians(to.lat - from.lat);
  const dLon = toRadians(to.lon - from.lon);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Initial great-circle bearing from one fix to another, in degrees clockwise from true north. */
export function bearingDegrees(from: LocationFix, to: LocationFix): number {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const dLon = toRadians(to.lon - from.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

const COMPASS_POINTS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
] as const;

/** The 16-point compass label for a bearing. */
export function compassPoint(bearing: number): string {
  const index = Math.round((((bearing % 360) + 360) % 360) / 22.5) % 16;
  return COMPASS_POINTS[index];
}

/** Human distance: meters under a kilometre, one decimal in km up to a thousand, rounded above. */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters / 10) * 10} m`;
  }
  if (meters < 1_000_000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters / 1000)} km`;
}

/** Human accuracy, e.g. "± 12 m". */
export function formatAccuracy(meters: number): string {
  return `± ${Math.round(meters)} m`;
}

/** The Geolocation error codes this app distinguishes. */
export const LOCATION_ERROR = {
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3,
} as const;

/**
 * The plain sentence for a failed location request. Extracted as a pure function so every branch
 * is unit testable: the e2e suite can drive the UNAVAILABLE path (a permission-unset simulator
 * times out), but nothing but a human tap on the system prompt can drive the DENIED state, so
 * that message is proven by test rather than on a device.
 */
export function locationErrorNote(error: {code: number; message?: string}): string {
  if (error.code === LOCATION_ERROR.PERMISSION_DENIED) {
    return 'Location permission is off. Enable it in Settings to share where you are.';
  }
  const reason = error.message && error.message.length > 0 ? ` (${error.message})` : '';
  return `No location available${reason}. Nothing was sent.`;
}
