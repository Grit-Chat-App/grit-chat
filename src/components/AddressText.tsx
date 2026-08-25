// An address, rendered so that what is on screen IS the address.
//
// The Swift app shipped a defect worth not repeating: its wrapped address drew an inserted hyphen,
// a character base58 does not contain, so the screen showed something the value did not say. Someone
// reading it aloud, retyping it from a photo, or comparing it against a peer's phone would be
// working from a lie.
//
// React Native has no character-level wrapping for an unbroken string, and inserting spaces or soft
// hyphens would put invisible characters into copied text. So the address is chunked into fixed
// groups and drawn as separate lines, in the mono face where every character is unambiguous, and
// copying uses the original string rather than what is laid out.

import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {addressChunks} from '../format';
import {palette, radius, space, type} from '../design/tokens';

export interface AddressTextProps {
  address: string;
  /** Characters per line. Twelve fits comfortably at this size on the narrowest phone. */
  perLine?: number;
  testID?: string;
}

export function AddressText({address, perLine = 12, testID}: AddressTextProps): React.JSX.Element {
  const chunks = addressChunks(address, perLine);
  return (
    // The container carries the whole address as its label. The chunks below are the visual layout
    // only: a screen reader (and an end to end harness) should hear the address itself, not a row
    // of twelve-character fragments.
    <View style={styles.frame} testID={testID} accessibilityLabel={address}>
      {chunks.map((chunk, index) => (
        <Text key={`${index}:${chunk}`} style={styles.line} allowFontScaling>
          {chunk}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: palette.abyss,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: palette.line,
    paddingVertical: space.m,
    paddingHorizontal: space.l,
    alignSelf: 'flex-start',
  },
  line: {
    ...type.monoMedium,
    color: palette.alkali,
    letterSpacing: 1.2,
  },
});
