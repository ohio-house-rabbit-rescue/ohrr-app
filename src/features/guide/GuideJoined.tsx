// The screen right after joining: says what just happened, names the two sides, and hands the new person to
// the guide with one button. Identical in the app and the website.
import { Link } from 'react-router-dom'
import { Card } from '../../components/ui'
import { StaffTitle } from '../../components/StaffTitle'
import { LEVEL_PATH, TRAIL_PATH } from './guideEnv'
import { useGuideAccess } from './useGuide'
import { LEVELS, PROGRAM_NAME } from './walkthrough'
import { GuidePage, ORANGE_BTN } from './guideUi'

export default function GuideJoined() {
  const access = useGuideAccess()
  // If the guide is switched off for this person (they joined before it launched), do not offer a button that
  // would lead to a closed door: the Trail itself offers "Show me the guide".
  const first = LEVELS.find((l) => !l.soon)
  return (
    <GuidePage>
      <StaffTitle title="You’re on the team">
        <p>Welcome. Your invitation worked.</p>
      </StaffTitle>
      <Card className="space-y-3">
        <p className="font-display text-lg font-black text-ink">OHRR has two sides</p>
        <ul className="space-y-2 text-base leading-relaxed text-slate-700">
          <li>
            <strong className="text-ink">The public side</strong> is what everyone sees: the bunnies, events, the Hop Shop and BunFest.
          </li>
          <li>
            <strong className="text-ink">The Staff side</strong> is only for the team. You are on it now, and it shows the pages your role needs.
          </li>
        </ul>
      </Card>
      <Card className="space-y-3 border-brand-orange/40 bg-brand-orange-50/40">
        <p className="font-display text-lg font-black text-ink">{PROGRAM_NAME}</p>
        <p className="text-base leading-relaxed text-slate-700">
          A short guide shows you both sides, one small level at a time, about five minutes each. It only looks and practices, so nothing you do in it can break anything.
        </p>
        {access.loading ? null : (
          <Link to={access.visible && first ? LEVEL_PATH(first.key) : TRAIL_PATH} className={`${ORANGE_BTN} w-full`}>
            Start the guide
          </Link>
        )}
      </Card>
      <p className="text-center text-sm text-slate-500">
        Not now?{' '}
        <Link to="/staff" className="inline-flex min-h-[44px] items-center font-bold text-brand-blue underline underline-offset-2">
          Go to Staff home
        </Link>
        . The guide waits for you there, under Start here.
      </p>
    </GuidePage>
  )
}
