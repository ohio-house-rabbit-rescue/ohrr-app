// App-wide constants and navigation for both the OHRR host app and the
// Midwest BunFest sub-app.
import type { IconName } from '../components/icons'

export const SAMPLE_DATA_NOTE =
  'Showing the most recent (2025) lineup. The 2026 roster is announced closer to the event.'

export interface TabItem {
  to: string
  label: string
  icon: IconName
  end?: boolean
}

export interface HubItem {
  to: string
  title: string
  subtitle: string
  icon: IconName
  tone?: 'blue' | 'orange'
}

/* ---------- OHRR host app ---------- */
export const OHRR_TABS: TabItem[] = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/adopt', label: 'Adopt', icon: 'heart' },
  { to: '/tails', label: 'Tails', icon: 'sparkles' },
  { to: '/learn', label: 'Learn', icon: 'book' },
  { to: '/volunteer', label: 'Volunteer', icon: 'users' },
  { to: '/support', label: 'Support', icon: 'gift' },
]

export const OHRR_HUB: HubItem[] = [
  { to: '/adopt', title: 'Adopt a Rabbit', subtitle: 'Meet adoptable buns & apply', icon: 'heart' },
  { to: '/tails', title: 'Happy Tails', subtitle: 'See where adopted bunnies are now', icon: 'sparkles' },
  { to: '/learn', title: 'Rabbit Care', subtitle: 'Diet, housing, bonding & more', icon: 'book' },
  { to: '/volunteer', title: 'Volunteer', subtitle: 'Give your time to the buns', icon: 'users' },
  { to: '/support', title: 'Support OHRR', subtitle: 'Donate & ways to help', icon: 'gift', tone: 'orange' },
  { to: '/about', title: 'About OHRR', subtitle: 'Our mission, story & contact', icon: 'info' },
]

/* ---------- Midwest BunFest sub-app (all routes under /bunfest) ---------- */
export const BUNFEST_TABS: TabItem[] = [
  { to: '/bunfest', label: 'BunFest', icon: 'star', end: true },
  { to: '/bunfest/schedule', label: 'Schedule', icon: 'calendar' },
  { to: '/bunfest/vendors', label: 'Vendors', icon: 'bag' },
  { to: '/bunfest/visit', label: 'Visit', icon: 'mappin' },
  { to: '/bunfest/give', label: 'Give', icon: 'heart' },
]

export const BUNFEST_HUB: HubItem[] = [
  { to: '/bunfest/schedule', title: 'Education Schedule', subtitle: 'Talks from rabbit experts & vets', icon: 'calendar' },
  { to: '/bunfest/vendors', title: 'Vendor Marketplace', subtitle: 'Specialty rabbit shopping', icon: 'bag' },
  { to: '/bunfest/partners', title: 'Rescue Partners', subtitle: 'Rabbit rescues across the Midwest', icon: 'users' },
  { to: '/bunfest/sponsors', title: 'Sponsors', subtitle: 'The businesses behind BunFest', icon: 'award' },
  { to: '/bunfest/visit', title: 'Plan Your Visit', subtitle: 'Date, location & what to bring', icon: 'mappin' },
  { to: '/bunfest/give', title: 'Support OHRR', subtitle: 'Donate & ways to help all year', icon: 'heart', tone: 'orange' },
]
