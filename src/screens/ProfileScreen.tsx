import React, {useEffect, useMemo, useState} from 'react';
import {
  Image,
  Keyboard,
  KeyboardEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/FontAwesome';
import {launchImageLibrary} from 'react-native-image-picker';

import {Field, GhostButton, Note, PrimaryButton, Screen, ScreenHeader, SectionTitle} from '../components/chrome';
import {palette, radius, size, space, type} from '../design/tokens';
import {persistProfilePhoto, removeProfilePhoto} from '../profile/files';
import {ProfilePhoto, ProfileScope} from '../profile/types';
import {useProfileVersion, useReadyGrit} from '../app/GritContext';
import type {RootStackParamList} from '../app/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

function ScopeControl({
  field,
  scope,
  onChange,
  testID,
}: {
  field: string;
  scope: ProfileScope;
  onChange: (scope: ProfileScope) => void;
  testID: string;
}): React.JSX.Element {
  const isPublic = scope === 'public';
  return (
    <TouchableOpacity
      style={styles.scope}
      onPress={() => onChange(isPublic ? 'private' : 'public')}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${field} is ${isPublic ? 'public' : 'private'}. Change privacy.`}>
      <Icon name={isPublic ? 'globe' : 'lock'} size={size.iconSmall} color={isPublic ? palette.sodiumBright : palette.dust} />
      <View style={styles.scopeCopy}>
        <Text style={styles.scopeTitle}>{isPublic ? 'Public' : 'Private'}</Text>
        <Text style={styles.scopeDetail}>
          {isPublic
            ? 'Included when you choose a saved contact to share with.'
            : 'Stays on this device unless you include it in a named share.'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export function ProfileScreen({navigation}: Props): React.JSX.Element {
  const {profiles} = useReadyGrit();
  const profileVersion = useProfileVersion();
  const current = profiles.current();
  const [name, setName] = useState(current.name);
  const [contact, setContact] = useState(current.contact);
  const [nameScope, setNameScope] = useState<ProfileScope>(current.nameScope);
  const [contactScope, setContactScope] = useState<ProfileScope>(current.contactScope);
  const [photoScope, setPhotoScope] = useState<ProfileScope>(current.photoScope);
  const [photo, setPhoto] = useState<ProfilePhoto | undefined>(current.photo);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const latest = profiles.current();
    setName(latest.name);
    setContact(latest.contact);
    setNameScope(latest.nameScope);
    setContactScope(latest.contactScope);
    setPhotoScope(latest.photoScope);
    setPhoto(latest.photo);
  }, [profileVersion, profiles]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event: KeyboardEvent) => {
      setKeyboardInset(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardInset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const existingPhoto = useMemo(() => current.photo, [current.photo]);

  const choosePhoto = async () => {
    setNote(null);
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      maxWidth: 512,
      maxHeight: 512,
      quality: 0.6,
      includeBase64: true,
    });
    if (result.didCancel) {
      return;
    }
    if (result.errorMessage != null) {
      setNote(`Photo picker: ${result.errorMessage}`);
      return;
    }
    const asset = result.assets?.[0];
    if (asset?.base64 == null) {
      setNote('The photo picker did not return a shareable JPEG. Choose another photo.');
      return;
    }
    try {
      const next = await persistProfilePhoto(asset.base64, `own-${current.revision + 1}`);
      setPhoto(next);
      setNote('Photo selected. Save profile to keep it.');
    } catch (e) {
      setNote(String(e));
    }
  };

  const save = async () => {
    if (name.trim().length === 0) {
      setNote('Add a name before saving your profile.');
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const saved = await profiles.update({name, contact, nameScope, contactScope, photoScope, photo});
      if (existingPhoto != null && existingPhoto.uri !== saved.photo?.uri) {
        await removeProfilePhoto(existingPhoto);
      }
      setNote('Profile saved on this device.');
    } catch (e) {
      setNote(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen testID="screen-profile">
      <ScreenHeader title="Your profile" compact onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={[styles.body, {paddingBottom: space.xxxl + keyboardInset}]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        testID="profile-scroll">
        <Note testID="profile-reach">
          Your profile lives on this device. Public fields only travel when you choose a saved contact to share with. Grit Chat has no profile directory.
        </Note>

        <SectionTitle>Photo</SectionTitle>
        <View style={styles.photoRow}>
          {photo != null ? (
            <Image source={{uri: photo.uri}} style={styles.photo} accessibilityLabel="Selected profile photo" />
          ) : (
            <View style={styles.photoEmpty} accessibilityLabel="No profile photo">
              <Icon name="user-o" size={size.icon} color={palette.dust} />
            </View>
          )}
          <View style={styles.photoActions}>
            <GhostButton label="Choose photo" icon="image" onPress={() => void choosePhoto()} testID="profile-choose-photo" />
            {photo != null ? (
              <GhostButton
                label="Remove photo"
                icon="trash"
                onPress={() => {
                  setPhoto(undefined);
                  setNote('Photo will be removed when you save your profile.');
                }}
                testID="profile-remove-photo"
              />
            ) : null}
          </View>
        </View>
        <ScopeControl field="Profile photo" scope={photoScope} onChange={setPhotoScope} testID="profile-photo-scope" />

        <SectionTitle>Name</SectionTitle>
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Name people know you by"
          maxLength={80}
          autoCapitalize="words"
          testID="profile-name"
        />
        <ScopeControl field="Name" scope={nameScope} onChange={setNameScope} testID="profile-name-scope" />

        <SectionTitle>Contact information</SectionTitle>
        <Field
          label="Optional"
          value={contact}
          onChangeText={setContact}
          placeholder="Phone, email, or another way to reach you"
          maxLength={160}
          autoCapitalize="none"
          autoCorrect={false}
          testID="profile-contact"
        />
        <ScopeControl
          field="Contact information"
          scope={contactScope}
          onChange={setContactScope}
          testID="profile-contact-scope"
        />

        <PrimaryButton label="Save profile" icon="check" onPress={() => void save()} busy={busy} testID="profile-save" />
        {note != null ? <Note testID="profile-note">{note}</Note> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: space.xl,
    gap: space.l,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.l,
  },
  photo: {
    width: size.avatar * 2,
    height: size.avatar * 2,
    borderRadius: radius.panel,
  },
  photoEmpty: {
    width: size.avatar * 2,
    height: size.avatar * 2,
    borderRadius: radius.panel,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.edge,
    backgroundColor: palette.surface,
  },
  photoActions: {
    flex: 1,
    gap: space.s,
  },
  scope: {
    minHeight: size.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    padding: space.m,
    borderWidth: 1,
    borderColor: palette.edge,
    borderRadius: radius.chip,
  },
  scopeCopy: {
    flex: 1,
  },
  scopeTitle: {
    ...type.action,
    color: palette.alkali,
  },
  scopeDetail: {
    ...type.secondary,
    color: palette.dust,
  },
});
