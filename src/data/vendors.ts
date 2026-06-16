// Real Midwest BunFest 2025 vendors (midwestbunfest.org/2025-vendors).
// Specialty rabbit goods you won't find in local pet stores.

export interface Vendor {
  id: string
  name: string
  category: string
  description: string
  url?: string
}

export const vendorCategories = [
  'Art',
  'Jewelry & Gifts',
  'Toys & Enrichment',
  'Beds & Comfort',
  'Treats & Food',
  'Home & Apparel',
] as const

export const vendors: Vendor[] = [
  { id: 'v1', name: 'Art by Lisa Edwards', category: 'Art', description: 'One-of-a-kind 2D mixed-media bunny art; 100% of sales donated to OHRR & CHRS.', url: 'https://www.instagram.com/artbylisamedwards' },
  { id: 'v2', name: 'Bowie’s Snuffle Buddies', category: 'Toys & Enrichment', description: 'Snuffle balls and mats for foraging, mental stimulation, and enrichment.', url: 'https://bowiesbuddies.etsy.com' },
  { id: 'v3', name: 'Brown Dog Bandanas', category: 'Beds & Comfort', description: 'Fleece snuggle pouches, hay bags, cage pads, and rabbit-themed items.', url: 'https://www.facebook.com/browndogbandanas' },
  { id: 'v4', name: 'Bubble & Beam', category: 'Jewelry & Gifts', description: 'Quirky acrylic jewelry, vinyl stickers, and small gifts — lots of bunnies.', url: 'https://www.bubbleandbeam.com' },
  { id: 'v5', name: 'Bunny Brook Designs', category: 'Jewelry & Gifts', description: 'Handmade bunny-themed jewelry, home decor, and ornaments. 20% to CHRS.', url: 'https://bunnybrookdesigns.com' },
  { id: 'v6', name: 'Bunny Beds and Beyond', category: 'Beds & Comfort', description: 'Custom handmade comfort items for your pampered house rabbit.', url: 'https://www.bunnybedsbeyond.com' },
  { id: 'v7', name: 'Charlie Foxtrot Laser Engraving', category: 'Jewelry & Gifts', description: 'Custom laser-engraved gifts on wood, steel, glass, and leather.', url: 'https://www.facebook.com/CharlieFoxtrotLaserEngraving' },
  { id: 'v8', name: 'Crafty Mermaid Sara’s Bunny Boutique', category: 'Toys & Enrichment', description: 'Lounger beds, foraging mats, hay-feeder bags, and wood enrichment toys.', url: 'https://CraftyMermaidSara.etsy.com' },
  { id: 'v9', name: 'Em’s Cozy Embroidery', category: 'Jewelry & Gifts', description: 'Hand-embroidered decor and jewelry — bunny butts, silhouettes, and more.', url: 'https://www.etsy.com/shop/EmsCozyEmbroidery' },
  { id: 'v10', name: 'Essence of Beauty', category: 'Jewelry & Gifts', description: 'SeneGence cosmetics; profits fund the Hippity Hop rabbit-health Fund.', url: 'https://www.facebook.com/groups/essenceofbeauty4bunnies' },
  { id: 'v11', name: 'Evil Twin Arts', category: 'Home & Apparel', description: 'High-fired pottery for bunnies and people — mugs, bowls, ornaments.', url: 'https://www.etsy.com/shop/eviltwinarts' },
  { id: 'v12', name: 'Firefly Frippery', category: 'Jewelry & Gifts', description: 'Handcrafted clay jewelry, figurines, charms, keyrings, and magnets.', url: 'https://www.fireflyfrippery.com' },
  { id: 'v13', name: 'Fuzsbunnyboutique', category: 'Toys & Enrichment', description: 'Handmade all-natural foraging toys, seagrass mats, and wooden toys.' },
  { id: 'v14', name: 'Hoppy Bunny Prints', category: 'Home & Apparel', description: 'Bunny totes, stickers, magnets, and the Bunny Care Kit — designed this year’s MWBF logo.', url: 'https://www.etsy.com/shop/hoppybunnyprints' },
  { id: 'v15', name: 'Katie’s Willow Wreaths', category: 'Treats & Food', description: 'High-quality willow wreaths and chew treats; gives back to rescues.', url: 'https://katieswillowwreath.etsy.com' },
  { id: 'v16', name: 'Lucia Landry Glass', category: 'Art', description: 'Hand-blown glass sculptures — including glass “adoptable” bunnies.', url: 'https://www.instagram.com/lucialandry.glass' },
  { id: 'v17', name: 'Mairzy Doats Designs', category: 'Art', description: 'Hand-painted bunny-themed rocks and homemade cards; commissions welcome.' },
  { id: 'v18', name: 'Major’s Mark', category: 'Jewelry & Gifts', description: 'Personalized keepsakes full of humor and heart for pets and milestones.' },
  { id: 'v19', name: 'Punkin’s Patch', category: 'Home & Apparel', description: 'Sewn tote bags, purses, wristlets, pouches, and bowl cozies.' },
  { id: 'v20', name: 'Regarding Comic', category: 'Home & Apparel', description: 'Comic art of three furry roommates on cards, mugs, bags, and more.', url: 'https://www.sammys.club' },
  { id: 'v21', name: 'Rosie’s Treasures', category: 'Home & Apparel', description: 'Handmade tees, glassware, and fleece blankets; 20% to Operation Obi.' },
  { id: 'v22', name: 'Sherwood Pet Health', category: 'Treats & Food', description: 'Soy/grain-free rabbit food and nutrition products, research-backed.' },
  { id: 'v23', name: 'Stitches Abound', category: 'Home & Apparel', description: 'Cozy decor — dream catchers, bottle lanterns, shadow boxes, and cards.', url: 'https://instagram.com/stitchesabound' },
  { id: 'v24', name: 'The Bun Buddies', category: 'Jewelry & Gifts', description: 'Homemade figurines, keychains, and stickers; donates to OHRR & CHRS.', url: 'https://thebunbuddies.square.site' },
  { id: 'v25', name: 'The Cozy Carrot', category: 'Beds & Comfort', description: 'Bunny Snoozer beds, waterproof covers, mats, and forage mixes.', url: 'https://cozy-carrot.com' },
  { id: 'v26', name: 'The Healthy Hare', category: 'Treats & Food', description: 'All-natural, organic, small-batch treats from Cleveland, OH.', url: 'https://thehealthyhare.etsy.com' },
  { id: 'v27', name: 'Woolly Bunny Arts', category: 'Art', description: 'Handmade needle-felted gifts, ornaments, and mobiles.' },
]
