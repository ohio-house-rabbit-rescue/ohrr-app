// In-app updates for the Android / iOS app (no new file to install).
//
// The phone app carries its own copy of the web app. Every release also publishes that copy as a
// zip next to the live site (vite.config.ts → public /ota/): /ota/latest.json says which revision
// is newest and where its zip is. The app looks at that file, downloads the zip when it is newer,
// and switches to it, so a change to the web part reaches installed phones without a new APK.
//
//   - Web and installed web apps (PWA): nothing here runs (isNative is false).
//   - Only the web part can be updated this way. A change to the phone shell itself (a new
//     permission, a new plugin) needs a new install: the file then says `minNativeBuild`, and an
//     older install is told so instead of being given a copy it cannot run.
//   - If a new copy fails to start, the plugin goes back to the last working one on its own
//     (markAppReady is the "I started fine" signal), and that revision is not tried again.
//
// Comparison is by `revision` (package.json), which goes up with every release.

import { useSyncExternalStore } from 'react'
import { build } from '../data/version'
import { isIos, isNative } from './platform'

/** Where the live app (and its /ota/ files) are published. */
const LIVE = 'https://ohrr-app.pages.dev'

const TRIED_KEY = 'ohrr.ota.tried' // a revision we switched to and have not yet seen start
const BAD_KEY = 'ohrr.ota.bad' // a revision that did not start: skip it
const CHECK_EVERY_MS = 10 * 60 * 1000

export type UpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'current' }
  | { status: 'downloading'; revision: number }
  | { status: 'ready'; revision: number; version: string }
  | { status: 'needs-install' }
  | { status: 'error'; message: string }

interface LatestFile {
  version: string
  revision: number
  url: string
  /** SHA-256 of the zip, in hex: the plugin will not install a download without it. */
  checksum: string
  /** Oldest Android versionCode / iOS build number whose phone shell can run this copy. */
  minNativeBuild?: number
  minNativeBuildIos?: number
}

let state: UpdateState = { status: 'idle' }
let readyBundleId: string | null = null
let lastCheck = 0
let started = false
let dismissed = false
const listeners = new Set<() => void>()

function set(next: UpdateState) {
  state = next
  listeners.forEach((l) => l())
}

const read = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const write = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k)
    else localStorage.setItem(k, v)
  } catch {
    /* no storage: the guards simply don't remember */
  }
}

/** Pure: should this phone take `latest`? Kept separate so it can be tested without a phone. */
export function decide(
  latest: Pick<LatestFile, 'revision' | 'minNativeBuild'>,
  have: { revision: number; nativeBuild: number; badRevision: number },
): 'current' | 'needs-install' | 'skip' | 'update' {
  if (!(latest.revision > have.revision)) return 'current'
  if ((latest.minNativeBuild ?? 0) > have.nativeBuild) return 'needs-install'
  if (latest.revision <= have.badRevision) return 'skip'
  return 'update'
}

/**
 * Say "this copy started fine" (or the plugin goes back to the last one), then tidy up.
 * Call once, after the first screen is on its way. If the previous launch switched to a newer
 * copy and this is the old one, the new one did not start: remember that so it is not retried.
 */
export async function markAppReady(): Promise<void> {
  if (!isNative) return
  try {
    const tried = Number(read(TRIED_KEY) ?? 0)
    if (tried) {
      if (build.revision >= tried) write(TRIED_KEY, null)
      else {
        write(BAD_KEY, String(tried))
        write(TRIED_KEY, null)
      }
    }
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
    await CapacitorUpdater.notifyAppReady()
    // Older downloaded copies are not needed once this one runs.
    const { bundles } = await CapacitorUpdater.list()
    const current = await CapacitorUpdater.current()
    for (const b of bundles) {
      if (b.id !== current.bundle.id && b.id !== 'builtin') await CapacitorUpdater.delete({ id: b.id }).catch(() => undefined)
    }
  } catch {
    /* the plugin missing or erroring must never stop the app */
  }
}

async function nativeBuildNumber(): Promise<number> {
  const { App } = await import('@capacitor/app')
  const info = await App.getInfo()
  return Number(info.build) || 0
}

/** Look for a newer copy and, if there is one, download it. `manual` shows "up to date" and errors. */
export async function checkForUpdate(manual = false): Promise<void> {
  if (!isNative) return
  if (state.status === 'checking' || state.status === 'downloading') return
  if (state.status === 'ready') return
  if (!manual && Date.now() - lastCheck < CHECK_EVERY_MS) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    if (manual) set({ status: 'error', message: 'No signal right now. Try again when the phone is online.' })
    return
  }
  lastCheck = Date.now()
  if (manual) set({ status: 'checking' })
  try {
    const res = await fetch(`${LIVE}/ota/latest.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`The update list answered ${res.status}.`)
    const latest = (await res.json()) as LatestFile
    if (typeof latest.revision !== 'number' || !latest.url || !latest.checksum) throw new Error('The update list is not readable.')
    const verdict = decide({ revision: latest.revision, minNativeBuild: isIos ? latest.minNativeBuildIos : latest.minNativeBuild }, {
      revision: build.revision,
      nativeBuild: await nativeBuildNumber(),
      badRevision: Number(read(BAD_KEY) ?? 0),
    })
    if (verdict === 'current' || verdict === 'skip') return set({ status: manual ? 'current' : 'idle' })
    if (verdict === 'needs-install') return set({ status: 'needs-install' })

    set({ status: 'downloading', revision: latest.revision })
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
    const url = new URL(latest.url, LIVE).toString()
    const bundle = await CapacitorUpdater.download({ url, version: String(latest.revision), checksum: latest.checksum })
    readyBundleId = bundle.id
    // If the person never taps "Update now", it takes effect the next time the app goes to the background.
    await CapacitorUpdater.next({ id: bundle.id }).catch(() => undefined)
    dismissed = false
    set({ status: 'ready', revision: latest.revision, version: latest.version })
  } catch (e) {
    set(manual ? { status: 'error', message: e instanceof Error ? e.message : 'The update could not be checked.' } : { status: 'idle' })
  }
}

/** Switch to the downloaded copy now (the app restarts on it). */
export async function applyUpdate(): Promise<void> {
  if (!isNative || !readyBundleId || state.status !== 'ready') return
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
    write(TRIED_KEY, String(state.revision))
    await CapacitorUpdater.set({ id: readyBundleId })
  } catch (e) {
    write(TRIED_KEY, null)
    set({ status: 'error', message: e instanceof Error ? e.message : 'The update could not be started.' })
  }
}

/** Hide the "update ready" bar for now (the update still applies when the app next closes). */
export function dismissBanner() {
  dismissed = true
  listeners.forEach((l) => l())
}

/** Start the automatic checks: a few seconds after opening, and each time the app comes back to the front. */
export function startUpdateChecks(): void {
  if (!isNative || started) return
  started = true
  setTimeout(() => void checkForUpdate(false), 4000)
  void import('@capacitor/app').then(({ App }) =>
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void checkForUpdate(false)
    }),
  )
}

export function useUpdateState(): { state: UpdateState; dismissed: boolean } {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
  const d = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => dismissed,
  )
  return { state: s, dismissed: d }
}
