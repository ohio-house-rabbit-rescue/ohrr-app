// Items — the hub for everything with a tag.
//
// Redesigned 2026-11-02 (sponsor: "this is hard to read and understand if you are older or not tech
// savvy … the process must flow from decision to a decision or action. Too many options will confuse"):
// the page used to show ~30 choices at once (twelve step buttons, seven tabs, eight chips, three export
// buttons). Now each screen asks ONE question:
//
//   /staff/items                       "What do you need to do?"  five steps, one big card each (+ Find an item)
//   /staff/items?do=bring|label|sell   the two or three choices inside that step
//   /staff/items?show=sort|events|all  one list (Donations to sort · Auction & raffle · Find an item)
//   /staff/items?list=1                the list you were last in (used by "back to the list" from an item)
//
// The list itself keeps its rows, search, basket, "move all" and spreadsheet — each shown only when it
// applies, and the long chip rows are cut to three, then a second row only after "Decided".
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { PERMISSION_CATALOG } from '../../../lib/capabilities'
import { errMessage } from '../../../lib/supabase'
import { Icon, type IconName } from '../../../components/icons'
import { StaffTitle } from '../../../components/StaffTitle'
import { ChoiceCard } from '../../../components/StaffJob'
import { Screen } from '../../../components/ui'
import { Spinner } from '../../../components/staffui'
import ExportButtons from '../../../components/ExportButtons'
import { todayStamp, type SheetSpec } from '../../../lib/inventoryExport'
import { listItems, makeBasket, sortHeadedDonations } from '../api'
import { BigButton, BigInput, ErrorBox } from '../ScanUI'
import { SHEET_COLUMNS, SIMPLE_COLUMNS, sheetRow, simpleRow } from '../itemSheets'
import { HEADED_FOR, KIND_META, donationValues, extrasSummary, formatMoney, headedFor, statusLabel, isUseSoon, type HeadedFor, type TaggedItem } from '../types'

type Show = 'sort' | 'events' | 'all'
/** Donations: not decided yet, decided (all, or by where they're headed), done (basket / rabbits / passed on); 'waiting' = every one not done. */
type Sub = 'waiting' | 'unsure' | 'decided' | HeadedFor | 'done'

const SHOWS: Show[] = ['sort', 'events', 'all']
const DECIDED_PLACES = HEADED_FOR.filter((h) => h.value) as { value: HeadedFor; label: string }[]
const SUB_KEYS: Sub[] = ['waiting', 'unsure', 'decided', 'done', ...DECIDED_PLACES.map((h) => h.value)]

const subMatch = (i: TaggedItem, sub: Sub): boolean => {
  if (sub === 'done') return Boolean(i.outcome)
  if (i.outcome) return false
  if (sub === 'waiting') return true
  if (sub === 'unsure') return !i.headed_for
  if (sub === 'decided') return Boolean(i.headed_for)
  return i.headed_for === sub
}

// The list, sub list and search this visit was on, so coming back from an item opens the same list.
const VIEW_KEY = 'ohrr.items.view.v2'
interface View {
  show: Show
  sub: Sub
  q: string
}
const defaultSub = (show: Show): Sub => (show === 'sort' ? 'unsure' : 'waiting')

