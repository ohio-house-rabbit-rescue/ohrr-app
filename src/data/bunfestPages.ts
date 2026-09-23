// Midwest BunFest activity & visit info brought in-app as native content, so the
// festival is its own entity in the app (no more linking out to
// midwestbunfest.org for these). Ticket *purchase* stays external (payment).
//
// This is the bundled fallback. The live copy — prices, times, whether advance
// booking is open — comes from `bunfest_pages` for the year being shown and is
// edited in Staff → BunFest → Pages (features/bunfest/pages.ts). Keep this in
// step with the current year so the app still reads correctly offline.
// Transcribed from midwestbunfest.org on 2026-09-22.
import type { IconName } from '../components/icons'

export interface InfoSection {
  heading?: string
  body?: string
  list?: string[]
  // Optional live add-on rendered under the copy: 'raffle-details' shows the
  // staff-entered auction_settings.raffle_details text when one is set.
  slot?: 'raffle-details'
}

export interface BunfestPage {
  id: string
  title: string
  subtitle?: string
  icon: IconName
  sponsor?: string
  chips?: string[] // quick facts, e.g. pricing
  sections: InfoSection[]
  note?: string // highlighted callout (e.g. the vaccination rule)
  emailSignup?: string // "sign up by email" address
  contact?: { address?: string; phone?: string; url?: string; urlLabel?: string }
  relatedLabel?: string
  related?: { label: string; to: string }[]
  // Interactive add-ons rendered under the content:
  feature?: 'reserve' | 'raffle'
  reserve?: ReserveSetup // for 'reserve'
}

/**
 * Taking appointments ahead of the day.
 *
 * OHRR opens advance booking for the Bunny Spa and Glamour Shots some years
 * and not others, and closes it a week or two out so the team can print the
 * list. That was a yes/no in the app, which meant someone had to remember to
 * switch it off — so it carries its own dates now and closes itself.
 * `opensOn` / `closesOn` are "YYYY-MM-DD", both inclusive, both optional:
 * no `opensOn` means it is open already, no `closesOn` means it stays open.
 */
export interface ReserveSetup {
  formName: string
  /** The choices offered, e.g. the spa's services. */
  services?: string[]
  /** The times people can ask for. Falls back to SESSION_SLOTS. */
  slots?: string[]
  opensOn?: string
  closesOn?: string
  /** What the page says once advance requests have closed. */
  closedNote?: string
}

// Festival runs 10–4; offer 30-minute reservation windows people can request.
// A page can set its own `slots` instead — this is only the fallback.
export const SESSION_SLOTS = [
  '10:00 AM',
  '10:30 AM',
  '11:00 AM',
  '11:30 AM',
  '12:00 PM',
  '12:30 PM',
  '1:00 PM',
  '1:30 PM',
  '2:00 PM',
  '2:30 PM',
  '3:00 PM',
  '3:30 PM',
] as const

const RHDV2_NOTE =
  'For the safety of all rabbits, any rabbit attending Midwest BunFest must be vaccinated against RHDV2 and current on the annual booster — proof is required at entry.'

