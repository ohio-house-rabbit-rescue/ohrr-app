// /staff/boxes — the numbered boxes items are packed in (update 46). Start a
// box, or find one by its number, where it's kept, or an item inside. Box
// labels not printed yet wait at the top, to print all at once when the
// 4 × 6 roll is in (Receive into boxes leaves them for the end of the sort).
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { Icon } from '../../../components/icons'
import { Screen } from '../../../components/ui'
import { Spinner } from '../../../components/staffui'
import { isNative } from '../../../native/platform'
import { shareFileNative } from '../../../native/share'
import { BigButton, ErrorBox } from '../ScanUI'
import { labelDataUrl, labelsPdf } from '../labels'
import BluetoothPrint from '../printer/BluetoothPrint'
import { BOX_SIZE, boxLabel, listBoxes, markBoxesPrinted, newBox, type Box } from '../boxes'

export default function Boxes() {
  const { membership } = useAuth()
  const orgId = membership?.orgId ?? ''
  const navigate = useNavigate()
  const [boxes, setBoxes] = useState<Box[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const [reload, setReload] = useState(0)
  const [printImgs, setPrintImgs] = useState<string[]>([])

  useEffect(() => {
    if (!orgId) return
    let alive = true
    const load = () =>
      listBoxes(orgId)
        .then((b) => alive && setBoxes(b))
        .catch((e) => alive && setError(errMessage(e)))
    void load()
    const again = () => document.visibilityState === 'visible' && void load()
    document.addEventListener('visibilitychange', again)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', again)
    }
  }, [orgId, reload])

  const start = async () => {
    setBusy(true)
    setError(null)
    try {
      const b = await newBox(orgId)
      navigate(`/staff/boxes/${b.code}?scan=1`)
    } catch (e) {
      setError(errMessage(e))
      setBusy(false)
    }
  }

  // Filled boxes whose label hasn't been printed, lowest number first (the order they were written on).
  const waiting = (boxes ?? []).filter((b) => !b.label_printed_at && b.items.length > 0).sort((a, b) => a.box_no - b.box_no)

  const needle = q.trim().toLowerCase()
  const shown = (boxes ?? []).filter(
    (b) =>
      !needle ||
      `box ${b.box_no}` === needle ||
      String(b.box_no) === needle.replace(/^box\s*/, '') ||
      b.code.toLowerCase().includes(needle) ||
      (b.location ?? '').toLowerCase().includes(needle) ||
      b.items.some((i) => i.title.toLowerCase().includes(needle) || i.code.toLowerCase().includes(needle)),
  )

  return (
    <>
      <Screen className="space-y-4 print:hidden">
        <div className="pt-1">
          <Link to="/staff/items" className="inline-flex min-h-[44px] items-center gap-1 text-base font-bold text-brand-blue">
            <Icon name="arrowLeft" size={20} /> Items
          </Link>
          <h1 className="mt-1 font-display text-2xl font-black text-ink">Boxes</h1>
          <p className="mt-1 text-base text-slate-600">
            Numbered boxes and what’s in them. Receive into boxes adds new items straight into a box; an empty box is for items that already have labels — scan them in. Scanning a box label opens the full list.
          </p>
        </div>

        {waiting.length > 0 && <WaitingLabels orgId={orgId} boxes={waiting} setPrintImgs={setPrintImgs} onPrinted={() => setReload((n) => n + 1)} />}

        <div className="grid grid-cols-2 gap-2">
          <BigButton onClick={() => navigate('/staff/catalog?box=1')} icon="camera">
            Receive into boxes
          </BigButton>
          <BigButton tone="outline" onClick={() => void start()} disabled={busy || !orgId} icon="plus">
            {busy ? 'Starting…' : 'Empty box'}
          </BigButton>
        </div>

        {boxes && boxes.length > 0 && (
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <Icon name="search" size={20} />
            </span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Box number, place, or an item"
              aria-label="Find a box"
              className="w-full rounded-2xl border-2 border-slate-200 bg-white py-3 pl-11 pr-4 text-base text-ink outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/15"
            />
          </div>
        )}

        <ErrorBox>{error}</ErrorBox>
        {boxes === null && !error && <Spinner />}
        {boxes && boxes.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-base text-slate-500">No boxes yet. Start one, then scan the items that go in it.</div>
        )}
        {boxes && boxes.length > 0 && shown.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-base text-slate-500">No box matches that.</div>
        )}
        <ul className="space-y-2">
          {shown.map((b) => (
            <li key={b.id}>
              <Link to={`/staff/boxes/${b.code}`} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-brand-blue">
                <span className="inline-flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-blue-50 text-brand-blue">
                  <span className="text-[11px] font-extrabold uppercase leading-none">Box</span>
                  <span className="font-display text-xl font-black leading-tight">{b.box_no}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-base font-extrabold text-ink">
                    Box {b.box_no}
                    {b.location ? <span className="font-sans text-sm font-semibold text-slate-600"> · {b.location}</span> : null}
                  </span>
                  <span className="block text-sm text-slate-600">
                    {b.items.length} item{b.items.length === 1 ? '' : 's'} · {b.label_printed_at ? 'label printed' : 'label not printed yet'}
                  </span>
                  {b.items.length > 0 && (
                    <span className="block truncate text-sm text-slate-500">
                      {b.items
                        .slice(0, 4)
                        .map((i) => i.title)
                        .join(', ')}
                      {b.items.length > 4 ? ', …' : ''}
                    </span>
                  )}
                </span>
                <Icon name="chevron" size={20} className="mt-4 shrink-0 text-slate-400" />
              </Link>
            </li>
          ))}
        </ul>
      </Screen>
      {/* print-only: the box labels at 4 × 6 in */}
      <div className="hidden print:block">
        {printImgs.map((src, i) => (
          <div key={i} className="label-page">
            <img src={src} alt="" />
          </div>
        ))}
      </div>
      <style>{`
        @media print {
          @page { size: ${BOX_SIZE.wIn}in ${BOX_SIZE.hIn}in; margin: 0; }
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          header { display: none !important; }
          [class*="max-w-[480px]"] { max-width: none !important; box-shadow: none !important; padding: 0 !important; }
          .label-page { width: ${BOX_SIZE.wIn}in; height: ${BOX_SIZE.hIn}in; overflow: hidden; page-break-after: always; break-after: page; }
          .label-page img { display: block; width: ${BOX_SIZE.wIn}in; height: ${BOX_SIZE.hIn}in; }
        }
      `}</style>
    </>
  )
}

