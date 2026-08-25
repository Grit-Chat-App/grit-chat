import { fileURLToPath } from 'node:url';

import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// THE DOMAIN IS ONE SETTING: PUBLIC_SITE_ORIGIN. Both Astro's absolute-URL machinery and
// src/config.ts read it, and nothing else in the tree names a host.
//
// It may carry a PATH, and that is deliberate. A GitHub Pages project site lives at
// https://<user>.github.io/<repo>/, which Astro needs as `site` plus `base`, two settings. Deriving
// both from one value keeps the promise that choosing a domain is a one line change:
//
//   PUBLIC_SITE_ORIGIN=https://example.github.io/grit-chat  ->  site=...github.io  base=/grit-chat
//   PUBLIC_SITE_ORIGIN=https://grit.chat                    ->  site=grit.chat      no base
//
// So moving from the provider's default hostname to a real domain is editing one variable and a DNS
// record, not hunting through templates for a hardcoded path.
//
// Only src/config.ts carries a fallback, because a wrong `site` value here would silently produce
// absolute URLs pointing at a placeholder. Unset means unset.
const configured = process.env.PUBLIC_SITE_ORIGIN;

let origin;
let base;
if (configured) {
  // Fail loudly on a malformed value rather than building a site whose canonical is nonsense.
  let parsed;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error(
      `PUBLIC_SITE_ORIGIN is not a URL: ${JSON.stringify(configured)}. ` +
        'Give it a full origin, optionally with a path, for example https://example.com/repo',
    );
  }
  origin = parsed.origin;
  const path = parsed.pathname.replace(/\/+$/, '');
  base = path === '' ? undefined : path;
}

// This project is nested inside the React Native repo, whose root tsconfig.json extends
// @react-native/typescript-config, a package installed in the app's node_modules and not in this
// one. Rolldown reaches that file through two separate paths and fails to resolve the extends
// target on either, so the fix below has two halves and both are load bearing (each was removed
// on a clean cache and the build failed):
//
//   resolve.tsconfigPaths  Astro turns this on to support tsconfig path aliases. This site
//                          defines none, so the scan is dead weight here and is switched off.
//   rollupOptions.tsconfig Names this project's own tsconfig for the transform, which is simply
//                          true: site/tsconfig.json is the tsconfig for site/.
const tsconfig = fileURLToPath(new URL('./tsconfig.json', import.meta.url));

export default defineConfig({
  // No server, no auth, no personalisation. Every route is a file on a CDN.
  output: 'static',

  ...(origin ? { site: origin } : {}),
  ...(base ? { base } : {}),

  // A sitemap needs an absolute origin to write, so it only runs once the domain is set. Before
  // that it would emit URLs rooted at the .invalid placeholder, which is worse than no sitemap.
  integrations: origin ? [sitemap()] : [],

  trailingSlash: 'ignore',

  build: {
    format: 'directory',
    // Small stylesheets go inline, so the first paint on a bad connection needs one round trip
    // instead of two. Large ones stay external and cacheable.
    inlineStylesheets: 'auto',
  },

  image: {
    // Responsive images by default: astro:assets emits srcset, sizes, and intrinsic width and
    // height on every <Image>, which is what reserves the box and gives us no layout shift.
    // 'constrained' means an image never renders wider than its intrinsic size but shrinks freely.
    layout: 'constrained',
    responsiveStyles: true,
  },

  // Zero client JavaScript is the point. Prefetch would ship a script to save a hop on a site
  // that is three pages long.
  prefetch: false,

  compressHTML: true,

  devToolbar: { enabled: false },

  vite: {
    resolve: { tsconfigPaths: false },
    build: { rollupOptions: { tsconfig } },
  },
});
