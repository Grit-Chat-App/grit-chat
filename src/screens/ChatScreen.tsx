// One conversation. Every outbound message carries its real delivery state, and every message
// carries the hop trace: how far it physically travelled. Nothing here shows a hopeful checkmark.

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
import Clipboard from '@react-native-clipboard/clipboard';
import Icon from 'react-native-vector-icons/FontAwesome';
import {launchImageLibrary} from 'react-native-image-picker';
import {readOneFix} from '../hop/geolocation';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';
import {fromBase64} from '@hop-mesh/react-native';

import {HopTrace} from '../components/HopTrace';
import {MediaBubble} from '../components/MediaBubble';
import {LocationBubble} from '../components/LocationBubble';
import {LOCATION_CONTENT_TYPE, encodeFix, locationErrorNote, type LocationFix} from '../hop/location';
import {Note, RelayPill, Screen, ScreenHeader} from '../components/chrome';
import {palette, radius, size, space, type} from '../design/tokens';
import {timeLabel} from '../format';
import {useReadyGrit, useRelayState, useStoreVersion} from '../app/GritContext';
import type {RootStackParamList} from '../app/navigation';
import {StoredMessage} from '../store/conversations';
import {focus} from '../notifications/focus';
import {askToNotifyOnce} from '../notifications/bridge';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

