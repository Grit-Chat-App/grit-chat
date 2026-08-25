import type { APIRoute } from 'astro';

import { site } from '../config';

/**
 * robots.txt, generated rather than dropped in public/.
 *
 * A static file cannot know the origin, and the one line in here worth having is an absolute
 * Sitemap URL. Generating it means the sitemap reference follows the domain automatically, so
 * choosing a domain stays the single setting it is supposed to be.
 *
 * BEFORE A DOMAIN IS CHOSEN the fallback origin is a reserved .invalid host, and pointing a crawler
 * at a sitemap that can never resolve is worse than not mentioning one. So the Sitemap line appears
 * only on a build that has a real origin, which is the same condition the sitemap integration
 * itself is gated on in astro.config.mjs. Both read PUBLIC_SITE_ORIGIN; neither guesses.
 */
export const GET: APIRoute = () => {
  const lines = ['User-agent: *', 'Allow: /'];

  if (site.origin.endsWith('.invalid')) {
    lines.push(
      '',
      '# No Sitemap line: this build has no domain, so PUBLIC_SITE_ORIGIN is still the reserved',
      '# .invalid placeholder and any absolute URL here would be unresolvable.',
    );
  } else {
    // The sitemap lives UNDER the base path, so joining it against the bare origin drops the base
    // and advertises a URL that 404s. Caught by building with a base and reading the output: it
    // emitted https://jwaldrip.github.io/sitemap-index.xml for a site rooted at /burnchat.
    // BASE_URL does not reliably carry a trailing slash, so normalise before joining.
    const rawBase = import.meta.env.BASE_URL;
    const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
    // Astro's sitemap integration writes the index, so that is what gets advertised.
    lines.push('', `Sitemap: ${new URL(`${base}sitemap-index.xml`, site.origin).href}`);
  }

  return new Response(`${lines.join('\n')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
