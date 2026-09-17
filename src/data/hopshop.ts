// The OHRR Hop Shop — rabbit supplies & merch sold at the Adoption Center (and
// at the Hop Shop table at Midwest BunFest), with profits supporting OHRR.
// Verbatim from https://www.ohiohouserabbitrescue.org/hop-shop/ (captured
// 2026-09-17). The public screen shows this product list; when OHRR's live
// inventory (hopshop_products) is readable it shows "In the shop now" too.

export const hopShopIntro =
  'Did you know OHRR has their very own Hop Shop where you can purchase food, supplies, and toys? The Hop Shop is located at the OHRR Adoption Center and is open during adoption center hours. Not only will you be able to purchase healthy and safe products for your bunny, but the profits go to support OHRR!'

export interface HopShopProduct {
  name: string
  /** short, from OHRR's care content — what it's for */
  note?: string
}

export const hopShopProducts: HopShopProduct[] = [
  { name: 'Pellets', note: 'Limited, high-quality timothy pellets — OHRR’s approved brands.' },
  { name: 'Hay', note: 'Unlimited grass hay is the most important part of a bunny’s diet.' },
  { name: 'Litter', note: 'Paper-based and other bunny-safe litters.' },
  { name: 'Hidey Houses', note: 'Cottontail Cottages and Maze Havens — every OHRR bunny has one.' },
  { name: 'Treats' },
  { name: 'Supplements' },
  { name: 'Critical Care' },
  { name: 'Bunny-safe Toys', note: 'Willow, grass mats, and chews without nuts, seeds or corn.' },
  { name: 'Grooming Brushes' },
  { name: 'Bunny-related apparel, accessories, art' },
  { name: '… and more!' },
]

export const hopShopPurchaseNote =
  'Purchases happen in person at the Adoption Center — the app is for browsing.'
