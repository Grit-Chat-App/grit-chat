// App-wide wiring: one seam, one store, one config, created once and shared. This is the only place
// that binds the platform modules (keystore, filesystem path, AsyncStorage, native config) to the
// seam, so every screen below it is testable against fakes and none of them touch
// @hop-mesh/react-native.
//
// Startup is deliberately fail-loud. If the identity cannot be persisted, or Hop cannot open its
// store, the app says so on a screen instead of running in a state where every contact silently
// stops being able to reach this device on the next launch.

import React, {createContext, useContext, useEffect, useState} from 'react';
import RNFS from 'react-native-fs';

import {AppConfig, readConfig} from '../config';
import {IdentityStore} from '../hop/identityStore';
import {platformKeychain} from '../hop/platformKeychain';
import {ChannelProofTrace, channelProofSummary, runChannelProof} from '../hop/channelProof';
import {ProofTrace, proofSummary, runProof} from '../hop/proofRun';
import {GritSeam, sdkFactory} from '../hop/seam';
import {RelayState} from '../hop/relayBearer';
import {ChannelStore} from '../store/channels';
import {isMedia} from '../hop/media';
import {persistInboundMedia} from '../hop/mediaFiles';
import {ConversationStore} from '../store/conversations';
import {asyncStorageKv} from '../store/asyncStorageKv';
import {wireArrivals} from '../notifications/wire';
import {persistProfilePhoto} from '../profile/files';
import {parseProfile, ParsedProfile, PROFILE_CONTENT_TYPE} from '../profile/protocol';
import {ProfileStore} from '../store/profile';

export type GritStatus = 'starting' | 'ready' | 'failed';

export interface GritValue {
  status: GritStatus;
  config: AppConfig;
  error?: string;
  seam?: GritSeam;
  store?: ConversationStore;
  channels?: ChannelStore;
  profiles?: ProfileStore;
  /** One line describing the last proof run, when one was asked for at launch. */
  lastProof?: string;
}

const EMPTY_CONFIG: AppConfig = {
  relayUrl: null,
  launchArguments: [],
  proofPeer: null,
  proofNonce: null,
  openScreen: null,
  chatPeer: null,
  channelPath: null,
  channelProofPath: null,
  resetStore: false,
  buildSha: null,
  buildTime: null,
  nativeMissing: false,
};

const GritContext = createContext<GritValue>({status: 'starting', config: EMPTY_CONFIG});

// React 19 invokes effects twice in development. Starting two nodes against one db path would be a
// real corruption risk, so creation is memoized at module scope rather than per mount.
let startup: Promise<{
  seam: GritSeam;
  store: ConversationStore;
  channels: ChannelStore;
  profiles: ProfileStore;
  config: AppConfig;
}> | null = null;
let proofRan = false;
let channelProofRan = false;

