// Location math, tested with known vectors. A wrong bearing or distance in the field is not a
// cosmetic bug: it is someone walking away from their camp at 3am. The vectors below are
// recognizable real-world distances, so a regression reads as "Black Rock City to Reno is now
// 4 km" rather than as an abstract number drifting.

import {
  LocationFix,
  bearingDegrees,
  compassPoint,
  decodeFix,
  distanceMeters,
  formatAccuracy,
  formatDistance,
} from '../src/hop/location';

const BRC: LocationFix = {lat: 40.7863, lon: -119.2054, accuracy: 8, at: 1000}; // Black Rock City
const RENO: LocationFix = {lat: 39.5296, lon: -119.8138, accuracy: 12, at: 2000};
const SF: LocationFix = {lat: 37.7749, lon: -122.4194, accuracy: 5, at: 3000};
const NYC: LocationFix = {lat: 40.7128, lon: -74.006, accuracy: 6, at: 4000};

const fix = (lat: number, lon: number): LocationFix => ({lat, lon, accuracy: 10, at: 1});

describe('distance', () => {
  it('measures Black Rock City to Reno as roughly 145 km', () => {
    const km = distanceMeters(BRC, RENO) / 1000;
    expect(km).toBeGreaterThan(140);
    expect(km).toBeLessThan(150);
  });

  it('measures SF to NYC as roughly 4,130 km', () => {
    const km = distanceMeters(SF, NYC) / 1000;
    expect(km).toBeGreaterThan(4100);
    expect(km).toBeLessThan(4160);
  });

  it('is zero only for the same point', () => {
    expect(distanceMeters(BRC, BRC)).toBe(0);
    expect(distanceMeters(fix(40.7863, -119.2054), fix(40.7864, -119.2054))).toBeLessThan(20);
  });

  it('does not care which end you measure from', () => {
    expect(distanceMeters(BRC, RENO)).toBeCloseTo(distanceMeters(RENO, BRC), 6);
  });
});

describe('bearing', () => {
  it('points east from SF to NYC-ish latitudes as a sanity check on the sign', () => {
    // SF to NYC is roughly east-northeast; anything westerly means a sign is flipped.
    const bearing = bearingDegrees(SF, NYC);
    expect(bearing).toBeGreaterThan(40);
    expect(bearing).toBeLessThan(100);
  });

  it('points south from Black Rock City to Reno', () => {
    const bearing = bearingDegrees(BRC, RENO);
    expect(bearing).toBeGreaterThan(150);
    expect(bearing).toBeLessThan(210);
  });

  it('due east across the same latitude is ninety degrees', () => {
    expect(Math.round(bearingDegrees(fix(0, 0), fix(0, 1)))).toBe(90);
  });

  it('wraps into 0 to 360', () => {
    const bearing = bearingDegrees(fix(0, 1), fix(0, 0));
    expect(bearing).toBeGreaterThanOrEqual(0);
    expect(bearing).toBeLessThan(360);
    expect(Math.round(bearing)).toBe(270);
  });
});

describe('compass points', () => {
  it('labels the cardinal directions', () => {
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(90)).toBe('E');
    expect(compassPoint(180)).toBe('S');
    expect(compassPoint(270)).toBe('W');
  });

  it('labels the intercardinal ones', () => {
    expect(compassPoint(45)).toBe('NE');
    expect(compassPoint(202.5)).toBe('SSW');
  });
});

describe('formatting', () => {
  it('keeps meters human under a kilometre', () => {
    expect(formatDistance(834)).toBe('830 m');
    expect(formatDistance(12)).toBe('10 m');
  });

  it('switches to kilometres without false precision', () => {
    expect(formatDistance(145_300)).toBe('145.3 km');
    expect(formatDistance(413_400)).toBe('413.4 km');
  });

  it('drops false precision far away', () => {
    expect(formatDistance(1_456_789)).toBe('1457 km');
  });

  it('states accuracy as a radius', () => {
    expect(formatAccuracy(12.4)).toBe('± 12 m');
  });
});

describe('the wire shape', () => {
  it('round trips a fix through encode and decode', () => {
    const {encodeFix} = require('../src/hop/location');
    expect(decodeFix(encodeFix(BRC))).toEqual(BRC);
  });

  it('refuses anything that is not a well-formed fix, rather than inventing one', () => {
    expect(decodeFix('not json')).toBeNull();
    expect(decodeFix('{"lat": "40.7", "lon": -119, "accuracy": 5, "at": 1}')).toBeNull();
    expect(decodeFix('{"lat": 91, "lon": -119, "accuracy": 5, "at": 1}')).toBeNull();
    expect(decodeFix('{"lat": 40.7, "lon": 181, "accuracy": 5, "at": 1}')).toBeNull();
    expect(decodeFix('{"lat": 40.7, "lon": -119, "accuracy": -1, "at": 1}')).toBeNull();
    expect(decodeFix('{"lat": 40.7, "lon": -119}')).toBeNull();
    expect(decodeFix('null')).toBeNull();
  });
});

describe('the plain message for a failed location request', () => {
  const {locationErrorNote} = require('../src/hop/location');

  it('names the permission when it was refused', () => {
    expect(locationErrorNote({code: 1, message: 'User denied'})).toBe(
      'Location permission is off. Enable it in Settings to share where you are.',
    );
  });

  it('names the reason when the position was unavailable, and says nothing was sent', () => {
    const note = locationErrorNote({code: 2, message: 'Unable to fetch'});
    expect(note).toContain('No location available (Unable to fetch)');
    expect(note).toContain('Nothing was sent');
  });

  it('survives a timeout with no message at all', () => {
    const note = locationErrorNote({code: 3});
    expect(note).toContain('No location available');
    expect(note).toContain('Nothing was sent');
    expect(note).not.toContain('()');
  });
});
