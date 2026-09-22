// A picture on a staff screen, taken with the phone's camera (inside the app)
// or picked from the computer (on the web), uploaded to the shared
// `site-images` bucket. Used by Announcements and the Home screen editor.
import { useRef, useState, type ChangeEvent } from 'react'
import { Icon } from './icons'
import { btn } from './ui'
import { staffInput } from './staffui'
import { isNative } from '../native/platform'
import { pickSiteImage, uploadSiteImage } from '../lib/siteImages'
import { errMessage } from '../lib/supabase'
import type { PhotoSource } from '../native/camera'

export default function StaffImageField({
  label = 'Picture',
  hint,
  value,
  userId,
  onChange,
  onBusyChange,
}: {
  label?: string
  hint?: string
  value: string
  userId: string
  onChange: (url: string) => void
  onBusyChange?: (busy: boolean) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const working = (b: boolean) => {
    setBusy(b)
    onBusyChange?.(b)
  }

  const pick = async (source: PhotoSource) => {
    if (!isNative) {
      fileRef.current?.click()
      return
    }
    setError(null)
    try {
      working(true)
      const url = await pickSiteImage(source, userId)
      if (url) onChange(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : errMessage(e))
    } finally {
      working(false)
    }
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    working(true)
    try {
      onChange(await uploadSiteImage(file, userId))
    } catch (err) {
      setError(errMessage(err))
    } finally {
      working(false)
    }
  }

  return (
    <div>
      <span className="block text-sm font-semibold text-slate-700">
        {label} <span className="font-normal text-slate-400">(optional)</span>
      </span>
      {hint && <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>}
      <div className="mt-2 flex items-center gap-3">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-slate-300">
          {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <Icon name="camera" size={28} />}
        </span>
        <div className="flex flex-1 flex-col gap-1.5">
          <button type="button" onClick={() => void pick('camera')} disabled={busy} className={`${btn.blue} !py-2.5 disabled:opacity-60`}>
            <Icon name="camera" size={18} /> {busy ? 'Saving…' : isNative ? 'Take a photo' : value ? 'Change picture' : 'Choose a picture'}
          </button>
          {isNative && (
            <button type="button" onClick={() => void pick('library')} disabled={busy} className="text-sm font-bold text-brand-blue">
              Choose from photos
            </button>
          )}
          {value && !busy && (
            <button type="button" onClick={() => onChange('')} className="text-sm font-bold text-slate-500">
              Remove
            </button>
          )}
        </div>
      </div>
      <input className={`${staffInput} text-xs`} value={value} onChange={(e) => onChange(e.target.value)} placeholder="…or paste an image URL" />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      {error && <p className="mt-1.5 text-sm font-semibold text-red-600">{error}</p>}
    </div>
  )
}
