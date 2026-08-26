// Lockstep guard: every testID the Detox steps address must exist somewhere in the app's source,
// every testID fixed by agreement must be rendered by a screen, and every Gherkin step must have a
// definition.
//
// Why this exists. Detox failures are slow, need a simulator, and report "element not visible",
// which reads like a product bug when it is really a rename. This runs in milliseconds with no
// device and names the missing id. The reference app's guard (hop monorepo, apps/react-native/
// HopDemo/e2e/testids.test.js) caught two real drifts the first time it ran; this one scans every
// screen module, because this app renders ids across seven files rather than one.
//
// It is also written so it CAN fail. It parses ids out of the sources rather than comparing a
// hardcoded list to itself, and it asserts the extracted sets are non-empty, so a broken regex
// fails loudly instead of silently comparing nothing against nothing.

const fs = require('fs');
const path = require('path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

const SCREEN_SOURCES = [
  'App.tsx',
  'src/screens/ConversationsScreen.tsx',
  'src/screens/ChatScreen.tsx',
  'src/screens/AddContactScreen.tsx',
  'src/screens/IdentityScreen.tsx',
  'src/screens/ProfileScreen.tsx',
  'src/screens/ContactProfileScreen.tsx',
  'src/screens/ChannelScreen.tsx',
  'src/screens/ChannelManageScreen.tsx',
  'src/screens/NewChannelScreen.tsx',
  'src/screens/ScanContactScreen.tsx',
  'src/screens/CompassScreen.tsx',
  'src/components/chrome.tsx',
  'src/components/HopTrace.tsx',
  'src/components/AddressText.tsx',
];

// Ids rendered by the app, both plain and template forms. A template `message-row-${index}` is
// recorded as the prefix `message-row-` because the suffix is decided at runtime.
const appTestIds = () => {
  const src = SCREEN_SOURCES.map(read).join('\n');
  const plain = [...src.matchAll(/testID="([^"]+)"/g)].map((m) => m[1]);
  const templated = [...src.matchAll(/testID=\{`([^`]+)`\}/g)].map((m) =>
    m[1].replace(/\$\{[^}]+\}/g, ''),
  );
  return { plain: new Set(plain), prefixes: new Set(templated) };
};

// Ids addressed by the steps, from by.id('x') and by.id(`x-${i}`).
const stepTestIds = () => {
  const src = read('e2e/steps/grit.steps.js');
  const plain = [...src.matchAll(/by\.id\('([^']+)'\)/g)].map((m) => m[1]);
  const templated = [...src.matchAll(/by\.id\(`([^`]+)`\)/g)].map((m) =>
    m[1].replace(/\$\{[^}]+\}/g, ''),
  );
  return { plain: new Set(plain), prefixes: new Set(templated) };
};

describe('Detox steps address real testIDs', () => {
  const app = appTestIds();
  const steps = stepTestIds();

  it('extracted non-empty sets from both files', () => {
    // Without this, a regex typo would make every assertion below vacuously true.
    expect(app.plain.size).toBeGreaterThan(20);
    expect(app.prefixes.size).toBeGreaterThan(3);
    expect(steps.plain.size).toBeGreaterThan(15);
  });

  it('every plain testID used by a step exists in the app sources', () => {
    const missing = [...steps.plain].filter((id) => {
      if (app.plain.has(id)) return false;
      // A step may address a templated id with a literal suffix, e.g. channel-message-body-2.
      return ![...app.prefixes].some((p) => id.startsWith(p));
    });
    expect(missing).toEqual([]);
  });

  it('every templated prefix used by a step exists in the app sources', () => {
    const missing = [...steps.prefixes].filter(
      (p) => ![...app.prefixes].some((ap) => ap.startsWith(p) || p.startsWith(ap)) && !app.plain.has(p),
    );
    expect(missing).toEqual([]);
  });
});

