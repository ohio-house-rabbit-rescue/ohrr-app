// The browser tab's title, per screen.
//
// Every page used to read "Midwest BunFest · Ohio House Rabbit Rescue" — the
// bundled index.html title — which is invisible inside the phone app but wrong
// everywhere else: browser tabs, bookmarks, history, and the text a shared link
// shows. Pages that already set their own title (My Bunny, a rabbit, a breed)
// keep it; this fills in the rest from the path.
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SUFFIX = 'Ohio House Rabbit Rescue'

// Longest match wins, so '/learn/breeds' beats '/learn'.
const TITLES: [string, string][] = [
  ['/adopt/apply', 'Adoption application'],
  ['/adopt/how-it-works', 'How adopting works'],
  ['/adopt', 'Adopt a rabbit'],
  ['/my-bunny/help', 'Bunny Help'],
  ['/my-bunny', 'My Bunny'],
  ['/learn/breeds', 'Breed guide'],
  ['/learn', 'Rabbit care'],
  ['/info/is-a-rabbit-right-for-us', 'Is a rabbit right for us?'],
  ['/info/legacy-fund', 'OHRR Legacy Fund'],
  ['/info', 'Rabbit care'],
  ['/vets', 'Find a rabbit-savvy vet'],
  ['/found/report', 'Report a found rabbit'],
  ['/found', 'Found a rabbit?'],
  ['/volunteer/foster', 'Foster a rabbit'],
  ['/volunteer', 'Volunteer'],
  ['/services', 'Bunny services'],
  ['/book/cancel', 'Your booking'],
  ['/book', 'Book a time'],
  ['/events', 'Events'],
  ['/impact', 'Our impact'],
  ['/support/become-a-supporter', 'Become a Supporter'],
  ['/support', 'Support OHRR'],
  ['/hop-shop', 'Hop Shop'],
  ['/tails/share', 'Share your Happy Tail'],
  ['/tails', 'Happy Tails'],
  ['/surrender', 'Surrender a rabbit'],
  ['/partners/perks', 'Supporter perks'],
  ['/partners', 'Partners'],
  ['/rescues', 'Rescue partners'],
  ['/mailing-list', 'Join the mailing list'],
  ['/raffle/tickets', 'Your raffle tickets'],
  ['/about', 'About OHRR'],
  ['/settings', 'Settings'],
  ['/account', 'My OHRR'],
  ['/privacy', 'Privacy'],
  ['/help', 'Help & FAQ'],
  ['/search', 'Search'],
  ['/appointment', 'Schedule a visit'],
  ['/t/', 'Scanned item'],
  ['/staff/account', 'My account'],
  ['/staff/supporters', 'Supporters'],
  ['/staff/notifications', 'Send a notification'],
  ['/staff/wish-list', 'Wish list items'],
  ['/staff', 'Staff'],
]

// The BunFest sub-app carries the festival's name instead of OHRR's.
const BUNFEST: [string, string][] = [
  ['/bunfest/schedule', 'Education schedule'],
  ['/bunfest/vendors', 'Vendors'],
  ['/bunfest/partners', 'Rescue partners'],
  ['/bunfest/sponsors', 'Sponsors'],
  ['/bunfest/visit', 'Plan your visit'],
  ['/bunfest/map', 'Event map'],
  ['/bunfest/auction', 'Silent auction'],
  ['/bunfest/give', 'Support OHRR'],
  ['/bunfest', ''],
]

function titleFor(pathname: string): string {
  if (pathname === '/') return `${SUFFIX} — every bunny deserves a home`
  const bunfest = BUNFEST.find(([p]) => pathname === p || pathname.startsWith(p + '/'))
  if (bunfest) return bunfest[1] ? `${bunfest[1]} · Midwest BunFest` : 'Midwest BunFest · Presented by OHRR'
  const hit = TITLES.find(([p]) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p))
  return hit ? `${hit[1]} · ${SUFFIX}` : SUFFIX
}

export default function PageTitle() {
  const { pathname } = useLocation()
  useEffect(() => {
    document.title = titleFor(pathname)
  }, [pathname])
  return null
}
