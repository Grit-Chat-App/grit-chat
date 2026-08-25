// Configuration, read from the native side at startup.
//
// The relay endpoint is a business fact, not a literal: it moves between the simulator
// (ws://127.0.0.1:18765/), an Android emulator (ws://10.0.2.2:18765/), a phone on the LAN
// (ws://10.4.1.221:18765/) and, later, a real wss:// relay. So it is a build-time value read from
// Info.plist through the GritConfig native module, and there is NO fallback: when it is unset the
// app says so on screen and dials nothing.
//
// Why no default. wss://relay.hopme.sh/ was the obvious default and it is wrong twice over: the
// production fleet is off, so that host answers with hop-endpoint behind Google Frontend rather than
// a hop-relayd, and a WebSocket that completes an upgrade against it reports "up" while carrying
// nothing. A default that looks connected and is not is worse than no default.

import {NativeModules} from 'react-native';

interface GritConfigConstants {
  relayUrl: string;
  launchArguments: string[];
  buildSha?: string;
  buildTime?: string;
}

/**
 * What a build says about itself, for the one line on the identity screen.
 *
 * Both are optional on the wire because an app installed before this existed has a native module
 * that does not send them, and the honest answer there is "unknown", not a crash and not a guess.
 */
export function buildLabel(sha: string | null, time: string | null): string {
  if (sha == null && time == null) {
    return 'build unknown';
  }
  if (time == null) {
    return `build ${sha}`;
  }
  if (sha == null) {
    return `build unknown, ${time}`;
  }
  return `build ${sha}, ${time}`;
}

/** Empty, blank and an unexpanded build-setting token all mean "nobody told this build". */
export function definedOrNull(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (trimmed.length === 0 || trimmed.startsWith('$(') || trimmed.startsWith('${')) {
    return null;
  }
  return trimmed;
}

export type OpenScreen = 'conversations' | 'chat' | 'add-contact' | 'identity' | 'channel' | 'new-channel';

export interface AppConfig {
  /** The relay to dial, or null when unconfigured. Null is a state the UI shows, never a default. */
  relayUrl: string | null;
  /** Process arguments, so a proof run can be driven without a rebuild. */
  launchArguments: string[];
  /** Address to send a proof message to, from --grit-proof-peer. */
  proofPeer: string | null;
  /** Nonce the receiving node matches on, from --grit-proof-nonce. */
  proofNonce: string | null;
  /**
   * Dev-only screen override from --grit-screen. Exists so a machine with no tap tool can still
   * open chat, add-contact and identity and look at them. Production launches never pass this.
   */
  openScreen: OpenScreen | null;
  /** Address to open in chat when --grit-screen chat is set, from --grit-chat-peer. */
  chatPeer: string | null;
  /** Channel path to open when --grit-screen channel is set, from --grit-channel-path. */
  channelPath: string | null;
  /**
   * Dev-only: --grit-channel-proof <path> hosts a channel at <path>, publishes a proof post, and
   * waits for a reply from a second node, so a channel round trip can be driven from a command
   * line without tapping the screen.
   */
  channelProofPath: string | null;
  /** Dev-only: --grit-reset-store drops contacts and messages so a screenshot is not leftover proof debris. */
  resetStore: boolean;
  /** The commit this binary was built from, or null when the build was never told. */
  buildSha: string | null;
  /** When this binary was built, or null when the build was never told. */
  buildTime: string | null;
  /** True when the native module is missing entirely, which means the app was not rebuilt. */
  nativeMissing: boolean;
}

function argAfter(args: string[], flag: string): string | null {
  const at = args.indexOf(flag);
  if (at < 0 || at + 1 >= args.length) {
    return null;
  }
  const value = args[at + 1];
  return value.length > 0 ? value : null;
}

function parseOpenScreen(value: string | null): OpenScreen | null {
  if (
    value === 'conversations' ||
    value === 'chat' ||
    value === 'add-contact' ||
    value === 'identity' ||
    value === 'channel' ||
    value === 'new-channel'
  ) {
    return value;
  }
  return null;
}

export function readConfig(): AppConfig {
  const native = NativeModules.GritConfig as
    | {getConstants?: () => GritConfigConstants}
    | undefined;

  if (native == null) {
    return {
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
      nativeMissing: true,
    };
  }

  const constants = native.getConstants != null ? native.getConstants() : (native as unknown as GritConfigConstants);
  const url = (constants.relayUrl ?? '').trim();
  const args = constants.launchArguments ?? [];

  return {
    // An unsubstituted build setting would arrive as the literal "$(GRIT_RELAY_URL)". Treat that as
    // unset rather than dialing a nonsense host.
    relayUrl: url.length > 0 && !url.startsWith('$(') ? url : null,
    launchArguments: args,
    proofPeer: argAfter(args, '--grit-proof-peer'),
    proofNonce: argAfter(args, '--grit-proof-nonce'),
    openScreen: parseOpenScreen(argAfter(args, '--grit-screen')),
    chatPeer: argAfter(args, '--grit-chat-peer'),
    channelPath: argAfter(args, '--grit-channel-path'),
    channelProofPath: argAfter(args, '--grit-channel-proof'),
    resetStore: args.includes('--grit-reset-store'),
    buildSha: definedOrNull(constants.buildSha),
    buildTime: definedOrNull(constants.buildTime),
    nativeMissing: false,
  };
}
