// The scanner's accept flow, tested without a camera. The camera can only produce a string; what
// matters is that an empty string, your own address, and anything the SDK's decoder rejects are
// all refused with a reason the screen can show, and that a valid address becomes a contact.

import {acceptScannedAddress} from '../src/contacts/acceptAddress';
import {encodeContactCard} from '../src/contacts/contactCard';
import {OwnProfile} from '../src/profile/types';

const OWN = 'GrfdBYiMsvMvRFeZ4BVmRzXQ8sivHB4wYtQ9pKcTn3Ab';
const PEER = 'DwDmNvpnaZa95JLeHXbVBd5RUgUJWJkE2WB4RZKbRBv2';

const PUBLIC_PROFILE: OwnProfile = {
  name: 'Mara Vale',
  contact: 'mara@example.test',
  nameScope: 'public',
  contactScope: 'private',
  photoScope: 'private',
  revision: 2,
};

describe('acceptScannedAddress', () => {
  it('refuses an empty scan', async () => {
    const outcome = await acceptScannedAddress(async () => true, async () => {}, OWN, '   ');
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toMatch(/empty/i);
  });

  it('refuses your own address, because that is not a peer', async () => {
    const added: string[] = [];
    const outcome = await acceptScannedAddress(
      async () => true,
      async (a) => {
        added.push(a);
      },
      OWN,
      OWN,
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toMatch(/this device/);
    expect(added).toHaveLength(0);
  });

  it('refuses anything the SDK decoder rejects, with the same reason as the paste path', async () => {
    const added: string[] = [];
    const outcome = await acceptScannedAddress(
      async () => false,
      async (a) => {
        added.push(a);
      },
      OWN,
      'not-a-real-address',
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toMatch(/not a hop address/i);
    expect(added).toHaveLength(0);
  });

  it('accepts a valid address and adds it once', async () => {
    const added: string[] = [];
    const outcome = await acceptScannedAddress(
      async () => true,
      async (a) => {
        added.push(a);
      },
      OWN,
      PEER,
    );
    expect(outcome.ok).toBe(true);
    expect(outcome.address).toBe(PEER);
    expect(added).toEqual([PEER]);
  });
  it('preserves a legacy raw address and stages only public QR fields for acceptance', async () => {
    const card = encodeContactCard(PEER, PUBLIC_PROFILE);
    const outcome = await acceptScannedAddress(async (address) => address === PEER, async () => {}, OWN, card);
    expect(outcome).toMatchObject({
      ok: true,
      address: PEER,
      profile: {name: 'Mara Vale', revision: 2},
    });
    expect(outcome.profile?.contact).toBeUndefined();
  });

});
