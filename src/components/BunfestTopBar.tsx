import { Link } from 'react-router-dom'
import { Icon } from './icons'
import HeaderActions from './HeaderActions'

export default function BunfestTopBar() {
  return (
    <header className="sticky top-0 z-30 bg-gradient-to-r from-brand-blue to-brand-blue-dark text-white shadow-sm">
      {/* Prominent, button-style return to the OHRR app */}
      <Link
        to="/"
        className="flex items-center gap-2.5 bg-black/25 px-4 py-2.5 font-extrabold text-white transition hover:bg-black/35"
      >
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20">
          <Icon name="arrowLeft" size={15} />
        </span>
        <span className="text-sm">Back to Ohio House Rabbit Rescue</span>
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
        <HeaderActions />
      </div>
    </header>
  )
}
