import {buildLabel, definedOrNull} from '../src/config';

// Why these are tested at all: the whole point of baking a commit into the app is that the line on
// screen can be trusted. A build that was never told which commit it came from has to say so, and
// must never render a substitution token or an empty gap that reads like a real answer.

describe('definedOrNull', () => {
  it('keeps a real value', () => {
    expect(definedOrNull('a1b2c3d')).toBe('a1b2c3d');
  });

  it('trims', () => {
    expect(definedOrNull('  a1b2c3d\n')).toBe('a1b2c3d');
  });

  it('treats undefined as unset, which is an app installed before this existed', () => {
    expect(definedOrNull(undefined)).toBeNull();
  });

  it('treats empty and blank as unset', () => {
    expect(definedOrNull('')).toBeNull();
    expect(definedOrNull('   ')).toBeNull();
  });

  it.each(['$(GRIT_BUILD_SHA)', '${GRIT_BUILD_SHA}', '$(GRIT_BUILD_TIME)'])(
    'treats the unexpanded build setting %s as unset rather than a commit',
    (token) => {
      expect(definedOrNull(token)).toBeNull();
    },
  );
});

describe('buildLabel', () => {
  it('names the commit and the time when both are known', () => {
    expect(buildLabel('a1b2c3d', '2026-08-24T08:20Z')).toBe('build a1b2c3d, 2026-08-24T08:20Z');
  });

  it('says unknown when the build was never told anything', () => {
    expect(buildLabel(null, null)).toBe('build unknown');
  });

  it('shows a commit without a time', () => {
    expect(buildLabel('a1b2c3d', null)).toBe('build a1b2c3d');
  });

  it('keeps the time when only the commit is missing, rather than dropping both', () => {
    expect(buildLabel(null, '2026-08-24T08:20Z')).toBe('build unknown, 2026-08-24T08:20Z');
  });

  it('carries a dirty marker through untouched, because a modified tree is not the commit it names', () => {
    expect(buildLabel('a1b2c3d-dirty', '2026-08-24T08:20Z')).toBe(
      'build a1b2c3d-dirty, 2026-08-24T08:20Z',
    );
  });
});
