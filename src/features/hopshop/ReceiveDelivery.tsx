// Hop Shop → Add a delivery: the supplier's invoice → stock (update 42).
// Step 2 of the Hop Shop's job (Order → Add the delivery → Price labels → On
// the shelf → Sell). Lettered parts: A the invoice, B check the lines, C add
// the stock (the main action, in the footer). The supplier is asked once and
// then sits in the "Receiving from" bar.
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
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { errMessage } from '../../lib/supabase'
import { Badge, Card } from '../../components/ui'
import { Icon } from '../../components/icons'
import { Spinner, staffInput } from '../../components/staffui'
import { Field, Part, PartBadge, StepButton, WorkingOn, pill } from '../../components/StaffJob'
import { BigButton, ErrorBox, StepShell } from '../scan/ScanUI'
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

// The lettered parts of this step.
const DELIVERY_PARTS = ['The invoice', 'Check the lines', 'Add the stock']

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
  const [changingSupplier, setChangingSupplier] = useState(false)
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
  // The supplier is asked once. When it's known it sits in the "Receiving from" bar, with Change.
  const supplierKnown = !!supplierId && !changingSupplier
  const chooseSupplier = (sid: string) => {
    if (step === 'review') void changeSupplier(sid)
    else setSupplierId(sid)
    if (sid) setChangingSupplier(false)
  }
  const supplierBar = supplierKnown ? (
    <WorkingOn icon="store" label="Receiving from" name={supplierName ?? 'This supplier'} onChange={() => setChangingSupplier(true)} />
  ) : (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
      <label className="block text-base font-bold text-ink">
        Which supplier is it from?
        <select className={staffInput} value={supplierId} onChange={(e) => chooseSupplier(e.target.value)}>
          <option value="">{step === 'start' ? 'Work it out from the invoice' : '— not in the list —'}</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      {changingSupplier && supplierId && (
        <button type="button" onClick={() => setChangingSupplier(false)} className={pill.outline}>
          Keep {supplierName ?? 'this supplier'}
        </button>
      )}
    </div>
  )

  const isPdf = (f: File) => /pdf/i.test(f.type) || /\.pdf$/i.test(f.name)
  const busyScreen = step === 'reading' || step === 'saving'

  let body: React.ReactNode = null
  let footer: React.ReactNode = undefined

  if (step === 'start') {
    body = (
      <div className="space-y-5">
        {supplierBar}
        <section className="space-y-3">
          <Part n="A" hint="needed">
            The invoice
          </Part>
          <div className="grid gap-3">
            <BigButton tone={files.length ? 'outline' : 'blue'} icon="mail" onClick={() => pdfRef.current?.click()}>
              The PDF from their email
            </BigButton>
            <BigButton tone={files.length ? 'outline' : 'blue'} icon="camera" onClick={() => void takePhoto()}>
              Photograph a paper invoice
            </BigButton>
          </div>
          <div className="flex flex-wrap gap-2">
            <StepButton icon="file" onClick={() => photosRef.current?.click()}>
              Choose files or photos instead
            </StepButton>
            <StepButton icon="keyboard" onClick={typeItIn}>
              No invoice — type the lines
            </StepButton>
          </div>
          {files.length > 0 && (
            <Card className="space-y-2">
              <p className="text-base font-bold text-ink">The invoice</p>
              <ul className="space-y-1">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-[15px] text-slate-700">
                    <Icon name={isPdf(f) ? 'file' : 'camera'} size={18} />
                    <span className="min-w-0 flex-1 truncate">{isPdf(f) ? f.name : `Photo, page ${i + 1}`}</span>
                    <button type="button" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className={`${pill.outline} !min-h-[44px]`}>
                      <Icon name="x" size={16} /> Remove
                    </button>
                  </li>
                ))}
              </ul>
              {files.some((f) => !isPdf(f)) && <p className="text-sm text-slate-600">More than one page? Photograph each one. Flat, in good light, the whole page in the picture.</p>}
            </Card>
          )}
          <ErrorBox>{error}</ErrorBox>
        </section>
        <div className="flex justify-center">
          <StepButton to="/staff/hopshop/deliveries" icon="clock">
            Past deliveries
          </StepButton>
        </div>
      </div>
    )
    if (files.length > 0) {
      footer = (
        <BigButton onClick={() => void read()} disabled={!products} icon="search">
          Read the invoice
        </BigButton>
      )
    }
  } else if (busyScreen) {
    body = (
      <Card className="py-8 text-center">
        <Spinner label={note ?? (step === 'reading' ? 'Reading the invoice…' : 'Saving…')} />
        {step === 'reading' && readHow === 'photo' && <p className="mt-2 text-sm text-slate-600">The first photo takes longer: the text reader loads once.</p>}
      </Card>
    )
  } else if (step === 'review') {
    body = (
      <div className="space-y-5">
        {supplierBar}
        <section className="space-y-3">
          <Part n="A" hint="needed">
            The invoice
          </Part>
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <Field label="Invoice number">
              <input className={staffInput} value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
            </Field>
            <Field label="Invoice date">
              <input className={staffInput} type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </Field>
            {(
              [
                ['Subtotal', subtotal, setSubtotal],
                ['Shipping', shipping, setShipping],
                ['Tax', tax, setTax],
                ['Total', total, setTotal],
              ] as const
            ).map(([labelText, value, set]) => (
              <Field key={labelText} label={`${labelText} (USD)`}>
                <input className={staffInput} type="number" min="0" step="0.01" inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} />
              </Field>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <Part n="B" hint={`${rows.length} line${rows.length === 1 ? '' : 's'}`}>
            Check the lines
          </Part>
          <p className="text-base text-slate-700">
            {readHow === 'typed' ? 'Add each line of the delivery.' : `Read from the ${readHow === 'pdf' ? 'PDF' : files.length > 1 ? 'photos' : 'photo'}.`} Fix any line that didn’t match; untick one that isn’t stock.
          </p>
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
          <div>
            <StepButton icon="plus" onClick={() => setRows((rs) => [...rs, blankRow()])}>
              Add a line
            </StepButton>
          </div>

          {linesCents > 0 && (
            <p
              className={`rounded-xl px-3 py-2 text-[15px] ${
                subtotalCents !== null && Math.abs(subtotalCents - linesCents) > 1 ? 'bg-brand-orange-50 text-brand-orange-dark' : 'bg-slate-50 text-slate-600'
              }`}
            >
              The lines come to {money(linesCents)}.
              {subtotalCents !== null &&
                (Math.abs(subtotalCents - linesCents) > 1 ? ` The invoice’s subtotal is ${money(subtotalCents)} — a line may be missing or misread.` : ' That matches the subtotal.')}
            </p>
          )}
          <ErrorBox>{error}</ErrorBox>
          {dupAsked && (
            <label className="flex min-h-[44px] items-center gap-2 text-[15px] font-bold text-slate-700">
              <input type="checkbox" className="h-6 w-6 accent-brand-blue" checked={allowDup} onChange={(e) => setAllowDup(e.target.checked)} />
              It’s a different delivery — add it anyway
            </label>
          )}
        </section>
      </div>
    )
    footer = (
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-bold text-slate-600">
          <PartBadge n="C" />
          Add the stock — {unitsTotal} item{unitsTotal === 1 ? '' : 's'} from {included.length} line{included.length === 1 ? '' : 's'}
        </p>
        <BigButton onClick={() => void save()} disabled={unitsTotal === 0} icon="check">
          Add {unitsTotal} item{unitsTotal === 1 ? '' : 's'} to stock
        </BigButton>
        <div className="flex justify-center">
          <StepButton onClick={reset}>Start again</StepButton>
        </div>
      </div>
    )
  } else if (step === 'done' && result) {
    body = (
      <div className="space-y-4">
        <Card className="space-y-2 border-green-200 bg-green-50">
          <p className="flex items-center gap-2 font-display text-lg font-extrabold text-ink">
            <Icon name="check" size={22} /> Added {result.units} item{result.units === 1 ? '' : 's'} to stock
          </p>
          <p className="text-[15px] text-slate-700">
            {[result.supplier_name, result.invoice_no ? `invoice ${result.invoice_no}` : null, result.total_cents != null ? `total ${money(result.total_cents)}` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <ul className="text-[15px] text-slate-700">
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
            <p className="text-[15px] font-semibold text-brand-orange-dark">
              {madeNew} new item{madeNew === 1 ? ' is' : 's are'} hidden from the shelf until {madeNew === 1 ? 'it has' : 'they have'} a price — set it in Hop Shop inventory.
            </p>
          )}
        </Card>
        <ErrorBox>{error}</ErrorBox>
        <p className="text-base text-slate-700">Next is step 3: print a price label for each item, then put them on the shelf.</p>
        <div className="flex flex-wrap gap-2">
          <StepButton to={`/staff/hopshop/deliveries/${result.id}`} icon="file">
            See the delivery
          </StepButton>
          <StepButton to="/staff/hopshop" icon="bag">
            Hop Shop inventory
          </StepButton>
        </div>
      </div>
    )
    footer = (
      <div className="space-y-2">
        <BigButton tone="orange" icon="printer" onClick={() => navigate(labelsLink(result))}>
          Print price labels for these {result.units} item{result.units === 1 ? '' : 's'}
        </BigButton>
        <BigButton tone="outline" icon="plus" onClick={reset}>
          Add another delivery
        </BigButton>
      </div>
    )
  }

  return (
    <>
      {/* File inputs live here once, never inside a step (a re-mounted input loses the photo). */}
      <input ref={pdfRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onFiles} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFiles} />
      <input ref={photosRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={onFiles} />
      <StepShell
        title={step === 'done' ? 'Delivery added' : 'Add the delivery'}
        help={
          step === 'start'
            ? 'From the supplier’s invoice: the PDF from their email, or photos of a paper one.'
            : step === 'review'
              ? 'Check each line before anything changes.'
              : undefined
        }
        explain={
          step === 'start' || step === 'review' ? (
            <>
              <p>The invoice is read on this device. Each line is matched to a Hop Shop item by their item number, a match made before, the packet barcode, then the name.</p>
              <p>Anything you pick by hand is remembered for this supplier’s next invoice. Nothing is added to stock until you tap Add to stock.</p>
            </>
          ) : undefined
        }
        step={2}
        of={5}
        stepName="Add the delivery"
        flow={step === 'start' || step === 'review' ? DELIVERY_PARTS : undefined}
        flowLetters
        onBack={() => navigate('/staff/hopshop')}
        backLabel="Hop Shop"
        footer={footer}
      >
        {body}
      </StepShell>
    </>
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
          <label className="flex min-h-[44px] items-center gap-2 text-[15px] font-semibold text-slate-700">
            <input type="checkbox" className="h-6 w-6 accent-brand-blue" checked={r.remember} onChange={(e) => onPatch({ remember: e.target.checked })} />
            Remember this for {supplierName}
          </label>
        ) : (
          <span />
        )}
        <button type="button" onClick={onRemove} className={`${pill.outline} !min-h-[44px]`}>
          <Icon name="trash" size={16} /> Remove line
        </button>
      </div>
    </Card>
  )
}
