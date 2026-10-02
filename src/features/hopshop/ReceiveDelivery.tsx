// Hop Shop → Add a delivery: the supplier's invoice → stock (update 42).
//
//   1. Pick the supplier (or let the invoice say), then add the invoice: the
//      PDF from email, or photos of a paper one.
//   2. It's read on this device (invoiceRead.ts: the PDF's own text, or text
//      recognition for photos) and each line matched to a product
//      (invoiceParse.ts: their item number, a match made before, the packet
//      barcode, then the name — "check this one").
//   3. Check the list: the product, how many came, what one cost. Anything
//      matched by hand is remembered for this supplier's next invoice.
//   4. Add to stock. The delivery is kept (invoice number, date, totals with
//      shipping, the files) and its price labels are one tap away.
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { errMessage } from '../../lib/supabase'
import { Badge, btn, Card, Screen } from '../../components/ui'
import { Icon } from '../../components/icons'
import { FormError, Spinner, staffInput } from '../../components/staffui'
import { isNative } from '../../native/platform'
import { pickPhoto } from '../../native/camera'
import { dataUrlToBlob } from '../scan/api'
import { fromCents, listProducts, listSuppliers, money, saveProduct, toCents, type StockCard, type Supplier } from './api'
import { costEach, readInvoice, readLines, unitsFor, type InvoiceLine, type MatchHow, type RememberedMatch } from './invoiceParse'
import { readInvoiceFiles } from './invoiceRead'
import { receiveDelivery, rememberedMatches, uploadInvoiceFiles, type Delivery } from './deliveries'

const NEW = '__new'

interface Row {
  key: string
  readAs: string
  itemNo: string | null
  description: string
  /** On the invoice, as typed. */
  qty: string
  /** Sellable items in one of what the invoice counts. */
  unitsPer: number
  packId: string
  /** '' = not picked, NEW = make a new Hop Shop item from this line. */
  productId: string
  /** What one sellable item cost, in dollars as typed. */
  cost: string
  unitCents: number | null
  lineCents: number | null
  how: MatchHow | 'hand' | null
  sure: boolean
  checked: boolean
  matchKey: string
  remember: boolean
  include: boolean
}

const HOW_TEXT: Record<MatchHow | 'hand', string> = {
  remembered: 'Matched before',
  pack: 'Their item number',
  item: 'Their item number',
  barcode: 'Packet barcode',
  name: 'By name — check it',
  hand: 'Picked by hand',
}

let rowSeq = 0
const newKey = () => `r${++rowSeq}`

function rowFrom(line: InvoiceLine): Row {
  const unitsPer = line.match?.unitsPer ?? 1
  return {
    key: newKey(),
    readAs: line.readAs,
    itemNo: line.itemNo,
    description: line.description,
    qty: line.qty === null ? '' : String(line.qty),
    unitsPer,
    packId: line.match?.packId ?? '',
    productId: line.match?.productId ?? '',
    cost: fromCents(costEach(line.unitCents, unitsPer)),
    unitCents: line.unitCents,
    lineCents: line.lineCents,
    how: line.match?.how ?? null,
    sure: line.match?.sure ?? false,
    checked: line.checked,
    matchKey: line.matchKey,
    // A name match is a guess: remember it once someone has looked.
    remember: line.match?.how === 'name',
    include: !!line.match,
  }
}

const blankRow = (): Row => ({
  key: newKey(),
  readAs: '',
  itemNo: null,
  description: '',
  qty: '1',
  unitsPer: 1,
  packId: '',
  productId: '',
  cost: '',
  unitCents: null,
  lineCents: null,
  how: 'hand',
  sure: true,
  checked: false,
  matchKey: '',
  remember: false,
  include: true,
})

const qtyOf = (r: Row) => {
  const n = parseFloat(r.qty)
  return Number.isFinite(n) && n > 0 ? n : null
}
const unitsOf = (r: Row) => (r.productId ? unitsFor(qtyOf(r), r.unitsPer) : 0)
const dollars = (cents: number | null) => (cents === null ? '' : fromCents(cents))

type Step = 'start' | 'reading' | 'review' | 'saving' | 'done'

