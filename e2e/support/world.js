// The world: the relay and the second-party nodes a @needs-relay scenario spawns.
//
// Every spawned process is tracked and killed in the After hook (world.stopPeers), so a crashed
// scenario cannot leave a stale relay serving the next one.
//
// The relay is hop-relayd built from hop origin/main, at the path PATH.md documents building it
// to. The second party is this repo's own grit-relay-node (the same matching-core harness the
// proof ladder uses), built once on demand and reused. A missing binary is a loud failure naming
// the build command, never a silent skip: a scenario that quietly degraded to "no peer" would read
// exactly like the product working.

const { spawn } = require('child_process');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const RELAY_BIN = '/tmp/relayd-main/release/hop-relayd';
const HARNESS_BIN = path.join(REPO, '.build', 'release', 'grit-relay-node');
const RELAY_URL = 'ws://127.0.0.1:18765/';
const HEALTHZ = 'http://127.0.0.1:18765/healthz';

// The two media fixtures the peer sends. The steps name these absolute paths, and NOTHING in the
// repo used to create them: they existed only because they had been made by hand on this machine
// once. That is an undeclared dependency on local state, and it fails in the worst way, because
// the harness starts fine, the send step passes, and the app simply never receives anything, so
// the failure surfaces as "message-media-0 was not visible" and reads like a product bug in
// inbound media. Measured exactly that way after /tmp was cleared: the photo and location
// scenarios failed while every other scenario passed. The suite now writes its own inputs.
const PHOTO_FIXTURE = '/tmp/grit-fixture.png';
const LOCATION_FIXTURE = '/tmp/grit-fixture-location.json';

// A real 2x2 PNG, not a zero byte placeholder: the app persists the bytes and renders a thumbnail
// from the file, so an invalid image would render nothing and prove nothing.
const PHOTO_FIXTURE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFUlEQVR42mP8tNKaARtgYsABBqcEAHNSAeb0maX/AAAAAElFTkSuQmCC';

/**
 * Write the fixtures the media and location scenarios send. Idempotent, and called from BeforeAll
 * so a fresh machine or a cleared /tmp cannot turn a real pass into a phantom product failure.
 */
function ensureFixtures() {
  if (!fs.existsSync(PHOTO_FIXTURE)) {
    fs.writeFileSync(PHOTO_FIXTURE, Buffer.from(PHOTO_FIXTURE_BASE64, 'base64'));
  }
  if (!fs.existsSync(LOCATION_FIXTURE)) {
    // Shape fixed by decodeFix in src/hop/location.ts: lat, lon, accuracy and at, all finite
    // numbers, latitude within 90 and longitude within 180. Black Rock City, and an accuracy the
    // bubble can render as "± 9 m".
    fs.writeFileSync(
      LOCATION_FIXTURE,
      JSON.stringify({lat: 40.786, lon: -119.2065, accuracy: 9, at: Date.now()}),
    );
  }
}

const running = [];

function track(proc, name) {
  running.push({ proc, name });
  return proc;
}

function stopPeers() {
  while (running.length > 0) {
    const { proc, name } = running.pop();
    try {
      proc.kill('SIGKILL');
    } catch (e) {
      // Already gone.
    }
  }
}

/** Wait for the relay's health endpoint to answer, failing loudly with the spawn error otherwise. */
async function waitForHealth(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'no attempt made';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(HEALTHZ);
      if (res.ok) {
        return;
      }
      lastError = `healthz status ${res.status}`;
    } catch (e) {
      lastError = String(e);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(
    `hop-relayd never answered healthz within ${timeoutMs} ms (${lastError}). ` +
      `If another relay owns 18765, stop it; the suite needs the store it just created empty.`,
  );
}

/** Read a child process's stdout line by line until `pattern` matches or the process exits. */
function waitForOutput(proc, pattern, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => {
      reject(new Error(`${label}: no output matching ${pattern} within ${timeoutMs} ms`));
    }, timeoutMs);
    proc.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const match = buffer.match(pattern);
      if (match) {
        clearTimeout(timer);
        resolve(match);
      }
    });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`${label}: exited ${code} before ${pattern}. Output so far:\n${buffer}`));
    });
    proc.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

/**
 * Start a hop-relayd on an empty store and wait for it to answer. The store dir is wiped here, in
 * the right order: a stale store floods its backlog at the first peer to connect, and that was
 * measured to drop other clients' links. The relay only ever runs during the scenario that asked
 * for it.
 */
async function startRelay() {
  if (!fs.existsSync(RELAY_BIN)) {
    throw new Error(
      `hop-relayd not found at ${RELAY_BIN}. Build it as PATH.md documents: ` +
        'worktree at origin/main, then `cargo build -p hop-relayd --release` with ' +
        'CARGO_TARGET_DIR=/tmp/relayd-main and rustup cargo on PATH.',
    );
  }
  const store = fs.mkdtempSync(path.join(os.tmpdir(), 'grit-e2e-relay-'));
  const proc = spawn(RELAY_BIN, ['--ws', '0.0.0.0:18765', '--db', path.join(store, 'hop-relay.db')], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  track(proc, 'hop-relayd');
  proc.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    if (/FAILED|panicked/i.test(text)) {
      throw new Error(`hop-relayd failed to start: ${text}`);
    }
  });
  await waitForHealth();
  return proc;
}

