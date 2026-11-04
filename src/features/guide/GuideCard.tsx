// The card on the staff home screen: where you are in the guide, and one button to carry on.
// Identical in the app and the website. Hooks first, then the early returns.
import { Link } from 'react-router-dom'
import { Card } from '../../components/ui'
import { Icon } from '../../components/icons'
import { LEVEL_PATH, TRAIL_PATH } from './guideEnv'
import { useOpenablePaths } from './guideTiles'
import { useGuideAccess, useGuideProgress } from './useGuide'
import { LEVELS, PROGRAM_NAME, levelStatus } from './walkthrough'
import { matchOf } from './GuideTrail'
import { ORANGE_BTN, ProgressBar } from './guideUi'

export default function GuideCard() {
  const access = useGuideAccess()
  const progress = useGuideProgress()
  const openable = useOpenablePaths()
  if (access.loading || !access.visible || progress.loading || progress.hidden) return null

  const written = LEVELS.filter((l) => !l.soon)
  const statuses = written.map((l) => levelStatus(l, progress.done, openable, matchOf))
  const done = statuses.reduce((n, s) => n + s.done, 0)
  const total = statuses.reduce((n, s) => n + s.total, 0)
  const nextIndex = statuses.findIndex((s) => !s.complete)
  const next = nextIndex >= 0 ? written[nextIndex] : null

  return (
    <Card className="space-y-3 border-brand-orange/40 bg-brand-orange-50/40">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-orange text-ink" aria-hidden="true">
          <Icon name="sparkles" size={26} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-black leading-tight text-ink">{PROGRAM_NAME}</p>
          <p className="text-sm leading-snug text-slate-600">
            {next ? (done === 0 ? 'Short levels, about five minutes each. Start with your own account.' : `${done} of ${total} steps done. Next up: ${next.title}.`) : 'You’ve done every level so far. More are coming.'}
          </p>
        </div>
      </div>
      {next && <ProgressBar done={done} total={total} label="Steps done so far" />}
      <div className="flex flex-wrap items-center gap-3">
        <Link to={next ? LEVEL_PATH(next.key) : TRAIL_PATH} className={ORANGE_BTN}>
          {next ? (done === 0 ? 'Start here' : 'Keep going') : 'See all levels'}
        </Link>
        <button type="button" onClick={progress.hide} className="min-h-[44px] px-2 text-sm font-bold text-slate-500 underline underline-offset-2">
          Hide this
        </button>
      </div>
    </Card>
  )
}
