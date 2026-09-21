// Everything that has a tag, newest first — filter by kind, search by name or
// code, tap a row to open it in the scan flow (same big buttons as scanning it).
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { Icon } from '../../../components/icons'
import { Screen } from '../../../components/ui'
import { Spinner } from '../../../components/staffui'
import { listItems } from '../api'
import { BigButton, ErrorBox } from '../ScanUI'
import { ITEM_KINDS, KIND_META, formatMoney, statusLabel, type ItemKind, type TaggedItem } from '../types'

type Filter = 'all' | ItemKind

export default function ItemsList() {
  const { membership } = useAuth()
  const orgId = membership?.orgId ?? ''
  const [items, setItems] = useState<TaggedItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!orgId) return
    let alive = true
    listItems(orgId)
      .then((rows) => alive && setItems(rows))
      .catch((e) => alive && setError(errMessage(e)))
    return () => {
      alive = false
    }
  }, [orgId])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (items ?? []).filter(
      (i) =>
        (filter === 'all' || i.kind === filter) &&
        (!needle || i.title.toLowerCase().includes(needle) || i.code.toLowerCase().includes(needle) || (i.donated_by ?? '').toLowerCase().includes(needle)),
    )
  }, [items, filter, q])

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, auction: 0, raffle: 0, stock: 0 }
    for (const i of items ?? []) {
      c.all++
      c[i.kind]++
    }
    return c
  }, [items])

  return (
    <Screen className="space-y-4">
      <div className="pt-1">
        <h1 className="font-display text-2xl font-black text-ink">Scanned items</h1>
        <p className="mt-1 text-sm text-slate-600">Every item with a tag. Tap one to update it.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/staff/scan" className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-brand-orange font-display text-base font-extrabold text-white shadow-sm">
          <Icon name="scan" size={20} /> Scan
        </Link>
        <Link to="/staff/items/tags" className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border-2 border-brand-blue/50 bg-white font-display text-base font-extrabold text-brand-blue">
          <Icon name="printer" size={20} /> Print tags
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', ...ITEM_KINDS] as Filter[]).map((f) => {
          const active = f === filter
          const label = f === 'all' ? 'All' : KIND_META[f].label.replace('Hop Shop ', '')
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`min-h-[44px] rounded-full px-4 text-[15px] font-bold transition ${
                active ? 'bg-brand-blue text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600'
              }`}
            >
              {label} ({counts[f]})
            </button>
          )
        })}
      </div>

      <div className="relative">
        <Icon name="search" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or code"
          aria-label="Search items"
          className="w-full rounded-2xl border-2 border-slate-200 bg-white py-3 pl-11 pr-4 text-base text-ink outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/15"
        />
      </div>

      <ErrorBox>{error}</ErrorBox>
      {items === null && !error && <Spinner />}

      {items && shown.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-base text-slate-500">
          {items.length === 0 ? 'Nothing scanned yet.' : 'Nothing matches.'}
        </div>
      )}

      <ul className="space-y-2.5">
        {shown.map((i) => {
          const m = KIND_META[i.kind]
          const tile = m.tone === 'orange' ? 'bg-brand-orange-50 text-brand-orange' : 'bg-brand-blue-50 text-brand-blue'
          const money = i.kind === 'stock' ? formatMoney(i.price_cents) : formatMoney(i.value_cents)
          return (
            <li key={i.tag_id}>
              <Link
                to={`/staff/scan?code=${encodeURIComponent(i.code)}`}
                className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300"
              >
                {i.photo_url ? (
                  <img src={i.photo_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" loading="lazy" />
                ) : (
                  <span className={`inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-xl ${tile}`}>
                    <Icon name={m.icon} size={28} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[17px] font-extrabold text-ink">{i.title}</span>
                  <span className="mt-0.5 block text-sm text-slate-600">
                    {m.label} · {statusLabel(i)}
                    {money ? ` · ${money}` : ''}
                  </span>
                  <span className="mt-0.5 block font-mono text-xs font-bold tracking-widest text-slate-400">{i.code}</span>
                </span>
                <Icon name="chevron" size={18} className="shrink-0 text-slate-300" />
              </Link>
            </li>
          )
        })}
      </ul>

      {items && items.length > 0 && (
        <BigButton tone="plain" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          Back to top
        </BigButton>
      )}
    </Screen>
  )
}
