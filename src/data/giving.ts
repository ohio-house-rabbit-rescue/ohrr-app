// Ways to support OHRR — EVERY channel on ohiohouserabbitrescue.org, each with a
// one-line explanation, an optional in-app "more" (so people don't have to leave
// the app to understand it), and the real tap-through. Captured 2026-09-17 from
// the live site's "I want to SUPPORT" pages and home-page posts.
// Used by the Support page in both the OHRR app (/support) and BunFest (/bunfest/give).

export interface GivingLink {
  label: string
  url: string
}

export interface GivingOption {
  id: string
  title: string
  description: string
  cta: string
  url?: string // external link
  to?: string // in-app route (takes precedence over url)
  featured?: boolean
  /** expandable in-app detail, paragraphs (from the live site) */
  details?: string[]
  /** extra tap-throughs shown under the detail */
  links?: GivingLink[]
}

export const OHRR_EIN = '27-0830606'

export const givingOptions: GivingOption[] = [
  {
    id: 'donate',
    title: 'Donate online',
    description:
      'A one-time or recurring gift to the bunnies of OHRR. OHRR is a 501(c)(3) — your donation is tax deductible.',
    cta: 'Donate',
    url: 'https://ohiohouserabbitrescue.org/support-ohrr/donate/',
    featured: true,
  },
  {
    id: 'workplace',
    title: 'Workplace & matching gifts',
    description:
      'Give through your employer — supporters give via Chase, Battelle, IBM, Verizon, Nordstrom, Nationwide, and United Way — and ask whether your gift can be matched.',
    cta: 'Workplace giving',
    url: 'https://www.ohiohouserabbitrescue.org/workplace-donations/',
    details: [
      'Many OHRR volunteers and supporters extend their impact for OHRR by giving thru their workplace. We have supporters who give through major Columbus employers such as Chase, Battelle, IBM, Verizon, Nordstrom, Nationwide, and via United Way. Sometimes, that gift (or one you make directly to OHRR) can be matched by your employer, multiplying the impact for the bunnies!',
      'One of OHRR’s long-time volunteers, Chris Baker, arranged for OHRR to be the charity of the month as a part of her employer’s (Nexeo Solutions) Great Place To Work group — Chris’ colleagues combined to donate $750 to OHRR.',
    ],
  },
  {
    id: 'kroger',
    title: 'Kroger Community Rewards',
    description:
      'Link OHRR to your Kroger account and Kroger donates every time you shop — at no cost to you. Takes less than a minute.',
    cta: 'Link your Kroger account',
    url: 'https://www.kroger.com/i/community/community-rewards',
    details: [
      'Easily help out the bunnies by making us your Kroger Community Rewards partner. It takes less than a minute and each shopping trip automatically donates to our rescue rabbits at no cost to you. You’ll be able to see that it’s working by seeing our name towards the bottom of your receipt.',
      'Search for Ohio House Rabbit Rescue by name or by our ID number 80631. Kroger lists charities within a certain radius of the store you choose — if you live outside of Columbus, select a store in Columbus as your main store and OHRR will still receive the benefits; you don’t have to shop at that store.',
    ],
    links: [
      {
        label: 'OHRR’s Kroger how-to',
        url: 'https://ohiohouserabbitrescue.org/link-ohrr-to-your-kroger-community-rewards/',
      },
    ],
  },
  {
    id: 'wishlist',
    title: 'Amazon Wish List',
    description: 'Buy much-needed supplies and have them shipped straight to the rescue.',
    cta: 'View the wish list',
    url: 'https://ohiohouserabbitrescue.org/support-ohrr/wishlist/',
    details: [
      'Always needed: paper-based litter (CareFresh), Oxbow Western Timothy Hay and Oxbow adult timothy pellets, fleece blankets, ceramic pet bowls, cat-style litter pans, 28-quart clear storage tubs, non-slip bath mats, MidWest exercise pens, and cleaning supplies (Nature’s Miracle, OxiClean, paper towels, 30-gallon paper lawn bags). Bunny toys we love: Cottontail Cottages, Mini Maze Havens, willow baskets and balls, grass mats, and tunnels.',
      'You can find some of these items around town at stores like Petco, PetPeople, Target or even the Hop Shop at the Adoption Center!',
    ],
    links: [
      {
        label: 'Open the Amazon list',
        url: 'https://www.amazon.com/hz/wishlist/ls/1C5PQRB5VI51L/ref=nav_wishlist_lists_1',
      },
    ],
  },
  {
    id: 'merch',
    title: 'OHRR merch store',
    description:
      'T-shirts and more on Bonfire — every order supports the rescue. Current designs: “Beach Bunny Vibes” and “They Still Talk About You.”',
    cta: 'Shop the store',
    url: 'https://www.bonfire.com/store/ohrr-shirt-store/',
    details: [
      'Beach Bunny Vibes features a retro beach cruiser, a surfboard, and a cool bunny ready for a summer adventure. Proceeds help OHRR provide food, shelter, veterinary care, and daily support to rabbits waiting for their forever families.',
      'They Still Talk About You honors the rabbits we’ve loved and lost. The campaign is lovingly dedicated to Joanne Allsop, a devoted OHRR volunteer and supporter — known to the bunnies as Breakfast Jo and Auntie Jo. All proceeds go toward OHRR’s adoption activities.',
    ],
    links: [
      { label: 'Beach Bunny Vibes', url: 'https://www.bonfire.com/beach-bunny-vibes/' },
      { label: 'They Still Talk About You', url: 'https://www.bonfire.com/they-still-talk-about-you/' },
    ],
  },
  {
    id: 'plate',
    title: 'OHRR license plate',
    description:
      'Drive for the bunnies: Ohio’s official OHRR logo plate (featuring a Dutch rabbit) — $25 a year for the logo plate, and OHRR receives a portion of every sale.',
    cta: 'Order at bmv.ohio.gov',
    url: 'https://www.bmv.ohio.gov/',
    details: [
      'In 2023, we launched the official Ohio House Rabbit Rescue license plate. By purchasing our specialty plate you’re directly contributing to the rescue, medical care, and adoption of our rescue rabbits — a portion of each sale supports the Adoption Center, medical costs, supplies, food, and more. Thank you to State Senator Beth Liston, who sponsored the legislation, OHRR volunteer Tracy Wiczer who led the effort, and Eli Niswander who designed the plate.',
      'Cost: $25 annually for the logo plate ($15 contribution + $10 BMV) plus your normal fees; personalized plates (up to 6 letters/numbers) are an additional $50 annually. Any Ohio motorist is eligible, and plates arrive in approximately 20 business days.',
      'To order online: go to bmv.ohio.gov → BMV Online Services → OPLATES → log in and select your vehicle → choose to exchange your plates → add personalized plate info if you want → click “Choose logo plate” → choose “OH HSE RABBIT RESCUE” → follow the prompts. Or fill out the form in person at the BMV.',
    ],
    links: [
      {
        label: 'Full instructions & FAQ',
        url: 'https://ohiohouserabbitrescue.org/drive-for-the-bunnies-get-your-ohrr-license-plate-today/',
      },
    ],
  },
  {
    id: 'supporter',
    title: 'Become a Supporter',
    description:
      'It’s free — sign up and you’ll receive updates on OHRR’s progress and how you can help.',
    cta: 'Become a Supporter',
    url: 'https://www.ohiohouserabbitrescue.org/support-ohrr/become-a-supporter/',
  },
  {
    id: 'affiliates',
    title: 'Online affiliates',
    description:
      'Shop through OHRR’s links and a portion comes back to the bunnies — Small Pet Select (code RES-OHRR gets new customers 15% off), Bunny Approved, ResQthreads, Kroger, and more.',
    cta: 'See all affiliates',
    url: 'https://www.ohiohouserabbitrescue.org/support-ohrr/online-affiliates/',
    details: [
      'Small Pet Select: new customers receive 15% off their first qualified purchase through the OHRR link or the code RES-OHRR at checkout, and the rescue earns on both new and returning customer purchases.',
      'Also on the list: Bunny Approved, ResQthreads (enter through OHRR’s link), Pawlee’s Treat Co. (select OHRR at checkout), Binky Bunny, Cats Rabbits and More (donate a Cottontail Cottage to OHRR), Bissell Partners for Pets, Goodshop and Goodsearch, and Kroger Community Rewards.',
    ],
    links: [
      {
        label: 'Small Pet Select discount link',
        url: 'https://shop.smallpetselect.com/discount/RES-OHRR?rfsn=6463350.1c5b25',
      },
    ],
  },
  {
    id: 'fundraiser',
    title: 'Host a fundraiser',
    description:
      'Yard sales, bake sales, coin drives, beer/wine tastings, benefit concerts, sporting events, wish-list drives — email OHRR with your idea.',
    cta: 'Email your idea',
    url: 'mailto:ohrrcontact@ohiohouserabbitrescue.org?subject=Hosting%20a%20fundraiser%20for%20OHRR',
    details: [
      'Thank you so much for your interest in helping Ohio House Rabbit Rescue! If you would like to help OHRR by hosting a fundraiser, please contact us at ohrrcontact@ohiohouserabbitrescue.org with your ideas. Some we’ve heard in the past: hosting a yard sale, bake sales, door-to-door sales, beer/wine tastings, coin drives, a benefit concert, sporting events, and wish-list drives.',
    ],
    links: [
      { label: 'Host a Fundraiser page', url: 'https://www.ohiohouserabbitrescue.org/support-ohrr/host-a-fundraiser/' },
    ],
  },
  {
    id: 'legacy',
    title: 'OHRR Legacy Fund & Rescue Rabbit Guardians',
    description:
      'Planned giving: name OHRR in your will, trust, IRA or life insurance — or give $1,000+ in a year — and become a Rescue Rabbit Guardian.',
    cta: 'About the Legacy Fund',
    url: 'https://www.ohiohouserabbitrescue.org/ohrr-legacy-fund/',
    details: [
      'Thanks to you, we have been able to meet the annual expenses of caring for the bunnies (most notably the expense of vet care). To plan for the long-term financial health of our organization, we are building an OHRR Legacy Fund.',
      'Make OHRR a beneficiary in a will or trust, or your IRA: by inserting as little as one sentence into your will or trust, you can name OHRR as a beneficiary — and by including OHRR in your estate planning you automatically become a Rescue Rabbit Guardian. You can also give a Charitable Distribution or Required Minimum Distribution from your IRA, gifts of appreciated stock, bonds or mutual funds, or start, continue, or increase a monthly gift.',
      'Two ways to become a Rescue Rabbit Guardian: For the Future — make a planned gift; For Today — make an annual donation of $1,000 or more. Guardians receive recognition on the OHRR website and at the Adoption Center, are invited to special events, and receive other benefits. If you have already designated OHRR as a beneficiary, or wish to discuss your donation amount, contact Pat Barron at pbarronosu@aol.com.',
    ],
    links: [{ label: 'Email Pat Barron', url: 'mailto:pbarronosu@aol.com' }],
  },
  {
    id: 'spay-it-forward',
    title: 'Spay It Forward',
    description:
      'Columbus Humane’s low-cost spay/neuter program for rabbit rescues, in partnership with OHRR — your donation funds affordable surgeries.',
    cta: 'About Spay It Forward',
    url: 'https://www.columbushumane.org/spayitforward',
    details: [
      'Columbus Humane, in partnership with Ohio House Rabbit Rescue, has launched Spay It Forward, a program providing low-cost spay and neuter services to rabbit rescues. With the growing number of rabbits entering shelters, this program helps prevent unwanted litters, reduces strain on local rescues, and ensures more rabbits can find safe, loving homes.',
    ],
  },
  {
    id: 'hopshop',
    title: 'Shop the Hop Shop',
    description:
      'Pellets, hay, litter, hidey houses, toys and OHRR apparel at the Adoption Center — profits support OHRR.',
    cta: 'Visit the Hop Shop',
    to: '/hop-shop',
  },
  {
    id: 'bunfest',
    title: 'Come to Midwest BunFest',
    description:
      'OHRR’s annual multi-state educational exposition and fundraiser — Sunday, October 25, 2026 in Hilliard. Sponsors, vendors, raffle, silent auction and more.',
    cta: 'Open BunFest',
    to: '/bunfest',
  },
  {
    id: 'mailing',
    title: 'Join the mailing list',
    description: 'Stay in the loop on rabbits, events, and BunFest news.',
    cta: 'Sign up',
    to: '/mailing-list',
  },
]
