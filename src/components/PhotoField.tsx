// "Add a photo" on a public form — the camera inside the app, a file picker on
// the web, and the upload handled for you. Used by the found-rabbit report, the
// surrender intake and Happy Tails, where a picture says more than a paragraph
// and asking for "a link to a photo" asked the impossible on a phone.
import { useRef, useState, type ChangeEvent } from 'react'
import { Icon } from './icons'
import { btn } from './ui'
import { isNative } from '../native/platform'
import { capturePhoto, uploadPublicPhoto } from '../lib/publicUpload'
import type { PhotoSource } from '../native/camera'

export default function PhotoField({
  label = 'Photo',
  hint,
  value,
  onChange,
  onBusyChange,
}: {
  label?: string
  hint?: string
  /** The uploaded photo's URL, or '' for none. */
  value: string
  onChange: (url: string) => void
  /** True while a photo is uploading — forms disable Send. */
  onBusyChange?: (busy: boolean) => void
}) {
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)

  const setWorking = (b: boolean) => {
    setBusy(b)
    onBusyChange?.(b)
  }

  const send = async (blob: Blob) => {
    setError(null)
    setWorking(true)
    setPreview(URL.createObjectURL(blob))
    try {
      onChange(await uploadPublicPhoto(blob))
    } catch (e) {
      setPreview(null)
      onChange('')
      setError(e instanceof Error ? e.message : 'That photo didn’t send.')
    } finally {
      setWorking(false)
    }
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) await send(file)
  }

  const pick = async (source: PhotoSource) => {
    if (!isNative) {
      ;(source === 'camera' ? cameraRef : libraryRef).current?.click()
      return
    }
    try {
      const blob = await capturePhoto(source)
      if (blob) await send(blob)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t get that photo.')
    }
  }

  const shown = preview ?? (value || null)
  return (
    <div>
      <span className="block text-sm font-semibold text-slate-700">
        {label} <span className="font-normal text-slate-400">(optional)</span>
      </span>
      {hint && <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>}
      <div className="mt-2 flex items-center gap-3">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-slate-300">
          {shown ? <img src={shown} alt="" className="h-full w-full object-cover" /> : <Icon name="camera" size={30} />}
        </span>
        <div className="flex flex-1 flex-col gap-1.5">
          <button type="button" onClick={() => void pick('camera')} disabled={busy} className={`${btn.blue} !py-2.5 disabled:opacity-60`}>
            <Icon name="camera" size={18} /> {busy ? 'Sending photo…' : shown ? 'Take another' : 'Take a photo'}
          </button>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => void pick('library')} disabled={busy} className="text-sm font-bold text-brand-blue">
              Choose a photo
            </button>
            {shown && !busy && (
              <button
                type="button"
                onClick={() => {
                  setPreview(null)
                  onChange('')
                }}
                className="text-sm font-bold text-slate-500"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      {error && <p className="mt-1.5 text-sm font-semibold text-red-600">{error}</p>}
    </div>
  )
}
