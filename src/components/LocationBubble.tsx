// A location message bubble. No map tiles: a tile needs the network and is blank exactly when
// this matters. What carries with zero connectivity: the coordinates, and, when the RECEIVER has
// their own fix, a bearing and a distance from where they are standing.
//
// The receiver's own fix is requested when a location bubble renders and held only for this
// screen: it is a reference point for reading this message, not a tracked position, and the app
// does not keep requesting it in the background.
//
// Honest states, and nothing else:
//   fix + own fix    coordinates, accuracy, bearing and distance from the receiver's position
//   fix, no own fix  coordinates and accuracy, with the reason distance is absent
//   no permission    same as no own fix, naming the permission as the cause
//   unparseable      said in words; never invented coordinates

import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {readOneFix} from '../hop/geolocation';
import Icon from 'react-native-vector-icons/FontAwesome';

import {palette, radius, space, type} from '../design/tokens';
import {timeLabel} from '../format';
import {
  bearingDegrees,
  compassPoint,
  decodeFix,
  distanceMeters,
  formatAccuracy,
  formatDistance,
} from '../hop/location';
import type {LocationFix} from '../hop/location';

type OwnFixState =
  | {kind: 'waiting'}
  | {kind: 'fix'; fix: LocationFix}
  | {kind: 'unavailable'; reason: string};

export function LocationBubble({
  body,
  at,
  testID,
  fromHere,
}: {
  body: string;
  at: number;
  testID: string;
  /** Show the distance and bearing from the reader's own fix. A RECEIVER's aid: for the sender's
   *  own message the distance to themselves is meaningless, so outbound rows leave it off. */
  fromHere: boolean;
}): React.JSX.Element {
  const fix = decodeFix(body);
  const [own, setOwn] = useState<OwnFixState>({kind: 'waiting'});

  useEffect(() => {
    if (!fromHere) {
      return;
    }
    // One-shot, on mount of this bubble: a reference for reading, never a tracker.
    let live = true;
    readOneFix()
      .then((fix) => {
        if (live) {
          setOwn({kind: 'fix', fix});
        }
      })
      .catch(() => {
        // PERMISSION_DENIED, POSITION_UNAVAILABLE and TIMEOUT all mean the same honest thing
        // here: no reference point, so no distance or bearing is shown.
        if (live) {
          setOwn({kind: 'unavailable', reason: 'no fix'});
        }
      });
    return () => {
      live = false;
    };
  }, [fromHere]);

  if (fix == null) {
    return (
      <View style={styles.frame} testID={testID}>
        <View style={styles.titleRow}>
          <Icon name="map-marker" size={16} color={palette.emberBright} />
          <Text style={styles.titleWarn}>a location that could not be read</Text>
        </View>
        <Text style={styles.coordsBad}>the message did not carry a well-formed fix</Text>
      </View>
    );
  }

  const coordText = `${fix.lat.toFixed(5)}, ${fix.lon.toFixed(5)}`;

  return (
    <View style={styles.frame} testID={testID}>
      <View style={styles.titleRow}>
        <Icon name="map-marker" size={16} color={palette.sodiumBright} />
        <Text style={styles.title} testID={`${testID}-title`}>
          location shared
        </Text>
      </View>
      <Text style={styles.coords} testID={`${testID}-coords`}>
        {coordText}
      </Text>
      <Text style={styles.meta} testID={`${testID}-accuracy`}>
        {formatAccuracy(fix.accuracy)} · at {timeLabel(fix.at)}
      </Text>
      {own.kind === 'fix' && fromHere ? (
        <Text style={styles.meta} testID={`${testID}-from-here`}>
          {formatDistance(distanceMeters(own.fix, fix))} {compassPoint(bearingDegrees(own.fix, fix))} (
          {Math.round(bearingDegrees(own.fix, fix))}°) from your position
        </Text>
      ) : own.kind === 'unavailable' && fromHere ? (
        <Text style={styles.metaDim} testID={`${testID}-no-own-fix`}>
          no fix on your position, so no distance shown
        </Text>
      ) : fromHere ? (
        <Text style={styles.metaDim} testID={`${testID}-own-fix-waiting`}>
          reading your position for a distance…
        </Text>
      ) : null}
    </View>
  );
}



const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: palette.lineStrong,
    backgroundColor: palette.abyss,
    padding: space.m,
    gap: space.xs,
    minWidth: 200,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
  },
  title: {
    ...type.bodyStrong,
    color: palette.sodiumBright,
  },
  titleWarn: {
    ...type.bodyStrong,
    color: palette.emberBright,
  },
  coords: {
    ...type.monoMedium,
    color: palette.alkali,
  },
  coordsBad: {
    ...type.monoSmall,
    color: palette.emberBright,
  },
  meta: {
    ...type.monoSmall,
    color: palette.dust,
  },
  metaDim: {
    ...type.monoSmall,
    color: palette.alkaliFaint,
  },
});
