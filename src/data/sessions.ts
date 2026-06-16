// Real Midwest BunFest 2025 Special Interest Sessions (midwestbunfest.org).
// A single education timeline (the real event isn't split into tracks).
// `start` is 24-hour "HH:MM" for sorting.

export interface Session {
  id: string
  start: string
  time: string
  title: string
  presenter: string
  description: string
  isBreak?: boolean
}

export const sessions: Session[] = [
  {
    id: 's1',
    start: '10:45',
    time: '10:45 – 11:10 AM',
    title: 'Administering Meds at Home',
    presenter: 'Emily Fagundo, DVM · MedVet Hilliard',
    description:
      'Techniques and tips for giving your bunny oral meds, fluids, and shots after a vet visit.',
  },
  {
    id: 's2',
    start: '11:15',
    time: '11:15 – 11:40 AM',
    title: 'Bunny Heimlich Maneuver',
    presenter: 'Shanleigh Knittel · Operation Obi & HRS Educator',
    description:
      'Something you never want to need — but should be ready for. Walks through the steps and techniques for a choking rabbit.',
  },
  {
    id: 's3',
    start: '11:45',
    time: '11:45 AM – 12:10 PM',
    title: 'To Bond or Not to Bond? An Overwhelming Question!',
    presenter: 'Kim Banks · OHRR Adoption & Bonding Specialist',
    description:
      'Not about the bonding process itself, but the factors to weigh in deciding if and when adding a second bunny is right for your family.',
  },
  {
    id: 's4',
    start: '12:15',
    time: '12:15 – 12:40 PM',
    title: 'Navigating the Human-Animal Bond: Grief, Stress & Support',
    presenter: 'Lauren Keller · Snickerdoodles’ Rabbit Rescue & Pet Loss Support',
    description:
      'Emotional support and resources for caregivers — compassion fatigue, caregiving stress, and the grief that accompanies loss.',
  },
  {
    id: 'break',
    start: '12:40',
    time: '12:40 – 1:30 PM',
    title: 'Break',
    presenter: '',
    description: 'Grab a bite, shop the vendors, and visit the rescue partners.',
    isBreak: true,
  },
  {
    id: 's5',
    start: '13:30',
    time: '1:30 – 1:55 PM',
    title: 'What is Hay?',
    presenter: 'Daniel C. Brenner · Hay Farmer & Educator',
    description:
      'Varieties of hay and how it’s grown and harvested — 1st, 2nd, and 3rd cuttings — plus how to identify good hay for bunnies.',
  },
  {
    id: 's6',
    start: '14:00',
    time: '2:00 – 2:30 PM',
    title: 'Caring for Special Needs Rabbits',
    presenter: 'Lisa Edwards (Bunny Mom) & Dr. Susan Borders, DVM · Animal Hospital of Pataskala',
    description:
      'The challenges and many rewards of caring for bunnies with physical and/or emotional disabilities.',
  },
]
