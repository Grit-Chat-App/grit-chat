// Step definitions for e2e/features/grit.feature.
//
// Steps address stable testIDs, never copy or screen position, because copy changes. Every id used
// here is asserted to exist in the app by e2e/testids.test.js, so a rename breaks a fast unit test
// instead of a slow device run. What each scenario has been sabotage-proven to fail on is recorded
// in the scenario comments.

const { Given, When, Then } = require('@cucumber/cucumber');
const { element, by, waitFor, expect: detoxExpect } = require('detox');

const world = require('../support/world');

const TIMEOUT = 30000;
// Delivery crosses a relay, gets acknowledged and comes back. Generous without being a hang.
const DELIVERY_TIMEOUT = 45000;

const textOf = async (testID) => {
  const attrs = await element(by.id(testID)).getAttributes();
  return String(attrs.text || attrs.label || '').trim();
};

const labelOf = async (testID) => {
  const attrs = await element(by.id(testID)).getAttributes();
  return String(attrs.label || attrs.text || '').trim();
};

const tap = async (testID) => {
  await element(by.id(testID)).tap();
};

// replaceText, not tap + typeText. Typing focuses the field and raises the keyboard, and on a
// phone-sized screen the keyboard then covers the send button (the composer squashes to a sliver
// at the keyboard's top edge, which fails Detox's hittability check). The flows under test are
// what happens AFTER a body is in the field, not the typing UX, so set the value without raising
// the keyboard at all.
const type = async (testID, text) => {
  await element(by.id(testID)).replaceText(text);
};

// --------------------------------------------------------------------------------------------
// background
// --------------------------------------------------------------------------------------------

Given('the app has launched', async () => {
  await waitFor(element(by.id('screen-conversations')))
    .toBeVisible()
    .withTimeout(TIMEOUT);
});

// --------------------------------------------------------------------------------------------
// first screen
// --------------------------------------------------------------------------------------------

Then('I see the empty conversation state', async () => {
  await detoxExpect(element(by.id('conversations-empty'))).toBeVisible();
  const headline = await textOf('empty-headline');
  if (!/nobody/i.test(headline)) {
    throw new Error(`the empty state does not name what is true; headline is ${JSON.stringify(headline)}`);
  }
});

Then('the first action offers scanning someone', async () => {
  // Scan is the primary first act: it is the consumer path that needs no typing and no out-of-band
  // channel. Paste remains, but it is not the first button.
  await detoxExpect(element(by.id('empty-scan-someone'))).toBeVisible();
});

Then('the first action offers my address', async () => {
  await detoxExpect(element(by.id('empty-show-identity'))).toBeVisible();
});

Then('the first action offers adding someone', async () => {
  await detoxExpect(element(by.id('empty-add-contact'))).toBeVisible();
});

Then('the relay indicator is present', async () => {
  await detoxExpect(element(by.id('relay-pill'))).toBeVisible();
});

Then('the relay indicator explains itself when asked', async () => {
  // The load-bearing assertion of this redesign: opening the app shows the pill and NOTHING else
  // about the relay. Both text nodes are checked for absence, not just one: the plain sentence
  // (relay-detail) and the raw pool line (relay-telemetry, "N endpoint(s) known, 0 dialable, next
  // try in 16s"). Checking only relay-detail would let the pool line regress back onto the home
  // screen through its sibling node without this failing, which is the whole defect this item
  // exists to remove.
  await detoxExpect(element(by.id('relay-expanded'))).not.toExist();
  await detoxExpect(element(by.id('relay-detail'))).not.toExist();
  await detoxExpect(element(by.id('relay-telemetry'))).not.toExist();

  await tap('relay-pill');

  // Asking produces the expansion, and what arrives first is a sentence rather than telemetry.
  await detoxExpect(element(by.id('relay-expanded'))).toBeVisible();
  const detail = await textOf('relay-detail');
  if (detail.length === 0) {
    throw new Error('the expanded relay indicator says nothing');
  }
  if (/endpoint\(s\)|dialable|next try in/.test(detail)) {
    throw new Error(`the plain relay sentence is a telemetry dump: ${JSON.stringify(detail)}`);
  }
});

// --------------------------------------------------------------------------------------------
// adding a contact
// --------------------------------------------------------------------------------------------

