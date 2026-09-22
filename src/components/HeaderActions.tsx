import { Link, useLocation } from 'react-router-dom'
import { Icon } from './icons'

// The persistent right-side header actions — Search, Help, Settings — shown on
// every screen (both the OHRR app and the BunFest sub-app) so they're always in
// the same place. Search & Help remember where you came from via `?from=`.
export default function HeaderActions() {
  const { pathname, search } = useLocation()
  const from = encodeURIComponent(pathname + search)
  const cls =
    'inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/25'
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Link to={`/search?from=${from}`} aria-label="Search" className={cls}>
        <Icon name="search" size={22} />
      </Link>
      <Link to={`/help?from=${from}`} aria-label="Help" className={cls}>
        <Icon name="help" size={22} />
      </Link>
      <Link to="/settings" aria-label="Settings" className={cls}>
        <Icon name="settings" size={22} />
      </Link>
    </div>
  )
}
