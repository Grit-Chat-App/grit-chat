// Site-level configuration. Everything here is either an environment value or a permanent URL.
// No copy lives in this file: copy lives in branding.ts and in the pages.

/**
 * The placeholder origin, used when PUBLIC_SITE_ORIGIN is not set.
 *
 * THE DOMAIN IS `grit.chat`. Jason bought it; the registrar transfer completed
 * 2026-08-25T00:16:37Z. An earlier revision of this comment recorded the domain as undecided and
 * surveyed gritchat.app / gritchat.io / gritchat.com, which was accurate then and is settled now.
 *
 * The fallback stays, and its reason has nothing to do with the domain being unknown: a build that
 * forgets to set PUBLIC_SITE_ORIGIN must not silently claim the real origin. A canonical tag
 * pointing at domain-not-chosen.invalid, a reserved host (RFC 2606) that can never resolve, is loud
 * on purpose. It is a preview build and it should look like one. That is still true now that the
 * domain is known, and it is more useful than before: `grit.chat` currently publishes no A record
 * at all, so a build that claimed it would be claiming a host that does not answer.
 */
const PLACEHOLDER_ORIGIN = 'https://domain-not-chosen.invalid';

const configured: string | undefined = import.meta.env.PUBLIC_SITE_ORIGIN;

export const site = {
  /**
   * Origin, injected at build time from PUBLIC_SITE_ORIGIN. Set it in site/.env or inline:
   * `PUBLIC_SITE_ORIGIN=https://grit.chat npm run build`. See .env.example.
   *
   * The variable may carry a PATH, because a GitHub Pages project site lives under one and the
   * domain has to stay a single setting. astro.config.mjs splits it into `site` and `base`; only
   * the bare origin belongs here, because Astro.url.pathname already includes the base and joining
   * a pathname against an origin that also carried it would double the path.
   */
  origin: new URL(configured ?? PLACEHOLDER_ORIGIN).origin,

  /** The public product repository. */
  repoUrl: 'https://github.com/Grit-Chat-App/grit-chat',

  /** Hop, the delay tolerant mesh protocol this is built on. */
  hopUrl: 'https://github.com/hopmesh/hop',

  /**
   * Where "ask for a beta invite" goes.
   *
   * THERE IS NO APP STORE LISTING AND NO PLAY LISTING, and Android has never been built, so a
   * download button would be the easiest lie on the page. A closed beta is the only real route in,
   * and this is the only real place to ask for one today: an issue on the repository.
   *
   * That is a developer-shaped door for a consumer product, and it is deliberately one setting
   * rather than a link buried in a template. When there is a mailing list, a TestFlight public
   * link or a form, change this value and the page follows. Do not add a second route beside it:
   * two doors means one of them rots.
   */
  betaUrl:
    'https://github.com/Grit-Chat-App/grit-chat/issues/new?title=Beta%20invite%20request&body=Which%20phone%20do%20you%20have%2C%20and%20where%20would%20you%20use%20it%3F',
} as const;
