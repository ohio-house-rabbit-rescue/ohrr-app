// "You finished. What next?": real jobs to try now that the guide is done, each shown only if the page is on this
// person's menu. Identical in the app and the website.
import { Link } from 'react-router-dom'
import { Card } from '../../components/ui'
import { StaffTitle } from '../../components/StaffTitle'
import { GUIDE_ROUTES, NEXT_PATH, TRAIL_PATH } from './guideEnv'
import { useOpenablePaths } from './guideTiles'
import { rememberReturn } from './guideReturn'
import { NEXT_STEPS, NEXT_TITLE, NEXT_WHO, canOpen, fill } from './walkthrough'
import { GuideGate, matchOf } from './GuideTrail'
import { BLUE_BTN, GuidePage, ORANGE_BTN, OUTLINE_BTN } from './guideUi'

export default function GuideNext() {
  return (
    <GuideGate>
      <NextBody />
    </GuideGate>
  )
}

function NextBody() {
  const openable = useOpenablePaths()
  const mine = NEXT_STEPS.filter((s) => canOpen(openable, matchOf(s.route)))
  return (
    <GuidePage>
      <StaffTitle title={NEXT_TITLE}>
        <p>The guide only looked and practiced. Here are real jobs to try next, in any order, whenever you feel ready.</p>
      </StaffTitle>
      {mine.length === 0 ? (
        <Card className="space-y-3">
          <p className="text-base leading-relaxed text-slate-600">Your tasks are still being set up. Ask the person who invited you what your first job is.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {mine.map((s) => {
            const r = GUIDE_ROUTES[s.route]
            return (
              <li key={s.route}>
                <Card className="space-y-3">
                  <p className="text-base leading-relaxed text-slate-700">{fill(s.text, { title: r.title })}</p>
                  <Link to={r.to} onClick={() => rememberReturn(NEXT_PATH, NEXT_TITLE)} className={ORANGE_BTN}>
                    Open {r.title}
                  </Link>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
      <Card className="space-y-2 bg-slate-50/70">
        <p className="text-base leading-relaxed text-slate-600">{NEXT_WHO}</p>
      </Card>
      <div className="flex flex-wrap gap-3">
        <Link to={TRAIL_PATH} className={OUTLINE_BTN}>
          See all levels
        </Link>
        <Link to="/staff" className={BLUE_BTN}>
          Back to Staff
        </Link>
      </div>
    </GuidePage>
  )
}
