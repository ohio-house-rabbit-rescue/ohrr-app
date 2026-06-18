// Midwest BunFest activity & visit info brought in-app as native content, so the
// festival is its own entity in the app (no more linking out to
// midwestbunfest.org for these). Content transcribed from the BunFest site
// 2026-06-18; ticket *purchase* stays external (payment).
import type { IconName } from '../components/icons'

export interface InfoSection {
  heading?: string
  body?: string
  list?: string[]
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
}

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
        heading: 'How to sign up',
        body: 'Advance package scheduling has closed — hop by the Bunny Spa as soon as you arrive at BunFest to sign up in person. Day-of slots are first-come, first-served.',
      },
      {
        heading: 'Good to know',
        body: 'After the spa, you can schedule professional photos at the Glamour Shots table. All proceeds benefit Ohio House Rabbit Rescue.',
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
          '10-minute sessions; arrive 5–10 minutes early to check in',
          'Bring your own props, or choose from available themes',
          'Single rabbits or bonded groups welcome',
          'You take home a thumb drive with every photo from your session',
        ],
      },
      {
        heading: 'Scheduling',
        body: 'Advance registration has closed, but day-of appointments are first-come, first-served — arrive early, as Glamour Shots fills up quickly.',
      },
      {
        heading: 'Good to know',
        body: 'All proceeds support OHRR’s adoption center, education, and foster rabbits.',
      },
    ],
    note: RHDV2_NOTE,
  },
  {
    id: 'raffle',
    title: 'Raffle & Silent Auction',
    subtitle: 'Bid and win — bunny toys, treats, jewelry, gift baskets, and more.',
    icon: 'ticket',
    chips: ['Raffle: $1 / ticket', '6 for $5'],
    sections: [
      {
        heading: 'Raffle',
        body: 'Tickets are $1 each or 6 for $5. Sales begin at 10:00 AM with drawings at 12:30 PM. Write your name and phone number on each ticket and drop it in the bucket for any prize you want — put as many as you like toward a single prize.',
      },
      {
        heading: 'Silent Auction',
        body: 'Two sessions with different items each: the first from 10:00 AM–12:15 PM, a new set from 1:00–3:15 PM. Bid during the session, or use “buy it now” to lock in a favorite.',
      },
      {
        heading: 'Where it goes',
        body: 'All proceeds go toward OHRR’s adoption center, education programs, and foster rabbits.',
      },
    ],
  },
  {
    id: 'toymaking',
    title: 'Toymaking Workshop',
    subtitle: 'Build an enrichment toy and playmat to take home for your bunny.',
    icon: 'gift',
    sections: [
      {
        heading: 'What it is',
        body: 'A DIY toy and playmat kit comes with a variety of shapes and sizes of materials for crafting different toy and playmat designs. Facilitated by Buttercup’s Bunny Boutique.',
      },
      {
        heading: 'How to join',
        body: 'Space is limited and details are shared on sign-up — email to reserve your spot.',
      },
    ],
    emailSignup: 'contact@ohiohouserabbitrescue.org',
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
          '$134 / night (plus tax) for a king or double-bed suite',
          'Group code: MWF',
          'Bunny guests welcome — $35 refundable deposit',
          'Book by September 25 — the reduced rate isn’t available after that, and rooms can sell out',
        ],
      },
    ],
    contact: {
      address: '5100 Upper Metro Pl, Dublin, OH 43017',
      phone: '1-800-220-9219',
    },
  },
]

export function bunfestPageById(id?: string): BunfestPage | undefined {
  return bunfestPages.find((p) => p.id === id)
}
