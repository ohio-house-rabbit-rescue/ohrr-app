// SAMPLE education-session schedule.
//
// Session TOPICS reflect OHRR's real focus areas (diet, bonding, litter
// training, spay/neuter, behavior, first aid). Times and speakers are
// placeholders — replace with the confirmed Midwest BunFest agenda.

export type Track = 'Main Stage' | 'Education Room' | 'Hands-On'

export interface Session {
  id: string
  start: string // "HH:MM" 24h, for sorting
  time: string // display label
  title: string
  track: Track
  speaker: string
  description: string
}

export const sessions: Session[] = [
  {
    id: 's1',
    start: '10:30',
    time: '10:30 – 11:15 AM',
    title: 'Rabbit Diet 101: Hay, Pellets & the Daily Salad',
    track: 'Education Room',
    speaker: 'Speaker TBA',
    description:
      'What to feed, how much, and the common diet mistakes that land rabbits at the vet. Covers unlimited hay, quality pellets, and safe greens.',
  },
  {
    id: 's2',
    start: '11:00',
    time: '11:00 – 11:45 AM',
    title: 'Bonding Bunnies: Introducing Rabbits Safely',
    track: 'Main Stage',
    speaker: 'Speaker TBA',
    description:
      'A step-by-step look at the bonding process — reading body language, dating sessions, and setting up for a successful pair.',
  },
  {
    id: 's3',
    start: '11:30',
    time: '11:30 AM – 12:15 PM',
    title: 'Litter-Box Training Made Simple',
    track: 'Hands-On',
    speaker: 'Speaker TBA',
    description:
      'Why rabbits are natural candidates for litter training and how to set up a box your bun will actually use.',
  },
  {
    id: 's4',
    start: '12:30',
    time: '12:30 – 1:15 PM',
    title: 'Spay, Neuter & Why It Matters',
    track: 'Education Room',
    speaker: 'Veterinarian TBA',
    description:
      'The health and behavior benefits of altering your rabbit, plus an overview of low-cost options like OHRR’s Fix-a-Bun program.',
  },
  {
    id: 's5',
    start: '1:00',
    time: '1:00 – 1:45 PM',
    title: 'Reading Rabbit Behavior',
    track: 'Main Stage',
    speaker: 'Speaker TBA',
    description:
      'Binkies, flops, thumps, and nips — decode what your rabbit is telling you and build trust.',
  },
  {
    id: 's6',
    start: '1:30',
    time: '1:30 – 2:15 PM',
    title: 'Bunny-Proofing & Indoor Housing',
    track: 'Hands-On',
    speaker: 'Speaker TBA',
    description:
      'Creating a safe free-range or x-pen setup, protecting cords and baseboards, and meeting the indoor 4×4 minimum.',
  },
  {
    id: 's7',
    start: '2:30',
    time: '2:30 – 3:15 PM',
    title: 'Rabbit First Aid: Knowing an Emergency',
    track: 'Education Room',
    speaker: 'Veterinarian TBA',
    description:
      'GI stasis, heat stress, and the warning signs that mean "call the vet now." Building a basic rabbit first-aid kit.',
  },
  {
    id: 's8',
    start: '3:00',
    time: '3:00 – 3:45 PM',
    title: 'Adopting from a Rescue: What to Expect',
    track: 'Main Stage',
    speaker: 'OHRR Adoption Team',
    description:
      'How rescue adoption works, what makes a great rabbit home, and meeting adoptable buns from OHRR and partner rescues.',
  },
]
