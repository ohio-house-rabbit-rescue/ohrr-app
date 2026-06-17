import { Link } from 'react-router-dom'
import { Icon } from './icons'

export default function OhrrTopBar() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-brand-blue px-4 py-2.5 text-white shadow-sm">
      <Link to="/" className="flex items-center gap-2.5">
        <span className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm">
          <img src="/ohrr-mark.png" alt="" className="h-9 w-9 object-contain" />
        </span>
        <span className="leading-tight">
          <span className="block font-display text-[15px] font-extrabold">
            Ohio House Rabbit Rescue
          </span>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-white/70">
            Columbus, Ohio
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
      </div>
    </header>
  )
}
