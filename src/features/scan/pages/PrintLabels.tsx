// Print labels, at the size of the printer's labels. Two lists, one page:
//   /staff/labels           donations and prizes: QR + barcode + DON number +
//                           name + donor (one per piece for a lot of 50)
//   /staff/hopshop/labels   Hop Shop price labels: QR + barcode + SKU + name +
//                           price (one per item in stock)
// Pick the items (the unprinted ones are ticked by default) and how many
// copies of each, then Print — on a laptop or a phone that sees the printer —
// or make a PDF, one label per page, to print from wherever the printer is —
// or send them straight to OHRR's Bluetooth label printer (printer/).
// ?code=X (repeatable) ticks just those; &copies=N sets their copies;
// ?c=X:N (repeatable) ticks X with N copies (a delivery's labels).
// Silent Auction items print as bid-sheet labels (prices, "Scan to buy it
// now") unless "Bid-sheet labels" is unticked (update 44).
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage, supabase } from '../../../lib/supabase'
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
import {
  LABEL_SIZES,
  LABEL_SIZE_SETTING,
  customLabelSize,
  labelDataUrl,
  labelSizeFrom,
  labelSizePickedAt,
  labelSizeSetAt,
  loadLabelSize,
  saveLabelSize,
  type AuctionLabel,
  type LabelItem,
  type LabelSize,
} from '../labels'
import { listenForLabelChanges, tellOthersLabelsChanged } from '../labelSync'
import { PAGE_SIZE, SHOW_OPTIONS, SORT_OPTIONS, WHEN_OPTIONS, filterRows, groupByDay, loadView, saveView, type ListView } from '../labelList'
import { setSetting, useSetting } from '../../settings/useSetting'
import type { Json } from '../../../lib/database.types'
import { AUCTION_EVENT_SLUG } from '../../raffle/types'
import BluetoothPrint from '../printer/BluetoothPrint'

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
  /** When it was added (ISO), for "Added" and the day groups. */
  added: string | null
  /** The item kind, or the product's type — for the Kind dropdown. */
  kind: string
}

const PRICE_KEY = 'ohrr.labels.shopPrice'
const SHEET_KEY = 'ohrr.labels.auctionSheet'
function loadOn(key: string): boolean {
  try {
    return localStorage.getItem(key) !== 'off'
  } catch {
    return true
  }
}
function saveOn(key: string, on: boolean) {
  try {
    localStorage.setItem(key, on ? 'on' : 'off')
  } catch {
    /* private mode */
  }
}

/** The bid-sheet details of the auction items: their prices and the auction's switches. */
async function auctionDetails(orgId: string, ids: string[]): Promise<Map<string, AuctionLabel>> {
  const out = new Map<string, AuctionLabel>()
  if (ids.length === 0) return out
  const [items, settings] = await Promise.all([
    supabase.from('raffle_items').select('id, value_cents, starting_bid_cents, min_increment_cents, buy_now_cents').in('id', ids),
    supabase.from('auction_settings').select('*').eq('org_id', orgId).eq('event_slug', AUCTION_EVENT_SLUG).maybeSingle(),
  ])
  if (items.error) throw items.error
  const s = settings.data
  for (const r of items.data ?? []) {
    out.set(r.id, {
      value_cents: r.value_cents,
      starting_bid_cents: r.starting_bid_cents,
      increment_cents: r.min_increment_cents ?? s?.default_increment_cents ?? null,
      buy_now_cents: r.buy_now_cents,
      buy_now_at_table: !!s?.buy_now_at_table,
      online_bidding: !!s?.bidding_enabled,
    })
  }
  return out
}

const SELECT =
  'mt-1 block min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-base font-semibold text-ink outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/15'

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

function itemRow(i: TaggedItem, auction?: AuctionLabel): Row {
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
    added: i.created_at ?? null,
    kind: i.kind,
    label: {
      code: i.code,
      title: i.title,
      donated_by: i.donated_by,
      photo_url: i.photo_url,
      kindLabel: i.kind === 'donation' ? null : KIND_META[i.kind].label,
      auction: auction ?? null,
    },
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
    added: (p as { created_at?: string | null }).created_at ?? p.updated_at ?? null,
    kind: p.type_name ?? p.category ?? 'Other',
    label: { code, title: p.name, photo_url: p.photo_url, shop: true, price_cents: p.price_cents },
  }
}

