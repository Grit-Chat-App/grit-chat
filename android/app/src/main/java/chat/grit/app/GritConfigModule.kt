// Startup configuration that JavaScript cannot work out for itself: which Hop relay this build was
// pointed at, and the arguments the process was launched with. The Android half of
// ios/GritChat/GritConfig.swift, exporting the same two constants under the same module name so
// src/config.ts reads one contract on both platforms.
//
// Both cross the bridge as constants rather than promise-returning methods. A proof run or the first
// render needs to branch on the relay URL immediately, and an async read would make the app flash a
// wrong state while the promise settles.
//
// This is a legacy bridge module, not a codegen TurboModule, matching the shape
// @hop-mesh/react-native uses in HopMeshModule.kt. Under the New Architecture it reaches JavaScript
// through the TurboModule interop layer: ReactPackageTurboModuleManagerDelegate calls
// createNativeModules() on any plain ReactPackage whenever enableBridgelessArchitecture() and
// useTurboModuleInterop() are both on, and both default to true in this React Native version.

package chat.grit.app

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule

class GritConfigModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  // Read once, when JavaScript first resolves the module, and cached by the bridge for the lifetime
  // of that React instance. Nothing here re-reads: a relaunch is what picks up new arguments, which
  // is why the adb form below passes -S. MainActivity is launchMode="singleTask", so a warm
  // `am start` would land in onNewIntent and leave getIntent() holding the original extras.
  override fun getConstants(): Map<String, Any> =
    mapOf(
      "relayUrl" to relayUrl(),
      "launchArguments" to launchArguments(),
      // Baked by app/build.gradle from git. versionName and versionCode are frozen at 1.0 and 1,
      // so these are the only things that distinguish one APK from another.
      "buildSha" to BuildConfig.GRIT_BUILD_SHA,
      "buildTime" to BuildConfig.GRIT_BUILD_TIME,
    )

  // The relay endpoint comes from the gritRelayUrl Gradle property, turned into the GRIT_RELAY_URL
  // BuildConfig field by app/build.gradle, and defaulting to the empty string there.
  //
  // There is deliberately no default anywhere in this file. A build that was never told which relay
  // to use has to reach JavaScript as an empty string so the app can say so out loud, rather than
  // quietly dialling a host nobody chose and looking like a network fault instead of a config one.
  private fun relayUrl(): String {
    val trimmed = BuildConfig.GRIT_RELAY_URL.trim()

    // Blank is the ordinary "nobody configured a relay": the Gradle property is undefined and the
    // field defaulted to empty. The two token shapes are the defensive case, and are the same ones
    // the iOS side and src/config.ts screen for: a value that still looks like an unexpanded
    // substitution is a config mistake, and handing JavaScript "${GRIT_RELAY_URL}" would look like a
    // configured endpoint to every check downstream of here.
    if (trimmed.isEmpty() || trimmed.startsWith("\$(") || trimmed.startsWith("\${")) {
      return ""
    }

    return trimmed
  }

  // Android has no argv to read. A launched app gets its inputs as Intent extras, so the iOS
  // ProcessInfo.processInfo.arguments equivalent is one string extra that this splits on whitespace:
  //
  //   adb shell am start -S -n chat.grit.app/.MainActivity \
  //     --es gritArgs "--grit-proof-peer <address> --grit-proof-nonce <nonce>"
  //
  // Only gritArgs is read, and only ever as a whole. That is the point of using a single named
  // extra: Detox launches the app with extras of its own (detoxServer, detoxSessionId), and a
  // scheme that swept up every extra would feed those to src/config.ts as app arguments.
  //
  // Unlike iOS there is no argv[0] here, and nothing downstream wants one: argAfter() in
  // src/config.ts searches for a flag rather than indexing from a fixed offset.
  private fun launchArguments(): List<String> {
    // Null until an Activity is in the foreground. Constants are pulled when JavaScript resolves the
    // module, which is after MainActivity has started, so this is populated on a real launch; a null
    // here still has to answer with an empty list rather than throwing, because a module that fails
    // to produce constants takes the whole bridge down with it.
    val raw = reactApplicationContext.currentActivity?.intent?.getStringExtra(LAUNCH_ARGUMENTS_EXTRA)

    if (raw.isNullOrBlank()) {
      return emptyList()
    }

    return raw.split(WHITESPACE).filter { it.isNotEmpty() }
  }

  companion object {
    // Must match the name ios/GritChat/GritConfig.m registers and the one src/config.ts looks up on
    // NativeModules.
    const val NAME: String = "GritConfig"

    private const val LAUNCH_ARGUMENTS_EXTRA: String = "gritArgs"

    private val WHITESPACE: Regex = Regex("\\s+")
  }
}
