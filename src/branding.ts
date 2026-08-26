// The single home of every user-visible product string for the React Native app, mirroring the Swift
// app's AppBranding.swift. The old "BurnChat" codename is retired everywhere, including the target,
// module, package and repository names. User-visible strings never carried it and still do not. If the pending trademark opinion on "Grit Chat" comes back
// badly, this module is the seam that makes a second rename cheap.
//
// The naming position (from AppBranding.swift, still current): a live Class 38 mark exists (Grit Media
// LLC, reg 4792116, television broadcasting) in a crowded field that also includes Garmin and Team
// Grit. The services look unrelated, but no trademark opinion has been obtained.

export const Branding = {
  /** The product name. iOS Info.plist CFBundleDisplayName and Android app_name stay in sync by hand. */
  displayName: 'Grit Chat',

  /** What the app does, stated as a fact and nothing more. */
  tagline: 'Messages carried device to device',

  /** The approved endorsement shape. Hop is the network this app runs on, not part of its name. */
  runsOn: 'Runs on Hop',

  /** First screen, no contacts. The product is a messenger: emptiness is "nobody has you yet". */
  emptyHeadline: 'Nobody here yet',
  emptyLead:
    'You have an address. Nobody else has it until you show it to them, or they show you theirs.',

  /**
   * Honest transport summary. This build includes native Bluetooth and local-network bearers as
   * well as a relay. A local delivery still needs the OS permission, an active direct link, and a
   * peer address. Nothing is discovered automatically, and no physical local receipt is claimed.
   */
  transportReality:
    'No phone number, no account, no server that can read your messages. This build includes ' +
    'Bluetooth, local-network, and relay paths. Local delivery needs your permission, a live direct ' +
    'link, and the other person’s address. Nobody is discovered automatically, and a physical local ' +
    'receipt is not confirmed yet.',

  /** Shown when no relay endpoint is configured. There is deliberately no default to fall back to. */
  relayUnconfigured:
    'No relay configured. A message may still travel over a live Bluetooth or local-network link; ' +
    'otherwise ask an operator for a WSS endpoint, then set it below or build with GRIT_RELAY_URL set.',

  /**
   * What relay "carrying" does and does not mean. The bearer moves opaque bytes and cannot read the
   * protocol, so an open socket is not proof the relay accepted anything. A message arriving is.
   */
  relayMeaning:
    'Carrying means the socket is open and the core is driving the link. It does not prove the relay ' +
    'accepted anything: the bearer moves sealed bytes and cannot read the protocol. A delivered ' +
    'message is the only proof of that.',
} as const;
