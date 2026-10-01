// Every staff page, the group it belongs to and who may open it — the one
// list the dashboard, the group pages and the staff menu all read.
//
// OHRR, 2026-10-01: "too many in the list and you have to scroll a long way …
// bin these into groups and simplify the look and feel." So the dashboard is
// a short "Today" row (Inbox, Bookings, Counter, Scan) and eight groups; each
// group opens a short list. Adding a page later = one line in TILES below.
//
// Each `show` is the same permission check the old dashboard and menu used.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useAllAccess } from '../../lib/allAccess'
import { useMyLevel } from '../../lib/staffLevels'
import { PERMISSION_CATALOG } from '../../lib/capabilities'
import type { IconName } from '../../components/icons'

export type GroupKey = 'items' | 'rabbits' | 'volunteers' | 'events' | 'word' | 'giving' | 'admin' | 'me'

export interface StaffGroup {
  key: GroupKey
  title: string
  /** Three to five words under the group's name. */
  hint: string
  icon: IconName
}

export const GROUPS: StaffGroup[] = [
  { key: 'items', title: 'Items and Hop Shop', hint: 'Donations, inventory, labels', icon: 'box' },
  { key: 'rabbits', title: 'Rabbits and care', hint: 'Adoptions, guides, vets', icon: 'heart' },
  { key: 'volunteers', title: 'Volunteers', hint: 'Calls, roster, shifts', icon: 'users' },
  { key: 'events', title: 'Events and BunFest', hint: 'Auction, raffle, sponsors', icon: 'ticket' },
  { key: 'word', title: 'Getting the word out', hint: 'Posts, flyers, notices', icon: 'sparkles' },
  { key: 'giving', title: 'Supporters and giving', hint: 'Email list, wish list', icon: 'gift' },
  { key: 'admin', title: 'Admin', hint: 'Team, features, details', icon: 'settings' },
  { key: 'me', title: 'Me', hint: 'Your account, your hours', icon: 'user' },
]

export interface StaffTile {
  to: string
  title: string
  /** One short line under the title. */
  hint: string
  icon: IconName
  /** Its group; the Inbox has none (it lives in the Today row). */
  group?: GroupKey
  /** Also in the Today row at the top of the dashboard. */
  today?: boolean
  /** Something waiting (new requests, bookings to confirm, posts ready). */
  badge?: number
}

/** The Today row, always in this order. */
const TODAY_ORDER = ['/staff/inbox', '/staff/bookings', '/staff/counter', '/staff/scan']

export interface StaffTiles {
  /** Every page this person may open, in group order. */
  tiles: StaffTile[]
  today: StaffTile[]
  /** The groups this person has at least one page in, with their pages. */
  groups: (StaffGroup & { tiles: StaffTile[]; badge: number })[]
  /** A counter volunteer: the till and the door, nothing else. */
  counterOnly: boolean
  /** No tasks switched on yet (only "Me"). */
  nothingYet: boolean
  isAdminish: boolean
}

