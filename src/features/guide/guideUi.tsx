// Small pieces the guided start's pages share. Identical in the app and the website.
import type { ReactNode } from 'react'
import { Card } from '../../components/ui'
import { PAGE_CLASS, PUBLIC_PAGE_CLASS } from './guideEnv'
import { INSTALL_POINTS, INSTALL_TITLE } from './walkthrough'

export const ORANGE_BTN =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-brand-orange px-5 py-3 text-sm font-bold text-ink shadow-sm transition hover:bg-brand-orange-dark active:scale-[.98]'
export const BLUE_BTN =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-brand-blue px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-blue-dark active:scale-[.98]'
export const OUTLINE_BTN =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-brand-blue/40 px-5 py-2.5 text-sm font-bold text-brand-blue transition hover:bg-brand-blue-50 active:scale-[.98]'

/** The padding every guide page sits in (the Welcome page, outside the staff area, passes `outside`). */
export function GuidePage({ children, outside = false }: { children: ReactNode; outside?: boolean }) {
  return <div className={outside ? PUBLIC_PAGE_CLASS : PAGE_CLASS}>{children}</div>
}

export function ProgressBar({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={label}>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-orange transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/** "Optional: put OHRR on your phone’s home screen". On the Welcome page; in the guide it is Level 1's last step. */
export function InstallCard() {
  return (
    <Card className="space-y-2 border-brand-blue/20 bg-brand-blue-50/50">
      <h2 className="font-display text-xl font-black text-ink">{INSTALL_TITLE}</h2>
      <ul className="space-y-2">
        {INSTALL_POINTS.map((p) => (
          <li key={p} className="flex gap-2 text-base leading-relaxed text-slate-700">
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-blue" aria-hidden="true" />
            {p}
          </li>
        ))}
      </ul>
    </Card>
  )
}
