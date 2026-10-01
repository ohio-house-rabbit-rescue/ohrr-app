// An item's photos (up to four): add from the camera or the photo library,
// remove one, or make another one the main photo (the one on labels, lists
// and the public pages). Reached from Scan an item → Photo, the items list
// and the Saved screen of Catalog donations (?code=OHRR-XXXXX).
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { Icon } from '../../../components/icons'
import { isNative } from '../../../native/platform'
import { pickPhoto } from '../../../native/camera'
import { MAX_ITEM_PHOTOS, dataUrlToBlob, findByCode, itemPhotos, setItemPhotos, uploadItemPhoto } from '../api'
import { BigButton, Busy, ErrorBox, StepShell } from '../ScanUI'
import type { TaggedItem } from '../types'

export default function ItemPhotos() {
  const { membership } = useAuth()
  const orgId = membership?.orgId ?? ''
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const code = (params.get('code') ?? '').trim().toUpperCase()
  const [item, setItem] = useState<TaggedItem | null | 'loading'>('loading')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!orgId || !code) return
    let alive = true
    findByCode(orgId, code)
      .then((it) => alive && setItem(it))
      .catch((e) => {
        if (!alive) return
        setItem(null)
        setError(errMessage(e))
      })
    return () => {
      alive = false
    }
  }, [orgId, code])

  const photos = item && item !== 'loading' ? itemPhotos(item) : []
  const full = photos.length >= MAX_ITEM_PHOTOS

  const apply = async (urls: string[], doing: string) => {
    if (!item || item === 'loading') return
    setBusy(doing)
    setError(null)
    try {
      setItem(await setItemPhotos(orgId, item.code, urls))
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const addPhoto = async (src: Blob | string) => {
    if (full) return
    setBusy('Saving the photo…')
    setError(null)
    try {
      const blob = typeof src === 'string' ? await dataUrlToBlob(src) : src
      const url = await uploadItemPhoto(blob, orgId)
      await apply([...photos, url], 'Saving the photo…')
    } catch (e) {
      setError(`The photo didn’t save: ${errMessage(e)}`)
      setBusy(null)
    }
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) await addPhoto(file)
  }

  /** On the web the input must be clicked inside the tap itself. */
  const open = (source: 'camera' | 'library') => {
    if (!isNative) {
      ;(source === 'camera' ? cameraRef : libraryRef).current?.click()
      return
    }
    void (async () => {
      try {
        const dataUrl = await pickPhoto(source)
        if (dataUrl) await addPhoto(dataUrl)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Couldn’t get that photo.')
      }
    })()
  }

  const back = () => navigate(code ? `/staff/scan?code=${encodeURIComponent(code)}` : '/staff/items')

  if (!orgId) return null

  return (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} aria-label="Take a photo" />
      <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={onFile} aria-label="Choose a photo" />
      <StepShell
        title="Photos"
        help={item && item !== 'loading' ? `${item.title} · ${item.code}` : undefined}
        onBack={back}
        backLabel="Item"
        footer={
          <div className="space-y-2">
            <BigButton onClick={() => open('camera')} disabled={full || !!busy || !item || item === 'loading'} icon="camera">
              {full ? `${MAX_ITEM_PHOTOS} photos is the most` : photos.length ? `Add a photo (${photos.length} of ${MAX_ITEM_PHOTOS})` : 'Take a photo'}
            </BigButton>
            <div className="grid grid-cols-2 gap-2">
              <BigButton onClick={() => open('library')} disabled={full || !!busy || !item || item === 'loading'} tone="outline">
                From my photos
              </BigButton>
              <BigButton onClick={back} tone="plain" icon="check">
                Done
              </BigButton>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <ErrorBox>{error}</ErrorBox>
          {item === 'loading' ? (
            <Busy label="Finding the item…" />
          ) : !item ? (
            <p className="text-base text-slate-600">No item has the code {code || '(none)'}.</p>
          ) : (
            <>
              {busy && <Busy label={busy} />}
              {photos.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-slate-300 text-slate-400">
                  <Icon name="camera" size={36} />
                  <span className="text-[15px] font-bold">No photos yet</span>
                </div>
              ) : (
                <ul className="grid grid-cols-2 gap-3">
                  {photos.map((url, i) => (
                    <li key={url} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <img src={url} alt="" className="aspect-square w-full object-cover" />
                      <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                        {i === 0 ? (
                          <span className="rounded-full bg-brand-blue-50 px-2 py-1 text-xs font-extrabold uppercase tracking-wide text-brand-blue">Main</span>
                        ) : (
                          <button type="button" disabled={!!busy} onClick={() => void apply([url, ...photos.filter((u) => u !== url)], 'Making it the main photo…')} className="min-h-[44px] px-1 text-sm font-bold text-brand-blue">
                            Make main
                          </button>
                        )}
                        <button type="button" disabled={!!busy} onClick={() => void apply(photos.filter((u) => u !== url), 'Removing the photo…')} className="min-h-[44px] px-1 text-sm font-bold text-red-700" aria-label={`Remove photo ${i + 1}`}>
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-sm text-slate-500">Up to {MAX_ITEM_PHOTOS} photos. The main one goes on labels, lists and the public pages.</p>
            </>
          )}
        </div>
      </StepShell>
    </>
  )
}
