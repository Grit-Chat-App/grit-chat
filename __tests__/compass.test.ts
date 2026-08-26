import type {LocationFix} from '../src/hop/location';
import {
  compassDirection,
  compassReading,
  formatCompassDistance,
  normalizeDegrees,
  relativeTurnDegrees,
  smoothHeading,
} from '../src/hop/compass';

const fix = (lat: number, lon: number): LocationFix => ({lat, lon, accuracy: 8, at: 1});

describe('compass angle normalization', () => {
  it('keeps the 0 and 359 degree boundaries in the compass range', () => {
    expect(normalizeDegrees(0)).toBe(0);
    expect(normalizeDegrees(359)).toBe(359);
    expect(normalizeDegrees(360)).toBe(0);
    expect(normalizeDegrees(-1)).toBe(359);
    expect(normalizeDegrees(-360)).toBe(0);
  });

  it('uses the shortest signed turn across north', () => {
    expect(relativeTurnDegrees(0, 359)).toBe(1);
    expect(relativeTurnDegrees(359, 0)).toBe(-1);
  });

  it('breaks exact half-turn ties clockwise', () => {
    expect(relativeTurnDegrees(180, 0)).toBe(180);
    expect(relativeTurnDegrees(0, 180)).toBe(180);
  });
});

describe('heading smoothing', () => {
  it('initializes from the first heading sample without changing it', () => {
    expect(smoothHeading(null, 361, 0.25)).toBe(1);
  });

  it('smooths from 359 to 0 across north instead of through south', () => {
    expect(smoothHeading(359, 0, 0.5)).toBeCloseTo(359.5, 10);
    expect(smoothHeading(0, 359, 0.5)).toBeCloseTo(359.5, 10);
  });
});

describe('compass labels and distance formatting', () => {
  it('uses the shared 16-point cardinal labels', () => {
    expect(compassDirection(0)).toBe('N');
    expect(compassDirection(45)).toBe('NE');
    expect(compassDirection(359)).toBe('N');
  });

  it('uses the established human distance units', () => {
    expect(formatCompassDistance(834)).toBe('830 m');
    expect(formatCompassDistance(145_300)).toBe('145.3 km');
  });
});

describe('received-location compass readings', () => {
  it('returns an exact north reading and a one-degree turn from heading 359', () => {
    const reading = compassReading(fix(10, 20), fix(11, 20), 359);

    expect(reading.distanceMeters).toBeCloseTo(111_195, -1);
    expect(reading.bearingDegrees).toBe(0);
    expect(reading.direction).toBe('N');
    expect(reading.relativeTurnDegrees).toBe(1);
  });

  it('takes the short route across the international date line', () => {
    const reading = compassReading(fix(0, 179.9), fix(0, -179.9), 90);

    expect(reading.distanceMeters).toBeCloseTo(22_239, -1);
    expect(reading.bearingDegrees).toBeCloseTo(90, 8);
    expect(reading.direction).toBe('E');
    expect(reading.relativeTurnDegrees).toBeCloseTo(0, 8);
  });

  it('keeps great-circle readings finite at both poles', () => {
    const northPole = compassReading(fix(90, 0), fix(89, 0), 0);
    const southPole = compassReading(fix(-90, 0), fix(-89, 0), 180);

    expect(northPole.distanceMeters).toBeCloseTo(111_195, -1);
    expect(northPole.bearingDegrees).toBeCloseTo(180, 8);
    expect(northPole.direction).toBe('S');
    expect(northPole.relativeTurnDegrees).toBe(180);

    expect(southPole.distanceMeters).toBeCloseTo(111_195, -1);
    expect(southPole.bearingDegrees).toBeCloseTo(0, 8);
    expect(southPole.direction).toBe('N');
    expect(southPole.relativeTurnDegrees).toBe(180);
  });

  it('preserves zero distance for the same fix', () => {
    const current = fix(12.5, -45.25);
    const reading = compassReading(current, current, 0);

    expect(reading.distanceMeters).toBe(0);
    expect(reading.bearingDegrees).toBe(0);
    expect(reading.direction).toBe('N');
    expect(reading.relativeTurnDegrees).toBe(0);
  });

  it('keeps an unavailable heading as null instead of inventing a turn', () => {
    const reading = compassReading(fix(0, 0), fix(0, 1), null);

    expect(reading.bearingDegrees).toBeCloseTo(90, 8);
    expect(reading.relativeTurnDegrees).toBeNull();
  });
});
