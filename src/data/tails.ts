// "Happy Tails" — OHRR adoption stories and the life-stage status each bunny
// carries. Curated content for now (OHRR posts updates from photos adopters
// submit); the shape is ready to be backed by a database later without changing
// the UI. Photos are freely-licensed sample rabbits (see src/data/photos.ts).
import { BUNNY_PHOTOS } from './photos'

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
}

export const tails: Tail[] = [
  {
    id: 'mochi',
    bunny: 'Mochi',
    family: 'Patel',
    status: 'going-strong',
    photo: BUNNY_PHOTOS.tailLopCarpet,
    since: 'Adopted Mar 2025',
    summary:
      'A year of zoomies, free-range living, and an unlikely friendship with the family cat.',
    timeline: [
      { date: 'Mar 2025', status: 'just-adopted', text: 'Mochi went home with the Patel family.' },
      {
        date: 'Apr 2025',
        status: 'settling-in',
        text: 'Mastered the apartment in a week — and promptly claimed the couch as his own.',
      },
      { date: 'Sep 2025', text: 'Learned to throw a full binky the moment the salad bowl appears.' },
      {
        date: 'Mar 2026',
        status: 'going-strong',
        text: 'One year in: bonded with the family cat and now runs the whole household.',
      },
    ],
  },
  {
    id: 'pepper-clove',
    bunny: 'Pepper & Clove',
    family: 'Nguyen',
    status: 'going-strong',
    bonded: true,
    photo: BUNNY_PHOTOS.tailFluffy,
    since: 'Adopted Oct 2025',
    summary:
      'A bonded pair of brothers — six months of synchronized binkies and shared hay piles.',
    timeline: [
      {
        date: 'Oct 2025',
        status: 'just-adopted',
        text: 'The brothers went home together, exactly as a bonded pair should.',
      },
      {
        date: 'Nov 2025',
        status: 'settling-in',
        text: 'Picked their favorite window for synchronized morning sunbathing.',
      },
      {
        date: 'Apr 2026',
        status: 'going-strong',
        text: 'Six months strong and as inseparable as the day they arrived.',
      },
    ],
  },
  {
    id: 'biscuit',
    bunny: 'Biscuit',
    family: 'Garcia',
    status: 'just-adopted',
    photo: BUNNY_PHOTOS.tailGreyLap,
    since: 'Adopted Jun 2026',
    summary: 'Just found his forever home this month — and his forever person.',
    timeline: [
      {
        date: 'Jun 2026',
        status: 'just-adopted',
        text: 'Biscuit met the Garcias, and it was love at first nose-boop.',
      },
    ],
  },
  {
    id: 'daisy',
    bunny: 'Daisy',
    family: 'Cooper',
    status: 'settling-in',
    photo: BUNNY_PHOTOS.tailSpotted,
    since: 'Adopted May 2026',
    summary: 'Two weeks in and starting to trust — the very first flop happened this week.',
    timeline: [
      { date: 'May 2026', status: 'just-adopted', text: 'Daisy went home with the Coopers.' },
      {
        date: 'Jun 2026',
        status: 'settling-in',
        text: 'First flop on the kitchen floor — a huge milestone for a once-shy girl.',
      },
    ],
  },
  {
    id: 'thumper',
    bunny: 'Thumper',
    status: 'looking',
    photo: BUNNY_PHOTOS.tailGreyGrass,
    summary: 'Still searching for his someone. Could it be you?',
    timeline: [
      {
        date: 'Jun 2026',
        status: 'looking',
        text: 'Thumper is at the Adoption Center, ready to meet his match.',
      },
    ],
  },
  {
    id: 'cinnamon',
    bunny: 'Cinnamon',
    family: 'Reilly',
    status: 'forever-loved',
    photo: BUNNY_PHOTOS.silver,
    since: 'Adopted 2013',
    summary: 'Twelve wonderful years as the heart of the Reilly home. Forever loved.',
    timeline: [
      {
        date: '2013',
        status: 'just-adopted',
        text: 'A shy little rescue who slowly blossomed into a beloved companion.',
      },
      {
        date: '2013–2025',
        status: 'going-strong',
        text: 'Twelve years of head-pats, banana treats, and gentle company.',
      },
      {
        date: '2025',
        status: 'forever-loved',
        text: 'Crossed the rainbow bridge, deeply missed and forever loved.',
      },
    ],
  },
]