async function boot(): Promise<{
  seam: GritSeam;
  store: ConversationStore;
  channels: ChannelStore;
  profiles: ProfileStore;
  config: AppConfig;
}> {
  const config = readConfig();

  const store = new ConversationStore(asyncStorageKv);
  await store.load();
  const channels = new ChannelStore(asyncStorageKv);
  await channels.load();
  const profiles = new ProfileStore(asyncStorageKv);
  await profiles.load();
  if (config.resetStore) {
    await store.reset();
    await channels.reset();
  }

  const seam = await GritSeam.start({
    factory: sdkFactory,
    identity: new IdentityStore(platformKeychain),
    kv: asyncStorageKv,
    documentsPath: RNFS.DocumentDirectoryPath,
    relayUrl: config.relayUrl,
  });

  // A direct inbox item is acknowledged only after this handler has durably classified it. Profile
  // cards are control payloads, never message bubbles or notification previews.
  seam.onInbound(async (m) => {
    if (m.contentType === PROFILE_CONTENT_TYPE) {
      let parsed: ParsedProfile;
      try {
        parsed = parseProfile(m.body, m.bodyBytes?.length);
      } catch (e) {
        // The malformed card is deliberately accepted so the Hop inbox cannot redeliver it forever.
        console.warn('rejected profile card', e);
        return;
      }
      const photo =
        parsed.photoBase64 == null
          ? undefined
          : await persistProfilePhoto(parsed.photoBase64, `received-${m.from}-${parsed.profile.revision}`);
      await store.stageProfile(m.from, {
        ...parsed.profile,
        photo,
        receivedAt: Date.now(),
        messageId: m.id,
      });
      return;
    }

    if (store.contactByAddress(m.from) == null) {
      await store.addContact(m.from);
    }
    // Media bytes live on disk; the row carries the URI. A failed write still keeps the row,
    // with no URI, which the bubble renders as an honest "could not save" instead of a broken
    // image icon.
    const mediaUri =
      isMedia(m.contentType) && m.bodyBytes != null
        ? await persistInboundMedia(m.bodyBytes, m.id, m.contentType)
        : undefined;
    await store.appendInbound(m.from, m.body, m.hops, m.id, m.at, m.contentType, mediaUri ?? undefined);
  });

  // The node's own topic list is the truth for which channels exist (it persists topics; we do
  // not duplicate that). Reconcile ours against it at every boot: channels whose keys arrived
  // while we were away become joined, and channels we left or were removed from disappear.
  try {
    await channels.reconcile(await seam.myChannels());
  } catch (e) {
    // A failed reconcile is surfaced, not swallowed: it means the channel list may be stale, and
    // the screens will still work off the last persisted state rather than an empty one.
    console.warn('channel reconcile failed at boot', e);
  }

  // Channel publications: persist, then accept (the seam withholds the accept on false, so an
  // unknown channel stays queued and the next reconcile can pick it up instead of losing it).
  seam.onChannelMessage(async (m) => {
    if (channels.channelByPath(m.path) == null) {
      return false;
    }
    const stored = await channels.appendInbound(m.path, m.sender, m.body, m.id);
    return stored != null;
  });

  // Invites are take-and-clear at the core. Persisting HERE, in the arrival handler, is the
  // whole difference between an invite the user sees and one that never existed.
  seam.onChannelInvite((invite) => {
    void channels.addInvite(invite.host, invite.path, invite.kind);
  });

  // Arrival notification and badge, wired off the same pump that feeds the stores. This is what
  // makes the app able to tell you a message came. It is local and foreground-only by design; the
  // UI and docs name background push as future work rather than implying it.
  wireArrivals(seam, store, channels);

  return {seam, store, channels, profiles, config};
}

export function GritProvider({children}: {children: React.ReactNode}): React.JSX.Element {
  const [value, setValue] = useState<GritValue>({status: 'starting', config: EMPTY_CONFIG});

  useEffect(() => {
    let live = true;
    startup = startup ?? boot();
    startup
      .then(async ({seam, store, channels, profiles, config}) => {
        if (!live) {
          return;
        }
        setValue({status: 'ready', seam, store, channels, profiles, config});

        // A proof run is asked for by launch argument, so a run can be driven from a command line
        // without tapping the screen. It sends through the ordinary product path, so the message
        // shows up in its conversation like any other.
        if (config.proofPeer != null && !proofRan) {
          proofRan = true;
          // The send is useless until the relay link is carrying and the prekey has been
          // published over it. Wait for that, rather than firing into a link that is still
          // shaking hands and reporting relayed=0 forever.
          await waitForRelayReady(seam);
          const trace: ProofTrace | null = await runProof(seam, store, config);
          if (live && trace != null) {
            setValue({
              status: 'ready',
              seam,
              store,
              channels,
              profiles,
              config,
              lastProof: proofSummary(trace),
            });
          }
        }

        // Channel proof, same rule: driven by launch argument, through the ordinary product
        // path (create via the seam, publish into the store), so what it proves is what the
        // UI shows.
        if (config.channelProofPath != null && !channelProofRan) {
          channelProofRan = true;
          await waitForRelayReady(seam);
          const trace = await runChannelProof(seam, channels, config.channelProofPath, asyncStorageKv);
          if (live && trace != null) {
            setValue({
              status: 'ready',
              seam,
              store,
              channels,
              profiles,
              config,
              lastProof: channelProofSummary(trace),
            });
          }
        }
      })
      .catch((e: unknown) => {
        if (live) {
          setValue({status: 'failed', config: EMPTY_CONFIG, error: String(e)});
        }
      });
    return () => {
      live = false;
    };
  }, []);

  return <GritContext.Provider value={value}>{children}</GritContext.Provider>;
}

