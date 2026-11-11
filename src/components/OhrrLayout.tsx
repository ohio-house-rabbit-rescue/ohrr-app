import { Outlet } from 'react-router-dom'
import OhrrTopBar from './OhrrTopBar'
import TeamStrip from './TeamStrip'
import TabBar from './TabBar'
import ScrollToTop from './ScrollToTop'
import { OHRR_TABS } from '../data/content'

export default function OhrrLayout() {
  return (
    <div className="design-page min-h-screen bg-canvas">
      <div className="design-page relative mx-auto flex min-h-screen max-w-[480px] flex-col bg-white font-sans text-ink shadow-xl">
        <ScrollToTop />
        {/* The top bar and, for the team only, the row under it stay put together while the page scrolls. */}
        <div className="sticky top-0 z-30">
          <OhrrTopBar />
          <TeamStrip />
        </div>
        <main className="flex-1 pb-24">
          <Outlet />
        </main>
        <TabBar tabs={OHRR_TABS} />
      </div>
    </div>
  )
}
