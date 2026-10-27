// Everything that has a tag, newest first — filter by kind, search by name or
// code, tap a row to open it in the scan flow (same big buttons as scanning it).
//
// Donations (update 40): filter by where they're headed, move all the ones
// headed for the raffle / Silent Auction / Hop Shop in one go, mark all the
// "for the rabbits" ones used, and put several into one basket (a raffle
// prize or auction lot). Shop items live in Hop Shop inventory.
//
// "Spreadsheet with photos" (2026-10-24): what the list shows, as an Excel file
// with a picture in each row, to email from the phone or save; or a CSV.
//
// An item opened from here carries ?back=items: once its edit is saved the
// scan flow comes back here with "Saved: …" at the top, and the list opens
// on the same tab, filter and search it was left on (kept for this visit).
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { PERMISSION_CATALOG } from '../../../lib/capabilities'
import { errMessage } from '../../../lib/supabase'
import { Icon } from '../../../components/icons'
import { StaffTitle } from '../../../components/StaffTitle'
import { Screen } from '../../../components/ui'
import { Spinner } from '../../../components/staffui'
import ExportButtons from '../../../components/ExportButtons'
import { todayStamp, type SheetSpec } from '../../../lib/inventoryExport'
import { listItems, makeBasket, sortHeadedDonations } from '../api'
import { BigButton, BigInput, ErrorBox } from '../ScanUI'
import { SHEET_COLUMNS, SIMPLE_COLUMNS, sheetRow, simpleRow } from '../itemSheets'
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

// The tab, sub tab and search this visit was on, so coming back from an item
// opens the same list.
const VIEW_KEY = 'ohrr.items.view.v1'
interface View {
  filter: Filter
  sub: Sub
  q: string
}

function loadView(): View {
  const fallback: View = { filter: 'donation', sub: 'waiting', q: '' }
  try {
    const v = JSON.parse(sessionStorage.getItem(VIEW_KEY) ?? 'null') as Partial<View> | null
    if (!v) return fallback
    const filters: Filter[] = ['donation', 'event', ...ITEM_KINDS, 'all']
    return {
      filter: filters.includes(v.filter as Filter) ? (v.filter as Filter) : fallback.filter,
      sub: SUBS.some((x) => x.key === v.sub) ? (v.sub as Sub) : fallback.sub,
      q: typeof v.q === 'string' ? v.q : '',
    }
  } catch {
    return fallback
  }
}

function saveView(v: View) {
  try {
    sessionStorage.setItem(VIEW_KEY, JSON.stringify(v))
  } catch {
    /* private mode */
  }
}

const PLACE: Record<HeadedFor, string> = { raffle: 'the raffle', auction: 'the Silent Auction', shop: 'the Hop Shop', rabbits: 'our own use', event: 'the event' }

/** One step of the five, with its buttons beside it. */
function StepRow({ n, name, children }: { n: number; name: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      <span className="mt-2.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-blue text-[13px] font-extrabold text-white">{n}</span>
      <div className="min-w-0 flex-1">
        <p className="pt-2.5 text-[15px] font-extrabold leading-none text-ink">{name}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">{children}</div>
      </div>
    </li>
  )
}

