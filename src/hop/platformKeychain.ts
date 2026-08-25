// The platform keystore adapter: the one place react-native-keychain is bound, and the one place the
// placement decisions live.
//
// ACCESSIBLE.AFTER_FIRST_UNLOCK, matching the Swift app: a background wake may need to restore the
// node, so the item has to be readable when the device is locked but has been unlocked once since
// boot. That is a placement decision about availability, not a security claim.

import * as Keychain from 'react-native-keychain';

import {IDENTITY_SERVICE, KeychainLike} from './identityStore';

const USERNAME = 'identity';

export const platformKeychain: KeychainLike = {
  async read() {
    const entry = await Keychain.getGenericPassword({service: IDENTITY_SERVICE});
    return entry === false ? null : entry.password;
  },
  async write(secret) {
    const result = await Keychain.setGenericPassword(USERNAME, secret, {
      service: IDENTITY_SERVICE,
      accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK,
    });
    return result !== false;
  },
};
