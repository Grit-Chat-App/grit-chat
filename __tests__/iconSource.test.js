const fs = require('fs');
const path = require('path');

const SOURCE_ROOT = path.join(__dirname, '..', 'src');
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

const sourceFiles = (directory) =>
  fs.readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return entry.isFile() && /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });

// Static rendered-icon policy. User-entered message and profile values never reach this source scan.
const iconPolicyViolations = (source, file) => {
  const violations = [];
  for (const match of source.matchAll(/react-native-vector-icons\/([A-Za-z0-9_-]+)/g)) {
    if (match[1] !== 'FontAwesome') {
      violations.push(`${file}: ${match[1]} is not the bundled Font Awesome kit`);
    }
  }
  if (/from ['"]react-native-svg['"]|<Svg\b/.test(source)) {
    violations.push(`${file}: rendered SVG icons are not allowed`);
  }
  if (EMOJI.test(source)) {
    violations.push(`${file}: Unicode pictograph found in rendered app source`);
  }
  return violations;
};

describe('rendered icon source policy', () => {
  it('fails on a second icon library and an emoji icon fixture', () => {
    expect(iconPolicyViolations("import Icon from 'react-native-vector-icons/Feather';", 'fixture.tsx')).toEqual([
      'fixture.tsx: Feather is not the bundled Font Awesome kit',
    ]);
    expect(iconPolicyViolations('<Text>🧭</Text>', 'fixture.tsx')).toEqual([
      'fixture.tsx: Unicode pictograph found in rendered app source',
    ]);
  });

  it('allows Font Awesome and functional QR rendering', () => {
    expect(iconPolicyViolations("import Icon from 'react-native-vector-icons/FontAwesome';", 'fixture.tsx')).toEqual([]);
    expect(iconPolicyViolations("import QRCode from 'react-native-qrcode-svg';", 'fixture.tsx')).toEqual([]);
  });

  it('keeps every rendered app source on the Font Awesome kit', () => {
    const violations = sourceFiles(SOURCE_ROOT).flatMap((file) =>
      iconPolicyViolations(fs.readFileSync(file, 'utf8'), path.relative(SOURCE_ROOT, file)),
    );
    expect(violations).toEqual([]);
  });
});
