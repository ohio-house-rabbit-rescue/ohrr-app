// Print labels, at the size of the printer's labels. Two lists, one page:
//   /staff/labels           donations and prizes: QR + barcode + DON number +
//                           name + donor (one per piece for a lot of 50)
//   /staff/hopshop/labels   Hop Shop price labels: QR + barcode + SKU + name +
//                           price (one per item in stock)
// Pick the items (the unprinted ones are ticked by default) and how many
// copies of each, then Print — on a laptop or a phone that sees the printer —
// or make a PDF, one label per page, to print from wherever the printer is.
// ?code=X (repeatable) ticks just those; &copies=N sets their copies;
// ?c=X:N (repeatable) ticks X with N copies (a delivery's labels).
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { Icon } from '../../../components/icons'
import { Screen } from '../../../components/ui'
import { Spinner } from '../../../components/staffui'
import type { IconName } from '../../../components/icons'
import { isNative } from '../../../native/platform'
import { shareFileNative } from '../../../native/share'
import { listItems, markLabelsPrinted } from '../api'
import { listProducts, money, type StockCard } from '../../hopshop/api'
import { BigButton, ErrorBox } from '../ScanUI'
import { KIND_META, type TaggedItem } from '../types'
import { LABEL_SIZES, customLabelSize, labelDataUrl, loadLabelSize, saveLabelSize, type LabelItem, type LabelSize } from '../labels'

type Show = 'unprinted' | 'all'
type Mode = 'items' | 'shop'

/** One line on the page: a donation or prize, or a Hop Shop product. */
interface Row {
  key: string
  code: string
  title: string
  /** The grey line under the name. */
  sub: string
  photo_url: string | null
  icon: IconName
  quantity: number | null
  label_printed_at: string | null
  price_cents: number | null
  label: LabelItem
}

const PRICE_KEY = 'ohrr.labels.shopPrice'
function loadShowPrice(): boolean {
  try {
    return localStorage.getItem(PRICE_KEY) !== 'off'
  } catch {
    return true
  }
}

/** Copies of one label: 1 to 200. */
const MAX_COPIES = 200
const clampCopies = (n: number) => Math.min(MAX_COPIES, Math.max(1, Math.round(n) || 1))
const plural = (n: number) => `${n} label${n === 1 ? '' : 's'}`

/**
 * The labels as one PDF, one label per page at the label's size, each label
 * repeated for its copies. Every label is painted once; its copies reuse the
 * same picture, so 200 copies stay quick and small.
 */
async function labelsPdfCopies(list: { item: LabelItem; copies: number }[], size: LabelSize): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const orientation = size.wIn >= size.hIn ? 'landscape' : 'portrait'
  const doc = new jsPDF({ unit: 'in', format: [size.wIn, size.hIn], orientation })
  let first = true
  for (const { item, copies } of list) {
    const png = await labelDataUrl(item, size, 203)
    for (let c = 0; c < copies; c++) {
      if (!first) doc.addPage([size.wIn, size.hIn], orientation)
      first = false
      doc.addImage(png, 'PNG', 0, 0, size.wIn, size.hIn, `label-${item.code}`)
    }
  }
  return doc.output('blob')
}

function itemRow(i: TaggedItem): Row {
  return {
    key: i.tag_id,
    code: i.code,
    title: i.title,
    sub: `${i.donated_by ? `From ${i.donated_by} · ` : ''}${KIND_META[i.kind].label}`,
    photo_url: i.photo_url,
    icon: KIND_META[i.kind].icon,
    quantity: i.quantity,
    label_printed_at: i.label_printed_at ?? null,
    price_cents: null,
    label: { code: i.code, title: i.title, donated_by: i.donated_by, photo_url: i.photo_url, kindLabel: i.kind === 'donation' ? null : KIND_META[i.kind].label },
  }
}

