// Share kit — ready-to-post cards. The point: a volunteer with no design or
// social-media skill picks a rabbit / event / message, taps Share, and a
// branded image plus a written caption go to Instagram, Facebook or TikTok.
//
// Education cards are OHRR's own guidance in plain words, aimed at the people
// the market research says OHRR is missing: families before Easter, young
// renters, students, and rabbit owners who never adopted. Keep facts checkable
// (no invented statistics); each card notes where its claim comes from.
//
// The website carries a copy of this file — keep the two in sync.

export type CardKind = 'rabbit' | 'event' | 'education' | 'volunteer' | 'custom'
export type CardFormat = 'square' | 'story'

/** What the painter needs — the same for every kind. */
export interface CardData {
  kind: CardKind
  /** small line above the headline, e.g. "MEET" / "SAVE THE DATE" / "DID YOU KNOW" */
  kicker: string
  headline: string
  subline?: string
  /** photo URL (same-origin or CORS-enabled); when absent the card uses the brand background */
  photo?: string
  /** bottom-left, e.g. "ohrr-website.pages.dev/adopt" */
  footer: string
  /** encoded in the QR code; also the link in the caption */
  url: string
  /** accent: OHRR blue by default, orange for calls to action */
  accent?: 'blue' | 'orange'
}

export interface CardPost {
  id: string
  label: string
  /** shown in the picker as a hint of when to use it */
  when?: string
  card: CardData
  caption: string
}

/** Public links go to the website (indexable, works for everyone) until the app is in the stores. */
export const SHARE_SITE = 'https://ohrr-website.pages.dev'
export const SHARE_SITE_SHORT = 'ohrr-website.pages.dev'

export function utm(path: string, campaign: string): string {
  const u = new URL(path, SHARE_SITE)
  u.searchParams.set('utm_source', 'social')
  u.searchParams.set('utm_medium', 'share-kit')
  u.searchParams.set('utm_campaign', campaign)
  return u.toString()
}

export const HASHTAGS = '#OhioHouseRabbitRescue #AdoptDontShop #HouseRabbit #Columbus #BunnyCare'

/* ------------------------------------------------------------- education */

export interface EducationCard {
  id: string
  /** which audience / season it serves — shown in the picker */
  audience: string
  months: number[] // 1–12 when it's most useful (empty = any time)
  kicker: string
  headline: string
  subline: string
  caption: string
  path: string
  accent?: 'blue' | 'orange'
  /** where the claim comes from — for the person posting, not printed on the card */
  source: string
}

