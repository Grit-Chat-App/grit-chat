// The conversation list: who you can reach, what was last said, and the honest state of the only
// transport that exists today. Empty is the normal first state and is designed as such: you have an
// address, nobody has it yet, and the first act is to show it or paste theirs.

import React from 'react';
import {FlatList, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/FontAwesome';

import {Branding} from '../branding';
import {GhostButton, Note, PrimaryButton, RelayPill, Screen, ScreenHeader} from '../components/chrome';
import {palette, radius, size, space, type} from '../design/tokens';
import {timeLabel} from '../format';
import {useChannelsVersion, useReadyGrit, useRelayState, useStoreVersion} from '../app/GritContext';
import {relayPlain} from '../design/status';
import {localNetworkHint} from '../hop/localNetwork';
import type {RootStackParamList} from '../app/navigation';
import {ConversationStore, ConversationSummary, shortAddress} from '../store/conversations';
import {ChannelSummary} from '../store/channels';

type Props = NativeStackScreenProps<RootStackParamList, 'Conversations'>;

function preview(item: ConversationSummary): string {
  if (item.last == null) {
    return 'no messages yet';
  }
  const prefix = item.last.direction === 'out' ? 'you: ' : '';
  return `${prefix}${item.last.body}`;
}


// A channel preview names the last speaker through the same local-alias, shared-profile, then
// short-address resolver used everywhere else.
function channelPreview(item: ChannelSummary, store: ConversationStore): string {
  if (item.last == null) {
    return 'no publications yet';
  }
  const prefix = item.last.sender == null ? 'you: ' : `${store.displayNameFor(item.last.sender)}: `;
  return `${prefix}${item.last.body}`;
}

export function ConversationsScreen({navigation}: Props): React.JSX.Element {
  const {seam, store, channels} = useReadyGrit();
  useStoreVersion();
  useChannelsVersion();
  const relay = useRelayState();
  const [relayExpanded, setRelayExpanded] = React.useState(false);
  const conversations = store.conversations();
  const channelRows = channels.summaries();
  const invites = channels.listInvites();

  // An invite only exists here because the arrival handler persisted it the moment it landed:
  // the core's queue is take-and-clear. Accepting joins the channel once the host seals the
  // keys; declining is durable so the host does not re-offer.
  const acceptInvite = async (invite: (typeof invites)[number]) => {
    try {
      await seam.acceptChannelInvite(invite.host, invite.path);
      await channels.clearInvite(invite.host, invite.path);
    } catch {
      // A refused acceptance leaves the invite in place: better than losing it silently.
    }
  };
  const declineInvite = async (invite: (typeof invites)[number]) => {
    await seam.declineChannelInvite(invite.host, invite.path).catch(() => false);
    await channels.clearInvite(invite.host, invite.path);
  };

  return (
    <Screen testID="screen-conversations">
      <ScreenHeader
        title={Branding.displayName}
        subtitle={Branding.tagline}
        right={
          <TouchableOpacity
            onPress={() => navigation.navigate('Identity')}
            style={styles.headerAction}
            testID="open-identity"
            accessibilityRole="button"
            accessibilityLabel="Your identity">
            <Icon name="qrcode" size={size.icon} color={palette.sodiumBright} />
          </TouchableOpacity>
        }
      />

      <View style={styles.statusBlock}>
        {/* The pill keeps the app's own encoding: shape first (a glyph per state), then position,
            then words, then colour. Tapping it expands; it no longer jumps to another screen, and
            the raw pool telemetry no longer greets a person the moment they open the app. */}
        <RelayPill
          state={relay.state}
          onPress={() => setRelayExpanded((open) => !open)}
          testID="relay-pill"
        />
        {relayExpanded ? (
          <View style={styles.statusExpanded} testID="relay-expanded">
            <Text style={styles.statusPlain} testID="relay-detail">
              {relayPlain(relay.state)}
            </Text>
            {relay.detail != null ? (
              <Text style={styles.statusTelemetry} testID="relay-telemetry">
                {relay.detail}
              </Text>
            ) : null}
            {localNetworkHint(seam.relayUrl(), relay.state) != null ? (
              <Note tone="warn" testID="relay-localnet-hint">
                {localNetworkHint(seam.relayUrl(), relay.state)}
              </Note>
            ) : null}
            <GhostButton
              label="Open connection"
              icon="wrench"
              onPress={() => navigation.navigate('Identity')}
              testID="relay-open-connection"
            />
          </View>
        ) : null}
      </View>

      {invites.length > 0 ? (
        <View style={styles.inviteBlock} testID="invites-block">
          {invites.map((invite, index) => (
            <View key={`${invite.host}:${invite.path}`} style={styles.inviteRow} testID={`invite-row-${index}`}>
              <View style={styles.inviteBody}>
                <Text style={styles.inviteTitle} testID={`invite-title-${index}`}>
                  invited to {invite.path}
                </Text>
                <Text style={styles.inviteFrom} testID={`invite-from-${index}`}>
                  from {store.displayNameFor(invite.host)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.inviteAccept}
                onPress={() => void acceptInvite(invite)}
                testID={`invite-accept-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`Accept invite to ${invite.path}`}>
                <Icon name="check" size={size.iconSmall} color={palette.sage} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.inviteDecline}
                onPress={() => void declineInvite(invite)}
                testID={`invite-decline-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`Decline invite to ${invite.path}`}>
                <Icon name="times" size={size.iconSmall} color={palette.emberBright} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}

      {conversations.length === 0 && channelRows.length === 0 && invites.length === 0 ? (
        <View style={styles.empty} testID="conversations-empty">
          <Text style={styles.emptyTitle} testID="empty-headline">{Branding.emptyHeadline}</Text>
          <Text style={styles.emptyLead}>{Branding.emptyLead}</Text>
          {relay.state === 'unconfigured' ? (
            <View style={styles.onboard} testID="relay-onboarding">
              <Text style={styles.onboardTitle}>Grit Chat talks through a relay today</Text>
              <Text style={styles.onboardBody}>
                There is no phone network here and no account. A relay is a small server that carries
                your sealed messages to the person you wrote to. Until one is set, messages stay on
                this device. That is not a fault to hide; it is how the app works.
              </Text>
              <GhostButton
                label="Set up a relay"
                icon="wrench"
                onPress={() => navigation.navigate('Identity')}
                testID="relay-onboarding-open"
              />
            </View>
          ) : null}

          <PrimaryButton
            label="Scan someone"
            icon="camera"
            onPress={() => navigation.navigate('ScanContact')}
            testID="empty-scan-someone"
          />
          <GhostButton
            label="Show my address"
            icon="qrcode"
            onPress={() => navigation.navigate('Identity')}
            testID="empty-show-identity"
          />
          <GhostButton
            label="Add someone by address"
            icon="user-plus"
            onPress={() => navigation.navigate('AddContact')}
            testID="empty-add-contact"
          />
          <GhostButton
            label="Start a channel"
            icon="bullhorn"
            onPress={() => navigation.navigate('NewChannel')}
            testID="new-channel-button"
          />
          <Note testID="conversations-empty-note">
            No phone number, no account, no server that can read your messages. Today a relay carries
            them; the radio that will let phones reach each other directly is not built yet.
          </Note>
        </View>
      ) : (
        <FlatList
          testID="conversations-list"
          data={conversations}
          keyExtractor={(item) => item.contact.address}
          contentContainerStyle={styles.listBody}
          renderItem={({item, index}) => {
            const address = item.contact.address;
            const label = store.displayNameFor(address);
            const named = store.hasDisplayNameFor(address);
            return (
              <TouchableOpacity
                testID={`conversation-row-${index}`}
                style={styles.row}
                onPress={() => navigation.navigate('Chat', {address})}>
                <View style={styles.rowMark}>
                  <Icon name="user-o" size={size.icon} color={palette.sodiumBright} />
                </View>
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={styles.rowTitle} numberOfLines={1} testID={`conversation-label-${index}`}>
                      {label}
                    </Text>
                    <Text style={styles.rowTime}>{timeLabel(item.last?.at)}</Text>
                  </View>
                  <Text style={styles.rowPreview} numberOfLines={1} testID={`conversation-preview-${index}`}>
                    {preview(item)}
                  </Text>
                  {named ? (
                    <Text style={styles.rowAddress} numberOfLines={1} testID={`conversation-address-${index}`}>
                      {shortAddress(address)}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.rowEnd}>
                  {item.unread > 0 ? (
                    <View style={styles.unread} testID={`conversation-unread-${index}`}>
                      <Text style={styles.unreadText}>{item.unread}</Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {channelRows.length > 0 ? (
        <FlatList
          testID="channels-list"
          data={channelRows}
          keyExtractor={(item) => item.channel.path}
          contentContainerStyle={styles.listBody}
          renderItem={({item, index}) => (
            <TouchableOpacity
              testID={`channel-row-${index}`}
              style={styles.row}
              onPress={() => navigation.navigate('Channel', {path: item.channel.path})}>
              <View style={styles.rowMark}>
                <Icon
                  name={item.channel.joinedAt == null ? 'hourglass-half' : 'bullhorn'}
                  size={size.iconSmall}
                  color={item.channel.joinedAt == null ? palette.alkaliFaint : palette.sodium}
                />
              </View>
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowTitle} numberOfLines={1} testID={`channel-label-${index}`}>
                    {item.channel.label}
                  </Text>
                  <Text style={styles.rowTime}>{timeLabel(item.last?.at)}</Text>
                </View>
                <Text style={styles.rowPreview} numberOfLines={1} testID={`channel-preview-${index}`}>
                  {item.channel.joinedAt == null
                    ? 'join requested, keys not received yet'
                    : channelPreview(item, store)}
                </Text>
                <Text style={styles.rowAddress} numberOfLines={1} testID={`channel-host-${index}`}>
                  {item.channel.hosting ? 'you host' : `host ${store.displayNameFor(item.channel.host)}`}
                </Text>
              </View>
              {item.unread > 0 ? (
                <View style={styles.unread} testID={`channel-unread-${index}`}>
                  <Text style={styles.unreadText}>{item.unread}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          )}
        />
      ) : null}

      {conversations.length > 0 || channelRows.length > 0 ? (
        <View style={styles.footerRow}>
          <GhostButton
            label="Add contact"
            icon="user-plus"
            onPress={() => navigation.navigate('AddContact')}
            testID="add-contact-button"
          />
          <GhostButton
            label="New channel"
            icon="bullhorn"
            onPress={() => navigation.navigate('NewChannel')}
            testID="new-channel-button"
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  inviteBlock: {
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
    paddingHorizontal: space.xl,
    paddingVertical: space.m,
    gap: space.m,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
  },
  inviteBody: {
    flex: 1,
    gap: space.xxs,
  },
  inviteTitle: {
    ...type.bodyStrong,
    color: palette.alkali,
  },
  inviteFrom: {
    ...type.monoSmall,
    color: palette.alkaliFaint,
  },
  inviteAccept: {
    width: size.touchMin,
    height: size.touchMin,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: palette.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteDecline: {
    width: size.touchMin,
    height: size.touchMin,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: palette.ember,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAction: {
    width: size.touchMin,
    height: size.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBlock: {
    paddingHorizontal: space.xl,
    paddingTop: space.m,
    paddingBottom: space.s,
    gap: space.s,
  },
  statusExpanded: {
    gap: space.s,
    paddingBottom: space.s,
  },
  // The plain sentence a person reads. Body face, not mono: mono is reserved for machine-generated
  // strings, and a sentence about what is happening is not one.
  statusPlain: {
    ...type.secondary,
    color: palette.dust,
  },
  // The raw pool line, kept because it is genuinely useful, demoted because it is not what a person
  // opening a messenger needs first. Mono, because it is machine-generated.
  statusTelemetry: {
    ...type.monoSmall,
    color: palette.alkaliFaint,
  },
  onboard: {
    borderWidth: 1,
    borderColor: palette.lineStrong,
    borderRadius: radius.panel,
    padding: space.l,
    gap: space.s,
    backgroundColor: palette.surface,
  },
  onboardTitle: {
    ...type.bodyStrong,
    color: palette.alkali,
  },
  onboardBody: {
    ...type.secondary,
    color: palette.dust,
  },
  empty: {
    flex: 1,
    paddingHorizontal: space.xl,
    paddingTop: space.xxl,
    gap: space.l,
    alignItems: 'stretch',
  },
  emptyTitle: {
    ...type.title,
    color: palette.alkali,
  },
  emptyLead: {
    ...type.body,
    color: palette.dust,
  },
  listBody: {
    paddingBottom: space.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingHorizontal: space.xl,
    paddingVertical: space.l,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  rowMark: {
    width: size.avatar,
    height: size.avatar,
    borderRadius: radius.chip,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMarkText: {
    ...type.bodyStrong,
    color: palette.sodiumBright,
  },
  rowNode: {
    width: size.iconSmall,
    height: size.iconSmall,
    borderRadius: size.iconSmall / 2,
    backgroundColor: palette.sodium,
  },
  rowBody: {
    flex: 1,
    gap: space.xxs,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.s,
  },
  rowTitle: {
    ...type.bodyStrong,
    color: palette.alkali,
    flex: 1,
  },
  rowTime: {
    ...type.monoSmall,
    color: palette.alkaliFaint,
  },
  rowPreview: {
    ...type.secondary,
    color: palette.dust,
  },
  rowAddress: {
    ...type.monoSmall,
    color: palette.alkaliFaint,
  },
  rowEnd: {
    alignItems: 'flex-end',
    gap: space.s,
  },
  unread: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: space.s,
    borderRadius: radius.chip,
    backgroundColor: palette.sodium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    ...type.monoMedium,
    color: palette.sodiumDeep,
  },
  footerRow: {
    flexDirection: 'row',
    gap: space.m,
    paddingHorizontal: space.xl,
    paddingVertical: space.l,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
});