function productRow(p: StockCard): Row {
  const code = p.code ?? p.sku ?? ''
  return {
    key: p.id,
    code,
    title: p.name,
    sub: [money(p.price_cents), `${p.quantity ?? 0} in stock`, p.type_name ?? p.category, p.is_active ? null : 'hidden'].filter(Boolean).join(' · '),
    photo_url: p.photo_url,
    icon: 'bag',
    quantity: p.quantity,
    label_printed_at: p.label_printed_at ?? null,
    price_cents: p.price_cents,
    label: { code, title: p.name, photo_url: p.photo_url, shop: true, price_cents: p.price_cents },
  }
}

export default function PrintLabels({ mode = 'items' }: { mode?: Mode }) {
  const shop = mode === 'shop'
  const { membership } = useAuth()
  const orgId = membership?.orgId ?? ''
  const [items, setItems] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPrice, setShowPrice] = useState(loadShowPrice)
  // ?code=DON-00042 (one or more): tick just those — "Print this label" from the catalog or a product card.
  const [searchParams] = useSearchParams()
  const perCode = useMemo(() => {
    const m = new Map<string, number>()
    for (const v of searchParams.getAll('c')) {
      const [code, n] = v.split(':')
      if (code?.trim()) m.set(code.trim().toUpperCase(), Number(n) || 1)
    }
    return m
  }, [searchParams])
  const wanted = useMemo(
    () => [...searchParams.getAll('code').map((c) => c.trim().toUpperCase()).filter(Boolean), ...perCode.keys()],
    [searchParams, perCode],
  )
  const wantedCopies = Number(searchParams.get('copies')) || 0
  const toLabel = (r: Row): LabelItem => (shop ? { ...r.label, price_cents: showPrice ? r.price_cents : null } : r.label)
  const [show, setShow] = useState<Show>(wanted.length ? 'all' : 'unprinted')
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [size, setSize] = useState<LabelSize>(() => loadLabelSize())
  const [customW, setCustomW] = useState(String(size.wIn))
  const [customH, setCustomH] = useState(String(size.hIn))
  const [preview, setPreview] = useState<string | null>(null)
  const [printImgs, setPrintImgs] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [lastMarked, setLastMarked] = useState<string[]>([])
  // Copies per label, as typed (so the box can be cleared while typing); 1 when not set.
  const [copyText, setCopyText] = useState<Record<string, string>>({})

  const load = async () => {
    try {
      // Hop Shop products print on their own page, as price labels.
      const rows = shop
        ? (await listProducts(orgId)).filter((p) => p.code || p.sku).map(productRow)
        : (await listItems(orgId)).filter((i) => i.kind !== 'stock').map(itemRow)
      setItems(rows)
      setPicked((p) => {
        if (p.size) return p
        if (wanted.length) {
          const have = new Set(rows.map((r) => r.code))
          const w = wanted.filter((c) => have.has(c))
          if (w.length) {
            const copies = w.map((c) => [c, perCode.get(c) ?? wantedCopies] as const).filter(([, n]) => n > 1)
            if (copies.length) setCopyText(Object.fromEntries(copies.map(([c, n]) => [c, String(clampCopies(n))])))
            return new Set(w)
          }
        }
        return new Set(rows.filter((r) => !r.label_printed_at).map((r) => r.code))
      })
    } catch (e) {
      setError(errMessage(e))
    }
  }
  useEffect(() => {
    if (orgId) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, mode])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (items ?? []).filter(
      (i) =>
        (show === 'all' || !i.label_printed_at) &&
        (!needle || i.title.toLowerCase().includes(needle) || i.code.toLowerCase().includes(needle) || i.sub.toLowerCase().includes(needle)),
    )
  }, [items, show, q])
  const selected = useMemo(() => (items ?? []).filter((i) => picked.has(i.code)), [items, picked])
  const copiesOf = (code: string) => clampCopies(parseInt(copyText[code] ?? '1', 10))
  const setCopies = (code: string, n: number) => setCopyText((c) => ({ ...c, [code]: String(clampCopies(n)) }))
  const totalLabels = selected.reduce((n, i) => n + copiesOf(i.code), 0)

  // A preview of the first ticked label, at the chosen size.
  useEffect(() => {
    const first = selected[0] ?? shown[0]
    if (!first) {
      setPreview(null)
      return
    }
    let alive = true
    labelDataUrl(toLabel(first), size, 150)
      .then((u) => alive && setPreview(u))
      .catch(() => alive && setPreview(null))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, shown, size, showPrice])

  const chooseSize = (s: LabelSize) => {
    setSize(s)
    saveLabelSize(s)
    setCustomW(String(s.wIn))
    setCustomH(String(s.hIn))
  }
  const applyCustom = () => {
    const w = Number(customW)
    const h = Number(customH)
    if (w >= 0.5 && h >= 0.5 && w <= 8.5 && h <= 11) chooseSize(customLabelSize(w, h))
  }

  const toggle = (code: string) =>
    setPicked((p) => {
      const n = new Set(p)
      if (n.has(code)) n.delete(code)
      else n.add(code)
      return n
    })

  const markPrinted = async (codes: string[], printed = true) => {
    try {
      await markLabelsPrinted(orgId, codes, printed)
      setItems((rows) => (rows ?? []).map((r) => (codes.includes(r.code) ? { ...r, label_printed_at: printed ? new Date().toISOString() : null } : r)))
      setLastMarked(printed ? codes : [])
    } catch (e) {
      setError(errMessage(e))
    }
  }

  // Web: paint every label, put them on print pages, open the print dialog.
  const print = async () => {
    if (selected.length === 0) return
    setBusy('Making the labels…')
    setError(null)
    try {
      const imgs: string[] = []
      for (const it of selected) {
        const img = await labelDataUrl(toLabel(it), size)
        for (let c = copiesOf(it.code); c > 0; c--) imgs.push(img)
      }
      setPrintImgs(imgs)
      await new Promise((r) => setTimeout(r, 150))
      window.print()
      await markPrinted(selected.map((s) => s.code))
      setNote(`${plural(imgs.length)} sent to print and marked as printed.`)
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(null)
    }
  }

  // A PDF with one label per page — for the printer's own app, or to send along.
  const pdf = async () => {
    if (selected.length === 0) return
    setBusy('Making the PDF…')
    setError(null)
    try {
      const list = selected.map((i) => ({ item: toLabel(i), copies: copiesOf(i.code) }))
      const pages = list.reduce((n, l) => n + l.copies, 0)
      const blob = await labelsPdfCopies(list, size)
      const name = `ohrr-${shop ? 'shop-' : ''}labels-${new Date().toISOString().slice(0, 10)}.pdf`
      if (isNative) {
        const out = await shareFileNative(blob, name, shop ? 'OHRR Hop Shop labels' : 'OHRR item labels')
        if (out === 'cancelled') return
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = name
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 5000)
      }
      await markPrinted(selected.map((s) => s.code))
      setNote(`${plural(pages)} in the PDF, each on its own ${size.wIn} × ${size.hIn} in page, marked as printed.`)
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const unprintedCount = (items ?? []).filter((i) => !i.label_printed_at).length

  return (
    <>
      <Screen className="space-y-4 print:hidden">
        <div className="pt-1">
          <Link to={shop ? '/staff/hopshop' : '/staff/items'} className="inline-flex min-h-[44px] items-center gap-1 text-base font-bold text-brand-blue">
            <Icon name="arrowLeft" size={20} /> {shop ? 'Hop Shop inventory' : 'Items'}
          </Link>
          <h1 className="mt-1 font-display text-2xl font-black text-ink">{shop ? 'Hop Shop labels' : 'Print labels'}</h1>
          <p className="mt-1 text-base text-slate-600">
            {shop
              ? 'A price label for each item on the shelf: the name, the price and its SKU. The barcode scans at the till; the QR code opens the item.'
              : 'A label per donation — or a copy for every piece: the QR code opens it, the barcode scans at the till or desk, and the DON number can be typed. Any label printer works.'}
          </p>
          <p className="mt-1 text-sm">
            <Link to={shop ? '/staff/labels' : '/staff/hopshop/labels'} className="inline-flex min-h-[44px] items-center font-bold text-brand-blue">
              {shop ? 'Donation labels →' : 'Hop Shop price labels →'}
            </Link>
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-base font-bold text-ink">Label size</p>
          <p className="text-sm text-slate-500">The size of the labels in your printer. Remembered on this device.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {LABEL_SIZES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => chooseSize(s)}
                aria-pressed={size.key === s.key}
                className={`min-h-[44px] rounded-full px-4 text-[15px] font-bold transition ${
                  size.key === s.key ? 'bg-brand-blue text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-sm font-bold text-slate-600">
              Width (in)
              <input type="number" step="0.05" min="0.5" max="8.5" value={customW} onChange={(e) => setCustomW(e.target.value)} className="mt-1 block w-24 rounded-xl border-2 border-slate-200 px-3 py-2 text-base text-ink" />
            </label>
            <label className="text-sm font-bold text-slate-600">
              Height (in)
              <input type="number" step="0.05" min="0.5" max="11" value={customH} onChange={(e) => setCustomH(e.target.value)} className="mt-1 block w-24 rounded-xl border-2 border-slate-200 px-3 py-2 text-base text-ink" />
            </label>
            <button type="button" onClick={applyCustom} className="min-h-[44px] rounded-xl border-2 border-brand-blue/50 px-4 text-[15px] font-bold text-brand-blue">
              Use this size
            </button>
          </div>
          {shop && (
            <label className="mt-3 flex min-h-[44px] items-center gap-2 text-[15px] font-bold text-slate-700">
              <input
                type="checkbox"
                checked={showPrice}
                onChange={(e) => {
                  setShowPrice(e.target.checked)
                  try {
                    localStorage.setItem(PRICE_KEY, e.target.checked ? 'on' : 'off')
                  } catch {
                    /* private mode */
                  }
                }}
                className="h-6 w-6 accent-brand-blue"
              />
              Show the price on the label
            </label>
          )}
          {preview && (
            <div className="mt-4">
              <p className="mb-1 text-sm font-bold text-slate-600">Preview · {size.label}</p>
              <img src={preview} alt="Label preview" className="w-full max-w-sm rounded-lg border border-slate-200 shadow-sm" style={{ aspectRatio: `${size.wIn} / ${size.hIn}` }} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {isNative ? (
            <BigButton onClick={() => void pdf()} disabled={!!busy || selected.length === 0} icon="printer" className="col-span-2">
              {busy ?? `Print or share ${plural(totalLabels)}`}
            </BigButton>
          ) : (
            <>
              <BigButton onClick={() => void print()} disabled={!!busy || selected.length === 0} icon="printer">
                {busy ?? `Print ${totalLabels}`}
              </BigButton>
              <BigButton onClick={() => void pdf()} disabled={!!busy || selected.length === 0} tone="outline">
                PDF
              </BigButton>
            </>
          )}
        </div>
        {note && (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {note}{' '}
            {lastMarked.length > 0 && (
              <button type="button" onClick={() => void markPrinted(lastMarked, false)} className="font-bold text-brand-blue">
                Undo — mark not printed
              </button>
            )}
          </p>
        )}
        <p className="text-sm text-slate-500">
          {isNative
            ? 'In the share sheet choose the printer’s app — for OHRR’s Phomemo that is Labelife: PDF processing → pick the label size → Print. AirPrint works for printers that have it.'
            : 'In the print dialog choose the label printer and its label size; margins are zero. “Save as PDF” works too.'}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {(['unprinted', 'all'] as Show[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setShow(s)}
              className={`min-h-[44px] rounded-full px-4 text-[15px] font-bold transition ${show === s ? 'bg-brand-blue text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600'}`}
            >
              {s === 'unprinted' ? `Not printed yet (${unprintedCount})` : `Everything (${items?.length ?? 0})`}
            </button>
          ))}
          <button type="button" onClick={() => setPicked(new Set(shown.map((i) => i.code)))} className="min-h-[44px] px-2 text-[15px] font-bold text-brand-blue">
            Tick all shown
          </button>
          <button type="button" onClick={() => setPicked(new Set())} className="min-h-[44px] px-2 text-[15px] font-bold text-brand-blue">
            None
          </button>
        </div>
        <div className="relative">
          <Icon name="search" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={shop ? 'Search by name, type or SKU' : 'Search by name, donor or code'}
            aria-label="Search items"
            className="w-full rounded-2xl border-2 border-slate-200 bg-white py-3 pl-11 pr-4 text-base text-ink outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/15"
          />
        </div>

        <ErrorBox>{error}</ErrorBox>
        {items === null && !error && <Spinner />}
        {items && shown.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-base text-slate-500">
            {show === 'unprinted' ? 'Every label has been printed.' : 'Nothing to show.'}
          </div>
        )}
        <ul className="space-y-2">
          {shown.map((i) => {
            const on = picked.has(i.code)
            return (
              <li key={i.key}>
                <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition ${on ? 'border-brand-blue bg-brand-blue-50/50' : 'border-slate-200 bg-white'}`}>
                  <input type="checkbox" checked={on} onChange={() => toggle(i.code)} className="h-6 w-6 shrink-0 accent-brand-blue" aria-label={`Print a label for ${i.title}`} />
                  {i.photo_url ? (
                    <img src={i.photo_url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" loading="lazy" />
                  ) : (
                    <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                      <Icon name={i.icon} size={22} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-base font-extrabold text-ink">{i.title}</span>
                    <span className="block truncate text-sm text-slate-600">
                      {i.sub}
                      {i.label_printed_at ? ' · printed' : ''}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs font-bold text-slate-400">{i.code}</span>
                </label>
                {on && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2">
                    <span className="text-sm font-bold text-slate-600">Copies</span>
                    <button
                      type="button"
                      onClick={() => setCopies(i.code, copiesOf(i.code) - 1)}
                      disabled={copiesOf(i.code) <= 1}
                      aria-label={`One copy fewer of ${i.title}`}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-ink shadow-sm ring-1 ring-slate-200 transition active:scale-95 disabled:opacity-30"
                    >
                      <Icon name="minus" size={20} />
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={copyText[i.code] ?? '1'}
                      onChange={(e) => setCopyText((c) => ({ ...c, [i.code]: e.target.value.replace(/[^0-9]/g, '').slice(0, 3) }))}
                      onBlur={() => setCopies(i.code, copiesOf(i.code))}
                      aria-label={`Copies of ${i.title}`}
                      className="h-11 w-16 rounded-xl border-2 border-slate-200 bg-white text-center font-display text-lg font-black text-ink outline-none focus:border-brand-blue"
                    />
                    <button
                      type="button"
                      onClick={() => setCopies(i.code, copiesOf(i.code) + 1)}
                      disabled={copiesOf(i.code) >= MAX_COPIES}
                      aria-label={`One copy more of ${i.title}`}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-blue text-white shadow-sm transition active:scale-95 disabled:opacity-30"
                    >
                      <Icon name="plus" size={20} />
                    </button>
                    {(i.quantity ?? 0) > 1 && (
                      <button
                        type="button"
                        onClick={() => setCopies(i.code, i.quantity ?? 1)}
                        aria-pressed={copiesOf(i.code) === clampCopies(i.quantity ?? 1)}
                        className="min-h-[44px] rounded-xl border-2 border-brand-blue/50 bg-white px-3 text-[15px] font-bold text-brand-blue"
                      >
                        {shop ? 'One per item in stock' : 'One per piece'} ({clampCopies(i.quantity ?? 1)})
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </Screen>

      {/* print-only: one label per page at the label's size */}
      <div className="hidden print:block">
        {printImgs.map((src, i) => (
          <div key={i} className="label-page">
            <img src={src} alt="" />
          </div>
        ))}
      </div>
      <style>{`
        @media print {
          @page { size: ${size.wIn}in ${size.hIn}in; margin: 0; }
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          header { display: none !important; }
          [class*="max-w-[480px]"] { max-width: none !important; box-shadow: none !important; padding: 0 !important; }
          .label-page { width: ${size.wIn}in; height: ${size.hIn}in; overflow: hidden; page-break-after: always; break-after: page; }
          .label-page img { display: block; width: ${size.wIn}in; height: ${size.hIn}in; }
        }
      `}</style>
    </>
  )
}
