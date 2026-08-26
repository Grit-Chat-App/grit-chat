import React, {useEffect, useRef, useState} from 'react';
import {
  Image,
  Keyboard,
  KeyboardEvent,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  type ScrollViewInstance,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome';

import {Field, GhostButton, Note, PrimaryButton, Screen, ScreenHeader, SectionTitle} from '../components/chrome';
import {palette, radius, size, space, type} from '../design/tokens';
import {readProfilePhoto} from '../profile/files';
import {serializeProfile, PROFILE_CONTENT_TYPE} from '../profile/protocol';
import {ProfileShareSelection} from '../profile/types';
import {useProfileVersion, useReadyGrit, useStoreVersion} from '../app/GritContext';
import type {RootStackParamList} from '../app/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ContactProfile'>;

function PrivateFieldControl({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}): React.JSX.Element {
  return (
    <TouchableOpacity
      style={styles.selection}
      onPress={onPress}
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{checked: selected}}
      accessibilityLabel={`Include private ${label}`}>
      <Icon name={selected ? 'check-square-o' : 'square-o'} size={size.iconSmall} color={palette.sodiumBright} />
      <Text style={styles.selectionText}>Include private {label}</Text>
    </TouchableOpacity>
  );
}

export function ContactProfileScreen({navigation, route}: Props): React.JSX.Element {
  const {seam, store, profiles} = useReadyGrit();
  const storeVersion = useStoreVersion();
  useProfileVersion();
  const insets = useSafeAreaInsets();
  const contact = store.contactByAddress(route.params.address);
  const own = profiles.current();
  const [alias, setAlias] = useState(contact?.localAlias ?? '');
  const [note, setNote] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const [selection, setSelection] = useState<ProfileShareSelection>({
    includePrivateName: false,
    includePrivateContact: false,
    includePrivatePhoto: false,
  });

  useEffect(() => {
    setAlias(contact?.localAlias ?? '');
  }, [contact?.localAlias, storeVersion]);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event: KeyboardEvent) => setKeyboardInset(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setKeyboardInset(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const recipient = store.displayNameFor(route.params.address);

  const saveAlias = async () => {
    setBusy(true);
    setNote(null);
    try {
      await store.setLocalAlias(route.params.address, alias);
      setNote(alias.trim().length > 0 ? 'Local name saved.' : 'Local name cleared.');
    } catch (e) {
      setNote(String(e));
    } finally {
      setBusy(false);
    }
  };

  const acceptPending = async () => {
    await store.acceptPendingProfile(route.params.address);
    setNote('Profile accepted. Your local name stays unchanged.');
  };

  const rejectPending = async () => {
    await store.rejectPendingProfile(route.params.address);
    setNote('Profile discarded.');
  };

  const share = async () => {
    setBusy(true);
    setNote(null);
    try {
      const needsPhoto = own.photo != null && (own.photoScope === 'public' || selection.includePrivatePhoto);
      const photoBase64 = needsPhoto && own.photo != null ? await readProfilePhoto(own.photo) : undefined;
      const body = serializeProfile(own, selection, photoBase64);
      const outcome = await seam.send(route.params.address, body, undefined, PROFILE_CONTENT_TYPE);
      setShareOpen(false);
      setNote(
        outcome.delivered
          ? `Profile card delivered to ${recipient}. They choose whether to accept it.`
          : `Profile card is waiting for delivery to ${recipient}. They choose whether to accept it.`,
      );
    } catch (e) {
      setNote(String(e));
    } finally {
      setBusy(false);
    }
  };

  if (contact == null) {
    return (
      <Screen testID="screen-contact-profile">
        <ScreenHeader title="Contact" compact onBack={() => navigation.goBack()} />
        <View style={styles.missing}>
          <Note tone="warn">That contact is no longer saved on this device.</Note>
        </View>
      </Screen>
    );
  }

  return (
    <Screen testID="screen-contact-profile">
      <ScreenHeader title={recipient} subtitle="contact details" compact onBack={() => navigation.goBack()} />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.body, {paddingBottom: space.xxxl + keyboardInset}]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        testID="contact-profile-scroll">
        <SectionTitle>Local name</SectionTitle>
        <Note>Your name for this person stays on this device and wins over anything they share.</Note>
        <Field
          label="Name"
          value={alias}
          onFocus={() => scrollRef.current?.scrollTo({y: 0, animated: true})}
          onChangeText={setAlias}
          placeholder="How you know this person"
          maxLength={80}
          testID="contact-alias"
        />
        <PrimaryButton label="Save local name" icon="check" onPress={() => void saveAlias()} busy={busy} testID="contact-alias-save" />

        <SectionTitle>Shared profile</SectionTitle>
        {contact.sharedProfile == null ? (
          <Note testID="contact-shared-empty">They have not shared a profile you accepted.</Note>
        ) : (
          <View style={styles.card} testID="contact-shared-profile">
            {contact.sharedProfile.photo != null ? (
              <Image source={{uri: contact.sharedProfile.photo.uri}} style={styles.photo} accessibilityLabel="Shared profile photo" />
            ) : null}
            {contact.sharedProfile.name != null ? <Text style={styles.profileName}>{contact.sharedProfile.name}</Text> : null}
            {contact.sharedProfile.contact != null ? <Text style={styles.profileContact}>{contact.sharedProfile.contact}</Text> : null}
          </View>
        )}

        {contact.pendingProfile != null ? (
          <View style={styles.pending} testID="contact-profile-pending">
            <Text style={styles.pendingTitle}>New profile from {recipient}</Text>
            {contact.pendingProfile.photo != null ? (
              <Image source={{uri: contact.pendingProfile.photo.uri}} style={styles.photo} accessibilityLabel="Pending profile photo" />
            ) : null}
            {contact.pendingProfile.name != null ? <Text style={styles.profileName}>{contact.pendingProfile.name}</Text> : null}
            {contact.pendingProfile.contact != null ? <Text style={styles.profileContact}>{contact.pendingProfile.contact}</Text> : null}
            <Note>Accepting updates sender details. Your local name stays unchanged.</Note>
            <PrimaryButton label="Accept profile" icon="check" onPress={() => void acceptPending()} testID="contact-profile-accept" />
            <GhostButton label="Reject profile" icon="times" onPress={() => void rejectPending()} testID="contact-profile-reject" />
          </View>
        ) : null}

        <SectionTitle>Share your profile</SectionTitle>
        <Note>
          Public fields are included by default. Private fields stay on this device unless you choose them in the next step. Grit Chat does not publish profiles.
        </Note>
        <PrimaryButton
          label="Share profile"
          icon="share"
          onPress={() => {
            setSelection({includePrivateName: false, includePrivateContact: false, includePrivatePhoto: false});
            setShareOpen(true);
          }}
          testID="contact-profile-share"
        />
        {note != null ? <Note testID="contact-profile-note">{note}</Note> : null}
      </ScrollView>

      <Modal visible={shareOpen} transparent animationType="slide" onRequestClose={() => setShareOpen(false)}>
        <View style={styles.modalScrim}>
          <View style={[styles.modal, {paddingBottom: space.xl + insets.bottom}]} testID="profile-share-confirmation">
            <Text style={styles.modalTitle}>Share with {recipient}</Text>
            <Note>Only this saved Hop contact receives this profile card.</Note>
            {own.nameScope === 'private' && own.name.trim().length > 0 ? (
              <PrivateFieldControl
                label="name"
                selected={selection.includePrivateName}
                onPress={() => setSelection((value) => ({...value, includePrivateName: !value.includePrivateName}))}
                testID="profile-share-private-name"
              />
            ) : null}
            {own.contactScope === 'private' && own.contact.trim().length > 0 ? (
              <PrivateFieldControl
                label="contact information"
                selected={selection.includePrivateContact}
                onPress={() =>
                  setSelection((value) => ({...value, includePrivateContact: !value.includePrivateContact}))
                }
                testID="profile-share-private-contact"
              />
            ) : null}
            {own.photoScope === 'private' && own.photo != null ? (
              <PrivateFieldControl
                label="photo"
                selected={selection.includePrivatePhoto}
                onPress={() => setSelection((value) => ({...value, includePrivatePhoto: !value.includePrivatePhoto}))}
                testID="profile-share-private-photo"
              />
            ) : null}
            <PrimaryButton
              label="Send profile"
              icon="paper-plane"
              onPress={() => void share()}
              busy={busy}
              testID="profile-share-send"
            />
            <GhostButton label="Cancel" icon="times" onPress={() => setShareOpen(false)} testID="profile-share-cancel" />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: space.xl,
    gap: space.l,
  },
  missing: {
    padding: space.xl,
  },
  card: {
    gap: space.s,
    padding: space.l,
    borderWidth: 1,
    borderColor: palette.lineStrong,
    borderRadius: radius.panel,
    backgroundColor: palette.surface,
  },
  pending: {
    gap: space.m,
    padding: space.l,
    borderWidth: 1,
    borderColor: palette.sodium,
    borderRadius: radius.panel,
    backgroundColor: palette.surface,
  },
  pendingTitle: {
    ...type.action,
    color: palette.alkali,
  },
  photo: {
    width: size.avatar * 2,
    height: size.avatar * 2,
    borderRadius: radius.panel,
  },
  profileName: {
    ...type.title,
    color: palette.alkali,
  },
  profileContact: {
    ...type.body,
    color: palette.dust,
  },
  modalScrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(8, 9, 17, 0.82)',
  },
  modal: {
    gap: space.l,
    padding: space.xl,
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
    backgroundColor: palette.night,
  },
  modalTitle: {
    ...type.title,
    color: palette.alkali,
  },
  selection: {
    minHeight: size.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingHorizontal: space.m,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: palette.edge,
  },
  selectionText: {
    ...type.action,
    color: palette.alkali,
  },
});
