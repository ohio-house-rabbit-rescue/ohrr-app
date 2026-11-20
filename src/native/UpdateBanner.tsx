// "A new version is ready": shown inside the phone app after a newer copy has been downloaded
// (see updater.ts). Nothing on the web. "Update now" restarts the app on the new copy; "Later" hides
// the bar and the new copy is used the next time the app is opened from closed. It never restarts on
// its own while the app is in use (taking a photo counts as "in the background").

import { applyUpdate, dismissBanner, useUpdateState } from './updater'

export default function UpdateBanner() {
  const { state, dismissed } = useUpdateState()
  if (state.status !== 'ready' || dismissed) return null
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[70] flex items-center gap-3 bg-brand-blue px-4 py-2 text-white shadow-lg">
      <p className="min-w-0 flex-1 text-[15px] font-bold leading-snug">A new version is ready. Finish what you are doing first: updating restarts the app.</p>
      <button
        type="button"
        onClick={() => void applyUpdate()}
        className="min-h-[44px] shrink-0 rounded-full bg-white px-4 text-[15px] font-bold text-brand-blue"
      >
        Update now
      </button>
      <button type="button" onClick={dismissBanner} className="min-h-[44px] shrink-0 px-2 text-[15px] font-bold underline underline-offset-2">
        Later
      </button>
    </div>
  )
}
