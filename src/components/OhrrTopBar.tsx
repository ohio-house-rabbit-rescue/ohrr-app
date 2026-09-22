import { Link, useLocation } from 'react-router-dom'
import HeaderActions from './HeaderActions'
import BackButton, { isRootPath } from './BackButton'

// On a tab root: mark + name. Anywhere deeper: a Back arrow joins them, and on
// a narrow phone the name gives way so Back, the mark and the three actions
// all keep their full size.
export default function OhrrTopBar() {
  const { pathname } = useLocation()
  const deep = !isRootPath(pathname)
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-brand-blue px-3 py-2.5 text-white shadow-sm">
      <div className="flex min-w-0 items-center gap-1.5">
        <BackButton className="bg-white/15 hover:bg-white/25" />
        <Link to="/" className="flex min-w-0 items-center gap-2.5 pl-1">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm">
            <img src="/ohrr-mark.png" alt="" className="h-9 w-9 object-contain" />
          </span>
          <span className={`min-w-0 leading-tight ${deep ? 'hidden min-[430px]:block' : ''}`}>
            <span className="line-clamp-2 font-display text-[15px] font-extrabold leading-[1.1]">Ohio House Rabbit Rescue</span>
            <span className="hidden text-[10px] font-bold uppercase tracking-wider text-white/70 min-[430px]:block">Columbus, Ohio</span>
          </span>
        </Link>
      </div>
      <HeaderActions />
    </header>
  )
}
