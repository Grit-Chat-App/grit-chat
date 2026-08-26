import {MAX_PROFILE_CONTACT_CHARS, MAX_PROFILE_NAME_CHARS, utf8ByteLength} from '../profile/protocol';
import {OwnProfile} from '../profile/types';

const CONTACT_CARD_PREFIX = 'grit-contact:';
const CONTACT_CARD_VERSION = 1;
const MAX_CONTACT_CARD_BYTES = 512;

interface ContactCardWire {
  t: 'grit-contact';
  v: number;
  address: string;
  revision: number;
  name?: string;
  contact?: string;
}

export interface ScannedContactCard {
  address: string;
  profile?: {
    name?: string;
    contact?: string;
    revision: number;
  };
}

function publicText(value: string, scope: 'public' | 'private', maxLength: number): string | undefined {
  if (scope !== 'public') {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) {
    return undefined;
  }
  return trimmed;
}

/** QR cards carry only bounded public text and a Hop address. Photos remain direct-share only. */
export function encodeContactCard(address: string, profile: OwnProfile): string {
  const card: ContactCardWire = {
    t: 'grit-contact',
    v: CONTACT_CARD_VERSION,
    address,
    revision: profile.revision,
  };
  const name = publicText(profile.name, profile.nameScope, MAX_PROFILE_NAME_CHARS);
  const contact = publicText(profile.contact, profile.contactScope, MAX_PROFILE_CONTACT_CHARS);
  if (name != null) {
    card.name = name;
  }
  if (contact != null) {
    card.contact = contact;
  }
  const encoded = `${CONTACT_CARD_PREFIX}${JSON.stringify(card)}`;
  if (utf8ByteLength(encoded) > MAX_CONTACT_CARD_BYTES) {
    throw new Error('Public contact card is too large for a QR code. Shorten the public text.');
  }
  return encoded;
}

/** Returns null for a legacy raw-address scan, preserving the original QR format. */
export function parseContactCard(scanned: string): ScannedContactCard | null {
  if (!scanned.startsWith(CONTACT_CARD_PREFIX)) {
    return null;
  }
  if (utf8ByteLength(scanned) > MAX_CONTACT_CARD_BYTES) {
    throw new Error('Contact card is too large.');
  }
  let value: unknown;
  try {
    value = JSON.parse(scanned.slice(CONTACT_CARD_PREFIX.length));
  } catch {
    throw new Error('Contact card is not valid JSON.');
  }
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Contact card must be an object.');
  }
  const card = value as Partial<ContactCardWire>;
  if (card.t !== 'grit-contact' || card.v !== CONTACT_CARD_VERSION || typeof card.address !== 'string') {
    throw new Error('Contact card uses an unsupported format.');
  }
  if (typeof card.revision !== 'number' || !Number.isInteger(card.revision) || card.revision < 0) {
    throw new Error('Contact card has an invalid revision.');
  }
  if (card.name != null && (typeof card.name !== 'string' || card.name.trim().length === 0 || card.name.length > MAX_PROFILE_NAME_CHARS)) {
    throw new Error('Contact card has an invalid public name.');
  }
  if (
    card.contact != null &&
    (typeof card.contact !== 'string' || card.contact.trim().length === 0 || card.contact.length > MAX_PROFILE_CONTACT_CHARS)
  ) {
    throw new Error('Contact card has invalid public contact information.');
  }
  const name = card.name?.trim();
  const contact = card.contact?.trim();
  return {
    address: card.address.trim(),
    profile: name != null || contact != null ? {name, contact, revision: card.revision} : undefined,
  };
}
