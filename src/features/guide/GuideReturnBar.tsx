// A thin bar under the top bar: "Back to Level 3: The daily check", shown on a real page a guide step opened.
// Identical in the app and the website; each layout renders it once, the public ones too (Level 1 opens
// public pages).
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from '../../components/icons'
import { clearReturn, readReturn } from './guideReturn'

export default function GuideReturnBar() {
  const { pathname } = useLocation()
  const [gone, setGone] = useState<string | null>(null)
  // On the guide's own pages there is nothing to go back to.
  if (pathname.startsWith('/staff/guide') || pathname.startsWith('/welcome')) return null
  const back = readReturn()
  if (!back || gone === back.to) return null
  return (
    <div className="flex items-center justify-between gap-2 border-t border-brand-orange/30 bg-brand-orange-50 px-2 text-[15px] font-bold">
      <Link to={back.to} className="inline-flex min-h-[44px] min-w-0 items-center gap-1.5 rounded-lg px-2 text-ink">
        <Icon name="arrowLeft" size={17} />
        <span className="truncate">Back to {back.label}</span>
      </Link>
      <button
        type="button"
        onClick={() => {
          clearReturn()
          setGone(back.to)
        }}
        className="min-h-[44px] shrink-0 px-2 text-sm font-bold text-slate-600 underline underline-offset-2"
      >
        Hide
      </button>
    </div>
  )
}
