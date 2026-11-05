// A flow chart: boxes joined by arrows, stacked so it reads on a phone and prints cleanly. A box with a `level`
// opens that level (when `links` is on). Identical in the app and the website.
import { Link } from 'react-router-dom'
import { LEVEL_PATH } from './guideEnv'
import { LEVELS, type Flow, type FlowNode } from './walkthrough'

const TONE: Record<NonNullable<FlowNode['tone']> | 'plain', string> = {
  plain: 'border-slate-200 bg-white',
  start: 'border-brand-blue/40 bg-brand-blue-50',
  money: 'border-brand-orange/60 bg-brand-orange-50/60',
  end: 'border-emerald-300 bg-emerald-50',
}

export function FlowChart({ flow, links = true }: { flow: Flow; links?: boolean }) {
  return (
    <ol aria-label={flow.title} className="m-0 list-none p-0">
      {flow.nodes.map((n, i) => {
        const level = n.level ? LEVELS.find((l) => l.key === n.level) : undefined
        const box = (
          <div className={`rounded-2xl border-2 px-4 py-3 ${TONE[n.tone ?? 'plain']}`}>
            {n.tone === 'money' && <p className="text-xs font-extrabold uppercase tracking-wider text-brand-orange-dark">Money</p>}
            <p className="font-display text-base font-extrabold leading-snug text-ink">{n.label}</p>
            {n.note && <p className="mt-0.5 text-sm leading-snug text-slate-600">{n.note}</p>}
            {level && links && <p className="mt-1 text-sm font-bold text-brand-blue">Level {level.n}: {level.title} →</p>}
          </div>
        )
        return (
          <li key={i} className="break-inside-avoid">
            {level && links ? (
              <Link to={LEVEL_PATH(level.key)} className="block transition active:scale-[.99]">
                {box}
              </Link>
            ) : (
              box
            )}
            {i < flow.nodes.length - 1 && (
              <div aria-hidden="true" className="py-1 text-center text-xl font-black leading-none text-slate-400">
                ↓
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