export const bunfestPages: BunfestPage[] = [
  {
    id: 'spa',
    title: 'Bunny Spa',
    subtitle: 'Grooming and hygiene for your rabbit, staffed by trained volunteers.',
    icon: 'sparkles',
    sponsor: 'Sponsored by Oxbow',
    chips: ['$12 per service', '$20 full spa package'],
    sections: [
      {
        heading: 'Services',
        list: ['Nail trims', 'Light grooming', 'Gland cleaning'],
      },
      {
        heading: 'Prices',
        list: [
          '$12.00 — individual services',
          '$20.00 — full spa package (nail clipping, gland cleaning and light grooming)',
        ],
      },
      {
        heading: 'On the day',
        body: 'Day-of appointments are first-come, first-served: hop by the Bunny Spa as soon as you arrive to sign up in person. They fill up quickly. You pay at the table, and all proceeds benefit OHRR.',
      },
    ],
    note: RHDV2_NOTE,
    relatedLabel: 'Pairs well with',
    related: [{ label: 'Glamour Shots', to: '/bunfest/p/glamour' }],
  },
  {
    id: 'glamour',
    title: 'Glamour Shots',
    subtitle: 'Professional photos of your bunny — always a BunFest favorite.',
    icon: 'star',
    sponsor: 'Sponsored by Oxbow',
    chips: ['$20 flat — all your photos'],
    sections: [
      {
        heading: 'How it works',
        list: [
          'Two photo booths run all day so every bunny who wants a photo can have one',
          '10-minute sessions; arrive 5–10 minutes early to check in and settle your bunny',
          'Bring your own props, or choose from the wide variety of props and themes available',
          'Single bunnies or bonded pairs, trios, quartets — all welcome',
          '$20 flat rate, and you take home a thumb drive with every photo from the session',
        ],
      },
      {
        heading: 'On the day',
        body: 'Glamour Shots fills up quickly, so hop by as soon as you arrive to sign up in person — day-of appointments are first-come, first-served. Proceeds help OHRR save abandoned, abused and unwanted bunnies in central Ohio.',
      },
    ],
    note: RHDV2_NOTE,
    relatedLabel: 'Pairs well with',
    related: [{ label: 'Bunny Spa', to: '/bunfest/p/spa' }],
  },
  {
    id: 'raffle',
    title: 'Raffle & Silent Auction',
    subtitle: 'Bid and win — proceeds support Ohio House Rabbit Rescue.',
    icon: 'ticket',
    chips: ['Raffle tickets $1 each, 6 for $5'],
    sections: [
      {
        heading: 'Raffle',
        body: 'There is one raffle session this year. Ticket sales begin at 10:00 and the drawing is at 12:30. Tickets are $1 each, or 6 for $5. Write your name and phone number on each ticket and drop them in the buckets for the prizes you want — any number of tickets in any bucket. Winners are announced after the 12:30 draw.',
        slot: 'raffle-details',
      },
      {
        heading: 'Silent Auction',
        body: 'Bid early and often on bunny toys and treats, jewelry, gift baskets and more. There are two sessions: the first set of items runs 10:00 – 12:15, and a new set 1:00 – 3:15. As always you can “buy it now” to be sure of your favorite treasure.',
      },
    ],
    feature: 'raffle',
    relatedLabel: 'Silent auction',
    related: [{ label: 'Browse the silent auction items', to: '/bunfest/auction' }],
  },
  {
    id: 'toymaking',
    title: 'Toymaking Workshop',
    subtitle: 'Build an enrichment toy and playmat to take home for your bunny.',
    icon: 'gift',
    sponsor: 'Run by Buttercup’s Bunny Boutique',
    chips: ['Sign-up details to come'],
    sections: [
      {
        heading: 'It’s back for 2026',
        body: 'The DIY Toymaking Workshop by Buttercup’s Bunny Boutique returns this year. Sign-up details are still to come — check back closer to the festival.',
      },
      {
        heading: 'What you get',
        body: 'Buttercup’s Bunny Boutique guides you in building your own custom playmat, with the tips and tricks and any questions answered. The DIY toy and playmat kit comes with shapes and sizes of materials for crafting a range of toys and playmat designs, and there are extras to take home for continued fun.',
      },
      {
        heading: 'Where the money goes',
        body: 'Buttercup’s Bunny Boutique donates all proceeds to Ohio House Rabbit Rescue.',
      },
    ],
  },
  {
    id: 'volunteer',
    title: 'Volunteer at BunFest',
    subtitle: 'An event this size runs on volunteers — come and be part of the team.',
    icon: 'users',
    chips: ['Free admission', 'Free BunFest lanyard', 'Shifts of at least 3 hours'],
    sections: [
      {
        heading: 'What you get',
        body: 'Volunteers receive free admission to the event and a free Midwest BunFest lanyard. We ask for a shift of at least three hours between 10am and 4pm — the rest of the day is yours to enjoy BunFest for as long as you like.',
      },
      {
        heading: 'Where help is needed',
        list: [
          'Glamour Shots — check people in for their appointment, help the photographer with the bunnies, choose props and costumes, load pictures onto a jump drive',
          'Hop Shop — stocking merchandise, answering questions, checkout',
          'Registration / Check-in — selling tickets, distributing wristbands, handing out programs, general information and directions',
          'Silent Auction / Raffle — selling raffle tickets, watching over the auction items, helping with purchases',
        ],
      },
      { heading: 'Time slots', list: ['10:00 AM – 1:00 PM', '1:00 PM – 4:00 PM'] },
      {
        heading: 'Who we’re looking for',
        body: 'People who love bunnies. You can choose an area with minimal or with plenty of hands-on contact with the rabbits. We need volunteers who are friendly, enthusiastic and happy to work as part of a team. A few roles suit someone with leadership or event-planning experience, but most need nothing more than an interest in helping out.',
      },
    ],
    relatedLabel: 'Also',
    related: [{ label: 'Other ways to volunteer with OHRR', to: '/volunteer' }],
  },
  {
    id: 'lounge',
    title: 'Chillaxabun Lounge',
    subtitle: 'A calm space for your rabbit to stretch out and unwind during the day.',
    icon: 'heart',
    chips: ['Free — donations welcome'],
    sections: [
      {
        heading: 'What it offers',
        body: 'Each bunny gets an individual pen with a litter box, water, and tasty hay — a quiet place to relax between the sights and sounds of the festival. It’s complimentary; donations are gratefully accepted.',
      },
      {
        heading: 'Before you use it',
        body: 'Please review the “Bringing Your Bunny” guidelines first — the same health and vaccination rules apply.',
      },
    ],
    note: RHDV2_NOTE,
    relatedLabel: 'Read first',
    related: [{ label: 'Bringing Your Bunny', to: '/bunfest/p/bringing-bunny' }],
  },
  {
    id: 'bringing-bunny',
    title: 'Bringing Your Bunny',
    subtitle: 'Planning to bring your rabbit? Here’s everything required before you go.',
    icon: 'heart',
    sections: [
      {
        heading: 'Vaccination is required',
        body: 'All rabbits at the event must be vaccinated against RHDV2 and up to date on an annual booster — a two-vaccine series within the last year, or proof of an annual booster within the last year. This applies everywhere, including the Bunny Spa, Glamour Shots, and the Lounge.',
      },
      {
        heading: 'Acceptable proof (bring one)',
        list: [
          'A vaccination or booster certification form',
          'A veterinary bill showing the vaccination/booster',
          'Documentation from your vet’s pet portal',
        ],
      },
      {
        heading: 'Supply biosecurity',
        body: 'Make sure the bedding, hay, and food you bring is from a known source that isn’t in an RHDV2 outbreak area, or from a supplier that follows strict RHDV2 controls (e.g., Oxbow).',
      },
      {
        heading: 'Sign the agreement',
        body: 'Every attendee bringing a rabbit signs the Rabbit Attendance Agreement confirming health, vaccination, supply source, and the event rules.',
      },
    ],
    note: RHDV2_NOTE,
    relatedLabel: 'Next',
    related: [{ label: 'Rabbit Attendance Agreement', to: '/bunfest/p/attendance-agreement' }],
  },
  {
    id: 'attendance-agreement',
    title: 'Rabbit Attendance Agreement',
    subtitle: 'The terms every attendee agrees to when bringing a rabbit to BunFest.',
    icon: 'book',
    sections: [
      {
        list: [
          'My rabbit is in good health; OHRR may ask an ill rabbit to leave.',
          'My rabbit is vaccinated for RHDV2 and current on the annual booster, with proof provided.',
          'I will not bring bedding, hay, or food whose source I don’t know, or that comes from an RHDV2 outbreak area.',
          'My rabbit will not be loose in the venue at any time — they stay in a carrier, stroller, or harness.',
          'I will not allow interaction between rabbits that aren’t already bonded, to prevent injuries.',
          'I will clean up after my rabbit right away to help prevent the spread of disease.',
          'I will watch my bunny’s behavior closely and take a stressed rabbit home.',
          'I will keep my rabbit well hydrated and fed at all times.',
          'I understand OHRR does not accept responsibility or liability for injuries or illnesses incurred at the event.',
        ],
      },
    ],
  },
  {
    id: 'accommodations',
    title: 'Accommodations',
    subtitle: 'The host hotel and where to stay near the festival.',
    icon: 'home',
    sections: [
      {
        heading: 'Host hotel — Embassy Suites Dublin',
        body: 'A 3-Diamond property with a complimentary hot breakfast each morning, a complimentary evening reception, and free parking. Every room includes a sleeper sofa for extra guests.',
      },
      {
        heading: 'Group rate',
        list: [
          '$134 per night plus applicable taxes, for a king suite or a suite with two double beds',
          'Group name: 2026 MidwestBunfest',
          'Group code: MWF',
          'Bringing your bunny? A refundable $35 pet deposit applies for the stay, returned after hotel staff check the room',
          'The block closes Friday, September 25 — after that the reduced rate is gone and rooms may sell out',
        ],
      },
      {
        heading: 'Booking',
        body: 'Use the group booking link below to land directly in the Midwest BunFest room block and get the group rate, or call central reservations on 1-800-220-9219.',
      },
    ],
    chips: ['$134 / night group rate', 'Book by September 25'],
    contact: {
      address: '5100 Upper Metro Pl, Dublin, OH 43017',
      phone: '1-800-220-9219',
      url: 'https://www.hilton.com/en/attend-my-event/midwestbunfest2026-mwf/',
      urlLabel: 'Book the group rate',
    },
  },
]

export function bunfestPageById(id?: string): BunfestPage | undefined {
  return bunfestPages.find((p) => p.id === id)
}
