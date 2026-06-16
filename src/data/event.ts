// Core event facts.
//
// CONFIRMED (from OHRR / Midwest BunFest research, see /docs):
//   - Annual, every October; largest rabbit expo in the Eastern U.S.
//   - Hosted by Ohio House Rabbit Rescue (OHRR), Columbus, OH.
//   - Most recent confirmed edition: Sunday, Oct 27, 2024, 10:00 AM – 4:00 PM.
//   - Current location: the Hilliard, OH area.
//
// PLACEHOLDER ([VERIFY] with OHRR before publishing):
//   - The exact 2026 date and venue.

export const event = {
  name: 'Midwest BunFest',
  host: {
    name: 'Ohio House Rabbit Rescue',
    short: 'OHRR',
    url: 'https://www.ohiohouserabbitrescue.org/',
  },
  tagline: 'The largest rabbit festival & educational expo in the Eastern U.S.',
  blurb:
    'A national, family-friendly celebration of house rabbits — education sessions led by rabbit experts and vets, specialty vendors, a bunny spa, glamour shots, a silent auction, raffles, and rescues from across the Midwest. All in support of Ohio House Rabbit Rescue.',
  year: 2026,
  dateLabel: 'October 2026',
  dateNote: 'Exact date to be announced',
  timeLabel: '10:00 AM – 4:00 PM',
  location: {
    name: 'Hilliard, Ohio area',
    note: 'Venue announced closer to the event.',
  },
  lastConfirmedEdition: 'Sunday, Oct 27, 2024 · 10:00 AM – 4:00 PM',
  links: {
    bunfest: 'https://www.midwestbunfest.org/',
    bunfestEventInfo: 'https://www.midwestbunfest.org/event-info.html',
    bunfestFacebook: 'https://www.facebook.com/MidwestBunFest/',
    ohrr: 'https://www.ohiohouserabbitrescue.org/',
    ohrrFacebook: 'https://www.facebook.com/ohiohouserabbitrescue/',
  },
} as const

// Things to do / see at BunFest (from research). Used on the home page.
export const highlights = [
  {
    icon: '🛍️',
    title: 'Specialty Vendors',
    text: 'Hard-to-find toys, handmade goods, and treats you won’t see in local pet stores.',
  },
  {
    icon: '🎓',
    title: 'Education Sessions',
    text: '10–15 talks led by nationally recognized vets and certified rabbit educators.',
  },
  {
    icon: '💅',
    title: 'Bunny Spa',
    text: 'Nail trims and grooming for your rabbit by experienced volunteers.',
  },
  {
    icon: '📸',
    title: 'Glamour Shots',
    text: 'Professional pet-rabbit photography to capture your bun’s best side.',
  },
  {
    icon: '🎟️',
    title: 'Silent Auction & Raffle',
    text: 'Bid and win great items — every dollar supports rescued rabbits.',
  },
  {
    icon: '🐰',
    title: 'Rescue Partners',
    text: 'Meet 15–20 rabbit rescues from across the Midwest, all in one place.',
  },
  {
    icon: '🛋️',
    title: 'Chilaxabun Lounge',
    text: 'A calm space to take a break and relax between sessions.',
  },
  {
    icon: '🛒',
    title: 'OHRR Hop Shop',
    text: 'Rabbit-appropriate supplies and OHRR merch — proceeds fund the rescue.',
  },
] as const
