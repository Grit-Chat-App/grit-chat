// Create a channel, or join one by host address and path. Two forms, one screen, both honest
// about what happens next:
//
//   Creating: this node becomes the host. It holds the topic's keys, moderates it, and the
//   channel is open for this build: anyone holding the host address and path can join. Access
//   modes (invite, request-to-join) exist in the protocol and are deliberately NOT offered here
//   yet, because the moderation UI that does them justice has not been built; offering a switch
//   whose consequences cannot be seen or managed would be decoration.
//
//   Joining: a REQUEST, not membership. The core carries it to the host; membership begins when
//   the host's keys arrive, which this screen cannot see. The list shows the channel as
//   "requested" until then.

import React, {useCallback, useState} from 'react';
import {ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {
  Field,
  GhostButton,
  Note,
  PrimaryButton,
  Screen,
  ScreenHeader,
  SectionTitle,
} from '../components/chrome';
import {palette, radius, space, type} from '../design/tokens';
import {useReadyGrit} from '../app/GritContext';
import type {RootStackParamList} from '../app/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'NewChannel'>;

export function NewChannelScreen({navigation}: Props): React.JSX.Element {
  const {seam, channels} = useReadyGrit();
  const [createPath, setCreatePath] = useState('');
  const [access, setAccess] = useState<'open' | 'requestToJoin' | 'invite'>('open');
  const [joinHost, setJoinHost] = useState('');
  const [joinPath, setJoinPath] = useState('');
  const [createNote, setCreateNote] = useState<string | null>(null);
  const [joinNote, setJoinNote] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const create = useCallback(async () => {
    const path = createPath.trim();
    if (path.length === 0 || creating) {
      return;
    }
    setCreating(true);
    setCreateNote(null);
    try {
      const created = await seam.createChannel(path, access);
      await channels.addHosted(created.path, created.host, access);
      setCreatePath('');
      navigation.replace('Channel', {path: created.path});
    } catch (e) {
      setCreateNote(String(e));
    } finally {
      setCreating(false);
    }
  }, [access, channels, createPath, creating, navigation, seam]);

  const join = useCallback(async () => {
    const host = joinHost.trim();
    const path = joinPath.trim();
    if (host.length === 0 || path.length === 0 || joining) {
      return;
    }
    setJoining(true);
    setJoinNote(null);
    try {
      await seam.joinChannel(host, path);
      await channels.addJoinRequested(path, host);
      setJoinHost('');
      setJoinPath('');
      navigation.replace('Channel', {path});
    } catch (e) {
      setJoinNote(String(e));
    } finally {
      setJoining(false);
    }
  }, [channels, joinHost, joinPath, joining, navigation, seam]);

  return (
    <Screen testID="screen-new-channel">
      <ScreenHeader
        title="New channel"
        compact
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <SectionTitle>Create a channel</SectionTitle>
        <Note testID="new-channel-create-note">
          You host it. For this build a channel is open: anyone who knows your address and the
          path can join. A group message is one encrypted publication flooded once, so a channel
          costs the same whether three people follow it or three hundred.
        </Note>
        <Field
          testID="new-channel-path"
          label="Path"
          value={createPath}
          onChangeText={setCreatePath}
          placeholder="center-camp"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <SectionTitle>Who can join</SectionTitle>
        <View style={styles.accessRow}>
          {(
            [
              ['open', 'Open', 'anyone with your address and the path'],
              ['requestToJoin', 'Approval', 'requests queue for you'],
              ['invite', 'Invite only', 'you invite each member'],
            ] as const
          ).map(([mode, label, note]) => (
            <TouchableOpacity
              key={mode}
              style={[styles.accessCard, access === mode && styles.accessCardOn]}
              onPress={() => setAccess(mode)}
              testID={`new-channel-access-${mode === 'requestToJoin' ? 'approval' : mode === 'invite' ? 'invite' : 'open'}`}
              accessibilityRole="button"
              accessibilityState={{selected: access === mode}}>
              <Text style={[styles.accessLabel, access === mode && styles.accessLabelOn]}>{label}</Text>
              <Text style={styles.accessNote}>{note}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <PrimaryButton
          label="Create channel"
          icon="bullhorn"
          onPress={() => void create()}
          busy={creating}
          disabled={createPath.trim().length === 0}
          testID="new-channel-create"
        />
        {createNote != null ? (
          <Note tone="warn" testID="new-channel-create-status">
            {createNote}
          </Note>
        ) : null}

        <View style={styles.divider} />

        <SectionTitle>Join a channel</SectionTitle>
        <Note testID="new-channel-join-note">
          Joining is a request. Membership begins when the host hands over the channel keys, which
          happens over the relay, not on this screen. The channel appears in your list as
          requested until then.
        </Note>
        <Field
          testID="new-channel-host"
          label="Host address"
          value={joinHost}
          onChangeText={setJoinHost}
          placeholder="base58 address of the host"
          autoCapitalize="none"
          autoCorrect={false}
          multiline
        />
        <Field
          testID="new-channel-join-path"
          label="Path"
          value={joinPath}
          onChangeText={setJoinPath}
          placeholder="center-camp"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <PrimaryButton
          label="Request to join"
          icon="sign-in"
          onPress={() => void join()}
          busy={joining}
          disabled={joinHost.trim().length === 0 || joinPath.trim().length === 0}
          testID="new-channel-join"
        />
        {joinNote != null ? (
          <Note tone="warn" testID="new-channel-join-status">
            {joinNote}
          </Note>
        ) : null}

        <View style={styles.divider} />

        <SectionTitle>Your own address</SectionTitle>
        <GhostButton
          label="Show my address to send them"
          icon="qrcode"
          onPress={() => navigation.navigate('Identity')}
          testID="new-channel-show-mine"
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
  accessRow: {
    flexDirection: 'row',
    gap: space.s,
  },
  accessCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.edge,
    borderRadius: radius.chip,
    padding: space.m,
    gap: space.xs,
  },
  accessCardOn: {
    borderColor: palette.sodium,
    backgroundColor: palette.surface,
  },
  accessLabel: {
    ...type.bodyStrong,
    color: palette.dust,
  },
  accessLabelOn: {
    color: palette.sodiumBright,
  },
  accessNote: {
    ...type.monoSmall,
    color: palette.alkaliFaint,
  },
  divider: {
    height: 1,
    backgroundColor: palette.line,
    marginVertical: space.s,
  },
});