export default function ReceiveDelivery() {
  const { membership, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const canCreate = can('hopshop.products.create')
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [step, setStep] = useState<Step>('start')
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [products, setProducts] = useState<StockCard[] | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [readHow, setReadHow] = useState<'pdf' | 'photo' | 'typed'>('pdf')
  const [lines, setLines] = useState<string[]>([])
  const [supplierId, setSupplierId] = useState(params.get('supplier') ?? '')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [subtotal, setSubtotal] = useState('')
  const [shipping, setShipping] = useState('')
  const [tax, setTax] = useState('')
  const [total, setTotal] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [allowDup, setAllowDup] = useState(false)
  const [dupAsked, setDupAsked] = useState(false)
  const [result, setResult] = useState<Delivery | null>(null)
  const [madeNew, setMadeNew] = useState(0)
  const pdfRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const photosRef = useRef<HTMLInputElement>(null)
  const matchCache = useRef(new Map<string, RememberedMatch[]>())

  useEffect(() => {
    if (!orgId) return
    let live = true
    Promise.all([listProducts(orgId), listSuppliers(orgId)])
      .then(([p, s]) => {
        if (!live) return
        setProducts(p)
        setSuppliers(s.filter((x) => x.is_supplier))
      })
      .catch((e) => live && setError(errMessage(e)))
    return () => {
      live = false
    }
  }, [orgId])

  const byId = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products])
  const sorted = useMemo(() => [...(products ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [products])
  const supplierName = suppliers.find((s) => s.id === supplierId)?.name ?? null

  const matchesFor = async (sid: string): Promise<RememberedMatch[]> => {
    if (!sid) return []
    const hit = matchCache.current.get(sid)
    if (hit) return hit
    const m = await rememberedMatches(orgId, sid).catch(() => [])
    matchCache.current.set(sid, m)
    return m
  }

  /* ------------------------------------------------ files */
  const addFiles = (list: FileList | File[] | null) => {
    const picked = Array.from(list ?? [])
    if (!picked.length) return
    setError(null)
    setFiles((f) => [...f, ...picked].slice(0, 6))
  }
  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files)
    e.target.value = ''
  }
  const takePhoto = async () => {
    if (!isNative) {
      cameraRef.current?.click()
      return
    }
    try {
      const url = await pickPhoto('camera')
      if (url) addFiles([new File([await dataUrlToBlob(url)], `page-${files.length + 1}.jpg`, { type: 'image/jpeg' })])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t take the photo.')
    }
  }

  /* ------------------------------------------------ reading */
  const read = async () => {
    if (!files.length || !products) return
    setError(null)
    setStep('reading')
    try {
      const res = await readInvoiceFiles(files, setNote)
      setReadHow(res.how)
      setLines(res.lines)
      const firstGo = readInvoice(res.lines, { products, suppliers, supplierId: supplierId || null })
      const sid = firstGo.supplierId ?? ''
      const remembered = await matchesFor(sid)
      const got = sid ? readInvoice(res.lines, { products, suppliers, supplierId: sid, remembered: () => remembered }) : firstGo
      setSupplierId(sid)
      setInvoiceNo(got.invoiceNo ?? '')
      setInvoiceDate(got.invoiceDate ?? '')
      setSubtotal(dollars(got.subtotalCents))
      setShipping(dollars(got.shippingCents))
      setTax(dollars(got.taxCents))
      setTotal(dollars(got.totalCents))
      setRows(got.lines.length ? got.lines.map(rowFrom) : [blankRow()])
      if (!got.lines.length) setError('No item lines could be read. Add them below, or try a clearer photo.')
      setStep('review')
    } catch (e) {
      setError(`The invoice couldn’t be read: ${errMessage(e)}`)
      setStep('start')
    } finally {
      setNote(null)
    }
  }

  const typeItIn = () => {
    setReadHow('typed')
    setRows([blankRow()])
    setStep('review')
  }

  // A different supplier: match the lines nobody has touched again, with their item numbers.
  const changeSupplier = async (sid: string) => {
    setSupplierId(sid)
    if (!products || !lines.length) return
    const remembered = await matchesFor(sid)
    const fresh = readLines(lines, products, sid || null, remembered)
    setRows((rs) =>
      rs.map((r) => {
        if (r.how === 'hand') return r
        const f = fresh.find((x) => x.readAs === r.readAs)
        return f ? { ...rowFrom(f), key: r.key } : r
      }),
    )
  }

  /* ------------------------------------------------ editing a line */
  const patch = (key: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)))
  const pickProduct = (r: Row, productId: string) => {
    const p = byId.get(productId)
    const cost = r.unitCents !== null ? fromCents(costEach(r.unitCents, 1)) : productId && p?.cost_cents != null ? fromCents(p.cost_cents) : r.cost
    patch(r.key, { productId, packId: '', unitsPer: 1, cost, how: 'hand', sure: true, remember: !!productId && productId !== NEW, include: !!productId })
  }
  const pickPack = (r: Row, value: string) => {
    const p = byId.get(r.productId)
    const k = p?.packs?.find((x) => x.id === value)
    const unitsPer = value === '' ? 1 : value === 'per' ? r.unitsPer : (k?.units ?? 1)
    patch(r.key, { packId: value === 'per' ? '' : value, unitsPer, cost: r.unitCents !== null ? fromCents(costEach(r.unitCents, unitsPer)) : r.cost, remember: r.remember || r.how === 'hand' })
  }

  const included = rows.filter((r) => r.include && r.productId)
  const unitsTotal = included.reduce((n, r) => n + (r.productId === NEW ? unitsFor(qtyOf(r), r.unitsPer) : unitsOf(r)), 0)
  const linesCents = rows.reduce((n, r) => n + (r.lineCents ?? (r.unitCents !== null && qtyOf(r) !== null ? Math.round(r.unitCents * (qtyOf(r) ?? 0)) : 0)), 0)
  const subtotalCents = toCents(subtotal)

  /* ------------------------------------------------ saving */
  const save = async () => {
    setError(null)
    if (included.length === 0) {
      setError('Tick at least one line and pick its product.')
      return
    }
    setStep('saving')
    let made = 0
    const work = rows.map((r) => ({ ...r }))
    try {
      // New Hop Shop items first, hidden from the shelf until they have a price.
      for (const r of work) {
        if (!r.include || r.productId !== NEW) continue
        setNote(`Adding ${r.description || 'a new item'} to Hop Shop inventory…`)
        const card = await saveProduct(orgId, {
          id: null,
          name: (r.description || r.readAs || 'New item').slice(0, 120),
          price_cents: 0,
          description: null,
          photo_url: null,
          is_active: false,
          type_id: null,
          barcode: '',
          supplier_id: supplierId || null,
          supplier_sku: r.itemNo,
          cost_cents: toCents(r.cost),
          unit: null,
          category: null,
          shelf: null,
          reorder_point: null,
          reorder_qty: null,
          quantity: null,
        })
        r.productId = card.id
        r.remember = true
        made++
      }
      setRows(work)
      let paths: string[] = []
      if (files.length) {
        setNote('Keeping a copy of the invoice…')
        try {
          paths = await uploadInvoiceFiles(orgId, files)
        } catch (e) {
          setError(`The stock was added, but the invoice file wasn’t kept: ${errMessage(e)}`)
        }
      }
      setNote('Adding to stock…')
      const d = await receiveDelivery(orgId, {
        supplier_id: supplierId || null,
        invoice_no: invoiceNo.trim() || null,
        invoice_date: invoiceDate || null,
        subtotal_cents: toCents(subtotal),
        shipping_cents: toCents(shipping),
        tax_cents: toCents(tax),
        total_cents: toCents(total),
        file_paths: paths,
        note: null,
        allow_duplicate: allowDup,
        lines: work
          .filter((r) => r.readAs || r.productId)
          .map((r) => ({
            product_id: r.include && r.productId ? r.productId : null,
            read_as: r.readAs || r.description || null,
            supplier_sku: r.itemNo,
            qty_invoiced: qtyOf(r),
            units: r.include && r.productId ? unitsFor(qtyOf(r), r.unitsPer) : 0,
            unit_cost_cents: toCents(r.cost),
            line_total_cents: r.lineCents,
            update_cost: true,
            match_key: r.matchKey || (r.itemNo ? r.itemNo.toLowerCase() : r.description.toLowerCase()) || null,
            units_per: r.unitsPer,
            remember: r.remember && !!supplierId,
          })),
      })
      setMadeNew(made)
      setResult(d)
      setStep('done')
    } catch (e) {
      const msg = errMessage(e)
      setError(msg)
      if (/already added/i.test(msg)) setDupAsked(true)
      setStep('review')
    } finally {
      setNote(null)
    }
  }

  const reset = () => {
    setStep('start')
    setFiles([])
    setLines([])
    setRows([])
    setInvoiceNo('')
    setInvoiceDate('')
    setSubtotal('')
    setShipping('')
    setTax('')
    setTotal('')
    setAllowDup(false)
    setDupAsked(false)
    setResult(null)
    setError(null)
    void listProducts(orgId).then(setProducts).catch(() => undefined)
  }

  const labelsLink = (d: Delivery) => {
    const qs = (d.lines ?? [])
      .filter((l) => l.sku && l.units_added > 0)
      .map((l) => `c=${encodeURIComponent(`${l.sku}:${l.units_added}`)}`)
      .join('&')
    return `/staff/hopshop/labels${qs ? `?${qs}` : ''}`
  }

  /* ------------------------------------------------ screens */
  return (
    <Screen className="space-y-4">
      {/* File inputs live here once, never inside a step (a re-mounted input loses the photo). */}
      <input ref={pdfRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onFiles} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFiles} />
      <input ref={photosRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={onFiles} />

      <div className="pt-1">
        <Link to="/staff/hopshop/reorder" className="inline-flex min-h-[44px] items-center gap-1 text-base font-bold text-brand-blue">
          <Icon name="arrowLeft" size={20} /> Hop Shop inventory
        </Link>
        <h1 className="mt-1 font-display text-2xl font-black text-ink">Add a delivery</h1>
        {step === 'start' && (
          <p className="mt-1 text-base text-slate-600">
            From the supplier’s invoice: the PDF from their email, or photos of a paper one. It’s read on this device, then you check the list
            before anything changes.
          </p>
        )}
      </div>

      {step === 'start' && (
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            Supplier
            <select className={staffInput} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Work it out from the invoice</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-2">
            <button type="button" onClick={() => pdfRef.current?.click()} className={`${btn.blue} min-h-[52px] w-full`}>
              <Icon name="mail" size={18} /> The PDF from their email
            </button>
            <button type="button" onClick={() => void takePhoto()} className={`${btn.blue} min-h-[52px] w-full`}>
              <Icon name="camera" size={18} /> Photograph a paper invoice
            </button>
            <button type="button" onClick={() => photosRef.current?.click()} className="min-h-[44px] text-sm font-bold text-brand-blue">
              Choose files or photos instead
            </button>
          </div>

          {files.length > 0 && (
            <Card className="space-y-2">
              <p className="text-sm font-bold text-ink">The invoice</p>
              <ul className="space-y-1">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-sm text-slate-700">
                    <Icon name={/pdf/i.test(f.type) || /\.pdf$/i.test(f.name) ? 'file' : 'camera'} size={16} />
                    <span className="min-w-0 flex-1 truncate">{/pdf/i.test(f.type) || /\.pdf$/i.test(f.name) ? f.name : `Photo, page ${i + 1}`}</span>
                    <button
                      type="button"
                      onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}
                      aria-label={`Remove ${f.name}`}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:bg-slate-50"
                    >
                      <Icon name="x" size={16} />
                    </button>
                  </li>
                ))}
              </ul>
              {files.some((f) => !/pdf/i.test(f.type) && !/\.pdf$/i.test(f.name)) && (
                <p className="text-xs text-slate-500">More than one page? Photograph each one. Flat, in good light, the whole page in the picture.</p>
              )}
              <button type="button" onClick={() => void read()} disabled={!products} className={`${btn.primary} min-h-[52px] w-full disabled:opacity-60`}>
                <Icon name="search" size={18} /> Read the invoice
              </button>
            </Card>
          )}
          <FormError>{error}</FormError>
          <p className="text-sm text-slate-600">
            No invoice to hand?{' '}
            <button type="button" onClick={typeItIn} className="min-h-[44px] font-bold text-brand-blue">
              Type the lines yourself
            </button>
            {' · '}
            <Link to="/staff/hopshop/deliveries" className="font-bold text-brand-blue">
              Past deliveries
            </Link>
          </p>
        </div>
      )}

      {(step === 'reading' || step === 'saving') && (
        <Card className="py-8 text-center">
          <Spinner label={note ?? (step === 'reading' ? 'Reading the invoice…' : 'Saving…')} />
          {step === 'reading' && readHow === 'photo' && <p className="mt-2 text-xs text-slate-500">The first photo takes longer: the text reader loads once.</p>}
        </Card>
      )}

      {step === 'review' && (
        <div className="space-y-4">
          <Card className="space-y-3">
            <p className="text-sm font-bold text-ink">
              {readHow === 'typed' ? 'The delivery' : `Read from the ${readHow === 'pdf' ? 'PDF' : files.length > 1 ? 'photos' : 'photo'} — check each line`}
            </p>
            <label className="block text-sm font-semibold text-slate-700">
              Supplier
              <select className={staffInput} value={supplierId} onChange={(e) => void changeSupplier(e.target.value)}>
                <option value="">— not in the list —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-semibold text-slate-700">
                Invoice number
                <input className={staffInput} value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Invoice date
                <input className={staffInput} type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              </label>
              {(
                [
                  ['Subtotal', subtotal, setSubtotal],
                  ['Shipping', shipping, setShipping],
                  ['Tax', tax, setTax],
                  ['Total', total, setTotal],
                ] as const
              ).map(([labelText, value, set]) => (
                <label key={labelText} className="block text-sm font-semibold text-slate-700">
                  {labelText} (USD)
                  <input className={staffInput} type="number" min="0" step="0.01" inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} />
                </label>
              ))}
            </div>
          </Card>

          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.key}>
                <LineCard
                  r={r}
                  products={sorted}
                  byId={byId}
                  canCreate={canCreate}
                  supplierName={supplierName}
                  onPatch={(p) => patch(r.key, p)}
                  onPickProduct={(id) => pickProduct(r, id)}
                  onPickPack={(v) => pickPack(r, v)}
                  onRemove={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                />
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setRows((rs) => [...rs, blankRow()])} className={`${btn.outline} min-h-[44px] w-full`}>
            <Icon name="plus" size={16} /> Add a line
          </button>

          {linesCents > 0 && (
            <p
              className={`rounded-xl px-3 py-2 text-sm ${
                subtotalCents !== null && Math.abs(subtotalCents - linesCents) > 1 ? 'bg-brand-orange-50 text-brand-orange-dark' : 'bg-slate-50 text-slate-600'
              }`}
            >
              The lines come to {money(linesCents)}.
              {subtotalCents !== null &&
                (Math.abs(subtotalCents - linesCents) > 1 ? ` The invoice’s subtotal is ${money(subtotalCents)} — a line may be missing or misread.` : ' That matches the subtotal.')}
            </p>
          )}

          <FormError>{error}</FormError>
          {dupAsked && (
            <label className="flex min-h-[44px] items-center gap-2 text-sm font-bold text-slate-700">
              <input type="checkbox" className="h-5 w-5" checked={allowDup} onChange={(e) => setAllowDup(e.target.checked)} />
              It’s a different delivery — add it anyway
            </label>
          )}
          <button type="button" onClick={() => void save()} disabled={unitsTotal === 0} className={`${btn.primary} min-h-[56px] w-full text-base disabled:opacity-50`}>
            <Icon name="check" size={18} /> Add {unitsTotal} item{unitsTotal === 1 ? '' : 's'} to stock
          </button>
          <button type="button" onClick={reset} className="block w-full py-2 text-center text-sm font-bold text-slate-500">
            Start again
          </button>
        </div>
      )}

      {step === 'done' && result && (
        <div className="space-y-4">
          <Card className="space-y-2 border-green-200 bg-green-50">
            <p className="flex items-center gap-2 font-display text-lg font-extrabold text-ink">
              <Icon name="check" size={22} /> Added {result.units} item{result.units === 1 ? '' : 's'} to stock
            </p>
            <p className="text-sm text-slate-700">
              {[result.supplier_name, result.invoice_no ? `invoice ${result.invoice_no}` : null, result.total_cents != null ? `total ${money(result.total_cents)}` : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <ul className="text-sm text-slate-700">
              {(result.lines ?? [])
                .filter((l) => l.units_added > 0)
                .map((l) => (
                  <li key={l.id}>
                    +{l.units_added} {l.product_name}
                    {l.sku ? <span className="font-mono text-xs text-slate-500"> {l.sku}</span> : null}
                  </li>
                ))}
            </ul>
            {madeNew > 0 && (
              <p className="text-sm font-semibold text-brand-orange-dark">
                {madeNew} new item{madeNew === 1 ? ' is' : 's are'} hidden from the shelf until {madeNew === 1 ? 'it has' : 'they have'} a price — set it in Hop Shop
                inventory.
              </p>
            )}
          </Card>
          <FormError>{error}</FormError>
          <button type="button" onClick={() => navigate(labelsLink(result))} className={`${btn.blue} min-h-[52px] w-full`}>
            <Icon name="printer" size={18} /> Print {result.units} price label{result.units === 1 ? '' : 's'}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <Link to={`/staff/hopshop/deliveries/${result.id}`} className={`${btn.outline} min-h-[48px]`}>
              See the delivery
            </Link>
            <button type="button" onClick={reset} className={`${btn.outline} min-h-[48px]`}>
              Another invoice
            </button>
          </div>
        </div>
      )}
    </Screen>
  )
}

