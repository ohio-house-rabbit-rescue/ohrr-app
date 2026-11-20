// Settings → About: the app's own update check.
//   - Phone app (Android / iOS): downloads the new copy, then "Update now" restarts on it.
//   - Website and home-screen version: looks at the newest revision on the live site; "Update now"
//     clears the saved copy and reloads. It only ever happens when the person taps, never on its own.

import { useState } from 'react'
import { btn } from '../components/ui'
import { build } from '../data/version'
import { isNative } from './platform'
import { applyUpdate, checkForUpdate, useUpdateState } from './updater'

type WebState = 'idle' | 'checking' | 'current' | 'newer' | 'error'

async function newestRevision(): Promise<number> {
  const res = await fetch(`/ota/latest.json?t=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const n = Number((await res.json()).revision)
  if (!Number.isFinite(n)) throw new Error('No revision')
  return n
}

/** Forget the saved copy of the app, then load it fresh from the live site. */
async function reloadFresh(): Promise<void> {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? []
    await Promise.all(regs.map((r) => r.unregister()))
    for (const k of await caches.keys()) await caches.delete(k)
  } catch {
    /* no saved copy to clear: a plain reload still works */
  }
  window.location.reload()
}

function WebUpdateRow() {
  const [s, setS] = useState<WebState>('idle')
  const [latest, setLatest] = useState<number | null>(null)
  const check = async () => {
    setS('checking')
    try {
      const n = await newestRevision()
      setLatest(n)
      setS(n > build.revision ? 'newer' : 'current')
    } catch {
      setS('error')
    }
  }
  return (
    <div className="space-y-2 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-slate-500">Updates</span>
        {s === 'newer' ? (
          <button type="button" onClick={() => void reloadFresh()} className={btn.blue}>
            Update now
          </button>
        ) : (
          <button type="button" onClick={() => void check()} disabled={s === 'checking'} className={btn.white}>
            {s === 'checking' ? 'Checking…' : 'Check for updates'}
          </button>
        )}
      </div>
      {s === 'current' && <p className="text-sm text-slate-600">You have the newest version.</p>}
      {s === 'newer' && (
        <p className="text-sm text-slate-600">
          Version rev {latest} is ready. Finish what you are doing first: updating reloads the app.
        </p>
      )}
      {s === 'error' && <p className="text-sm text-red-700">Could not check. Make sure you have a signal and try again.</p>}
    </div>
  )
}

export default function UpdateRow() {
  const { state } = useUpdateState()
  if (!isNative) return <WebUpdateRow />
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