/** Every waiting box label at once: the 4 × 6 roll in, then Print, a PDF or Bluetooth. */
function WaitingLabels({
  orgId,
  boxes,
  setPrintImgs,
  onPrinted,
}: {
  orgId: string
  boxes: Box[]
  /** The labels for the print dialog, shown by the page outside its screen. */
  setPrintImgs: (imgs: string[]) => void
  onPrinted: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const n = boxes.length
  const plural = `${n} box label${n === 1 ? '' : 's'}`

  const marked = async (msg: string) => {
    setNote(msg)
    try {
      await markBoxesPrinted(orgId, boxes.map((b) => b.code))
    } catch {
      /* the note still stands */
    }
    onPrinted()
  }

  const printWeb = async () => {
    setBusy('Making the labels…')
    setError(null)
    try {
      const imgs: string[] = []
      for (const b of boxes) imgs.push(await labelDataUrl(boxLabel(b), BOX_SIZE))
      setPrintImgs(imgs)
      await new Promise((r) => setTimeout(r, 150))
      window.print()
      await marked(`${plural} sent to print.`)
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const pdf = async () => {
    setBusy('Making the PDF…')
    setError(null)
    try {
      const blob = await labelsPdf(boxes.map(boxLabel), BOX_SIZE)
      const name = 'ohrr-box-labels.pdf'
      let ok = true
      if (isNative) ok = (await shareFileNative(blob, name, 'OHRR box labels')) !== 'cancelled'
      else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = name
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 5000)
      }
      if (ok) await marked(`${plural}: a 4 × 6 in PDF, one label per page.`)
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border-2 border-brand-orange bg-brand-orange-50 p-4">
      <h2 className="font-display text-lg font-extrabold text-ink">{plural} to print</h2>
      <p className="text-base text-slate-700">
        Box {boxes.map((b) => b.box_no).join(', ')}. Put the 4 × 6 roll in the printer, print them, and stick each one over the number written on its box.
      </p>
      <ErrorBox>{error}</ErrorBox>
      <div className="grid grid-cols-2 gap-2">
        {isNative ? (
          <BigButton onClick={() => void pdf()} disabled={!!busy} icon="printer" className="col-span-2">
            {busy ?? 'Print or share them'}
          </BigButton>
        ) : (
          <>
            <BigButton onClick={() => void printWeb()} disabled={!!busy} icon="printer">
              {busy ?? 'Print'}
            </BigButton>
            <BigButton onClick={() => void pdf()} disabled={!!busy} tone="outline">
              PDF
            </BigButton>
          </>
        )}
      </div>
      <BluetoothPrint
        labels={boxes.map((b) => ({ code: b.code, item: boxLabel(b), copies: 1 }))}
        size={BOX_SIZE}
        busy={busy}
        setBusy={setBusy}
        onError={setError}
        onPrinted={(_codes, msg) => void marked(msg)}
      />
      {note && <p className="rounded-xl bg-white px-3 py-2 text-sm text-slate-600">{note}</p>}
    </section>
  )
}
