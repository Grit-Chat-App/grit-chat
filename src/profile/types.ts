export type ProfileScope = 'public' | 'private';

/** A JPEG held only in the app documents directory. The base64 form exists only while sharing. */
export interface ProfilePhoto {
  uri: string;
  contentType: 'image/jpeg';
  byteLength: number;
}

/** The device owner's profile. It has no server-side or Hop identity-store representation. */
export interface OwnProfile {
  name: string;
  contact: string;
  nameScope: ProfileScope;
  contactScope: ProfileScope;
  photoScope: ProfileScope;
  photo?: ProfilePhoto;
  revision: number;
}

/** Data a sender supplied. It becomes visible only after the local recipient accepts it. */
export interface SharedProfile {
  name?: string;
  contact?: string;
  photo?: ProfilePhoto;
  revision: number;
  receivedAt: number;
}

/** A received profile awaiting the local recipient's decision. */
export interface PendingProfile extends SharedProfile {
  messageId: string;
}

export interface ProfileShareSelection {
  includePrivateName: boolean;
  includePrivateContact: boolean;
  includePrivatePhoto: boolean;
}

export const EMPTY_PROFILE: OwnProfile = {
  name: '',
  contact: '',
  nameScope: 'public',
  contactScope: 'private',
  photoScope: 'private',
  revision: 0,
};
