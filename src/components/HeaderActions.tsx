import { Link, useLocation } from 'react-router-dom'
import { Icon } from './icons'
import { isRootPath } from './BackButton'
import { useAuth } from '../lib/auth'
import { firstName, useMyName } from '../features/account/profile'
import { useForYou } from '../features/account/forYouCounts'

// The persistent right-side header actions — Search, Help, Settings, and My
// OHRR — shown on every screen (both the OHRR app and the BunFest sub-app) so
// they're always in the same place. Search & Help remember where you came from
// via `?from=`.
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
      <AccountButton deep={!isRootPath(pathname)} />
    </div>
  )
}

/**
 * The way into My OHRR (update 31): "Sign in" when signed out, their first
 * name when signed in, and a count when something's new for them. On a tab
 * root the app's name needs the room on a narrow phone, so the words show
 * from 430px (or on any deeper screen, where the name gives way to Back).
 */
function AccountButton({ deep }: { deep: boolean }) {
  const { configured, user } = useAuth()
  const name = firstName(useMyName(user?.id))
  const { total } = useForYou()
  if (!configured) return null
  const label = user ? name || 'My OHRR' : 'Sign in'
  const words = deep ? 'inline' : 'hidden min-[430px]:inline'
  return (
    <Link
      to="/account"
      aria-label={total > 0 ? `${user ? 'My OHRR' : 'Sign in'}, ${total} new for you` : user ? 'My OHRR' : 'Sign in'}
      className="relative inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full bg-white/15 px-2.5 text-sm font-bold transition hover:bg-white/25"
    >
      {user && name ? (
        <span aria-hidden className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-black text-brand-blue">
          {name.slice(0, 1).toUpperCase()}
        </span>
      ) : (
        <Icon name="user" size={20} />
      )}
      <span className={`${words} max-w-[6.5rem] truncate`}>{label}</span>
      {total > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-orange px-1 text-[11px] font-black text-white shadow-sm">
          {total > 9 ? '9+' : total}
        </span>
      )}
    </Link>
  )
}