/** Build grit-relay-node on demand; it is this repo's own matching-core second party. */
function ensureHarness() {
  if (fs.existsSync(HARNESS_BIN)) {
    return;
  }
  execFileSync('swift', ['build', '-c', 'release', '--product', 'grit-relay-node'], {
    cwd: REPO,
    stdio: 'inherit',
  });
}

/**
 * Start a listening 1:1 peer and return its base58 address, parsed from its own stdout. Waiting for
 * the address line is load-bearing: adding a contact for an address the peer never printed would
 * point the app at nothing.
 */
async function startListener() {
  ensureHarness();
  const proc = spawn(HARNESS_BIN, ['listen', RELAY_URL], { stdio: ['ignore', 'pipe', 'pipe'] });
  track(proc, 'grit-relay-node listen');
  const match = await waitForOutput(proc, /listen address (\S+)/, 20000, 'listener');
  return match[1];
}

/**
 * Start a channel peer subscribed to `path` hosted at `hostAddress`, which replies once it
 * receives a publication. Waits for membership to be real (its own joined=true status), so a later
 * publish cannot land before the peer holds the key.
 */
let peerOutput = '';

/** Everything the most recent peer process has printed, for assertions about what it saw or did not. */
function getChannelPeerOutput() {
  return peerOutput;
}

function trackOutput(proc) {
  proc.stdout.on('data', (chunk) => {
    peerOutput += chunk.toString();
  });
}

async function startChannelPeer(hostAddress, path, replyBody) {
  ensureHarness();
  peerOutput = '';
  const proc = spawn(
    HARNESS_BIN,
    ['channel-peer', RELAY_URL, hostAddress, path, replyBody],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  trackOutput(proc);
  track(proc, 'grit-relay-node channel-peer');
  await waitForOutput(proc, /subscribe id=/, 20000, 'channel peer');
  return proc;
}

/**
 * Start an invitee: a node that never subscribes and waits to be invited, because invite-only
 * channels hand the content key out only through hpsInvite + accept. Returns its address.
 */
async function startInvitee(path, replyBody = 'grit channel reply from the peer') {
  ensureHarness();
  peerOutput = '';
  const proc = spawn(HARNESS_BIN, ['invitee', RELAY_URL, path, replyBody], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  trackOutput(proc);
  track(proc, 'grit-relay-node invitee');
  const match = await waitForOutput(proc, /invitee address (\S+)/, 20000, 'invitee');
  return match[1];
}

/**
 * Start ONE second node that both sends media to the app and stays listening, and return its
 * address. It must be one node: a separate sender would be a different ephemeral identity, and
 * media from it lands in a conversation the scenario is not looking at (measured: the photo
 * arrived in a third conversation while the test waited on the listener's chat).
 */
async function startMediaPeer(appAddress, filePath, contentType) {
  ensureHarness();
  const proc = spawn(
    HARNESS_BIN,
    ['peer-media', RELAY_URL, appAddress, filePath, contentType],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  track(proc, 'grit-relay-node peer-media');
  const match = await waitForOutput(proc, /peer-media address (\S+)/, 20000, 'media peer');
  return match[1];
}

/**
 * Set the simulator's simulated location. The value the app then reads is exactly this: a value
 * set by the harness, not a GPS fix from a receiver. The scenarios prove the plumbing; the math
 * is proven separately by unit tests against real-world vectors.
 */
function setSimLocation(lat, lon) {
  const detoxrc = require('../../.detoxrc.js');
  const deviceId = detoxrc.devices.simulator.device.id;
  // A static `set` delivers ONE fix whose age can exceed the reader's maximumAge filter, after
  // which nothing follows and every request times out (measured: 8s timeouts on every request).
  // The Apple scenario streams a continuously-updating position, which is what a reader needs.
  execFileSync('xcrun', ['simctl', 'location', deviceId, 'run', 'Apple']);
  void lat;
  void lon;
}

/**
 * Grant a privacy permission directly through simctl. The launchApp permissions map is the
 * normal path, but a full run measured once landing UNDECIDED for location at install time
 * (a system prompt then appeared mid-scenario and blocked the inbound-location assertion, while
 * two adjacent runs passed), so every scenario also grants explicitly after launch. Redundant
 * when the install-time grant takes, decisive when it does not.
 */
function grantPrivacy(service, bundleId) {
  const detoxrc = require('../../.detoxrc.js');
  const deviceId = detoxrc.devices.simulator.device.id;
  execFileSync('xcrun', ['simctl', 'privacy', deviceId, 'grant', service, bundleId]);
}

/**
 * The permission set every launch must carry. It lives here because Detox APPLIES the object it is
 * given: a launchApp that passes permissions and omits one resets that one to undetermined, and the
 * next system alert then blocks whatever the scenario asserts next, which reads as a product bug.
 * That cost a whole suite run once: a mid-scenario relaunch omitted notifications, the app asked on
 * the conversation screen, and the alert covered the element under assertion.
 *
 * Override deliberately by spreading: {...PERMISSIONS, location: 'unset'}. Never hand-write a
 * partial set.
 */
const PERMISSIONS = Object.freeze({
  camera: 'YES',
  microphone: 'YES',
  photos: 'YES',
  notifications: 'YES',
  location: 'whenInUse',
});

module.exports = {
  ensureFixtures,
  PERMISSIONS,
  grantPrivacy,
  startRelay,
  startListener,
  startChannelPeer,
  startInvitee,
  startMediaPeer,
  stopPeers,
  getChannelPeerOutput,
  setSimLocation,
};
