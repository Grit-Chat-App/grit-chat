// Detox lifecycle wired into Cucumber.
//
// With Cucumber the lifecycle is explicit: init once for the run, relaunch before each scenario so
// scenarios cannot leak state into each other, and clean up at the end.
//
// The relaunch is deliberate rather than cheap. This app holds an identity, contacts, channels and
// message history in its stores, and a scenario that sent a message leaves it on screen and on
// disk. Reusing that state would let a later scenario pass on residue from an earlier one, which is
// exactly the false proof this suite exists to prevent.
//
// Detox 20.28 split its entry points. `require('detox')` returns the CLIENT API only (device,
// element, expect, by, waitFor); the LIFECYCLE API (init, cleanup) lives at `detox/internals`. The
// pre-20.28 shape `require('detox').init(...)` fails with "detox.init is not a function". The steps
// import the client API from 'detox' directly, which is why they never need initGlobals.
//
// The Before hook is the one place that has to know which platform it is on. Everything else in this
// suite addresses testIDs and is platform neutral, but permissions are not: Detox's `permissions`
// launch option is implemented by the iOS simulator driver alone (SimulatorDriver.setPermissions
// shells out to applesimutils), and on Android it resolves to DeviceDriverBase.setPermissions, which
// returns an empty string and grants nothing. Passing the iOS map on Android would read exactly like
// a grant and do nothing, so the hook branches and uses adb instead. simctl is iOS-only for the same
// reason. Neither Android path is reachable from an iOS run.

const { BeforeAll, AfterAll, Before, After, setDefaultTimeout } = require('@cucumber/cucumber');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const detox = require('detox');
const { init: detoxInit, cleanup: detoxCleanup } = require('detox/internals');

const world = require('./world');

setDefaultTimeout(120000);

// One id on both platforms now: chat.grit.app, the reverse DNS form of grit.chat. It used to be
// com.burnchat on Android and com.jwaldrip.gritchat on iOS, and the harness carried both spellings
// in three places. One constant means a future rename is one line rather than a hunt.
const APP_ID = 'chat.grit.app';

// The Android counterparts of the iOS permission map, and exactly the four the app declares in
// android/app/src/main/AndroidManifest.xml. Photos has no counterpart on purpose: sending a photo
// goes through react-native-image-picker 8, which uses the AndroidX photo picker and needs no
// media-read permission at any API level, so none is declared and granting READ_MEDIA_IMAGES here
// would throw rather than harmlessly do nothing. Location is granted in both precisions because
// from API 31 on the fine permission cannot be held without the coarse one declared beside it.
const ANDROID_PERMISSIONS = [
  'android.permission.CAMERA',
  'android.permission.RECORD_AUDIO',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
];

/**
 * Resolve adb. ANDROID_HOME is set for the gradle build anyway, and platform-tools is frequently not
 * on PATH under a GUI-launched shell, so prefer the SDK copy and fall back to whatever PATH offers.
 * Android only: never called on an iOS run.
 */
function androidAdb() {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (sdk) {
    const fromSdk = path.join(sdk, 'platform-tools', 'adb');
    if (fs.existsSync(fromSdk)) {
      return fromSdk;
    }
  }
  return 'adb';
}

/**
 * Pre-grant the runtime permissions so a system dialog can never block a step. Android only.
 *
 * A failure here is loud and names the likely cause. `pm grant` refuses a permission the app has not
 * declared in its manifest, and a swallowed refusal would leave a permission dialog to appear
 * mid-scenario and fail some later step for a reason that looks nothing like the truth.
 */
function grantAndroidPermissions() {
  // device.id is the driver's external id, which on every Android driver is the adb name
  // (AndroidDriver.getExternalId returns this.adbName), for example emulator-5554. Targeting it
  // matters as soon as a second emulator or a plugged-in handset is attached: a bare adb then either
  // fails with "more than one device" or grants to whichever one it picked. If Detox has no id to
  // give, fall back to bare adb rather than refusing to run, and accept that the fallback is only
  // correct while exactly one device is attached.
  const deviceId = detox.device.id;
  const target = deviceId ? ['-s', deviceId] : [];
  const adb = androidAdb();

  for (const permission of ANDROID_PERMISSIONS) {
    // 2>&1 is passed through to the device shell: `pm` reports a refusal by printing an exception,
    // and relying on the exit status alone would miss the cases where it prints one and exits 0.
    const args = [...target, 'shell', 'pm', 'grant', APP_ID, permission, '2>&1'];
    let output;
    try {
      output = execFileSync(adb, args, { encoding: 'utf8' });
    } catch (e) {
      output = `${e.stdout || ''}${e.stderr || ''}${e.message || ''}`;
      throw new Error(
        `adb failed granting ${permission} to ${APP_ID} on ${deviceId || 'the attached device'}: ${output.trim()}`
      );
    }
    if (/Exception|Error/i.test(output)) {
      throw new Error(
        `pm refused to grant ${permission} to ${APP_ID} on ${deviceId || 'the attached device'}: ` +
        `${output.trim()}. The usual cause is that the permission is not declared in ` +
        `android/app/src/main/AndroidManifest.xml, which pm treats as a security error.`
      );
    }
  }
}