function loadView(): View {
  const fallback: View = { show: 'sort', sub: 'unsure', q: '' }
  try {
    const v = JSON.parse(sessionStorage.getItem(VIEW_KEY) ?? 'null') as Partial<View> | null
    if (!v) return fallback
    return {
      show: SHOWS.includes(v.show as Show) ? (v.show as Show) : fallback.show,
      sub: SUB_KEYS.includes(v.sub as Sub) ? (v.sub as Sub) : fallback.sub,
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

interface Counts {
  all: number
  event: number
  s: Record<Sub, number>
  unprinted: number
}

const backLink = '-ml-2 inline-flex min-h-[44px] items-center gap-1 rounded-xl px-2 text-base font-bold text-brand-blue hover:bg-brand-blue-50'

/** The choices inside one step (a step with one choice goes straight there from the first screen). */
interface Choice {
  to: string
  icon: IconName
  title: string
  text: string
  badge?: string
  tone?: 'orange' | 'white'
}
type StepKey = 'bring' | 'label' | 'sell'
const STEP_NAMES: Record<StepKey, { n: number; title: string; lead: string }> = {
  bring: { n: 1, title: 'Bring items in', lead: 'How are the items coming in?' },
  label: { n: 2, title: 'Label them', lead: 'What would you like to do?' },
  sell: { n: 5, title: 'Sell, raffle or use', lead: 'Where are they going?' },
}

function stepChoices(step: StepKey, o: { counts: Counts | null; canSeeVendors: boolean; canCounter: boolean }): Choice[] {
  if (step === 'bring') {
    return [
      { to: '/staff/catalog', icon: 'camera', title: 'Receive items', text: 'One at a time: a photo, the name and where it’s kept. You can put it in a box as you go.', tone: 'orange' },
      { to: '/staff/catalog?box=1', icon: 'box', title: 'Fill boxes quickly', text: 'A pile with no donor: one box after another.' },
      ...(o.canSeeVendors ? [{ to: '/staff/hopshop/suppliers', icon: 'bag' as IconName, title: 'Vendors', text: 'Who we buy from.' }] : []),
    ]
  }
  if (step === 'label') {
    const n = o.counts?.unprinted ?? 0
    return [
      {
        to: '/staff/labels',
        icon: 'printer',
        title: 'Print labels',
        text: o.counts ? (n > 0 ? `${n} item${n === 1 ? '' : 's'} still need a label.` : 'Every item has its label.') : 'Labels for the items you choose.',
        badge: n > 0 ? `${n} to print` : undefined,
        tone: n > 0 ? 'orange' : 'white',
      },
      { to: '/staff/dropoffs', icon: 'mail', title: 'Thank-you letters', text: 'One for each donor’s drop-off.' },
      { to: '/staff/donations/report', icon: 'book', title: 'Donation report', text: 'What came in, and from whom.' },
    ]
  }
  return [
    {
      to: '/staff/items?show=events',
      icon: 'gavel',
      title: 'Auction & raffle',
      text: 'The lots and prizes that have a code.',
      badge: o.counts && o.counts.event > 0 ? String(o.counts.event) : undefined,
    },
    ...(o.canCounter ? [{ to: '/staff/counter', icon: 'bag' as IconName, title: 'Register', text: 'Ring up a sale.' }] : []),
    ...(o.canSeeVendors ? [{ to: '/staff/hopshop', icon: 'store' as IconName, title: 'Hop Shop', text: 'Stock, prices and orders.' }] : []),
  ]
}

export default function ItemsList() {
  const { membership, can } = useAuth()
  const canSeeVendors = PERMISSION_CATALOG.some((p) => p.area === 'Hop Shop' && can(p.key))
  const canCounter = can('counter.use') || can('events.bunfest.manage') || can('hopshop.products.create') || can('hopshop.inventory.update')
  const orgId = membership?.orgId ?? ''
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  // "Saved: Stuffed bunny (DON-00012)" after an edit opened from a list.
  const [saved] = useState<string | null>(() => (location.state as { saved?: string } | null)?.saved ?? null)
  const [items, setItems] = useState<TaggedItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

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
  // Show the "Saved" line once: clear it from history so Back doesn't repeat it.
  useEffect(() => {
    if (!saved) return
    window.scrollTo(0, 0)
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const counts = useMemo<Counts | null>(() => {
    if (!items) return null
    const s: Record<Sub, number> = { waiting: 0, unsure: 0, decided: 0, raffle: 0, auction: 0, event: 0, shop: 0, rabbits: 0, done: 0 }
    let all = 0
    let event = 0
    let unprinted = 0
    for (const i of items) {
      all++
      if (i.kind === 'donation') for (const k of SUB_KEYS) if (subMatch(i, k)) s[k]++
      if (i.kind === 'auction' || i.kind === 'raffle') event++
      if (!i.label_printed_at) unprinted++
    }
    return { all, event, s, unprinted }
  }, [items])

  const ask = params.get('show')
  const restore = params.get('list') === '1'
  const stored = useMemo(() => (restore ? loadView() : null), [restore])
  const show: Show | null = SHOWS.includes(ask as Show) ? (ask as Show) : stored ? stored.show : null
  const step = params.get('do') as StepKey | null

  const banner = saved && (
    <div role="status" className="flex items-center gap-2 rounded-2xl bg-green-50 px-4 py-3 text-base font-bold text-green-900">
      <Icon name="check" size={20} /> Saved: {saved}
    </div>
  )

  if (show) {
    return (
      <ItemsListView
        key={show}
        show={show}
        start={stored && stored.show === show ? stored : null}
        items={items}
        counts={counts}
        error={error}
        setError={setError}
        load={load}
        orgId={orgId}
        banner={banner}
      />
    )
  }

  if (step && step in STEP_NAMES) {
    const info = STEP_NAMES[step]
    const choices = stepChoices(step, { counts, canSeeVendors, canCounter })
    return (
      <Screen className="space-y-4">
        <Link to="/staff/items" className={backLink}>
          <Icon name="arrowLeft" size={20} /> Items
        </Link>
        <div>
          <p className="text-sm font-extrabold uppercase tracking-wide text-slate-500">Step {info.n}</p>
          <h1 className="font-display text-[26px] font-black leading-tight text-ink">{info.title}</h1>
          <p className="mt-1 text-lg text-slate-700">{info.lead}</p>
        </div>
        <ul className="space-y-3">
          {choices.map((c) => (
            <li key={c.to}>
              <ChoiceCard {...c} />
            </li>
          ))}
        </ul>
      </Screen>
    )
  }

  // ---------------------------------------------------------------- the first screen
  const go = (s: StepKey): { to: string } => {
    const c = stepChoices(s, { counts, canSeeVendors, canCounter })
    return { to: c.length === 1 ? c[0].to : `/staff/items?do=${s}` }
  }
  const toDecide = counts?.s.unsure ?? 0
  return (
    <Screen className="space-y-4">
      <StaffTitle title="Items">
        <p>
          Donations, things we buy, auction lots and raffle prizes — everything with a code. Every item goes through the same five steps. Do whichever
          step you need today; a step can wait (receive today, sort another day).
        </p>
        <p>
          <strong>1 Bring items in</strong>: a photo and the name, donated (DON-00042) or bought (PUR-00001), and where it’s kept.{' '}
          <strong>2 Label them</strong>: its label prints, and donors get their thank-you letter. <strong>3 Put them away</strong>: on a shelf or in a
          box. <strong>4 Decide what they’re for</strong>: an event, the Hop Shop or our own use. <strong>5 Sell, raffle or use</strong>: mark it sold,
          won or drawn when it goes.
        </p>
      </StaffTitle>
      {banner}
      <ErrorBox>{error}</ErrorBox>

      <h2 className="font-display text-xl font-extrabold text-ink">What do you need to do?</h2>
      <ol className="space-y-3" aria-label="The steps">
        <li>
          <ChoiceCard n={1} title="Bring items in" text="A donation, or something we bought." tone="orange" {...go('bring')} />
        </li>
        <li>
          <ChoiceCard
            n={2}
            title="Label them"
            text="Print labels and thank-you letters."
            badge={counts && counts.unprinted > 0 ? `${counts.unprinted} to print` : undefined}
            {...go('label')}
          />
        </li>
        <li>
          <ChoiceCard n={3} title="Put them away" text="Boxes, and where things are kept." to="/staff/boxes" />
        </li>
        <li>
          <ChoiceCard
            n={4}
            title="Decide what they’re for"
            text="Raffle, auction, Hop Shop or our own use."
            badge={counts && toDecide > 0 ? `${toDecide} waiting` : undefined}
            to="/staff/items?show=sort"
          />
        </li>
        <li>
          <ChoiceCard n={5} title="Sell, raffle or use" text="Auction and raffle, the Register, the Hop Shop." {...go('sell')} />
        </li>
      </ol>

      <div className="border-t border-slate-200 pt-4">
        <ChoiceCard icon="search" title="Find or scan an item" text="Look it up by name, code or donor." to="/staff/items?show=all" />
      </div>
    </Screen>
  )
}

/* ====================================================================== one list */

function ItemsListView({
  show,
  start,
  items,
  counts,
  error,
  setError,
  load,
  orgId,
  banner,
}: {
  show: Show
  start: View | null
  items: TaggedItem[] | null
  counts: Counts | null
  error: string | null
  setError: (e: string | null) => void
  load: () => Promise<void>
  orgId: string
  banner: React.ReactNode
}) {
  const { can } = useAuth()
  const navigate = useNavigate()
  const filter = show === 'sort' ? 'donation' : show === 'events' ? 'event' : 'all'
  const [sub, setSub] = useState<Sub>(start?.sub ?? defaultSub(show))
  const [q, setQ] = useState(start?.q ?? '')
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  // Basket mode: check donations, name it, raffle or Silent Auction.
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [basket, setBasket] = useState({ title: '', kind: 'raffle' as 'raffle' | 'auction', description: '' })
  const canBasket = can('events.bunfest.manage')
  useEffect(() => saveView({ show, sub, q }), [show, sub, q])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (items ?? []).filter(
      (i) =>
        (filter === 'all' || (filter === 'event' ? i.kind === 'auction' || i.kind === 'raffle' : i.kind === 'donation')) &&
        (filter !== 'donation' || subMatch(i, picking ? 'waiting' : sub)) &&
        (!needle || i.title.toLowerCase().includes(needle) || i.code.toLowerCase().includes(needle) || (i.donated_by ?? '').toLowerCase().includes(needle)),
    )
  }, [items, filter, sub, q, picking])

  const pickedItems = (items ?? []).filter((i) => picked.has(i.code))
  const pickedValue = pickedItems.reduce((sum, i) => sum + (donationValues(i).total ?? 0), 0)
  const n = (k: Sub) => counts?.s[k] ?? 0

  /** Move every donation headed for one place (or mark the rabbits' ones used). */
  const moveAll = async (h: HeadedFor) => {
    const count = n(h)
    const msg =
      h === 'rabbits'
        ? `Mark all ${count} as in use by OHRR?`
        : `Move all ${count} to ${PLACE[h]}?${h === 'shop' ? ' Ones without a price stay hidden from the shop until they’re priced in Hop Shop inventory.' : ''}`
    if (!window.confirm(msg)) return
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
      const next = new Set(p)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
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

  const listName = show === 'sort' ? 'Donations to sort' : show === 'events' ? 'Auction & raffle' : 'Find an item'
  const sheet = (): SheetSpec => {
    const subName = sub === 'unsure' ? 'Needs a decision' : sub === 'decided' ? 'Decided' : sub === 'done' ? 'Done' : (HEADED_FOR.find((h) => h.value === sub)?.label ?? 'Waiting')
    const what = show === 'all' ? 'Everything' : show === 'events' ? 'Auction & raffle' : `Donations — ${subName}`
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

  const movable = show === 'sort' && !picking && (sub === 'raffle' || sub === 'auction' || sub === 'shop' || sub === 'rabbits') && n(sub) > 0
  // The first row of chips: three choices. "Decided" opens a second row for where each one is going.
  const top: 'unsure' | 'decided' | 'done' = sub === 'unsure' ? 'unsure' : sub === 'done' ? 'done' : 'decided'
  const chip = (active: boolean, orange = false) =>
    `min-h-[44px] rounded-full px-4 text-[15px] font-bold transition ${
      active ? (orange ? 'bg-brand-orange text-ink shadow-sm' : 'bg-brand-blue text-white shadow-sm') : 'border border-slate-200 bg-white text-slate-600'
    }`

  return (
    <Screen className="space-y-4">
      <Link to="/staff/items" className={backLink}>
        <Icon name="arrowLeft" size={20} /> Items
      </Link>
      <StaffTitle
        title={listName}
        actions={
          <Link to="/staff/scan" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-brand-blue px-4 text-[15px] font-bold text-white shadow-sm">
            <Icon name="scan" size={18} /> Scan
          </Link>
        }
      >
        {show === 'sort' && (
          <p>
            Tap a donation to decide what it’s for. When several are going to the same place, choose the place and move them all at once. A basket puts
            several donations together as one raffle prize or auction lot.
          </p>
        )}
        {show === 'events' && <p>The auction lots and raffle prizes that have a code. Tap one to update it.</p>}
        {show === 'all' && <p>Everything with a code. Type a name, code or donor to find it, or tap Scan and point the camera at its tag.</p>}
      </StaffTitle>
      {banner}

      {show === 'sort' && !picking && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Which donations">
            <button type="button" onClick={() => setSub('unsure')} aria-pressed={top === 'unsure'} className={chip(top === 'unsure')}>
              Needs a decision ({n('unsure')})
            </button>
            <button type="button" onClick={() => setSub('decided')} aria-pressed={top === 'decided'} className={chip(top === 'decided')}>
              Decided ({n('decided')})
            </button>
            <button type="button" onClick={() => setSub('done')} aria-pressed={top === 'done'} className={chip(top === 'done')}>
              Done ({n('done')})
            </button>
          </div>
          {top === 'decided' && (
            <div>
              <p className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Going to</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Where they are going">
                <button type="button" onClick={() => setSub('decided')} aria-pressed={sub === 'decided'} className={chip(sub === 'decided', true)}>
                  All ({n('decided')})
                </button>
                {DECIDED_PLACES.filter((h) => n(h.value) > 0).map((h) => (
                  <button key={h.value} type="button" onClick={() => setSub(h.value)} aria-pressed={sub === h.value} className={chip(sub === h.value, true)}>
                    {h.label} ({n(h.value)})
                  </button>
                ))}
              </div>
            </div>
          )}
          {movable && (
            <BigButton tone="orange" icon="check" disabled={busy} onClick={() => void moveAll(sub as HeadedFor)}>
              {sub === 'rabbits' ? `Mark all ${n('rabbits')} as in use by OHRR` : `Move all ${n(sub)} to ${PLACE[sub as HeadedFor]}`}
            </BigButton>
          )}
          {canBasket && n('waiting') > 0 && top !== 'done' && (
            <button type="button" onClick={() => setPicking(true)} className="inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-bold text-brand-blue">
              <Icon name="gift" size={18} /> Make a basket from several donations
            </button>
          )}
        </div>
      )}

      {picking && (
        <div className="space-y-3 rounded-2xl border-2 border-brand-orange bg-brand-orange-50 p-4">
          <p className="font-display text-lg font-black text-ink">Make a basket</p>
          <p className="text-[15px] text-slate-700">
            Check what goes in it below. {picked.size} picked
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
          {items.length === 0
            ? 'Nothing added yet.'
            : q.trim()
              ? 'Nothing matches that.'
              : show === 'sort' && sub === 'unsure'
                ? 'Nothing is waiting for a decision.'
                : show === 'sort' && sub === 'done'
                  ? 'Nothing is done yet.'
                  : show === 'sort' && sub !== 'waiting'
                    ? `Nothing ${sub === 'decided' ? 'decided yet' : `headed for ${headedFor(sub)}`}.`
                    : 'Nothing here.'}
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


      {items && shown.length > 0 && !picking && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setExportOpen((o) => !o)}
            aria-expanded={exportOpen}
            className="inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-bold text-brand-blue"
          >
            <Icon name="file" size={18} /> Print or save this list ({shown.length})
          </button>
          {exportOpen && <ExportButtons spec={sheet} label={`Full spreadsheet of ${shown.length}`} simple={simpleSheet} />}
        </div>
      )}

      {items && items.length > 0 && (
        <BigButton tone="plain" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          Back to top
        </BigButton>
      )}
    </Screen>
  )
}
