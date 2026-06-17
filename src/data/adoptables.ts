// The normalized shape for an adoptable rabbit. The Netlify Petfinder function
// returns this exact shape (see netlify/functions/petfinder.js), and the sample
// rabbits below match it so the Adopt page renders identically with or without a
// live Petfinder connection.

export type Sex = 'Male' | 'Female' | 'Unknown'
export type AgeGroup = 'Baby' | 'Young' | 'Adult' | 'Senior'

export interface Rabbit {
  id: string
  name: string
  status?: string
  sex?: Sex
  age?: AgeGroup
  breed?: string
  size?: string
  coat?: string
  colors?: string[]
  spayedNeutered?: boolean
  houseTrained?: boolean
  specialNeeds?: boolean
  description?: string
  tags?: string[]
  bonded?: boolean
  photo?: string
  photos?: string[]
  url?: string
  publishedAt?: string
}

// Friendly placeholder rabbits shown until OHRR's live Petfinder feed is wired
// up (and as a graceful fallback if the API is ever unreachable). Written to
// look and read like real OHRR listings.
export const sampleRabbits: Rabbit[] = [
  {
    id: 'sample-clover',
    name: 'Clover',
    age: 'Young',
    sex: 'Female',
    breed: 'Mini Lop',
    size: 'Small',
    spayedNeutered: true,
    houseTrained: true,
    tags: ['Friendly', 'Curious', 'Litter-trained'],
    description:
      'Clover is a sweet, people-loving lop who will flop at your feet the moment she trusts you. She is already litter-trained and would do wonderfully as a first rabbit for a gentle home.',
  },
  {
    id: 'sample-basil',
    name: 'Basil',
    age: 'Adult',
    sex: 'Male',
    breed: 'Lionhead mix',
    size: 'Small',
    spayedNeutered: true,
    houseTrained: true,
    tags: ['Mellow', 'Gentle'],
    description:
      'Basil is a laid-back gentleman who loves a good chin rub and an afternoon nap in the sun. He is looking for a calm home where he can be the center of attention.',
  },
  {
    id: 'sample-hazel-juniper',
    name: 'Hazel & Juniper',
    age: 'Adult',
    sex: 'Female',
    breed: 'Dutch',
    size: 'Medium',
    spayedNeutered: true,
    houseTrained: true,
    bonded: true,
    tags: ['Bonded pair', 'Playful'],
    description:
      'Hazel and Juniper are a deeply bonded pair of sisters who must be adopted together. They groom each other constantly and are happiest exploring side by side. Two bunnies, double the binkies.',
  },
  {
    id: 'sample-pip',
    name: 'Pip',
    age: 'Baby',
    sex: 'Male',
    breed: 'Netherland Dwarf',
    size: 'Small',
    spayedNeutered: true,
    tags: ['Energetic', 'Inquisitive'],
    description:
      'Pip is a pint-sized bundle of energy who zooms, binkies, and investigates everything. He would thrive with an experienced bunny family ready for a spirited little personality.',
  },
  {
    id: 'sample-willow',
    name: 'Willow',
    age: 'Senior',
    sex: 'Female',
    breed: 'Rex',
    size: 'Medium',
    spayedNeutered: true,
    houseTrained: true,
    tags: ['Velvet coat', 'Cuddly', 'Senior'],
    description:
      'Willow is a velvety senior girl who has the softest coat you will ever touch. She asks for little more than a quiet corner, a pile of hay, and someone to love her in her golden years.',
  },
  {
    id: 'sample-oreo',
    name: 'Oreo',
    age: 'Adult',
    sex: 'Male',
    breed: 'Dutch',
    size: 'Medium',
    spayedNeutered: true,
    houseTrained: true,
    tags: ['Confident', 'Foodie'],
    description:
      'Oreo is a handsome, confident boy who will let you know exactly when salad is late. He is litter-trained, curious, and would love a home with room to explore and a willing snack provider.',
  },
]
