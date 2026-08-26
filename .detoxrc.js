// Detox configuration for Grit Chat.
//
// iOS is the proven surface: the suite runs on the named simulator below and that is where every
// green result on record comes from. Android is a bring-up. android.emu.proof is a standalone
// bundle configuration, so it can start without Metro while ordinary Debug keeps Metro development
// behavior. Its suite has not run successfully and remains wiring rather than evidence.
//
// The relay endpoint is baked in at build time. The app deliberately has NO default relay, so a
// build without one launches unconfigured, which is what the honesty scenario about clearing the
// endpoint depends on NOT being: each configuration bakes the local relay in and the scenario clears
// it through the UI. iOS passes it as the GRIT_RELAY_URL build setting; Android passes it as the
// gritRelayUrl gradle property, which the app module turns into the GRIT_RELAY_URL BuildConfig
// field. Same value, two build systems.
//
// The two URLs differ because the two runtimes see this Mac differently. The relay and the peer
// processes are macOS binaries that e2e/support/world.js spawns here, listening on 127.0.0.1:18765.
// A simulator shares the host's network stack, so 127.0.0.1 is that relay. An emulator does not: it
// runs behind QEMU user-mode networking, where 127.0.0.1 is the emulator's own loopback and the host
// loopback is reachable only through the alias 10.0.2.2. Same relay, same port, same process; the
// only thing that changes is the address the app has to dial to find it. 10.0.2.2 is also one of the
// three hosts the app permits cleartext to (android/app/src/main/res/xml/network_security_config.xml,
// the counterpart of the iOS ATS exception): ws:// is cleartext, and a relay on any other host would
// have to be named there as well as here.
//
// Scenarios that need a relay and a peer spawn them from e2e/support/world.js (hop-relayd built
// from current main, and this repo's own grit-relay-node). The paths live there.
//
// The Android build command runs the gradle wrapper, so the shell that invokes `detox build` needs a
// JDK 17 JAVA_HOME and ANDROID_HOME pointing at the SDK. Detox spawns it with the environment it
// inherits and adds nothing.

/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'cucumber-js',
      config: 'cucumber.js',
    },
    jest: null,
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/GritChat.app',
      // GRIT_BUILD_SHA and GRIT_BUILD_TIME are baked here too, so a simulator build carries the
      // same self-identification a device build does. Android needs no equivalent: its app module
      // works the sha out from git itself at configuration time.
      build:
        'cd ios && xcodebuild -workspace GritChat.xcworkspace -scheme GritChat -configuration Debug ' +
        "-sdk iphonesimulator -derivedDataPath ./build " +
        "GRIT_RELAY_URL='ws://127.0.0.1:18765/' " +
        'GRIT_BUILD_SHA="$(git rev-parse --short HEAD)$(git diff --quiet || echo -dirty)" ' +
        'GRIT_BUILD_TIME="$(date -u +%Y-%m-%dT%H:%MZ)"',
    },
    'android.proof': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/proof/app-proof.apk',
      testBinaryPath: 'android/app/build/outputs/apk/androidTest/proof/app-proof-androidTest.apk',
      // Proof embeds JavaScript and has release-like startup behavior. It is a named test target
      // rather than a change to normal Debug, which remains available for Metro development.
      build:
        'cd android && ./gradlew :app:assembleProof :app:assembleAndroidTest ' +
        '-DtestBuildType=proof -PgritRelayUrl=ws://10.0.2.2:18765/',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      // The named simulator the whole proof ladder runs on. Pinned by id because simctl creates a
      // new device if a name matches nothing, which would silently run the suite on an iPhone 16
      // with different chrome.
      device: { id: '40E844EA-723C-430F-ADFE-F8C29AA21722' },
    },
    emulator: {
      type: 'android.emulator',
      // An AVD is addressed by name, and there is no id to pin it by. That is safe in a way the
      // simulator is not: Detox validates the name against the installed AVD list and refuses to
      // boot when it matches nothing (AVDValidator._assertAVDMatch), so a typo is a loud failure
      // naming the AVDs that do exist, never a fresh device silently created underneath the run.
      device: { avdName: 'Pixel_6a_API_34' },
    },
  },
  configurations: {
    'ios.sim.debug': { device: 'simulator', app: 'ios.debug' },
    'android.emu.proof': { device: 'emulator', app: 'android.proof' },
  },
};