export default function PrintLabels({ mode = 'items' }: { mode?: Mode }) {
  const shop = mode === 'shop'
  const { membership, user, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  // The label size is the rescue's (one printer, one roll). The last size picked
  // stays until someone picks another: whoever may manage settings picks it for
  // every phone and computer; anyone else picks it for this device, until the
  // rescue's size is changed after that.
  const sharedSize = useSetting<Json>(LABEL_SIZE_SETTING, null)
  const setsForAll = can('settings.manage')
  const [items, setItems] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPrice, setShowPrice] = useState(() => loadOn(PRICE_KEY))
  const [bidSheet, setBidSheet] = useState(() => loadOn(SHEET_KEY))
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
  const toLabel = (r: Row): LabelItem =>
    shop ? { ...r.label, price_cents: showPrice ? r.price_cents : null } : bidSheet ? r.label : { ...r.label, auction: null }
  // Show / Added / Kind / Sort, kept on the device ("Print this label" links show just their items).
  const [view, setViewState] = useState<ListView>(() => (wanted.length ? { ...loadView(), show: 'ticked' } : loadView()))
  const [limit, setLimit] = useState(PAGE_SIZE)
  const setView = (patch: Partial<ListView>) => {
    const next = { ...view, ...patch }
    setViewState(next)
    saveView(next)
    setLimit(PAGE_SIZE)
  }
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

  const load = async (again = false) => {
    try {
      // Hop Shop products print on their own page, as price labels.
      let rows: Row[]
      if (shop) rows = (await listProducts(orgId)).filter((p) => p.code || p.sku).map(productRow)
      else {
        const list = (await listItems(orgId)).filter((i) => i.kind !== 'stock')
        // Auction items carry their prices for the bid-sheet label; without them it's a plain label.
        const prices = await auctionDetails(orgId, list.filter((i) => i.kind === 'auction').map((i) => i.ref_id)).catch(() => new Map<string, AuctionLabel>())
        rows = list.map((i) => itemRow(i, i.kind === 'auction' ? prices.get(i.ref_id) : undefined))
      }
      if (again) {
        // Printed on another phone or computer since the last look: untick them, so nothing prints twice.
        const before = new Map((items ?? []).map((r) => [r.code, r.label_printed_at]))
        const done = rows.filter((r) => r.label_printed_at && before.has(r.code) && !before.get(r.code)).map((r) => r.code)
        if (done.length) {
          setPicked((p) => {
            const gone = done.filter((c) => p.has(c))
            if (gone.length === 0) return p
            setNote(`${plural(gone.length)} you had ticked ${gone.length === 1 ? 'was' : 'were'} printed by someone else, so ${gone.length === 1 ? 'it is' : 'they are'} unticked.`)
            return new Set([...p].filter((c) => !gone.includes(c)))
          })
        }
      }
      setItems(rows)
      setPicked((p) => {
        if (again || p.size) return p
        if (wanted.length) {
          const have = new Set(rows.map((r) => r.code))
          const w = wanted.filter((c) => have.has(c))
          if (w.length) {
            const copies = w.map((c) => [c, perCode.get(c) ?? wantedCopies] as const).filter(([, n]) => n > 1)
            if (copies.length) setCopyText(Object.fromEntries(copies.map(([c, n]) => [c, String(clampCopies(n))])))
            return new Set(w)
          }
        }
        // Nothing ticked to start with: with hundreds of items, people tick what they want.
        return new Set<string>()
      })
    } catch (e) {
      setError(errMessage(e))
    }
  }
  useEffect(() => {
    if (orgId) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, mode])
  // Printing marks the labels in the database for everyone. When another device
  // does that, it sends a nudge (labelSync.ts) and this page reads the list again
  // — no polling. It also reads it again when the page comes back into view, in
  // case a nudge was missed while the phone was asleep.
  const loadRef = useRef(load)
  loadRef.current = load
  useEffect(() => {
    if (!orgId) return
    const again = () => {
      if (document.visibilityState === 'visible') void loadRef.current(true)
    }
    const stop = listenForLabelChanges(orgId, () => void loadRef.current(true))
    document.addEventListener('visibilitychange', again)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', again)
    }
  }, [orgId, mode])

  const shown = useMemo(() => filterRows(items ?? [], view, q, picked), [items, view, q, picked])
  const groups = useMemo(() => groupByDay(shown.slice(0, limit), view.sort), [shown, limit, view.sort])
  const kinds = useMemo(() => {
    const seen = new Map<string, string>()
    for (const r of items ?? []) if (!seen.has(r.kind)) seen.set(r.kind, shop ? r.kind : (KIND_META[r.kind as keyof typeof KIND_META]?.label ?? r.kind))
    return [...seen].sort((a, b) => a[1].localeCompare(b[1]))
  }, [items, shop])
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
  }, [selected, shown, size, showPrice, bidSheet])

  const [customOpen, setCustomOpen] = useState(false)
  const showSize = (s: LabelSize, at: number) => {
    setSize(s)
    saveLabelSize(s, at)
    setCustomW(String(s.wIn))
    setCustomH(String(s.hIn))
  }
  const rescueSize = sharedSize.loading ? null : labelSizeFrom(sharedSize.value)
  const rescueAt = labelSizeSetAt(sharedSize.value)
  useEffect(() => {
    // The newer pick wins: the rescue's size only replaces this device's own pick if it was set after it.
    if (rescueSize && rescueAt > labelSizePickedAt()) showSize(rescueSize, rescueAt)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rescueSize?.key, rescueAt])
  const chooseSize = (s: LabelSize) => {
    const at = Date.now()
    showSize(s, at)
    setCustomOpen(false)
    if (setsForAll && orgId)
      setSetting(LABEL_SIZE_SETTING, { wIn: s.wIn, hIn: s.hIn, at }, { orgId, userId: user?.id }).catch((e) =>
        setError(`The size is set on this device, but couldn’t be saved for everyone: ${errMessage(e)}`),
      )
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
      tellOthersLabelsChanged(orgId)
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

  const counts = {
    unprinted: (items ?? []).filter((i) => !i.label_printed_at).length,
    printed: (items ?? []).filter((i) => i.label_printed_at).length,
    all: items?.length ?? 0,
    ticked: picked.size,
  }

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
          <label htmlFor="label-size" className="text-base font-bold text-ink">
            Label size
          </label>
          <select
            id="label-size"
            value={customOpen || size.key.startsWith('custom:') ? 'custom' : size.key}
            onChange={(e) => {
              const s = LABEL_SIZES.find((x) => x.key === e.target.value)
              if (s) chooseSize(s)
              else setCustomOpen(true)
            }}
            className={SELECT}
          >
            {LABEL_SIZES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
            <option value="custom">{size.key.startsWith('custom:') ? size.label : 'Another size…'}</option>
          </select>
          <p className="mt-1 text-sm text-slate-500">
            {setsForAll
              ? 'Stays until someone changes it — for the whole rescue, on every phone and computer.'
              : rescueSize
                ? `Stays until it’s changed. The rescue’s size is ${rescueSize.label}.`
                : 'Stays on this device until it’s changed.'}
          </p>
          {(customOpen || size.key.startsWith('custom:')) && (
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
          )}
          {shop && (
            <label className="mt-3 flex min-h-[44px] items-center gap-2 text-[15px] font-bold text-slate-700">
              <input
                type="checkbox"
                checked={showPrice}
                onChange={(e) => {
                  setShowPrice(e.target.checked)
                  saveOn(PRICE_KEY, e.target.checked)
                }}
                className="h-6 w-6 accent-brand-blue"
              />
              Show the price on the label
            </label>
          )}
          {!shop && (items ?? []).some((r) => r.label.auction) && (
            <label className="mt-3 flex min-h-[44px] items-start gap-2 text-[15px] font-bold text-slate-700">
              <input
                type="checkbox"
                checked={bidSheet}
                onChange={(e) => {
                  setBidSheet(e.target.checked)
                  saveOn(SHEET_KEY, e.target.checked)
                }}
                className="mt-0.5 h-6 w-6 shrink-0 accent-brand-blue"
              />
              <span>
                Bid-sheet labels for Silent Auction items
                <span className="block text-sm font-semibold text-slate-500">Starting bid, raise, Buy it now price and “Scan to buy it now”. 3 × 2 in or bigger reads best.</span>
              </span>
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
        <BluetoothPrint
          labels={selected.map((i) => ({ code: i.code, item: toLabel(i), copies: copiesOf(i.code) }))}
          size={size}
          busy={busy}
          setBusy={setBusy}
          onError={setError}
          onPrinted={(codes, msg) => {
            setNote(msg)
            void markPrinted(codes)
          }}
        />
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
            ? 'Print or share: in the share sheet choose the printer’s app — for OHRR’s Phomemo and Omezizy printers that is Labelife: PDF processing → pick the label size → Print. AirPrint works for printers that have it.'
            : 'In the print dialog choose the label printer and its label size; margins are zero. “Save as PDF” works too.'}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm font-bold text-slate-600">
            Show
            <select value={view.show} onChange={(e) => setView({ show: e.target.value as ListView['show'] })} className={SELECT}>
              {SHOW_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label} ({counts[o.value]})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold text-slate-600">
            Added
            <select value={view.when} onChange={(e) => setView({ when: e.target.value as ListView['when'] })} className={SELECT}>
              {WHEN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {kinds.length > 1 && (
            <label className="text-sm font-bold text-slate-600">
              {shop ? 'Type' : 'Kind'}
              <select value={view.kind} onChange={(e) => setView({ kind: e.target.value })} className={SELECT}>
                <option value="all">All</option>
                {kinds.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="text-sm font-bold text-slate-600">
            Sort
            <select value={view.sort} onChange={(e) => setView({ sort: e.target.value as ListView['sort'] })} className={SELECT}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-x-2">
          <span className="text-sm text-slate-600">
            {shown.length} shown · {picked.size} ticked
          </span>
          {shown.length > 0 && (
            <button type="button" onClick={() => setPicked((p) => new Set([...p, ...shown.map((i) => i.code)]))} className="min-h-[44px] px-2 text-[15px] font-bold text-brand-blue">
              Tick all {shown.length}
            </button>
          )}
          {picked.size > 0 && (
            <button type="button" onClick={() => setPicked(new Set())} className="min-h-[44px] px-2 text-[15px] font-bold text-brand-blue">
              Untick all
            </button>
          )}
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
            {view.show === 'unprinted' && view.when === 'any' && view.kind === 'all' && !q.trim() ? 'Every label has been printed.' : 'Nothing matches. Try Any time, All, or a different search.'}
          </div>
        )}
        {groups.map((g) => (
          <section key={g.heading || 'all'} className="space-y-2">
            {g.heading && (
              <div className="flex items-center justify-between gap-2 pt-2">
                <h2 className="font-display text-base font-extrabold text-ink">
                  {g.heading} <span className="font-sans text-sm font-semibold text-slate-500">· {g.rows.length}</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setPicked((p) => new Set([...p, ...g.rows.map((i) => i.code)]))}
                  className="min-h-[44px] px-2 text-[15px] font-bold text-brand-blue"
                >
                  Tick these {g.rows.length}
                </button>
              </div>
            )}
        <ul className="space-y-2">
          {g.rows.map((i) => {
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
          </section>
        ))}
        {shown.length > limit && (
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE_SIZE)}
            className="min-h-[48px] w-full rounded-2xl border-2 border-brand-blue/50 bg-white text-[15px] font-bold text-brand-blue"
          >
            Show {Math.min(PAGE_SIZE, shown.length - limit)} more ({shown.length - limit} not shown yet)
          </button>
        )}
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
