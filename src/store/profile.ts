import {KeyValueStore} from './kv';
import {EMPTY_PROFILE, OwnProfile, ProfilePhoto, ProfileScope} from '../profile/types';

const PROFILE_KEY = 'grit.profile.v1';
const MAX_PROFILE_REVISION = 0xffffffff;

export interface ProfileUpdate {
  name: string;
  contact: string;
  nameScope: ProfileScope;
  contactScope: ProfileScope;
  photoScope: ProfileScope;
  photo?: ProfilePhoto;
}

function normalizeScope(value: unknown): ProfileScope {
  return value === 'private' ? 'private' : 'public';
}

function normalizeProfile(value: unknown): OwnProfile {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return {...EMPTY_PROFILE};
  }
  const raw = value as Partial<OwnProfile>;
  const photo =
    raw.photo != null &&
    typeof raw.photo.uri === 'string' &&
    raw.photo.contentType === 'image/jpeg' &&
    Number.isInteger(raw.photo.byteLength) &&
    raw.photo.byteLength > 0
      ? raw.photo
      : undefined;
  return {
    name: typeof raw.name === 'string' ? raw.name : '',
    contact: typeof raw.contact === 'string' ? raw.contact : '',
    nameScope: normalizeScope(raw.nameScope),
    contactScope: normalizeScope(raw.contactScope),
    photoScope: normalizeScope(raw.photoScope),
    photo,
    revision:
      Number.isInteger(raw.revision) && (raw.revision ?? -1) >= 0 && (raw.revision ?? 0) <= MAX_PROFILE_REVISION
        ? (raw.revision as number)
        : 0,
  };
}

/** Own profile persistence. This is separate from the Hop identity secret and every contact record. */
export class ProfileStore {
  private profile: OwnProfile = {...EMPTY_PROFILE};
  private loaded = false;
  private readonly listeners = new Set<() => void>();
  version = 0;

  constructor(private readonly kv: KeyValueStore) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.version += 1;
    for (const listener of this.listeners) {
      listener();
    }
  }

  private assertLoaded(): void {
    if (!this.loaded) {
      throw new Error('ProfileStore.load() must complete before use');
    }
  }

  async load(): Promise<void> {
    const raw = await this.kv.getItem(PROFILE_KEY);
    this.profile = normalizeProfile(raw == null ? null : JSON.parse(raw));
    this.loaded = true;
  }

  current(): OwnProfile {
    this.assertLoaded();
    return this.profile;
  }

  async update(next: ProfileUpdate): Promise<OwnProfile> {
    this.assertLoaded();
    if (this.profile.revision >= MAX_PROFILE_REVISION) {
      throw new Error('Profile revision limit reached. Remove and recreate the profile before sharing again.');
    }
    this.profile = {
      ...next,
      revision: this.profile.revision + 1,
    };
    await this.kv.setItem(PROFILE_KEY, JSON.stringify(this.profile));
    this.notify();
    return this.profile;
  }
}
