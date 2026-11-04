// "What the app does with money": the calm page for the nervous. Identical in the app and the website.
import { Link } from 'react-router-dom'
import { Card } from '../../components/ui'
import { StaffTitle } from '../../components/StaffTitle'
import { TRAIL_PATH } from './guideEnv'
import { GuideGate } from './GuideTrail'
import { MONEY_POINTS } from './walkthrough'
import { BLUE_BTN, GuidePage } from './guideUi'

export default function GuideMoney() {
  return (
    <GuideGate>
      <GuidePage>
        <StaffTitle title="What the app does with money" />
        <p className="px-1 text-base leading-relaxed text-slate-600">
          Plenty of people feel nervous about this part, so here it is in plain words. The money levels come last in the guide, and every one of them is a practice screen first.
        </p>
        <ul className="space-y-3">
          {MONEY_POINTS.map((p, i) => (
            <li key={p.title}>
              <Card className="space-y-1.5">
                <p className="font-display text-lg font-extrabold text-ink">
                  {i + 1}. {p.title}
                </p>
                <p className="text-base leading-relaxed text-slate-600">{p.text}</p>
              </Card>
            </li>
          ))}
        </ul>
        <Link to={TRAIL_PATH} className={BLUE_BTN}>
          Back to all levels
        </Link>
      </GuidePage>
    </GuideGate>
  )
}
