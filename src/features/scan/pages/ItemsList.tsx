// Everything that has a tag, newest first — filter by kind, search by name or
// code, tap a row to open it in the scan flow (same big buttons as scanning it).
//
// Donations (update 40): filter by where they're headed, move all the ones
// headed for the raffle / Silent Auction / Hop Shop in one go, mark all the
// "for the rabbits" ones used, and put several into one basket (a raffle
// prize or auction lot). Shop items live in Hop Shop inventory.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { Icon } from '../../../components/icons'
import { Screen } from '../../../components/ui'
import { Spinner } from '../../../components/staffui'
import { listItems, makeBasket, sortHeadedDonations } from '../api'
import { BigButton, BigInput, ErrorBox } from '../ScanUI'
import {
  HEADED_FOR,
  ITEM_KINDS,
  KIND_META,
  donationValues,
  extrasSummary,
  formatMoney,
  headedFor,
  statusLabel,
  isUseSoon,
  type HeadedFor,
  type ItemKind,
  type TaggedItem,
} from '../types'

type Filter = 'all' | 'event' | ItemKind
/** Donations: waiting (all, or by where they're headed), or done (basket / rabbits / passed on). */
type Sub = 'waiting' | 'unsure' | HeadedFor | 'done'

const SUBS: { key: Sub; label: string }[] = [
  { key: 'waiting', label: 'All waiting' },
  ...HEADED_FOR.map((h) => ({ key: (h.value || 'unsure') as Sub, label: h.label })),
  { key: 'done', label: 'Done' },
]

const subMatch = (i: TaggedItem, sub: Sub): boolean => {
  if (sub === 'done') return Boolean(i.outcome)
  if (i.outcome) return false
  if (sub === 'waiting') return true
  if (sub === 'unsure') return !i.headed_for
  return i.headed_for === sub
}

const PLACE: Record<HeadedFor, string> = { raffle: 'the raffle', auction: 'the Silent Auction', shop: 'the Hop Shop', rabbits: 'the rabbits' }

