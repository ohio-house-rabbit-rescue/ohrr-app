// The Trail: every level on one page, with ticks. Identical in the app and the website.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/ui'
import { Icon } from '../../components/icons'
import { StaffTitle } from '../../components/StaffTitle'
import { FLOWS_PATH, GUIDE_ROUTES, JOIN, LEVEL_PATH, MONEY_PATH, NEXT_PATH, PRINT_PATH } from './guideEnv'
import { useIsCounterOnly, useOpenablePaths } from './guideTiles'
import { useGuideAccess, useGuideProgress } from './useGuide'
import { LEVELS, PROGRAM_NAME, guideSummary, levelStatus, type RouteKey } from './walkthrough'
import { BLUE_BTN, GuidePage, OUTLINE_BTN, ProgressBar } from './guideUi'

export const matchOf = (route: RouteKey) => GUIDE_ROUTES[route].match

export function GuideGate({ children }: { children: React.ReactNode }) {
  const access = useGuideAccess()
  const [busy, setBusy] = useState(false)
  if (access.loading)
    return (
      <GuidePage>
        <p className="text-base text-slate-500">Loading…</p>
      </GuidePage>
    )
  if (!access.visible)
    return (
      <GuidePage>
        <StaffTitle title={PROGRAM_NAME} />
        <Card className="space-y-3">
          {access.member ? (
            <>
              <p className="text-base leading-relaxed text-slate-600">
                This guide is for people who are new to the app, so it was tucked away for you. You can still have it: tap the button and it comes back on your Staff home screen and under Me → Start here.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setBusy(true)
                  void access.showMe().finally(() => setBusy(false))
                }}
                className={`${BLUE_BTN} disabled:opacity-60`}
              >
                Show me the guide
              </button>
              <Link to="/staff" className={OUTLINE_BTN}>
                Back to Staff
              </Link>
            </>
          ) : (
            <>
              <p className="text-base leading-relaxed text-slate-600">The guide is for people on the OHRR team. Join the team with your invitation first, and it will be waiting for you.</p>
              <a href={JOIN.href} className={BLUE_BTN} {...(JOIN.external ? { rel: 'noopener' } : {})}>
                Join the team
              </a>
            </>
          )}
        </Card>
      </GuidePage>
    )
  return <>{children}</>
}

export default function GuideTrail() {
  return (
    <GuideGate>
      <TrailBody />
    </GuideGate>
  )
}

