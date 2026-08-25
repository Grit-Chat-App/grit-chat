module.exports = {
  preset: '@react-native/jest-preset',
  // The vendored Hop SDK ships TypeScript sources and points its "react-native" entry at
  // src/index.tsx, so Jest has to transform it like app code. The preset's default
  // transformIgnorePatterns skips everything in node_modules, which makes the import fail on the
  // first type annotation it meets.
  transformIgnorePatterns: [
    'node_modules/(?!(?:@react-native|react-native|@hop-mesh|react-native-fs|react-native-image-picker|react-native-audio-recorder-player)/)',
  ],
  // e2e/ holds the testid lockstep guard, which is a plain Jest test and runs with the rest.
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)', '**/e2e/**/*.test.[jt]s?(x)'],
};