describe('the app renders the testIDs the flows are fixed on', () => {
  // One direction of the checks above, steps -> app, cannot see an id the steps have not started
  // addressing yet. These are the ids the proven flows depend on; a screen has to render every one
  // of them, and this parse is asserted non-empty first so a regex typo cannot make it vacuous.
  const app = appTestIds();

  const fixed = [
    'screen-conversations',
    'conversations-empty',
    'empty-headline',
    'empty-scan-someone',
    'empty-show-identity',
    'empty-add-contact',
    'relay-pill',
    'relay-expanded',
    'relay-detail',
    'relay-telemetry',
    'relay-open-connection',
    'relay-onboarding',
    'relay-onboarding-open',
    'open-identity',
    'add-contact-button',
    'new-channel-button',
    'screen-add-contact',
    'add-contact-address',
    'add-contact-label',
    'add-contact-save',
    'add-contact-status',
    'add-contact-scan-note',
    'screen-chat',
    'chat-input',
    'chat-send',
    'chat-attach-image',
    'chat-mic',
    'chat-location',
    'chat-location-note',
    'chat-profile-pending',
    'channel-location',
    'channel-location-confirm',
    'channel-location-confirm-note',
    'channel-location-send',
    'channel-location-cancel',
    'channel-location-note',
    'header-back',
    'header-title',
    'screen-identity',
    'identity-address',
    'identity-relay-input',
    'identity-relay-apply',
    'identity-open-profile',
    'screen-profile',
    'profile-name',
    'profile-name-scope',
    'profile-contact',
    'profile-contact-scope',
    'profile-choose-photo',
    'profile-remove-photo',
    'profile-photo-scope',
    'profile-save',
    'screen-contact-profile',
    'contact-alias',
    'contact-alias-save',
    'contact-profile-share',
    'profile-share-confirmation',
    'profile-share-send',
    'contact-profile-accept',
    'contact-profile-reject',
    'add-contact-scan',
    'screen-scan-contact',
    'scan-camera',
    'scan-hint',
    'scan-error',
    'scan-paste-note',
    'screen-new-channel',
    'new-channel-path',
    'new-channel-create',
    'screen-channel',
    'channel-input',
    'channel-send',
    'channel-leave',
    'channel-manage',
    'screen-channel-manage',
    'manage-invite-address',
    'manage-invite-send',
    'manage-status',
    'manage-revoke-note',
    'screen-compass',
    'compass-scroll',
    'compass-dial',
    'compass-unavailable',
    'compass-reading',
    'compass-distance',
    'compass-direction',
    'compass-heading',
    'compass-status',
    'compass-retry-permission',
    'compass-details-toggle',
    'compass-details',
    'compass-target-coordinates',
    'compass-back',
  ];

  const fixedPrefixes = [
    // The manage rows and access cards are rendered as templates; the fixed list above is checked
    // against plain ids only, so template-shaped ids live here by prefix.
    'manage-pending-',
    'manage-approve-',
    'manage-deny-',
    'manage-member-',
    'manage-remove-',
    'new-channel-access-',
    'conversation-row-',
    'conversation-label-',
    'conversation-address-',
    'message-trace-',
    'message-media-',
    'message-location-',
    'message-body-',
    'channel-message-body-',
    'channel-message-sender-',
    'channel-message-state-',
  ];

  it('parsed a non-empty set of ids out of the sources', () => {
    expect(app.plain.size).toBeGreaterThan(20);
    expect(app.prefixes.size).toBeGreaterThan(5);
  });

  it('renders every fixed testID', () => {
    expect(fixed.filter((id) => !app.plain.has(id))).toEqual([]);
  });

  it('renders every fixed templated testID', () => {
    expect(fixedPrefixes.filter((p) => !app.prefixes.has(p))).toEqual([]);
  });
});

describe('the feature file and the steps agree', () => {
  const feature = read('e2e/features/grit.feature');
  const steps = read('e2e/steps/grit.steps.js');

  it('every Gherkin step has a definition', () => {
    const lines = feature
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^(Given|When|Then|And) /.test(l));
    expect(lines.length).toBeGreaterThan(10);

    // Normalise a Gherkin line to the shape a cucumber-expression matches: quoted strings and bare
    // integers become placeholders.
    const norm = (l) =>
      l
        .replace(/^(Given|When|Then|And) /, '')
        .replace(/"[^"]*"/g, '{string}')
        .replace(/(?<![\w{])\d+(?![\w}])/g, '{int}')
        .replace(/<[^>]+>/g, '{string}')
        .trim();

    const defined = new Set(
      [...steps.matchAll(/(?:Given|When|Then)\('([^']+)'/g)].map((m) => m[1].trim()),
    );
    expect(defined.size).toBeGreaterThan(10);

    const undefinedSteps = [...new Set(lines.map(norm))].filter((s) => !defined.has(s));
    expect(undefinedSteps).toEqual([]);
  });
});
