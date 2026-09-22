import { useLocation, useNavigate } from 'react-router-dom'
import { Icon } from './icons'
import { BUNFEST_TABS, OHRR_TABS } from '../data/content'

// The back arrow in every top bar, on every screen that is not a tab root.
// It steps back through the app's own history; when the app was opened
// straight onto this screen (a shared link, a printed tag, a notification)
// there is nothing to step back to, so it goes UP to the nearest tab root
// instead — the button never leaves the app and never does nothing.
const ROOTS = new Set<string>([...OHRR_TABS, ...BUNFEST_TABS].map((t) => t.to))

function trim(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/'
}

/** The nearest tab root above `pathname` ("/learn/breeds/holland-lop" → "/learn"). */
export function parentPath(pathname: string): string {
  const parts = trim(pathname).split('/').filter(Boolean)
  while (parts.length > 0) {
    parts.pop()
    const p = '/' + parts.join('/')
    if (ROOTS.has(p)) return p
  }
  return '/'
}

export function isRootPath(pathname: string): boolean {
  return ROOTS.has(trim(pathname))
}

// React Router keeps its position in history.state.idx; 0 = the first screen
// this app instance showed, so there is nowhere in-app to go back to.
function canGoBack(): boolean {
  const state = window.history.state as { idx?: number } | null
  return typeof state?.idx === 'number' && state.idx > 0
}

export default function BackButton({
  className = '',
  always = false,
  fallback,
  label,
}: {
  className?: string
  /** Show even on a tab root (the staff area has its own roots). */
  always?: boolean
  /** Where to go when there is no history — default: the nearest tab root. */
  fallback?: string
  /** Show the word too (the staff screens do — it reads as a control, not an icon). */
  label?: string
}) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  if (!always && isRootPath(pathname)) return null
  const onClick = () => {
    if (canGoBack()) navigate(-1)
    else navigate(fallback ?? parentPath(pathname), { replace: true })
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back"
      className={`inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full text-sm font-bold transition ${
        label ? '' : 'w-10'
      } ${className}`}
    >
      <Icon name="arrowLeft" size={22} />
      {label}
    </button>
  )
}
