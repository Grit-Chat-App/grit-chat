// Offline compass for a received location. It has no map tile, URL, web view or network request.
// The received coordinates are the entire target state; foreground GPS and the device compass are
// local sensors, so this still works after the message has crossed the network and every network
// bearer disappears.
//
// Truthfulness, deliberately visible:
// - Initial bearing is true-north geometry from WGS84 coordinates.
// - react-native-nitro-compass delivers magnetic heading by default. We do not call setDeclination
//   because an offline declination model is not present in this app. The screen says magnetic rather
//   than calling its needle true north.
// - No compass hardware, an unavailable permission, or an error means no needle. Distance and
//   bearing stay available when foreground location can be read.
// - This owns a foreground-only watch and stops it on unmount. No background permission or task.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/FontAwesome';
import {NitroCompass} from 'react-native-nitro-compass';

import {GhostButton, Note, PrimaryButton, Screen, ScreenHeader, SectionTitle} from '../components/chrome';
import {palette, radius, size, space, type} from '../design/tokens';
import {watchForegroundFix, type ReadFix} from '../hop/geolocation';
import {LOCATION_ERROR, type LocationFix} from '../hop/location';
import {
  compassReading,
  formatCompassDistance,
  normalizeDegrees,
  relativeTurnDegrees,
  smoothHeading,
} from '../hop/compass';
import type {RootStackParamList} from '../app/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Compass'>;
type LocationState = {kind: 'reading'} | {kind: 'ready'; fix: ReadFix} | {kind: 'denied'} | {kind: 'unavailable'; note: string};
type HeadingState = {kind: 'starting'} | {kind: 'ready'; degrees: number} | {kind: 'unavailable'; note: string};

function targetCoordinates(fix: LocationFix): string {
  return `${fix.lat.toFixed(5)}, ${fix.lon.toFixed(5)}`;
}

function compassLocationNote(error: {code: number; message?: string}): string {
  if (error.code === LOCATION_ERROR.PERMISSION_DENIED) {
    return 'Location permission is off. The target coordinates are still available below.';
  }
  const reason = error.message && error.message.length > 0 ? ` (${error.message})` : '';
  return `No current location available${reason}. Distance and direction will appear when a foreground fix arrives.`;
}

