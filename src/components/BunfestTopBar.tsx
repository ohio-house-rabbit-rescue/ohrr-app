import { Link } from 'react-router-dom'
import { Icon } from './icons'
import HeaderActions from './HeaderActions'

export default function BunfestTopBar() {
  return (
    <header className="sticky top-0 z-30 bg-gradient-to-r from-brand-blue to-brand-blue-dark text-white shadow-sm">
      {/* Returning to the OHRR app is handled by the "OHRR" tab in the bottom bar. */}
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
        <HeaderActions />
      </div>
    </header>
  )
}
