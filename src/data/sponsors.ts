// Real Midwest BunFest 2025 sponsors & donors (midwestbunfest.org/2025-sponsors).
// OHRR is a nonprofit; BunFest runs on grants and these corporate sponsors.
// Contact details (phone/email/address) were researched from each business's
// public listings on 2026-06-18 so supporters can reach them through the app;
// fields left undefined aren't clearly published (a couple are mobile/online-only).

export type SponsorType = 'Veterinary' | 'Food & Hay' | 'Toys & Treats' | 'Services' | 'Retail'

export interface Sponsor {
  name: string
  type: SponsorType
  blurb: string
  url?: string
  phone?: string
  email?: string
  address?: string
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
    blurb: 'Avian & exotics specialty and 24/7 emergency care for rabbits and pocket pets.',
    url: 'https://www.medvet.com/location/hilliard/',
    phone: '(614) 870-0480',
    address: '4050 Britton Pkwy, Hilliard, OH 43026',
  },
  {
    name: 'Animal Hospital of Pataskala',
    type: 'Veterinary',
    blurb: 'Serving Central Ohio since 1973; rabbit-focused care with Dr. Susan Borders, DVM.',
    url: 'https://www.pataskalavet.com',
    phone: '(740) 927-0196',
    address: '65 S Main St, Pataskala, OH 43062',
  },
  {
    name: 'Animal Care Unlimited',
    type: 'Veterinary',
    blurb: 'AAHA-accredited, Fear Free exotic & traditional pet care in Central Ohio since 1986.',
    url: 'https://www.animalcareunlimited.com',
    phone: '(614) 766-2317',
    address: '2665 Billingsley Rd, Columbus, OH 43235',
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
    url: 'https://www.nortonroadvethospital.com',
    phone: '(614) 870-7008',
    address: '1111 Norton Rd, Galloway, OH 43119',
  },
  {
    name: 'Central Ohio Compounding Pharmacy',
    type: 'Services',
    blurb: 'Custom-compounded medications tailored to animals of all sizes.',
    url: 'https://cocprx.com',
    phone: '(614) 847-0109',
    email: 'customerservice@cocprx.com',
    address: '5625 N. High St., Suite 1, Worthington, OH 43085',
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
    url: 'https://supremepetfoods.us',
  },
  {
    name: 'Small Pet Select',
    type: 'Food & Hay',
    blurb: 'Family-owned, farm-fresh hay, herbal mixes, and handmade organic toys.',
    url: 'https://smallpetselect.com',
  },
  {
    name: 'Farmer Dave Pet Supply',
    type: 'Food & Hay',
    blurb: 'Family farm in western NY — all-natural, pesticide-free hay since 2004.',
    url: 'https://www.farmerdavepetsupply.com',
    phone: '(716) 662-0309',
  },
  {
    name: 'Fun4Bunnies',
    type: 'Toys & Treats',
    blurb: 'Real fruit-and-veggie flavored chew toys — no artificial flavors or sugar.',
    url: 'https://fun4bunnies.com',
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
