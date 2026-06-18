// Ways to support OHRR — REAL, confirmed channels and links from the org's site.
// Used by the Support page in both the OHRR app (/support) and BunFest (/bunfest/give).

export interface GivingOption {
  id: string
  title: string
  description: string
  cta: string
  url?: string // external link
  to?: string // in-app route (takes precedence over url)
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
    id: 'guardian',
    title: 'Become a Rescue Rabbit Guardian',
    description: 'Sponsor a rabbit’s care with an ongoing monthly gift.',
    cta: 'Become a guardian',
    url: 'https://www.ohiohouserabbitrescue.org/become-a-rescue-rabbit-guardian/',
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
    id: 'wishlist',
    title: 'Amazon Wish List',
    description: 'Ship much-needed supplies directly to the rescue.',
    cta: 'View wish list',
    url: 'https://www.ohiohouserabbitrescue.org/support-ohrr/wishlist/',
  },
  {
    id: 'hopshop',
    title: 'Shop the Hop Shop',
    description: 'Browse rabbit supplies and OHRR merch — proceeds fund the rescue.',
    cta: 'Visit the Hop Shop',
    to: '/hop-shop',
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
    url: 'https://www.ohiohouserabbitrescue.org/support-ohrr/host-a-fundraiser/',
  },
  {
    id: 'mailing',
    title: 'Join the Mailing List',
    description: 'Stay in the loop on rabbits, events, and BunFest news.',
    cta: 'Sign up',
    url: 'https://www.ohiohouserabbitrescue.org/join-ohrr-mailing-list/',
  },
]
