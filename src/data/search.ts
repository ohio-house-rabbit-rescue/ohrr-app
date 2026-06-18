// A simple in-app global search index, compiled from the app's content so the
// header search can find screens, rabbits, vendors, care topics, tails, volunteer
// roles, giving options, and BunFest sessions. Page-specific search can layer on
// later; for now search covers the whole app.
import { sampleRabbits } from './adoptables'
import { vendors } from './vendors'
import { careTopics } from './care'
import { tails } from './tails'
import { volunteerWays } from './volunteer'
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
  { title: 'Adopt a Rabbit', subtitle: 'Adoptable bunnies', to: '/adopt', extra: 'adoption apply' },
  { title: 'Happy Tails', subtitle: 'Adoption stories', to: '/tails', extra: 'follow updates' },
  { title: 'Bunny Services', subtitle: 'Bonding & vet clinic', to: '/services', extra: 'appointment' },
  { title: 'Rabbit Care', subtitle: 'Learn', to: '/learn', extra: 'diet housing health' },
  { title: 'Volunteer', subtitle: 'Ways to help', to: '/volunteer', extra: 'foster transport socialize' },
  { title: 'Support OHRR', subtitle: 'Donate & give', to: '/support', extra: 'donation gift wishlist' },
  { title: 'Surrendering a Rabbit', subtitle: 'Owner surrender', to: '/surrender', extra: 'relinquish intake give up rehome' },
  { title: 'About OHRR', subtitle: 'Mission & contact', to: '/about', extra: 'hours phone address' },
  { title: 'Settings', subtitle: 'Your info & app', to: '/settings', extra: 'profile email version' },
  { title: 'Help', subtitle: 'How the app works', to: '/help', extra: 'guide' },
  { title: 'Midwest BunFest', subtitle: 'The festival', to: '/bunfest', extra: 'event october' },
  { title: 'BunFest Schedule', subtitle: 'Education sessions', to: '/bunfest/schedule', extra: 'talks' },
  { title: 'BunFest Vendors', subtitle: 'Marketplace', to: '/bunfest/vendors', extra: 'shopping' },
  { title: 'Event Map', subtitle: 'Floor plan', to: '/bunfest/map', extra: 'booth' },
  { title: 'Rescue Partners', subtitle: 'BunFest', to: '/bunfest/partners' },
  { title: 'Sponsors', subtitle: 'BunFest', to: '/bunfest/sponsors' },
  { title: 'Plan Your Visit', subtitle: 'BunFest', to: '/bunfest/visit', extra: 'tickets parking admission' },
]

export const searchIndex: SearchItem[] = [
  ...screens.map((s) => mk(s.title, s.subtitle, s.to, 'Screens', s.extra ?? '')),
  ...sampleRabbits.map((r) =>
    mk(r.name, `${r.breed ?? 'Rabbit'} · adoptable`, `/adopt/${r.id}`, 'Adoptable rabbits', `${r.tags?.join(' ') ?? ''} ${r.description ?? ''}`),
  ),
  ...careTopics.map((c) =>
    mk(c.title, c.summary, `/learn/${c.id}`, 'Rabbit care', c.sections.map((s) => s.heading ?? '').join(' ')),
  ),
  ...vendors.map((v) => mk(v.name, v.category, `/bunfest/vendors/${v.id}`, 'BunFest vendors', v.description)),
  ...tails.map((t) => mk(t.bunny, 'Happy Tail', `/tails/${t.id}`, 'Happy Tails', t.summary)),
  ...volunteerWays.map((w) => mk(w.title, w.tagline, `/volunteer/${w.slug}`, 'Volunteer', '')),
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
