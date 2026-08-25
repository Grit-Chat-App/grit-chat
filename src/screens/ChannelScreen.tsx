// One channel conversation. A group message is a single content-key-encrypted publication
// flooded once, so there is no per-recipient delivery state here and no checkmark theatre:
// our own posts show exactly what the core reported ("published"), inbound posts show their
// verified writer, and for a channel we host, reach counts the members who acked.
//
// Nothing on this screen implies a message can be unsent. Revocation in Hop is key rotation:
// a removed member keeps what they read and can decrypt nothing after. That truth belongs to
// the moderation screen that will exist later, not hidden in a swipe gesture here.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  FlatList,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/FontAwesome';

import {Note, RelayPill, Screen, ScreenHeader} from '../components/chrome';
import {palette, radius, size, space, type} from '../design/tokens';
import {timeLabel} from '../format';
import {useChannelsVersion, useReadyGrit, useRelayState, useStoreVersion} from '../app/GritContext';
import {readOneFix} from '../hop/geolocation';
import {LocationBubble} from '../components/LocationBubble';
import {LocationFix, decodeFix, encodeFix, locationErrorNote} from '../hop/location';
import type {RootStackParamList} from '../app/navigation';
import {StoredChannelMessage} from '../store/channels';
import {shortAddress} from '../store/conversations';
import {focus} from '../notifications/focus';
import {askToNotifyOnce} from '../notifications/bridge';

type Props = NativeStackScreenProps<RootStackParamList, 'Channel'>;