export function ChatScreen({navigation, route}: Props): React.JSX.Element {
  const {address} = route.params;
  const {seam, store} = useReadyGrit();
  useStoreVersion();
  const relay = useRelayState();

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const listRef = useRef<FlatList<StoredMessage> | null>(null);

  // The keyboard, tracked as a NUMBER rather than delegated to KeyboardAvoidingView.
  //
  // KeyboardAvoidingView with behavior padding was measured on the simulator lifting the composer
  // by less than the keyboard's height, so the control row with send on it stayed underneath: the
  // exact defect this rebuild exists to fix, still there after the rebuild. Its offset depends on
  // where the avoider's frame sits relative to the window, which is a thing this screen cannot
  // know from inside a header layout. Tracking the height and spending it as padding is arithmetic
  // I can read off a screenshot and check.
  //
  // The composer's standing bottom margin clears the home indicator. With the keyboard up the
  // keyboard occupies that zone, so the margin collapses instead of stacking on top of the lift.
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

  const contact = store.contactByAddress(address);
  const messages = store.messagesFor(address);
  const title = store.displayNameFor(address);

  useEffect(() => {
    void store.markRead(address);
  }, [store, address, messages.length]);

  // Tell the arrival wiring what is on screen so a message already being read is never announced.
  useEffect(() => {
    focus.openDirect(address);
    // The first time somebody opens a conversation is the first moment a banner would mean
    // anything, so it is where the permission question belongs. Once per process, never at boot.
    askToNotifyOnce();
    return () => {
      focus.openDirect(null);
    };
  }, [address]);

  const send = useCallback(async () => {
    const body = draft.trim();
    if (body.length === 0 || sending) {
      return;
    }
    setSending(true);
    setSendError(null);
    let acceptedId: string | null = null;
    try {
      const outcome = await seam.send(address, body, {
        onAccepted: async (id) => {
          acceptedId = id;
          setDraft('');
          await store.appendOutbound(address, body, id);
        },
        onUpdate: (id, status) => store.applyDelivery(id, status),
      });
      await store.applyDelivery(outcome.id, outcome.final);
    } catch (e) {
      setSendError(String(e));
      if (acceptedId != null) {
        await store.markFailed(acceptedId);
      }
    } finally {
      setSending(false);
    }
  }, [address, draft, seam, sending, store]);

  // Media sends use the same seam call as text, with a content type and bytes: the core chunks
  // large content itself, and delivery state is tracked identically, so a photo that silently
  // failed shows exactly the failure a text would.
  const sendBytes = useCallback(
    async (bytes: Uint8Array, contentType: string, extras: {mediaUri?: string; durationSecs?: number; preview: string}) => {
      setSendError(null);
      let acceptedId: string | null = null;
      try {
        const outcome = await seam.send(
          address,
          bytes,
          {
            onAccepted: async (id) => {
              acceptedId = id;
              await store.appendOutbound(address, extras.preview, id, {
                contentType,
                mediaUri: extras.mediaUri,
                durationSecs: extras.durationSecs,
              });
            },
            onUpdate: (id, status) => store.applyDelivery(id, status),
          },
          contentType,
        );
        await store.applyDelivery(outcome.id, outcome.final);
      } catch (e) {
        setSendError(String(e));
        if (acceptedId != null) {
          await store.markFailed(acceptedId);
        }
      }
    },
    [address, seam, store],
  );

  // A location is JSON text with its own content type: same seam call, same accepted hook, same
  // delivery trace. send() already takes a string body; this adds nothing new to the wire path.
  const sendText = useCallback(
    async (body: string, contentType: string) => {
      setSendError(null);
      let acceptedId: string | null = null;
      try {
        const outcome = await seam.send(
          address,
          body,
          {
            onAccepted: async (id) => {
              acceptedId = id;
              await store.appendOutbound(address, body, id, {contentType});
            },
            onUpdate: (id, status) => store.applyDelivery(id, status),
          },
          contentType,
        );
        await store.applyDelivery(outcome.id, outcome.final);
      } catch (e) {
        setSendError(String(e));
        if (acceptedId != null) {
          await store.markFailed(acceptedId);
        }
      }
    },
    [address, seam, store],
  );

  const pickImage = useCallback(async () => {
    // Downscale here, not at the wire: a 12 MP photo costs real relay bandwidth, and 1600px at
    // ~0.7 quality is the size a phone screen can actually display.
    const result = await launchImageLibrary({
      mediaType: 'photo',
      maxWidth: 1600,
      maxHeight: 1600,
      quality: 0.7,
      includeBase64: true,
      selectionLimit: 1,
    });
    const asset = result.assets?.[0];
    if (result.didCancel || asset?.base64 == null) {
      return;
    }
    await sendBytes(fromBase64(asset.base64), 'image/jpeg', {
      mediaUri: asset.uri,
      preview: '',
    });
  }, [sendBytes]);

  const [recording, setRecording] = useState<{startedAt: number; path: string} | null>(null);
  const [recorder] = useState(() => new AudioRecorderPlayer());

  // One-shot: a snapshot of where you are NOW. There is deliberately no live sharing; see
  // location.ts for the reasoning.
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const shareLocation = useCallback(() => {
    setLocationNote(null);
    readOneFix()
      .then((fix: LocationFix) => sendText(encodeFix(fix), LOCATION_CONTENT_TYPE))
      .catch((error: {code: number; message?: string}) => {
        // Plainly, never silently: the button did something, the user deserves to know what.
        setLocationNote(locationErrorNote(error));
      });
  }, [sendText]);

  const toggleVoice = useCallback(async () => {
    if (recording == null) {
      const path = await recorder.startRecorder();
      setRecording({startedAt: Date.now(), path});
      return;
    }
    const durationSecs = Math.max(1, Math.round((Date.now() - recording.startedAt) / 1000));
    const result = await recorder.stopRecorder();
    setRecording(null);
    const file = result.startsWith('file://') ? result : `file://${result}`;
    // A zero-byte recording is a real outcome on a device with no usable mic, and sending it
    // would read as a bundle that never travels (relayed=0 forever) with no error anywhere.
    const base64 = await RNFS.readFile(file.replace('file://', ''), 'base64');
    if (base64.length === 0) {
      setSendError('The recording produced no bytes. Nothing was sent.');
      return;
    }
    await sendBytes(fromBase64(base64), 'audio/m4a', {
      mediaUri: file,
      durationSecs,
      preview: '',
    });
  }, [recorder, recording, sendBytes]);

  // Re-read delivery status for anything still in flight when this screen opens: the poll loop that
  // was tracking it may have been suspended when the app went to the background.
  useEffect(() => {
    const pending = store
      .messagesFor(address)
      .filter((m) => m.direction === 'out' && m.sendState !== 'delivered' && m.sendState !== 'failed');
    if (pending.length === 0) {
      return;
    }
    let live = true;
    void (async () => {
      for (const message of pending) {
        try {
          const status = await seam.statusOf(message.id);
          if (!live) {
            return;
          }
          await store.applyDelivery(message.id, status);
        } catch {
          // A missing bundle after restart is not a send failure. Leave the stored state as it is.
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [address, seam, store]);

  return (
    <Screen testID="screen-chat">
      <ScreenHeader
        title={copied ? 'Address copied' : title}
        compact
        onBack={() => navigation.goBack()}
        onTitlePress={() => {
          Clipboard.setString(address);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        }}
        right={
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.contactAction}
              onPress={() => navigation.navigate('ContactProfile', {address})}
              testID="chat-contact-profile"
              accessibilityRole="button"
              accessibilityLabel={`Contact details for ${title}`}>
              <Icon name="user-o" size={size.iconSmall} color={palette.sodiumBright} />
            </TouchableOpacity>
            <RelayPill state={relay.state} testID="chat-relay-pill" />
          </View>
        }
      />

      {/* The tracked keyboard height is spent here, as padding on the container that owns the
          space between the header and the composer. The list shrinks by exactly that amount and
          the composer rides up by exactly that amount, so send is on screen while typing. */}
      <View style={[styles.fill, {paddingBottom: keyboardHeight}]}>
      {contact?.pendingProfile != null ? (
        <TouchableOpacity
          style={styles.profileNotice}
          onPress={() => navigation.navigate('ContactProfile', {address})}
          testID="chat-profile-pending"
          accessibilityRole="button"
          accessibilityLabel={`Review profile update from ${title}`}>
          <Icon name="user" size={size.iconSmall} color={palette.sodiumBright} />
          <Text style={styles.profileNoticeText}>Profile update. Review before using it.</Text>
        </TouchableOpacity>
      ) : null}
      {messages.length === 0 ? (
        <View style={styles.empty} testID="chat-empty">
          <Note testID="chat-empty-note">
            Nothing sent yet. A message leaves this device the moment you send it, and its delivery
            state below is what the protocol reports, not a guess.
          </Note>
        </View>
      ) : (
        <FlatList
          testID="chat-messages"
          ref={listRef}
          data={messages}
          keyExtractor={(m) => `${m.id}:${m.at}`}
          contentContainerStyle={styles.listBody}
          onContentSizeChange={() => listRef.current?.scrollToEnd({animated: false})}
          renderItem={({item, index}) => (
            <View
              testID={`message-row-${index}`}
              style={[styles.bubbleWrap, item.direction === 'out' ? styles.wrapOut : styles.wrapIn]}>
              <View style={[styles.bubble, item.direction === 'out' ? styles.bubbleOut : styles.bubbleIn]}>
                {item.contentType === 'application/grit-location+json' ? (
                  <LocationBubble
                    body={item.body}
                    at={item.at}
                    fromHere={item.direction === 'in'}
                    onOpenCompass={
                      item.direction === 'in' ? (target) => navigation.navigate('Compass', {target}) : undefined
                    }
                    testID={`message-location-${index}`}
                  />
                ) : item.contentType != null && item.contentType !== 'text/plain' ? (
                  <MediaBubble message={item} testID={`message-media-${index}`} />
                ) : (
                  <Text style={styles.bubbleText} testID={`message-body-${index}`}>
                    {item.body}
                  </Text>
                )}
                <View style={styles.metaRow}>
                  <Text style={styles.metaTime}>{timeLabel(item.at)}</Text>
                </View>
                {item.direction === 'out' ? (
                  <HopTrace
                    testID={`message-trace-${index}`}
                    direction="out"
                    sendState={item.sendState ?? 'sending'}
                    relayed={item.relayed}
                    forwardHops={item.forwardHops}
                  />
                ) : (
                  <HopTrace testID={`message-trace-${index}`} direction="in" hops={item.hops ?? 0} />
                )}
              </View>
            </View>
          )}
        />
      )}

      {locationNote != null ? (
        <View style={styles.errorRow}>
          <Note tone="warn" testID="chat-location-note">
            {locationNote}
          </Note>
        </View>
      ) : null}
      {sendError != null ? (
        <View style={styles.errorRow}>
          <Note tone="warn" testID="chat-send-error">
            {sendError}
          </Note>
        </View>
      ) : null}

      <View style={[styles.composer, keyboardHeight > 0 && styles.composerLifted]}>
        {/* One bounded surface. The text is the primary object and owns a full width row of its
            own; the controls are subordinate and sit on a row beneath it, inside the same
            container. The old layout made the input a peer of four buttons on one row, so a
            message wrapped to three lines inside a box a quarter of the screen wide. */}
        <TextInput
          testID="chat-input"
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="meet at the trash fence"
          placeholderTextColor={palette.alkaliFaint}
          multiline
          autoCorrect={false}
          // Return inserts a newline, which is what multiline means. Sending is the button on the
          // row below, which is now always on screen with the keyboard up, so the return key does
          // not have to double as the only way out of a focused composer any more.
          scrollEnabled
        />
        <View style={styles.composerControls}>
          <View style={styles.composerTools}>
            {/* Kept as three visible icons rather than collapsed behind a plus menu: being able
                to see location, photo and voice is a stated preference, and a menu would trade
                that for one less row of pixels. */}
            <TouchableOpacity
              testID="chat-location"
              style={styles.composerButton}
              onPress={() => shareLocation()}
              accessibilityRole="button"
              accessibilityLabel="Share my location now">
              <Icon name="map-marker" size={size.icon} color={palette.sodiumBright} />
            </TouchableOpacity>
            <TouchableOpacity
              testID="chat-attach-image"
              style={styles.composerButton}
              onPress={() => void pickImage()}
              accessibilityRole="button"
              accessibilityLabel="Send a photo">
              <Icon name="image" size={size.icon} color={palette.sodiumBright} />
            </TouchableOpacity>
            <TouchableOpacity
              testID="chat-mic"
              style={[styles.composerButton, recording != null && styles.composerRecording]}
              onPress={() => void toggleVoice()}
              accessibilityRole="button"
              accessibilityLabel={recording != null ? 'Stop and send voice note' : 'Record a voice note'}>
              <Icon
                name={recording != null ? 'stop' : 'microphone'}
                size={size.icon}
                color={recording != null ? palette.emberBright : palette.sodiumBright}
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            testID="chat-send"
            style={[styles.sendButton, (draft.trim().length === 0 || sending) && styles.sendOff]}
            disabled={draft.trim().length === 0 || sending}
            onPress={() => void send()}
            accessibilityRole="button"
            accessibilityLabel="Send">
            <Icon name="paper-plane" size={size.icon} color={palette.sodiumDeep} />
          </TouchableOpacity>
        </View>
      </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // The keyboard avoider must own the space between header and composer for the composer to ride
  // up with the keyboard at all.
  fill: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  contactAction: {
    width: size.touchMin,
    height: size.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileNotice: {
    minHeight: size.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    marginHorizontal: space.l,
    marginTop: space.s,
    paddingHorizontal: space.m,
    borderWidth: 1,
    borderColor: palette.sodium,
    borderRadius: radius.chip,
  },
  profileNoticeText: {
    ...type.secondary,
    color: palette.alkali,
    flex: 1,
  },
  empty: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: space.xl,
    paddingBottom: space.l,
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
    paddingLeft: size.touchMin * 2,
  },
  wrapIn: {
    justifyContent: 'flex-start',
    paddingRight: size.touchMin * 2,
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
  bubbleText: {
    ...type.body,
    color: palette.alkali,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: space.xxs,
  },
  metaTime: {
    ...type.monoSmall,
    color: palette.alkaliFaint,
  },
  errorRow: {
    paddingHorizontal: space.xl,
    paddingBottom: space.s,
  },
  // ONE bounded surface holding two rows: the text, then the controls. The old version was a row
  // of five peers, so the input took whatever width the four buttons left it.
  composer: {
    marginHorizontal: space.l,
    marginTop: space.m,
    // Clears the home indicator zone on phones without a home button: this is the bottom-most
    // control in the app, and 20pt left its lower edge 2pt inside the indicator's 34pt region.
    marginBottom: space.xxl,
    backgroundColor: palette.raised,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: palette.edge,
    paddingHorizontal: space.m,
    paddingTop: space.s,
    paddingBottom: space.xs,
  },
  // With the keyboard up the keyboard owns the home indicator zone, so the standing clearance
  // would stack on top of the lift and waste a row of screen. It collapses to a hairline gap.
  composerLifted: {
    marginBottom: space.s,
  },
  // Full width, its own row, and it grows with the content to a cap and then scrolls rather than
  // pushing the control row off the bottom of the screen.
  input: {
    ...type.body,
    color: palette.alkali,
    minHeight: 40,
    maxHeight: 132,
    paddingHorizontal: space.xs,
    paddingTop: space.s,
    paddingBottom: space.s,
    // Android centres single-line multiline text without this, which makes the first line jump as
    // soon as a second one arrives.
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
  // No border on these: inside a bounded container the icon IS the affordance, and it carries
  // 8.4:1 against this surface. The edge token exists for controls whose only identifying visual
  // would otherwise be a hairline, which is not the case here. Touch target stays 48.
  composerButton: {
    width: size.touchMin,
    height: size.touchMin,
    borderRadius: radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerRecording: {
    backgroundColor: palette.surface,
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
