// My Bunny photos on the account (update 32 — the private `my-bunny-photos`
// bucket, one folder per person: <user id>/<bunny id>.jpg, which only they can
// reach).
//
// My Bunny's JSON already follows the account (sync.ts); the photos live in
// this phone's IndexedDB (photos.ts, already downscaled) and go to the account
// as files, one per bunny. What this phone remembers, per account: for each
// bunny, the stamp of the account's file (its updated_at and eTag from a
// listing) that the photo here matches. With that, one look at the folder says
// what changed where:
//
//   photo here  file there  stamp here      then
//   yes         no          none            upload (new here, or from before update 32)
//   yes         no          yes             removed on another phone: remove it here
//   yes         yes         = the file's    nothing to do
//   yes         yes         none            changed here: upload
//   yes         yes         ≠ the file's    changed on another phone: download
//   no          yes         none            another phone's photo: download
//   no          yes         yes             removed here: remove the file
//   bunny gone from this phone, stamp yes   remove the file
//
// Storing a photo here forgets its stamp; removing one keeps it, so the file
// goes too — photos.ts's onPhotoChange() tells us. The sync runs after each
// full account pull (sign-in, app start, back to the front) and a moment after
// a photo changes here, in sync.ts's queue. Signed out, nothing is sent.
// Until update 32 is run there is no bucket: photos stay on the phone as
// before and nothing errors.
import { useSyncExternalStore } from 'react'
import { supabase } from '../../lib/supabase'
import { MY_BUNNY_PHOTOS_BUCKET } from '../../lib/database.types'
import { deletePhoto, getPhoto, onPhotoChange, photosSupported, putPhoto } from '../mybunny/photos'
import { getMyBunny, markPhotoHere } from '../mybunny/storage'
import { isMissing } from './emailList'

const bucket = () => supabase.storage.from(MY_BUNNY_PHOTOS_BUCKET)
const pathOf = (userId: string, bunnyId: string) => `${userId}/${bunnyId}.jpg`
const MAX_BYTES = 1_048_576

/* ---------------------------------------------------- what's known */

const STATE_KEY = 'ohrr.mybunny.photoSync.v1'
/** Removed here before its stamp was known: remove whatever the account has. */
const REMOVED = 'removed'

interface PhotoState {
  userId: string | null
  /** bunny id → the account file's stamp the photo here matches (or REMOVED). */
  known: Record<string, string>
}

function readState(): PhotoState {
  try {
    const v = JSON.parse(localStorage.getItem(STATE_KEY) ?? 'null') as PhotoState | null
    if (v && typeof v === 'object' && v.known && typeof v.known === 'object') return v
  } catch {
    /* fall through */
  }
  return { userId: null, known: {} }
}

function writeState(s: PhotoState) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(s))
  } catch {
    /* private mode: the next sync compares again, which is safe */
  }
}

/** What a change on this phone means for the stamps. */
function applyChange(known: Record<string, string>, id: string, stored: boolean) {
  if (stored) delete known[id]
  else known[id] = known[id] ?? REMOVED
}

/* ---------------------------------------------------------- status */

/** 'on' once the account's folder has been reached; 'unavailable' = no bucket yet (update 32 not run). */
export type PhotoSyncState = 'unknown' | 'on' | 'unavailable'

let status: PhotoSyncState = 'unknown'
const statusListeners = new Set<() => void>()

function setStatus(next: PhotoSyncState) {
  if (next === status) return
  status = next
  statusListeners.forEach((l) => l())
}

export function usePhotoSyncState(): PhotoSyncState {
  return useSyncExternalStore(
    (cb) => {
      statusListeners.add(cb)
      return () => {
        statusListeners.delete(cb)
      }
    },
    () => status,
    () => status,
  )
}

const bucketMissing = (e: { message?: string }) => /bucket not found/i.test(e.message ?? '')

/* --------------------------------------------- changes on this phone */

// Photos this sync is writing itself (they aren't "changed here").
const quiet = new Set<string>()
// Changes made while a sync is running, applied again before it saves.
const during = new Map<string, boolean>()
let running = false
let watching = false

async function quietly<T>(id: string, op: () => Promise<T>): Promise<T> {
  quiet.add(id)
  try {
    return await op()
  } finally {
    quiet.delete(id)
  }
}

/** Once (sync.ts): note each photo stored or removed here, then call `onChange`. */
export function watchPhotoChanges(onChange: () => void) {
  if (watching) return
  watching = true
  onPhotoChange((id, stored) => {
    if (quiet.has(id)) return
    const st = readState()
    applyChange(st.known, id, stored)
    writeState(st)
    if (running) during.set(id, stored)
    onChange()
  })
}

/* ---------------------------------------------------------- files */

let hasUpdate32: boolean | null = null

/** Whether update 32 has been run (it's one script, so its functions say whether the bucket is there). Null: couldn't ask. */
async function update32(): Promise<boolean | null> {
  if (hasUpdate32 !== null) return hasUpdate32
  const { error } = await supabase.rpc('push_public_key')
  if (!error) hasUpdate32 = true
  else if (isMissing(error)) hasUpdate32 = false
  return hasUpdate32
}

/** bunny id → file stamp; null when the folder couldn't be read. */
async function listFolder(userId: string): Promise<Map<string, string> | null> {
  const { data, error } = await bucket().list(userId, { limit: 1000 })
  if (error) {
    if (bucketMissing(error)) setStatus('unavailable')
    return null
  }
  const out = new Map<string, string>()
  for (const o of data ?? []) {
    const m = /^(.+)\.jpg$/.exec(o.name)
    // Folders have no id.
    if (m && o.id) out.set(m[1], `${o.updated_at ?? ''}|${o.metadata?.eTag ?? ''}`)
  }
  return out
}

