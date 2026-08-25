// Host a channel: who is waiting to join, who is in, and who you invite.
//
// What this screen is honest about, by construction:
//
// - Approval is the ONLY thing that hands over a content key. A pending request is a person
//   waiting, not a member, and denying one is not a removal.
// - Removal is key rotation (hpsRekey), and the screen says what that means: the removed member
//   keeps everything they already read and can decrypt nothing published after. Nothing here is
//   presented as unsending a message, because nothing in Hop unsends a message.
// - Inviting is host to address. The invitee still accepts or declines on their side; an invite
//   sent is not a member added.

import React, {useCallback, useEffect, useState} from 'react';
import {ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/FontAwesome';

import {Field, Note, PrimaryButton, Screen, ScreenHeader, SectionTitle} from '../components/chrome';
import {palette, radius, size, space, type} from '../design/tokens';
import {useReadyGrit, useStoreVersion} from '../app/GritContext';
import type {RootStackParamList} from '../app/navigation';
import {shortAddress} from '../store/conversations';

type Props = NativeStackScreenProps<RootStackParamList, 'ChannelManage'>;

export function ChannelManageScreen({navigation, route}: Props): React.JSX.Element {
  const {path} = route.params;
  const {seam, store, channels} = useReadyGrit();
  // Approving or removing a person is the highest stakes act in this app, so it names them the same
  // way every other screen does; a rename has to reach this screen too.
  useStoreVersion();
  const channel = channels.channelByPath(path);

  const [pending, setPending] = useState<string[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [inviteAddress, setInviteAddress] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [p, m] = await Promise.all([
      seam.channelPending(path).catch(() => []),
      seam.channelMembers(path).catch(() => []),
    ]);
    setPending(p);
    setMembers(m);
  }, [path, seam]);

  useEffect(() => {
    void refresh();
    // A join request travels over the relay and lands AFTER this screen has mounted; a host
    // watching requests arrive needs a live list, not the snapshot from when they tapped Manage.
    const interval = setInterval(() => {
      void refresh();
    }, 2000);
    return () => clearInterval(interval);
  }, [refresh]);

  const act = useCallback(
    async (work: () => Promise<void>, done: string) => {
      setBusy(true);
      setNote(null);
      try {
        await work();
        setNote(done);
        await refresh();
      } catch (e) {
        setNote(String(e));
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  if (channel == null || !channel.hosting) {
    return (
      <Screen testID="screen-channel-manage">
        <ScreenHeader title={path} compact onBack={() => navigation.goBack()} />
        <View style={styles.empty}>
          <Note testID="manage-not-host">
            You do not host this channel, so there is nothing to manage here.
          </Note>
        </View>
      </Screen>
    );
  }

  return (
    <Screen testID="screen-channel-manage">
      <ScreenHeader
        title={`manage ${channel.label}`}
        subtitle={`you host, ${channel.access}`}
        compact
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.body}>
        <SectionTitle>Waiting to join</SectionTitle>
        {pending.length === 0 ? (
          <Note testID="manage-pending-empty">Nobody waiting. A request to join appears here.</Note>
        ) : (
          pending.map((requester, index) => (
            <View key={requester} style={styles.row} testID={`manage-pending-${index}`}>
              {/* Name first, then the address underneath. Both, on purpose: this is the one screen
                  where a person is granting access to a cryptographic identity, so the string they
                  can compare against a peer must stay on screen. */}
              <View style={styles.who}>
                <Text style={styles.whoName} numberOfLines={1}>
                  {store.labelFor(requester)}
                </Text>
                <Text style={styles.address} numberOfLines={1}>
                  {shortAddress(requester)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.approve}
                disabled={busy}
                onPress={() =>
                  void act(async () => {
                    await seam.approveChannelJoin(path, requester);
                  }, `approved ${store.labelFor(requester)}`)
                }
                testID={`manage-approve-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`Approve ${store.labelFor(requester)}`}>
                <Icon name="check" size={size.iconSmall} color={palette.sage} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deny}
                disabled={busy}
                onPress={() =>
                  void act(async () => {
                    await seam.denyChannelJoin(path, requester);
                  }, `denied ${store.labelFor(requester)}`)
                }
                testID={`manage-deny-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`Deny ${store.labelFor(requester)}`}>
                <Icon name="times" size={size.iconSmall} color={palette.emberBright} />
              </TouchableOpacity>
            </View>
          ))
        )}

        <View style={styles.divider} />

        <SectionTitle>Members</SectionTitle>
        <Note testID="manage-revoke-note">
          Removing a member rotates the channel key and leaves them out of what comes next. They
          keep everything they already read: nothing here unsends a message, because no message can
          be unsent.
        </Note>
        {members.length === 0 ? (
          <Note testID="manage-members-empty">No members yet.</Note>
        ) : (
          members.map((member, index) => (
            <View key={member} style={styles.row} testID={`manage-member-${index}`}>
              <View style={styles.who}>
                <Text style={styles.whoName} numberOfLines={1}>
                  {store.labelFor(member)}
                </Text>
                <Text style={styles.address} numberOfLines={1}>
                  {shortAddress(member)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.deny}
                disabled={busy}
                onPress={() =>
                  void act(async () => {
                    await seam.removeChannelMembers(path, [member]);
                  }, `removed ${store.labelFor(member)}: key rotated`)
                }
                testID={`manage-remove-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${store.labelFor(member)}`}>
                <Icon name="user-times" size={size.iconSmall} color={palette.emberBright} />
              </TouchableOpacity>
            </View>
          ))
        )}

        <View style={styles.divider} />

        <SectionTitle>Invite someone</SectionTitle>
        <Field
          testID="manage-invite-address"
          value={inviteAddress}
          onChangeText={setInviteAddress}
          placeholder="base58 address to invite"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <PrimaryButton
          label="Send invite"
          icon="envelope"
          busy={busy}
          disabled={inviteAddress.trim().length === 0}
          onPress={() =>
            void act(async () => {
              await seam.inviteToChannel(path, inviteAddress.trim());
              setInviteAddress('');
            }, 'invite sent')
          }
          testID="manage-invite-send"
        />

        {note != null ? (
          <Note testID="manage-status">{note}</Note>
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
  empty: {
    flex: 1,
    paddingHorizontal: space.xl,
    paddingTop: space.xxl,
  },
  divider: {
    height: 1,
    backgroundColor: palette.line,
    marginVertical: space.s,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingVertical: space.s,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  // The person: their name on top in the body face, the address under it in mono. The address keeps
  // the mono face because it is machine-generated and is compared character by character.
  who: {
    flex: 1,
    gap: 2,
  },
  whoName: {
    ...type.bodyStrong,
    color: palette.alkali,
  },
  address: {
    ...type.monoSmall,
    color: palette.dust,
  },
  approve: {
    width: size.touchMin,
    height: size.touchMin,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: palette.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deny: {
    width: size.touchMin,
    height: size.touchMin,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: palette.ember,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
