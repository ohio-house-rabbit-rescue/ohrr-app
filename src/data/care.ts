// Native rabbit-care content for the in-app Learn section. This is standard,
// conservative guidance (aligned with House Rabbit Society / OHRR practice) so
// owners don't have to leave the app — OHRR can edit any of it. Medical points
// always defer to a rabbit-savvy vet.
import type { IconName } from '../components/icons'
import { ohrr } from './ohrr'

export const CARE_DISCLAIMER =
  'General guidance to get you started — always consult a rabbit-savvy vet for medical concerns. OHRR can tailor this content anytime.'

export interface CareSection {
  heading?: string
  body?: string
  list?: string[]
}

export interface CareTopic {
  id: string
  title: string
  icon: IconName
  summary: string
  sections: CareSection[]
  tip?: string
  cta?: { label: string; to: string }
  link?: { label: string; url: string }
}

export const careTopics: CareTopic[] = [
  {
    id: 'diet',
    title: 'Bunny Diet',
    icon: 'book',
    summary: 'Hay first, fresh greens daily, pellets in moderation.',
    sections: [
      {
        heading: 'Hay is ~80% of the diet',
        body: 'Unlimited fresh grass hay — timothy, orchard, or meadow — should always be available. It keeps the gut moving and wears down constantly-growing teeth. Young rabbits under about 7 months can have alfalfa; switch to grass hay after that.',
      },
      {
        heading: 'Fresh greens every day',
        body: 'Offer a variety of leafy greens daily — roughly one packed cup per 2 lbs of body weight. Good picks include romaine, green and red leaf lettuce, cilantro, parsley, basil, and dandelion greens.',
      },
      {
        heading: 'Pellets in moderation',
        body: 'A small amount of plain, timothy-based pellets — about ¼ cup per 5 lbs of adult rabbit per day. Skip mixes with seeds, nuts, or colorful bits.',
      },
      {
        heading: 'Water & treats',
        body: 'Fresh water should always be available (many rabbits drink more easily from a bowl). Treats like a thin slice of banana or a few blueberries are fine in tiny amounts — occasional, not daily.',
      },
    ],
    tip: 'A rabbit that stops eating hay or producing droppings needs a vet right away — it can signal GI stasis.',
  },
  {
    id: 'housing',
    title: 'Living Space',
    icon: 'home',
    summary: 'Indoors, roomy, and bunny-proofed.',
    sections: [
      {
        heading: 'Indoors, always',
        body: 'House rabbits live inside as part of the family. The outdoors exposes them to predators, parasites, extreme temperatures, and isolation. They thrive in a climate-controlled home.',
      },
      {
        heading: 'Room to move',
        body: 'Give at least a 4 ft × 4 ft pen — no cramped cages — plus several hours of supervised exercise daily, or let them free-roam a bunny-proofed room. Avoid wire flooring, which hurts their feet.',
      },
      {
        heading: 'Bunny-proofing',
        body: 'Rabbits chew and dig. Cover or raise electrical cords, block tight gaps, and keep houseplants and baseboards out of reach. Offer safe chew toys and a hidey house to satisfy those instincts.',
      },
      {
        heading: 'The basic setup',
        body: 'A litter box, unlimited hay (often placed right by the box), water, a place to hide, and a few toys cover the essentials.',
      },
    ],
  },
  {
    id: 'foods-to-avoid',
    title: 'Foods to Avoid',
    icon: 'info',
    summary: 'Some foods are unsafe — keep these away from your bunny.',
    sections: [
      {
        heading: 'Never feed',
        list: [
          'Chocolate, candy, or anything sugary',
          'Avocado',
          'Onions, garlic, and leeks',
          'Rhubarb and raw potato',
          'Seeds, pits, and most nuts',
          'Bread, crackers, cereal, and pasta',
          'Meat, eggs, or dairy (including yogurt drops)',
          'Iceberg lettuce — little nutrition and can cause digestive upset',
        ],
      },
      {
        heading: 'Go easy on',
        body: 'Sugary fruit and starchy vegetables (including carrots) are treats, not staples — tiny amounts only. Introduce any new green slowly and watch for soft stool.',
      },
    ],
    tip: 'When in doubt, leave it out — a rabbit’s gut is sensitive. Stick to hay and tested greens.',
  },
  {
    id: 'litter',
    title: 'Litter Training',
    icon: 'sparkles',
    summary: 'Most rabbits litter-train surprisingly easily.',
    sections: [
      {
        heading: 'Work with their instincts',
        body: 'Rabbits naturally pick one corner as a bathroom. Put a litter box there, and many will use it reliably within days.',
      },
      {
        heading: 'Use safe litter',
        body: 'Choose paper-based or aspen litter. Avoid clumping or clay cat litter, and cedar or pine shavings — they can harm a rabbit’s lungs and liver.',
      },
      {
        heading: 'Hay by the box',
        body: 'Rabbits like to munch while they go, so placing hay over or beside the box encourages good habits.',
      },
      {
        heading: 'Spay / neuter helps',
        body: 'Fixed rabbits are far more consistent with the litter box and far less likely to mark territory.',
      },
    ],
  },
  {
    id: 'bonding',
    title: 'Bonding',
    icon: 'users',
    summary: 'Rabbits are social — but introductions take patience.',
    sections: [
      {
        heading: 'Why bond',
        body: 'Rabbits are happiest with a companion. A bonded pair grooms, plays, and snuggles together, and keeps each other company while you’re away.',
      },
      {
        heading: 'Go slow, on neutral ground',
        body: 'Introduce rabbits gradually in a space neither one already “owns.” Both should be spayed or neutered first. Never force them together — bonding can take days or weeks.',
      },
      {
        heading: 'Get expert help',
        body: 'OHRR runs guided bonding sessions to make introductions safe and successful.',
      },
    ],
    cta: { label: 'Book a bonding session', to: '/services' },
  },
  {
    id: 'health',
    title: 'Health & Vets',
    icon: 'heart',
    summary: 'Rabbits hide illness — know the warning signs.',
    sections: [
      {
        heading: 'Find a rabbit-savvy vet',
        body: 'Rabbits are exotic pets and not every clinic treats them. Establish care with an experienced rabbit vet before there’s ever an emergency.',
      },
      {
        heading: 'Spay / neuter',
        body: 'Spaying and neutering prevents reproductive cancers (very common in unspayed females), curbs hormonal behavior, and improves litter habits. Every OHRR rabbit is already fixed.',
      },
      {
        heading: 'Watch for trouble',
        list: [
          'Not eating or drinking for 12+ hours',
          'Few or no droppings',
          'Lethargy or a hunched posture',
          'Head tilt or labored breathing',
        ],
      },
    ],
    tip: 'Not eating plus not pooping can mean GI stasis — a life-threatening emergency. Call a vet immediately; don’t wait.',
    link: { label: 'OHRR’s recommended rabbit vets', url: ohrr.links.vets },
  },
  {
    id: 'stray',
    title: 'Caught a Stray?',
    icon: 'mappin',
    summary: 'Found a rabbit outside? It almost certainly needs help.',
    sections: [
      {
        heading: 'Domestic rabbits can’t survive outdoors',
        body: 'A friendly or colorful rabbit found outside is almost always a lost or dumped pet. They have no defenses against predators, weather, or traffic.',
      },
      {
        heading: 'Catch it safely',
        body: 'Approach calmly and low. Lure them toward a carrier with greens like cilantro or parsley, or gently cover them with a towel. Then contain them somewhere quiet and safe.',
      },
      {
        heading: 'What to do next',
        body: 'Look for an owner (post locally, and have a vet scan for a microchip), and contact OHRR or a local rabbit rescue for guidance and intake.',
      },
    ],
  },
]
