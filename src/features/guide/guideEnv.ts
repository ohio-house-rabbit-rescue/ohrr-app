// What the guided start needs from the app around it — the one file of the guide that differs between the
// app and the website (the website's copy is src/features/guide/guideEnv.ts there). Everything else in this
// folder is identical in both.
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import type { RouteKey } from './walkthrough'

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
export const GUIDE_ROUTES: Record<RouteKey, { to: string; match: string; title: string }> = {
  account: { to: '/staff/account', match: '/staff/account', title: 'My account' },
  'my-hours': { to: '/staff/my-hours', match: '/staff/my-hours', title: 'My volunteer hours' },
  announcements: { to: '/staff/announcements', match: '/staff/announcements', title: 'Announcements' },
  'post-queue': { to: '/staff/posts', match: '/staff/posts', title: 'Post queue' },
  inbox: { to: '/staff/inbox', match: '/staff/inbox', title: 'Inbox' },
  bookings: { to: '/staff/adoptions', match: '/staff/adoptions', title: 'Adoptions' },
  calls: { to: '/staff/calls', match: '/staff/calls', title: 'Volunteer calls' },
}

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
export const LEVEL_PATH = (key: string) => `/staff/guide/${key}`
