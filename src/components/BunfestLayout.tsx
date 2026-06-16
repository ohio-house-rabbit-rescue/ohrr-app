import { Outlet } from 'react-router-dom'
import BunfestTopBar from './BunfestTopBar'
import TabBar from './TabBar'
import ScrollToTop from './ScrollToTop'
import { BUNFEST_TABS } from '../data/content'

export default function BunfestLayout() {
  // `.theme-bunfest` re-skins the shared brand tokens to BunFest's palette/font
  return (
    <div className="theme-bunfest min-h-screen bg-canvas">
      <div className="relative mx-auto flex min-h-screen max-w-[480px] flex-col bg-white font-sans text-ink shadow-xl">
        <ScrollToTop />
        <BunfestTopBar />
        <main className="flex-1 pb-24">
          <Outlet />
        </main>
        <TabBar tabs={BUNFEST_TABS} />
      </div>
    </div>
  )
}
