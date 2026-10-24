// "Spreadsheet with photos" for the staff lists (Items, Hop Shop inventory):
// an Excel file with a picture in every row, or a plain CSV, of what the list
// is showing (2026-10-24, sponsor: "That way they can email from the phone
// also").
//
// Getting it off the phone: the native app hands the file straight to the
// share sheet (Gmail, Mail, Drive, Files). A browser can share a file only
// straight after a tap, and fetching the photos takes longer than that, so
// there the finished file waits behind an "Email or share it" button. Chrome
// on Android won't share Excel files at all, so it saves to Downloads.
import { useState } from 'react'
import { errMessage } from '../lib/supabase'
import { isNative } from '../native/platform'
import { Icon } from './icons'
import { buildSheetWithPhotos, sheetCsvBlob, type SheetSpec } from '../lib/inventoryExport'

type Outcome = 'shared' | 'saved' | 'cancelled'

interface Ready {
  file: File
  title: string
  note: string
}

const pill =
  'inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-[15px] font-bold text-slate-600 disabled:opacity-50'

function webCanShare(file: File): boolean {
  try {
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
    return typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })
  } catch {
    return false
  }
}

function save(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/** The share sheet (app, or a browser that can share it), else a download. */
async function send(file: File, title: string): Promise<Outcome> {
  if (isNative) {
    const { shareFileNative } = await import('../native/share')
    return shareFileNative(file, file.name, `${title} (attached).`, title)
  }
  if (webCanShare(file)) {
    try {
      await navigator.share({ files: [file], title, text: `${title} (attached).` })
      return 'shared'
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return 'cancelled'
      // fall through to saving
    }
  }
  save(file)
  return 'saved'
}

const savedNote = 'Saved to Downloads — attach it to an email from there.'

export default function ExportButtons({ spec, label = 'Spreadsheet with photos' }: { spec: () => SheetSpec; label?: string }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [ready, setReady] = useState<Ready | null>(null)

  const after = (o: Outcome, note: string) => setMsg(o === 'cancelled' ? null : o === 'saved' ? `${note} ${savedNote}` : `${note} Shared.`)

  const excel = async () => {
    const s = spec()
    if (!s.rows.length) return
    setMsg(null)
    setReady(null)
    setBusy('Starting…')
    try {
      const { blob, missing } = await buildSheetWithPhotos(s, (done, total) => setBusy(total ? `Photos ${done} of ${total}…` : 'Making the file…'))
      const n = s.rows.length
      const note =
        `${n} item${n === 1 ? '' : 's'} in the spreadsheet.` +
        (missing ? ` ${missing} photo${missing === 1 ? '' : 's'} didn’t load; ${missing === 1 ? 'its' : 'their'} link is in the sheet.` : '')
      const file = new File([blob], `${s.filename}.xlsx`, { type: blob.type })
      if (!isNative && webCanShare(file)) {
        // The tap that started this has expired by now; one more tap shares it.
        setReady({ file, title: s.title, note })
        return
      }
      after(await send(file, s.title), note)
    } catch (e) {
      setMsg(`Couldn’t make the spreadsheet: ${errMessage(e)}`)
    } finally {
      setBusy(null)
    }
  }

  const csv = async () => {
    const s = spec()
    if (!s.rows.length) return
    setMsg(null)
    setReady(null)
    try {
      after(await send(new File([sheetCsvBlob(s)], `${s.filename}.csv`, { type: 'text/csv' }), s.title), `${s.rows.length} in the CSV.`)
    } catch (e) {
      setMsg(`Couldn’t share the CSV: ${errMessage(e)}`)
    }
  }

  const shareReady = async (how: 'share' | 'save') => {
    if (!ready) return
    try {
      if (how === 'save') {
        save(ready.file)
        after('saved', ready.note)
      } else after(await send(ready.file, ready.title), ready.note)
      setReady(null)
    } catch (e) {
      setMsg(`Couldn’t share it: ${errMessage(e)}`)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void excel()} disabled={!!busy} className={pill} title="An Excel file with a picture of each item, to email or save">
          <Icon name="file" size={18} /> {busy ?? label}
        </button>
        <button type="button" onClick={() => void csv()} disabled={!!busy} className={pill} title="A CSV with links to the photos">
          CSV
        </button>
      </div>
      {ready && (
        <div className="space-y-2 rounded-2xl border border-brand-blue/30 bg-brand-blue-50 p-3">
          <p role="status" className="text-[15px] text-slate-700">
            {ready.note} Ready to send.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void shareReady('share')} className={`${pill} !border-brand-blue !bg-brand-blue !text-white`}>
              <Icon name="mail" size={18} /> Email or share it
            </button>
            <button type="button" onClick={() => void shareReady('save')} className={pill}>
              Save it
            </button>
          </div>
        </div>
      )}
      {msg && (
        <p role="status" className="text-sm text-slate-600">
          {msg}
        </p>
      )}
    </div>
  )
}
