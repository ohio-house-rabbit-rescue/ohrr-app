import { useCallback, useEffect, useState } from 'react'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { btn, Badge, Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { Spinner, FormError, staffInput } from '../components/staffui'
import type { Database } from '../lib/database.types'

type Product = Database['public']['Tables']['hopshop_products']['Row']
interface Row extends Product {
  quantity: number | null
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`
const toCents = (dollars: string) => {
  const n = Math.round(parseFloat(dollars) * 100)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

interface Draft {
  name: string
  price: string
  sku: string
  description: string
  is_active: boolean
}

const emptyDraft: Draft = { name: '', price: '', sku: '', description: '', is_active: true }

function draftFrom(p: Product): Draft {
  return {
    name: p.name,
    price: (p.price_cents / 100).toFixed(2),
    sku: p.sku ?? '',
    description: p.description ?? '',
    is_active: p.is_active,
  }
}

/* ---- Add / edit form (shared by create and edit) ---- */
function ProductForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: Draft
  submitLabel: string
  onSubmit: (d: Draft) => Promise<void>
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<Draft>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof Draft) => (e: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }))

  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await onSubmit(draft)
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm font-semibold text-slate-700">
        Name
        <input className={staffInput} required value={draft.name} onChange={set('name')} />
      </label>
      <div className="flex gap-3">
        <label className="block flex-1 text-sm font-semibold text-slate-700">
          Price (USD)
          <input
            className={staffInput}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={draft.price}
            onChange={set('price')}
            placeholder="0.00"
          />
        </label>
        <label className="block flex-1 text-sm font-semibold text-slate-700">
          SKU (optional)
          <input className={staffInput} value={draft.sku} onChange={set('sku')} />
        </label>
      </div>
      <label className="block text-sm font-semibold text-slate-700">
        Description
        <textarea
          className={staffInput}
          rows={2}
          value={draft.description}
          onChange={set('description')}
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue/30"
          checked={draft.is_active}
          onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))}
        />
        Visible in the shop
      </label>

      <FormError>{error}</FormError>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || draft.name.trim().length === 0}
          className={`${btn.primary} flex-1 disabled:opacity-60`}
        >
          {busy ? 'Saving…' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500 transition hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

/* ---- Inventory stepper (gated on hopshop.inventory.update) ---- */
function InventoryControl({
  product,
  orgId,
  userId,
  onSaved,
}: {
  product: Row
  orgId: string
  userId: string
  onSaved: () => void
}) {
  const [val, setVal] = useState<number>(product.quantity ?? 0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Re-sync if the underlying value changes (e.g. after a refetch).
  useEffect(() => setVal(product.quantity ?? 0), [product.quantity])

  const dirty = val !== (product.quantity ?? 0)
  const clamp = (n: number) => (n < 0 ? 0 : n)

  const save = async () => {
    setError(null)
    setBusy(true)
    try {
      const { error } = await supabase.from('hopshop_inventory').upsert(
        { product_id: product.id, org_id: orgId, quantity: val, updated_by: userId },
        { onConflict: 'product_id' },
      )
      if (error) throw error
      onSaved()
    } catch (err) {
      setError(errMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2.5 border-t border-slate-100 pt-2.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Stock</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setVal((v) => clamp(v - 1))}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label="Decrease"
          >
            −
          </button>
          <input
            type="number"
            min="0"
            value={val}
            onChange={(e) => setVal(clamp(parseInt(e.target.value || '0', 10)))}
            className="w-14 rounded-lg border border-slate-200 px-2 py-1 text-center text-sm text-ink outline-none focus:border-brand-blue"
          />
          <button
            type="button"
            onClick={() => setVal((v) => clamp(v + 1))}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label="Increase"
          >
            +
          </button>
        </div>
        {dirty && (
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-full bg-brand-blue px-3 py-1 text-xs font-bold text-white disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>
      <FormError>{error}</FormError>
    </div>
  )
}

/* ---- One product card ---- */
function ProductCard({
  row,
  orgId,
  userId,
  canEdit,
  canDelete,
  canInventory,
  onChanged,
}: {
  row: Row
  orgId: string
  userId: string
  canEdit: boolean
  canDelete: boolean
  canInventory: boolean
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const saveEdit = async (d: Draft) => {
    const { error } = await supabase
      .from('hopshop_products')
      .update({
        name: d.name.trim(),
        price_cents: toCents(d.price),
        sku: d.sku.trim() || null,
        description: d.description.trim() || null,
        is_active: d.is_active,
      })
      .eq('id', row.id)
    if (error) throw error
    setEditing(false)
    onChanged()
  }

  const doDelete = async () => {
    setError(null)
    setBusy(true)
    try {
      const { error } = await supabase.from('hopshop_products').delete().eq('id', row.id)
      if (error) throw error
      onChanged()
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  if (editing) {
    return (
      <Card>
        <ProductForm
          initial={draftFrom(row)}
          submitLabel="Save changes"
          onSubmit={saveEdit}
          onCancel={() => setEditing(false)}
        />
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-[15px] font-extrabold text-ink">{row.name}</h3>
            {!row.is_active && <Badge tone="slate">Hidden</Badge>}
          </div>
          {row.description && (
            <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{row.description}</p>
          )}
          {row.sku && <p className="mt-1 text-xs text-slate-400">SKU {row.sku}</p>}
        </div>
        <span className="shrink-0 font-display text-lg font-black text-brand-blue">
          {money(row.price_cents)}
        </span>
      </div>

      {canInventory ? (
        <InventoryControl product={row} orgId={orgId} userId={userId} onSaved={onChanged} />
      ) : (
        <p className="mt-2.5 border-t border-slate-100 pt-2.5 text-xs font-bold uppercase tracking-wide text-slate-400">
          Stock: {row.quantity ?? '—'}
        </p>
      )}

      {(canEdit || canDelete) && (
        <div className="mt-3 flex items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Edit
            </button>
          )}
          {canDelete &&
            (confirmDelete ? (
              <>
                <button
                  type="button"
                  onClick={doDelete}
                  disabled={busy}
                  className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                >
                  {busy ? 'Deleting…' : 'Confirm delete'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            ))}
        </div>
      )}
      <FormError>{error}</FormError>
    </Card>
  )
}

export default function HopShopManager() {
  const { user, membership, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const userId = user?.id ?? ''

  const canCreate = can('hopshop.products.create')
  const canEdit = can('hopshop.products.edit')
  const canDelete = can('hopshop.products.delete')
  const canInventory = can('hopshop.inventory.update')
  const readOnly = !canCreate && !canEdit && !canDelete && !canInventory

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    if (!orgId) return
    setError(null)
    const [{ data: products, error: pErr }, { data: inv, error: iErr }] = await Promise.all([
      supabase.from('hopshop_products').select('*').eq('org_id', orgId).order('name'),
      supabase.from('hopshop_inventory').select('product_id, quantity').eq('org_id', orgId),
    ])
    if (pErr || iErr) {
      setError(errMessage(pErr ?? iErr))
      setLoading(false)
      return
    }
    const qty = new Map((inv ?? []).map((i) => [i.product_id, i.quantity]))
    setRows((products ?? []).map((p) => ({ ...p, quantity: qty.get(p.id) ?? null })))
    setLoading(false)
  }, [orgId])

  useEffect(() => {
    load()
  }, [load])

  const createProduct = async (d: Draft) => {
    const { error } = await supabase.from('hopshop_products').insert({
      org_id: orgId,
      name: d.name.trim(),
      price_cents: toCents(d.price),
      sku: d.sku.trim() || null,
      description: d.description.trim() || null,
      is_active: d.is_active,
      created_by: userId,
    })
    if (error) throw error
    setCreating(false)
    await load()
  }

  return (
    <Screen className="space-y-4">
      <div className="flex items-start justify-between gap-3 pt-1">
        <div>
          <h1 className="font-display text-2xl font-black text-ink">Hop Shop manager</h1>
          <p className="mt-1 text-sm text-slate-600">
            {readOnly
              ? 'View-only — ask an owner or admin for edit access.'
              : 'Manage products and stock. Changes go live in the app.'}
          </p>
        </div>
        {canCreate && !creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className={`${btn.primary} shrink-0 !px-4 !py-2.5`}
          >
            <Icon name="bag" size={15} /> Add
          </button>
        )}
      </div>

      {creating && (
        <Card>
          <p className="mb-3 font-display text-[15px] font-extrabold text-ink">New product</p>
          <ProductForm
            initial={emptyDraft}
            submitLabel="Add product"
            onSubmit={createProduct}
            onCancel={() => setCreating(false)}
          />
        </Card>
      )}

      <FormError>{error}</FormError>

      {loading ? (
        <Spinner label="Loading products…" />
      ) : rows.length === 0 ? (
        <Card className="border-slate-200 bg-slate-50/80 text-center">
          <p className="text-sm leading-relaxed text-slate-600">
            No products yet.{canCreate ? ' Tap “Add” to create the first one.' : ''}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {rows.map((row) => (
            <ProductCard
              key={row.id}
              row={row}
              orgId={orgId}
              userId={userId}
              canEdit={canEdit}
              canDelete={canDelete}
              canInventory={canInventory}
              onChanged={load}
            />
          ))}
        </div>
      )}
    </Screen>
  )
}
