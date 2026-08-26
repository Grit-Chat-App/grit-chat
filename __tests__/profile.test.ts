import {
  MAX_PROFILE_PHOTO_BYTES,
  parseProfile,
  PROFILE_CONTENT_TYPE,
  serializeProfile,
} from '../src/profile/protocol';
import {ProfileStore} from '../src/store/profile';
import {memoryKv} from '../src/store/kv';
import {OwnProfile} from '../src/profile/types';

const PROFILE: OwnProfile = {
  name: 'Mara Vale',
  contact: 'mara@example.test',
  nameScope: 'public',
  contactScope: 'private',
  photoScope: 'private',
  photo: {uri: 'file:///tmp/mara.jpg', contentType: 'image/jpeg', byteLength: 4},
  revision: 1,
};

describe('profile privacy serialization', () => {
  it('includes only public fields until the owner explicitly selects private fields', () => {
    const publicCard = JSON.parse(
      serializeProfile(PROFILE, {
        includePrivateName: false,
        includePrivateContact: false,
        includePrivatePhoto: false,
      }),
    ) as Record<string, unknown>;
    expect(publicCard).toMatchObject({v: 1, revision: 1, name: 'Mara Vale'});
    expect(publicCard.contact).toBeUndefined();
    expect(publicCard.photo).toBeUndefined();

    const namedShare = JSON.parse(
      serializeProfile(
        PROFILE,
        {includePrivateName: false, includePrivateContact: true, includePrivatePhoto: true},
        '/9j/4A==',
      ),
    ) as Record<string, unknown>;
    expect(namedShare.contact).toBe('mara@example.test');
    expect(namedShare.photo).toEqual({contentType: 'image/jpeg', base64: '/9j/4A=='});
  });

  it('uses a distinct application content type rather than an ordinary chat message', () => {
    expect(PROFILE_CONTENT_TYPE).toBe('application/vnd.grit-chat.profile+json');
  });

  it('rejects private-only shares until the owner chooses a field', () => {
    const privateOnly = {...PROFILE, nameScope: 'private' as const, photo: undefined};
    expect(() =>
      serializeProfile(privateOnly, {
        includePrivateName: false,
        includePrivateContact: false,
        includePrivatePhoto: false,
      }),
    ).toThrow(/choose at least one/i);
  });
});

describe('bounded profile cards', () => {
  it('rejects an oversized photo before it can enter the profile envelope', () => {
    const oversized = '/9j/' + 'AAAA'.repeat(Math.ceil((MAX_PROFILE_PHOTO_BYTES - 2) / 3));
    expect(() =>
      serializeProfile(
        PROFILE,
        {includePrivateName: false, includePrivateContact: false, includePrivatePhoto: true},
        oversized,
      ),
    ).toThrow(/no larger/i);
  });

  it('rejects photo bytes without a JPEG header', () => {
    expect(() =>
      serializeProfile(
        PROFILE,
        {includePrivateName: false, includePrivateContact: false, includePrivatePhoto: true},
        'AQID',
      ),
    ).toThrow(/valid jpeg/i);
  });

  it('rejects an unsupported version and a lossy inbound byte body', () => {
    expect(() => parseProfile(JSON.stringify({v: 2, revision: 1, name: 'Mara'}))).toThrow(/unsupported version/i);
    expect(() => parseProfile(JSON.stringify({v: 1, revision: 1, name: 'Mara'}), 1)).toThrow(/utf-8/i);
  });

  it('accepts a bounded card and retains its revision for recipient ordering', () => {
    const encoded = serializeProfile(
      PROFILE,
      {includePrivateName: false, includePrivateContact: true, includePrivatePhoto: true},
      '/9j/4A==',
    );
    expect(parseProfile(encoded)).toEqual({
      profile: {name: 'Mara Vale', contact: 'mara@example.test', revision: 1},
      photoBase64: '/9j/4A==',
    });
  });
});

describe('own profile migration', () => {
  it('opens safely from an existing identity installation with no profile record', async () => {
    const profiles = new ProfileStore(memoryKv());
    await profiles.load();
    expect(profiles.current()).toMatchObject({name: '', contact: '', revision: 0});
  });

  it('increments a durable revision when profile fields change', async () => {
    const kv = memoryKv();
    const profiles = new ProfileStore(kv);
    await profiles.load();
    await profiles.update({...PROFILE, photo: undefined});
    const reopened = new ProfileStore(kv);
    await reopened.load();
    expect(reopened.current()).toMatchObject({name: 'Mara Vale', revision: 1});
  });
});
