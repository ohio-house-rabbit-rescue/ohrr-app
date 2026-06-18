// In-app Help content. The `?` in the header opens the Help screen, which shows
// contextual help for wherever you came from (via `?from=`) plus a full guide.
// `to` is both the route the help is about and a tappable link to that screen.

export interface HelpTopic {
  to: string
  title: string
  what: string
  tips?: string[]
}

export const helpIntro =
  'This app is your one place for everything Ohio House Rabbit Rescue — adopting, learning, giving, volunteering, and the Midwest BunFest festival. Here’s how each part works.'

export const headerHelp = [
  { label: 'Search', text: 'The magnifying glass searches the whole app — type or tap the mic to speak.' },
  { label: 'Help', text: 'The question mark (you’re here) explains whatever screen you’re on.' },
  { label: 'Settings', text: 'The gear holds your info, saved data, app version, and photo credits.' },
  { label: 'Bottom tabs', text: 'Jump between Home, Adopt, Tails, Learn, Volunteer, and Support.' },
  { label: 'Midwest BunFest', text: 'Opens the festival sub-app; the dark “Back to Ohio House Rabbit Rescue” bar at the top returns you here.' },
]

export const helpTopics: HelpTopic[] = [
  { to: '/', title: 'Home', what: 'Your starting point — jump to adoption, giving, the festival, and more.' },
  {
    to: '/adopt',
    title: 'Adopt a Rabbit',
    what: 'Browse rabbits looking for homes, filter by age, and open a bunny for full details.',
    tips: ['Tap a rabbit to see their story, traits, and how to apply.', 'Sample rabbits show until OHRR’s live listings are connected.'],
  },
  {
    to: '/tails',
    title: 'Happy Tails',
    what: 'See where adopted bunnies are now and follow the ones you love to check back on them.',
    tips: ['Tap the heart to follow a bunny — no account needed.'],
  },
  {
    to: '/services',
    title: 'Bunny Services',
    what: 'Request a bonding session or reserve a mobile vet-clinic time for your own rabbit.',
  },
  {
    to: '/learn',
    title: 'Rabbit Care',
    what: 'Plain-language care guides — diet, housing, litter training, bonding, health, and more.',
  },
  {
    to: '/volunteer',
    title: 'Volunteer',
    what: 'Sign up to help — socialization, vet transport, events, or fostering — right in the app.',
    tips: ['Each sign-up tells OHRR exactly which role you chose.'],
  },
  {
    to: '/support',
    title: 'Support OHRR',
    what: 'Every way to give — donations, recurring gifts, workplace matching, wishlist, and more.',
  },
  {
    to: '/surrender',
    title: 'Surrendering a Rabbit',
    what: 'If you’re struggling, OHRR can often help you keep your bunny — and if not, the full process and intake form are here.',
  },
  { to: '/about', title: 'About OHRR', what: 'OHRR’s mission, story, hours, and contact info.' },
  {
    to: '/search',
    title: 'Search',
    what: 'Find anything in the app. Type a word, or tap the mic to speak your search.',
  },
  { to: '/settings', title: 'Settings', what: 'Your optional email/profile, saved data, app version, and photo credits.' },
  {
    to: '/bunfest',
    title: 'Midwest BunFest',
    what: 'The festival sub-app — schedule, vendors, the event map, and how to visit.',
    tips: ['The “Back to Ohio House Rabbit Rescue” bar at the top returns you to the main app.'],
  },
  { to: '/bunfest/schedule', title: 'BunFest Schedule', what: 'The education sessions — save the ones you want and add them to your calendar.' },
  { to: '/bunfest/vendors', title: 'BunFest Vendors', what: 'Browse the makers and shops, filter by category, and see each vendor’s booth.' },
  { to: '/bunfest/map', title: 'Event Map', what: 'The floor plan — tap a booth to find a vendor, plus the stages, spa, and Hop Shop.' },
  { to: '/bunfest/visit', title: 'Plan Your Visit', what: 'Date, location, admission, parking, and what to know before you go.' },
]

export function helpFor(path: string): HelpTopic | undefined {
  const matches = helpTopics.filter(
    (t) => path === t.to || (t.to !== '/' && path.startsWith(t.to)),
  )
  return matches.sort((a, b) => b.to.length - a.to.length)[0]
}
