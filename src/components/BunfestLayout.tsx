import { Link, Outlet } from 'react-router-dom'
import BunfestTopBar from './BunfestTopBar'
import TabBar from './TabBar'
import ScrollToTop from './ScrollToTop'
import { Card, Screen, btn } from './ui'
import { Icon } from './icons'
import { BUNFEST_TABS } from '../data/content'
import { useFeatureFlag } from '../features/settings/useSetting'
import { BUNFEST_SECTION_FLAG } from '../features/settings/features'

export default function BunfestLayout() {
  // The whole festival section is one switch (Staff → Features), so OHRR can
  // put BunFest away between years without anything being deleted. ON until a
  // row says otherwise, so nothing disappears before someone decides.
  const { value: on, loading } = useFeatureFlag(BUNFEST_SECTION_FLAG, true)

  // `.theme-bunfest` re-skins the shared brand tokens to BunFest's palette/font
  return (
    <div className="theme-bunfest min-h-screen bg-canvas">
      <div className="relative mx-auto flex min-h-screen max-w-[480px] flex-col bg-white font-sans text-ink shadow-xl">
        <ScrollToTop />
        <BunfestTopBar />
        <main className="flex-1 pb-24">
          {loading || on ? (
            <Outlet />
          ) : (
            <Screen className="space-y-4">
              <Card className="space-y-3 text-center">
                <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-blue-50 text-brand-blue">
                  <Icon name="star" size={32} />
                </span>
                <h1 className="font-display text-xl font-black text-ink">Midwest BunFest will be back</h1>
                <p className="text-sm leading-relaxed text-slate-600">
                  This year&rsquo;s festival has wrapped up. Everything — the schedule, the vendors, the rescue partners
                  — returns here when OHRR opens next year&rsquo;s.
                </p>
                <Link to="/" className={`${btn.blue} mx-auto`}>
                  Back to OHRR
                </Link>
              </Card>
            </Screen>
          )}
        </main>
        <TabBar tabs={BUNFEST_TABS} />
      </div>
    </div>
  )
}
