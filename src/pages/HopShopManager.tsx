// Staff → Hop Shop: the stock cards (photo, code, price, supplier, reorder
// point), the reorder list grouped by supplier, and the supplier list itself.
// One screen, three tabs, phone first. Everything here goes live on the public
// Hop Shop shelf (name, photo, price, in stock) the moment it is saved.
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { btn, Badge, Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { Spinner, FormError, staffInput } from '../components/staffui'
import { isNative } from '../native/platform'
import { pickPhoto, type PhotoSource } from '../native/camera'
import { dataUrlToBlob, uploadItemPhoto } from '../features/scan/api'
import { isRetailBarcode, isTagCode, newTagCode, normalizeCode } from '../features/scan/codes'
import { copyText, shareText } from '../features/share/share'
import {
  deleteProduct,
  deleteSupplier,
  eachFromPack,
  fromCents,
  groupBySupplier,
  isLow,
  lineCost,
  listProducts,
  listSuppliers,
  minOrderCents,
  money,
  onOrderText,
  ORDER_HOW_LABEL,
  orderPacks,
  orderText,
  packLine,
  packName,
  packOf,
  packsFor,
  packsReady,
  reorderList,
  saveProduct,
  setOrder,
  setOrderUrl,
  setStock,
  suggestPacks,
  syncPacks,
  toCents,
  unitsWanted,
  type PackChoice,
  type ProductInput,
  type StockCard,
  type Supplier,
} from '../features/hopshop/api'
import { giftTotals, withScheme, type GiftTotals } from '../features/hopshop/companies'
import { CompanyForm, CompanySummary, CompanyThumb, useVendorRecordsReady } from '../features/hopshop/CompanyForm'
import { PackEditor, packRowsFrom, packRowsToInput, type PackRow } from '../features/hopshop/PackEditor'

/** Is update 27's pack table in? `null` while asking. */
function usePacksReady(): boolean | null {
  const [ready, setReady] = useState<boolean | null>(null)
  useEffect(() => {
    let live = true
    void packsReady().then((r) => live && setReady(r))
    return () => {
      live = false
    }
  }, [])
  return ready
}

type Tab = 'items' | 'reorder' | 'suppliers'

const TABS: [Tab, string][] = [
  ['items', 'Items'],
  ['reorder', 'Reorder'],
  ['suppliers', 'Suppliers'],
]

export default function HopShopManager() {
  const { user, membership, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const userId = user?.id ?? ''
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const tab: Tab = pathname.endsWith('/suppliers') ? 'suppliers' : pathname.endsWith('/reorder') ? 'reorder' : 'items'
  const setTab = (t: Tab) => navigate(t === 'items' ? '/staff/hopshop' : `/staff/hopshop/${t}`)

  const canCreate = can('hopshop.products.create')
  const canEdit = can('hopshop.products.edit')
  const canDelete = can('hopshop.products.delete')
  const canInventory = can('hopshop.inventory.update')
  const readOnly = !canCreate && !canEdit && !canDelete && !canInventory

  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reloadSuppliers = useCallback(async () => {
    if (!orgId) return
    try {
      setSuppliers(await listSuppliers(orgId))
    } catch (e) {
      setError(errMessage(e))
    }
  }, [orgId])
  useEffect(() => {
    void reloadSuppliers()
  }, [reloadSuppliers])

  return (
    <Screen className="space-y-4">
      <div className="pt-1">
        <h1 className="font-display text-2xl font-black text-ink">Hop Shop</h1>
        <p className="mt-1 text-sm text-slate-600">
          {readOnly
            ? 'View-only — ask an owner or admin for edit access.'
            : 'Stock, prices and photos go live on the shelf as you save. Set a reorder point and the Reorder tab tells you what to buy.'}
        </p>
      </div>
      <div className="flex gap-2">
        {TABS.map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`min-h-[44px] flex-1 rounded-full px-2 text-[13px] font-bold ${tab === t ? 'bg-brand-blue text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <FormError>{error}</FormError>
      {tab === 'items' && (
        <Items
          orgId={orgId}
          userId={userId}
          suppliers={suppliers ?? []}
          perms={{ canCreate, canEdit, canDelete, canInventory }}
          onAddSupplier={() => setTab('suppliers')}
        />
      )}
      {tab === 'reorder' && <Reorder orgId={orgId} suppliers={suppliers ?? []} canAct={canInventory || canEdit} />}
      {tab === 'suppliers' && (
        <Suppliers orgId={orgId} suppliers={suppliers} canWrite={canEdit || canCreate} canDelete={canDelete} onChanged={reloadSuppliers} />
      )}
    </Screen>
  )
}

/* ================================================================= items */

interface Perms {
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  canInventory: boolean
}

function Items({
  orgId,
  userId,
  suppliers,
  perms,
  onAddSupplier,
}: {
  orgId: string
  userId: string
  suppliers: Supplier[]
  perms: Perms
  onAddSupplier: () => void
}) {
  const [rows, setRows] = useState<StockCard[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    if (!orgId) return
    try {
      setRows(await listProducts(orgId))
    } catch (e) {
      setError(errMessage(e))
    }
  }, [orgId])
  useEffect(() => {
    void load()
  }, [load])

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return rows ?? []
    return (rows ?? []).filter((p) =>
      [p.name, p.code, p.sku, p.category, p.supplier_name, p.supplier_sku, p.shelf].some((v) => v && v.toLowerCase().includes(t)),
    )
  }, [rows, q])

  const low = (rows ?? []).filter(isLow).length

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Icon name="search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find by name, code, supplier…"
            className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-[15px] text-ink outline-none focus:border-brand-blue"
          />
        </div>
        {perms.canCreate && !creating && (
          <button type="button" onClick={() => setCreating(true)} className={`${btn.primary} shrink-0 !px-4 !py-2.5`}>
            <Icon name="plus" size={16} /> Add
          </button>
        )}
      </div>
      {low > 0 && (
        <p className="text-xs font-bold text-brand-orange-dark">
          {low} item{low === 1 ? ' is' : 's are'} at or below the reorder point — see the Reorder tab.
        </p>
      )}

      {creating && (
        <Card>
          <p className="mb-3 font-display text-[15px] font-extrabold text-ink">New item</p>
          <ProductForm
            orgId={orgId}
            initial={null}
            suppliers={suppliers}
            canCount={perms.canInventory || perms.canCreate}
            onAddSupplier={onAddSupplier}
            onSaved={async () => {
              setCreating(false)
              await load()
            }}
            onCancel={() => setCreating(false)}
          />
        </Card>
      )}

      <FormError>{error}</FormError>
      {rows === null && !error && <Spinner label="Loading items…" />}
      {rows && rows.length === 0 && !creating && (
        <Card className="border-slate-200 bg-slate-50/80 text-center">
          <p className="text-sm leading-relaxed text-slate-600">
            No items yet.{perms.canCreate ? ' Tap “Add” — take a photo, make a code, set the price.' : ''}
          </p>
        </Card>
      )}
      {rows && rows.length > 0 && shown.length === 0 && <p className="text-sm text-slate-500">Nothing matches “{q}”.</p>}
      {shown.map((p) => (
        <ProductCard key={p.id} p={p} orgId={orgId} userId={userId} suppliers={suppliers} perms={perms} onAddSupplier={onAddSupplier} onChanged={load} />
      ))}
    </div>
  )
}

function ProductCard({
  p,
  orgId,
  userId,
  suppliers,
  perms,
  onAddSupplier,
  onChanged,
}: {
  p: StockCard
  orgId: string
  userId: string
  suppliers: Supplier[]
  perms: Perms
  onAddSupplier: () => void
  onChanged: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const doDelete = async () => {
    setError(null)
    setBusy(true)
    try {
      await deleteProduct(p.id)
      await onChanged()
    } catch (e) {
      setError(errMessage(e))
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  if (editing) {
    return (
      <Card>
        <ProductForm
          orgId={orgId}
          initial={p}
          suppliers={suppliers}
          canCount={perms.canInventory}
          onAddSupplier={onAddSupplier}
          onSaved={async () => {
            setEditing(false)
            await onChanged()
          }}
          onCancel={() => setEditing(false)}
        />
      </Card>
    )
  }

  const low = isLow(p)
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-300">
          {p.photo_url ? <img src={p.photo_url} alt="" className="h-full w-full object-cover" /> : <Icon name="bag" size={26} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="font-display text-[15px] font-extrabold text-ink">{p.name}</h3>
            {!p.is_active && <Badge tone="slate">Hidden</Badge>}
            {low && <Badge tone="orange">Low</Badge>}
            {p.on_order_qty > 0 && <Badge tone="blue">{p.on_order_qty} on order</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {p.code ? <span className="font-mono font-bold text-slate-600">{p.code}</span> : 'No code'}
            {p.category ? ` · ${p.category}` : ''}
            {p.shelf ? ` · ${p.shelf}` : ''}
          </p>
          {p.supplier_name && (
            <p className="text-xs text-slate-500">
              From {p.supplier_name}
              {p.supplier_sku ? ` · item ${p.supplier_sku}` : ''}
              {p.cost_cents != null ? ` · cost ${money(p.cost_cents)}` : ''}
            </p>
          )}
          {p.packs && p.packs.length > 0 && (
            <p className="text-xs text-slate-500">
              Comes in{' '}
              {p.packs
                .map((k) => `${k.label.toLowerCase()}${k.units > 1 ? ` of ${k.units}` : ''}${k.cost_cents != null ? ` (${money(k.cost_cents)})` : ''}`)
                .join(' · ')}
            </p>
          )}
        </div>
        <span className="shrink-0 font-display text-lg font-black text-brand-blue">{money(p.price_cents)}</span>
      </div>

      <StockRow p={p} orgId={orgId} userId={userId} canCount={perms.canInventory} onSaved={onChanged} />

      {(perms.canEdit || perms.canDelete) && (
        <div className="mt-3 flex items-center gap-2">
          {perms.canEdit && (
            <button type="button" onClick={() => setEditing(true)} className="min-h-[44px] rounded-full border border-slate-200 px-4 text-xs font-bold text-slate-600 hover:bg-slate-50">
              Edit
            </button>
          )}
          {perms.canDelete &&
            (confirmDelete ? (
              <>
                <button type="button" onClick={doDelete} disabled={busy} className="min-h-[44px] rounded-full bg-red-600 px-4 text-xs font-bold text-white disabled:opacity-60">
                  {busy ? 'Deleting…' : 'Confirm delete'}
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="min-h-[44px] rounded-full border border-slate-200 px-4 text-xs font-bold text-slate-500">
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="min-h-[44px] rounded-full border border-red-200 px-4 text-xs font-bold text-red-600 hover:bg-red-50">
                Delete
              </button>
            ))}
        </div>
      )}
      <FormError>{error}</FormError>
    </Card>
  )
}

/* Stock stepper (gated on hopshop.inventory.update) with the reorder point beside it. */
function StockRow({
  p,
  orgId,
  userId,
  canCount,
  onSaved,
}: {
  p: StockCard
  orgId: string
  userId: string
  canCount: boolean
  onSaved: () => Promise<void>
}) {
  const [val, setVal] = useState<number>(p.quantity ?? 0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => setVal(p.quantity ?? 0), [p.quantity])
  const dirty = val !== (p.quantity ?? 0)
  const clamp = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0)

  const save = async () => {
    setError(null)
    setBusy(true)
    try {
      await setStock(orgId, p.id, userId, val)
      await onSaved()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2.5 border-t border-slate-100 pt-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Stock</span>
        {canCount ? (
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setVal((v) => clamp(v - 1))} className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-600" aria-label="One fewer">
              <Icon name="minus" size={16} />
            </button>
            <input
              type="number"
              min="0"
              value={val}
              onChange={(e) => setVal(clamp(parseInt(e.target.value || '0', 10)))}
              className="h-11 w-16 rounded-lg border border-slate-200 px-2 text-center text-sm text-ink outline-none focus:border-brand-blue"
            />
            <button type="button" onClick={() => setVal((v) => clamp(v + 1))} className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-600" aria-label="One more">
              <Icon name="plus" size={16} />
            </button>
          </div>
        ) : (
          <span className="text-sm font-bold text-ink">{p.quantity ?? '—'}</span>
        )}
        {p.unit && <span className="text-xs text-slate-500">{p.unit}</span>}
        {p.reorder_point != null && <span className="text-xs text-slate-500">· reorder at {p.reorder_point}</span>}
        {dirty && (
          <button type="button" onClick={save} disabled={busy} className="min-h-[44px] rounded-full bg-brand-blue px-4 text-xs font-bold text-white disabled:opacity-60">
            {busy ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>
      <FormError>{error}</FormError>
    </div>
  )
}

/* --------------------------------------------------------- product form */

interface Draft {
  name: string
  price: string
  code: string
  description: string
  category: string
  unit: string
  shelf: string
  quantity: string
  supplier_id: string
  supplier_sku: string
  cost: string
  reorder_point: string
  reorder_qty: string
  is_active: boolean
  photo_url: string | null
  order_url: string
}

function draftFrom(p: StockCard | null): Draft {
  return {
    name: p?.name ?? '',
    price: p ? fromCents(p.price_cents) : '',
    code: p?.code ?? p?.sku ?? '',
    description: p?.description ?? '',
    category: p?.category ?? '',
    unit: p?.unit ?? '',
    shelf: p?.shelf ?? '',
    quantity: p ? '' : '1',
    supplier_id: p?.supplier_id ?? '',
    supplier_sku: p?.supplier_sku ?? '',
    cost: fromCents(p?.cost_cents),
    reorder_point: p?.reorder_point == null ? '' : String(p.reorder_point),
    reorder_qty: p?.reorder_qty == null ? '' : String(p.reorder_qty),
    is_active: p?.is_active ?? true,
    photo_url: p?.photo_url ?? null,
    order_url: p?.order_url ?? '',
  }
}

const CATEGORY_HINTS = ['Hay', 'Pellets', 'Treats', 'Toys', 'Litter', 'Housing', 'Grooming', 'Gifts & merch']

function ProductForm({
  orgId,
  initial,
  suppliers,
  canCount,
  onAddSupplier,
  onSaved,
  onCancel,
}: {
  orgId: string
  initial: StockCard | null
  suppliers: Supplier[]
  canCount: boolean
  onAddSupplier: () => void
  onSaved: () => Promise<void>
  onCancel: () => void
}) {
  const [d, setD] = useState<Draft>(() => draftFrom(initial))
  const [busy, setBusy] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [preview, setPreview] = useState<string | null>(initial?.photo_url ?? null)
  const [error, setError] = useState<string | null>(null)
  const packsOn = usePacksReady()
  const [packs, setPacks] = useState<PackRow[]>(() => packRowsFrom(initial?.packs))
  // Once a new item is saved, a second Save (after a pack-size error) updates it instead of adding another.
  const [savedId, setSavedId] = useState<string | null>(initial?.id ?? null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setD((x) => ({ ...x, [k]: e.target.value }))
  const digits = (k: keyof Draft) => (e: { target: { value: string } }) => setD((x) => ({ ...x, [k]: e.target.value.replace(/[^0-9]/g, '') }))
  const supplierList = suppliers.filter((s) => s.is_supplier && s.is_active)

  /* photo: native camera / library, or the file inputs on the web */
  const usePhoto = async (src: Blob | string) => {
    setError(null)
    setPhotoBusy(true)
    try {
      setPreview(typeof src === 'string' ? src : URL.createObjectURL(src))
      const blob = typeof src === 'string' ? await dataUrlToBlob(src) : src
      const url = await uploadItemPhoto(blob, orgId)
      setD((x) => ({ ...x, photo_url: url }))
    } catch (e) {
      setPreview(d.photo_url)
      setError(`The photo didn’t save: ${errMessage(e)}`)
    } finally {
      setPhotoBusy(false)
    }
  }
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) await usePhoto(file)
  }
  const pick = async (source: PhotoSource) => {
    if (!isNative) {
      ;(source === 'camera' ? cameraRef : libraryRef).current?.click()
      return
    }
    try {
      const dataUrl = await pickPhoto(source)
      if (dataUrl) await usePhoto(dataUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t get that photo.')
    }
  }

  const codeInfo = (() => {
    const c = normalizeCode(d.code)
    if (!c) return 'Make a code for a printed OHRR tag, scan or type the barcode, or type your own.'
    if (isTagCode(c)) return `Saved as ${c} — print the tag under Scanned items → Print tags.`
    if (isRetailBarcode(c)) return `Barcode ${c} — scanning the packet opens this item.`
    return `Saved as ${c}.`
  })()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const price = toCents(d.price)
      if (price === null) throw new Error('Give the item a price (0 is fine for free things).')
      const packInput = packsOn ? packRowsToInput(packs) : null
      const input: ProductInput = {
        id: savedId,
        name: d.name.trim(),
        price_cents: price,
        description: d.description.trim() || null,
        sku: d.code.trim() || null,
        photo_url: d.photo_url,
        is_active: d.is_active,
        supplier_id: d.supplier_id || null,
        supplier_sku: d.supplier_sku.trim() || null,
        cost_cents: toCents(d.cost),
        unit: d.unit.trim() || null,
        category: d.category.trim() || null,
        shelf: d.shelf.trim() || null,
        reorder_point: d.reorder_point === '' ? null : Number(d.reorder_point),
        reorder_qty: d.reorder_qty === '' ? null : Number(d.reorder_qty),
        quantity: canCount && d.quantity !== '' ? Number(d.quantity) : null,
      }
      const card = await saveProduct(orgId, input)
      setSavedId(card.id)
      if (packInput) {
        try {
          const url = withScheme(d.order_url)
          if (url !== (initial?.order_url ?? null)) await setOrderUrl(card.id, url)
          if (packInput.length > 0 || (initial?.packs?.length ?? 0) > 0) await syncPacks(orgId, card.id, initial?.packs ?? [], packInput)
        } catch (err) {
          throw new Error(`The item is saved, but its order link or pack sizes didn’t: ${errMessage(err)}`)
        }
      }
      await onSaved()
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
    }
  }

  const defaultEach = (() => {
    const k = packs.find((r) => r.is_default) ?? packs[0]
    const units = Number(k?.units)
    return k && units > 1 ? eachFromPack({ cost_cents: toCents(k.cost), units }) : null
  })()

  return (
    <form onSubmit={submit} className="space-y-3">
      {/* Photo */}
      <div className="flex items-center gap-3">
        <span className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-slate-300">
          {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <Icon name="camera" size={34} />}
        </span>
        <div className="flex flex-1 flex-col gap-2">
          <button type="button" onClick={() => void pick('camera')} disabled={photoBusy} className={`${btn.blue} !py-2.5 disabled:opacity-60`}>
            <Icon name="camera" size={18} /> {photoBusy ? 'Saving photo…' : preview ? 'Retake photo' : 'Take a photo'}
          </button>
          <button type="button" onClick={() => void pick('library')} disabled={photoBusy} className="text-sm font-bold text-brand-blue">
            Choose from photos
          </button>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
          <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        </div>
      </div>

      <label className="block text-sm font-semibold text-slate-700">
        Name
        <input className={staffInput} required value={d.name} onChange={set('name')} placeholder="Oxbow Timothy Hay, 40 oz" />
      </label>

      {/* Code / SKU */}
      <div>
        <label className="block text-sm font-semibold text-slate-700">
          Code (SKU)
          <div className="mt-1 flex gap-2">
            <input className={`${staffInput} !mt-0 flex-1 font-mono uppercase`} value={d.code} onChange={set('code')} placeholder="OHRR-7K3PX or a barcode" autoCapitalize="characters" />
            <button type="button" onClick={() => setD((x) => ({ ...x, code: newTagCode() }))} className={`${btn.outline} shrink-0 !px-3.5 !py-2`}>
              Make one
            </button>
          </div>
        </label>
        <p className="mt-1 text-xs text-slate-500">{codeInfo}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          Price (USD)
          <input className={staffInput} type="number" min="0" step="0.01" inputMode="decimal" value={d.price} onChange={set('price')} placeholder="0.00" required />
        </label>
        {canCount ? (
          <label className="block text-sm font-semibold text-slate-700">
            {initial ? 'Set stock to' : 'How many now'}
            <input className={staffInput} inputMode="numeric" value={d.quantity} onChange={digits('quantity')} placeholder={initial ? `${initial.quantity ?? 0} (leave as is)` : '1'} />
          </label>
        ) : (
          <label className="block text-sm font-semibold text-slate-700">
            Sold as
            <input className={staffInput} value={d.unit} onChange={set('unit')} placeholder="bag · each · bundle" />
          </label>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          Category
          <input className={staffInput} list="hopshop-categories" value={d.category} onChange={set('category')} placeholder="Hay" />
          <datalist id="hopshop-categories">
            {CATEGORY_HINTS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Where it sits
          <input className={staffInput} value={d.shelf} onChange={set('shelf')} placeholder="Shelf B · counter" />
        </label>
      </div>
      {canCount && (
        <label className="block text-sm font-semibold text-slate-700">
          Sold as
          <input className={staffInput} value={d.unit} onChange={set('unit')} placeholder="bag · each · bundle" />
        </label>
      )}

      <label className="block text-sm font-semibold text-slate-700">
        Description (shown on the shelf)
        <textarea className={staffInput} rows={2} value={d.description} onChange={set('description')} />
      </label>

      {/* Reorder */}
      <div className="space-y-3 rounded-2xl border border-brand-blue/20 bg-brand-blue-50/40 p-3">
        <p className="text-sm font-bold text-ink">Reordering</p>
        <label className="block text-sm font-semibold text-slate-700">
          Supplier
          <select className={staffInput} value={d.supplier_id} onChange={set('supplier_id')}>
            <option value="">— none yet —</option>
            {supplierList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {supplierList.length === 0 && (
          <button type="button" onClick={onAddSupplier} className="text-sm font-bold text-brand-blue">
            Add a supplier first →
          </button>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-semibold text-slate-700">
            Their item #
            <input className={staffInput} value={d.supplier_sku} onChange={set('supplier_sku')} placeholder="OX-448" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            {packsOn ? 'Our cost each (USD)' : 'Our cost (USD)'}
            <input className={staffInput} type="number" min="0" step="0.01" inputMode="decimal" value={d.cost} onChange={set('cost')} placeholder="0.00" />
          </label>
        </div>
        {packsOn && defaultEach && (
          <p className="-mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-600">
            The default pack works out at {defaultEach}.
            {`$${d.cost || '0.00'} each` !== defaultEach && (
              <button
                type="button"
                onClick={() => setD((x) => ({ ...x, cost: defaultEach.replace(/[^0-9.]/g, '') }))}
                className="min-h-[44px] font-bold text-brand-blue"
              >
                Use it as our cost
              </button>
            )}
          </p>
        )}
        {packsOn && (
          <label className="block text-sm font-semibold text-slate-700">
            Order link <span className="font-normal text-slate-500">(their page for this item)</span>
            <input className={staffInput} inputMode="url" value={d.order_url} onChange={set('order_url')} placeholder="smallpetselect.com/products/timothy-hay" />
          </label>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-semibold text-slate-700">
            Reorder when stock is at
            <input className={staffInput} inputMode="numeric" value={d.reorder_point} onChange={digits('reorder_point')} placeholder="2" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            How many to order
            <input className={staffInput} inputMode="numeric" value={d.reorder_qty} onChange={digits('reorder_qty')} placeholder="6" />
          </label>
        </div>
        <p className="text-xs text-slate-600">Leave “reorder when” blank for things you don’t restock (donated items, one-offs).</p>
        {packsOn && (
          <div className="border-t border-brand-blue/15 pt-3">
            <PackEditor rows={packs} onChange={setPacks} />
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-brand-blue" checked={d.is_active} onChange={(e) => setD((x) => ({ ...x, is_active: e.target.checked }))} />
        Show on the shelf
      </label>

      <FormError>{error}</FormError>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || photoBusy || !d.name.trim()} className={`${btn.primary} flex-1 disabled:opacity-60`}>
          {busy ? 'Saving…' : initial ? 'Save changes' : 'Add item'}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </form>
  )
}

/* =============================================================== reorder */

function Reorder({ orgId, suppliers, canAct }: { orgId: string; suppliers: Supplier[]; canAct: boolean }) {
  const [items, setItems] = useState<StockCard[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  // The pack and count picked on each line (until then, the suggestion).
  const [choices, setChoices] = useState<Record<string, PackChoice>>({})

  const load = useCallback(async () => {
    if (!orgId) return
    try {
      setItems(await reorderList(orgId))
    } catch (e) {
      setError(errMessage(e))
    }
  }, [orgId])
  useEffect(() => {
    void load()
  }, [load])

  const choiceFor = (p: StockCard): PackChoice | null => {
    const c = choices[p.id]
    return c && packOf(p, c) ? c : suggestPacks(p)
  }

  const act = async (p: StockCard, action: 'ordered' | 'received' | 'clear') => {
    setError(null)
    try {
      await setOrder(p.id, action)
      await load()
    } catch (e) {
      setError(errMessage(e))
    }
  }

  const orderInPacks = async (p: StockCard, c: PackChoice) => {
    setError(null)
    try {
      await orderPacks(p.id, c.packId, c.count)
      setChoices(({ [p.id]: _done, ...rest }) => rest)
      await load()
    } catch (e) {
      setError(errMessage(e))
    }
  }

  const groups = useMemo(() => groupBySupplier(items ?? []), [items])
  const supplierOf = (id: string | null) => suppliers.find((s) => s.id === id) ?? null
  const choiceMap = (list: StockCard[]) => Object.fromEntries(list.map((p) => [p.id, choiceFor(p) ?? undefined]))

  const sendList = async (name: string, list: StockCard[], s: Supplier | null) => {
    const text = orderText(name, list, s?.account_number, choiceMap(list))
    if (s?.email) {
      window.location.href = `mailto:${s.email}?subject=${encodeURIComponent(`Order — Ohio House Rabbit Rescue`)}&body=${encodeURIComponent(text)}`
      return
    }
    const r = await shareText(text, `Order — ${name}`)
    setNote(r === 'copied' ? 'Order list copied — paste it into an email or message.' : null)
  }

  return (
    <div className="space-y-3">
      <FormError>{error}</FormError>
      {note && <p className="text-sm font-bold text-green-700">{note}</p>}
      {items === null && !error && <Spinner label="Checking stock…" />}
      {items && items.length === 0 && (
        <Card className="space-y-2 text-sm text-slate-600">
          <p className="font-bold text-ink">Nothing to reorder.</p>
          <p>Items appear here when their stock is at or below the reorder point you set on the item, and stay while they are on order.</p>
        </Card>
      )}
      {groups.map((g) => {
        const s = supplierOf(g.supplierId)
        const toOrder = g.items.filter((p) => p.on_order_qty === 0)
        const onOrder = g.items.filter((p) => p.on_order_qty > 0)
        const costs = toOrder.map((p) => lineCost(p, choiceFor(p)))
        const subtotal = costs.reduce<number>((sum, c) => sum + (c ?? 0), 0)
        const missing = costs.filter((c) => c == null).length
        const min = minOrderCents(s?.min_order)
        return (
          <Card key={g.key} className="space-y-3">
            <div>
              <p className="font-display text-[15px] font-extrabold text-ink">{g.name}</p>
              {s && (
                <p className="text-xs text-slate-500">
                  {[
                    s.order_how ? ORDER_HOW_LABEL[s.order_how] : null,
                    s.account_number ? `account ${s.account_number}` : null,
                    s.min_order ? `minimum ${s.min_order}` : null,
                    s.lead_days != null ? `about ${s.lead_days} day${s.lead_days === 1 ? '' : 's'} to arrive` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
              {s && (s.email || s.phone || s.website) && (
                <p className="mt-1 flex flex-wrap gap-x-4 text-sm font-bold text-brand-blue">
                  {s.website && (
                    <a href={s.website} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center">
                      Website
                    </a>
                  )}
                  {s.email && (
                    <a href={`mailto:${s.email}`} className="inline-flex min-h-[44px] items-center">
                      {s.email}
                    </a>
                  )}
                  {s.phone && (
                    <a href={`tel:${s.phone}`} className="inline-flex min-h-[44px] items-center">
                      {s.phone}
                    </a>
                  )}
                </p>
              )}
              {s?.order_notes && <p className="mt-1 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">{s.order_notes}</p>}
            </div>

            {toOrder.length > 0 && (
              <ul className="divide-y divide-slate-100">
                {toOrder.map((p) => (
                  <ReorderLine
                    key={p.id}
                    p={p}
                    choice={choiceFor(p)}
                    canAct={canAct}
                    onChoose={(c) => setChoices((x) => ({ ...x, [p.id]: c }))}
                    onOrderPacks={(c) => orderInPacks(p, c)}
                    onOrdered={() => act(p, 'ordered')}
                  />
                ))}
              </ul>
            )}
            {toOrder.length > 0 && (subtotal > 0 || min != null) && (
              <div className="rounded-xl bg-brand-blue-50/60 px-3 py-2 text-sm">
                <p className="font-bold text-ink">
                  Subtotal {money(subtotal)}
                  {missing > 0 && (
                    <span className="font-normal text-slate-500">
                      {' '}
                      · {missing} item{missing === 1 ? ' has' : 's have'} no cost set
                    </span>
                  )}
                </p>
                {min != null && subtotal < min && (
                  <p className="text-xs font-semibold text-brand-orange-dark">Under their {money(min)} minimum — {money(min - subtotal)} to go.</p>
                )}
              </div>
            )}
            {toOrder.length > 0 && (
              <div className="flex gap-2">
                <button type="button" onClick={() => void sendList(g.name, toOrder, s)} className={`${btn.outline} min-h-[44px] flex-1 !py-2`}>
                  <Icon name="mail" size={16} /> {s?.email ? 'Email the order' : 'Send the list'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    copyText(orderText(g.name, toOrder, s?.account_number, choiceMap(toOrder))).then((ok) =>
                      setNote(ok ? `${g.name} order copied — paste it into an email, or read it out on the phone.` : null),
                    )
                  }
                  className="min-h-[44px] rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600"
                >
                  Copy order
                </button>
              </div>
            )}

            {onOrder.length > 0 && (
              <div className="space-y-1.5 border-t border-slate-100 pt-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">On order</p>
                <ul className="divide-y divide-slate-100">
                  {onOrder.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-ink">{p.name}</span>
                        <span className="block text-xs text-slate-500">
                          {onOrderText(p)}
                          {p.ordered_at ? ` ${new Date(p.ordered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''} · {p.quantity ?? 0} left
                        </span>
                      </span>
                      {canAct && (
                        <>
                          <button type="button" onClick={() => act(p, 'received')} className="min-h-[44px] rounded-full bg-green-600 px-3 text-xs font-bold text-white">
                            Arrived
                          </button>
                          <button type="button" onClick={() => act(p, 'clear')} className="min-h-[44px] rounded-full border border-slate-200 px-3 text-xs font-bold text-slate-500">
                            Undo
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

/** One item to order: the suggestion in whole packs, a pack chooser and a count — or today's single quantity. */
function ReorderLine({
  p,
  choice,
  canAct,
  onChoose,
  onOrderPacks,
  onOrdered,
}: {
  p: StockCard
  choice: PackChoice | null
  canAct: boolean
  onChoose: (c: PackChoice) => void
  onOrderPacks: (c: PackChoice) => Promise<void>
  onOrdered: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const k = packOf(p, choice)
  const packs = p.packs ?? []
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }
  const orderLink = p.order_url ? (
    <a href={p.order_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-bold text-brand-blue">
      Order page <Icon name="external" size={13} />
    </a>
  ) : null

  if (!k || !choice) {
    return (
      <li className="py-2">
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-ink">{p.name}</span>
            <span className="block text-xs text-slate-500">
              {p.quantity ?? 0} left · reorder at {p.reorder_point}
              {p.reorder_qty ? ` · order ${p.reorder_qty}${p.unit ? ` ${p.unit}` : ''}` : ''}
              {p.supplier_sku ? ` · item ${p.supplier_sku}` : ''}
              {p.cost_cents != null ? ` · ${money(p.cost_cents)}` : ''}
            </span>
          </span>
          {canAct && (
            <button type="button" onClick={() => void run(onOrdered)} disabled={busy} className="min-h-[44px] rounded-full bg-brand-blue px-4 text-xs font-bold text-white disabled:opacity-60">
              Ordered
            </button>
          )}
        </div>
        {orderLink}
      </li>
    )
  }

  const min = Math.max(1, k.min_packs || 1)
  const setCount = (n: number) => onChoose({ packId: k.id, count: Math.max(min, n) })
  const sku = k.supplier_sku || p.supplier_sku
  return (
    <li className="space-y-2 py-2.5">
      <div>
        <span className="block text-sm font-bold text-ink">{p.name}</span>
        <span className="block text-xs text-slate-500">
          {p.quantity ?? 0} left · reorder at {p.reorder_point} · aiming for {unitsWanted(p)} more
          {sku ? ` · item ${sku}` : ''}
        </span>
        <span className="mt-0.5 block text-sm font-bold text-brand-blue">Order {packLine(k, choice.count)}</span>
        {k.min_packs > 1 && <span className="block text-xs text-slate-500">Their minimum is {packName(k, k.min_packs)}.</span>}
      </div>
      {canAct && (
        <div className="flex flex-wrap items-center gap-2">
          {packs.length > 1 && (
            <select
              aria-label="Pack size"
              value={k.id}
              onChange={(e) => {
                const next = packs.find((x) => x.id === e.target.value)
                if (next) onChoose({ packId: next.id, count: packsFor(p, next) })
              }}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-ink outline-none focus:border-brand-blue"
            >
              {packs.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                  {x.units > 1 ? ` of ${x.units}` : ''}
                  {x.cost_cents != null ? ` · ${money(x.cost_cents)}` : ''}
                </option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setCount(choice.count - 1)} disabled={choice.count <= min} className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40" aria-label="One pack fewer">
              <Icon name="minus" size={16} />
            </button>
            <input
              type="number"
              min={min}
              inputMode="numeric"
              aria-label="How many packs"
              value={choice.count}
              onChange={(e) => setCount(parseInt(e.target.value || '0', 10) || min)}
              className="h-11 w-14 rounded-lg border border-slate-200 px-1 text-center text-sm text-ink outline-none focus:border-brand-blue"
            />
            <button type="button" onClick={() => setCount(choice.count + 1)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-600" aria-label="One pack more">
              <Icon name="plus" size={16} />
            </button>
          </div>
          <button type="button" onClick={() => void run(() => onOrderPacks(choice))} disabled={busy} className="min-h-[44px] rounded-full bg-brand-blue px-4 text-xs font-bold text-white disabled:opacity-60">
            {busy ? 'Saving…' : 'Ordered'}
          </button>
          {orderLink}
        </div>
      )}
      {!canAct && orderLink}
    </li>
  )
}

/* ============================================================= suppliers */

function Suppliers({
  orgId,
  suppliers,
  canWrite,
  canDelete,
  onChanged,
}: {
  orgId: string
  suppliers: Supplier[] | null
  canWrite: boolean
  canDelete: boolean
  onChanged: () => Promise<void>
}) {
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [filter, setFilter] = useState<'all' | 'supplier' | 'vendor'>('all')
  const shown = (suppliers ?? []).filter((s) => (filter === 'supplier' ? s.is_supplier : filter === 'vendor' ? s.is_vendor : true))

  // Gift counts and totals for the summary on each row (update 27).
  const ready = useVendorRecordsReady()
  const [gifts, setGifts] = useState<Map<string, GiftTotals> | null>(null)
  const loadGifts = useCallback(async () => {
    if (!ready || !orgId) return
    try {
      setGifts(await giftTotals(orgId))
    } catch {
      setGifts(null)
    }
  }, [ready, orgId])
  useEffect(() => {
    void loadGifts()
  }, [loadGifts])

  const done = async () => {
    setEditing(null)
    await onChanged()
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        One list for the companies OHRR deals with. Tick <strong>Supplier</strong> for anyone we buy from and <strong>Vendor</strong> for anyone
        who sells at Midwest BunFest — some are both. Everything on a company’s card is for the team only.
      </p>
      <div className="flex gap-2">
        {(
          [
            ['all', 'All'],
            ['supplier', 'Suppliers'],
            ['vendor', 'BunFest vendors'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`min-h-[44px] rounded-full px-3.5 text-sm font-bold ${filter === k ? 'bg-brand-orange text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {suppliers === null && <Spinner />}
      {suppliers && shown.length === 0 && editing !== 'new' && (
        <Card className="text-sm text-slate-600">No one here yet{canWrite ? ' — add the first below.' : '.'}</Card>
      )}
      {shown.map((s) => (
        <Card key={s.id} className="space-y-2">
          <div className="flex items-start gap-3">
            <CompanyThumb c={s} />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-display text-[15px] font-extrabold text-ink">{s.name}</span>
                {s.is_supplier && <Badge tone="blue">Supplier</Badge>}
                {s.is_vendor && <Badge tone="orange">Vendor</Badge>}
                {!s.is_active && <Badge tone="slate">Inactive</Badge>}
              </span>
              <span className="block text-xs text-slate-500">
                {[s.contact_name, s.order_how ? ORDER_HOW_LABEL[s.order_how] : null, s.account_number ? `account ${s.account_number}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              {(s.email || s.phone || s.website) && (
                <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-brand-blue">
                  {s.website && (
                    <a href={s.website} target="_blank" rel="noopener noreferrer">
                      Website
                    </a>
                  )}
                  {s.email && <a href={`mailto:${s.email}`}>{s.email}</a>}
                  {s.phone && <a href={`tel:${s.phone}`}>{s.phone}</a>}
                </span>
              )}
              <CompanySummary c={s} gifts={gifts?.get(s.id)} />
            </span>
            {canWrite && (
              <button type="button" onClick={() => setEditing(editing === s.id ? null : s.id)} className="min-h-[44px] shrink-0 px-2 text-sm font-bold text-brand-blue">
                {editing === s.id ? 'Close' : 'Open'}
              </button>
            )}
          </div>
          {editing === s.id && (
            <div className="border-t border-slate-100 pt-3">
              <CompanyForm
                orgId={orgId}
                initial={s}
                mode="shop"
                canDelete={canDelete}
                onDelete={async () => {
                  await deleteSupplier(s.id)
                  await done()
                }}
                onSaved={done}
                onCancel={() => setEditing(null)}
                onGiftsChanged={() => void loadGifts()}
              />
            </div>
          )}
        </Card>
      ))}
      {canWrite &&
        (editing === 'new' ? (
          <Card>
            <p className="mb-3 font-display text-[15px] font-extrabold text-ink">New company</p>
            <CompanyForm orgId={orgId} initial={null} mode="shop" onSaved={done} onCancel={() => setEditing(null)} />
          </Card>
        ) : (
          <button type="button" onClick={() => setEditing('new')} className={`${btn.outline} min-h-[44px] w-full`}>
            <Icon name="plus" size={16} /> Add a supplier or vendor
          </button>
        ))}
    </div>
  )
}
