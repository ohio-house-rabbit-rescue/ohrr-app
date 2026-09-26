// Bunny photos live in IndexedDB — one record per bunny id holding the
// downscaled (≤512px) JPEG as a data URL. Everything else about a bunny stays
// in the small localStorage JSON (see storage.ts); this split is what lets a
// rescue or foster keep up to MAX_BUNNIES rabbits, since 100 photos would blow
// past localStorage's ~5 MB budget but fit comfortably in IndexedDB.
//
// Every IndexedDB call is wrapped so a phone without it (or with it blocked in
// private mode) degrades to "no photos" rather than a crash. A tiny in-memory
// cache + useSyncExternalStore hook means the avatars re-render the moment a
// photo is loaded, saved or removed. No top-level browser access, so this file
// is safe to import from the node check script.
//
// Signed in (update 32), the account keeps a copy of each photo too; the
// account sync (features/account/photoSync.ts) hears about every photo stored
// or removed here through onPhotoChange().

import { useEffect, useSyncExternalStore } from 'react'

const DB_NAME = 'ohrr-mybunny'
const DB_VERSION = 1
const STORE = 'photos'

/* ---------------------------------------------------------------- IDB */

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        resolve(null)
        return
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      }
      req.onsuccess = () => {
        const db = req.result
        // If another tab upgrades the schema later, drop our handle so the
        // next call re-opens instead of failing forever.
        db.onversionchange = () => {
          db.close()
          dbPromise = null
        }
        resolve(db)
      }
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

function request<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        if (!db) {
          resolve(undefined)
          return
        }
        try {
          const tx = db.transaction(STORE, mode)
          const req = run(tx.objectStore(STORE))
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => resolve(undefined)
          tx.onabort = () => resolve(undefined)
        } catch {
          resolve(undefined)
        }
      }),
    () => undefined,
  )
}

function isDataUrl(v: unknown): v is string {
  return typeof v === 'string' && v.startsWith('data:image/')
}

/* -------------------------------------------------------------- cache */

// id → data URL, or null when we've checked and there is no photo.
const cache = new Map<string, string | null>()
const pending = new Map<string, Promise<string | undefined>>()
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

// Which bunny's photo was stored (true) or removed (false) — for the account sync.
type PhotoChange = (id: string, stored: boolean) => void
const changeListeners = new Set<PhotoChange>()

export function onPhotoChange(cb: PhotoChange): () => void {
  changeListeners.add(cb)
  return () => {
    changeListeners.delete(cb)
  }
}

/** The photo for a bunny id — from the cache when warm, else from IndexedDB. */
export function getPhoto(id: string): Promise<string | undefined> {
  const hit = cache.get(id)
  if (hit !== undefined) return Promise.resolve(hit ?? undefined)
  const inflight = pending.get(id)
  if (inflight) return inflight
  const p = request<unknown>('readonly', (s) => s.get(id))
    .then((v) => {
      const url = isDataUrl(v) ? v : undefined
      cache.set(id, url ?? null)
      notify()
      return url
    })
    .finally(() => pending.delete(id))
  pending.set(id, p)
  return p
}

/** Synchronous cache read — undefined when not loaded (or no photo). */
export function peekPhoto(id: string): string | undefined {
  return cache.get(id) ?? undefined
}

/**
 * Store (or replace) a bunny's photo. The cache updates immediately so the UI
 * shows it even before the write lands; resolves false when IndexedDB is
 * unavailable or refused the write.
 */
export async function putPhoto(id: string, dataUrl: string): Promise<boolean> {
  if (!isDataUrl(dataUrl)) return false
  cache.set(id, dataUrl)
  notify()
  changeListeners.forEach((l) => l(id, true))
  const db = await openDb()
  if (!db) return false
  return new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(dataUrl, id)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
      tx.onabort = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

export async function deletePhoto(id: string): Promise<void> {
  cache.set(id, null)
  notify()
  changeListeners.forEach((l) => l(id, false))
  await request('readwrite', (s) => s.delete(id))
}

/** Every stored photo, keyed by bunny id (used by Backup). */
export async function getAllPhotos(): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const db = await openDb()
  if (!db) {
    for (const [id, url] of cache) if (url) out[id] = url
    return out
  }
  return new Promise<Record<string, string>>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly')
      const store = tx.objectStore(STORE)
      const keysReq = store.getAllKeys()
      const valsReq = store.getAll()
      tx.oncomplete = () => {
        const keys = keysReq.result ?? []
        const vals = valsReq.result ?? []
        keys.forEach((k, i) => {
          if (typeof k === 'string' && isDataUrl(vals[i])) out[k] = vals[i] as string
        })
        resolve(out)
      }
      tx.onerror = () => resolve(out)
      tx.onabort = () => resolve(out)
    } catch {
      resolve(out)
    }
  })
}

/**
 * Write several photos (e.g. from a backup or the v1 migration). Resolves with
 * the ids that could NOT be stored, so callers can decide what to do.
 */
export async function putPhotos(photos: Record<string, string>): Promise<string[]> {
  const failed: string[] = []
  for (const [id, url] of Object.entries(photos)) {
    if (!(await putPhoto(id, url))) failed.push(id)
  }
  return failed
}

/** True when this browser exposes IndexedDB at all (the DB may still refuse to open). */
export function photosSupported(): boolean {
  try {
    return typeof indexedDB !== 'undefined'
  } catch {
    return false
  }
}

/* ---------------------------------------------------------------- hook */

/**
 * A bunny's photo as a data URL, or undefined while loading / when there is
 * none. Pass `hasPhoto` from the bunny record so bunnies without a photo never
 * hit IndexedDB at all.
 */
export function useBunnyPhoto(id: string | undefined, hasPhoto: boolean | undefined): string | undefined {
  const key = hasPhoto && id ? id : undefined
  const src = useSyncExternalStore(
    subscribe,
    () => (key ? (cache.get(key) ?? undefined) : undefined),
    () => undefined,
  )
  useEffect(() => {
    if (key && !cache.has(key)) void getPhoto(key)
  }, [key])
  return src
}