When('I add {string} as {string}', async (address, label) => {
  await tap('empty-add-contact');
  await waitFor(element(by.id('screen-add-contact'))).toBeVisible().withTimeout(TIMEOUT);
  await type('add-contact-address', address);
  if (label.length > 0) {
    await type('add-contact-label', label);
    // Single-line fields keep the keyboard up, and it follows navigation onto the chat screen and
    // covers the send button there. Return on the last field dismisses it before moving on.
    await element(by.id('add-contact-label')).tapReturnKey();
  }
  await tap('add-contact-save');
});

Then('I am in the conversation with {string}', async (label) => {
  await waitFor(element(by.id('screen-chat'))).toBeVisible().withTimeout(TIMEOUT);
  const title = await textOf('header-title');
  if (title !== label) {
    throw new Error(`expected chat header ${JSON.stringify(label)}, got ${JSON.stringify(title)}`);
  }
});

When('I go back', async () => {
  // The stack is Conversations -> AddContact -> Chat, because the form navigates to the new
  // conversation on success. One back returns to the form, the second to the list, and asserting
  // the list after a single tap would pass only by accident of navigation depth.
  await tap('header-back');
  await tap('header-back');
  await waitFor(element(by.id('screen-conversations'))).toBeVisible().withTimeout(TIMEOUT);
});

Then('my list has a conversation for {string}', async (label) => {
  await detoxExpect(element(by.id('conversation-row-0'))).toBeVisible();
  const shown = await textOf('conversation-label-0');
  if (shown !== label) {
    throw new Error(`expected a conversation for ${JSON.stringify(label)}, got ${JSON.stringify(shown)}`);
  }
});

Then('its address is shown shortened', async () => {
  // The full base58 address never renders on a list row: it would be unreadable at that size. The
  // short form is first 6 + marker + last 5, which is the form someone compares against a peer.
  const short = await textOf('conversation-address-0');
  if (!/^[1-9A-HJ-NP-Za-km-z]{6}.{3}[1-9A-HJ-NP-Za-km-z]{5}$/.test(short)) {
    throw new Error(`address is not shown in its short form: ${JSON.stringify(short)}`);
  }
});

When('I try to add {string}', async (address) => {
  await tap('empty-add-contact');
  await waitFor(element(by.id('screen-add-contact'))).toBeVisible().withTimeout(TIMEOUT);
  await type('add-contact-address', address);
  await tap('add-contact-save');
});

Then('the form tells me the address is not valid', async () => {
  await detoxExpect(element(by.id('add-contact-status'))).toBeVisible();
  const note = await textOf('add-contact-status');
  if (!/not a hop address/i.test(note)) {
    throw new Error(`expected a validation message, got ${JSON.stringify(note)}`);
  }
});

When('I open my profile', async () => {
  await tap('empty-show-identity');
  await waitFor(element(by.id('screen-identity'))).toBeVisible().withTimeout(TIMEOUT);
  await tap('identity-open-profile');
  await waitFor(element(by.id('screen-profile'))).toBeVisible().withTimeout(TIMEOUT);
});

When('I save my profile as {string}', async (name) => {
  await type('profile-name', name);
  await element(by.id('profile-name')).tapReturnKey();
  await tap('profile-save');
});

Then('my profile says public sharing is named and deliberate', async () => {
  const reach = await textOf('profile-reach');
  if (!/saved contact|no profile directory/i.test(reach)) {
    throw new Error(`profile reach statement is incomplete: ${JSON.stringify(reach)}`);
  }
  await detoxExpect(element(by.id('profile-name-scope'))).toBeVisible();
  await detoxExpect(element(by.id('profile-contact-scope'))).toBeVisible();
  await detoxExpect(element(by.id('profile-photo-scope'))).toBeVisible();
});

When('I open the contact details', async () => {
  await tap('chat-contact-profile');
  await waitFor(element(by.id('screen-contact-profile'))).toBeVisible().withTimeout(TIMEOUT);
});

When('I change the local name to {string}', async (name) => {
  await type('contact-alias', name);
  await element(by.id('contact-alias')).tapReturnKey();
  await tap('contact-alias-save');
});

Then('the local name is {string}', async (name) => {
  const shown = await textOf('contact-alias');
  if (shown !== name) {
    throw new Error(`expected local name ${JSON.stringify(name)}, got ${JSON.stringify(shown)}`);
  }
});

