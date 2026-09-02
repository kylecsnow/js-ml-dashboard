export const ABOUT_ME_VARIANTS = [
  {
    slug: 'vertical-rail',
    href: '/about-me/vertical-rail',
    name: 'Vertical rail',
    kicker: 'Index + articles',
    summary:
      'A sticky year index on the left. Click a node to glide into the matching article on the right.',
  },
  {
    slug: 'filmstrip',
    href: '/about-me/filmstrip',
    name: 'Filmstrip',
    kicker: 'Chapters',
    summary:
      'A horizontal year strip with thumbnails. Each click drops you into a full-width chapter.',
  },
  {
    slug: 'spine',
    href: '/about-me/spine',
    name: 'Story spine',
    kicker: 'Roadmap',
    summary:
      'A classic center-line timeline. Cards alternate sides; the year dock jumps you to a beat.',
  },
] as const;

export type AboutMeVariantSlug = (typeof ABOUT_ME_VARIANTS)[number]['slug'];

export type AboutMeChromeSlug = 'hub' | AboutMeVariantSlug;
