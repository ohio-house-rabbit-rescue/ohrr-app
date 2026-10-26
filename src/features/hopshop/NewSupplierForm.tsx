// A supplier added from inside the item form, so the item being entered is
// never left behind. Only the name is needed: the database gives the vendor
// number, and the rest (shipping, account number, how to order) can be filled
// in later on the Suppliers tab. A name already on file is offered instead of
// a second copy (a BunFest vendor becomes a supplier too).
import { useState, type KeyboardEvent } from 'react'
import { errMessage } from '../../lib/supabase'
import { btn } from '../../components/ui'
import { Icon } from '../../components/icons'
import { FormError, staffInput } from '../../components/staffui'
import { saveSupplier, type Supplier } from './api'

const sameName = (a: string, b: string) => a.trim().toLowerCase().replace(/\s+/g, ' ') === b.trim().toLowerCase().replace(/\s+/g, ' ')

export function NewSupplierForm({
  orgId,
  suppliers,
  onAdded,
  onCancel,
}: {
  orgId: string
  /** Every company on file (suppliers, vendors, ones no longer used). */
  suppliers: Supplier[]
  onAdded: (s: Supplier) => void | Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const onFile = name.trim() ? (suppliers.find((s) => sameName(s.name, name)) ?? null) : null
  // Inside the item form, Enter here adds the supplier — it must not save the item.
  const onEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    void add()
  }

  const run = async (save: () => Promise<Supplier>) => {
    setError(null)
    setBusy(true)
    try {
      await onAdded(await save())
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
    }
  }

  const add = async () => {
    if (!name.trim()) return setError('Give the supplier a name.')
    if (onFile) return pickOnFile()
    await run(() =>
      saveSupplier({
        org_id: orgId,
        name: name.trim(),
        is_supplier: true,
        is_active: true,
        website: website.trim() || null,
        email: email.trim() || null,
        order_how: website.trim() ? 'website' : email.trim() ? 'email' : null,
      }),
    )
  }

  const pickOnFile = async () => {
    if (!onFile) return
    if (onFile.is_supplier && onFile.is_active) return run(async () => onFile)
    await run(() => saveSupplier({ id: onFile.id, org_id: orgId, name: onFile.name, is_supplier: true, is_active: true }))
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-700">
        New supplier
        <input className={staffInput} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onEnter} placeholder="Small Pet Select" autoFocus />
      </label>
      {onFile ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-slate-700">
          <strong>{onFile.name}</strong> is already on file
          {!onFile.is_supplier ? ' as a BunFest vendor' : !onFile.is_active ? ' (marked not in use)' : ''}. Use that one, so its items stay together.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-sm font-semibold text-slate-700">
            Website <span className="font-normal text-slate-500">(optional)</span>
            <input className={staffInput} inputMode="url" value={website} onChange={(e) => setWebsite(e.target.value)} onKeyDown={onEnter} placeholder="smallpetselect.com" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Email <span className="font-normal text-slate-500">(optional)</span>
            <input className={staffInput} type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onEnter} />
          </label>
        </div>
      )}
      <p className="text-xs text-slate-500">It gets its vendor number when you add it. Shipping, account number and how to order can be added later on the Suppliers tab.</p>
      <FormError>{error}</FormError>
      <div className="flex gap-2">
        <button type="button" onClick={() => void (onFile ? pickOnFile() : add())} disabled={busy} className={`${btn.blue} !py-2.5 disabled:opacity-60`}>
          <Icon name="plus" size={16} /> {busy ? 'Adding…' : onFile ? `Use ${onFile.name}` : 'Add the supplier'}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="min-h-[44px] rounded-full border border-slate-200 px-4 text-sm font-bold text-slate-500">
          Cancel
        </button>
      </div>
    </div>
  )
}
