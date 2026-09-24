// "Given by (company)" on a silent-auction item: which company in the
// supplier / vendor list donated it (`raffle_items.donor_supplier_id`, update
// 27). It sits beside the free-text "Donated by" the catalogue shows, and puts
// the item on that company's card under "Given to OHRR". Staff only; saves the
// moment a company is picked, and stays hidden until update 27 has been run.
//
// Drop-in for the Silent Auction editor (src/pages/StaffRaffle.tsx), on an item
// that has been saved:  <GivenByCompany orgId={orgId} itemId={item.id} />
import { useEffect, useState } from 'react'
import { errMessage } from '../../lib/supabase'
import { staffInput } from '../../components/staffui'
import { listSuppliers, type Supplier } from '../hopshop/api'
import { auctionItemDonor, setAuctionItemDonor, vendorRecordsReady } from '../hopshop/companies'

export function GivenByCompany({
  orgId,
  itemId,
  onPicked,
}: {
  orgId: string
  itemId: string
  /** Called with the company's name after it is saved (e.g. to fill an empty "Donated by"). */
  onPicked?: (name: string | null) => void
}) {
  const [companies, setCompanies] = useState<Supplier[] | null>(null)
  const [value, setValue] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void (async () => {
      if (!orgId || !(await vendorRecordsReady())) return
      try {
        const [list, donor] = await Promise.all([listSuppliers(orgId), auctionItemDonor(itemId)])
        if (!live) return
        setCompanies(list)
        setValue(donor ?? '')
      } catch {
        /* the picker simply stays hidden */
      }
    })()
    return () => {
      live = false
    }
  }, [orgId, itemId])

  if (!companies) return null

  const pick = async (id: string) => {
    const before = value
    setValue(id)
    setState('saving')
    setError(null)
    try {
      await setAuctionItemDonor(itemId, id || null)
      setState('saved')
      onPicked?.(companies.find((c) => c.id === id)?.name ?? null)
    } catch (e) {
      setValue(before)
      setState('idle')
      setError(errMessage(e))
    }
  }

  // Vendors first — most auction items come from BunFest vendors — then everyone else.
  const vendors = companies.filter((c) => c.is_vendor)
  const others = companies.filter((c) => !c.is_vendor)

  return (
    <label className="block text-sm font-semibold text-slate-700">
      Given by (company){' '}
      <span className="font-normal text-slate-500">
        {state === 'saving' ? '· saving…' : state === 'saved' ? '· saved' : '· optional, team only'}
      </span>
      <select className={`${staffInput} min-h-[44px]`} value={value} onChange={(e) => void pick(e.target.value)} disabled={state === 'saving'}>
        <option value="">— not a company in our list —</option>
        {vendors.length > 0 && (
          <optgroup label="BunFest vendors">
            {vendors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>
        )}
        {others.length > 0 && (
          <optgroup label="Suppliers and others">
            {others.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <span className="mt-1 block text-xs font-normal text-slate-500">
        The item then shows on that company’s card under “Given to OHRR”. Visitors still see “Donated by” above.
      </span>
      {error && <span className="mt-1 block text-sm font-semibold text-red-600">{error}</span>}
    </label>
  )
}
