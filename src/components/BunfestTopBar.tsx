import { Link } from 'react-router-dom'
import { Icon } from './icons'

export default function BunfestTopBar() {
  return (
    <header className="sticky top-0 z-30 bg-gradient-to-r from-brand-blue to-brand-blue-dark text-white shadow-sm">
      {/* Persistent return to the OHRR app */}
      <Link
        to="/"
        className="flex items-center gap-1.5 bg-black/10 px-4 py-1.5 text-xs font-bold text-white/90 transition hover:bg-black/20"
      >
        <Icon name="arrowLeft" size={14} /> Back to Ohio House Rabbit Rescue
      </Link>
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <Link to="/bunfest" className="flex items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-orange text-white shadow-sm">
            <Icon name="star" size={20} />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-xl font-extrabold">Midwest BunFest</span>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-white/75">
              Presented by OHRR
            </span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/settings"
            aria-label="Settings"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/25"
          >
            <Icon name="settings" size={18} />
          </Link>
          <a
            href="https://www.midwestbunfest.org/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Midwest BunFest website"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/25"
          >
            <Icon name="external" size={18} />
          </a>
        </div>
      </div>
    </header>
  )
}
