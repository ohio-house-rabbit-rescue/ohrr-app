// The Trail: every level on one page, with ticks. Identical in the app and the website.
import { Link } from 'react-router-dom'
import { Card } from '../../components/ui'
import { Icon } from '../../components/icons'
import { StaffTitle } from '../../components/StaffTitle'
import { GUIDE_ROUTES, LEVEL_PATH, MONEY_PATH } from './guideEnv'
import { useOpenablePaths } from './guideTiles'
import { useGuideAccess, useGuideProgress } from './useGuide'
import { LEVELS, PROGRAM_NAME, levelStatus, type RouteKey } from './walkthrough'
import { BLUE_BTN, GuidePage, ProgressBar } from './guideUi'

export const matchOf = (route: RouteKey) => GUIDE_ROUTES[route].match

export function GuideGate({ children }: { children: React.ReactNode }) {
  const access = useGuideAccess()
  if (access.loading) return <GuidePage><p className="text-base text-slate-500">Loading…</p></GuidePage>
  if (!access.visible)
    return (
      <GuidePage>
        <StaffTitle title={PROGRAM_NAME} />
        <Card className="space-y-3">
          <p className="text-base leading-relaxed text-slate-600">This guide isn’t switched on for your account right now.</p>
          <Link to="/staff" className={BLUE_BTN}>
            Back to Staff
          </Link>
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
  const written = LEVELS.filter((l) => !l.soon)
  const statuses = written.map((l) => levelStatus(l, progress.done, openable, matchOf))
  const done = statuses.reduce((n, s) => n + s.done, 0)
  const total = statuses.reduce((n, s) => n + s.total, 0)
  const firstOpen = written.find((_l, i) => !statuses[i].complete)

  return (
    <GuidePage>
      <StaffTitle title={PROGRAM_NAME}>
        <p>
          Short levels, about five minutes each. Stop any time; your ticks are saved and you pick up right where you left off. Practice screens say so at the top and save nothing.
        </p>
      </StaffTitle>

      <Card className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-lg font-black text-ink">{done === total && total > 0 ? 'All of these are done' : `${done} of ${total} steps done`}</p>
          <p className="text-sm text-slate-500">more levels are coming</p>
        </div>
        <ProgressBar done={done} total={total} label="Steps done so far" />
        {firstOpen && (
          <Link to={LEVEL_PATH(firstOpen.key)} className={BLUE_BTN}>
            {done === 0 ? 'Start Level 1' : `Keep going: Level ${firstOpen.n}`}
          </Link>
        )}
      </Card>

      <ol className="space-y-3">
        {LEVELS.map((level) => {
          const st = levelStatus(level, progress.done, openable, matchOf)
          const body = (
            <div className="flex items-start gap-3">
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-black ${
                  st.complete ? 'bg-emerald-100 text-emerald-800' : level.soon ? 'bg-slate-100 text-slate-400' : 'bg-brand-blue-50 text-brand-blue-dark'
                }`}
                aria-hidden="true"
              >
                {st.complete ? <Icon name="check" size={22} /> : level.n}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg font-extrabold leading-tight text-ink">{level.title}</span>
                <span className="mt-0.5 block text-sm leading-snug text-slate-600">{level.goal}</span>
                <span className="mt-1 block text-sm font-bold text-slate-500">
                  {level.soon ? 'Coming next' : st.complete ? 'Done' : st.done > 0 ? `${st.done} of ${st.total} steps` : `About ${level.minutes} minutes`}
                  {level.money ? ' · money, so it comes last' : ''}
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
                <Link to={LEVEL_PATH(level.key)} className="block rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-slate-300 active:scale-[.99]">
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

      <p className="px-1 text-center text-sm text-slate-500">
        Your ticks belong to your account. Nobody else sees them in the app.
      </p>
    </GuidePage>
  )
}