export function CompassScreen({navigation, route}: Props): React.JSX.Element {
  const target = route.params.target;
  const [location, setLocation] = useState<LocationState>({kind: 'reading'});
  const [heading, setHeading] = useState<HeadingState>({kind: 'starting'});
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [restart, setRestart] = useState(0);
  const smooth = useRef<number | null>(null);
  // An unwrapped value lets Animated take the short route through north rather than 359 degrees
  // backwards through the whole dial. It survives renders and only the scalar mutates per sample.
  const needle = useRef(new Animated.Value(0)).current;
  const displayedTurn = useRef(0);

  const retry = useCallback(() => {
    smooth.current = null;
    setLocation({kind: 'reading'});
    setHeading({kind: 'starting'});
    setRestart((value) => value + 1);
  }, []);

  useEffect(() => {
    let live = true;
    const stopLocation = watchForegroundFix(
      (fix) => {
        if (live) {
          setLocation({kind: 'ready', fix});
        }
      },
      (error) => {
        if (!live) {
          return;
        }
        if (error.code === LOCATION_ERROR.PERMISSION_DENIED) {
          setLocation({kind: 'denied'});
          return;
        }
        setLocation({kind: 'unavailable', note: compassLocationNote(error)});
      },
    );

    if (!NitroCompass.hasCompass()) {
      setHeading({kind: 'unavailable', note: 'Compass unavailable on this device.'});
    } else {
      const permission = NitroCompass.getPermissionStatus();
      if (permission === 'denied') {
        setHeading({kind: 'unavailable', note: 'Compass unavailable because location permission is off.'});
      } else {
        // Existing foreground location permission is the only iOS permission this requests. Android
        // sensor access requires none. The native module never requests background location.
        const begin = () => {
          NitroCompass.setSmoothing(1);
          NitroCompass.start(1, (sample) => {
            if (!live || !Number.isFinite(sample.heading)) {
              return;
            }
            const next = smoothHeading(smooth.current, sample.heading, 0.2);
            smooth.current = next;
            setHeading({kind: 'ready', degrees: next});
          });
        };
        if (permission === 'unknown') {
          void NitroCompass.requestPermission().then((next) => {
            if (!live) {
              return;
            }
            if (next === 'granted') {
              begin();
            } else {
              setHeading({kind: 'unavailable', note: 'Compass unavailable because location permission is off.'});
            }
          });
        } else {
          begin();
        }
      }
    }

    return () => {
      live = false;
      stopLocation();
      NitroCompass.stop();
    };
  }, [restart]);

  const reading =
    location.kind === 'ready'
      ? compassReading(location.fix, target, heading.kind === 'ready' ? heading.degrees : null)
      : null;
  if (reading?.relativeTurnDegrees != null) {
    const delta = relativeTurnDegrees(reading.relativeTurnDegrees, normalizeDegrees(displayedTurn.current));
    displayedTurn.current += delta;
    // No allocation of a new Animated.Value per sensor update. A short timing eases noise without
    // hiding a real direction change; circular smoothing happened before this at the sensor seam.
    Animated.timing(needle, {toValue: displayedTurn.current, duration: 110, useNativeDriver: true}).start();
  }

  const rotation = needle.interpolate({
    inputRange: [-360, 0, 360],
    outputRange: ['-360deg', '0deg', '360deg'],
  });
  const status =
    location.kind === 'reading'
      ? 'Reading your position…'
      : location.kind === 'denied'
        ? 'Location permission is off. The target coordinates are still available below.'
        : location.kind === 'unavailable'
          ? location.note
          : heading.kind === 'ready'
            ? 'Magnetic heading. Target bearing is true north; local declination is not applied.'
            : heading.kind === 'unavailable'
              ? heading.note
              : 'Starting compass…';

  return (
    <Screen testID="screen-compass">
      <ScreenHeader title="Compass" subtitle="Offline direction to a shared location" compact onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body} testID="compass-scroll">
        {reading?.relativeTurnDegrees != null ? (
          <View
            style={styles.dial}
            testID="compass-dial"
            accessibilityLabel={`Pointer ${Math.round(reading.relativeTurnDegrees)} degrees toward target`}>
            <Text style={styles.north}>N</Text>
            <Animated.View style={[styles.needle, {transform: [{rotate: rotation}]}]} testID="compass-needle">
              <Icon name="location-arrow" size={76} color={palette.sodiumBright} />
            </Animated.View>
          </View>
        ) : (
          <View style={styles.dialOff} testID="compass-unavailable">
            <Icon name="compass" size={64} color={palette.alkaliFaint} />
            <Text style={styles.dialOffText}>Compass unavailable</Text>
          </View>
        )}

        {reading != null ? (
          <View style={styles.reading} testID="compass-reading">
            <Text style={styles.distance} testID="compass-distance">{formatCompassDistance(reading.distanceMeters)}</Text>
            <Text style={styles.direction} testID="compass-direction">
              {reading.direction} · {Math.round(reading.bearingDegrees)}° true
            </Text>
            {heading.kind === 'ready' ? (
              <Text style={styles.heading} testID="compass-heading">{Math.round(heading.degrees)}° magnetic heading</Text>
            ) : null}
          </View>
        ) : null}

        <Note testID="compass-status">{status}</Note>

        {location.kind === 'denied' ? (
          <PrimaryButton label="Retry location permission" icon="map-marker" onPress={retry} testID="compass-retry-permission" />
        ) : null}

        <TouchableOpacity
          onPress={() => setDetailsOpen((open) => !open)}
          style={styles.detailsButton}
          testID="compass-details-toggle"
          accessibilityRole="button"
          accessibilityLabel={detailsOpen ? 'Hide target coordinates' : 'Show target coordinates'}>
          <Icon name={detailsOpen ? 'chevron-up' : 'chevron-down'} size={size.iconSmall} color={palette.sodiumBright} />
          <Text style={styles.detailsLabel}>{detailsOpen ? 'Hide details' : 'Details'}</Text>
        </TouchableOpacity>
        {detailsOpen ? (
          <View style={styles.details} testID="compass-details">
            <SectionTitle>Shared target</SectionTitle>
            <Text style={styles.coords} testID="compass-target-coordinates">{targetCoordinates(target)}</Text>
          </View>
        ) : null}
        <GhostButton label="Back to conversation" icon="chevron-left" onPress={() => navigation.goBack()} testID="compass-back" />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {padding: space.xl, gap: space.l},
  dial: {height: 232, borderRadius: radius.panel, borderWidth: 1, borderColor: palette.edge, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center'},
  dialOff: {height: 232, borderRadius: radius.panel, borderWidth: 1, borderColor: palette.lineStrong, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center', gap: space.m},
  north: {...type.monoMedium, color: palette.alkali, position: 'absolute', top: space.l},
  needle: {alignItems: 'center', justifyContent: 'center'},
  dialOffText: {...type.bodyStrong, color: palette.alkaliFaint},
  reading: {alignItems: 'center', gap: space.xs},
  distance: {...type.display, color: palette.alkali},
  direction: {...type.bodyStrong, color: palette.sodiumBright},
  heading: {...type.monoSmall, color: palette.alkaliFaint},
  detailsButton: {minHeight: size.touchMin, flexDirection: 'row', alignItems: 'center', gap: space.s, borderWidth: 1, borderColor: palette.edge, borderRadius: radius.chip, paddingHorizontal: space.l},
  detailsLabel: {...type.action, color: palette.sodiumBright},
  details: {gap: space.s, borderWidth: 1, borderColor: palette.lineStrong, borderRadius: radius.chip, padding: space.m, backgroundColor: palette.surface},
  coords: {...type.mono, color: palette.alkali},
});
