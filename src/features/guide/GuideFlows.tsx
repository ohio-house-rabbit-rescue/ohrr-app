// "Flow charts": the big picture of each job, one chart each. Identical in the app and the website.
import { Link } from 'react-router-dom'
import { Card } from '../../components/ui'
import { StaffTitle } from '../../components/StaffTitle'
import { Icon } from '../../components/icons'
import { TRAIL_PATH } from './guideEnv'
import { GuideGate } from './GuideTrail'
import { FlowChart } from './FlowChart'
import { FLOWS } from './walkthrough'
import { GuidePage } from './guideUi'

export default function GuideFlows() {
  return (
    <GuideGate>
      <GuidePage>
        <Link to={TRAIL_PATH} className="inline-flex min-h-[44px] items-center gap-1 text-base font-bold text-brand-blue">
          <Icon name="arrowLeft" size={18} /> All levels
        </Link>
        <StaffTitle title="Flow charts">
          <p>The big picture of each job, one box at a time. Tap a box with a level on it to open that level. Boxes marked “Money” are the ones that touch money.</p>
        </StaffTitle>
        {FLOWS.map((flow) => (
          <Card key={flow.key} className="space-y-3">
            <div>
              <h2 className="font-display text-xl font-black text-ink">{flow.title}</h2>
              <p className="text-sm leading-relaxed text-slate-600">{flow.intro}</p>
            </div>
            <FlowChart flow={flow} />
          </Card>
        ))}
      </GuidePage>
    </GuideGate>
  )
}
