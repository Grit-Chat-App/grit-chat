// Your identity: the address other people reach you at, as text and as a scannable QR, plus the
// relay endpoint and the honest state of this node.
//
// Three things on this screen are deliberate:
//
// 1. The address is drawn in fixed groups rather than as one wrapped string (see AddressText), and
//    the copy button copies the real value. The Swift app shipped a wrapped address with an inserted
//    hyphen, a character base58 does not contain, which is a lie to anyone reading it aloud.
// 2. The relay endpoint is editable and can be CLEARED. There is no default: an app that quietly
//    dials a host after you removed it would be misreporting where your messages go.
// 3. Node state is stated as facts, including the unglamorous ones: whether the store is persistent,
//    and whether a prekey bundle was published (without one, nobody can seal a message to you).

import React, {useCallback, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import Clipboard from '@react-native-clipboard/clipboard';
import QRCode from 'react-native-qrcode-svg';

import {AddressText} from '../components/AddressText';
import {
  Field,
  GhostButton,
  Note,
  PrimaryButton,
  RelayPill,
  Screen,
  ScreenHeader,
  SectionTitle,
} from '../components/chrome';
import {Branding} from '../branding';
import {palette, radius, space, type} from '../design/tokens';
import {buildLabel} from '../config';
import {useGrit, useReadyGrit, useRelayState} from '../app/GritContext';
import {localNetworkHint} from '../hop/localNetwork';
import type {RootStackParamList} from '../app/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Identity'>;

export function IdentityScreen({navigation}: Props): React.JSX.Element {
  const {seam} = useReadyGrit();
  const {config, lastProof} = useGrit();
  const relay = useRelayState();
  const [draft, setDraft] = useState(seam.relayUrl() ?? '');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const applyRelay = useCallback(async () => {
    setBusy(true);
    setNote(null);
    try {
      await seam.setRelayUrl(draft);
      setNote(
        draft.trim().length === 0
          ? 'Relay cleared. Messages cannot leave this device until you set one.'
          : `Dialing ${draft.trim()}`,
      );
    } catch (e) {
      setNote(String(e));
    } finally {
      setBusy(false);
    }
  }, [draft, seam]);

  return (
    <Screen testID="screen-identity">
      <ScreenHeader
        title="Your address"
        subtitle={Branding.runsOn}
        compact
        onBack={() => navigation.goBack()}
        right={<RelayPill state={relay.state} testID="identity-relay-pill" />}
      />
      <ScrollView contentContainerStyle={styles.body} testID="identity-scroll">
        <View style={styles.qrFrame} testID="identity-qr">
          <QRCode
            value={seam.address}
            size={188}
            color={palette.abyss}
            backgroundColor={palette.alkali}
          />
        </View>
        <AddressText address={seam.address} testID="identity-address" />
        <GhostButton
          label="Copy address"
          icon="clipboard"
          onPress={() => {
            Clipboard.setString(seam.address);
            setNote('Address copied.');
          }}
          testID="identity-copy"
        />
        <GhostButton
          label="Edit your profile"
          icon="user"
          onPress={() => navigation.navigate('Profile')}
          testID="identity-open-profile"
        />

        <View style={styles.divider} />

        <SectionTitle>Relay</SectionTitle>
        <Note testID="identity-relay-meaning">{Branding.relayMeaning}</Note>
        {relay.state === 'unconfigured' ? (
          <Note tone="warn" testID="identity-relay-unconfigured">
            {Branding.relayUnconfigured}
          </Note>
        ) : null}
        {relay.detail != null ? (
          <Text style={styles.mono} testID="identity-relay-detail">
            {relay.detail}
          </Text>
        ) : null}
        {localNetworkHint(seam.relayUrl(), relay.state) != null ? (
          <Note tone="warn" testID="identity-localnet-hint">
            {localNetworkHint(seam.relayUrl(), relay.state)}
          </Note>
        ) : null}
        <Note testID="identity-relay-guidance">
          Set an operator-provided WSS endpoint here. A development relay can disappear, and a link
          opening never proves delivery.
        </Note>
        <Field
          testID="identity-relay-input"
          label="Operator relay endpoint"
          value={draft}
          onChangeText={setDraft}
          placeholder="wss://relay.example/"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <PrimaryButton
          label="Use this relay"
          icon="signal"
          onPress={() => void applyRelay()}
          busy={busy}
          testID="identity-relay-apply"
        />
        <Text style={styles.mono} testID="identity-relay-config">
          {config.relayUrl != null
            ? 'build supplied an endpoint; delivery confirms it is usable'
            : 'built with no relay configured'}
        </Text>
        {note != null ? <Note testID="identity-note">{note}</Note> : null}

        <View style={styles.divider} />

        <SectionTitle>This node</SectionTitle>
        <Text style={styles.mono} testID="identity-node-state">
          store persistent: {String(seam.isPersistent)}
          {'\n'}prekey published: {String(seam.prekeyPublished)}
          {'\n'}identity: held in the platform keystore
        </Text>
        {/* Which build this is. It sits with the other machine-generated facts rather than under a
            section of its own, because that is what it is: version 1.0 build 1 is frozen in the
            project, so this line is the only thing that tells one build from another. */}
        <Text style={styles.build} testID="identity-build">
          {buildLabel(config.buildSha, config.buildTime)}
        </Text>
        <Note testID="identity-transport-reality">{Branding.transportReality}</Note>

        {lastProof != null ? (
          <>
            <View style={styles.divider} />
            <SectionTitle>Last proof run</SectionTitle>
            <Text style={styles.mono} testID="identity-proof">
              {lastProof}
            </Text>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: space.xl,
    gap: space.l,
  },
  qrFrame: {
    alignSelf: 'flex-start',
    padding: space.m,
    backgroundColor: palette.alkali,
    borderRadius: radius.panel,
  },
  divider: {
    height: 1,
    backgroundColor: palette.line,
    marginVertical: space.s,
  },
  mono: {
    ...type.mono,
    color: palette.dust,
  },
  // Build identity: the faintest ink in the machine layer, because it is a fact you look up rather
  // than something to read every visit.
  build: {
    ...type.monoSmall,
    color: palette.alkaliFaint,
  },
});
