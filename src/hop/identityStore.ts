// The node identity, persisted to the platform keystore: Keychain on iOS, EncryptedSharedPreferences
// backed by the Android Keystore on Android (both via react-native-keychain, bound in the adapter
// below rather than here).
//
// THE BUG CLASS THIS FILE EXISTS TO PREVENT, learned from the Swift app's own history (burnchat
// commit 2fc1d2a): IdentityStore.saveSecret there passed a malformed update query to SecItemUpdate,
// which failed with a status that was neither success nor not-found, and the guard swallowed it. The
// node minted a NEW identity on every launch, so every contact who saved the address silently stopped
// being able to reach the device. A silent write here is indistinguishable from identity loss.
//
// So this module does two things differently, on principle:
// 1. Every failure throws, carrying the consequence in plain words.
// 2. After writing, it reads the value back and compares. The write must PROVE it landed; trusting a
//    success return alone is exactly the mistake that ate the Swift app's identities.

/**
 * The keystore, as this module needs it: put a string somewhere durable, get it back, and say so when
 * either fails. Deliberately narrow. Platform placement decisions (service name, accessibility class)
 * belong to the adapter, so this contract stays testable and carries no security claim it cannot
 * honour.
 */
export interface KeychainLike {
  /** The stored secret, or null when nothing has been stored yet. */
  read(): Promise<string | null>;
  /** Store the secret. Resolves false when the platform refused rather than throwing. */
  write(secret: string): Promise<boolean | void>;
}

/**
 * Where the node identity lives in the platform keystore, namespaced by the app id.
 *
 * This changed with the bundle id, from com.jwaldrip.gritchat.node-identity, and it is safe ONLY
 * because it changed in the same commit. A new bundle id is a different app to both platforms, so
 * every install under chat.grit.app starts with an empty keystore and there is nothing to orphan.
 * Renaming this string on its own would be the opposite: existing installs would find no identity
 * under the new name, and this module deliberately refuses to mint a replacement rather than
 * silently orphan every contact who saved the old address. Do not touch it without moving the
 * bundle id too.
 */
export const IDENTITY_SERVICE = 'chat.grit.app.node-identity';

export class IdentityStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdentityStoreError';
  }
}

const CONSEQUENCE =
  'The identity secret was not stored, so this device would get a new address on the next launch ' +
  'and every saved contact would stop reaching it.';

export class IdentityStore {
  constructor(private readonly keychain: KeychainLike) {}

  /**
   * The saved secret as base64, or null on a genuine first launch.
   *
   * A read error is NOT a first launch and must not silently become one: that is how an identity gets
   * replaced. Only an explicit absence returns null.
   */
  async load(): Promise<string | null> {
    try {
      return await this.keychain.read();
    } catch (e) {
      throw new IdentityStoreError(
        `Could not read the identity from the platform keystore (${String(e)}). Refusing to mint a ` +
          'replacement identity: if this device already has one, a new one would orphan every ' +
          'contact who saved its address.',
      );
    }
  }

  /** Persist the secret (base64), then prove it landed by reading it back. */
  async save(secretB64: string): Promise<void> {
    let result: boolean | void;
    try {
      result = await this.keychain.write(secretB64);
    } catch (e) {
      throw new IdentityStoreError(
        `Writing the identity to the platform keystore failed (${String(e)}). ${CONSEQUENCE}`,
      );
    }
    if (result === false) {
      throw new IdentityStoreError(
        `The platform keystore refused the identity write. ${CONSEQUENCE}`,
      );
    }

    const readBack = await this.load();
    if (readBack !== secretB64) {
      throw new IdentityStoreError(
        `The identity was written but did not read back identical. ${CONSEQUENCE}`,
      );
    }
  }
}
