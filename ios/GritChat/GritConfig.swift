// Startup configuration that JavaScript cannot work out for itself: which Hop relay this build was
// pointed at, and the arguments the process was launched with.
//
// Both cross the bridge as constants rather than promise-returning methods. A proof run or the first
// render needs to branch on the relay URL immediately, and an async read would make the app flash a
// wrong state while the promise settles.
//
// The class is a plain NSObject and carries no exported methods. GritConfig.m declares it to the
// bridge with RCT_EXTERN_MODULE, the same shape @hop-mesh/react-native uses for its HopMesh module,
// so the two modules reach JavaScript through the same New Architecture interop path.

import Foundation

@objc(GritConfig)
final class GritConfig: NSObject {

  // Info.plist key holding the relay endpoint. Its value in the checked-in plist is the literal
  // "$(GRIT_RELAY_URL)", which Xcode replaces while it processes the plist with whatever the
  // GRIT_RELAY_URL build setting evaluates to.
  //
  // There is deliberately no default anywhere in this file. A build that was never told which relay
  // to use has to reach JavaScript as an empty string so the app can say so out loud, rather than
  // quietly dialling a host nobody chose and looking like a network fault instead of a config one.
  private static let relayURLInfoPlistKey = "GritRelayURL"

  // Which commit this binary came from, and when it was built. Same substitution mechanism as the
  // relay URL, for a reason worth stating: MARKETING_VERSION is 1.0 and CURRENT_PROJECT_VERSION is
  // 1 in both configurations, so every build this repo has ever produced reports itself as 1.0 (1)
  // and is indistinguishable from every other. Answering "which build is this" then costs a
  // forensic session against container timestamps. These two keys turn that into a glance.
  //
  // A build that was not told stays honest and says so, exactly like the relay: no default, no
  // guess, and an unexpanded substitution token is treated as unset.
  private static let buildShaInfoPlistKey = "GritBuildSha"
  private static let buildTimeInfoPlistKey = "GritBuildTime"

  @objc
  func constantsToExport() -> [AnyHashable: Any]! {
    [
      "relayUrl": GritConfig.relayURL(),
      // Every argument, argv[0] included, so a proof run can pass its own values through
      // `xcrun devicectl device process launch --arguments ...` and have JavaScript read them back.
      "launchArguments": ProcessInfo.processInfo.arguments,
      "buildSha": GritConfig.plistString(GritConfig.buildShaInfoPlistKey),
      "buildTime": GritConfig.plistString(GritConfig.buildTimeInfoPlistKey),
    ]
  }

  private static func relayURL() -> String {
    plistString(relayURLInfoPlistKey)
  }

  /// One reader for every substituted Info.plist value, so the relay URL and the build identity
  /// cannot drift apart in how they treat "not configured".
  private static func plistString(_ key: String) -> String {
    guard let raw = Bundle.main.object(forInfoDictionaryKey: key) as? String else {
      return ""
    }

    let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)

    // Two shapes both mean "nobody configured this". Blank is the ordinary one: the build setting
    // is defined and empty. The other is a leftover substitution token, which is what a plist keeps
    // when the referenced build setting is not defined at all rather than defined-and-empty. Xcode's
    // behaviour there is worth being defensive about, because handing JavaScript the string
    // "$(GRIT_RELAY_URL)" would look like a configured endpoint to every check downstream of here,
    // and "$(GRIT_BUILD_SHA)" would look like a commit.
    if trimmed.isEmpty || trimmed.hasPrefix("$(") || trimmed.hasPrefix("${") {
      return ""
    }

    return trimmed
  }
}