export function ChannelScreen({navigation, route}: Props): React.JSX.Element {
  const {path} = route.params;
  const {seam, store, channels} = useReadyGrit();
  useChannelsVersion();
  // The names shown beside each publication come from the contact store, so a rename has to
  // re-render this screen too.
  useStoreVersion();
  const relay = useRelayState();

  const [draft, setDraft] = useState('');
  // A location about to be shared into this channel, held until the fan-out is confirmed.
  const [confirmingLocation, setConfirmingLocation] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [reach, setReach] = useState<number | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const listRef = useRef<FlatList<StoredChannelMessage> | null>(null);

  // Same reasoning as ChatScreen: the keyboard height is tracked and spent as padding, because
  // KeyboardAvoidingView was measured lifting the composer by less than the keyboard's height and
  // leaving the control row underneath it.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const shown = Keyboard.addListener(show, (e) => setKeyboardHeight(e.endCoordinates.height));
    const hidden = Keyboard.addListener(hide, () => setKeyboardHeight(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  const channel = channels.channelByPath(path);
  const messages = channels.messagesFor(path);

  // Read state and reach refresh on every open and on every new message.
  useEffect(() => {
    void channels.markRead(path);
  }, [channels, path, messages.length]);

  // Tell the arrival wiring what is on screen so a publication already being read is never announced.
  useEffect(() => {
    focus.openTopic(path);
    // Same reasoning as ChatScreen: ask where a banner would mean something, not at launch.
    askToNotifyOnce();
    return () => {
      focus.openTopic(null);
    };
  }, [path]);

  useEffect(() => {
    if (channel?.hosting !== true) {
      setReach(null);
      return;
    }
    let live = true;
    void seam
      .channelReach(path)
      .then((count) => {
        if (live) {
          setReach(count);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [channel?.hosting, path, seam, messages.length]);

  const send = useCallback(async () => {
    const body = draft.trim();
    if (body.length === 0 || sending) {
      return;
    }
    setSending(true);
    setSendError(null);
    let acceptedId: string | null = null;
    try {
      // The store row is written by appendPublished the moment the core takes the publication;
      // there is no delivery state after that, because there is nothing per-recipient to track.
      const id = await seam.publishChannel(path, body);
      acceptedId = id;
      setDraft('');
      await channels.appendPublished(path, body, id);
    } catch (e) {
      setSendError(String(e));
      if (acceptedId != null) {
        await channels.markFailed(acceptedId);
      }
    } finally {
      setSending(false);
    }
  }, [channels, draft, path, sending, seam]);

  // A publication goes to EVERY member of the channel, and a location is the most personal thing
  // this app can publish. The confirmation is confirm-FIRST: tapping the marker shows what will
  // happen and names the fan-out BEFORE any position is read, and the fix is only taken if the
  // user goes ahead. Someone who cancels never shares a position at all, and nobody tells a
  // channel where they are by accident.
  const requestLocation = useCallback(() => {
    setLocationNote(null);
    setConfirmingLocation(true);
  }, []);

  const confirmLocation = useCallback(async () => {
    setConfirmingLocation(false);
    setLocationNote(null);
    try {
      const fix = await readOneFix();
      const body = encodeFix(fix);
      const id = await seam.publishChannel(path, body);
      await channels.appendPublished(path, body, id);
    } catch (e) {
      // A failed read after a confirmed intent is said plainly; nothing was published.
      setLocationNote(
        e != null && typeof e === 'object' && 'code' in e
          ? locationErrorNote(e as {code: number; message?: string})
          : String(e),
      );
    }
  }, [channels, path, seam]);

  const leave = useCallback(async () => {
    if (leaving) {
      return;
    }
    setLeaving(true);
    setLeaveError(null);
    try {
      const ok = await seam.leaveChannel(path);
      if (!ok) {
        setLeaveError('Hop refused the leave. The channel is unchanged.');
        return;
      }
      await channels.removeChannel(path);
      navigation.goBack();
    } catch (e) {
      setLeaveError(String(e));
    } finally {
      setLeaving(false);
    }
  }, [channels, leaving, navigation, path, seam]);

  if (channel == null) {
    // Reconcile removed it (left elsewhere, or keys never arrived). State it rather than render
    // an empty shell that reads as an empty channel.
    return (
      <Screen testID="screen-channel">
        <ScreenHeader title={path} compact onBack={() => navigation.goBack()} />
        <View style={styles.empty}>
          <Note testID="channel-gone-note">
            This channel is not on this node anymore. It was either left, or its keys never
            arrived after the join request.
          </Note>
        </View>
      </Screen>
    );
  }

  const requested = channel.joinedAt == null;

  return (
    <Screen testID="screen-channel">
      <ScreenHeader
        title={channel.label}
        subtitle={
          channel.hosting
            ? reach != null
              ? `you host, ${reach} acked`
              : 'you host'
            : `host ${store.labelFor(channel.host)}`
        }
        compact
        onBack={() => navigation.goBack()}
        right={
          channel.hosting ? (
            <TouchableOpacity
              onPress={() => navigation.navigate('ChannelManage', {path})}
              style={styles.manageButton}
              testID="channel-manage"
              accessibilityRole="button"
              accessibilityLabel="Manage channel">
              <Icon name="users" size={size.iconSmall} color={palette.dust} />
            </TouchableOpacity>
          ) : (
            <RelayPill state={relay.state} testID="channel-relay-pill" />
          )
        }
      />

      {requested ? (
        <View style={styles.requestedRow}>
          <Note tone="warn" testID="channel-requested-note">
            Join requested, keys not received yet. Posts cannot be published or read here until
            the host hands over the channel keys.
          </Note>
        </View>
      ) : null}

      {/* The tracked keyboard height, spent as padding on the container between header and
          composer, so the composer rides up by exactly the keyboard's height. */}
      <View style={[styles.fill, {paddingBottom: keyboardHeight}]}>
      {messages.length === 0 ? (
        <View style={styles.empty} testID="channel-empty">
          <Note testID="channel-empty-note">
            {requested
              ? 'Nothing can arrive until membership is real.'
              : 'Nothing published yet. A post here is one encrypted publication flooded once ' +
                'to every member, not a separate message per person.'}
          </Note>
        </View>
      ) : (
        <FlatList
          testID="channel-messages"
          ref={listRef}
          data={messages}
          keyExtractor={(m) => `${m.id}:${m.at}`}
          contentContainerStyle={styles.listBody}
          onContentSizeChange={() => listRef.current?.scrollToEnd({animated: false})}
          renderItem={({item, index}) => (
            <View
              testID={`channel-message-row-${index}`}
              style={[styles.bubbleWrap, item.sender == null ? styles.wrapOut : styles.wrapIn]}>
              <View
                style={[styles.bubble, item.sender == null ? styles.bubbleOut : styles.bubbleIn]}>
                {item.sender != null ? (
                  <Text style={styles.sender} testID={`channel-message-sender-${index}`}>
                    {store.labelFor(item.sender)}
                  </Text>
                ) : null}
                {/* Channels carry no content type on the wire, so a location publication is
                    recognized by its strictly validated shape (decodeFix rejects everything that
                    is not a complete fix). */}
                {decodeFix(item.body) != null ? (
                  <LocationBubble
                    body={item.body}
                    at={item.at}
                    fromHere
                    testID={`channel-message-location-${index}`}
                  />
                ) : (
                  <Text style={styles.bubbleText} testID={`channel-message-body-${index}`}>
                    {item.body}
                  </Text>
                )}
                <View style={styles.metaRow}>
                  <Text style={styles.metaTime}>{timeLabel(item.at)}</Text>
                  {item.sender == null ? (
                    <PublishMark state={item.publishState ?? 'published'} testID={`channel-message-state-${index}`} />
                  ) : null}
                </View>
              </View>
            </View>
          )}
        />
      )}

      {sendError != null ? (
        <View style={styles.errorRow}>
          <Note tone="warn" testID="channel-send-error">
            {sendError}
          </Note>
        </View>
      ) : null}
      {leaveError != null ? (
        <View style={styles.errorRow}>
          <Note tone="warn" testID="channel-leave-error">
            {leaveError}
          </Note>
        </View>
      ) : null}

      {confirmingLocation ? (
        <View style={styles.confirmRow} testID="channel-location-confirm">
          <Note testID="channel-location-confirm-note">
            Everyone in this channel will see this location. A channel publication goes to all of
            its members.
          </Note>
          <View style={styles.confirmButtons}>
            <TouchableOpacity
              testID="channel-location-send"
              style={styles.confirmSend}
              onPress={() => void confirmLocation()}
              accessibilityRole="button"
              accessibilityLabel="Send location to the channel">
              <Icon name="map-marker" size={size.iconSmall} color={palette.sodiumDeep} />
              <Text style={styles.confirmSendText}>share with the channel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="channel-location-cancel"
              style={styles.confirmCancel}
              onPress={() => setConfirmingLocation(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel sharing location">
              <Icon name="times" size={size.iconSmall} color={palette.dust} />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
      {locationNote != null ? (
        <View style={styles.errorRow}>
          <Note tone="warn" testID="channel-location-note">
            {locationNote}
          </Note>
        </View>
      ) : null}

      <View style={[styles.composer, keyboardHeight > 0 && styles.composerLifted]}>
        {/* Same shape as the chat composer, and for the same reason: the text is the primary
            object and gets a full width row, the controls sit beneath it inside the container. */}
        <TextInput
          testID="channel-input"
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={requested ? 'waiting for the channel keys' : 'publish to the channel'}
          placeholderTextColor={palette.alkaliFaint}
          editable={!requested}
          multiline
          autoCorrect={false}
          // Return inserts a newline. Publishing is the button below, which now stays on screen
          // with the keyboard up.
          scrollEnabled
        />
        <View style={styles.composerControls}>
          <View style={styles.composerTools}>
            <TouchableOpacity
              testID="channel-location"
              style={styles.composerButton}
              onPress={() => requestLocation()}
              accessibilityRole="button"
              accessibilityLabel="Share my location with this channel">
              <Icon name="map-marker" size={size.icon} color={palette.sodiumBright} />
            </TouchableOpacity>
            {/* Leaving or retiring a channel is DESTRUCTIVE and irreversible for a host, and it
                sits in the row a thumb rests on while typing. It keeps its own silhouette, an
                ember outline, and a gap separating it from the utilities, because the encoding
                rule for this app is shape first and colour last: an ember icon in an otherwise
                identical borderless button differs only by colour, which is exactly the mistake
                the rule exists to prevent. See the PR body: this control arguably does not belong
                in the composer at all. */}
            <TouchableOpacity
              testID="channel-leave"
              style={[styles.destructiveButton, leaving && styles.sendOff]}
              disabled={leaving}
              onPress={() => void leave()}
              accessibilityRole="button"
              accessibilityLabel={channel.hosting ? 'Retire channel' : 'Leave channel'}>
              <Icon name="sign-out" size={size.icon} color={palette.emberBright} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            testID="channel-send"
            style={[
              styles.sendButton,
              (draft.trim().length === 0 || sending || requested) && styles.sendOff,
            ]}
            disabled={draft.trim().length === 0 || sending || requested}
            onPress={() => void send()}
            accessibilityRole="button"
            accessibilityLabel="Publish">
            <Icon name="bullhorn" size={size.icon} color={palette.sodiumDeep} />
          </TouchableOpacity>
        </View>
      </View>
      </View>
    </Screen>
  );
}

/** The only outbound states that exist for a channel post: taken, or refused. No checkmarks. */
function PublishMark({state, testID}: {state: string; testID?: string}): React.JSX.Element {
  const failed = state === 'failed';
  return (
    <View style={styles.publishMark} testID={testID}>
      <Icon
        name={failed ? 'exclamation-circle' : 'check'}
        size={size.iconSmall}
        color={failed ? palette.emberBright : palette.sage}
      />
      <Text
        style={[styles.publishText, {color: failed ? palette.emberBright : palette.sage}]}
        testID={testID != null ? `${testID}-label` : undefined}>
        {failed ? 'not published' : 'published'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  manageButton: {
    width: size.touchMin,
    height: size.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The one destructive control in the composer. It differs in SHAPE from the utilities beside it,
  // not only in icon colour, and the left margin separates it from them so a thumb resting on the
  // utilities cluster is not already on it.
  destructiveButton: {
    width: size.touchMin,
    height: size.touchMin,
    marginLeft: space.l,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: palette.ember,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Borderless, matching the chat composer: inside a bounded container the icon is the affordance
  // and carries 8.4:1 against this surface, so the edge token is not doing any identifying work
  // here. Touch target stays 48. These two composers have to look like one component.
  composerButton: {
    width: size.touchMin,
    height: size.touchMin,
    borderRadius: radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: space.xl,
    paddingBottom: space.l,
  },
  requestedRow: {
    paddingHorizontal: space.xl,
    paddingTop: space.s,
  },
  listBody: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingVertical: space.l,
    paddingHorizontal: space.l,
    gap: space.m,
  },
  bubbleWrap: {
    width: '100%',
    flexDirection: 'row',
  },
  wrapOut: {
    justifyContent: 'flex-end',
    paddingLeft: size.touchMin,
  },
  wrapIn: {
    justifyContent: 'flex-start',
    paddingRight: size.touchMin,
  },
  bubble: {
    flexShrink: 1,
    borderRadius: radius.bubble,
    paddingHorizontal: space.l,
    paddingVertical: space.m,
    borderWidth: 1,
  },
  bubbleOut: {
    backgroundColor: palette.raised,
    borderColor: palette.lineStrong,
  },
  bubbleIn: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
  },
  sender: {
    ...type.monoSmall,
    color: palette.sodiumBright,
    marginBottom: space.xxs,
  },
  bubbleText: {
    ...type.body,
    color: palette.alkali,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: space.m,
    marginTop: space.xxs,
  },
  metaTime: {
    ...type.monoSmall,
    color: palette.alkaliFaint,
  },
  publishMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  publishText: {
    ...type.monoSmall,
  },
  errorRow: {
    paddingHorizontal: space.xl,
    paddingBottom: space.s,
  },
  confirmRow: {
    paddingHorizontal: space.xl,
    paddingTop: space.m,
    gap: space.s,
  },
  confirmButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
  },
  confirmSend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    height: size.touchMin,
    paddingHorizontal: space.l,
    borderRadius: radius.chip,
    backgroundColor: palette.sodium,
  },
  confirmSendText: {
    ...type.action,
    color: palette.sodiumDeep,
  },
  confirmCancel: {
    width: size.touchMin,
    height: size.touchMin,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: palette.edge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // One bounded surface, two rows. Mirrors the chat composer exactly, because a person moving
  // between a conversation and a channel should not meet a different composer.
  composer: {
    marginHorizontal: space.l,
    marginTop: space.m,
    // Clears the home indicator zone on phones without a home button.
    marginBottom: space.xxl,
    backgroundColor: palette.raised,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: palette.edge,
    paddingHorizontal: space.m,
    paddingTop: space.s,
    paddingBottom: space.xs,
  },
  composerLifted: {
    marginBottom: space.s,
  },
  input: {
    ...type.body,
    color: palette.alkali,
    minHeight: 40,
    maxHeight: 132,
    paddingHorizontal: space.xs,
    paddingTop: space.s,
    paddingBottom: space.s,
    textAlignVertical: 'top',
  },
  composerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  composerTools: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sendButton: {
    minWidth: size.touchMin,
    height: size.touchMin,
    paddingHorizontal: space.m,
    borderRadius: radius.chip,
    backgroundColor: palette.sodium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: {
    opacity: 0.4,
  },
});
