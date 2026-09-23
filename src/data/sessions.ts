// The Midwest BunFest education programme — the bundled fallback.
//
// The live programme comes from `bunfest_sessions` (Staff → BunFest →
// Schedule); this copy is what the app shows before that first loads, or if
// Supabase is unreachable. Transcribed from midwestbunfest.org on 2026-09-22.
//
// The festival runs two tracks at the same time, so a session carries the
// track it belongs to. `start` is 24-hour "HH:MM" for sorting.

export interface Session {
  id: string
  start: string
  time: string
  title: string
  presenter: string
  description: string
  /** "Education Sessions" / "Special Interest Sessions" — a talk's track. */
  track?: string
  /** Who gives it — bunfest_presenters ids, when OHRR has linked them. */
  presenterIds?: string[]
  isBreak?: boolean
}

export const EDUCATION_TRACK = 'Education Sessions'
export const SPECIAL_TRACK = 'Special Interest Sessions'

export const sessions: Session[] = [
  // ---- Education Sessions ----
  {
    id: 'e1',
    start: '10:30',
    time: '10:30 – 11:15 AM',
    track: EDUCATION_TRACK,
    title: 'I’m All Ears: Understanding and Treating Rabbit Ear Infections',
    presenter: 'Nicholas Jew, DVM · MedVet Hilliard',
    description:
      'A dive down the rabbit hole into rabbit ear infections: how to know when there’s a problem and what to expect at the vet. Covers external and middle ear infections, and the challenges of diagnosing and treating the dreaded vestibular rabbit.',
  },
  {
    id: 'e2',
    start: '11:30',
    time: '11:30 AM – 12:15 PM',
    track: EDUCATION_TRACK,
    title: 'Hare-Raising Issues: The Lowdown on Liver Lobe Torsions',
    presenter: 'Nicholas Jew, DVM · MedVet Hilliard',
    description:
      'A walk through a liver lobe torsion from start to finish, demystifying this life-threatening condition and how to navigate it with your bunny family. Highs, lows, heartbreak and hopefully some laughs.',
  },
  {
    id: 'e3',
    start: '12:15',
    time: '12:15 – 1:15 PM',
    track: EDUCATION_TRACK,
    title: 'Break',
    presenter: '',
    description: '',
    isBreak: true,
  },
  {
    id: 'e4',
    start: '13:15',
    time: '1:15 – 2:00 PM',
    track: EDUCATION_TRACK,
    title: 'Digestive Issues You Absolutely Should Know About — GI Stasis and Bloat',
    presenter: 'Barbara Oglesbee, DVM, DABVP (Avian) · MedVet Hilliard',
    description:
      'Digestive problems are very common in rabbits and can have serious consequences if not treated properly. If your rabbit stops eating, get to a veterinarian immediately. The signs to watch for, treatment options, and what you can do to make these less likely.',
  },
  {
    id: 'e5',
    start: '14:15',
    time: '2:15 – 3:00 PM',
    track: EDUCATION_TRACK,
    title: 'Fluffy or Fat? Unraveling the Health Hazards of Obesity in Rabbits',
    presenter: 'Barbara Oglesbee, DVM, DABVP (Avian) · MedVet Hilliard',
    description:
      'Under all that fur it can be hard to tell if your bunny is overweight. The most common health risks and consequences of obesity in rabbits, and strategies for treatment and prevention.',
  },
  {
    id: 'e6',
    start: '15:15',
    time: '3:15 – 4:00 PM',
    track: EDUCATION_TRACK,
    title: 'Best Friends Forever: Bonding Rabbits',
    presenter:
      'Karen Winstead and Ryan Terebesi · Rabbit Expert Volunteers, Columbus Humane and Ohio House Rabbit Rescue',
    description:
      'Rabbits are usually happiest with another bun to pal around with — the trick is finding the right one. The do’s and don’t’s of bonding, from chaperoning first dates to knowing when your rabbits can safely move in together.',
  },

  // ---- Special Interest Sessions ----
  {
    id: 's1',
    start: '10:45',
    time: '10:45 – 11:15 AM',
    track: SPECIAL_TRACK,
    title: 'Administering Meds at Home',
    presenter: 'Emily Fagundo, DVM · MedVet Hilliard',
    description:
      'Caring for your bunny after a vet visit: techniques and tips for giving oral meds, fluids and shots.',
  },
  {
    id: 's2',
    start: '11:30',
    time: '11:30 AM – 12:00 PM',
    track: SPECIAL_TRACK,
    title: 'An Integrative Approach to Rabbit Medicine',
    presenter: 'Susan Borders, DVM and Kaylee Vanhorenbeck, DVM · Animal Hospital of Pataskala',
    description:
      'How laser and acupuncture can be used for bunnies — what each treatment involves and the conditions they commonly treat.',
  },
  {
    id: 's3',
    start: '12:15',
    time: '12:15 – 12:45 PM',
    track: SPECIAL_TRACK,
    title: 'What is Hay?',
    presenter: 'Daniel C. Brenner · Hay Farmer and Educator',
    description:
      'The definitions and varieties of hay, how it is grown and harvested, and the difference between 1st, 2nd and 3rd cuttings — plus how to identify good hay for bunnies. Questions welcome, time permitting.',
  },
  {
    id: 's4',
    start: '12:45',
    time: '12:45 – 1:15 PM',
    track: SPECIAL_TRACK,
    title: 'Break',
    presenter: '',
    description: '',
    isBreak: true,
  },
  {
    id: 's5',
    start: '13:15',
    time: '1:15 – 1:45 PM',
    track: SPECIAL_TRACK,
    title: 'More Than Toys: Creating Meaningful Enrichment for Pet Rabbits',
    presenter:
      'Tess Keener · Columbus House Rabbit Society and the Humane Society of Greater Dayton’s Bunny Brigade',
    description:
      'Enrichment is more than a pile of toys — it is opportunities to forage, dig, chew, explore and make choices. Practical, affordable ways to add enrichment to your rabbit’s everyday environment, and how to spot what your own bunny enjoys most.',
  },
  {
    id: 's6',
    start: '14:00',
    time: '2:00 – 2:30 PM',
    track: SPECIAL_TRACK,
    title: 'Fun Facets of Field Rescue',
    presenter:
      'Shanleigh Knittel, Founder of Operation Obi and HRS Educator, and Danielle Patterson, CHRS Chapter Manager and HRS Educator',
    description:
      'A lot of preparation goes into catching dumped domestic rabbits besides the rescue itself. The work before and after a field rescue, as well as the physical rescues themselves.',
  },
]
