// What the guided start needs from the app around it — the one file of the guide that differs between the
// app and the website (the website's copy is src/features/guide/guideEnv.ts there). Everything else in this
// folder is identical in both.
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import type { RouteKey } from './walkthrough'
import { SHARE_SITE } from '../share/templates'
import { useFeatureFlag } from '../settings/useSetting'
import { BUNFEST_SECTION_FLAG } from '../settings/features'

export { supabase }

/** Who is looking: the signed-in person and their place on the team. */
export function useGuideWho(): { ready: boolean; userId: string | null; orgId: string | null; membershipId: string | null } {
  const { loading, user, membership } = useAuth()
  return { ready: !loading, userId: user?.id ?? null, orgId: membership?.orgId ?? null, membershipId: membership?.id ?? null }
}

/**
 * Each route key: where it goes, the staff-menu entry that says this person may open it (`match`, compared with
 * the tiles in staffTiles.ts), and the page's real title.
 */
export const GUIDE_ROUTES: Record<RouteKey, { to: string; match: string; title: string; external?: boolean; note?: string }> = {
  account: { to: '/staff/account', match: '/staff/account', title: 'My account' },
  'my-hours': { to: '/staff/my-hours', match: '/staff/my-hours', title: 'My volunteer hours' },
  announcements: { to: '/staff/announcements', match: '/staff/announcements', title: 'Announcements' },
  'post-queue': { to: '/staff/posts', match: '/staff/posts', title: 'Post queue' },
  inbox: { to: '/staff/inbox', match: '/staff/inbox', title: 'Inbox' },
  bookings: { to: '/staff/adoptions', match: '/staff/adoptions', title: 'Adoptions' },
  calls: { to: '/staff/calls', match: '/staff/calls', title: 'Volunteer calls' },
  rabbits: { to: '/staff/adopt', match: '/staff/adopt', title: 'Adoptable rabbits' },
  // The public Adopt page: always open (no menu entry needed).
  'adopt-page': { to: '/adopt', match: '', title: 'Adopt a Rabbit' },
  tails: { to: '/staff/tails', match: '/staff/tails', title: 'Happy Tails' },
  scan: { to: '/staff/scan', match: '/staff/scan', title: 'Scan an item' },
  items: { to: '/staff/items', match: '/staff/items', title: 'Items' },
  'receive-items': { to: '/staff/catalog', match: '/staff/catalog', title: 'Receive items' },
  hopshop: { to: '/staff/hopshop', match: '/staff/hopshop', title: 'Hop Shop' },
  shelf: { to: '/staff/hopshop?show=list', match: '/staff/hopshop', title: 'On the shelf' },
  reorder: { to: '/staff/hopshop/reorder', match: '/staff/hopshop', title: 'Reorder list' },
  deliveries: { to: '/staff/hopshop/deliveries', match: '/staff/hopshop', title: 'Deliveries' },
  // The money page of the guide itself: always open.
  money: { to: '/staff/guide/money', match: '', title: 'What the app does with money' },
  sell: { to: '/staff/counter', match: '/staff/counter', title: 'Sell' },
  'sell-today': { to: '/staff/counter/today', match: '/staff/counter', title: 'Today’s sales' },
  events: { to: '/staff/events', match: '/staff/events', title: 'Events' },
  'bunfest-content': { to: '/staff/bunfest', match: '/staff/bunfest', title: 'Midwest BunFest' },
  'bunny-registrations': { to: '/staff/bunfest/bunnies', match: '/staff/bunfest/bunnies', title: 'Bunny registrations' },
  raffle: { to: '/staff/raffle-tickets', match: '/staff/raffle-tickets', title: 'Raffle tickets' },
  // Public pages: always open.
  'public-events': { to: '/events', match: '', title: 'Events' },
  'public-shop': { to: '/hop-shop', match: '', title: 'Hop Shop' },
  // Level 1, the public side: the home screen, BunFest, and the Settings card that puts an icon on the phone.
  'public-home': { to: '/', match: '', title: 'the public home screen' },
  'public-bunfest': { to: '/bunfest', match: '', title: 'Midwest BunFest' },
  // The visitors' tour ends on Help.
  'public-help': { to: '/help', match: '', title: 'Help & FAQ' },
  install: {
    to: '/settings',
    match: '',
    title: 'Settings',
    note: 'Look for “Put OHRR on your phone.” If it isn’t there, the app is already on this phone.',
  },
  // The other site, in a new tab: its public pages, and its Staff side (which asks for a sign-in there).
  'other-site': { to: `${SHARE_SITE}/adopt`, match: '', title: 'the new website', external: true },
  'other-staff': { to: `${SHARE_SITE}/staff`, match: '', title: 'the new website', external: true },
}

/** Stops the visitors' tour leaves out right now: BunFest while its section is switched off (Staff → Features). */
export function useTourOff(): ReadonlySet<RouteKey> {
  const { value: on, loading } = useFeatureFlag(BUNFEST_SECTION_FLAG, true)
  return new Set<RouteKey>(!loading && !on ? ['public-bunfest'] : [])
}

/** Where a visitor finds the tour again (the last line of its Done card). */
export const TOUR_FIND = 'This tour is always under Help: tap the question mark at the top.'

/** Where the Welcome page's "I have my invitation" goes: the join screen (an invite link carries its code). */
export const JOIN = { href: `/account?next=${encodeURIComponent('/staff/join')}&create=1`, external: false }

/** Where "I already have an account" goes: the staff home, which asks for a sign-in first. */
export const SIGN_IN = { href: '/staff', external: false }

/** The Welcome page's picture: a real OHRR photo already bundled with the app. */
export const WELCOME_PHOTO = '/img/ohrr/adoption-rescued-favorite-breed.jpg'

/** Pictures for the Done screens: the credited sample bunnies (Settings → About lists the credits). */
export const DONE_PHOTOS = [
  '/sample-bunnies/bunny-lionhead-white.jpg',
  '/sample-bunnies/bunny-lop-caramel.jpg',
  '/sample-bunnies/bunny-silver.jpg',
  '/sample-bunnies/bunny-spotted.jpg',
  '/sample-bunnies/bunny-grey-lop.jpg',
  '/sample-bunnies/bunny-lop-orange.jpg',
  '/sample-bunnies/bunny-brown.jpg',
  '/sample-bunnies/bunny-grey-dwarf.jpg',
  '/sample-bunnies/bunny-lop-black.jpg',
]

/** The padding classes of a guide page inside the staff area, and of the Welcome page outside it. */
export const PAGE_CLASS = 'space-y-5 px-5 py-5'
export const PUBLIC_PAGE_CLASS = 'space-y-5 px-5 py-5'

/** Staff pages in this app. */
export const TRAIL_PATH = '/staff/guide'
export const MONEY_PATH = '/staff/guide/money'
export const FLOWS_PATH = '/staff/guide/flows'
/** The printable handout: outside the staff area, so anyone with the link can print it. */
export const PRINT_PATH = '/welcome/print'
/** The "you finished, what next" page, and the "you're on the team" page shown right after joining. */
export const NEXT_PATH = '/staff/guide/next'
export const JOINED_PATH = '/staff/joined'
/** Where the phone app is for steps that only the phone app has (none on the app itself). */
export const PHONE_APP_URL = ''
export const LEVEL_PATH = (key: string) => `/staff/guide/${key}`
