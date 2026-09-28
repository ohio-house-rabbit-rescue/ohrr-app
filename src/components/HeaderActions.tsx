import { Link, useLocation } from 'react-router-dom'
import { Icon, type IconName } from './icons'
import { useAuth } from '../lib/auth'
import { firstName, useMyName } from '../features/account/profile'
import { useForYou } from '../features/account/forYouCounts'

// The persistent right-side header actions — Search, Help, Settings, and My
// OHRR — shown on every screen (both the OHRR app and the BunFest sub-app) so
// they're always in the same place. Search & Help remember where you came from
// via `?from=`. Each one has its word under the icon (persona audit,
// 2026-09-28: a bare "?" read as either Bunny Help or help with the app); the
// word is the button's accessible name. The bar keeps its 60px height, and at
// 10px (the size of a phone's own tab labels) all four fit a 375px phone with
// "Ohio House / Rabbit Rescue" still on two lines beside them.
const cls =
  'relative inline-flex h-10 min-w-10 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl bg-white/15 px-[3px] transition hover:bg-white/25'
const word = 'text-[10px] font-bold leading-tight'

function Action({ to, icon, label }: { to: string; icon: IconName; label: string }) {
  return (
    <Link to={to} className={cls}>
      <Icon name={icon} size={20} />
      <span className={word}>{label}</span>
    </Link>
  )
}

export default function HeaderActions() {
  const { pathname, search } = useLocation()
  const from = encodeURIComponent(pathname + search)
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Action to={`/search?from=${from}`} icon="search" label="Search" />
      <Action to={`/help?from=${from}`} icon="help" label="Help" />
      <Action to="/settings" icon="settings" label="Settings" />
      <AccountButton />
    </div>
  )
}

/**
 * The way into My OHRR (update 31): "Sign in" when signed out, their first
 * name when signed in, and a count when something's new for them.
 */
function AccountButton() {
  const { configured, user } = useAuth()
  const name = firstName(useMyName(user?.id))
  const { total } = useForYou()
  if (!configured) return null
  const label = user ? name || 'My OHRR' : 'Sign in'
  // Starts with the word on screen, so a spoken "tap Sign in" finds it too.
  const spoken = user ? (name ? `${name}, My OHRR` : 'My OHRR') : 'Sign in'
  return (
    <Link
      to="/account"
      aria-label={total > 0 ? `${spoken}, ${total} new for you` : spoken}
      className={cls}
    >
      {user && name ? (
        <span aria-hidden className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-black text-brand-blue">
          {name.slice(0, 1).toUpperCase()}
        </span>
      ) : (
        <Icon name="user" size={20} />
      )}
      <span className={`${word} max-w-12 truncate`}>{label}</span>
      {total > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-orange px-1 text-[11px] font-black text-ink shadow-sm">
          {total > 9 ? '9+' : total}
        </span>
      )}
    </Link>
  )
}
