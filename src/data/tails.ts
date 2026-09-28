// "Happy Tails" — OHRR adoption stories and the life-stage status each bunny
// carries. The stories themselves are `happy_tails` rows staff publish from the
// Inbox (features/tails/api.ts); this file holds the shared shape and the one
// built-in EXAMPLE story shown until the first real one is published.

// Status is shown as words only (no emoji) — a clean label that won't date.
export const TAIL_STATUS = {
  looking: { label: 'Looking for a home', cls: 'bg-brand-blue-50 text-brand-blue' },
  'just-adopted': { label: 'Just adopted', cls: 'bg-brand-orange-50 text-brand-orange' },
  'settling-in': { label: 'Settling in', cls: 'bg-amber-100 text-amber-800' },
  'going-strong': { label: 'Going strong', cls: 'bg-emerald-100 text-emerald-800' },
  'forever-loved': { label: 'Forever loved', cls: 'bg-violet-100 text-violet-800' },
} as const

export type TailStatus = keyof typeof TAIL_STATUS

// Order used for sensible sorting / display (newest journeys first-ish).
export const TAIL_STATUS_ORDER: TailStatus[] = [
  'just-adopted',
  'settling-in',
  'going-strong',
  'looking',
  'forever-loved',
]

export interface TimelineEntry {
  date: string
  status?: TailStatus
  text: string
}

export interface Tail {
  id: string
  bunny: string
  family?: string
  status: TailStatus
  photo?: string
  since?: string
  summary: string
  bonded?: boolean
  timeline: TimelineEntry[]
  /** The built-in example below — never a real adoption; labelled "Example" wherever it shows. */
  example?: boolean
}

// Shown with the example on the list and the story page.
export const EXAMPLE_TAIL_NOTE =
  'This is an example of a Happy Tails story. When adopters share theirs, they’ll appear here instead.'
export const EXAMPLE_TAIL_PHOTO_NOTE =
  'The photo is one of OHRR’s own. Dottie and her story are made up, to show what a Happy Tail looks like.'

// The one example story, shaped exactly like a published row (a one-line
// summary for the card, the story as a single entry) so people and staff see
// what a real Happy Tail will look like. It shows only while OHRR has no
// published stories and disappears by itself with the first real one — it is
// not a database row, so there is nothing to clean up. The name is made up (no
// OHRR rabbit in the database is called Dottie); the photo is OHRR's own, from
// the "Adoption Process for OHRR" post on the current site (the website's
// data/ohrrPhotos.ts ADOPTION_PHOTO, copied to public/img/ohrr/), not any
// adoptable rabbit's listing photo.
const EXAMPLE_SINCE = 'Adopted spring 2025'

export const exampleTail: Tail = {
  id: 'example',
  bunny: 'Dottie',
  status: 'going-strong',
  photo: '/img/ohrr/adoption-rescued-favorite-breed.jpg',
  since: EXAMPLE_SINCE,
  summary:
    'Shy for her first weeks home, Dottie now has the run of the living room. Patience made all the difference.',
  example: true,
  timeline: [
    {
      date: EXAMPLE_SINCE,
      status: 'going-strong',
      text: [
        'Dottie’s family found her on OHRR’s list of adoptable rabbits and sent in an application that night. At their weekend appointment at the Adoption Center, they saw how OHRR houses and feeds its rabbits, then sat on the floor to meet her. She hopped over, sniffed a shoelace and stayed. That afternoon she went home with them.',
        'The first weeks were quiet. Dottie spent most of her time in her hidey house and only came out when the room was still. Her family sat on the floor each evening with a few leaves of romaine and let her come to them. By the third week she was taking greens from their hands, and one night she flopped over on her side for the first time.',
        'A year later, Dottie has the run of the living room. She naps in the afternoon sun, thumps if dinner is late, and does a binky every time the salad bowl comes out. The best advice her family got at the Adoption Center: be patient, and let her set the pace.',
      ].join('\n\n'),
    },
  ],
}