export function useGrit(): GritValue {
  return useContext(GritContext);
}

/** The seam and stores, for screens that only render once startup succeeded. */
export function useReadyGrit(): {
  seam: GritSeam;
  store: ConversationStore;
  channels: ChannelStore;
  profiles: ProfileStore;
} {
  const value = useContext(GritContext);
  if (
    value.status !== 'ready' ||
    value.seam == null ||
    value.store == null ||
    value.channels == null ||
    value.profiles == null
  ) {
    throw new Error('useReadyGrit used outside a ready GritProvider');
  }
  return {seam: value.seam, store: value.store, channels: value.channels, profiles: value.profiles};
}

/** Live relay state, re-rendered as the bearer reports transitions. */
export function useRelayState(): {state: RelayState; detail?: string} {
  const {seam} = useGrit();
  const [snapshot, setSnapshot] = useState<{state: RelayState; detail?: string}>(
    () => seam?.relayState() ?? {state: 'unconfigured'},
  );

  useEffect(() => {
    if (seam == null) {
      return;
    }
    setSnapshot(seam.relayState());
    return seam.onRelayState((state, detail) => {
      setSnapshot({state, detail});
    });
  }, [seam]);

  return snapshot;
}

/** Re-render on every persisted store mutation. */
export function useStoreVersion(): number {
  const {store} = useGrit();
  const [version, setVersion] = useState(store?.version ?? 0);
  useEffect(() => {
    if (store == null) {
      return;
    }
    setVersion(store.version);
    return store.subscribe(() => {
      setVersion(store.version);
    });
  }, [store]);
  return version;
}

/** Re-render own-profile screens after a durable profile update. */
export function useProfileVersion(): number {
  const {profiles} = useGrit();
  const [version, setVersion] = useState(profiles?.version ?? 0);
  useEffect(() => {
    if (profiles == null) {
      return;
    }
    setVersion(profiles.version);
    return profiles.subscribe(() => {
      setVersion(profiles.version);
    });
  }, [profiles]);
  return version;
}

/**
 * Re-render on every persisted CHANNEL store mutation. The 1:1 hook above cannot see these:
 * the channel store is its own object with its own version counter, and a screen that only
 * watched the other one rendered channel rows and channel messages once, at mount, and then
 * never again. The Detox suite caught exactly that: a hosted channel never appeared in the
 * conversation list because the list had been mounted before it existed.
 */
export function useChannelsVersion(): number {
  const {channels} = useGrit();
  const [version, setVersion] = useState(channels?.version ?? 0);
  useEffect(() => {
    if (channels == null) {
      return;
    }
    setVersion(channels.version);
    return channels.subscribe(() => {
      setVersion(channels.version);
    });
  }, [channels]);
  return version;
}

function waitForRelayReady(seam: GritSeam): Promise<void> {
  if (seam.relayState().state === 'up' && seam.prekeyPublished) {
    return Promise.resolve();
  }
  const {promise, resolve} = Promise.withResolvers<void>();
  const started = Date.now();
  const tick = setInterval(() => {
    const ready = seam.relayState().state === 'up' && seam.prekeyPublished;
    if (ready || Date.now() - started > 15_000) {
      clearInterval(tick);
      resolve();
    }
  }, 200);
  return promise;
}
