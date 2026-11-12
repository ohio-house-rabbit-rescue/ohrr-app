// "Look around": the visitors' tour (OHRR, 2026-11-12). The public pages one at a time, one button each, with
// no sign-in. Each button leaves a "Back to Look around" bar on the page it opens (guideReturn + GuideReturnBar;
// the public layouts show that bar to everyone for this tour). The only thing kept is which stops this browser
// has opened. It never mentions the Staff side: that stays hidden from visitors. Identical in the app and the
// website.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/ui'
import { Icon } from '../../components/icons'
import { GUIDE_ROUTES, TOUR_FIND, useTourOff } from './guideEnv'
import { clearReturn, rememberReturn } from './guideReturn'
import { TOUR, TOUR_PATH, TOUR_TITLE } from './walkthrough'
import { GuidePage, ORANGE_BTN, OUTLINE_BTN } from './guideUi'

const SEEN_KEY = 'ohrr.tour.seen'

function readSeen(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((k): k is string => typeof k === 'string') : []
  } catch {
    return []
  }
}

function saveSeen(keys: string[]): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(keys))
  } catch {
    /* no storage: the check marks simply don't stay */
  }
}

export default function LookAround() {
  const off = useTourOff()
  const [seen, setSeen] = useState<string[]>(readSeen)

  useEffect(() => {
    const before = document.title
    document.title = `${TOUR_TITLE} · OHRR`
    return () => {
      document.title = before
    }
  }, [])

  const stops = TOUR.filter((s) => !off.has(s.route))
  // One orange button at a time: the next stop not opened yet.
  const nextUp = stops.find((s) => !seen.includes(s.key))

  const open = (key: string) => {
    rememberReturn(TOUR_PATH, TOUR_TITLE)
    if (seen.includes(key)) return
    const next = [...seen, key]
    saveSeen(next)
    setSeen(next)
  }

  const startAgain = () => {
    saveSeen([])
    setSeen([])
  }

  return (
    <GuidePage outside>
      <div className="space-y-2 px-1">
        <h1 className="font-display text-3xl font-black leading-tight text-ink">{TOUR_TITLE}</h1>
        <p className="text-lg leading-relaxed text-slate-600">
          New here? These {stops.length} short stops show what OHRR has for you. No sign-in, and nothing to fill in.
        </p>
      </div>

      <Card className="space-y-1 border-brand-blue/20 bg-brand-blue-50/50">
        <h2 className="font-display text-lg font-extrabold text-ink">How it works</h2>
        <p className="text-base leading-relaxed text-slate-700">
          Tap a button to open a page. At the top of that page, a bar says “Back to {TOUR_TITLE}.” Tap it to come back here.
        </p>
      </Card>

      <ol className="space-y-4">
        {stops.map((stop, i) => {
          const done = seen.includes(stop.key)
          return (
            <li key={stop.key}>
              <Card className={`space-y-3 ${done ? 'border-emerald-200 bg-emerald-50/40' : ''}`}>
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-black ${
                      done ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-blue-50 text-brand-blue-dark'
                    }`}
                    aria-hidden="true"
                  >
                    {done ? <Icon name="check" size={18} /> : i + 1}
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display text-xl font-black leading-snug text-ink">{stop.name}</h2>
                    <p className="mt-0.5 text-base leading-relaxed text-slate-600">{stop.text}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <Link to={GUIDE_ROUTES[stop.route].to} onClick={() => open(stop.key)} className={stop === nextUp ? ORANGE_BTN : OUTLINE_BTN}>
                    {stop.button}
                  </Link>
                  {done && <span className="text-sm font-bold text-emerald-700">Seen</span>}
                </div>
              </Card>
            </li>
          )
        })}
      </ol>

      {!nextUp && (
        <Card className="space-y-3 border-emerald-200 text-center">
          <h2 className="font-display text-2xl font-black text-ink">That’s the tour</h2>
          <p className="text-base leading-relaxed text-slate-600">You’ve seen the main parts of OHRR. {TOUR_FIND}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <Link to={GUIDE_ROUTES['public-home'].to} onClick={clearReturn} className={ORANGE_BTN}>
              Go to Home
            </Link>
            <button type="button" onClick={startAgain} className="min-h-[44px] px-1 text-sm font-bold text-slate-500 underline underline-offset-2">
              Start the tour again
            </button>
          </div>
        </Card>
      )}
    </GuidePage>
  )
}