// --------------------------------------------------------------------------------------------
// relay + peer
// --------------------------------------------------------------------------------------------

Given('a relay and a listening peer', async function () {
  await world.startRelay();
  this.peerAddress = await world.startListener();
  // The app booted BEFORE the relay existed, so its first dial failed and the pool is backing
  // off on a growing schedule; a send made while that timer runs shows "nobody carrying it yet"
  // and the retry may land after the delivery window. Relaunch now that the relay is live, so
  // the dial happens against something that answers. State persists (contacts are in the store;
  // identity is in the Keychain), so the scenario continues from where it was.
  const detox = require('detox');
  await detox.device.launchApp({newInstance: true, delete: false});
  await waitFor(element(by.id('screen-conversations'))).toBeVisible().withTimeout(TIMEOUT);
});

Given('a relay is running', async function () {
  await world.startRelay();
  const detox = require('detox');
  await detox.device.launchApp({newInstance: true, delete: false});
  await waitFor(element(by.id('screen-conversations'))).toBeVisible().withTimeout(TIMEOUT);
});

When('I add that peer as {string}', async function (label) {
  if (this.peerAddress == null) {
    throw new Error('no peer was started; the scenario is missing its relay step');
  }
  await tap('empty-add-contact');
  await waitFor(element(by.id('screen-add-contact'))).toBeVisible().withTimeout(TIMEOUT);
  await type('add-contact-address', this.peerAddress);
  if (label.length > 0) {
    await type('add-contact-label', label);
  }
  if (label.length > 0) {
    await element(by.id('add-contact-label')).tapReturnKey();
  }
  await tap('add-contact-save');
  await waitFor(element(by.id('screen-chat'))).toBeVisible().withTimeout(TIMEOUT);
});

// --------------------------------------------------------------------------------------------
// sending
// --------------------------------------------------------------------------------------------

When('I send {string}', async (body) => {
  await type('chat-input', body);
  // Deliberate change: this used to tap the return key, because the send button sat under the
  // keyboard and was not reachable on a phone-sized screen. The composer is rebuilt so the button
  // is on a control row inside the composer, above the keyboard, so the button path is the real
  // one now and tapping it is what proves the fix. Return inserts a newline here, as multiline
  // implies, so it can no longer send.
  await tap('chat-send');
});

Then('the message shows it is in flight', async () => {
  // What the protocol said, not a hopeful checkmark: at this point the bundle is accepted and is
  // travelling. Delivered is the terminal state, asserted next, and this step exists so a message
  // that rendered nothing at all cannot pass as "not yet delivered".
  await waitFor(element(by.id('message-trace-0-label'))).toExist().withTimeout(TIMEOUT);
  const label = await textOf('message-trace-0-label');
  if (!/sending|accepted|carried|delivered/.test(label)) {
    throw new Error(`trace does not name a live delivery state: ${JSON.stringify(label)}`);
  }
});