export const EDUCATION_CARDS: EducationCard[] = [
  {
    id: 'easter-10-years',
    audience: 'Families, before Easter',
    months: [2, 3, 4],
    kicker: 'BEFORE YOU BUY A BUNNY',
    headline: 'A rabbit is a 10-year pet.',
    subline: 'Not a basket filler. Indoors, spayed or neutered, with a vet who knows rabbits — and a 4′ × 4′ space to call home.',
    caption:
      'Thinking about a bunny for Easter? A rabbit lives 10 years or more, lives indoors, needs a rabbit-savvy vet and room to run. Every spring, rescues fill up with bunnies bought in March. Read “Is a rabbit right for us?” first — and if the answer is yes, adopt one that’s already here. 🐰',
    path: '/adopt',
    source: 'OHRR adoption policy (4′×4′ minimum); OHRR post-Easter surrenders (WOSU 2025); HumanePro on the 2–3-month post-Easter surrender pattern.',
  },
  {
    id: 'post-easter-keep',
    audience: 'New owners, after Easter',
    months: [4, 5, 6, 7],
    kicker: 'STRUGGLING WITH YOUR BUNNY?',
    headline: 'Before you give up, talk to us.',
    subline: 'Digging, chewing, litter box, “not bonding” — most of it has a fix. OHRR helps owners keep their rabbits.',
    caption:
      'Got a bunny this spring and it’s harder than you thought? You’re not alone, and you don’t have to figure it out by yourself. OHRR offers support to help owners keep their rabbits — litter training, bunny-proofing, low-cost spay/neuter, bonding help. Ask before you surrender. 💙',
    path: '/surrender',
    accent: 'orange',
    source: 'OHRR Good Samaritan/Owner Surrender & Relinquishment Policy (support offered first); shelter studies: 88–97% of surrenders are for human reasons.',
  },
  {
    id: 'apartment-pet',
    audience: 'Renters & students',
    months: [1, 8, 9],
    kicker: 'THE APARTMENT PET',
    headline: 'Quiet. Litter-trained. No walks.',
    subline: 'Rabbits fit a small home — and most leases allow them when they won’t allow a dog.',
    caption:
      'Renting? A rabbit might be the pet that fits: quiet, litter-box trained, no 6 am walks, and allowed by many leases that say no to dogs. They do need indoor space, hay every day and bunny-proofed cords. See who’s waiting for a home at OHRR. 🏠🐇',
    path: '/adopt',
    source: 'OHRR care guidance (litter training, indoor housing); ~47% of Franklin County households rent (ACS 2024).',
  },
  {
    id: 'foster',
    audience: 'Students & young adults',
    months: [1, 8, 9, 10],
    kicker: 'CAN’T ADOPT YET?',
    headline: 'Foster a rabbit.',
    subline: 'A few weeks, everything supplied, and a bunny gets out of the center and into a home while they wait.',
    caption:
      'Not ready to adopt? Fostering is the door in. A few weeks in your home, supplies and support from OHRR, and a rabbit recovers from surgery or learns to trust people somewhere quiet. Tell us you’re interested — it takes a minute. 🐰',
    path: '/volunteer',
    accent: 'orange',
    source: 'OHRR fosters rabbits in team members’ and volunteers’ homes (org profile); Gen Z fostered the most pets 2020–22 (APPA).',
  },
  {
    id: 'socialize',
    audience: 'Families with children 6+',
    months: [],
    kicker: 'VOLUNTEER FROM AGE 6',
    headline: 'Sit with the bunnies.',
    subline: 'One-hour socialization shifts help shy rabbits trust people again. Kids 10 and under come with an adult.',
    caption:
      'Looking for something real to do with the kids? Bunny socialization shifts at OHRR are open from age 6 (10 and under with an adult). An hour of quiet company helps a rescued rabbit get ready for adoption. Book a shift on our site. 🐇💛',
    path: '/volunteer',
    source: 'OHRR Volunteer page (age rules, two shifts a month).',
  },
  {
    id: 'not-a-starter-pet',
    audience: 'Everyone',
    months: [],
    kicker: 'MYTH',
    headline: '“Rabbits are easy starter pets for kids.”',
    subline: 'They are prey animals: fragile, easily scared, and they hide being sick. They do best with adults in charge of care.',
    caption:
      'Myth: rabbits are an easy first pet for a child. Truth: they’re prey animals — fragile, easily frightened, and they hide illness. Kids can love them; an adult needs to own the care. OHRR’s care guides explain what a rabbit actually needs. 📖',
    path: '/learn',
    source: 'OHRR volunteer quoted in WOSU (April 2025); OHRR care guides.',
  },
  {
    id: 'vet-savvy',
    audience: 'Rabbit owners',
    months: [],
    kicker: 'DID YOU KNOW',
    headline: 'Not every vet sees rabbits.',
    subline: 'OHRR keeps a list of rabbit-savvy vets around Columbus. Save it before you need it.',
    caption:
      'A rabbit that stops eating is an emergency — and not every clinic treats rabbits. OHRR keeps a directory of rabbit-savvy vets around Central Ohio. Find yours now, before the day you need one. 🩺🐰',
    path: '/learn/vets',
    source: 'OHRR vet directory.',
  },
  {
    id: 'hay',
    audience: 'Rabbit owners',
    months: [],
    kicker: 'BUNNY BASICS',
    headline: 'Hay. All day. Every day.',
    subline: 'Unlimited grass hay keeps teeth and gut moving; pellets are the side dish, treats the garnish.',
    caption:
      'The one thing every rabbit needs, all day, every day: unlimited grass hay. It keeps teeth worn and the gut moving. Pellets are a measured side dish; fruit is a treat. Our diet guide has the details. 🌾',
    path: '/learn',
    source: 'OHRR diet guide (“Timothy? Alfalfa? What you should know about your bunny’s diet”).',
  },
  {
    id: 'spay-neuter',
    audience: 'Rabbit owners',
    months: [],
    kicker: 'DID YOU KNOW',
    headline: 'Spay or neuter — it’s more than population control.',
    subline: 'Calmer, cleaner litter habits, and for females a much lower risk of uterine cancer. Ask about Fix-a-Bun.',
    caption:
      'Spaying or neutering your rabbit isn’t just about litters. It means calmer behaviour, better litter-box habits and, for females, protection from uterine cancer. OHRR’s Fix-a-Bun program helps with the cost. 🐇',
    path: '/learn',
    source: 'OHRR article “Spay/Neuter: It’s More than Population Control”; Fix-a-Bun program.',
  },
  {
    id: 'bonded-pair',
    audience: 'Adopters',
    months: [],
    kicker: 'TWO IS COMPANY',
    headline: 'Rabbits are happiest with a friend.',
    subline: 'Bonded pairs come already matched — and OHRR runs bunny dates to find your rabbit a partner.',
    caption:
      'Rabbits are social animals and most are happier in pairs. Adopting a bonded pair means the hard part is done; if you already have a bunny, OHRR hosts bonding dates on neutral ground with an expert in the pen. 💕🐇🐇',
    path: '/info/bunny-dates',
    source: 'OHRR bonding-date page; adoption application’s bonded-pair question.',
  },
]