export default function ItemsList() {
  const { membership, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const navigate = useNavigate()
  const [items, setItems] = useState<TaggedItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  // Opens on the donations waiting to be sorted; stock is Hop Shop inventory's screen.
  const [filter, setFilter] = useState<Filter>('donation')
  const [sub, setSub] = useState<Sub>('waiting')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  // Basket mode: tick donations, name it, raffle or Silent Auction.
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [basket, setBasket] = useState({ title: '', kind: 'raffle' as 'raffle' | 'auction', description: '' })
  const canBasket = can('events.bunfest.manage')

  const load = useCallback(async () => {
    if (!orgId) return
    try {
      setItems(await listItems(orgId))
    } catch (e) {
      setError(errMessage(e))
    }
  }, [orgId])
  useEffect(() => {
    void load()
  }, [load])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (items ?? []).filter(
      (i) =>
        (filter === 'all' || (filter === 'event' ? i.kind === 'auction' || i.kind === 'raffle' : i.kind === filter)) &&
        (filter !== 'donation' || subMatch(i, picking ? 'waiting' : sub)) &&
        (!needle || i.title.toLowerCase().includes(needle) || i.code.toLowerCase().includes(needle) || (i.donated_by ?? '').toLowerCase().includes(needle)),
    )
  }, [items, filter, sub, q, picking])

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, event: 0, auction: 0, raffle: 0, stock: 0, donation: 0 }
    const s: Record<Sub, number> = { waiting: 0, unsure: 0, raffle: 0, auction: 0, shop: 0, rabbits: 0, done: 0 }
    for (const i of items ?? []) {
      c.all++
      if (i.kind === 'donation') {
        if (!i.outcome) c.donation++
        for (const k of Object.keys(s) as Sub[]) if (subMatch(i, k)) s[k]++
      } else c[i.kind]++
      if (i.kind === 'auction' || i.kind === 'raffle') c.event++
    }
    return { c, s }
  }, [items])

  const pickedItems = (items ?? []).filter((i) => picked.has(i.code))
  const pickedValue = pickedItems.reduce((sum, i) => sum + (donationValues(i).total ?? 0), 0)

  /** Move every donation headed for one place (or mark the rabbits' ones used). */
  const moveAll = async (h: HeadedFor) => {
    const n = counts.s[h]
    const ask =
      h === 'rabbits'
        ? `Mark all ${n} as used for the rabbits?`
        : `Move all ${n} to ${PLACE[h]}?${h === 'shop' ? ' Ones without a price stay hidden from the shop until they’re priced in Hop Shop inventory.' : ''}`
    if (!window.confirm(ask)) return
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      const moved = await sortHeadedDonations(orgId, h)
      setNote(h === 'rabbits' ? `${moved} marked as used for the rabbits.` : `${moved} moved to ${PLACE[h]}.`)
      await load()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const togglePick = (code: string) =>
    setPicked((p) => {
      const n = new Set(p)
      if (n.has(code)) n.delete(code)
      else n.add(code)
      return n
    })

  const makeIt = async () => {
    if (!basket.title.trim() || picked.size === 0) return
    setBusy(true)
    setError(null)
    try {
      const b = await makeBasket(orgId, [...picked], basket.kind, basket.title, basket.description)
      navigate(`/staff/scan?code=${encodeURIComponent(b.code)}`)
    } catch (e) {
      setError(errMessage(e))
      setBusy(false)
    }
  }

  const stopPicking = () => {
    setPicking(false)
    setPicked(new Set())
  }

  const movable = filter === 'donation' && !picking && (sub === 'raffle' || sub === 'auction' || sub === 'shop' || sub === 'rabbits') && counts.s[sub] > 0

  return (
    <Screen className="space-y-4">
      <div className="pt-1">
        <h1 className="font-display text-2xl font-black text-ink">Items</h1>
        <p className="mt-1 text-sm text-slate-600">
          Donations to sort, auction lots and raffle prizes with a code. Tap one to update it or decide where it goes. Things the shop carries live in{' '}
          <Link to="/staff/hopshop" className="font-bold text-brand-blue">
            Hop Shop inventory
          </Link>
          .
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/staff/catalog" className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-brand-orange font-display text-base font-extrabold text-ink shadow-sm">
          <Icon name="camera" size={20} /> Add a donation
        </Link>
        <Link to="/staff/scan" className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-brand-blue font-display text-base font-extrabold text-white shadow-sm">
          <Icon name="scan" size={20} /> Scan
        </Link>
        <Link to="/staff/dropoffs" className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border-2 border-brand-blue/50 bg-white px-2 text-center font-display text-base font-extrabold text-brand-blue">
          <Icon name="mail" size={20} /> Drop-offs & thank-yous
        </Link>
        <Link to="/staff/donations/report" className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border-2 border-brand-blue/50 bg-white px-2 text-center font-display text-base font-extrabold text-brand-blue">
          <Icon name="book" size={20} /> Monthly report
        </Link>
        <Link to="/staff/labels" className="col-span-2 inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white font-display text-base font-extrabold text-slate-600">
          <Icon name="printer" size={20} /> Print labels
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['donation', 'event', ...ITEM_KINDS, 'all'] as Filter[]).map((f) => {
          const active = f === filter
          const label =
            f === 'all' ? 'Everything' : f === 'event' ? 'Auction & raffle' : f === 'donation' ? 'Donations to sort' : KIND_META[f].label.replace('Hop Shop ', '')
          return (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFilter(f)
                stopPicking()
              }}
              aria-pressed={active}
              className={`min-h-[44px] rounded-full px-4 text-[15px] font-bold transition ${
                active ? 'bg-brand-blue text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600'
              }`}
            >
              {label} ({counts.c[f]})
            </button>
          )
        })}
      </div>

      {filter === 'donation' && !picking && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <p className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Where they’re headed</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Where they are headed">
            {SUBS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSub(s.key)}
                aria-pressed={sub === s.key}
                className={`min-h-[44px] rounded-full px-3.5 text-[15px] font-bold transition ${
                  sub === s.key ? 'bg-brand-orange text-ink shadow-sm' : 'border border-slate-200 bg-white text-slate-600'
                }`}
              >
                {s.label} ({counts.s[s.key]})
              </button>
            ))}
          </div>
          {movable && (
            <div className="mt-3">
              <BigButton tone="orange" icon="check" disabled={busy} onClick={() => void moveAll(sub as HeadedFor)}>
                {sub === 'rabbits' ? `Mark all ${counts.s.rabbits} as used for the rabbits` : `Move all ${counts.s[sub]} to ${PLACE[sub as HeadedFor]}`}
              </BigButton>
            </div>
          )}
          {canBasket && counts.s.waiting > 0 && (
            <button type="button" onClick={() => setPicking(true)} className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-bold text-brand-blue">
              <Icon name="gift" size={18} /> Make a basket from several donations
            </button>
          )}
        </div>
      )}

      {picking && (
        <div className="space-y-3 rounded-2xl border-2 border-brand-orange bg-brand-orange-50 p-4">
          <p className="font-display text-lg font-black text-ink">Make a basket</p>
          <p className="text-[15px] text-slate-700">
            Tick what goes in it below. {picked.size} picked
            {pickedValue > 0 ? ` · worth ${formatMoney(pickedValue)} together` : ''}.
          </p>
          <BigInput value={basket.title} onChange={(v) => setBasket((b) => ({ ...b, title: v }))} placeholder="Bunny spa basket" ariaLabel="Name of the basket" />
          <div className="flex flex-wrap gap-2" role="group" aria-label="The basket goes in">
            {(['raffle', 'auction'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setBasket((b) => ({ ...b, kind: k }))}
                aria-pressed={basket.kind === k}
                className={`min-h-[44px] rounded-full px-4 text-[15px] font-bold transition ${
                  basket.kind === k ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600'
                }`}
              >
                {k === 'raffle' ? 'Raffle prize' : 'Silent Auction lot'}
              </button>
            ))}
          </div>
          <BigInput value={basket.description} onChange={(v) => setBasket((b) => ({ ...b, description: v }))} placeholder="A line about it (optional)" ariaLabel="About the basket" />
          <div className="grid grid-cols-2 gap-2">
            <BigButton icon="check" disabled={busy || picked.size === 0 || !basket.title.trim()} onClick={() => void makeIt()}>
              Make the basket
            </BigButton>
            <BigButton tone="plain" onClick={stopPicking}>
              Cancel
            </BigButton>
          </div>
        </div>
      )}

      <div className="relative">
        <Icon name="search" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, code or donor"
          aria-label="Search items"
          className="w-full rounded-2xl border-2 border-slate-200 bg-white py-3 pl-11 pr-4 text-base text-ink outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/15"
        />
      </div>

      <ErrorBox>{error}</ErrorBox>
      {note && (
        <div role="status" className="rounded-2xl bg-green-50 px-4 py-3 text-[15px] text-green-900">
          {note}
        </div>
      )}
      {items === null && !error && <Spinner />}

      {items && shown.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-base text-slate-500">
          {items.length === 0 ? 'Nothing added yet.' : 'Nothing here.'}
        </div>
      )}

      <ul className="space-y-2.5">
        {shown.map((i) => {
          const m = KIND_META[i.kind]
          const tile = m.tone === 'orange' ? 'bg-brand-orange-50 text-brand-orange' : 'bg-brand-blue-50 text-brand-blue'
          const money = i.kind === 'stock' ? formatMoney(i.price_cents) : i.kind === 'donation' ? '' : formatMoney(i.value_cents)
          const soon = i.kind === 'donation' && !i.outcome && isUseSoon(i.use_by)
          const on = picked.has(i.code)
          const body = (
            <>
              {picking && (
                <span
                  aria-hidden="true"
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 ${on ? 'border-brand-blue bg-brand-blue text-white' : 'border-slate-300 bg-white'}`}
                >
                  {on && <Icon name="check" size={18} />}
                </span>
              )}
              {i.photo_url ? (
                <img src={i.photo_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" loading="lazy" />
              ) : (
                <span className={`inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-xl ${tile}`}>
                  <Icon name={m.icon} size={28} />
                </span>
              )}
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate font-display text-[17px] font-extrabold text-ink">{i.title}</span>
                <span className="mt-0.5 block text-sm text-slate-600">
                  {i.kind === 'donation' ? statusLabel(i) : `${m.label} · ${statusLabel(i)}`}
                  {money ? ` · ${money}` : ''}
                  {i.kind !== 'donation' && i.contents && i.contents.length > 0 ? ` · basket of ${i.contents.length}` : ''}
                </span>
                {extrasSummary(i) && <span className="mt-0.5 block truncate text-sm text-slate-500">{extrasSummary(i)}</span>}
                <span className="mt-0.5 flex items-center gap-2">
                  <span className="font-mono text-xs font-bold tracking-widest text-slate-400">{i.code}</span>
                  {soon && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-extrabold text-amber-900">Use soon</span>}
                </span>
              </span>
              {!picking && <Icon name="chevron" size={18} className="shrink-0 text-slate-300" />}
            </>
          )
          const row = 'flex w-full items-center gap-3.5 rounded-2xl border bg-white p-3 shadow-sm transition'
          return (
            <li key={i.tag_id}>
              {picking ? (
                <button
                  type="button"
                  onClick={() => togglePick(i.code)}
                  aria-pressed={on}
                  aria-label={`${on ? 'Take out' : 'Put in'}: ${i.title}`}
                  className={`${row} ${on ? 'border-brand-blue ring-2 ring-brand-blue/30' : 'border-slate-200'}`}
                >
                  {body}
                </button>
              ) : (
                <Link to={`/staff/scan?code=${encodeURIComponent(i.code)}`} className={`${row} border-slate-200 hover:border-slate-300`}>
                  {body}
                </Link>
              )}
            </li>
          )
        })}
      </ul>

      {filter === 'donation' && sub !== 'waiting' && !picking && counts.s[sub] === 0 && items && items.length > 0 && (
        <p className="text-center text-[15px] text-slate-500">
          Nothing {sub === 'done' ? 'done yet' : sub === 'unsure' ? 'without a plan' : `headed for ${headedFor(sub)}`}.
        </p>
      )}

      {items && items.length > 0 && (
        <BigButton tone="plain" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          Back to top
        </BigButton>
      )}
    </Screen>
  )
}
