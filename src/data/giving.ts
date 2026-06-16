// Ways to support OHRR. These are REAL, confirmed channels and links from the
// org's own site (see /docs/01-OHRR-org-profile.md) — the high-leverage part of
// the app: most supporters never discover the giving paths beyond a basic gift.

export interface GivingOption {
  id: string
  title: string
  description: string
  cta: string
  url: string
  featured?: boolean
}

export const givingOptions: GivingOption[] = [
  {
    id: 'donate',
    title: 'Make a Gift',
    description:
      'A one-time or recurring tax-deductible donation. OHRR is a 501(c)(3) (EIN 27-0830606).',
    cta: 'Donate',
    url: 'https://www.ohiohouserabbitrescue.org/support-ohrr/donate/',
    featured: true,
  },
  {
    id: 'workplace',
    title: 'Workplace & Matching Gifts',
    description:
      'Many Columbus-area employers (and United Way) match employee donations — double your impact.',
    cta: 'See matching options',
    url: 'https://www.ohiohouserabbitrescue.org/workplace-donations/',
  },
  {
    id: 'kroger',
    title: 'Kroger Community Rewards',
    description:
      'Link your Kroger card and a portion of your everyday grocery spending supports OHRR — at no cost to you.',
    cta: 'Learn how',
    url: 'https://www.ohiohouserabbitrescue.org/support-ohrr/',
  },
  {
    id: 'wishlist',
    title: 'Amazon Wish List',
    description: 'Ship much-needed supplies directly to the rescue.',
    cta: 'View wish list',
    url: 'https://www.ohiohouserabbitrescue.org/support-ohrr/wishlist/',
  },
  {
    id: 'legacy',
    title: 'OHRR Legacy Fund',
    description:
      'Planned giving through a will, trust, or retirement-account beneficiary designation.',
    cta: 'About planned giving',
    url: 'https://www.ohiohouserabbitrescue.org/ohrr-legacy-fund/',
  },
  {
    id: 'fundraiser',
    title: 'Host a Fundraiser',
    description: 'Rally your friends, workplace, or community on OHRR’s behalf.',
    cta: 'Get started',
    url: 'https://www.ohiohouserabbitrescue.org/support-ohrr/',
  },
]
