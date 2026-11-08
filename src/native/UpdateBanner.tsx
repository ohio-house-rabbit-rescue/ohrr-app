// "A new version is ready": shown inside the phone app after a newer copy has been downloaded
// (see updater.ts). Nothing on the web. "Later" hides it; the update still applies the next time the
// app is closed or sent to the background.

import { applyUpdate, dismissBanner, useUpdateState } from './updater'

export default function UpdateBanner() {
  const { state, dismissed } = useUpdateState()
  if (state.status !== 'ready' || dismissed) return null
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[70] flex items-center gap-3 bg-brand-blue px-4 py-2 text-white shadow-lg">
      <p className="min-w-0 flex-1 text-[15px] font-bold leading-snug">A new version of the app is ready.</p>
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
