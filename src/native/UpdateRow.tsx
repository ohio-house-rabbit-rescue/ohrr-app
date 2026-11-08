// Settings → About: the app's own update check, inside the phone app only.

import { btn } from '../components/ui'
import { isNative } from './platform'
import { applyUpdate, checkForUpdate, useUpdateState } from './updater'

export default function UpdateRow() {
  const { state } = useUpdateState()
  if (!isNative) return null
  const busy = state.status === 'checking' || state.status === 'downloading'
  return (
    <div className="space-y-2 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-slate-500">Updates</span>
        {state.status === 'ready' ? (
          <button type="button" onClick={() => void applyUpdate()} className={btn.blue}>
            Update now
          </button>
        ) : (
          <button type="button" onClick={() => void checkForUpdate(true)} disabled={busy} className={btn.white}>
            {busy ? 'Checking…' : 'Check for updates'}
          </button>
        )}
      </div>
      {state.status === 'current' && <p className="text-sm text-slate-600">You have the newest version.</p>}
      {state.status === 'downloading' && <p className="text-sm text-slate-600">Getting the new version…</p>}
      {state.status === 'ready' && <p className="text-sm text-slate-600">A new version is ready. The app restarts to use it.</p>}
      {state.status === 'needs-install' && (
        <p className="text-sm text-amber-800">This update needs a new install of the app. Ask the person who gave you the app for the newest file.</p>
      )}
      {state.status === 'error' && <p className="text-sm text-red-700">{state.message}</p>}
    </div>
  )
}
