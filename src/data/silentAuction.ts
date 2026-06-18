// Midwest BunFest silent auction items. The gallery is built to hold the real
// items (with photos and donor credits) ahead of the event — bidding and payment
// happen in person at the auction tables. These are EXAMPLE items with real
// representative photos and donors drawn from BunFest's vendor/sponsor community,
// so the experience looks complete; OHRR swaps in the actual lineup. Item photos
// are credited on the Settings screen.

export const auctionCategories = [
  'Gift Baskets',
  'Toys & Plush',
  'Jewelry & Gifts',
  'Home & Comfort',
  'Art',
  'Apparel',
  'Gift Cards',
] as const

export type AuctionCategory = (typeof auctionCategories)[number]

export interface AuctionItem {
  number: number
  title: string
  category: AuctionCategory
  description: string
  donor: string
  estValue: string
  image?: string // omitted = photo coming
}

export const auctionItems: AuctionItem[] = [
  {
    number: 1,
    title: 'Plush Bunny Bundle',
    category: 'Toys & Plush',
    description: 'A basket of cuddly plush rabbits — soft, huggable, and ready for a new home.',
    donor: 'Fun4Bunnies',
    estValue: '$35',
    image: '/sample-auction/auction-plush.jpg',
  },
  {
    number: 2,
    title: 'Granny-Square Crochet Throw',
    category: 'Home & Comfort',
    description: 'A handmade floral crochet blanket — cozy for you, or a generous bunny.',
    donor: 'Brown Dog Bandanas',
    estValue: '$60',
    image: '/sample-auction/auction-blanket.jpg',
  },
  {
    number: 3,
    title: 'Handmade Beaded Necklace Set',
    category: 'Jewelry & Gifts',
    description: 'Vibrant, hand-strung beaded statement necklaces — one of a kind.',
    donor: 'Bubble & Beam',
    estValue: '$40',
    image: '/sample-auction/auction-jewelry.jpg',
  },
  {
    number: 4,
    title: 'Nautical Canvas Tote',
    category: 'Apparel',
    description: 'A sturdy striped canvas tote — perfect for the farmers market or a hay run.',
    donor: 'Hoppy Bunny Prints',
    estValue: '$25',
    image: '/sample-auction/auction-tote.jpg',
  },
  {
    number: 5,
    title: 'Framed Snow-Rabbit Art Print',
    category: 'Art',
    description: 'A framed fine-art rabbit print to bring a little bunny charm to any wall.',
    donor: 'Art by Lisa Edwards',
    estValue: '$50',
    image: '/sample-auction/auction-art.jpg',
  },
  {
    number: 6,
    title: 'Gourmet Treats Basket',
    category: 'Gift Baskets',
    description: 'A generous basket of fresh fruit and gourmet goodies to share.',
    donor: 'Small Pet Select',
    estValue: '$45',
    image: '/sample-auction/auction-basket.jpg',
  },
  {
    number: 7,
    title: 'Coffee Lover’s Gift Set',
    category: 'Gift Baskets',
    description: 'Freshly roasted beans, a ceramic mug, and the perfect morning pick-me-up.',
    donor: 'An OHRR volunteer',
    estValue: '$30',
    image: '/sample-auction/auction-coffee.jpg',
  },
  {
    number: 8,
    title: 'Oxbow Enrichment Bundle',
    category: 'Toys & Plush',
    description: 'Hay, treats, and enrichment toys to keep a bunny busy and well-fed.',
    donor: 'Oxbow Animal Health',
    estValue: '$50',
  },
  {
    number: 9,
    title: 'Bunny Spa Day Basket',
    category: 'Home & Comfort',
    description: 'Grooming supplies, a snuggle pad, and pampering essentials for a pampered bun.',
    donor: 'Buttercup’s Bunny Boutique',
    estValue: '$35',
  },
  {
    number: 10,
    title: '$50 Hop Shop Gift Card',
    category: 'Gift Cards',
    description: 'Stock up on supplies and OHRR merch — proceeds support the rescue twice over.',
    donor: 'Ohio House Rabbit Rescue',
    estValue: '$50',
  },
]