export default function ItemsList() {
  const { membership, can } = useAuth()
  const canSeeVendors = PERMISSION_CATALOG.some((p) => p.area === 'Hop Shop' && can(p.key))
  const canCounter = can('counter.use') || can('events.bunfest.manage') || can('hopshop.products.create') || can('hopshop.inventory.update')
  const orgId = membership?.orgId ?? ''
  const navigate = useNavigate()
  const location = useLocation()
  // "Saved: Stuffed bunny (DON-00012)" after an edit opened from this list.
  const [saved] = useState<string | null>(() => (location.state as { saved?: string } | null)?.saved ?? null)
  const [view] = useState(loadView)
  const [items, setItems] = useState<TaggedItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  // Opens on the donations waiting to be sorted; stock is Hop Shop inventory's screen.
  const [filter, setFilter] = useState<Filter>(view.filter)
  const [sub, setSub] = useState<Sub>(view.sub)
  const [q, setQ] = useState(view.q)
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
  useEffect(() => saveView({ filter, sub, q }), [filter, sub, q])
  // Show the "Saved" line once: clear it from history so Back doesn't repeat it.
  useEffect(() => {
    if (!saved) return
    window.scrollTo(0, 0)
    navigate('.', { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    const s: Record<Sub, number> = { waiting: 0, unsure: 0, raffle: 0, auction: 0, event: 0, shop: 0, rabbits: 0, done: 0 }
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
        ? `Mark all ${n} as in use by OHRR?`
        : `Move all ${n} to ${PLACE[h]}?${h === 'shop' ? ' Ones without a price stay hidden from the shop until they’re priced in Hop Shop inventory.' : ''}`
    if (!window.confirm(ask)) return
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      const moved = await sortHeadedDonations(orgId, h)
      setNote(h === 'rabbits' ? `${moved} marked as in use by OHRR.` : `${moved} moved to ${PLACE[h]}.`)
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

  const sheet = (): SheetSpec => {
    const what =
      filter === 'all'
        ? 'Everything'
        : filter === 'event'
          ? 'Auction & raffle'
          : filter === 'donation'
            ? `Donations — ${SUBS.find((s) => s.key === sub)?.label ?? ''}`
            : KIND_META[filter].label
    const made = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return {
      filename: `ohrr-items-${filter}-${todayStamp()}`,
      sheetName: 'Items',
      title: `Ohio House Rabbit Rescue — items: ${what}${q.trim() ? ` matching “${q.trim()}”` : ''} · ${shown.length} · ${made}`,
      columns: SHEET_COLUMNS,
      rows: shown.map(sheetRow),
    }
  }
  const simpleSheet = (): SheetSpec => {
    const full = sheet()
    return { ...full, filename: full.filename.replace('ohrr-items-', 'ohrr-items-list-'), columns: SIMPLE_COLUMNS, rows: shown.map(simpleRow), layout: 'print' }
  }

  // Steps 4 and 5 open their tab of the list and scroll to it.
  const goTo = (f: Filter) => {
    setFilter(f)
    if (f === 'donation') setSub('waiting')
    stopPicking()
    requestAnimationFrame(() => document.getElementById('item-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const movable = filter === 'donation' && !picking && (sub === 'raffle' || sub === 'auction' || sub === 'shop' || sub === 'rabbits') && counts.s[sub] > 0

  return (
    <Screen className="space-y-4">
      <StaffTitle
        title="Items"
        actions={
          <Link to="/staff/scan" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-brand-blue px-4 text-[15px] font-bold text-white shadow-sm">
            <Icon name="scan" size={18} /> Scan
          </Link>
        }
      >
        <p>
          Donations to sort, auction lots and raffle prizes with a code. Tap one to update it or decide what it’s for. Things the shop carries live in{' '}
          <Link to="/staff/hopshop" className="font-bold text-brand-blue">
            Hop Shop inventory
          </Link>
          .
        </p>
        <p>
          Every item goes through five steps, each with its own buttons below. <strong>1 Receive</strong>: a photo and the name, donated (DON-00042) or
          bought (PUR-00001), and where it’s kept. <strong>2 Label</strong>: its label prints, and donors get their thank-you letter.{' '}
          <strong>3 Put away</strong>: on its shelf or in a box. <strong>4 Sort by use</strong>: what it’s for — an event, the Hop Shop or our own use.{' '}
          <strong>5 Sell, raffle or use</strong>: mark it sold, won or drawn when it goes. A step can wait — receive today, sort another day.
        </p>
      </StaffTitle>

      {saved && (
        <div role="status" className="flex items-center gap-2 rounded-2xl bg-green-50 px-4 py-3 text-base font-bold text-green-900">
          <Icon name="check" size={20} /> Saved: {saved}
        </div>
      )}

      {/* OHRR 2026-10-27: "I see step one and I see step two, but what I don't see is 3, 4, and 5 in your process … people look for 3, 4, and 5". Each step is a row with its own buttons. */}
      <ol className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white" aria-label="How an item moves through OHRR">
        <StepRow n={1} name="Receive">
          <Link to="/staff/catalog" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-brand-orange px-4 text-[15px] font-extrabold text-ink shadow-sm">
            <Icon name="camera" size={18} /> Receive items
          </Link>
          <Link to="/staff/catalog?box=1" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-[15px] font-bold text-slate-700">
            <Icon name="box" size={17} /> Into boxes
          </Link>
          {/* Sponsor (2026-10-27): "where is the vendor potion for things tht we buy … i dont see it on the page of items and hop shop". */}
          {canSeeVendors && (
            <Link to="/staff/hopshop/suppliers" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-[15px] font-bold text-slate-700">
              <Icon name="bag" size={17} /> Vendors
            </Link>
          )}
        </StepRow>
        <StepRow n={2} name="Label">
          <Link to="/staff/labels" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-[15px] font-bold text-slate-700">
            <Icon name="printer" size={17} /> Print labels
          </Link>
          <Link to="/staff/dropoffs" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-[15px] font-bold text-slate-700">
            <Icon name="mail" size={17} /> Thank-you letters
          </Link>
          <Link to="/staff/donations/report" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-[15px] font-bold text-slate-700">
            <Icon name="book" size={17} /> Report
          </Link>
        </StepRow>
        <StepRow n={3} name="Put away">
          <Link to="/staff/boxes" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-[15px] font-bold text-slate-700">
            <Icon name="box" size={17} /> Boxes
          </Link>
          <span className="text-sm text-slate-500">Where it’s kept shows on each item.</span>
        </StepRow>
        <StepRow n={4} name="Sort by use">
          <button type="button" onClick={() => goTo('donation')} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-[15px] font-bold text-slate-700">
            <Icon name="check" size={17} /> Donations to sort ({counts.c.donation})
          </button>
        </StepRow>
        <StepRow n={5} name="Sell, raffle or use">
          <button type="button" onClick={() => goTo('event')} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-[15px] font-bold text-slate-700">
            <Icon name="gavel" size={17} /> Auction &amp; raffle ({counts.c.event})
          </button>
          {canCounter && (
            <Link to="/staff/counter" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-[15px] font-bold text-slate-700">
              <Icon name="bag" size={17} /> Counter
            </Link>
          )}
          {canSeeVendors && (
            <Link to="/staff/hopshop" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-[15px] font-bold text-slate-700">
              <Icon name="store" size={17} /> Hop Shop
            </Link>
          )}
        </StepRow>
      </ol>

      <div id="item-tabs" className="-mx-5 flex scroll-mt-20 gap-2 overflow-x-auto px-5 pb-1" role="group" aria-label="Which items">
        {(['donation', 'event', ...ITEM_KINDS, 'all'] as Filter[]).map((f) => {
          const active = f === filter
          const label =
            f === 'all' ? 'Everything' : f === 'event' ? 'Auction & raffle' : f === 'donation' ? 'Donations to sort' : f === 'stock' ? 'Shop stock' : KIND_META[f].label
          return (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFilter(f)
                stopPicking()
              }}
              aria-pressed={active}
              className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-full px-4 text-[15px] font-bold transition ${
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
          <p className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">What they’re for</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="What they are for">
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
                {sub === 'rabbits' ? `Mark all ${counts.s.rabbits} as in use by OHRR` : `Move all ${counts.s[sub]} to ${PLACE[sub as HeadedFor]}`}
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

      {items && shown.length > 0 && !picking && <ExportButtons spec={sheet} label={`Full spreadsheet of ${shown.length}`} simple={simpleSheet} />}

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
                <Link to={`/staff/scan?code=${encodeURIComponent(i.code)}&back=items`} className={`${row} border-slate-200 hover:border-slate-300`}>
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
