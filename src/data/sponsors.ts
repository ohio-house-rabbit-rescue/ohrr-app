// Real Midwest BunFest 2025 sponsors & donors (midwestbunfest.org/2025-sponsors).
// OHRR is a nonprofit; BunFest runs on grants and these corporate sponsors.
// Only URLs explicitly listed on the site are included.

export type SponsorType = 'Veterinary' | 'Food & Hay' | 'Toys & Treats' | 'Services' | 'Retail'

export interface Sponsor {
  name: string
  type: SponsorType
  blurb: string
  url?: string
  lead?: boolean
}

export const sponsors: Sponsor[] = [
  {
    name: 'Oxbow Animal Health',
    type: 'Food & Hay',
    blurb: 'Lead Sponsor — 30+ years of quality food, hay, and treats for small pets.',
    url: 'https://www.oxbowanimalhealth.com',
    lead: true,
  },
  {
    name: 'MedVet Hilliard',
    type: 'Veterinary',
    blurb: 'Avian & exotics specialty and emergency care for rabbits and pocket pets.',
    url: 'https://www.medvet.com/location/medvet-hilliard',
  },
  {
    name: 'Animal Hospital of Pataskala',
    type: 'Veterinary',
    blurb: 'Serving Central Ohio since 1973; rabbit-focused care with Dr. Susan Borders, DVM.',
    url: 'https://www.pataskalavet.com',
  },
  {
    name: 'Animal Care Unlimited',
    type: 'Veterinary',
    blurb: 'AAHA-accredited, Fear Free exotic & traditional pet care in Central Ohio since 1986.',
  },
  {
    name: 'Borders Veterinary Services',
    type: 'Veterinary',
    blurb: 'Mobile, exotic-only wellness practice; RHDV vaccine clinics for rabbits.',
  },
  {
    name: 'Norton Road Veterinary Hospital',
    type: 'Veterinary',
    blurb: 'Galloway, OH practice providing rabbit dental, surgery, and the RHDV2 vaccine.',
  },
  {
    name: 'Central Ohio Compounding Pharmacy',
    type: 'Services',
    blurb: 'Custom-compounded medications tailored to animals of all sizes.',
  },
  {
    name: 'Ignyte Financial',
    type: 'Services',
    blurb: 'Financial advising from a longtime rabbit-rescue supporter.',
  },
  {
    name: 'Supreme Pet Foods',
    type: 'Food & Hay',
    blurb: 'Science Selective rabbit food, vet-recommended for every life stage.',
  },
  {
    name: 'Small Pet Select',
    type: 'Food & Hay',
    blurb: 'Family-owned, farm-fresh hay, herbal mixes, and handmade organic toys.',
  },
  {
    name: 'Farmer Dave Pet Supply',
    type: 'Food & Hay',
    blurb: 'Family farm in western NY — all-natural, pesticide-free hay since 2004.',
  },
  {
    name: 'Fun4Bunnies',
    type: 'Toys & Treats',
    blurb: 'Real fruit-and-veggie flavored chew toys — no artificial flavors or sugar.',
  },
  {
    name: 'Buttercup’s Bunny Boutique',
    type: 'Toys & Treats',
    blurb: 'Handmade hay-centric toys and organic dried-fruit treats from San Diego.',
    url: 'https://www.buttercupsbunnyboutique.com',
  },
  {
    name: 'BunnySlippers.com',
    type: 'Retail',
    blurb: 'The internet’s favorite bunny, animal, and novelty slippers — 15+ years.',
    url: 'https://www.bunnyslippers.com',
  },
]
