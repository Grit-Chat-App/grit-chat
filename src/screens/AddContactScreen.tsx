// Add a contact by address. Two ways in: paste, and scan a QR from the other phone.
//
// The paste path validates with the same base58 decoder the native SDKs use, so an unparseable
// string is refused here rather than becoming a contact row that silently never receives anything.
//
// The scan path is honest about hardware. The camera scanner is not in this build: adding a camera
// pod is a separate change, and a simulator has no camera to prove it with. So the button says what
// it is instead of opening a black rectangle and pretending.

import React, {useCallback, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {Field, GhostButton, Note, PrimaryButton, Screen, ScreenHeader, SectionTitle} from '../components/chrome';
import {palette, space, type} from '../design/tokens';
import {useReadyGrit} from '../app/GritContext';
import type {RootStackParamList} from '../app/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'AddContact'>;

export function AddContactScreen({navigation}: Props): React.JSX.Element {
  const {seam, store} = useReadyGrit();
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [tone, setTone] = useState<'quiet' | 'warn'>('quiet');
  const [busy, setBusy] = useState(false);

  const save = useCallback(async () => {
    const typed = address.trim();
    if (typed.length === 0) {
      setTone('warn');
      setNote('Paste an address first.');
      return;
    }
    if (typed === seam.address) {
      setTone('warn');
      setNote('That is this device, not a peer.');
      return;
    }
    setBusy(true);
    try {
      // Real validation by the SDK's own decoder: it returns null for anything that is not exactly a
      // 32 byte address.
      const valid = await seam.validateAddress(typed);
      if (!valid) {
        setTone('warn');
        setNote('Not a Hop address. A base58 encoding of 32 bytes is expected.');
        return;
      }
      const {added} = await store.addContact(typed, label.trim());
      setTone('quiet');
      setNote(added ? 'Added.' : 'Already in your list, name updated.');
      navigation.navigate('Chat', {address: typed});
    } catch (e) {
      setTone('warn');
      setNote(`Could not read that address: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }, [address, label, navigation, seam, store]);

  return (
    <Screen testID="screen-add-contact">
      <ScreenHeader title="Add contact" compact onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <SectionTitle>Their address</SectionTitle>
        <Note testID="add-contact-note">
          Ask them to show their address on their identity screen and paste it here. Nothing is
          discovered automatically in this build, so an address is how a person is found.
        </Note>
        <Field
          testID="add-contact-address"
          value={address}
          onChangeText={setAddress}
          placeholder="base58 address from the other device"
          autoCapitalize="none"
          autoCorrect={false}
          multiline
        />
        <Field
          testID="add-contact-label"
          label="Name (optional)"
          value={label}
          onChangeText={setLabel}
          placeholder="what you want to call them"
          autoCapitalize="words"
        />
        <PrimaryButton
          label="Add contact"
          icon="user-plus"
          onPress={() => void save()}
          busy={busy}
          testID="add-contact-save"
        />
        {note != null ? (
          <Note tone={tone} testID="add-contact-status">
            {note}
          </Note>
        ) : null}

        <View style={styles.divider} />

        <SectionTitle>Scan a QR</SectionTitle>
        <Note testID="add-contact-scan-note">
          Point the camera at the code on their identity screen and they are a contact, no typing.
          Paste above when someone reads you an address instead: the scanner is useless over a
          radio.
        </Note>
        <PrimaryButton
          label="Scan a QR code"
          icon="camera"
          onPress={() => navigation.navigate('ScanContact')}
          testID="add-contact-scan"
        />
        <GhostButton
          label="Show my address instead"
          icon="qrcode"
          onPress={() => navigation.navigate('Identity')}
          testID="add-contact-show-mine"
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: space.xl,
    gap: space.l,
  },
  divider: {
    height: 1,
    backgroundColor: palette.line,
    marginVertical: space.s,
  },
  headline: {
    ...type.title,
    color: palette.alkali,
  },
});
