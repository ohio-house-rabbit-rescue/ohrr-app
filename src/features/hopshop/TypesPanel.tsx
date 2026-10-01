// Hop Shop → Types: the three letters that start every SKU. HAY-101-001 is
// Hay, from vendor 101, that vendor's first hay item. A type can be renamed
// any time; its letters can change only while no item uses it, so a printed
// label never stops matching. Product types are update 41's `product_types`.
import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { errMessage } from '../../lib/supabase'
import { Badge, btn, Card } from '../../components/ui'
import { Icon } from '../../components/icons'
import { FormError, staffInput } from '../../components/staffui'
import { deleteType, saveType, suggestTypeCode, type ProductType } from './api'

const letters = (v: string) => v.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3)

/** Name → suggested letters (until the person types their own) → Add. Also used inside the product form. */
export function NewTypeForm({
  orgId,
  types,
  onAdded,
  onCancel,
}: {
  orgId: string
  types: ProductType[]
  onAdded: (t: ProductType) => void | Promise<void>
  onCancel?: () => void
}) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [ownCode, setOwnCode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const taken = types.map((t) => t.code)
  const shownCode = ownCode ? code : suggestTypeCode(name, taken)
  // Inside the product form, Enter here adds the type — it must not save the product.
  const onEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    void add()
  }

  const add = async (e?: FormEvent) => {
    e?.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Give the type a name.')
    if (shownCode.length !== 3) return setError('The code is three letters, like HAY.')
    setBusy(true)
    try {
      const t = await saveType(orgId, { id: null, name: name.trim(), code: shownCode, is_active: true })
      setName('')
      setCode('')
      setOwnCode(false)
      await onAdded(t)
    } catch (err) {
      setError(errMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <label className="block text-sm font-semibold text-slate-700">
          New type
          <input className={staffInput} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onEnter} placeholder="Bedding" />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Letters
          <input
            className={`${staffInput} font-mono uppercase`}
            value={shownCode}
            onChange={(e) => {
              setOwnCode(true)
              setCode(letters(e.target.value))
            }}
            onKeyDown={onEnter}
            placeholder="BED"
            autoCapitalize="characters"
            aria-label="Three letters for the SKU"
          />
        </label>
      </div>
      <FormError>{error}</FormError>
      <div className="flex gap-2">
        <button type="button" onClick={() => void add()} disabled={busy} className={`${btn.blue} !py-2.5 disabled:opacity-60`}>
          <Icon name="plus" size={16} /> {busy ? 'Adding…' : 'Add the type'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="min-h-[44px] rounded-full border border-slate-200 px-4 text-sm font-bold text-slate-500">
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

export function TypesPanel({
  orgId,
  types,
  canWrite,
  onChanged,
}: {
  orgId: string
  types: ProductType[]
  canWrite: boolean
  onChanged: () => Promise<void>
}) {
  const [editing, setEditing] = useState<string | null>(null)
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Every Hop Shop SKU starts with its type’s three letters, then the supplier’s vendor number, then the item number:{' '}
        <span className="font-mono font-bold text-ink">HAY-101-001</span> is Hay from vendor 101. Vendor <span className="font-mono font-bold">000</span> means
        no supplier — donated, or made by OHRR.
      </p>
      <ul className="space-y-2">
        {types.map((t) =>
          editing === t.id ? (
            <li key={t.id}>
              <TypeEditor orgId={orgId} t={t} onDone={async () => {
                setEditing(null)
                await onChanged()
              }} onCancel={() => setEditing(null)} />
            </li>
          ) : (
            <li key={t.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
              <span className="inline-flex h-11 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-blue-50 font-mono text-[15px] font-black text-brand-blue">{t.code}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-display text-[15px] font-extrabold text-ink">{t.name}</span>
                  {!t.is_active && <Badge tone="slate">Hidden</Badge>}
                </span>
                <span className="block text-xs text-slate-500">
                  {t.items === 0 ? 'No items yet' : `${t.items} item${t.items === 1 ? '' : 's'}`}
                </span>
              </span>
              {canWrite && (
                <button type="button" onClick={() => setEditing(t.id)} className="min-h-[44px] shrink-0 px-2 text-sm font-bold text-brand-blue">
                  Edit
                </button>
              )}
            </li>
          ),
        )}
      </ul>
      {canWrite && (
        <Card>
          <NewTypeForm orgId={orgId} types={types} onAdded={() => onChanged()} />
        </Card>
      )}
    </div>
  )
}

function TypeEditor({ orgId, t, onDone, onCancel }: { orgId: string; t: ProductType; onDone: () => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(t.name)
  const [code, setCode] = useState(t.code)
  const [active, setActive] = useState(t.is_active)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const used = t.items > 0

  const run = async (fn: () => Promise<unknown>) => {
    setError(null)
    setBusy(true)
    try {
      await fn()
      await onDone()
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-3">
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <label className="block text-sm font-semibold text-slate-700">
          Name
          <input className={staffInput} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Letters
          <input
            className={`${staffInput} font-mono uppercase disabled:bg-slate-50 disabled:text-slate-500`}
            value={code}
            onChange={(e) => setCode(letters(e.target.value))}
            disabled={used}
            aria-label="Three letters for the SKU"
          />
        </label>
      </div>
      {used && <p className="text-xs text-slate-500">Items use {t.code}, so its letters stay. Renaming is fine.</p>}
      <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" className="h-5 w-5 rounded border-slate-300" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Offer it when adding items
      </label>
      <FormError>{error}</FormError>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void run(() => saveType(orgId, { id: t.id, name: name.trim(), code, is_active: active }))} className={`${btn.primary} !py-2.5 disabled:opacity-60`}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="min-h-[44px] rounded-full border border-slate-200 px-4 text-sm font-bold text-slate-500">
          Cancel
        </button>
        {!used && (
          <button type="button" disabled={busy} onClick={() => void run(() => deleteType(orgId, t.id))} className="ml-auto min-h-[44px] rounded-full border border-red-200 px-4 text-sm font-bold text-red-600">
            Delete
          </button>
        )}
      </div>
    </Card>
  )
}
