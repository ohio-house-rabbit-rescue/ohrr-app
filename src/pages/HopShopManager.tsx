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
  fromCents,
  groupBySupplier,
  isLow,
  listProducts,
  listSuppliers,
  money,
  ORDER_HOW_LABEL,
  orderText,
  reorderList,
  saveProduct,
  saveSupplier,
  setOrder,
  setStock,
  toCents,
  type OrderHow,
  type ProductInput,
  type StockCard,
  type Supplier,
} from '../features/hopshop/api'

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
        </div>
        <span className="shrink-0 font-display text-lg font-black text-brand-blue">{money(p.price_cents)}</span>
      </div>

      <StockRow p={p} orgId={orgId} userId={userId} canCount={perms.canInventory} onSaved={onChanged} />

      {(perms.canEdit || perms.canDelete) && (
        <div className="mt-3 flex items-center gap-2">
          {perms.canEdit && (
            <button type="button" onClick={() => setEditing(true)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
              Edit
            </button>
          )}
          {perms.canDelete &&
            (confirmDelete ? (
              <>
                <button type="button" onClick={doDelete} disabled={busy} className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">
                  {busy ? 'Deleting…' : 'Confirm delete'}
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500">
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">
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
            <button type="button" onClick={() => setVal((v) => clamp(v - 1))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600" aria-label="One fewer">
              <Icon name="minus" size={16} />
            </button>
            <input
              type="number"
              min="0"
              value={val}
              onChange={(e) => setVal(clamp(parseInt(e.target.value || '0', 10)))}
              className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-center text-sm text-ink outline-none focus:border-brand-blue"
            />
            <button type="button" onClick={() => setVal((v) => clamp(v + 1))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600" aria-label="One more">
              <Icon name="plus" size={16} />
            </button>
          </div>
        ) : (
          <span className="text-sm font-bold text-ink">{p.quantity ?? '—'}</span>
        )}
        {p.unit && <span className="text-xs text-slate-500">{p.unit}</span>}
        {p.reorder_point != null && <span className="text-xs text-slate-500">· reorder at {p.reorder_point}</span>}
        {dirty && (
          <button type="button" onClick={save} disabled={busy} className="rounded-full bg-brand-blue px-3 py-1 text-xs font-bold text-white disabled:opacity-60">
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
      const input: ProductInput = {
        id: initial?.id ?? null,
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
      await saveProduct(orgId, input)
      await onSaved()
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
    }
  }

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
            Our cost (USD)
            <input className={staffInput} type="number" min="0" step="0.01" inputMode="decimal" value={d.cost} onChange={set('cost')} placeholder="0.00" />
          </label>
        </div>
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

  const act = async (p: StockCard, action: 'ordered' | 'received' | 'clear') => {
    setError(null)
    try {
      await setOrder(p.id, action)
      await load()
    } catch (e) {
      setError(errMessage(e))
    }
  }

  const groups = useMemo(() => groupBySupplier(items ?? []), [items])
  const supplierOf = (id: string | null) => suppliers.find((s) => s.id === id) ?? null

  const sendList = async (name: string, list: StockCard[], s: Supplier | null) => {
    const text = orderText(name, list, s?.account_number)
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
        return (
          <Card key={g.key} className="space-y-3">
            <div>
              <p className="font-display text-[15px] font-extrabold text-ink">{g.name}</p>
              {s && (
                <p className="text-xs text-slate-500">
                  {s.order_how ? ORDER_HOW_LABEL[s.order_how] : ''}
                  {s.account_number ? ` · account ${s.account_number}` : ''}
                  {s.min_order ? ` · min ${s.min_order}` : ''}
                  {s.lead_days != null ? ` · about ${s.lead_days} day${s.lead_days === 1 ? '' : 's'}` : ''}
                </p>
              )}
              {s && (s.email || s.phone || s.website) && (
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-brand-blue">
                  {s.website && (
                    <a href={s.website} target="_blank" rel="noopener noreferrer">
                      Website
                    </a>
                  )}
                  {s.email && <a href={`mailto:${s.email}`}>{s.email}</a>}
                  {s.phone && <a href={`tel:${s.phone}`}>{s.phone}</a>}
                </p>
              )}
              {s?.order_notes && <p className="mt-1 text-xs text-slate-600">{s.order_notes}</p>}
            </div>

            {toOrder.length > 0 && (
              <ul className="divide-y divide-slate-100">
                {toOrder.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2">
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
                      <button type="button" onClick={() => act(p, 'ordered')} className="rounded-full bg-brand-blue px-3 py-1.5 text-xs font-bold text-white">
                        Ordered
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {toOrder.length > 0 && (
              <div className="flex gap-2">
                <button type="button" onClick={() => void sendList(g.name, toOrder, s)} className={`${btn.outline} flex-1 !py-2`}>
                  <Icon name="mail" size={16} /> {s?.email ? 'Email the order' : 'Send the list'}
                </button>
                <button
                  type="button"
                  onClick={() => copyText(orderText(g.name, toOrder, s?.account_number)).then((ok) => setNote(ok ? 'Order list copied.' : null))}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600"
                >
                  Copy
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
                          {p.on_order_qty} ordered{p.ordered_at ? ` ${new Date(p.ordered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''} · {p.quantity ?? 0} left
                        </span>
                      </span>
                      {canAct && (
                        <>
                          <button type="button" onClick={() => act(p, 'received')} className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-bold text-white">
                            Arrived
                          </button>
                          <button type="button" onClick={() => act(p, 'clear')} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500">
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

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        One list for the companies OHRR deals with. Tick <strong>Supplier</strong> for anyone we buy from and <strong>Vendor</strong> for anyone
        who sells at Midwest BunFest — some are both.
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
            className={`min-h-[40px] rounded-full px-3.5 text-sm font-bold ${filter === k ? 'bg-brand-orange text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
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
            </span>
            {canWrite && (
              <button type="button" onClick={() => setEditing(editing === s.id ? null : s.id)} className="text-sm font-bold text-brand-blue">
                {editing === s.id ? 'Close' : 'Edit'}
              </button>
            )}
          </div>
          {editing === s.id && (
            <SupplierForm
              orgId={orgId}
              initial={s}
              canDelete={canDelete}
              onSaved={async () => {
                setEditing(null)
                await onChanged()
              }}
            />
          )}
        </Card>
      ))}
      {canWrite &&
        (editing === 'new' ? (
          <Card>
            <SupplierForm
              orgId={orgId}
              initial={null}
              canDelete={false}
              onSaved={async () => {
                setEditing(null)
                await onChanged()
              }}
            />
          </Card>
        ) : (
          <button type="button" onClick={() => setEditing('new')} className={`${btn.outline} w-full`}>
            <Icon name="plus" size={16} /> Add a supplier or vendor
          </button>
        ))}
    </div>
  )
}

function SupplierForm({
  orgId,
  initial,
  canDelete,
  onSaved,
}: {
  orgId: string
  initial: Supplier | null
  canDelete: boolean
  onSaved: () => Promise<void>
}) {
  const [d, setD] = useState({
    name: initial?.name ?? '',
    is_supplier: initial?.is_supplier ?? true,
    is_vendor: initial?.is_vendor ?? false,
    contact_name: initial?.contact_name ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    website: initial?.website ?? '',
    address: initial?.address ?? '',
    account_number: initial?.account_number ?? '',
    order_how: (initial?.order_how ?? '') as OrderHow | '',
    order_notes: initial?.order_notes ?? '',
    lead_days: initial?.lead_days == null ? '' : String(initial.lead_days),
    min_order: initial?.min_order ?? '',
    notes: initial?.notes ?? '',
    is_active: initial?.is_active ?? true,
  })
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const txt = (k: keyof typeof d) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value })
  const nul = (s: string) => s.trim() || null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (!d.is_supplier && !d.is_vendor) throw new Error('Tick Supplier, Vendor, or both.')
      let website = nul(d.website)
      if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`
      await saveSupplier({
        ...(initial ? { id: initial.id } : {}),
        org_id: orgId,
        name: d.name.trim(),
        is_supplier: d.is_supplier,
        is_vendor: d.is_vendor,
        contact_name: nul(d.contact_name),
        email: nul(d.email),
        phone: nul(d.phone),
        website,
        address: nul(d.address),
        account_number: nul(d.account_number),
        order_how: d.order_how || null,
        order_notes: nul(d.order_notes),
        lead_days: d.lead_days === '' ? null : Number(d.lead_days),
        min_order: nul(d.min_order),
        notes: nul(d.notes),
        is_active: d.is_active,
      })
      await onSaved()
    } catch (err) {
      setError(errMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const doDelete = async () => {
    if (!initial) return
    setBusy(true)
    setError(null)
    try {
      await deleteSupplier(initial.id)
      await onSaved()
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 border-t border-slate-100 pt-3">
      <label className="block text-sm font-semibold text-slate-700">
        Company
        <input className={staffInput} required value={d.name} onChange={txt('name')} placeholder="Small Pet Select" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700">
          <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-brand-blue" checked={d.is_supplier} onChange={(e) => setD({ ...d, is_supplier: e.target.checked })} />
          Supplier — we buy from them
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700">
          <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-brand-orange" checked={d.is_vendor} onChange={(e) => setD({ ...d, is_vendor: e.target.checked })} />
          Vendor — sells at BunFest
        </label>
      </div>
      <label className="block text-sm font-semibold text-slate-700">
        Contact person
        <input className={staffInput} value={d.contact_name} onChange={txt('contact_name')} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          Email
          <input className={staffInput} type="email" value={d.email} onChange={txt('email')} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Phone
          <input className={staffInput} type="tel" value={d.phone} onChange={txt('phone')} />
        </label>
      </div>
      <label className="block text-sm font-semibold text-slate-700">
        Website (ordering page if there is one)
        <input className={staffInput} inputMode="url" value={d.website} onChange={txt('website')} placeholder="smallpetselect.com" />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Address
        <input className={staffInput} value={d.address} onChange={txt('address')} />
      </label>
      {d.is_supplier && (
        <div className="space-y-3 rounded-2xl border border-brand-blue/20 bg-brand-blue-50/40 p-3">
          <p className="text-sm font-bold text-ink">How we order</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold text-slate-700">
              How
              <select className={staffInput} value={d.order_how} onChange={txt('order_how')}>
                <option value="">—</option>
                {(Object.keys(ORDER_HOW_LABEL) as OrderHow[]).map((k) => (
                  <option key={k} value={k}>
                    {ORDER_HOW_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Account #
              <input className={staffInput} value={d.account_number} onChange={txt('account_number')} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold text-slate-700">
              Days to arrive
              <input className={staffInput} inputMode="numeric" value={d.lead_days} onChange={(e) => setD({ ...d, lead_days: e.target.value.replace(/[^0-9]/g, '') })} />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Minimum order
              <input className={staffInput} value={d.min_order} onChange={txt('min_order')} placeholder="$75 · 6 bags" />
            </label>
          </div>
          <label className="block text-sm font-semibold text-slate-700">
            Ordering notes
            <textarea className={staffInput} rows={2} value={d.order_notes} onChange={txt('order_notes')} placeholder="Free shipping over $75. Rescue discount code on file with Bev." />
          </label>
        </div>
      )}
      <label className="block text-sm font-semibold text-slate-700">
        Notes
        <textarea className={staffInput} rows={2} value={d.notes} onChange={txt('notes')} />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-brand-blue" checked={d.is_active} onChange={(e) => setD({ ...d, is_active: e.target.checked })} />
        Active (shows in the supplier list on items)
      </label>
      <FormError>{error}</FormError>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !d.name.trim()} className={`${btn.primary} flex-1 disabled:opacity-60`}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        {initial &&
          canDelete &&
          (confirmDelete ? (
            <button type="button" onClick={doDelete} disabled={busy} className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
              Confirm delete
            </button>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-full border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600">
              Delete
            </button>
          ))}
      </div>
    </form>
  )
}
