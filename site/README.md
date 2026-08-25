# Grit Chat site

The marketing site. Static Astro, no client JavaScript, no server.

## Build

```
npm install
npm run build
```

Output lands in `dist/`. That is the whole build; there is no second step.

## Serve

```
npm run preview
```

Serves `dist/` on `http://localhost:4321`. Use `npm run dev` while writing pages, and `npm run preview` when you want to check the thing that actually ships.

## Point it at a domain

Every canonical URL and every Open Graph URL is built from `PUBLIC_SITE_ORIGIN`:

```
PUBLIC_SITE_ORIGIN=https://grit.chat npm run build
```

or copy `.env.example` to `.env` and set it there. Leave it unset and the build falls back to `https://domain-not-chosen.invalid`, a reserved host (RFC 2606) that can never resolve, so a preview build is obviously a preview build instead of quietly claiming a domain.

**The domain is `grit.chat`.** Jason bought it; the registrar transfer completed 2026-08-25T00:16:37Z, moving it to GoDaddy with a one-year expiry extension, and the nameservers left the broker at 02:21:27Z the same morning. An earlier revision of this file recorded the domain as undecided and surveyed `gritchat.app`, `gritchat.io` and `gritchat.com`; that was accurate when written and is settled now.

Nothing is served there yet: `grit.chat` currently publishes no A record, so the `.invalid` fallback above is still the right default for any build that has not been told the origin explicitly.

## Fonts

The four web faces in `public/fonts/` are generated and committed:

```
npm run fonts
```

That reads the app's committed TTFs from `../src/design/fonts`, subsets each one to the Latin coverage this site needs with harfbuzz compiled to WebAssembly, writes woff2, and regenerates `src/styles/fonts.css`. Nothing outside npm is required: no `woff2_compress`, no fonttools, no brotli. It is idempotent, and it only rewrites a file whose bytes actually changed.

The current run turns 447.2 KB of TTF into 82.7 KB of woff2, 81.5% smaller.

The outputs are committed for two reasons. A build should not depend on the React Native app's font directory surviving a rename, and a font subset should be reviewable in a diff rather than materialising differently on each machine. `npm run build` runs `scripts/fonts.mjs --verify` first and stops with instructions if any of them are missing.

`fonts.css` is generated, not hand written. Each `unicode-range` is read back out of the cmap of the binary it declares, so it states what that file actually covers rather than what the subsetter was asked for. Two things follow, and both matter when writing components:

- **Neither Barlow nor Barlow Condensed contains an arrow** (U+2190 to U+2194). IBM Plex Mono does. A hop trace that wants a real arrow glyph must be set in the mono face, which is where a hop trace belongs anyway.
- **No face contains a geometric shape**: no U+25CF, U+25CB, U+25AA, U+25E6. A trace dot has to be a CSS shape or an SVG, never a text character. `--trace-dot` and `--trace-gap` are in `tokens.css` for that.

Six codepoints are deliberately excluded from the subset, so they cannot be set in the brand faces at all: en dash, em dash and horizontal bar, because the house rule is a comma or a colon; and the registered, service mark and trade mark signs, because the Grit mark is not cleared and nothing here may imply registration.

## Why Astro, and why static

This is a content site: a few pages of prose, some images, a link to a repository. There is no account, no session, no personalisation, and nothing to authenticate, so there is nothing for a server to do at request time and no reason to pay for one. Astro renders every route to a file at build and ships zero JavaScript by default, which is the property that actually matters here: the audience is on a phone at the edge of a desert festival with one bar, and a page with nothing to hydrate is a page that finishes rendering the moment the HTML arrives. Astro's own `astro:assets` gives responsive `srcset` and intrinsic width and height on every image, so the layout does not shift while those images load on that same bad connection. The alternative, a React or Next application, would ship a runtime and a hydration pass to do the job an anchor tag already does. The design constraint that follows from all of this, dark surfaces, large type, real focus rings, is in `src/styles/tokens.css`, and it is argued there rather than asserted.

## Layout

```
astro.config.mjs      static output, image defaults, and the nested-tsconfig workaround
scripts/fonts.mjs     the font subsetter, and the only source of truth for fonts.css
src/branding.ts       every user-visible product string, never hardcode the name in a template
src/config.ts         origin, repository and Hop URLs
src/layouts/Base.astro  the document shell: head, skip link, main, header and footer slots
src/styles/tokens.css   the design system: palette, type, spacing, radii, motion, focus
src/styles/base.css     reset and element defaults
src/styles/fonts.css    GENERATED, do not edit
public/fonts/           GENERATED and committed
```

`Base.astro` takes `title`, `description` and an optional `ogImage`, exposes named `header` and `footer` slots, and owns no brand assets: there is no `rel=icon` and no default social image in it.

One thing worth knowing if the build ever breaks oddly: this project sits inside a React Native repo whose root `tsconfig.json` extends a package installed in the app's `node_modules` and not in this one. Rolldown finds that file walking up and cannot resolve its `extends`. `astro.config.mjs` closes both routes to it, and the comment there records which half does what.
