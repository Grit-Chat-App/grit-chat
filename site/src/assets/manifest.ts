import type { ImageMetadata } from 'astro';

export interface Plate {
  id: string;
  src: ImageMetadata;
  alt: string;
  caption?: string;
  role: 'hero' | 'section' | 'texture';
}

import heroImg from './hero.jpg';
import relayImg from './relay.webp';
import dustImg from './dust.webp';
import campImg from './camp.webp';

// A 'texture' plate was generated and then dropped rather than shipped. It was a 1.6MB near-flat
// dark field, and at the low opacity a background texture wants it was indistinguishable from
// --surface. Paying 1.6MB for something nobody can see is decoration with a bandwidth bill, and this
// audience is on a bad connection. If a grain is wanted later, generate it in CSS.
//
// hero.jpg was cropped from 1376x768 to 1344x744 (16px off left, right and top, 8px off the bottom).
// The generated frame carried a baked film border: measured column brightness sat near 2.5 percent
// for the first ten columns and then stepped up to 16 percent, which rendered as a black strip down
// the left of a full bleed hero. Every other plate was measured the same way and has flat edges.
//
// camp.webp REPLACED a plate called work.webp, which showed a worker in a hard hat beside a heavy
// mining loader. Grit Chat is a consumer messaging app; mine sites are Hop's market and a different
// buyer, so an industrial photograph sat directly against the copy next to it. The subject of the old
// plate was a machine, which is what made it read as a job site. This one's subject is people.

export const plates: Record<string, Plate> = {
  hero: {
    id: 'hero',
    src: heroImg,
    alt: 'A vast cracked alkali flat stretches to a distant horizon under a deep indigo sky at late dusk. A single point of amber light shines in the extreme distance.',
    role: 'hero',
  },
  relay: {
    id: 'relay',
    src: relayImg,
    alt: 'Two small figures stand far apart on a flat desert playa at night, under stars. One is lit by the warm amber glow of the phone screen they are holding.',
    role: 'section',
  },
  dust: {
    id: 'dust',
    src: dustImg,
    alt: 'A close, almost abstract view of pale alkali dust and grit driven by wind across dark ground at night.',
    role: 'section',
  },
  camp: {
    id: 'camp',
    src: campImg,
    alt: 'Three people stand in silhouette around a small lantern at a campsite on a dry desert lake bed at night. Two dome tents and a fabric shade structure on poles stand beside them, under a deep blue sky full of stars.',
    role: 'section',
  },
};
