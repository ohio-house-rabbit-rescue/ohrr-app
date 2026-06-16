import { Outlet } from 'react-router-dom'
import OhrrTopBar from './OhrrTopBar'
import TabBar from './TabBar'
import ScrollToTop from './ScrollToTop'
import { OHRR_TABS } from '../data/content'

export default function OhrrLayout() {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="relative mx-auto flex min-h-screen max-w-[480px] flex-col bg-white font-sans text-ink shadow-xl">
        <ScrollToTop />
        <OhrrTopBar />
        <main className="flex-1 pb-24">
          <Outlet />
        </main>
        <TabBar tabs={OHRR_TABS} />
      </div>
    </div>
  )
}
