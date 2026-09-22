// In-app Help, rebuilt as a FAQ + support hub. Instead of re-describing each
// screen (which duplicated the UI), Help now answers the real questions OHRR
// gets, each with a one-tap jump into the matching in-app page, plus a prominent
// way to reach a human. OHRR can edit any of this.

export interface FaqLink {
  label: string
  to?: string // in-app route
  url?: string // external (only when no in-app equivalent)
}

export interface FaqItem {
  q: string
  a: string
  link?: FaqLink
}

export interface FaqCategory {
  title: string
  items: FaqItem[]
}

export const helpIntro =
  'Answers to the questions we hear most. Tap a question to expand it, or reach out anytime — OHRR is happy to help.'

export const faqCategories: FaqCategory[] = [
  {
    title: 'Adopting',
    items: [
      {
        q: 'How do I adopt a rabbit?',
        a: 'Browse the rabbits looking for homes, find one you connect with, and start an application. Adoptions happen by appointment at OHRR’s adoption center.',
        link: { label: 'Browse adoptable rabbits', to: '/adopt' },
      },
      {
        q: 'What are the adoption requirements?',
        a: 'Rabbits live indoors only, in at least a 4×4 ft space or free-range in the home, and are fed unlimited hay, quality pellets, and a daily salad. Every OHRR rabbit is spayed/neutered and vaccinated before adoption.',
        link: { label: 'See the Adopt page', to: '/adopt' },
      },
      {
        q: 'Why do the rabbits say “sample”?',
        a: 'The app shows sample rabbits until OHRR staff add the real adoptable bunnies from the staff screens. As soon as they do, the samples disappear — no app update needed.',
      },
      {
        q: 'What are OHRR’s hours?',
        a: 'Saturday and Sunday, 12–4 PM, by appointment. The adoption center is at 5485 N. High Street, Columbus, OH.',
        link: { label: 'About & contact', to: '/about' },
      },
    ],
  },
  {
    title: 'Your rabbit & care',
    items: [
      {
        q: 'What should I feed my rabbit?',
        a: 'Unlimited grass hay is about 80% of the diet, plus a daily variety of leafy greens and a small amount of plain pellets. Treats like fruit are occasional and tiny.',
        link: { label: 'Bunny Diet guide', to: '/learn/diet' },
      },
      {
        q: 'Can rabbits live outside?',
        a: 'No — house rabbits live indoors as part of the family. Outdoors exposes them to predators, parasites, and temperature extremes.',
        link: { label: 'Bunny Living Space', to: '/learn/bunny-living-space' },
      },
      {
        q: 'I found a rabbit outside — what do I do?',
        a: 'A friendly or colorful rabbit found outdoors is almost always a lost or dumped pet that can’t survive on its own. Contain it safely and reach out for help.',
        link: { label: 'Found a rabbit?', to: '/found' },
      },
      {
        q: 'Can OHRR help me bond two rabbits?',
        a: 'Yes. Rabbits are happiest with a friend, but introductions must go slowly. OHRR runs guided bonding sessions you can request in the app.',
        link: { label: 'Bunny Services', to: '/services' },
      },
    ],
  },
  {
    title: 'Giving & support',
    items: [
      {
        q: 'Is my donation tax-deductible?',
        a: 'Yes — Ohio House Rabbit Rescue is a registered 501(c)(3) nonprofit (EIN 27-0830606), so gifts are tax-deductible.',
        link: { label: 'Ways to give', to: '/support' },
      },
      {
        q: 'What are the ways to give?',
        a: 'Donate online, workplace/matching gifts, Kroger Community Rewards, the Amazon wish list, the merch store, the OHRR license plate, online affiliates, hosting a fundraiser, the Legacy Fund, and more — they’re all gathered here.',
        link: { label: 'Support OHRR', to: '/support' },
      },
      {
        q: 'Will my employer match my gift?',
        a: 'Many Columbus-area employers and United Way match employee donations, which can double your impact.',
        link: { label: 'See matching options', to: '/support' },
      },
    ],
  },
  {
    title: 'Volunteering & surrender',
    items: [
      {
        q: 'How do I volunteer?',
        a: 'OHRR’s four positions are Bunny Socialization, Buncare, Vet Delivery & Pick-up, and Bunny Field Rescuer — each with its requirements and real sign-up right in the app, plus a list of other needs.',
        link: { label: 'Volunteer', to: '/volunteer' },
      },
      {
        q: 'Where do I find a rabbit-savvy vet?',
        a: 'OHRR’s vet directory is in the app — filter by region, tap to call, and see who is open 24/7 for exotics emergencies.',
        link: { label: 'Find a vet', to: '/vets' },
      },
      {
        q: 'I’m struggling with my rabbit — can I surrender it?',
        a: 'Reach out first — OHRR can often help you keep your bunny. If surrender is truly the right step, the full process and the intake form are in the app.',
        link: { label: 'Surrendering a rabbit', to: '/surrender' },
      },
    ],
  },
  {
    title: 'Midwest BunFest',
    items: [
      {
        q: 'When and where is Midwest BunFest?',
        a: 'Sunday, October 25, 2026, 10:00 AM–4:00 PM, at The Makoy, 5462 Center St., Hilliard, OH. Free parking in the lot.',
        link: { label: 'Plan your visit', to: '/bunfest/visit' },
      },
      {
        q: 'How much is admission?',
        a: '$10 for adults, $5 for ages 5–12, and free for under 5. Cash or card, at the door or in advance.',
        link: { label: 'Visit & tickets', to: '/bunfest/visit' },
      },
      {
        q: 'Can I bring my own rabbit?',
        a: 'Yes — attendees may bring their rabbit, subject to the Rabbit Attendance Agreement. Check the visit details before you go.',
        link: { label: 'Plan your visit', to: '/bunfest/visit' },
      },
      {
        q: 'How do I find a vendor’s booth?',
        a: 'Open the interactive event map and tap a booth to see the vendor, or browse the vendor list — each shows its room and booth.',
        link: { label: 'Event Map', to: '/bunfest/map' },
      },
    ],
  },
  {
    title: 'Using this app',
    items: [
      {
        q: 'How do I get back to OHRR from Midwest BunFest?',
        a: 'Tap the “OHRR” tab at the bottom-left of the BunFest screens — it returns you to the main OHRR app.',
      },
      {
        q: 'How do I go back a screen?',
        a: 'Tap the back arrow at the top-left. On any screen but a main tab it takes you back the way you came; on Android the phone’s own back button does the same. The row of tabs along the bottom always jumps straight to a section.',
      },
      {
        q: 'What do the icons at the top do?',
        a: 'The magnifying glass searches the whole app (type or tap the mic to speak), the question mark opens this Help, and the gear opens Settings. The back arrow on its left returns to the previous screen.',
        link: { label: 'Search the app', to: '/search' },
      },
      {
        q: 'The words are too small — can I make them bigger?',
        a: 'Yes. Settings → Text size has Normal, Large and Extra large; it makes everything in the app bigger, not just the words, and stays set on your phone.',
        link: { label: 'Open Settings', to: '/settings' },
      },
      {
        q: 'Do I need an account?',
        a: 'No. Saving BunFest sessions and following bunnies work without one. You can optionally add your email in Settings so OHRR can reach you.',
        link: { label: 'Settings', to: '/settings' },
      },
    ],
  },
]