function TrailBody() {
  const progress = useGuideProgress()
  const openable = useOpenablePaths()
  const counterOnly = useIsCounterOnly()
  const { done, skipped, total, next, revisit } = guideSummary(progress.done, openable, matchOf)
  const sellLevel = LEVELS.find((l) => l.key === 'sell')

  return (
    <GuidePage>
      <StaffTitle title={PROGRAM_NAME}>
        <p>
          Short levels, five to fifteen minutes each. Stop any time; your check marks are saved and you pick up right where you left off. Practice screens say so at the top and save nothing.
        </p>
      </StaffTitle>

      <Card className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-lg font-black text-ink">
            {!next && total > 0 ? (skipped > 0 ? 'You’ve been through every level' : 'All of these are done') : `${done} of ${total} steps done`}
          </p>
          {skipped > 0 && <p className="text-sm text-slate-500">{skipped} skipped</p>}
        </div>
        <ProgressBar done={done} total={total} label="Steps done so far" />
        {next ? (
          <Link to={LEVEL_PATH(next.key)} className={BLUE_BTN}>
            {done === 0 && skipped === 0 ? 'Start Level 1' : `Keep going: Level ${next.n}`}
          </Link>
        ) : (
          <div className="flex flex-wrap gap-3">
            <Link to={NEXT_PATH} className={BLUE_BTN}>
              What next?
            </Link>
            {revisit && (
              <Link to={LEVEL_PATH(revisit.key)} className={OUTLINE_BTN}>
                Go back to a skipped step
              </Link>
            )}
          </div>
        )}
      </Card>

      {counterOnly && sellLevel && (
        <Card className="space-y-2 border-brand-orange/40 bg-brand-orange-50/40">
          <p className="font-display text-lg font-extrabold text-ink">You sell at the table?</p>
          <p className="text-base leading-relaxed text-slate-600">
            Level {sellLevel.n}, “{sellLevel.title},” is the one made for you. It is a pretend sale first, and it shows how to undo a mistake. The other levels are there whenever you are curious.
          </p>
          <Link to={LEVEL_PATH(sellLevel.key)} className={BLUE_BTN}>
            Open Level {sellLevel.n}
          </Link>
        </Card>
      )}

      <ol className="space-y-3">
        {LEVELS.map((level) => {
          const st = levelStatus(level, progress.done, openable, matchOf)
          const label = level.soon
            ? 'Coming next'
            : st.na
              ? 'Not part of your job'
              : st.complete
                ? 'Done'
                : st.settled
                  ? `Skipped ${st.skipped} ${st.skipped === 1 ? 'step' : 'steps'}`
                  : st.done > 0 || st.skipped > 0
                    ? `${st.done} of ${st.total} steps${st.skipped > 0 ? `, ${st.skipped} skipped` : ''}`
                    : `About ${level.minutes} minutes`
          const body = (
            <div className="flex items-start gap-3">
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-black ${
                  st.complete ? 'bg-emerald-100 text-emerald-800' : level.soon || st.na ? 'bg-slate-100 text-slate-400' : 'bg-brand-blue-50 text-brand-blue-dark'
                }`}
                aria-hidden="true"
              >
                {st.complete ? <Icon name="check" size={22} /> : level.n}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg font-extrabold leading-tight text-ink">{level.title}</span>
                <span className="mt-0.5 block text-sm leading-snug text-slate-600">{level.goal}</span>
                <span className="mt-1 block text-sm font-bold text-slate-500">
                  {label}
                  {level.money && !st.na ? ' · money, so take your time' : ''}
                </span>
              </span>
            </div>
          )
          return (
            <li key={level.key}>
              {level.soon ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-4" aria-label={`Level ${level.n}, coming next`}>
                  {body}
                </div>
              ) : (
                <Link
                  to={LEVEL_PATH(level.key)}
                  className={`block rounded-2xl border p-4 shadow-sm transition active:scale-[.99] ${st.na ? 'border-dashed border-slate-300 bg-slate-50/70' : 'border-slate-200/80 bg-white hover:border-slate-300'}`}
                >
                  {body}
                </Link>
              )}
            </li>
          )
        })}
      </ol>

      <Card className="space-y-2 border-brand-blue/20 bg-brand-blue-50/50">
        <p className="font-display text-lg font-extrabold text-ink">Worried about the money parts?</p>
        <p className="text-base leading-relaxed text-slate-600">Read this first. It says plainly what the app does and does not do with money.</p>
        <Link to={MONEY_PATH} className="inline-flex min-h-[44px] items-center gap-1 text-base font-bold text-brand-blue underline underline-offset-2">
          What the app does with money
        </Link>
      </Card>

      <Card className="space-y-2">
        <p className="font-display text-lg font-extrabold text-ink">Prefer a picture or paper?</p>
        <div className="flex flex-col gap-1">
          <Link to={FLOWS_PATH} className="inline-flex min-h-[44px] items-center text-base font-bold text-brand-blue underline underline-offset-2">
            Flow charts of the main jobs
          </Link>
          <a href={PRINT_PATH} target="_blank" rel="noopener" className="inline-flex min-h-[44px] items-center text-base font-bold text-brand-blue underline underline-offset-2">
            Print the whole guide
          </a>
        </div>
      </Card>

      <p className="px-1 text-center text-sm text-slate-500">Your check marks belong to your account. Nobody else sees them in the app.</p>
    </GuidePage>
  )
}
