// Built-in Bunny Help topics — the silent fallback when the `care_topics` table
// is missing or empty, and the source of the seed rows in
// supabase/migrations/20260917140000_care_topics.sql (generated from this file
// by scripts/bunnyhelp-seed-sql.ts, so the two never drift).
//
// CONTENT RULES: every topic is drawn only from OHRR's live-site care guides
// (https://ohiohouserabbitrescue.org/rabbit-care/resources/ and the articles it
// links, including the House Rabbit Society page it cites) plus the emergency
// warning signs the app's emergency card already carries. Health red flags say
// only "call a rabbit-savvy vet" — no other medical guidance is written here.
// `source` documents where each topic came from; it is not stored in the table.
//
// reviewed_by / reviewed_at are deliberately NULL on every seed: the UI shows
// "Not yet vet-reviewed" on health topics until OHRR staff fill those in.

import type { CareTopic, TopicCategory, TopicUrgency } from './types'

export interface SeedTopic {
  slug: string
  title: string
  aliases: string[]
  category: TopicCategory
  urgency: TopicUrgency
  summary: string
  what_to_do: string
  article_slug: string | null
  show_vets: boolean
  hopshop_note: string | null
  /** Where this came from (documentation only). */
  source: string
}

const EMERGENCY_LINE =
  'Call a rabbit-savvy vet right away.\n\nAfter hours: MedVet Hilliard, 614-870-0480 — open 24/7 for exotics emergencies.'

const RED_FLAGS_SOURCE = 'Emergency warning signs (OHRR app emergency card)'
const TOP_TEN = 'OHRR — Top Ten Tips for New Bunny Owners (ohiohouserabbitrescue.org/top_ten_tips_for_new_bunny_parents/)'
const LITTER_GUIDE =
  'OHRR — Wait, Bunnies Can Be Litter Box Trained? (ohiohouserabbitrescue.org/litterbox/)'
const SPS_LITTER =
  'Small Pet Select — Help… My Rabbit Stopped Using the Litter Box! (linked from OHRR’s resources page)'
const DIG_CHEW =
  'OHRR — Staying Friends with your Bunny: How to Deal with Bunnies that Dig and Chew (ohiohouserabbitrescue.org/diggingandchewing/)'
const BONDING =
  'OHRR — The Art of Bunny Dating: Tips for Bonding Bunnies (ohiohouserabbitrescue.org/bondingbunnies/)'
const SPAY = 'OHRR — Spay/Neuter: It’s More than Population Control (ohiohouserabbitrescue.org/spayneuter/)'
const DIET_ARTICLE =
  'OHRR — Timothy? Alfalfa? What You Should Know About Your Bunny’s Diet! (ohiohouserabbitrescue.org/bunnydiet/)'
const DIET_PAGE = 'OHRR — Bunny Diet (ohiohouserabbitrescue.org/i-want-to-learn/bunny-diet/)'
const HRS_VEG =
  'House Rabbit Society — Suggested Vegetables and Fruits for a Rabbit Diet (rabbit.org, linked from OHRR’s resources page)'
const FOODS_AVOID = 'OHRR — Foods to Avoid (ohiohouserabbitrescue.org/i-want-to-learn/foods-to-avoid/)'
const DIY_TOYS = 'OHRR — Do-it-Yourself Bunny Toys (ohiohouserabbitrescue.org/diy-bunny-toys/)'
const SERVICES = 'OHRR Bunny Services as listed in this app (vet clinic days, bonding sessions)'

