// The card on the staff home screen: where you are in the guide, and one button to carry on.
// Identical in the app and the website. Hooks first, then the early returns.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/ui'
import { Icon } from '../../components/icons'
import { LEVEL_PATH, NEXT_PATH, TRAIL_PATH } from './guideEnv'
import { useOpenablePaths } from './guideTiles'
import { useGuideAccess, useGuideProgress } from './useGuide'
import { PROGRAM_NAME, guideSummary } from './walkthrough'
import { matchOf } from './GuideTrail'
import { ORANGE_BTN, ProgressBar } from './guideUi'

export default function GuideCard() {
  const access = useGuideAccess()
  const progress = useGuideProgress()
  const openable = useOpenablePaths()
  // Right after "Hide this": say where it went, instead of the card just vanishing.
  const [justHid, setJustHid] = useState(false)
  if (access.loading || !access.visible || progress.loading) return null

  if (progress.hidden) {
    if (!justHid) return null
    return (
      <Card className="space-y-2 bg-slate-50/70">
        <p className="text-base leading-relaxed text-slate-600">
          Hidden. You can find <strong className="text-ink">{PROGRAM_NAME}</strong> again any time under <strong className="text-ink">Me → Start here</strong>.
        </p>
        <button
          type="button"
          onClick={() => {
            progress.unhide()
            setJustHid(false)
          }}
          className="min-h-[44px] px-1 text-sm font-bold text-brand-blue underline underline-offset-2"
        >
          Show it again
        </button>
      </Card>
    )
  }

  const { done, skipped, total, next } = guideSummary(progress.done, openable, matchOf)

  return (
    <Card className="space-y-3 border-brand-orange/40 bg-brand-orange-50/40">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-orange text-ink" aria-hidden="true">
          <Icon name="sparkles" size={26} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-black leading-tight text-ink">{PROGRAM_NAME}</p>
          <p className="text-sm leading-snug text-slate-600">
            {next
              ? done === 0 && skipped === 0
                ? 'Short levels, about five minutes each. Start with your own account.'
                : `${done} of ${total} steps done. Next up: ${next.title}.`
              : 'You’ve been through every level. Ready for real jobs? See what next.'}
          </p>
        </div>
      </div>
      {next && <ProgressBar done={done} total={total} label="Steps done so far" />}
      <div className="flex flex-wrap items-center gap-3">
        <Link to={next ? LEVEL_PATH(next.key) : NEXT_PATH} className={ORANGE_BTN}>
          {next ? (done === 0 && skipped === 0 ? 'Start here' : 'Keep going') : 'What next?'}
        </Link>
        {!next && (
          <Link to={TRAIL_PATH} className="min-h-[44px] px-2 py-3 text-sm font-bold text-brand-blue underline underline-offset-2">
            See all levels
          </Link>
        )}
        <button
          type="button"
          onClick={() => {
            progress.hide()
            setJustHid(true)
          }}
          className="min-h-[44px] px-2 text-sm font-bold text-slate-500 underline underline-offset-2"
        >
          Hide this
        </button>
      </div>
    </Card>
  )
}
