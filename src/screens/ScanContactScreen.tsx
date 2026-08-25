// Scan a QR code from the other device's identity screen and add them as a contact.
//
// The camera decodes natively (react-native-camera-kit); the accept flow is the same one the
// paste path uses, so a scanned address is validated by the SDK's own decoder before it becomes
// a contact, exactly like a pasted one. A code that is not a Hop address says so on screen
// rather than navigating away with nothing.
//
// Paste stays first-class: a scanner is useless when someone reads you an address over a radio,
// so this screen is an option off Add contact, not the way in.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Camera, CameraType} from 'react-native-camera-kit';

import {Note, Screen, ScreenHeader} from '../components/chrome';
import {palette, radius, space, type} from '../design/tokens';
import {acceptScannedAddress} from '../contacts/acceptAddress';
import {useReadyGrit} from '../app/GritContext';
import type {RootStackParamList} from '../app/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanContact'>;

export function ScanContactScreen({navigation}: Props): React.JSX.Element {
  const {seam, store} = useReadyGrit();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The camera fires on every frame while a code is visible. Without this latch a single code
  // becomes dozens of adds in the same second.
  const handled = useRef(false);

  const onReadCode = useCallback(
    (event: {nativeEvent: {codeStringValue?: string}}) => {
      const text = event.nativeEvent.codeStringValue;
      if (text == null || handled.current) {
        return;
      }
      handled.current = true;
      setBusy(true);
      void (async () => {
        const outcome = await acceptScannedAddress(
          (t) => seam.validateAddress(t),
          async (address) => {
            await store.addContact(address);
          },
          seam.address,
          text,
        );
        if (outcome.ok && outcome.address != null) {
          navigation.replace('Chat', {address: outcome.address});
        } else {
          setBusy(false);
          setError(outcome.reason ?? 'Could not read that address.');
          // Let them re-aim: the next frame may be a different code.
          setTimeout(() => {
            handled.current = false;
          }, 1500);
        }
      })();
    },
    [navigation, seam, store],
  );

  useEffect(() => {
    handled.current = false;
  }, []);

  return (
    <Screen testID="screen-scan-contact">
      <ScreenHeader title="Scan their code" compact onBack={() => navigation.goBack()} />
      <View style={styles.cameraWrap}>
        <Camera
          testID="scan-camera"
          style={styles.camera}
          cameraType={CameraType.Back}
          scanBarcode
          showFrame
          frameColor={palette.sodium}
          laserColor={palette.sodium}
          onReadCode={onReadCode}
        />
        <View style={styles.hintBar}>
          <Text style={styles.hint} testID="scan-hint">
            {busy ? 'reading the address' : 'point at the code on their identity screen'}
          </Text>
        </View>
      </View>
      {error != null ? (
        <View style={styles.errorRow}>
          <Note tone="warn" testID="scan-error">
            {error}
          </Note>
        </View>
      ) : null}
      <View style={styles.noteRow}>
        <Note testID="scan-paste-note">
          No camera handy? The paste path on Add contact takes the same address.
        </Note>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cameraWrap: {
    flex: 1,
    backgroundColor: palette.abyss,
  },
  camera: {
    flex: 1,
  },
  hintBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: space.xxl,
    alignItems: 'center',
  },
  hint: {
    ...type.monoMedium,
    color: palette.alkali,
    backgroundColor: palette.abyss,
    paddingHorizontal: space.l,
    paddingVertical: space.s,
    borderRadius: radius.chip,
    overflow: 'hidden',
  },
  errorRow: {
    paddingHorizontal: space.xl,
    paddingTop: space.m,
  },
  noteRow: {
    paddingHorizontal: space.xl,
    paddingVertical: space.l,
  },
});
