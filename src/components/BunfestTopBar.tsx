import { Link, useLocation } from 'react-router-dom'
import { Icon } from './icons'
import HeaderActions from './HeaderActions'
import BackButton, { isRootPath } from './BackButton'

export default function BunfestTopBar() {
  const { pathname } = useLocation()
  const deep = !isRootPath(pathname)
  return (
    <header className="sticky top-0 z-30 bg-gradient-to-r from-brand-blue to-brand-blue-dark text-white shadow-sm">
      {/* Returning to the OHRR app is handled by the "OHRR" tab in the bottom bar;
          Back steps through BunFest's own screens. */}
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <BackButton className="bg-white/15 hover:bg-white/25" />
          <Link to="/bunfest" className="flex min-w-0 items-center gap-2.5 pl-1">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-orange text-white shadow-sm">
              <Icon name="star" size={22} />
            </span>
            <span className={`min-w-0 leading-tight ${deep ? 'hidden min-[430px]:block' : ''}`}>
              {/* Two lines on a narrow phone, as the OHRR bar does, so the four actions keep their size. */}
              <span className="line-clamp-2 font-display text-[17px] font-extrabold leading-[1.1] min-[430px]:text-xl">Midwest BunFest</span>
              <span className="hidden text-[10px] font-bold uppercase tracking-wider text-white/75 min-[430px]:block">Presented by OHRR</span>
            </span>
          </Link>
        </div>
        <HeaderActions />
      </div>
    </header>
  )
}
