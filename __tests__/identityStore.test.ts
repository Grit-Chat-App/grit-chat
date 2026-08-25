// The identity store exists because of a shipped bug: the Swift app's keystore write failed with a
// status nobody checked, so every launch minted a new identity and silently orphaned every contact.
// These tests pin the two behaviours that prevent a repeat: nothing is silent, and a write must prove
// it landed by reading back.

import {IdentityStore, IdentityStoreError, KeychainLike} from '../src/hop/identityStore';

function workingKeychain(seed: string | null = null): KeychainLike {
  let stored = seed;
  return {
    async read() {
      return stored;
    },
    async write(secret) {
      stored = secret;
      return true;
    },
  };
}

describe('loading an identity', () => {
  it('returns null on a genuine first launch', async () => {
    await expect(new IdentityStore(workingKeychain()).load()).resolves.toBeNull();
  });

  it('returns the stored secret when one exists', async () => {
    await expect(new IdentityStore(workingKeychain('c2VjcmV0')).load()).resolves.toBe('c2VjcmV0');
  });

  it('throws on a read error rather than reporting a first launch', async () => {
    const failing: KeychainLike = {
      read: async () => {
        throw new Error('keychain unavailable');
      },
      write: async () => true,
    };
    // Treating a read failure as "no identity yet" is what replaces a live identity with a new one.
    await expect(new IdentityStore(failing).load()).rejects.toThrow(IdentityStoreError);
    await expect(new IdentityStore(failing).load()).rejects.toThrow(/Refusing to mint a replacement/);
  });
});

describe('saving an identity', () => {
  it('stores the secret and confirms it by reading back', async () => {
    const keychain = workingKeychain();
    const store = new IdentityStore(keychain);
    await store.save('c2VjcmV0');
    await expect(keychain.read()).resolves.toBe('c2VjcmV0');
  });

  it('throws when the platform refuses the write', async () => {
    const refusing: KeychainLike = {
      read: async () => null,
      write: async () => false,
    };
    await expect(new IdentityStore(refusing).save('c2VjcmV0')).rejects.toThrow(
      /refused the identity write/,
    );
  });

  it('throws when the write throws', async () => {
    const throwing: KeychainLike = {
      read: async () => null,
      write: async () => {
        throw new Error('errSecParam');
      },
    };
    await expect(new IdentityStore(throwing).save('c2VjcmV0')).rejects.toThrow(/errSecParam/);
  });

  it('throws when the value does not read back identical, even though the write said success', async () => {
    // This is the exact shape of the Swift defect: an API reporting success while nothing landed.
    const lying: KeychainLike = {
      read: async () => null,
      write: async () => true,
    };
    await expect(new IdentityStore(lying).save('c2VjcmV0')).rejects.toThrow(
      /did not read back identical/,
    );
  });

  it('explains the consequence in every failure, because the symptom appears much later', async () => {
    const refusing: KeychainLike = {read: async () => null, write: async () => false};
    await expect(new IdentityStore(refusing).save('x')).rejects.toThrow(
      /new address on the next launch/,
    );
  });
});
