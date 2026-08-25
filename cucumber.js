// Cucumber configuration for the Detox suite.
//
// `cucumber-js --dry-run` does NOT fail on an undefined step: an undefined step prints "Undefined"
// and still exits 0 (measured on cucumber-js 11.3.0). So the dry run is informational. The real
// gate is e2e/testids.test.js: it fails when a Gherkin step has no definition, when a step
// addresses a testID no screen renders, or when a fixed id is renamed, and each direction of that
// failure was proven by sabotage.
//
// The default profile excludes @needs-relay, because those scenarios spawn hop-relayd and
// grit-relay-node and would fail on a machine that has not built them. `npm run e2e:ios` is the
// full suite; `npm run e2e:guard` is the fast lockstep check that needs no device.
module.exports = {
  default: {
    require: ['e2e/support/**/*.js', 'e2e/steps/**/*.js'],
    paths: ['e2e/features/**/*.feature'],
    tags: 'not @needs-relay and not @needs-gps',
    format: ['progress-bar', 'summary'],
    formatOptions: { snippetInterface: 'async-await' },
    timeout: 120000,
  },
  // The full profile still excludes @needs-gps: those need a real CoreLocation fix, which
  // this simulator never delivers (see the feature file and PATH.md for the evidence).
  full: {
    require: ['e2e/support/**/*.js', 'e2e/steps/**/*.js'],
    paths: ['e2e/features/**/*.feature'],
    tags: 'not @needs-gps',
    format: ['progress-bar', 'summary'],
    formatOptions: { snippetInterface: 'async-await' },
    timeout: 120000,
  },
};