/** The waiting counts cost a database call each, so only the dashboard asks for them. */
export function useStaffTiles({ counts = false }: { counts?: boolean } = {}): StaffTiles {
  const { user, membership, can, capabilities } = useAuth()
  const { allAccess } = useAllAccess()
  const myLevel = useMyLevel(user?.id, membership?.orgId)
  const orgId = membership?.orgId ?? null
  const newCount = useCount('count_new_requests', counts && orgId && can('inbox.manage') ? orgId : null)
  const pendingCount = useCount('count_pending_bookings', counts && orgId && can('bookings.manage') ? orgId : null)
  const readyPosts = useCount('count_ready_posts', counts && orgId && (can('announcements.post') || can('social.publish')) ? orgId : null)

  return useMemo(() => {
    const isAdminish = membership?.role === 'owner' || membership?.role === 'admin'
    const counterOnly = can('counter.use') && !isAdminish && capabilities.size === 1
    const canItems = can('events.bunfest.manage') || can('hopshop.products.create') || can('hopshop.products.edit') || can('hopshop.inventory.update')
    const canCounter = can('counter.use') || can('events.bunfest.manage') || can('hopshop.products.create') || can('hopshop.inventory.update')
    const canSeeHopShop = Boolean(membership) && !counterOnly && (isAdminish || PERMISSION_CATALOG.some((p) => p.area === 'Hop Shop' && can(p.key)))
    const canAdopt = can('adoptions.listings.create') || can('adoptions.listings.edit') || can('adoptions.status.change')
    const canCare = can('content.education.edit')
    const canVolunteer = can('volunteers.shifts.manage')
    const canBookings = can('bookings.manage')
    const canEvents = can('events.bunfest.manage')
    const canPost = can('announcements.post')

    const all: (StaffTile & { show: boolean })[] = [
      // Today (also listed in their groups)
      { to: '/staff/inbox', title: 'Inbox', hint: newCount > 0 ? `${newCount} new waiting` : 'Appointments, sign-ups, messages', icon: 'mail', today: true, badge: newCount, show: can('inbox.manage') },

      // Items and Hop Shop
      { to: '/staff/catalog', title: 'Add a donation', hint: 'Photo, name, how many, value', icon: 'camera', group: 'items', show: canItems },
      { to: '/staff/items', title: 'Items', hint: 'Donations to sort, baskets, auction and raffle', icon: 'box', group: 'items', show: canItems },
      { to: '/staff/hopshop', title: 'Hop Shop inventory', hint: 'What the shop carries, stock, reorder', icon: 'store', group: 'items', show: canSeeHopShop },
      { to: '/staff/hopshop/deliveries/new', title: 'Add a delivery', hint: 'Stock from the supplier’s invoice', icon: 'box', group: 'items', show: can('hopshop.inventory.update') || can('hopshop.products.edit') || can('hopshop.products.create') },
      { to: '/staff/dropoffs', title: 'Drop-offs and thank-yous', hint: 'Who gave what, the letter', icon: 'mail', group: 'items', show: canItems },
      { to: '/staff/donations/report', title: 'Monthly donations report', hint: 'Totals, by donor, a spreadsheet', icon: 'book', group: 'items', show: canItems },
      { to: '/staff/labels', title: 'Print labels', hint: 'Codes for items, any label size', icon: 'printer', group: 'items', show: canItems },
      { to: '/staff/scan', title: 'Scan an item', hint: 'See, change or sort a labelled item', icon: 'scan', group: 'items', today: true, show: canItems },
      { to: '/staff/counter', title: 'Counter', hint: 'Sell, the till, door tickets', icon: 'bag', group: 'items', today: true, show: canCounter },

      // Rabbits and care
      { to: '/staff/adopt', title: 'Adoptable rabbits', hint: 'Rabbits, photos, adoption status', icon: 'heart', group: 'rabbits', show: canAdopt },
      { to: '/staff/tails', title: 'Happy Tails', hint: 'Adopters’ stories', icon: 'sparkles', group: 'rabbits', show: canCare || can('inbox.manage') },
      { to: '/staff/learn', title: 'Care guides and pages', hint: 'Rabbit Care articles, Give, Adopt, About', icon: 'book', group: 'rabbits', show: canCare },
      { to: '/staff/bunny-help', title: 'Bunny Help topics', hint: 'What “My bunny is…” answers', icon: 'help', group: 'rabbits', show: canCare },
      { to: '/staff/vets', title: 'Vet directory', hint: 'Rabbit-savvy vets in Find a vet', icon: 'vet', group: 'rabbits', show: canCare },

      // Volunteers
      { to: '/staff/calls', title: 'Volunteer calls', hint: 'Put out a need, check in, thank', icon: 'heart', group: 'volunteers', show: canVolunteer || canBookings },
      { to: '/staff/volunteers', title: 'Volunteers', hint: 'The roster and their hours', icon: 'users', group: 'volunteers', show: canVolunteer || canBookings },
      { to: '/staff/volunteer', title: 'Volunteer opportunities', hint: 'Shifts, transport runs, events', icon: 'calendar', group: 'volunteers', show: canVolunteer },
      { to: '/staff/bookings', title: 'Bookings', hint: pendingCount > 0 ? `${pendingCount} to confirm` : 'Shifts and appointments', icon: 'calendar', group: 'volunteers', today: true, badge: pendingCount, show: canBookings },

      // Events and BunFest
      { to: '/staff/events', title: 'Events', hint: 'BunFest and OHRR hoppenings', icon: 'calendar', group: 'events', show: canEvents },
      { to: '/staff/bunfest', title: 'BunFest content', hint: 'Schedule, vendors, rescues', icon: 'star', group: 'events', show: canEvents },
      { to: '/staff/raffle', title: 'Silent Auction', hint: 'Auction items, photos, won', icon: 'award', group: 'events', show: canEvents },
      { to: '/staff/auction-desk', title: 'Auction desk', hint: 'Close and charge, pickup, shipping', icon: 'gavel', group: 'events', show: canEvents },
      { to: '/staff/raffle-tickets', title: 'Raffle tickets', hint: 'The raffle table, draw winners', icon: 'ticket', group: 'events', show: canEvents || can('counter.use') },
      { to: '/staff/sponsors', title: 'Sponsors and partners', hint: 'Roster, perks, placements', icon: 'award', group: 'events', show: canEvents },
      { to: '/staff/sponsors/renewals', title: 'Sponsor renewals', hint: 'Who to ask next', icon: 'calendar', group: 'events', show: canEvents },

      // Getting the word out
      { to: '/staff/announcements', title: 'Announcements', hint: 'Notices on the app home', icon: 'gift', group: 'word', show: canPost },
      { to: '/staff/home-screen', title: 'Home screen', hint: 'The big cards on the app and website', icon: 'home', group: 'word', show: canPost },
      { to: '/staff/posts', title: 'Post queue', hint: readyPosts > 0 ? `${readyPosts} ready to post` : 'Premade posts, one tap', icon: 'mail', group: 'word', badge: readyPosts, show: canPost || can('social.publish') || can('social.approve') },
      { to: '/staff/share', title: 'Share kit', hint: 'Posts for Instagram, Facebook, TikTok', icon: 'sparkles', group: 'word', show: canPost },
      { to: '/staff/flyers', title: 'Flyers', hint: 'QR posters to print or share', icon: 'printer', group: 'word', show: canPost },
      { to: '/staff/outreach', title: 'Outreach letters', hint: 'Emails to vets, stores, schools', icon: 'mail', group: 'word', show: canPost },
      { to: '/staff/notifications', title: 'Send a notification', hint: 'To phones that asked for it', icon: 'device', group: 'word', show: can('notifications.send') },
      { to: '/staff/impact', title: 'Impact numbers', hint: 'The year in numbers', icon: 'star', group: 'word', show: canPost },

      // Supporters and giving
      { to: '/staff/supporters', title: 'Supporters', hint: 'The email list and interests', icon: 'mail', group: 'giving', show: can('supporters.view') },
      { to: '/staff/wish-list', title: 'Wish list items', hint: 'Amazon wish list buttons', icon: 'gift', group: 'giving', show: can('giving.wishlist') },
      { to: '/staff/guardians', title: 'Rescue Rabbit Guardians', hint: 'The Legacy Fund thank-you list', icon: 'heart', group: 'giving', show: can('giving.guardians') },

      // Admin
      { to: '/staff/team', title: 'Team', hint: 'Invite staff, who can do what', icon: 'users', group: 'admin', show: can('staff.invite') || can('staff.permissions.manage') },
      { to: '/staff/activity', title: 'Activity', hint: 'Who changed what, and when', icon: 'clock', group: 'admin', show: can('audit.view') },
      { to: '/staff/features', title: 'Features', hint: 'Show or hide whole features', icon: 'settings', group: 'admin', show: allAccess },
      { to: '/staff/details', title: 'OHRR details', hint: 'Hours, phone, address, a notice', icon: 'mappin', group: 'admin', show: can('settings.manage') },

      // Me
      { to: '/staff/account', title: 'My account', hint: 'Name, photo, level and access', icon: 'user', group: 'me', show: Boolean(membership) },
      { to: '/staff/my-hours', title: 'My volunteer hours', hint: 'Log time that isn’t a shift', icon: 'clock', group: 'me', show: myLevel.ready },
    ]
    const tiles = all.filter((t) => t.show).map(({ show: _show, ...t }) => t)
    const groups = GROUPS.map((g) => {
      const list = tiles.filter((t) => t.group === g.key)
      return { ...g, tiles: list, badge: list.reduce((n, t) => n + (t.badge ?? 0), 0) }
    }).filter((g) => g.tiles.length > 0)
    return {
      tiles,
      today: TODAY_ORDER.map((to) => tiles.find((t) => t.to === to && t.today)).filter((t): t is StaffTile => Boolean(t)),
      groups,
      counterOnly,
      nothingYet: groups.every((g) => g.key === 'me'),
      isAdminish,
    }
  }, [membership, can, capabilities, allAccess, myLevel.ready, newCount, pendingCount, readyPosts])
}

/** Where a page sits, for the menu label: its group and its own title. */
export function placeOf(pathname: string, tiles: StaffTile[]): { group?: StaffGroup; tile?: StaffTile } {
  const g = /^\/staff\/g\/([a-z]+)/.exec(pathname)
  if (g) return { group: GROUPS.find((x) => x.key === g[1]) }
  // Longest match wins, so /staff/sponsors/renewals isn't labelled /staff/sponsors.
  const tile = tiles.filter((t) => pathname === t.to || pathname.startsWith(`${t.to}/`)).sort((a, b) => b.to.length - a.to.length)[0]
  return { tile, group: tile ? GROUPS.find((x) => x.key === tile.group) : undefined }
}

/** A waiting count from one of the count_* functions; 0 while loading or without access. */
function useCount(fn: 'count_new_requests' | 'count_pending_bookings' | 'count_ready_posts', orgId: string | null): number {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!orgId) return
    let alive = true
    supabase.rpc(fn, { p_org: orgId }).then(({ data }) => alive && typeof data === 'number' && setN(data))
    return () => {
      alive = false
    }
  }, [fn, orgId])
  return n
}
