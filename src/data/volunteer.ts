// Volunteer program content for the OHRR host app. The four "ways to help" are
// real OHRR roles; the specific bunnies, shifts, transport runs, and events
// below are illustrative TEMPLATE data so volunteers can see how the flow works
// end-to-end. Swap in OHRR's real schedule (or wire to a backend) when ready —
// the UI won't need to change.
import type { IconName } from '../components/icons'
import { BUNNY_PHOTOS } from './photos'

export type VolunteerSlug = 'socialization' | 'vet-transport' | 'events' | 'foster'

export interface VolunteerWay {
  slug: VolunteerSlug
  title: string
  icon: IconName
  tagline: string // short line for the cards
  blurb: string // longer intro on the detail page
  commitment: string // quick chip, e.g. time ask
}

export const volunteerWays: VolunteerWay[] = [
  {
    slug: 'socialization',
    title: 'Bunny Socialization',
    icon: 'heart',
    tagline: 'Sit with rabbits to help them get ready for adoption.',
    blurb:
      'Shy and newly-rescued rabbits become far more adoptable once they’re used to gentle human company. Socializers sit quietly with a bunny — offering a hand, a treat, and calm presence — so they learn that people are friends.',
    commitment: '1-hour shifts · up to two per month',
  },
  {
    slug: 'vet-transport',
    title: 'Vet Transport',
    icon: 'mappin',
    tagline: 'Drive bunnies to and from their vet appointments.',
    blurb:
      'OHRR rabbits need rides to spay/neuter surgeries, wellness checks, and emergencies. If you have a car and a free morning, claiming a transport run is one of the most concretely helpful things you can do.',
    commitment: 'A few hours · as your schedule allows',
  },
  {
    slug: 'events',
    title: 'Events & Awareness',
    icon: 'users',
    tagline: 'Help at tabling events and spread the word.',
    blurb:
      'From Midwest BunFest to library talks and adoption days, OHRR shows up where the people are. Event volunteers help set up, answer questions, share rabbit-care basics, and hand out information.',
    commitment: 'Per event · flexible',
  },
  {
    slug: 'foster',
    title: 'Foster a Rabbit',
    icon: 'home',
    tagline: 'Open your home and expand rescue capacity.',
    blurb:
      'Foster homes let OHRR say “yes” to more rabbits than the center can hold. You provide a safe indoor space, food, and love; OHRR covers vet care and supplies and helps every step of the way.',
    commitment: 'Weeks to months · OHRR supports you',
  },
]

export function findWay(slug?: string): VolunteerWay | undefined {
  return volunteerWays.find((w) => w.slug === slug)
}

/* ---------- Bunnies who'd love a socialization visit (template) ---------- */
export interface SocialBunny {
  name: string
  photo: string
  age: string
  trait: string
  note: string
}

export const socialBunnies: SocialBunny[] = [
  {
    name: 'Maple',
    photo: BUNNY_PHOTOS.brown,
    age: 'Adult',
    trait: 'Shy',
    note: 'Came from a hoarding case and is still learning to trust. Loves a quiet voice and a handful of greens.',
  },
  {
    name: 'Biscuit',
    photo: BUNNY_PHOTOS.greyLop,
    age: 'Young',
    trait: 'Bouncy',
    note: 'Tons of energy and very food-motivated — perfect for a volunteer who likes an interactive bun.',
  },
  {
    name: 'Tango',
    photo: BUNNY_PHOTOS.orangeLop,
    age: 'Adult',
    trait: 'Gentle',
    note: 'A mellow lop who just wants company. Great first bunny for a brand-new socializer.',
  },
]

/* ---------- Open socialization shifts (template) ---------- */
export interface Shift {
  id: string
  day: string
  date: string
  time: string
  spots: number
}

export const socialShifts: Shift[] = [
  { id: 'soc-1', day: 'Saturday', date: 'June 21', time: '12:00 – 1:00 PM', spots: 2 },
  { id: 'soc-2', day: 'Saturday', date: 'June 21', time: '1:00 – 2:00 PM', spots: 1 },
  { id: 'soc-3', day: 'Sunday', date: 'June 22', time: '12:30 – 1:30 PM', spots: 3 },
  { id: 'soc-4', day: 'Sunday', date: 'June 22', time: '2:00 – 3:00 PM', spots: 2 },
]

/* ---------- Upcoming vet-transport runs (template) ---------- */
export interface TransportRun {
  id: string
  date: string
  from: string
  to: string
  window: string
  bunny: string
  note?: string
}

export const transportRuns: TransportRun[] = [
  {
    id: 'run-1',
    date: 'Wed, June 25',
    from: 'OHRR Adoption Center',
    to: 'MedVet Columbus',
    window: '8:30 – 10:00 AM',
    bunny: 'Pip — neuter surgery',
    note: 'Drop-off only; return run claimed separately.',
  },
  {
    id: 'run-2',
    date: 'Wed, June 25',
    from: 'MedVet Columbus',
    to: 'OHRR Adoption Center',
    window: '4:00 – 5:30 PM',
    bunny: 'Pip — post-op pickup',
  },
  {
    id: 'run-3',
    date: 'Fri, June 27',
    from: 'Foster home (Westerville)',
    to: 'Rabbit-savvy vet (Granville)',
    window: '9:00 – 11:00 AM',
    bunny: 'Willow — wellness check',
  },
]

/* ---------- Events needing hands (template) ---------- */
export interface OutreachEvent {
  id: string
  name: string
  date: string
  location: string
  need: string
}

export const outreachEvents: OutreachEvent[] = [
  {
    id: 'evt-1',
    name: 'Adoption Day at the Hop Shop',
    date: 'Saturday, July 12',
    location: 'OHRR Adoption Center, Columbus',
    need: '3 volunteers · greeting & meet-and-greets',
  },
  {
    id: 'evt-2',
    name: 'Library Rabbit-Care Talk',
    date: 'Saturday, August 16',
    location: 'Columbus Metropolitan Library',
    need: '2 volunteers · setup & handouts',
  },
  {
    id: 'evt-3',
    name: 'Midwest BunFest',
    date: 'October (annual)',
    location: 'Hilliard, OH area',
    need: 'Many hands · all roles — the big one!',
  },
]

/* ---------- Fostering (template detail) ---------- */
export const fosterInfo = {
  steps: [
    'Tell us a little about your home and experience — no experience required.',
    'OHRR matches you with a rabbit (or bonded pair) that fits your space.',
    'We provide the supplies, cover all vet care, and stay one text away.',
    'You give a safe indoor space and daily care until they find their forever home.',
  ],
  note: 'Fostering is the fastest way to grow OHRR’s capacity — and yes, “foster fails” (adopting your foster) are always welcome.',
}
