// The OHRR Hop Shop — rabbit supplies & merch sold at the adoption center and at
// Midwest BunFest, with proceeds funding the rescue. This is EXAMPLE inventory
// (real, typical rabbit products — not made-up) so the browse experience looks
// live; OHRR's actual stock will populate this once items are added by staff
// (the planned scan-a-product / set-quantity tool). The app is browse-only —
// people see what's available, then buy in person.

export const hopShopCategories = [
  'Hay & Food',
  'Toys & Enrichment',
  'Comfort & Litter',
  'Apparel & Gifts',
] as const

export type HopShopCategory = (typeof hopShopCategories)[number]
export type StockStatus = 'In stock' | 'Low stock'

export interface HopShopItem {
  id: string
  name: string
  category: HopShopCategory
  price: string
  blurb: string
  stock: StockStatus
}

export const hopShopItems: HopShopItem[] = [
  // Hay & Food
  { id: 'h1', name: 'Timothy Hay — 1 lb', category: 'Hay & Food', price: '$8', blurb: 'First-cut timothy, the everyday staple that keeps the gut moving.', stock: 'In stock' },
  { id: 'h2', name: 'Orchard Grass Hay — 1 lb', category: 'Hay & Food', price: '$8', blurb: 'A softer, sweeter grass hay — a favorite for picky eaters.', stock: 'In stock' },
  { id: 'h3', name: 'Timothy-Based Adult Pellets — 2.5 lb', category: 'Hay & Food', price: '$12', blurb: 'Plain, vet-recommended pellets in moderation — no seeds or colorful bits.', stock: 'In stock' },
  { id: 'h4', name: 'Herbal Forage Mix', category: 'Hay & Food', price: '$6', blurb: 'Dried herbs and flowers to scatter for natural foraging.', stock: 'Low stock' },

  // Toys & Enrichment
  { id: 't1', name: 'Willow Ball', category: 'Toys & Enrichment', price: '$4', blurb: 'A natural willow chew that satisfies the urge to gnaw.', stock: 'In stock' },
  { id: 't2', name: 'Seagrass Mat', category: 'Toys & Enrichment', price: '$6', blurb: 'Woven mat for digging and shredding — saves your carpet.', stock: 'In stock' },
  { id: 't3', name: 'Apple Stick Bundle', category: 'Toys & Enrichment', price: '$5', blurb: 'Safe, untreated orchard sticks for chewing and play.', stock: 'In stock' },
  { id: 't4', name: 'Snuffle Foraging Mat', category: 'Toys & Enrichment', price: '$16', blurb: 'Hide pellets and greens in the folds for mealtime enrichment.', stock: 'Low stock' },

  // Comfort & Litter
  { id: 'c1', name: 'Cottontail Cottage Hideaway', category: 'Comfort & Litter', price: '$18', blurb: 'A foldable cardboard house — a cozy place to feel secure.', stock: 'In stock' },
  { id: 'c2', name: 'Paper-Based Litter — 10 L', category: 'Comfort & Litter', price: '$12', blurb: 'Dust-free and rabbit-safe — no clay or pine.', stock: 'In stock' },
  { id: 'c3', name: 'Fleece Snuggle Pad', category: 'Comfort & Litter', price: '$14', blurb: 'Soft, washable resting mat for free-roam spaces.', stock: 'In stock' },
  { id: 'c4', name: 'Corner Litter Box', category: 'Comfort & Litter', price: '$10', blurb: 'Fits neatly into a pen corner where bunnies like to go.', stock: 'Low stock' },

  // Apparel & Gifts
  { id: 'a1', name: 'OHRR Logo T-Shirt', category: 'Apparel & Gifts', price: '$20', blurb: 'Soft cotton tee — every purchase funds rescue and vet care.', stock: 'In stock' },
  { id: 'a2', name: '“Adopt Don’t Shop” Tote Bag', category: 'Apparel & Gifts', price: '$15', blurb: 'Roomy canvas tote for the farmers market or the hay run.', stock: 'In stock' },
  { id: 'a3', name: 'Midwest BunFest Mug', category: 'Apparel & Gifts', price: '$12', blurb: 'Ceramic mug featuring the BunFest artwork.', stock: 'In stock' },
  { id: 'a4', name: 'Enamel Bunny Pin', category: 'Apparel & Gifts', price: '$8', blurb: 'A little flair for your bag or jacket — and a big help.', stock: 'Low stock' },
]
