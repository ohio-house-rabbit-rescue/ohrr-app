// Hop Shop → Deliveries (update 42): every invoice added, newest first, with
// this year's spending and shipping; one delivery's lines, its invoice files,
// its price labels, and Undo (the items come back off stock).
//   /staff/hopshop/deliveries            the list (?supplier= for one supplier)
//   /staff/hopshop/deliveries/:id        one delivery
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { errMessage } from '../../lib/supabase'
import { btn, Card, Screen } from '../../components/ui'
import { Icon } from '../../components/icons'
import { FormError, Spinner, staffInput } from '../../components/staffui'
import { listSuppliers, money, type Supplier } from './api'
import { dayText, deliveryDetail, invoiceFileUrl, listDeliveries, undoDelivery, type Delivery } from './deliveries'

export default function Deliveries() {
  const { id } = useParams()
  return id ? <DeliveryPage id={id} /> : <DeliveryList />
}

function Back() {
  return (
    <Link to="/staff/hopshop/reorder" className="inline-flex min-h-[44px] items-center gap-1 text-base font-bold text-brand-blue">
      <Icon name="arrowLeft" size={20} /> Hop Shop inventory
    </Link>
  )
}

function DeliveryList() {
  const { membership } = useAuth()
  const orgId = membership?.orgId ?? ''
  const [params, setParams] = useSearchParams()
  const supplier = params.get('supplier') ?? ''
  const [rows, setRows] = useState<Delivery[] | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orgId) return
    let live = true
    setRows(null)
    listDeliveries(orgId, supplier || null)
      .then((d) => live && setRows(d))
      .catch((e) => live && setError(errMessage(e)))
    return () => {
      live = false
    }
  }, [orgId, supplier])
  useEffect(() => {
    if (orgId) void listSuppliers(orgId).then((s) => setSuppliers(s.filter((x) => x.is_supplier)), () => undefined)
  }, [orgId])

  const year = String(new Date().getFullYear())
  const thisYear = useMemo(() => (rows ?? []).filter((d) => (d.invoice_date ?? d.received_on).startsWith(year)), [rows, year])
  const spent = thisYear.reduce((n, d) => n + (d.total_cents ?? 0), 0)
  const shipping = thisYear.reduce((n, d) => n + (d.shipping_cents ?? 0), 0)

  return (
    <Screen className="space-y-4">
      <div className="pt-1">
        <Back />
        <h1 className="mt-1 font-display text-2xl font-black text-ink">Deliveries</h1>
        <p className="mt-1 text-base text-slate-600">Every invoice added to stock, with what it cost and what the shipping was.</p>
      </div>
      <Link to={`/staff/hopshop/deliveries/new${supplier ? `?supplier=${supplier}` : ''}`} className={`${btn.primary} min-h-[52px] w-full`}>
        <Icon name="plus" size={18} /> Add a delivery
      </Link>
      <label className="block text-sm font-semibold text-slate-700">
        Supplier
        <select
          className={staffInput}
          value={supplier}
          onChange={(e) => setParams(e.target.value ? { supplier: e.target.value } : {}, { replace: true })}
        >
          <option value="">All suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <FormError>{error}</FormError>
      {rows === null && !error && <Spinner />}
      {rows && thisYear.length > 0 && (
        <Card className="text-sm text-slate-700">
          <p className="font-bold text-ink">
            {year}: {thisYear.length} deliver{thisYear.length === 1 ? 'y' : 'ies'}, {money(spent)}
          </p>
          <p>
            of which shipping {money(shipping)}
            {spent > 0 && shipping > 0 ? ` (${Math.round((shipping / spent) * 100)}%)` : ''}
          </p>
        </Card>
      )}
      {rows && rows.length === 0 && <Card className="text-sm text-slate-600">No deliveries yet. Add one from its invoice.</Card>}
      <ul className="space-y-2">
        {(rows ?? []).map((d) => (
          <li key={d.id}>
            <Link to={`/staff/hopshop/deliveries/${d.id}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-[15px] font-extrabold text-ink">{d.supplier_name ?? 'No supplier set'}</span>
                <span className="block text-sm text-slate-600">
                  {[dayText(d.invoice_date ?? d.received_on), d.invoice_no ? `invoice ${d.invoice_no}` : null, `${d.units} item${d.units === 1 ? '' : 's'}`]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <span className="shrink-0 font-display text-base font-black text-brand-blue">{d.total_cents != null ? money(d.total_cents) : ''}</span>
              <Icon name="chevron" size={18} />
            </Link>
          </li>
        ))}
      </ul>
    </Screen>
  )
}

function DeliveryPage({ id }: { id: string }) {
  const { membership } = useAuth()
  const orgId = membership?.orgId ?? ''
  const navigate = useNavigate()
  const [d, setD] = useState<Delivery | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!orgId) return
    try {
      setD(await deliveryDetail(orgId, id))
    } catch (e) {
      setError(errMessage(e))
    }
  }, [orgId, id])
  useEffect(() => {
    void load()
  }, [load])

  const open = async (path: string) => {
    try {
      window.open(await invoiceFileUrl(path), '_blank', 'noopener')
    } catch (e) {
      setError(errMessage(e))
    }
  }

  const undo = async () => {
    setBusy(true)
    setError(null)
    try {
      await undoDelivery(orgId, id)
      navigate('/staff/hopshop/deliveries', { replace: true })
    } catch (e) {
      setError(errMessage(e))
      setBusy(false)
    }
  }

  const added = (d?.lines ?? []).filter((l) => l.units_added > 0 && l.sku)
  const labels = `/staff/hopshop/labels?${added.map((l) => `c=${encodeURIComponent(`${l.sku}:${l.units_added}`)}`).join('&')}`

  return (
    <Screen className="space-y-4">
      <div className="pt-1">
        <Link to="/staff/hopshop/deliveries" className="inline-flex min-h-[44px] items-center gap-1 text-base font-bold text-brand-blue">
          <Icon name="arrowLeft" size={20} /> Deliveries
        </Link>
      </div>
      <FormError>{error}</FormError>
      {d === undefined && !error && <Spinner />}
      {d === null && <Card className="text-sm text-slate-600">That delivery isn’t here — it may have been undone.</Card>}
      {d && (
        <>
          <div>
            <h1 className="font-display text-2xl font-black text-ink">{d.supplier_name ?? 'Delivery'}</h1>
            <p className="mt-1 text-base text-slate-600">
              {[d.invoice_no ? `Invoice ${d.invoice_no}` : null, d.invoice_date ? dayText(d.invoice_date) : null, `added ${dayText(d.received_on)}`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <Card className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            {(
              [
                ['Subtotal', d.subtotal_cents],
                ['Shipping', d.shipping_cents],
                ['Tax', d.tax_cents],
                ['Total', d.total_cents],
              ] as const
            ).map(([k, v]) => (
              <p key={k} className={k === 'Total' ? 'font-bold text-ink' : 'text-slate-700'}>
                {k}: {v == null ? '—' : money(v)}
              </p>
            ))}
          </Card>
          {d.file_paths.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {d.file_paths.map((p, i) => (
                <button key={p} type="button" onClick={() => void open(p)} className={`${btn.outline} min-h-[44px]`}>
                  <Icon name="eye" size={16} /> {d.file_paths.length > 1 ? `Invoice page ${i + 1}` : 'See the invoice'}
                </button>
              ))}
            </div>
          )}
          <ul className="space-y-2">
            {(d.lines ?? []).map((l) => (
              <li key={l.id} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm">
                {l.product_id ? (
                  <>
                    <p className="font-display text-[15px] font-extrabold text-ink">
                      +{l.units_added} {l.product_name}
                    </p>
                    <p className="text-slate-600">
                      {[l.sku, l.unit_cost_cents != null ? `${money(l.unit_cost_cents)} each` : null, l.supplier_sku ? `their item ${l.supplier_sku}` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </>
                ) : (
                  <p className="text-slate-500">Not added to stock{l.line_total_cents != null ? ` (${money(l.line_total_cents)})` : ''}</p>
                )}
                {l.read_as && <p className="mt-0.5 break-words font-mono text-xs text-slate-400">{l.read_as}</p>}
              </li>
            ))}
          </ul>
          {added.length > 0 && (
            <Link to={labels} className={`${btn.blue} min-h-[52px] w-full`}>
              <Icon name="printer" size={18} /> Print {d.units} price label{d.units === 1 ? '' : 's'}
            </Link>
          )}
          {confirm ? (
            <Card className="space-y-2 border-red-200 bg-red-50">
              <p className="text-sm text-slate-700">
                This takes {d.units} item{d.units === 1 ? '' : 's'} back off stock and deletes this delivery and its invoice file.
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => void undo()} disabled={busy} className="min-h-[44px] rounded-full bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-60">
                  {busy ? 'Undoing…' : 'Undo the delivery'}
                </button>
                <button type="button" onClick={() => setConfirm(false)} className="min-h-[44px] rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600">
                  Keep it
                </button>
              </div>
            </Card>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className="block w-full py-2 text-center text-sm font-bold text-red-600">
              Undo this delivery
            </button>
          )}
        </>
      )}
    </Screen>
  )
}