function LineCard({
  r,
  products,
  byId,
  canCreate,
  supplierName,
  onPatch,
  onPickProduct,
  onPickPack,
  onRemove,
}: {
  r: Row
  products: StockCard[]
  byId: Map<string, StockCard>
  canCreate: boolean
  supplierName: string | null
  onPatch: (p: Partial<Row>) => void
  onPickProduct: (id: string) => void
  onPickPack: (v: string) => void
  onRemove: () => void
}) {
  const p = r.productId && r.productId !== NEW ? byId.get(r.productId) : null
  const packs = p?.packs ?? []
  const units = r.productId ? unitsFor(qtyOf(r), r.unitsPer) : 0
  const packValue = r.packId || (r.unitsPer > 1 ? 'per' : '')
  const title = r.description || r.readAs || 'New line'
  return (
    <Card className={`space-y-3 ${r.include ? '' : 'opacity-70'}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={r.include}
          onChange={(e) => onPatch({ include: e.target.checked })}
          aria-label={`Add ${title} to stock`}
          className="mt-1 h-6 w-6 shrink-0 accent-brand-blue"
        />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[15px] font-extrabold text-ink">{title}</p>
          {r.readAs && <p className="mt-0.5 break-words font-mono text-xs text-slate-500">Read as: {r.readAs}</p>}
          <div className="mt-1 flex flex-wrap gap-1.5">
            {r.how && r.productId ? <Badge tone={r.sure ? 'blue' : 'orange'}>{HOW_TEXT[r.how]}</Badge> : <Badge tone="slate">Not matched</Badge>}
            {r.readAs && r.lineCents !== null && !r.checked && <Badge tone="orange">Check the numbers</Badge>}
          </div>
        </div>
      </div>

      {!r.readAs && (
        <label className="block text-sm font-semibold text-slate-700">
          What it says on the invoice
          <input className={staffInput} value={r.description} onChange={(e) => onPatch({ description: e.target.value, matchKey: e.target.value.toLowerCase() })} />
        </label>
      )}

      <label className="block text-sm font-semibold text-slate-700">
        Product
        <select className={staffInput} value={r.productId} onChange={(e) => onPickProduct(e.target.value)} aria-label={`Product for ${title}`}>
          <option value="">— pick one, or leave unticked —</option>
          {canCreate && <option value={NEW}>+ A new Hop Shop item from this line</option>}
          {products.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
              {x.code ? ` · ${x.code}` : ''}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          On the invoice
          <input
            className={staffInput}
            inputMode="decimal"
            value={r.qty}
            onChange={(e) => onPatch({ qty: e.target.value.replace(/[^0-9.]/g, '') })}
            aria-label={`How many on the invoice for ${title}`}
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Each one is
          <select className={staffInput} value={packValue} onChange={(e) => onPickPack(e.target.value)} aria-label={`Each one is, for ${title}`}>
            <option value="">1 item</option>
            {packs.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label} of {k.units}
              </option>
            ))}
            {!r.packId && r.unitsPer > 1 && <option value="per">{r.unitsPer} items</option>}
          </select>
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Cost of one item (USD)
          <input
            className={staffInput}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={r.cost}
            onChange={(e) => onPatch({ cost: e.target.value })}
            aria-label={`Cost of one item for ${title}`}
          />
        </label>
        <div className="flex flex-col justify-end pb-1 text-sm">
          <span className="font-semibold text-slate-700">Adds to stock</span>
          <span className="font-display text-2xl font-black text-ink" aria-label={`Adds ${units} for ${title}`}>
            {r.include && r.productId ? units : 0}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {r.productId && r.productId !== NEW && supplierName && (r.how === 'hand' || r.how === 'name') ? (
          <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" className="h-5 w-5" checked={r.remember} onChange={(e) => onPatch({ remember: e.target.checked })} />
            Remember this for {supplierName}
          </label>
        ) : (
          <span />
        )}
        <button type="button" onClick={onRemove} className="min-h-[44px] px-2 text-sm font-bold text-slate-500">
          Remove line
        </button>
      </div>
    </Card>
  )
}