/* ------------------------------------------------------------- builders */

export function rabbitPost(r: { id: string; name: string; description?: string; photo?: string; age?: string; sex?: string; bonded?: boolean; breed?: string }): CardPost {
  const bits = [r.age, r.sex, r.breed].filter(Boolean).join(' · ')
  const sub = r.description ? firstSentence(r.description, 110) : bits
  return {
    id: `rabbit:${r.id}`,
    label: `Meet ${r.name}`,
    card: {
      kind: 'rabbit',
      kicker: r.bonded ? 'ADOPTABLE PAIR' : 'MEET',
      headline: r.name,
      subline: sub,
      photo: r.photo,
      footer: `${SHARE_SITE_SHORT}/adopt`,
      url: utm('/adopt', 'adopt'),
    },
    caption: `Meet ${r.name}${bits ? ` — ${bits}` : ''}. ${r.description ? firstSentence(r.description, 200) + ' ' : ''}Adoptions are by appointment at the OHRR Adoption Center in Columbus. See ${r.name} and every rabbit waiting for a home: ${utm('/adopt', 'adopt')}\n\n${HASHTAGS}`,
  }
}

export function eventPost(e: { id: string; title: string; startsAt: string; venue?: string; city?: string; summary?: string; slug?: string }): CardPost {
  const d = new Date(e.startsAt)
  const day = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/New_York' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })
  const where = [e.venue, e.city].filter(Boolean).join(', ')
  return {
    id: `event:${e.id}`,
    label: e.title,
    when: day,
    card: {
      kind: 'event',
      kicker: 'SAVE THE DATE',
      headline: e.title,
      subline: `${day} · ${time}${where ? ` · ${where}` : ''}`,
      footer: `${SHARE_SITE_SHORT}/events`,
      url: utm('/events', 'events'),
      accent: 'orange',
    },
    caption: `${e.title} — ${day}, ${time}${where ? ` at ${where}` : ''}. ${e.summary ? firstSentence(e.summary, 180) + ' ' : ''}Details: ${utm('/events', 'events')}\n\n${HASHTAGS}`,
  }
}

export function educationPost(c: EducationCard): CardPost {
  return {
    id: `edu:${c.id}`,
    label: c.headline,
    when: c.audience,
    card: {
      kind: 'education',
      kicker: c.kicker,
      headline: c.headline,
      subline: c.subline,
      footer: `${SHARE_SITE_SHORT}${c.path}`,
      url: utm(c.path, c.id),
      accent: c.accent,
    },
    caption: `${c.caption}\n\n${utm(c.path, c.id)}\n\n${HASHTAGS}`,
  }
}

export function customPost(headline: string, subline: string, path = '/'): CardPost {
  return {
    id: 'custom',
    label: 'Custom',
    card: {
      kind: 'custom',
      kicker: 'OHIO HOUSE RABBIT RESCUE',
      headline,
      subline,
      footer: `${SHARE_SITE_SHORT}${path === '/' ? '' : path}`,
      url: utm(path, 'custom'),
    },
    caption: `${headline}${subline ? ` — ${subline}` : ''}\n\n${utm(path, 'custom')}\n\n${HASHTAGS}`,
  }
}

/** Cards worth posting this month, in a sensible order (seasonal first). */
export function suggestedEducation(month = new Date().getMonth() + 1): EducationCard[] {
  const seasonal = EDUCATION_CARDS.filter((c) => c.months.includes(month))
  const evergreen = EDUCATION_CARDS.filter((c) => c.months.length === 0)
  return [...seasonal, ...evergreen]
}

function firstSentence(text: string, max: number): string {
  const s = text.replace(/\s+/g, ' ').trim()
  const m = s.match(/^(.{20,}?[.!?])\s/)
  const first = m ? m[1] : s
  return first.length > max ? first.slice(0, max - 1).trimEnd() + '…' : first
}
