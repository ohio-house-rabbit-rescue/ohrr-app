// SAMPLE vendor directory. These are placeholder shops to demonstrate the
// layout — the real lineup is announced closer to the event. Categories match
// the kinds of "specialty shopping" BunFest is known for.

export interface Vendor {
  id: string
  name: string
  category: string
  description: string
}

export const vendorCategories = [
  'Toys & Enrichment',
  'Hay & Forage',
  'Handmade Goods',
  'Treats',
  'Housing',
  'Apparel & Gifts',
  'Art',
] as const

export const vendors: Vendor[] = [
  {
    id: 'v1',
    name: 'Clover & Hay Co. (sample)',
    category: 'Hay & Forage',
    description: 'Small-batch timothy, orchard, and botanical hay blends.',
  },
  {
    id: 'v2',
    name: 'Whisker Woodworks (sample)',
    category: 'Toys & Enrichment',
    description: 'Handmade willow tunnels, chew toys, and foraging puzzles.',
  },
  {
    id: 'v3',
    name: 'The Bunny Boutique (sample)',
    category: 'Apparel & Gifts',
    description: 'Rabbit-themed apparel, enamel pins, and stickers.',
  },
  {
    id: 'v4',
    name: 'Garden Nibbles (sample)',
    category: 'Treats',
    description: 'All-natural, vet-friendly herbal and forage treats.',
  },
  {
    id: 'v5',
    name: 'Free-Range Habitats (sample)',
    category: 'Housing',
    description: 'Modular x-pens, litter setups, and bunny-proofing supplies.',
  },
  {
    id: 'v6',
    name: 'Cottontail Crafts (sample)',
    category: 'Handmade Goods',
    description: 'Hand-sewn beds, mats, and snuggle hideouts.',
  },
  {
    id: 'v7',
    name: 'Hoppy Little Studio (sample)',
    category: 'Art',
    description: 'Custom pet-rabbit portraits and prints.',
  },
  {
    id: 'v8',
    name: 'Meadow Greens (sample)',
    category: 'Hay & Forage',
    description: 'Dried flowers, herbs, and safe greens for enrichment.',
  },
]
