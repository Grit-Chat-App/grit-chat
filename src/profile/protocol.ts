import {OwnProfile, ProfileShareSelection, SharedProfile} from './types';

export const PROFILE_CONTENT_TYPE = 'application/vnd.grit-chat.profile+json';
export const PROFILE_SCHEMA_VERSION = 1;
export const MAX_PROFILE_ENVELOPE_BYTES = 40 * 1024;
export const MAX_PROFILE_PHOTO_BYTES = 24 * 1024;
export const MAX_PROFILE_NAME_CHARS = 80;
export const MAX_PROFILE_CONTACT_CHARS = 160;

interface ProfileWirePhoto {
  contentType: 'image/jpeg';
  base64: string;
}

interface ProfileWireEnvelope {
  v: number;
  revision: number;
  name?: string;
  contact?: string;
  photo?: ProfileWirePhoto;
}

export interface ParsedProfile {
  profile: Omit<SharedProfile, 'receivedAt' | 'photo'>;
  photoBase64?: string;
}

function isIncluded(scope: 'public' | 'private', privateSelection: boolean): boolean {
  return scope === 'public' || privateSelection;
}

function nonBlank(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function assertText(value: string | undefined, max: number, field: string): void {
  if (value != null && (value.length === 0 || value.length > max)) {
    throw new Error(`${field} must be between 1 and ${max} characters.`);
  }
}

/** Exact UTF-8 size without relying on TextEncoder, which Hermes does not provide. */
export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i += 1;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

/** Returns null for malformed base64 rather than estimating its decoded size. */
export function base64ByteLength(value: string): number | null {
  if (
    value.length === 0 ||
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) {
    return null;
  }
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return (value.length / 4) * 3 - padding;
}

function assertEnvelopeSize(encoded: string): void {
  if (utf8ByteLength(encoded) > MAX_PROFILE_ENVELOPE_BYTES) {
    throw new Error(`Profile card exceeds the ${MAX_PROFILE_ENVELOPE_BYTES / 1024} KiB limit.`);
  }
}

/**
 * Builds the only application profile payload. Public values are included by default; private
 * values require the explicit share-control selection for that field.
 */
export function serializeProfile(
  profile: OwnProfile,
  selection: ProfileShareSelection,
  photoBase64?: string,
): string {
  const name = nonBlank(profile.name);
  const contact = nonBlank(profile.contact);
  assertText(name, MAX_PROFILE_NAME_CHARS, 'Profile name');
  assertText(contact, MAX_PROFILE_CONTACT_CHARS, 'Contact information');

  const wire: ProfileWireEnvelope = {
    v: PROFILE_SCHEMA_VERSION,
    revision: profile.revision,
  };
  if (name != null && isIncluded(profile.nameScope, selection.includePrivateName)) {
    wire.name = name;
  }
  if (contact != null && isIncluded(profile.contactScope, selection.includePrivateContact)) {
    wire.contact = contact;
  }
  if (profile.photo != null && isIncluded(profile.photoScope, selection.includePrivatePhoto)) {
    if (photoBase64 == null) {
      throw new Error('The selected profile photo is unavailable on this device.');
    }
    const byteLength = base64ByteLength(photoBase64);
    if (byteLength == null || byteLength > MAX_PROFILE_PHOTO_BYTES) {
      throw new Error(`Profile photo must be a valid JPEG no larger than ${MAX_PROFILE_PHOTO_BYTES / 1024} KiB.`);
    }
    wire.photo = {contentType: 'image/jpeg', base64: photoBase64};
  }
  if (wire.name == null && wire.contact == null && wire.photo == null) {
    throw new Error('Choose at least one profile field to share.');
  }
  const encoded = JSON.stringify(wire);
  assertEnvelopeSize(encoded);
  return encoded;
}

/** Parses a received payload before it can alter any durable contact metadata. */
export function parseProfile(body: string, rawByteLength?: number): ParsedProfile {
  assertEnvelopeSize(body);
  if (rawByteLength != null && rawByteLength !== utf8ByteLength(body)) {
    throw new Error('Profile card is not valid UTF-8.');
  }
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    throw new Error('Profile card is not valid JSON.');
  }
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Profile card must be an object.');
  }
  const wire = value as Partial<ProfileWireEnvelope>;
  if (wire.v !== PROFILE_SCHEMA_VERSION) {
    throw new Error('Profile card uses an unsupported version.');
  }
  if (!Number.isInteger(wire.revision) || (wire.revision ?? 0) < 1) {
    throw new Error('Profile card has an invalid revision.');
  }
  if (wire.name != null && typeof wire.name !== 'string') {
    throw new Error('Profile name must be text.');
  }
  if (wire.contact != null && typeof wire.contact !== 'string') {
    throw new Error('Contact information must be text.');
  }
  const name = wire.name == null ? undefined : nonBlank(wire.name);
  const contact = wire.contact == null ? undefined : nonBlank(wire.contact);
  assertText(name, MAX_PROFILE_NAME_CHARS, 'Profile name');
  assertText(contact, MAX_PROFILE_CONTACT_CHARS, 'Contact information');

  let photoBase64: string | undefined;
  if (wire.photo != null) {
    if (
      typeof wire.photo !== 'object' ||
      wire.photo.contentType !== 'image/jpeg' ||
      typeof wire.photo.base64 !== 'string'
    ) {
      throw new Error('Profile photo must be a JPEG.');
    }
    const byteLength = base64ByteLength(wire.photo.base64);
    if (byteLength == null || byteLength > MAX_PROFILE_PHOTO_BYTES) {
      throw new Error(`Profile photo exceeds the ${MAX_PROFILE_PHOTO_BYTES / 1024} KiB limit.`);
    }
    photoBase64 = wire.photo.base64;
  }
  if (name == null && contact == null && photoBase64 == null) {
    throw new Error('Profile card has no shareable fields.');
  }
  return {profile: {name, contact, revision: wire.revision}, photoBase64};
}
