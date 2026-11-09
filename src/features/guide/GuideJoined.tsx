// The screen right after "Join the team": says what just happened and hands the new person to the guide.
// Identical in the app and the website.
import { Link } from 'react-router-dom'
import { Card } from '../../components/ui'
import { StaffTitle } from '../../components/StaffTitle'
import { LEVEL_PATH, TRAIL_PATH } from './guideEnv'
import { useGuideAccess } from './useGuide'
import { LEVELS, PROGRAM_NAME } from './walkthrough'
import { BLUE_BTN, GuidePage, InstallCard, ORANGE_BTN } from './guideUi'

export default function GuideJoined() {
  const access = useGuideAccess()
  // If the guide is switched off for this person (they joined before it launched), do not offer a button that
  // would lead to a closed door: the Trail itself offers "Show me the guide".
  const first = LEVELS.find((l) => !l.soon)
  return (
    <GuidePage>
      <StaffTitle title="You’re on the team">
        <p>Welcome. Your invite worked, and your Staff home screen now shows the pages your role needs.</p>
      </StaffTitle>
      <Card className="space-y-3 border-brand-orange/40 bg-brand-orange-50/40">
        <p className="font-display text-lg font-black text-ink">{PROGRAM_NAME}</p>
        <p className="text-base leading-relaxed text-slate-700">
          A short guide walks you through the app one small level at a time, about five minutes each. It only looks and practices, so nothing real gets posted, saved or charged.
        </p>
        {access.loading ? null : (
          <Link to={access.visible && first ? LEVEL_PATH(first.key) : TRAIL_PATH} className={ORANGE_BTN}>
            Start the guide
          </Link>
        )}
      </Card>
      <InstallCard />
      <Link to="/staff" className={BLUE_BTN}>
        Go to Staff home
      </Link>
    </GuidePage>
  )
}
