// Staff → Flyers (phone edition): pick one of the four QR flyers, see it,
// then Share (AirDrop / email / Messages to whoever has the printer), Save
// as an image, or Print straight from the phone. Same flyers as the website.
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../../lib/auth'
import { Screen, Card, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { FLYERS, flyerLink, renderFlyer, type Flyer } from '../flyers'
import { canvasToBlob } from '../render'
import { canShareFiles, copyText, savePngAsync, sharePng } from '../share'
import { isNative } from '../../../native/platform'

export default function Flyers() {
  const { can } = useAuth()
  const [pick, setPick] = useState<Flyer>(FLYERS[0])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const shareable = canShareFiles()

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    let alive = true
    setBusy(true)
    setStatus(null)
    renderFlyer(c, pick)
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Could not draw the flyer'))
      .finally(() => alive && setBusy(false))
    return () => {
      alive = false
    }
  }, [pick])

  if (!can('announcements.post')) return <Screen><p className="text-sm text-slate-600">You don’t have access to flyers.</p></Screen>

  const filename = `ohrr-flyer-${pick.id}.png`
  const share = async () => {
    const c = canvasRef.current
    if (!c) return
    setError(null)
    try {
      const out = await sharePng(await canvasToBlob(c), filename, `OHRR flyer — ${pick.headline}`)
      if (out === 'shared') setStatus('Sent to the share sheet.')
      else if (out === 'saved') setStatus('Flyer saved to your phone / downloads.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not share')
    }
  }
  const save = async () => {
    const c = canvasRef.current
    if (!c) return
    try {
      const out = await savePngAsync(await canvasToBlob(c), filename)
      if (out !== 'cancelled') setStatus(isNative ? 'Use the share sheet to print, save to Photos, or send it to whoever has the printer.' : 'Flyer saved to your phone / downloads. Print it from Photos or send it to whoever has the printer.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    }
  }
  const print = () => {
    const c = canvasRef.current
    if (!c) return
    if (isNative) {
      // No window.print() in the app: the share sheet has Print (AirPrint) on iOS.
      void save()
      return
    }
    const w = window.open('', '_blank')
    if (!w) {
      setStatus('Pop-ups are blocked — use Save and print from Photos instead.')
      return
    }
    w.document.write(`<!doctype html><title>OHRR flyer</title><style>@page{size:letter;margin:0.4in}html,body{margin:0}img{width:100%;height:auto;display:block}</style><img src="${c.toDataURL('image/png')}" onload="setTimeout(function(){window.print()},200)">`)
    w.document.close()
  }
  const copyLink = async () => {
    setStatus((await copyText(flyerLink(pick))) ? 'Link copied.' : 'Could not copy the link.')
  }

  return (
    <Screen className="space-y-4">
      <div className="pt-1">
        <h1 className="font-display text-2xl font-black text-ink">Flyers</h1>
        <p className="mt-1 text-sm text-slate-600">Letter-size posters with a QR code. Pick one, then share it to whoever prints, save it, or print from this phone.</p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {FLYERS.map((f) => (
          <button key={f.id} type="button" onClick={() => setPick(f)} className={`min-h-[60px] rounded-2xl border-2 px-4 py-3 text-left ${pick.id === f.id ? 'border-brand-orange bg-white shadow-md' : 'border-slate-200 bg-white'}`}>
            <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400">{f.audience}</span>
            <span className="mt-0.5 block font-display text-[15px] font-extrabold text-ink">{f.headline}</span>
          </button>
        ))}
      </div>

      <Card className="!p-2">
        <canvas ref={canvasRef} className="block h-auto w-full rounded-xl" aria-label="Preview of the flyer" />
      </Card>
      {busy && <p className="text-center text-xs text-slate-500">Drawing…</p>}

      <button type="button" onClick={() => void share()} disabled={busy} className={`${btn.primary} w-full py-4 text-base disabled:opacity-60`}>
        <Icon name="external" size={18} /> {shareable ? 'Share the flyer' : 'Save the flyer'}
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={print} disabled={busy} className={`${btn.outline} w-full`}>
          <Icon name="printer" size={16} /> Print
        </button>
        <button type="button" onClick={() => void save()} disabled={busy} className={`${btn.outline} w-full`}>
          Save image
        </button>
      </div>
      <button type="button" onClick={() => void copyLink()} className="block w-full py-2 text-center text-sm font-bold text-brand-blue">
        Copy this flyer’s link
      </button>
      {status && <p className="rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">{status}</p>}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      <p className="text-xs text-slate-500">Prints on one US-Letter page, colour or black-and-white. Each flyer carries its own link, so the analytics show which ones bring people in.</p>
    </Screen>
  )
}
