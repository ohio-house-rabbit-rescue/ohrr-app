// A simple in-app global search index, compiled from the app's content so the
// header search can find screens, rabbits, vendors, care articles, vets, events,
// tails, volunteer roles, giving options, and BunFest sessions.
import { sampleRabbits } from './adoptables'
import { vendors } from './vendors'
import { seedCareArticles } from './careArticles'
import { seedVets } from './vets'
import { seedEvents } from './events'
import { tails } from './tails'
import { volunteerWays, otherVolunteerNeeds } from './volunteer'
import { givingOptions } from './giving'
import { sessions } from './sessions'

export interface SearchItem {
  title: string
  subtitle: string
  to: string
  group: string
  keywords: string // lowercased haystack
}

const mk = (title: string, subtitle: string, to: string, group: string, extra = ''): SearchItem => ({
  title,
  subtitle,
  to,
  group,
  keywords: `${title} ${subtitle} ${extra}`.toLowerCase(),
})

const screens: { title: string; subtitle: string; to: string; extra?: string }[] = [
  { title: 'Home', subtitle: 'OHRR home', to: '/' },
  { title: 'Adopt a Rabbit', subtitle: 'Adoptable bunnies & how adopting works', to: '/adopt', extra: 'adoption apply application petfinder' },
  { title: 'Adoption Policy', subtitle: 'Requirements, fees & procedure', to: '/adopt/how-it-works', extra: 'policy fee bonded pair indoor' },
  { title: 'Happy Tails', subtitle: 'Adoption stories', to: '/tails', extra: 'follow updates' },
  { title: 'Bunny Services', subtitle: 'Bonding & vet clinic', to: '/services', extra: 'appointment' },
  { title: 'Rabbit Care', subtitle: 'Learn', to: '/learn', extra: 'diet housing health litter toys' },
  { title: 'Find a Vet', subtitle: 'Rabbit-savvy vets in Ohio', to: '/vets', extra: 'veterinarian emergency exotic spay neuter medvet' },
  { title: 'Found a Rabbit?', subtitle: 'Strays, field rescue & surrender', to: '/found', extra: 'stray lost abandoned catch surrender admissions' },
  { title: 'Volunteer', subtitle: 'Ways to help', to: '/volunteer', extra: 'socialization buncare transport field rescue' },
  { title: 'Events', subtitle: 'OHRR hoppenings', to: '/events', extra: 'calendar bunfest' },
  { title: 'Support OHRR', subtitle: 'Donate & give', to: '/support', extra: 'donation gift wishlist kroger license plate merch' },
  { title: 'Hop Shop', subtitle: 'Supplies & merch', to: '/hop-shop', extra: 'hay pellets litter toys store hours' },
  { title: 'Surrendering a Rabbit', subtitle: 'Owner surrender', to: '/surrender', extra: 'relinquish intake give up rehome' },
  { title: 'About OHRR', subtitle: 'Mission, team & contact', to: '/about', extra: 'hours phone address directions instagram facebook' },
  { title: 'Settings', subtitle: 'Your info & app', to: '/settings', extra: 'profile email version' },
  { title: 'Help', subtitle: 'How the app works', to: '/help', extra: 'guide' },
  { title: 'Midwest BunFest', subtitle: 'The festival', to: '/bunfest', extra: 'event october binky on' },
  { title: 'BunFest Schedule', subtitle: 'Education sessions', to: '/bunfest/schedule', extra: 'talks' },
  { title: 'BunFest Vendors', subtitle: 'Marketplace', to: '/bunfest/vendors', extra: 'shopping' },
  { title: 'Event Map', subtitle: 'Floor plan', to: '/bunfest/map', extra: 'booth' },
  { title: 'Rescue Partners', subtitle: 'BunFest', to: '/bunfest/partners' },
  { title: 'Sponsors', subtitle: 'BunFest', to: '/bunfest/sponsors' },
  { title: 'Plan Your Visit', subtitle: 'BunFest', to: '/bunfest/visit', extra: 'tickets parking admission' },
  { title: 'Volunteer at BunFest', subtitle: 'BunFest', to: '/bunfest/p/volunteer', extra: 'help shift lanyard free admission glamour shots hop shop registration raffle' },
  { title: 'Bunny Spa', subtitle: 'BunFest', to: '/bunfest/p/spa', extra: 'nail trim grooming gland cleaning' },
  { title: 'Glamour Shots', subtitle: 'BunFest', to: '/bunfest/p/glamour', extra: 'photos photographer pictures' },
  { title: 'Raffle & Silent Auction', subtitle: 'BunFest', to: '/bunfest/p/raffle', extra: 'tickets prizes bidding buy it now' },
  { title: 'Chillaxabun Lounge', subtitle: 'BunFest', to: '/bunfest/p/lounge', extra: 'quiet pen rest hay water' },
  { title: 'Accommodations', subtitle: 'BunFest', to: '/bunfest/p/accommodations', extra: 'hotel embassy suites dublin room block group rate' },
  {
    title: 'OHRR staff sign-in',
    subtitle: 'For staff & volunteers',
    to: '/staff',
    extra: 'staff sign in login log in admin dashboard volunteer hours inbox hop shop manager team',
  },
  {
    title: 'My volunteer hours',
    subtitle: 'Your own record',
    to: '/volunteer/hours',
    extra: 'hours service letter volunteering log time',
  },
]

export const searchIndex: SearchItem[] = [
  ...screens.map((s) => mk(s.title, s.subtitle, s.to, 'Screens', s.extra ?? '')),
  ...sampleRabbits.map((r) =>
    mk(r.name, `${r.breed ?? 'Rabbit'} · adoptable`, `/adopt/${r.id}`, 'Adoptable rabbits', `${r.tags?.join(' ') ?? ''} ${r.description ?? ''}`),
  ),
  ...seedCareArticles.map((c) => mk(c.title, c.summary, `/learn/${c.slug}`, 'Rabbit care', c.body.slice(0, 400))),
  ...seedVets.map((v) =>
    mk(v.name, [v.city, v.region].filter(Boolean).join(' · '), '/vets', 'Vets', `${v.doctors ?? ''} ${v.notes ?? ''} ${v.isEmergency ? 'emergency 24/7' : ''}`),
  ),
  ...seedEvents.map((e) => mk(e.title, [e.venue, e.city].filter(Boolean).join(' · '), '/events', 'Events', `${e.theme ?? ''} ${e.summary ?? ''}`)),
  ...vendors.map((v) => mk(v.name, v.category, `/bunfest/vendors/${v.id}`, 'BunFest vendors', v.description)),
  ...tails.map((t) => mk(t.bunny, 'Happy Tail', `/tails/${t.id}`, 'Happy Tails', t.summary)),
  ...volunteerWays.map((w) => mk(w.title, w.tagline, `/volunteer/${w.slug}`, 'Volunteer', w.requirements.join(' '))),
  ...otherVolunteerNeeds.map((n) => mk(n, 'Other volunteer need', '/volunteer', 'Volunteer', '')),
  ...givingOptions.map((g) => mk(g.title, g.description, '/support', 'Ways to give', '')),
  ...sessions
    .filter((s) => !s.isBreak)
    .map((s) => mk(s.title, s.presenter, '/bunfest/schedule', 'BunFest sessions', s.description)),
]

export function searchAll(query: string): SearchItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const terms = q.split(/\s+/)
  return searchIndex.filter((item) => terms.every((t) => item.keywords.includes(t)))
}