function dataUrlToBlob(url: string): Blob | null {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(url)
  if (!m) return null
  try {
    const raw = atob(m[2])
    const bytes = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
    return new Blob([bytes], { type: m[1] })
  } catch {
    return null
  }
}

const blobToDataUrl = (b: Blob) =>
  new Promise<string | null>((resolve) => {
    const r = new FileReader()
    r.onload = () => resolve(typeof r.result === 'string' ? r.result : null)
    r.onerror = () => resolve(null)
    r.readAsDataURL(b)
  })

async function upload(userId: string, id: string): Promise<boolean> {
  const url = await getPhoto(id)
  const blob = url ? dataUrlToBlob(url) : null
  if (!blob || blob.size > MAX_BYTES) return false
  const { error } = await bucket().upload(pathOf(userId, id), blob, { upsert: true, contentType: blob.type, cacheControl: '0' })
  if (error && bucketMissing(error)) setStatus('unavailable')
  return !error
}

async function download(userId: string, id: string): Promise<boolean> {
  const { data, error } = await bucket().download(pathOf(userId, id), {}, { cache: 'no-store' })
  if (error || !data) return false
  const type = /^image\/(jpeg|png|webp)$/.test(data.type) ? data.type : 'image/jpeg'
  const url = await blobToDataUrl(new Blob([data], { type }))
  if (!url) return false
  const ok = await quietly(id, () => putPhoto(id, url))
  if (ok) markPhotoHere(id, true)
  return ok
}

async function removeHere(id: string) {
  await quietly(id, () => deletePhoto(id))
  markPhotoHere(id, false)
}

/* ---------------------------------------------------------- the sync */

/** Bring this phone's photos and the account's folder into step. Never throws. */
export async function syncBunnyPhotos(userId: string): Promise<void> {
  if (status === 'unavailable' || !photosSupported()) return
  running = true
  during.clear()
  try {
    await syncNow(userId)
  } catch {
    /* no signal, or refused: the phone keeps its photos; the next sync tries again */
  } finally {
    running = false
  }
}

async function syncNow(userId: string) {
  const ready = await update32()
  if (ready === false) return setStatus('unavailable')
  if (ready === null) return
  const listed = await listFolder(userId)
  if (!listed) return

  let st = readState()
  // Someone else was signed in on this phone before: none of their stamps apply.
  if (st.userId !== userId) st = { userId, known: {} }
  const known = st.known
  const data = getMyBunny()
  const onPhone = new Set(data.bunnies.map((b) => b.id))
  const uploaded: string[] = []
  const toRemove: string[] = []

  for (const b of data.bunnies) {
    const file = listed.get(b.id)
    const stamp = known[b.id] === REMOVED ? undefined : known[b.id]
    if (b.hasPhoto) {
      if (file === undefined) {
        // An empty folder is likelier a hiccup than every photo removed elsewhere: keep this one.
        if (stamp && listed.size > 0) {
          await removeHere(b.id)
          delete known[b.id]
        } else if (!stamp && (await upload(userId, b.id))) uploaded.push(b.id)
      } else if (!stamp) {
        if (await upload(userId, b.id)) uploaded.push(b.id)
      } else if (stamp !== file && (await download(userId, b.id))) known[b.id] = file
    } else if (file === undefined) {
      delete known[b.id]
    } else if (known[b.id] !== undefined) {
      toRemove.push(b.id)
    } else if (await download(userId, b.id)) known[b.id] = file
    if (status === 'unavailable') return
  }

  // Bunnies no longer on this phone (deleted here, or on another phone).
  for (const id of Object.keys(known)) {
    if (onPhone.has(id)) continue
    if (listed.has(id)) toRemove.push(id)
    else delete known[id]
    await quietly(id, () => deletePhoto(id))
  }
  if (toRemove.length > 0) {
    const { error } = await bucket().remove(toRemove.map((id) => pathOf(userId, id)))
    if (!error) for (const id of toRemove) delete known[id]
  }

  // What was just uploaded: its new stamp.
  if (uploaded.length > 0) {
    const again = await listFolder(userId)
    for (const id of uploaded) {
      const s = again?.get(id)
      if (s) known[id] = s
    }
  }

  // Anything changed here meanwhile wins over what this sync saw.
  for (const [id, stored] of during) applyChange(known, id, stored)
  writeState(st)
  setStatus('on')
}

/* ------------------------------------------------ the account goes */

/** Forget what this phone knew about the account's photos. */
export function forgetPhotoSync() {
  try {
    localStorage.removeItem(STATE_KEY)
  } catch {
    /* private mode */
  }
}

/**
 * Deleting the account: remove their folder first — the database can't delete
 * storage files. Best effort (no bucket yet, or no signal: nothing to do).
 * The phone keeps its photos.
 */
export async function removeAllMyBunnyPhotos(userId: string): Promise<void> {
  forgetPhotoSync()
  try {
    const { data, error } = await bucket().list(userId, { limit: 1000 })
    if (error || !data) return
    const paths = data.filter((o) => o.id).map((o) => `${userId}/${o.name}`)
    if (paths.length > 0) await bucket().remove(paths)
  } catch {
    /* nothing to remove */
  }
}