Then('it is delivered via {int} hops', async (hops) => {
  // Two nodes over one relay is exactly two hops: app to relay, relay to listener. This is the
  // signature assertion of the suite: the hop count is the product's proof that the message
  // physically travelled, and it is asserted against the number the scenario named, not a shape.
  const expected = `delivered via ${hops} hops`;
  const deadline = Date.now() + DELIVERY_TIMEOUT;
  let label = '';
  while (Date.now() < deadline) {
    label = await textOf('message-trace-0-label').catch(() => '');
    if (label === expected) {
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`never reached ${JSON.stringify(expected)}; last trace was ${JSON.stringify(label)}`);
});

// --------------------------------------------------------------------------------------------
// channels
// --------------------------------------------------------------------------------------------

When('I host the channel {string}', async (path) => {
  await tap('new-channel-button');
  await waitFor(element(by.id('screen-new-channel'))).toBeVisible().withTimeout(TIMEOUT);
  await type('new-channel-path', path);
  await element(by.id('new-channel-path')).tapReturnKey();
  await tap('new-channel-create');
  await waitFor(element(by.id('screen-channel'))).toBeVisible().withTimeout(TIMEOUT);
});

When('I publish {string}', async (body) => {
  await type('channel-input', body);
  // Same deliberate change as the chat send step: the publish button now lives on a control row
  // inside the composer and stays above the keyboard, so it is the real path. Return is a newline.
  await tap('channel-send');
});

Then('it shows published', async () => {
  // A channel post carries exactly what the core reported. There is no per-recipient state, so
  // "published" is the honest terminal, and anything else here would be a checkmark theatre.
  await waitFor(element(by.id('channel-message-state-0-label'))).toExist().withTimeout(TIMEOUT);
  const state = await textOf('channel-message-state-0-label');
  if (state !== 'published') {
    throw new Error(`expected published, got ${JSON.stringify(state)}`);
  }
});

When('the channel peer joins and I publish {string}', async function (body) {
  // The peer subscribes to MY channel, so it needs my address. The identity screen renders it, and
  // the container's accessibility label carries the whole string (the chunked lines are layout).
  await tap('header-back');
  await tap('open-identity');
  await waitFor(element(by.id('identity-address'))).toBeVisible().withTimeout(TIMEOUT);
  this.myAddress = await labelOf('identity-address');
  if (!/^[1-9A-HJ-NP-Za-km-z]{30,}$/.test(this.myAddress)) {
    throw new Error(`could not read my address from the identity screen: ${JSON.stringify(this.myAddress)}`);
  }
  await tap('header-back');

  this.path = this.path || 'center-camp';
  await world.startChannelPeer(this.myAddress, this.path, 'grit channel reply from the peer');

  // Back into the channel and publish AGAIN. A publication is flooded once: the first post went
  // out before the peer held the key, and a later joiner has no claim on it. This second post is
  // the one the peer can receive, and the one that gets a reply.
  await tap('conversation-row-0').catch(async () => tap('channel-row-0'));
  await waitFor(element(by.id('screen-channel'))).toBeVisible().withTimeout(TIMEOUT);
  await type('channel-input', body);
  await tap('channel-send');
});

Then('the reply arrives with its writer', async () => {
  // The reply's row index depends on how many posts the scenario itself made, so find the row by
  // its content rather than assuming a slot. The reply carries its writer's verified address,
  // which is what a channel can show that nothing else can fake.
  const deadline = Date.now() + DELIVERY_TIMEOUT;
  let lastSeen = '';
  while (Date.now() < deadline) {
    for (let index = 1; index <= 6; index += 1) {
      const body = await textOf(`channel-message-body-${index}`).catch(() => '');
      lastSeen = body || lastSeen;
      if (/reply from the peer/.test(body)) {
        await detoxExpect(element(by.id(`channel-message-sender-${index}`))).toBeVisible();
        const sender = await textOf(`channel-message-sender-${index}`);
        // The writer is named when the store knows a name for them. This peer is the proof node and
        // was never added as a contact, so the honest fallback is the short address, and that is what
        // has to render: an unnamed writer must never come out blank or as a truncated blob.
        if (!/^[1-9A-HJ-NP-Za-km-z]{6}.{3}[1-9A-HJ-NP-Za-km-z]{5}$/.test(sender)) {
          throw new Error(`unnamed writer is not shown as a short address: ${JSON.stringify(sender)}`);
        }
        return;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `no reply with a writer appeared; last row body was ${JSON.stringify(lastSeen)}. Peer log:\n` +
      world.getChannelPeerOutput(),
  );
});

// --------------------------------------------------------------------------------------------
// honesty
// --------------------------------------------------------------------------------------------

When('I clear the relay endpoint', async () => {
  await tap('open-identity');
  await waitFor(element(by.id('screen-identity'))).toBeVisible().withTimeout(TIMEOUT);
  // The relay form sits below the fold, and a Fabric ScrollView rejects programmatic scroll:
  // swipe it up until the input is on screen, which is what a finger would do.
  for (let i = 0; i < 6; i += 1) {
    try {
      await detoxExpect(element(by.id('identity-relay-input'))).toBeVisible();
      break;
    } catch (e) {
      await element(by.id('identity-scroll')).swipe('up', 'fast', 0.6);
    }
  }
  await element(by.id('identity-relay-input')).clearText();
  try {
    await element(by.id('identity-relay-input')).tapReturnKey();
  } catch (e) {
    // The key was already gone, or the keyboard never raised. Either way the next tap is the test.
  }
  // The apply button sits at the fold, and clearing focused the field: bring it up and WAIT for
  // it to be hittable rather than tapping through the keyboard's dismiss animation.
  for (let i = 0; i < 4; i += 1) {
    try {
      await detoxExpect(element(by.id('identity-relay-apply'))).toBeVisible();
      break;
    } catch (e) {
      await element(by.id('identity-scroll')).swipe('up', 'fast', 0.6);
    }
  }
  await waitFor(element(by.id('identity-relay-apply'))).toBeVisible().withTimeout(TIMEOUT);
  await tap('identity-relay-apply');
  await tap('header-back');
});

Then('the relay indicator says it is not configured', async () => {
  // An endpoint the user cleared stays cleared. The app names the missing configuration rather
  // than inventing a default relay behind the person's back.
  const label = await textOf('relay-pill');
  if (!/not configured/.test(label)) {
    throw new Error(`relay pill does not say it is not configured: ${JSON.stringify(label)}`);
  }
});

When('I open add contact', async () => {
  await tap('empty-add-contact');
  await waitFor(element(by.id('screen-add-contact'))).toBeVisible().withTimeout(TIMEOUT);
});

When('I open the scanner', async () => {
  await tap('add-contact-scan');
  await waitFor(element(by.id('screen-scan-contact'))).toBeVisible().withTimeout(TIMEOUT);
});

Then('the scanner view is on screen', async () => {
  await detoxExpect(element(by.id('scan-camera'))).toBeVisible();
  await detoxExpect(element(by.id('scan-hint'))).toBeVisible();
});

When('I return to add contact', async () => {
  await tap('header-back');
  await waitFor(element(by.id('screen-add-contact'))).toBeVisible().withTimeout(TIMEOUT);
});

Then('the paste path is still offered', async () => {
  // The scanner is one way in, never the only way: an address read over a radio still has a home.
  await detoxExpect(element(by.id('add-contact-address'))).toBeVisible();
  await detoxExpect(element(by.id('add-contact-save'))).toBeVisible();
});

// --------------------------------------------------------------------------------------------
// media
// --------------------------------------------------------------------------------------------

When('I record a voice note for {int} seconds', async (seconds) => {
  // Tap to start, hold the time, tap to stop and send. The microphone permission is pre-granted
  // at launch, so no system alert can interrupt this.
  await tap('chat-mic');
  await new Promise((r) => setTimeout(r, seconds * 1000));
  await tap('chat-mic');
});

Then('the voice note shows it is in flight', async () => {
  await waitFor(element(by.id('message-trace-0-label'))).toExist().withTimeout(TIMEOUT);
  const label = await textOf('message-trace-0-label');
  if (!/sending|accepted|carried|delivered/.test(label)) {
    throw new Error(`trace does not name a live delivery state: ${JSON.stringify(label)}`);
  }
});

Then('the voice note renders with a play control', async () => {
  await detoxExpect(element(by.id('message-media-0'))).toBeVisible();
  const duration = await textOf('message-media-0-duration');
  if (!/voice note/.test(duration)) {
    throw new Error(`expected a voice note row, got ${JSON.stringify(duration)}`);
  }
  await detoxExpect(element(by.id('message-media-0-play'))).toBeVisible();
});

const readMyAddress = async () => {
  // The identity action lives on the conversation list's header. Callers arrive from the list
  // (no back button at all) or from a chat (two backs: chat -> add form -> list). Tap whatever
  // backs exist, tolerantly, then open identity.
  try {
    await tap('header-back');
    await tap('header-back');
  } catch (e) {
    // Started on the list already: there was nothing to back out of.
  }
  await tap('open-identity');
  await waitFor(element(by.id('identity-address'))).toBeVisible().withTimeout(TIMEOUT);
  const address = await labelOf('identity-address');
  if (!/^[1-9A-HJ-NP-Za-km-z]{30,}$/.test(address)) {
    throw new Error(`could not read my address from the identity screen: ${JSON.stringify(address)}`);
  }
  await tap('header-back');
  return address;
};

When('the peer sends me a photo', async function () {
  const myAddress = await readMyAddress();
  // One node, one address: it sends the photo AND is the contact the conversation belongs to.
  const peerAddress = await world.startMediaPeer(myAddress, '/tmp/grit-fixture.png', 'image/png');
  await tap('empty-add-contact');
  await waitFor(element(by.id('screen-add-contact'))).toBeVisible().withTimeout(TIMEOUT);
  await type('add-contact-address', peerAddress);
  await type('add-contact-label', 'the sender');
  await element(by.id('add-contact-label')).tapReturnKey();
  await tap('add-contact-save');
  await waitFor(element(by.id('screen-chat'))).toBeVisible().withTimeout(TIMEOUT);
});

Then('the photo renders', async () => {
  // The thumbnail is a real file on disk rendered from the persisted bytes; a missing file is a
  // different testID and fails this instead of faking a picture.
  await waitFor(element(by.id('message-media-0'))).toBeVisible().withTimeout(TIMEOUT);
});

Then('its trace shows the hops it took', async () => {
  const label = await textOf('message-trace-0-label');
  if (!/hops to reach you/.test(label)) {
    throw new Error(`inbound trace does not name the route: ${JSON.stringify(label)}`);
  }
});

// --------------------------------------------------------------------------------------------
// channel moderation
// --------------------------------------------------------------------------------------------

When('I host the channel {string} with approval', async (path) => {
  await tap('new-channel-button');
  await waitFor(element(by.id('screen-new-channel'))).toBeVisible().withTimeout(TIMEOUT);
  await type('new-channel-path', path);
  await element(by.id('new-channel-path')).tapReturnKey();
  await tap('new-channel-access-approval');
  await tap('new-channel-create');
  await waitFor(element(by.id('screen-channel'))).toBeVisible().withTimeout(TIMEOUT);
});

When('I host the channel {string} as invite only', async (path) => {
  await tap('new-channel-button');
  await waitFor(element(by.id('screen-new-channel'))).toBeVisible().withTimeout(TIMEOUT);
  await type('new-channel-path', path);
  await element(by.id('new-channel-path')).tapReturnKey();
  await tap('new-channel-access-invite');
  await tap('new-channel-create');
  await waitFor(element(by.id('screen-channel'))).toBeVisible().withTimeout(TIMEOUT);
});

When('the peer asks to join', async function () {
  const myAddress = await readMyAddress();
  // channel-peer subscribes; on an approval channel that lands in the host's pending queue.
  await world.startChannelPeer(myAddress, 'quiet-hall', 'grit channel reply from the peer');
  await tap('conversation-row-0').catch(() => tap('channel-row-0'));
  await waitFor(element(by.id('screen-channel'))).toBeVisible().withTimeout(TIMEOUT);
});

Then('its request waits in my manage screen', async () => {
  await tap('channel-manage');
  await waitFor(element(by.id('screen-channel-manage'))).toBeVisible().withTimeout(TIMEOUT);
  try {
    await waitFor(element(by.id('manage-pending-0'))).toBeVisible().withTimeout(TIMEOUT);
  } catch (e) {
    // The peer's own log is the evidence when the pending queue is empty: did it subscribe, did
    // the host queue it, did something else hand it keys.
    throw new Error(`pending row never appeared. Peer log so far:\n${world.getChannelPeerOutput()}`);
  }
});

When('I approve the request', async () => {
  await tap('manage-approve-0');
  await tap('header-back');
  await waitFor(element(by.id('screen-channel'))).toBeVisible().withTimeout(TIMEOUT);
});

When('I invite the peer from the manage screen', async function () {
  const myAddress = await readMyAddress();
  // An invitee never subscribes: invite-only channels hand the key out through the invite alone.
  this.peerAddress = await world.startInvitee('vip-room');
  await tap('conversation-row-0').catch(() => tap('channel-row-0'));
  await waitFor(element(by.id('screen-channel'))).toBeVisible().withTimeout(TIMEOUT);
  await tap('channel-manage');
  await waitFor(element(by.id('screen-channel-manage'))).toBeVisible().withTimeout(TIMEOUT);
  await type('manage-invite-address', this.peerAddress);
  await element(by.id('manage-invite-address')).tapReturnKey();
  await tap('manage-invite-send');
});

Then('the peer accepts', async () => {
  const deadline = Date.now() + TIMEOUT;
  while (Date.now() < deadline) {
    if (/ACCEPTED invite/.test(world.getChannelPeerOutput())) {
      await tap('header-back');
      await waitFor(element(by.id('screen-channel'))).toBeVisible().withTimeout(TIMEOUT);
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('the invitee never accepted: ' + world.getChannelPeerOutput());
});

When('I remove the member', async () => {
  await tap('channel-manage');
  await waitFor(element(by.id('screen-channel-manage'))).toBeVisible().withTimeout(TIMEOUT);
  await waitFor(element(by.id('manage-member-0'))).toBeVisible().withTimeout(TIMEOUT);
  const received = (world.getChannelPeerOutput().match(/HPSINBOX/g) || []).length;
  this.receivedBeforeRemoval = received;
  await tap('manage-remove-0');
  await tap('header-back');
  // Assert on a composer element rather than the root screen container. Sending now taps the send
  // button instead of the return key, and a button tap does not dismiss the keyboard, which is
  // correct messenger behaviour: you keep typing. With the keyboard up the ROOT view of the screen
  // is under Detox's 75 percent visibility threshold, so toBeVisible on screen-channel fails while
  // the screen is plainly there. The composer sits above the keyboard by design, so it is both
  // fully visible and unambiguous proof of which screen this is.
  await waitFor(element(by.id('channel-input'))).toBeVisible().withTimeout(TIMEOUT);
});

Then('the peer receives nothing more', async () => {
  // Rotation means the removed member keeps what it read and gets nothing after. The proof is an
  // absence measured on the peer's own log: no new HPSINBOX line after the post-removal publish.
  await new Promise((r) => setTimeout(r, 10000));
  const after = (world.getChannelPeerOutput().match(/HPSINBOX/g) || []).length;
  if (after !== this.receivedBeforeRemoval) {
    throw new Error(
      `the removed member received ${after - this.receivedBeforeRemoval} post(s) after the rotation`,
    );
  }
});

// --------------------------------------------------------------------------------------------
// location
// --------------------------------------------------------------------------------------------

Given('my simulated position is set', async () => {
  // A streaming scenario value, not a GPS fix: this drives the plumbing, and the math is proven
  // by unit tests against real-world vectors instead.
  world.setSimLocation();
});

When('I share my location', async () => {
  // Set the simulated position at the moment of the tap rather than before the app's relaunch,
  // so locationd has a fresh fix for the request that is about to start.
  world.setSimLocation();
  await tap('chat-location');
});

Then('the location bubble shows the coordinates', async () => {
  await waitFor(element(by.id('message-location-0'))).toBeVisible().withTimeout(TIMEOUT);
  await detoxExpect(element(by.id('message-location-0-coords'))).toBeVisible();
});

When('the peer sends me a location', async function () {
  const myAddress = await readMyAddress();
  const peerAddress = await world.startMediaPeer(
    myAddress,
    '/tmp/grit-fixture-location.json',
    'application/grit-location+json',
  );
  await tap('empty-add-contact');
  await waitFor(element(by.id('screen-add-contact'))).toBeVisible().withTimeout(TIMEOUT);
  await type('add-contact-address', peerAddress);
  await type('add-contact-label', 'the sender');
  await element(by.id('add-contact-label')).tapReturnKey();
  await tap('add-contact-save');
  await waitFor(element(by.id('screen-chat'))).toBeVisible().withTimeout(TIMEOUT);
});

When('I open the offline compass', async () => {
  await waitFor(element(by.id('message-location-0'))).toBeVisible().withTimeout(TIMEOUT);
  await tap('message-location-0');
  await waitFor(element(by.id('screen-compass'))).toBeVisible().withTimeout(TIMEOUT);
});

Then('the offline compass shows the shared target behind details', async () => {
  await detoxExpect(element(by.id('compass-details'))).not.toExist();
  await tap('compass-details-toggle');
  await detoxExpect(element(by.id('compass-details'))).toBeVisible();
  const coordinates = await textOf('compass-target-coordinates');
  if (!/^-?\d+\.\d{5}, -?\d+\.\d{5}$/.test(coordinates)) {
    throw new Error(`compass target coordinates are not a short coordinate pair: ${JSON.stringify(coordinates)}`);
  }
});

Then('it states its sensor truth', async () => {
  const status = await textOf('compass-status');
  if (status.length === 0 || /map|tile|network/i.test(status)) {
    throw new Error(`compass status is empty or claims an unrelated fallback: ${JSON.stringify(status)}`);
  }
});

Then('the distance from my position is shown', async () => {
  // The receiver's own fix arrives asynchronously after the bubble renders; wait for the line
  // rather than reading an element that may not exist yet.
  await waitFor(element(by.id('message-location-0-from-here')))
    .toBeVisible()
    .withTimeout(TIMEOUT);
  const fromHere = await textOf('message-location-0-from-here');
  if (!/from your position/.test(fromHere)) {
    throw new Error(`distance line does not read as from your position: ${JSON.stringify(fromHere)}`);
  }
});

When('I refuse location permission', async () => {
  // Relaunch keeping state but with location denied: the contact survives (delete is false), and
  // CoreLocation reports PERMISSION_DENIED, which the composer must say in words.
  const detox = require('detox');
  await detox.device.launchApp({
    newInstance: true,
    delete: false,
    // Spread the shared set and override ONE key, rather than hand-writing a partial one. This
    // relaunch previously omitted notifications, which reset it to undetermined: the app then asked
    // on the conversation screen and the system alert covered the note this scenario asserts on.
    // 'unset', not 'NO': NO is not a valid location value in Detox, and unset is the state a user is
    // actually in before they decide, which is what this scenario degrades through.
    permissions: {...world.PERMISSIONS, location: 'unset'},
  });
  await waitFor(element(by.id('screen-conversations'))).toBeVisible().withTimeout(TIMEOUT);
  await tap('conversation-row-0');
  await waitFor(element(by.id('screen-chat'))).toBeVisible().withTimeout(TIMEOUT);
});

When('I try to share my location', async () => {
  await tap('chat-location');

  // ANSWER THE ALERT. This scenario launches with location unset on purpose, so tapping share
  // raises the system permission alert. Leaving it up was doing two bad things: an unanswered
  // alert stops Detox settling, so the expectation below times out however correct the screen is,
  // and the alert SURVIVES into the next scenario, so whichever location scenario ran next was the
  // one that appeared to fail. That is why the failure moved run to run and why both location
  // scenarios passed in isolation.
  //
  // Answering with the refusal also makes this scenario test what it says it tests: actual denial,
  // rather than the permission-unset degradation standing in for it.
  //
  // iOS renders the refusal label with a right single quotation mark, not an apostrophe, so both
  // spellings are tried. If neither is present the step FAILS rather than continuing: the premise
  // of the scenario is that an alert appears, so a missing alert is a result, not a detail.
  const {system} = require('detox');
  const labels = ['Don\u2019t Allow', "Don't Allow"];
  let answered = false;
  for (const label of labels) {
    try {
      await system.element(by.system.label(label)).tap();
      answered = true;
      break;
    } catch {
      // Try the next spelling; a real absence is reported after the loop.
    }
  }
  if (!answered) {
    throw new Error(
      `the location permission alert never appeared, so this scenario cannot be refusing anything. ` +
        `Tried labels: ${labels.map((l) => JSON.stringify(l)).join(', ')}`,
    );
  }
});

Then('the app tells me permission is off', async () => {
  // DELIBERATE ASSERTION CHANGE, and a strengthening. This used to assert the POSITION_UNAVAILABLE
  // copy ("No location available ... Nothing was sent."), because the scenario could only reach the
  // permission-unset simulator and the old step comment said denial "needs a human tap on the
  // system prompt". Detox can tap that prompt, so the step above now refuses for real and this
  // asserts the PERMISSION_DENIED branch instead: the scenario finally tests the thing its name
  // claims. Measured copy on the simulator: "Location permission is off. Enable it in Settings to
  // share where you are."
  await waitFor(element(by.id('chat-location-note'))).toBeVisible().withTimeout(TIMEOUT);
  const note = await textOf('chat-location-note');
  if (!/permission is off/i.test(note) || !/settings/i.test(note)) {
    throw new Error(
      `expected the refused branch to name the permission and where to change it, got ${JSON.stringify(note)}`,
    );
  }
});

When('I ask to share my location there', async () => {
  await tap('channel-location');
});

Then('the channel names everyone will see it', async () => {
  // The container row sits at the fold and fails the 75% visibility gate; the note is the
  // assertion's subject, and it is fully on screen.
  await detoxExpect(element(by.id('channel-location-confirm-note'))).toBeVisible();
  const note = await textOf('channel-location-confirm-note');
  if (!/everyone in this channel will see this location/i.test(note)) {
    throw new Error(`fan-out not named plainly: ${JSON.stringify(note)}`);
  }
});

When('I cancel sharing', async () => {
  await tap('channel-location-cancel');
});

Then('the confirmation is gone', async () => {
  await waitFor(element(by.id('channel-location-confirm')))
    .not.toBeVisible()
    .withTimeout(TIMEOUT);
});