BeforeAll({ timeout: 300000 }, async () => {
  // The media and location scenarios send real files from disk. Write them before anything runs,
  // so a cleared /tmp cannot masquerade as broken inbound media.
  world.ensureFixtures();
  // Under `detox test` the CLI resolves .detoxrc.js, starts the IPC server, and hands this process
  // the resolved session; init() connects to it and installs the worker.
  await detoxInit();
});

Before({ timeout: 120000 }, async () => {
  // A fresh launch per scenario. delete:true wipes app data so stores and history start clean.
  // Permissions are pre-granted so a system alert can never block a step: a scenario that stops
  // on "Grit Chat would like to access the Camera" proves nothing about the scanner. Location
  // included: the refusal path is its own scenario, driven by relaunching with it denied.
  if (detox.device.getPlatform() === 'ios') {
    // Identity lives in the Keychain, which delete does NOT touch, so the address is stable across
    // scenarios: that is the persistence behaviour the app promises, kept visible here.
    await detox.device.launchApp({
      newInstance: true,
      delete: true,
      // The full set lives in world.PERMISSIONS, because Detox applies exactly the object it is
      // given and a partial set silently resets whatever it omits. Pre-granting matters more than
      // it looks: a system alert means the app never reports idle, so a scenario does not merely
      // fail, it burns its entire timeout. Location takes whenInUse rather than YES, which is not a
      // valid value for it and silently left it unset.
      permissions: {...world.PERMISSIONS},
    });
    // The install-time location grant measured once landing as UNDECIDED (race), which surfaced a
    // system prompt mid-scenario. simctl privacy grant closes that race, but it TERMINATES a
    // running app, so a clean relaunch follows it; granting before this point would have nothing
    // installed to grant to.
    world.grantPrivacy('location', APP_ID);
    world.grantPrivacy('camera', APP_ID);
    await detox.device.launchApp({newInstance: true, delete: false});
  } else {
    // Same order as iOS for a different reason. delete:true reinstalls the APK, and an install
    // resets every runtime permission the previous scenario granted, so the grants have to follow
    // the launch that installed it rather than precede it. No permissions map here: Detox would
    // accept one and Android would ignore it.
    await detox.device.launchApp({newInstance: true, delete: true});
    grantAndroidPermissions();
    // Granting a runtime permission can restart the process holding it, so the relaunch is load
    // bearing on Android too, not just symmetry with the iOS branch.
    await detox.device.launchApp({newInstance: true, delete: false});
  }
});

After({ timeout: 60000 }, async function (scenario) {
  // Relay and peer processes a scenario spawned always die here, even on failure, so a crashed
  // scenario cannot leave a stale relay serving the next one.
  world.stopPeers();

  // There WAS a blanket alert sweep here, tapping a list of candidate labels in case a scenario
  // left a system alert up. It cost every scenario its After hook: Detox has no cheap existence
  // check for a system alert, so each candidate label WAITS for one to appear, and five labels
  // spent the hook's whole 60 second budget on a machine where the normal case is no alert at all.
  // Measured: 14 of 14 scenarios failed in After while 66 of 83 steps passed. A guard that fails
  // every run is worse than the leak it guards against.
  //
  // The alert is answered where it is RAISED instead. The location refusal scenario is the only
  // step that deliberately triggers one and it now taps the refusal itself, so nothing leaks into
  // the next scenario. Every other scenario is pre-granted in the Before hook precisely so no
  // alert can appear at all.
  // A failure comes with a screenshot rather than a bare matcher message.
  if (scenario.result && scenario.result.status !== 'PASSED') {
    const safe = scenario.pickle.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    try {
      await detox.device.takeScreenshot(`failed-${safe}`);
    } catch (e) {
      // A screenshot failure must never mask the real scenario failure.
    }
  }
});

AfterAll({ timeout: 120000 }, async () => {
  await detoxCleanup();
});