export const SEED_TOPICS: readonly SeedTopic[] = [
  /* ------------------------------------------------ health red flags */
  {
    slug: 'not-eating',
    title: 'Not eating, or not pooping',
    aliases: [
      'not eating',
      'won’t eat',
      'wont eat',
      'stopped eating',
      'refusing food',
      'off food',
      'no poop',
      'not pooping',
      'no droppings',
      'hasn’t pooped',
      'tiny poops',
      'GI stasis',
      'stasis',
      'bloat',
    ],
    category: 'health',
    urgency: 'emergency',
    summary: 'Not eating, or no poops, for around 12 hours can be life-threatening for a rabbit.',
    what_to_do: `${EMERGENCY_LINE}\n\nOHRR’s Top Ten Tips ask every owner to read up on GI stasis and bloat and to have an emergency plan ready before it’s needed.`,
    article_slug: 'health',
    show_vets: true,
    hopshop_note: null,
    source: `${RED_FLAGS_SOURCE}; ${TOP_TEN} (#9)`,
  },
  {
    slug: 'lethargic',
    title: 'Lethargic, or hiding more than usual',
    aliases: [
      'lethargic',
      'tired',
      'hiding',
      'listless',
      'not moving much',
      'quiet',
      'won’t come out',
      'sleeping a lot',
      'not himself',
      'not herself',
      'acting off',
      'sad',
    ],
    category: 'health',
    urgency: 'vet-today',
    summary: 'Lethargy or hiding is a warning sign rabbit-savvy vets ask owners to act on quickly.',
    what_to_do:
      'Call a rabbit-savvy vet today and describe what you’re seeing.\n\nIf your rabbit is also not eating or not pooping, treat it as an emergency: MedVet Hilliard, 614-870-0480, is open 24/7 for exotics emergencies.',
    article_slug: 'health',
    show_vets: true,
    hopshop_note: null,
    source: RED_FLAGS_SOURCE,
  },
  {
    slug: 'breathing',
    title: 'Laboured or open-mouth breathing',
    aliases: [
      'breathing hard',
      'open mouth breathing',
      'mouth breathing',
      'wheezing',
      'gasping',
      'panting',
      'struggling to breathe',
      'noisy breathing',
      'can’t breathe',
    ],
    category: 'health',
    urgency: 'emergency',
    summary: 'Laboured or open-mouth breathing can be life-threatening for rabbits.',
    what_to_do: EMERGENCY_LINE,
    article_slug: 'health',
    show_vets: true,
    hopshop_note: null,
    source: RED_FLAGS_SOURCE,
  },
  {
    slug: 'head-tilt',
    title: 'Head tilt',
    aliases: ['head tilt', 'tilted head', 'head is tilted', 'losing balance', 'falling over', 'rolling', 'wobbly'],
    category: 'health',
    urgency: 'vet-today',
    summary: 'A head tilt is a warning sign to act on the same day.',
    what_to_do:
      'Call a rabbit-savvy vet today.\n\nIf your rabbit can’t stay upright or isn’t eating, don’t wait: MedVet Hilliard, 614-870-0480, is open 24/7 for exotics emergencies.',
    article_slug: 'health',
    show_vets: true,
    hopshop_note: null,
    source: RED_FLAGS_SOURCE,
  },
  {
    slug: 'bleeding',
    title: 'Bleeding',
    aliases: ['bleeding', 'blood', 'cut', 'wound', 'injured', 'injury', 'bitten', 'attacked'],
    category: 'health',
    urgency: 'emergency',
    summary: 'Bleeding is an emergency for rabbits.',
    what_to_do: EMERGENCY_LINE,
    article_slug: 'health',
    show_vets: true,
    hopshop_note: null,
    source: RED_FLAGS_SOURCE,
  },
  {
    slug: 'cant-move',
    title: 'Unable to move, or dragging the back legs',
    aliases: [
      'can’t move',
      'cant move',
      'not moving',
      'paralysed',
      'paralyzed',
      'dragging legs',
      'back legs not working',
      'collapsed',
      'limp',
      'fell',
      'dropped',
    ],
    category: 'health',
    urgency: 'emergency',
    summary: 'A rabbit that can’t move needs a vet immediately.',
    what_to_do: EMERGENCY_LINE,
    article_slug: 'health',
    show_vets: true,
    hopshop_note: null,
    source: RED_FLAGS_SOURCE,
  },
  {
    slug: 'soft-stools',
    title: 'Diarrhea or very soft stools',
    aliases: [
      'diarrhea',
      'diarrhoea',
      'runny poop',
      'soft poop',
      'mushy poop',
      'loose stools',
      'watery poop',
      'messy bottom',
      'poopy butt',
      'sticky poop',
    ],
    category: 'health',
    urgency: 'vet-today',
    summary: 'Very soft or watery stools are a warning sign; OHRR says to act on loose stools right away.',
    what_to_do:
      'Call a rabbit-savvy vet today. After hours: MedVet Hilliard, 614-870-0480 — open 24/7 for exotics emergencies.\n\nOHRR’s Foods to Avoid guide: remove any food that causes loose or mushy stools from the diet immediately.',
    article_slug: 'health',
    show_vets: true,
    hopshop_note: null,
    source: `${RED_FLAGS_SOURCE}; ${FOODS_AVOID}`,
  },

  /* ------------------------------------------------------- litter box */
  {
    slug: 'litter-box-stopped',
    title: 'Stopped using the litter box',
    aliases: [
      'not using litter box',
      'stopped using litter box',
      'peeing outside the box',
      'peeing everywhere',
      'pooping everywhere',
      'poop everywhere',
      'accidents',
      'peeing on the couch',
      'peeing on the bed',
      'litter box problems',
      'marking',
      'poops outside box',
    ],
    category: 'litter',
    urgency: 'watch',
    summary:
      'A change in litter habits usually has a reason — hormones, a change at home, the box itself, age, or something a vet should check.',
    what_to_do: `## First, rule out a health cause
OHRR’s litter box guide says a sudden change in habits — especially after spay/neuter — is worth a vet visit to rule out a urinary tract infection or bladder problem. If the change is sudden, or your rabbit seems unwell, call a rabbit-savvy vet.

## Common reasons OHRR and its resources list
- Not spayed or neutered yet: hormones drive marking. Spay/neuter is the first step to reliable litter habits.
- Something changed: a move, a new pet or person, a new routine. Rabbits mark territory when their world shifts.
- The box changed: a new litter brand, a moved box, or a box that isn’t cleaned as often. Make any change gradually.
- Age: young rabbits have less control; adolescents (about 4–6 months) mark; older rabbits may need a box with lower sides.

## Retraining
- Put hay in one half of the box — rabbits like to eat while they go.
- Move the box to where the accidents happen, and add a second box if needed.
- Confine to a smaller space (OHRR suggests a 4×4 pen) and expand it gradually as habits improve.
- Clean the box at least every other day with vinegar, baking soda, or an animal-safe cleaner.
- A few poops outside the box is normal territory-marking, not a training failure.`,
    article_slug: 'litter',
    show_vets: true,
    hopshop_note: 'Litter and hay for the box — see what the Hop Shop has.',
    source: `${LITTER_GUIDE}; ${SPS_LITTER}`,
  },
  {
    slug: 'litter-training',
    title: 'Litter training a bunny',
    aliases: [
      'litter train',
      'litter training',
      'how to litter box train',
      'litter box setup',
      'which litter',
      'what litter is safe',
      'cedar',
      'pine',
      'clumping litter',
      'hay in litter box',
    ],
    category: 'litter',
    urgency: 'tip',
    summary: 'Rabbits naturally pick one spot — with the right box and litter, most learn quickly.',
    what_to_do: `## The box
- A plastic cat litter box that fits inside a 4×4 pen works well. A low storage tub or dog-crate tray suits older rabbits with achy joints.
- Fill one half with litter and the other half with hay — bunnies like to eat while they go, and it encourages hay eating. Refill the hay daily.

## Safe litter
- Paper-based litter (such as CareFresh) or shredded newspaper; kiln-dried pine or aspen pellets.
- Avoid clumping litter, clay, cedar, non-kiln-dried softwoods, and corncob — they can be breathed in or eaten.

## Training
- Spay/neuter first — it makes the biggest difference.
- Start in a confined 4×4 space; put the box where your rabbit chooses to go.
- Expand the space gradually as habits hold. Praise successes; a firm ‘No’ only if you catch an accident in progress.
- Clean at least every other day with vinegar, baking soda, or an animal-safe cleaner.`,
    article_slug: 'litter',
    show_vets: false,
    hopshop_note: 'Paper-based litter and hay — check the Hop Shop.',
    source: `${LITTER_GUIDE}; ${TOP_TEN} (#6)`,
  },

  /* -------------------------------------------------------- behaviour */
  {
    slug: 'digging-chewing',
    title: 'Digging and chewing',
    aliases: [
      'chewing',
      'digging',
      'chewing cords',
      'chewing wires',
      'chewing baseboards',
      'digging carpet',
      'destroying carpet',
      'chewing furniture',
      'destructive',
      'eating the wall',
      'chewing everything',
      'chews',
      'digs',
    ],
    category: 'behavior',
    urgency: 'tip',
    summary: 'Chewing and digging are natural — the goal is to redirect them, not stop them.',
    what_to_do: `OHRR’s guide has three steps: teach what’s allowed, block the temptations, and give approved outlets.

## Bunny-proofing
- Baseboards sit right at nose level — cover them with wooden boards or plastic guards.
- Wires: move them out of reach, block access, or run them through protective tubing.
- Carpet: tightly woven carpet resists damage better than shag; an area rug is easier to replace. Corners get dug most — a litter box in the corner can help.
- Furniture: protect legs and cushions, and block the space underneath.

## Approved outlets
- Cardboard boxes, stuffed toilet-paper and paper-towel rolls, a box of shredded paper or play sand for digging.
- Willow or twig chews (pesticide-free, non-toxic only) and small-animal toys.

## Teaching
- Speak bunny: a clap or a thump redirects attention, then offer an approved toy right at their nose.
- Supervise until the boundaries stick. Spay/neuter also reduces destructive chewing and digging, per OHRR’s spay/neuter guide.`,
    article_slug: 'housing',
    show_vets: false,
    hopshop_note: 'Chew toys and hay — see the Hop Shop.',
    source: `${DIG_CHEW}; ${SPAY}`,
  },
  {
    slug: 'spraying-mounting',
    title: 'Spraying, mounting, or aggression',
    aliases: [
      'spraying',
      'spraying urine',
      'spray',
      'mounting',
      'humping',
      'aggressive',
      'aggression',
      'lunging',
      'biting me',
      'bites',
      'grunting',
      'boxing',
      'territorial',
      'cage aggressive',
      'circling my feet',
      'hormonal',
      'honking',
    ],
    category: 'behavior',
    urgency: 'watch',
    summary: 'Unaltered rabbits spray, mount, and can be aggressive. OHRR’s answer is spay/neuter.',
    what_to_do: `OHRR’s spay/neuter guide: altered rabbits are calmer because they no longer have the urge to mate. Spaying/neutering:
- prevents territorial spraying in males and reduces mounting and aggression;
- reduces destructive chewing and digging and improves litter training;
- virtually eliminates the risk of reproductive cancers;
- makes bonding with another rabbit possible.

OHRR connects owners with experienced rabbit vets for the surgery — use Find a rabbit-savvy vet below.

If your rabbit is already fixed and the behaviour is new or sudden, mention it to your vet.`,
    article_slug: null,
    show_vets: true,
    hopshop_note: null,
    source: `${SPAY}; ${TOP_TEN} (#2)`,
  },
  {
    slug: 'bored-toys',
    title: 'Bored bunny — toys and play',
    aliases: [
      'bored',
      'boredom',
      'toys',
      'enrichment',
      'play',
      'playing',
      'DIY toys',
      'what do rabbits play with',
      'tossing',
      'throwing things',
      'entertain',
      'keep busy',
    ],
    category: 'behavior',
    urgency: 'tip',
    summary: 'Cheap, safe, home-made toys — matched to how your rabbit likes to play.',
    what_to_do: `Watch what your rabbit does — dig, chew, or toss — and build toys for that. OHRR’s Top Ten Tips: at least an hour out of the pen every day.

## Safe materials (from OHRR’s DIY toys guide)
- Cardboard with tape and adhesive removed: boxes with doors cut in, platforms, or boxes filled with paper or hay to dig in.
- Toilet-paper and paper-towel rolls stuffed with hay for foraging.
- Kraft paper and soy-ink newspaper to rip, dig, and toss.
- Polar fleece — the only safe fabric, because its short fibres don’t cause digestive problems. Knot a blanket to chew, or make strip balls.
- Untreated pinecones and untreated willow baskets — check they’re untreated and animal-safe.
- Toddler teething toys and wooden blocks.
- Phone books only with supervision, with the covers and spine adhesive removed.

And you: playing with your rabbit is enrichment too.`,
    article_slug: null,
    show_vets: false,
    hopshop_note: 'Toys and chews — see the Hop Shop.',
    source: `${DIY_TOYS}; ${TOP_TEN} (#7)`,
  },

  /* ---------------------------------------------------------- bonding */
  {
    slug: 'bonding',
    title: 'Bonding with a new rabbit (bunny dating)',
    aliases: [
      'bonding',
      'bond',
      'second bunny',
      'second rabbit',
      'new rabbit',
      'introduce',
      'introducing rabbits',
      'bunny dating',
      'companion',
      'pair',
      'friend',
      'lonely',
      'alone',
    ],
    category: 'bonding',
    urgency: 'tip',
    summary: 'Let your rabbit choose their friend, then introduce slowly on neutral ground.',
    what_to_do: `## Before you start
- Both rabbits must be spayed/neutered, then wait a few weeks for hormones to settle.
- Let your rabbit pick: OHRR suggests meeting 2–3 potential partners — personality matters more than size or breed. OHRR runs guided bonding sessions (see Bunny Services in this app).

## At home
- Keep the two pens about 3 inches apart; place food bowls facing each other at mealtimes.
- Hold ‘dates’ in neutral territory such as a bathtub — the footing prevents serious injuries. Start with 10–15 minutes and grow from there.
- Always supervise. Keep a broom or spray bottle handy to interrupt a fight — never use your bare hands.
- Petting both bunnies during a session helps keep them calm.

## What’s normal
- Nipping, mounting (dominance), and pooping near the pen edges (marking) are normal and fade as the bond forms.
- Expect setbacks and ‘bad dates’. Bonding can take months.
- For tough pairs, OHRR suggests stress bonding: a car ride, sitting on a running washer, a basket carry, or a stroller walk together.`,
    article_slug: 'bonding',
    show_vets: false,
    hopshop_note: null,
    source: `${BONDING}; ${SERVICES}`,
  },
  {
    slug: 'fighting',
    title: 'Fighting with their partner',
    aliases: [
      'fighting',
      'fight',
      'attacking each other',
      'bonded pair fighting',
      'chasing',
      'biting each other',
      'fur pulling',
      'fur flying',
      'nipping',
      'bond broke',
      'unbonded',
      'won’t get along',
      'not getting along',
    ],
    category: 'bonding',
    urgency: 'watch',
    summary: 'Separate safely, then go back a step in bonding. Injuries need a vet.',
    what_to_do: `- If either rabbit is bleeding or injured, that’s a vet visit — bleeding is an emergency for rabbits.
- Break up a fight with a broom, a towel, or a spray bottle — never with bare hands.
- Nipping and chasing on their own are normal parts of bonding; fur pulling and real fighting mean the pair needs more time.

## Going back a step
- Make sure both are spayed/neutered and it has been a few weeks since surgery.
- Return to short, supervised dates (10–15 minutes) in neutral territory like a bathtub.
- Keep the pens 3 inches apart between dates, with bowls facing each other.
- Try stress bonding: a car ride, sitting on a running washer, or a stroller walk together.
- OHRR runs guided bonding sessions — see Bunny Services in this app.`,
    article_slug: 'bonding',
    show_vets: true,
    hopshop_note: null,
    source: `${BONDING}; ${SERVICES}`,
  },

  /* ------------------------------------------------------------- diet */
  {
    slug: 'hay-pellets',
    title: 'Hay and pellets — which, and how much',
    aliases: [
      'hay',
      'timothy',
      'alfalfa',
      'orchard grass',
      'oat hay',
      'won’t eat hay',
      'not eating hay',
      'how much hay',
      'pellets',
      'how many pellets',
      'pellet amount',
      'food',
      'what to feed',
      'diet',
      'water',
      'water bottle',
    ],
    category: 'diet',
    urgency: 'tip',
    summary: 'Unlimited timothy hay, limited timothy pellets, and a daily salad — OHRR’s three-part diet.',
    what_to_do: `## Hay
- Unlimited grass hay, refreshed daily. OHRR feeds Oxbow timothy; orchard grass and oat hay also work depending on your rabbit’s taste.
- A rabbit should eat a pile of hay about the size of its body every day. Hay’s fibre keeps the gut moving and wears the teeth down.
- Alfalfa is for babies and underweight rabbits — OHRR reserves it for gaining weight, not for adults.

## Pellets
- Plain timothy-based pellets only (OHRR suggests Oxbow or Small Pet Select). No corn, seeds, or colourful pieces.
- OHRR’s rule of thumb: about 1/8 cup per 4 lb of rabbit per day, and many rabbits do fine on less. Pellets are a supplement — hay is the diet.

## Water
- Change the water daily; rinse and wipe the bowl to prevent algae.

Some rabbits have special dietary needs — work with your vet or adoption coordinator.`,
    article_slug: 'diet',
    show_vets: false,
    hopshop_note: 'Hay and pellets — see what the Hop Shop has in stock.',
    source: `${DIET_ARTICLE}; ${DIET_PAGE}`,
  },
  {
    slug: 'greens-fruit',
    title: 'Safe vegetables, greens, and fruit',
    aliases: [
      'vegetables',
      'veggies',
      'greens',
      'salad',
      'lettuce',
      'fruit',
      'treats',
      'banana',
      'carrot',
      'carrots',
      'kale',
      'spinach',
      'cilantro',
      'parsley',
      'what can bunny eat',
      'can rabbits eat',
      'new food',
      'how much salad',
    ],
    category: 'diet',
    urgency: 'tip',
    summary: 'A daily salad of leafy greens, new foods one at a time, and fruit only as a treat.',
    what_to_do: `## Daily greens
- OHRR: about 1 cup of greens per 3 lb of body weight each day. Start with green leaf lettuce and add variety slowly.
- Introduce one new green at a time and wait 24 hours before adding another (House Rabbit Society).
- Almost all leafy greens are fine — cilantro, mint, and parsley are OHRR favourites. Skip iceberg lettuce (no nutrition). Go easy on spinach, mustard greens, and kale (high calcium), and on cabbage.

## Fruit and treats
- Treats only: a raisin or craisin, a baby carrot, a small banana slice, or a strawberry. One baby carrot or banana slice a day is plenty.
- Ration sugary vegetables like carrots, bell peppers, beets, parsnips, and squash.

## If something disagrees
- Remove any food that causes loose or mushy stools from the diet right away. See ‘Foods to avoid’ for what should never be fed.`,
    article_slug: 'diet',
    show_vets: false,
    hopshop_note: null,
    source: `${DIET_ARTICLE}; ${DIET_PAGE}; ${HRS_VEG}; ${FOODS_AVOID}`,
  },
  {
    slug: 'foods-to-avoid',
    title: 'Foods to avoid — and what if they ate one',
    aliases: [
      'ate something',
      'ate chocolate',
      'poisonous',
      'toxic',
      'avocado',
      'onion',
      'bread',
      'crackers',
      'houseplant',
      'ate a plant',
      'cabbage',
      'iceberg',
      'corn',
      'nuts',
      'yogurt drops',
      'seeds',
      'dog food',
      'cat food',
      'mouldy',
      'moldy',
    ],
    category: 'diet',
    urgency: 'watch',
    summary: 'OHRR’s list of foods that should never be fed to a rabbit.',
    what_to_do: `## Never feed
- Avocado, bamboo shoots, dried or raw beans (lima, kidney, soy), bracken fern, cabbage, chocolate, coffee beans or plant, corn in any form, dog or cat food, grains, honey/seed sticks, most house plants, iceberg lettuce, meat, millet, nuts, onions, dried peas, people food, potatoes (including peels), refined sugar, rhubarb, sweet peas, sweet potatoes, tea leaves, whole seeds, yogurt drops.
- Anything mouldy.
- Nursery flowers usually carry pesticides — only organic flowers.

## If your rabbit ate something on the list
- Call a rabbit-savvy vet and tell them what and how much. After hours: MedVet Hilliard, 614-870-0480 (open 24/7 for exotics emergencies).
- Remove any food that causes loose or mushy stools from the diet immediately.`,
    article_slug: 'foods-to-avoid',
    show_vets: true,
    hopshop_note: null,
    source: FOODS_AVOID,
  },

  /* --------------------------------------------------------- grooming */
  {
    slug: 'nails-grooming',
    title: 'Overgrown nails, shedding, and grooming',
    aliases: [
      'nails',
      'nail trim',
      'clip nails',
      'long nails',
      'overgrown nails',
      'claws',
      'shedding',
      'moulting',
      'molting',
      'brushing',
      'fur everywhere',
      'grooming',
      'matted fur',
      'bath',
    ],
    category: 'grooming',
    urgency: 'tip',
    summary: 'OHRR’s vet clinic days offer nail trims; a rabbit-savvy vet can show you a safe home routine.',
    what_to_do: `- OHRR hosts mobile vet-clinic days with a rabbit-savvy vet for nail trims, wellness checks, and microchipping — by appointment. See Bunny Services in this app.
- Ask the vet to show you a safe home routine, and use My Bunny’s ‘Nail trim’ reminder (typically every 6 weeks) so trims don’t slip.
- Rabbits are exotic pets with different needs from dogs and cats, so a rabbit-savvy vet is your new best friend (OHRR’s Top Ten Tips).`,
    article_slug: null,
    show_vets: true,
    hopshop_note: null,
    source: `${SERVICES}; ${TOP_TEN} (#1)`,
  },

  /* ---------------------------------------------------------- housing */
  {
    slug: 'new-bunny',
    title: 'New bunny basics',
    aliases: [
      'new bunny',
      'just adopted',
      'first rabbit',
      'getting started',
      'setup',
      'cage',
      'hutch',
      'pen size',
      'how big',
      'outside',
      'outdoors',
      'where should my bunny live',
      'bunny proof',
      'exercise',
      'how long do rabbits live',
      'lifespan',
    ],
    category: 'housing',
    urgency: 'tip',
    summary: 'OHRR’s Top Ten Tips for new bunny owners, in short.',
    what_to_do: `- A rabbit-savvy vet is your new best friend — rabbits are exotic pets with different needs from dogs and cats.
- Get them fixed: spay/neuter cuts aggression and other unwanted behaviour and lowers cancer risk.
- Inside the house, not a hutch: indoors protects from disease, predators, and weather — and you’ll see their personality.
- Housing: at least a 4×4 space on the floor with no wire bottom. An exercise pen works; some owners give a whole room.
- Bunny-proof: secure cords, baseboards, house plants, and anything harmful.
- Litter box: rabbits naturally pick one spot. Use paper-based litter; avoid cedar and non-kiln-dried pine.
- Play: at least an hour a day outside their space, plus a variety of safe toys.
- Diet: limited pellets, unlimited hay, daily vegetables; treats about a teaspoon per 2 lb.
- Do your research — read about GI stasis and bloat and have an emergency plan.
- It’s a commitment: rabbits can live 8–12 years. Enjoy it.`,
    article_slug: 'housing',
    show_vets: false,
    hopshop_note: null,
    source: TOP_TEN,
  },
]

/** The seed as runtime topics (ids are stable `seed:<slug>` strings). */
export function seedAsTopics(): CareTopic[] {
  return SEED_TOPICS.map((s, i) => ({
    id: `seed:${s.slug}`,
    slug: s.slug,
    title: s.title,
    aliases: s.aliases,
    category: s.category,
    urgency: s.urgency,
    summary: s.summary,
    what_to_do: s.what_to_do,
    article_slug: s.article_slug,
    show_vets: s.show_vets,
    hopshop_note: s.hopshop_note,
    reviewed_by: null,
    reviewed_at: null,
    is_published: true,
    sort_order: i,
  }))
}
