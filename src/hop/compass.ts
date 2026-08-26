import {
  bearingDegrees,
  compassPoint,
  distanceMeters,
  formatDistance,
  type LocationFix,
} from './location';

/** Normalize an angle into the half-open compass range [0, 360). */
export function normalizeDegrees(degrees: number): number {
  const normalized = degrees % 360;
  if (normalized === 0) {
    return 0;
  }
  return normalized < 0 ? normalized + 360 : normalized;
}

/**
 * The signed shortest rotation from heading to targetBearing, in degrees.
 *
 * An exact half turn has no geometrically preferred direction. This function always returns
 * +180 for that tie, meaning clockwise, so a heading exactly opposite its target cannot flip
 * direction based on whether either input happened to cross the 0 degree boundary.
 */
export function relativeTurnDegrees(targetBearing: number, heading: number): number {
  const turn = normalizeDegrees(targetBearing - heading);
  return turn > 180 ? turn - 360 : turn;
}

/**
 * Circular exponential moving average for compass headings.
 *
 * There is no previous sample to blend when previous is null, so the first received sample is
 * normalized directly. Subsequent samples travel along the shortest angular path rather than
 * through the opposite side of the compass.
 */
export function smoothHeading(previous: number | null, next: number, alpha: number): number {
  if (previous === null) {
    return normalizeDegrees(next);
  }
  return normalizeDegrees(previous + alpha * relativeTurnDegrees(next, previous));
}

/** The shared 16-point cardinal and intercardinal label for a bearing. */
export function compassDirection(bearing: number): string {
  return compassPoint(bearing);
}

/** Format a compass distance with the location feature's established human units. */
export function formatCompassDistance(meters: number): string {
  return formatDistance(meters);
}

/** The offline values needed to point from a receiver's fix to a received location. */
export interface CompassReading {
  /** Great-circle distance from current to target, in meters. */
  distanceMeters: number;
  /** Initial great-circle bearing clockwise from true north, in degrees. */
  bearingDegrees: number;
  /** Shared 16-point compass label for bearingDegrees. */
  direction: string;
  /** Shortest turn from heading to bearingDegrees, or null when heading is unavailable. */
  relativeTurnDegrees: number | null;
}

/**
 * Calculate one received-location compass reading. Heading remains null when the device does not
 * have it, rather than inventing a north-facing fallback.
 */
export function compassReading(
  current: LocationFix,
  target: LocationFix,
  heading: number | null,
): CompassReading {
  const bearing = bearingDegrees(current, target);
  return {
    distanceMeters: distanceMeters(current, target),
    bearingDegrees: bearing,
    direction: compassDirection(bearing),
    relativeTurnDegrees: heading === null ? null : relativeTurnDegrees(bearing, heading),
  };
}
