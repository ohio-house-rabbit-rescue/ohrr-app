// Items as a spreadsheet (OHRR 2026-11-21: "from a computer I want to look at the whole list of items in a
// spreadsheet format and make changes versus opening each donated item … change a name, quantity, then hit
// save and never have to download the list to do so").
//
// One row per donation, every cell a box. Change what you like, then "Save changes": only the rows and
// cells you changed are written, each row on its own, using the same calls as editing one item (no new
// database update). The list can be filtered and searched, and the same list can be downloaded or printed.
// The rules for a row's save live in ../sheetSave.ts (tested with stubbed calls).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { Icon } from '../../../components/icons'
import { StaffTitle } from '../../../components/StaffTitle'
import { Screen } from '../../../components/ui'
import { Spinner } from '../../../components/staffui'
import ExportButtons from '../../../components/ExportButtons'
import { todayStamp, type SheetSpec } from '../../../lib/inventoryExport'
import { catalogSuggestions, findByCode, getItemBackup, listItemBackups, listItems, markLabelsPrinted, restoreItemBackup, saveItem, setDonationPlan, setItemExtras, takeItemsBackup, type CatalogSuggestions } from '../api'
import { tellOthersLabelsChanged } from '../labelSync'
import { SHEET_COLUMNS, SIMPLE_COLUMNS, sheetRow, simpleRow } from '../itemSheets'
import { centsToDollars, draftFromItem, statusLabel, type TaggedItem } from '../types'
import SheetGrid, { type RowStatus } from '../SheetGrid'
import SheetBackups, { type BackupApi } from '../SheetBackups'
import { itemsReportPdf, type ReportField } from '../itemsReportPdf'
import ReportFieldPicker, { loadReportFields } from '../ReportFieldPicker'
import { cellsFromItem, changedKeys, firstProblem, saveRow, withEdits, type CellKey, type SheetCells, type SheetDeps } from '../sheetSave'

type Show = 'waiting' | 'unsure' | 'done' | 'all'
type Order = 'newest' | 'oldest' | 'name'
const SHOWS: { key: Show; label: string }[] = [
  { key: 'waiting', label: 'Waiting to be sorted' },
  { key: 'unsure', label: 'Not sure yet' },
  { key: 'done', label: 'Done' },
  { key: 'all', label: 'All donations' },
]
const ORDERS: { key: Order; label: string }[] = [
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'name', label: 'A to Z' },
]
/** Rows drawn at once: a long list stays quick. Search and the filters narrow it. */
const PAGE = 300

const entered = (i: TaggedItem): number => {
  const t = (i.received_on ? new Date(`${i.received_on.slice(0, 10)}T00:00:00`) : new Date(i.created_at)).getTime()
  return Number.isNaN(t) ? 0 : t
}
const inShow = (i: TaggedItem, show: Show): boolean =>
  show === 'all' ? true : show === 'done' ? Boolean(i.outcome) : !i.outcome && (show === 'waiting' || !i.headed_for)

const pill = 'inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border px-4 text-[15px] font-bold disabled:opacity-50'
const field = 'min-h-[44px] rounded-xl border-2 border-slate-200 bg-white px-3 text-[15px] text-ink outline-none focus:border-brand-blue'

export default function ItemsSheet() {
  const { membership, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const canEdit = can('events.bunfest.manage') || can('hopshop.products.create') || can('hopshop.products.edit') || can('hopshop.inventory.update')
  const [items, setItems] = useState<TaggedItem[] | null>(null)
  /** Every item of every kind, only to tell "deleted" from "sorted into the raffle" in the backups. */
  const [everything, setEverything] = useState<TaggedItem[]>([])
  /** What the PDF report shows on each line (remembered on this computer). */
  const [pdfFields, setPdfFields] = useState<ReportField[]>(loadReportFields)
  const [showBackups, setShowBackups] = useState(false)
  const [backupMade, setBackupMade] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, Partial<SheetCells>>>({})
  const [results, setResults] = useState<Record<string, RowStatus>>({})
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [show, setShow] = useState<Show>('waiting')
  const [order, setOrder] = useState<Order>('newest')
  const [limit, setLimit] = useState(PAGE)
  const [suggest, setSuggest] = useState<CatalogSuggestions>({ locations: [], categories: [], stores: [] })

  const load = useCallback(async () => {
    if (!orgId) return
    setError(null)
    try {
      const all = await listItems(orgId)
      setEverything(all)
      setItems(all.filter((i) => i.kind === 'donation'))
    } catch (e) {
      setError(errMessage(e))
    }
  }, [orgId])
  useEffect(() => {
    void load()
  }, [load])
  // The first time this list is opened on a day, today's backup is saved (it never gets in the way if it can't be).
  useEffect(() => {
    if (!orgId || !canEdit) return
    let alive = true
    void takeItemsBackup(orgId).then((r) => alive && setBackupMade(r.made))
    return () => {
      alive = false
    }
  }, [orgId, canEdit])
  const backupApi = useMemo<BackupApi>(
    () => ({
      list: () => listItemBackups(orgId),
      get: (id) => getItemBackup(orgId, id),
      restore: (id, codes) => restoreItemBackup(orgId, id, codes),
    }),
    [orgId],
  )
  useEffect(() => {
    if (!orgId) return
    let alive = true
    void catalogSuggestions(orgId).then((s) => alive && setSuggest(s))
    return () => {
      alive = false
    }
  }, [orgId])

  const byCode = useMemo(() => new Map((items ?? []).map((i) => [i.code, i])), [items])

  /** The codes with an unsaved change (a cell back at its saved value doesn't count). */
  const dirty = useMemo(() => {
    const out: string[] = []
    for (const [code, e] of Object.entries(edits)) {
      const it = byCode.get(code)
      if (!it) continue
      const base = cellsFromItem(it)
      if (changedKeys(base, withEdits(base, e), it.source === 'purchase').length) out.push(code)
    }
    return out
  }, [edits, byCode])
  const problems = useMemo(() => {
    let n = 0
    for (const code of dirty) {
      const it = byCode.get(code)!
      const base = cellsFromItem(it)
      const now = withEdits(base, edits[code])
      if (firstProblem(changedKeys(base, now, it.source === 'purchase'), now)) n++
    }
    return n
  }, [dirty, edits, byCode])

  // Leaving with unsaved changes (closing the tab, reloading, or following a link) asks first.
  useEffect(() => {
    if (!dirty.length) return
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    const onClick = (e: MouseEvent) => {
      // A link to another page, or the header's Back button (marked data-leave-guard).
      const el = (e.target as HTMLElement | null)?.closest?.('a[href], [data-leave-guard]') as HTMLElement | null
      if (!el) return
      if (el instanceof HTMLAnchorElement && !el.hasAttribute('data-leave-guard') && (el.target === '_blank' || el.origin !== window.location.origin)) return
      if (!window.confirm(`You have ${dirty.length} unsaved change${dirty.length === 1 ? '' : 's'} in the spreadsheet. Leave without saving?`)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [dirty.length])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const keep = new Set(dirty)
    const rows = (items ?? []).filter(
      (i) =>
        keep.has(i.code) ||
        (inShow(i, show) &&
          (!needle ||
            [i.title, i.code, i.donated_by, i.location, i.category, i.description, i.box ? `box ${i.box.box_no} ${i.box.code} ${i.box.name ?? ''}` : ''].some((t) =>
              (t ?? '').toLowerCase().includes(needle),
            ))),
    )
    if (order === 'name') rows.sort((a, b) => a.title.localeCompare(b.title))
    else rows.sort((a, b) => (order === 'oldest' ? entered(a) - entered(b) : entered(b) - entered(a)))
    return rows
  }, [items, show, q, order, dirty])

  const onEdit = useCallback((code: string, key: CellKey, value: string) => {
    setDone(null)
    setResults((r) => (r[code] ? Object.fromEntries(Object.entries(r).filter(([c]) => c !== code)) : r))
    setEdits((all) => ({ ...all, [code]: { ...all[code], [key]: value } }))
  }, [])
  const onUndo = useCallback((code: string) => {
    setEdits((all) => Object.fromEntries(Object.entries(all).filter(([c]) => c !== code)))
    setResults((r) => Object.fromEntries(Object.entries(r).filter(([c]) => c !== code)))
  }, [])

  const deps = useMemo<SheetDeps<TaggedItem>>(
    () => ({
      find: (code) => findByCode(orgId, code),
      core: (_code, v, fresh) =>
        // Photos are left alone (none is sent); the fields not being changed come from the row as it is now.
        saveItem(orgId, {
          ...draftFromItem(fresh),
          title: v.title,
          description: v.description,
          donatedBy: v.donatedBy,
          value: v.valueCents == null ? '' : centsToDollars(v.valueCents),
          quantity: v.quantity,
          photoUrl: null,
        }),
      extras: (code, v) => setItemExtras(orgId, code, v),
      plan: (code, v) => setDonationPlan(orgId, code, v),
      unprint: async (code) => {
        await markLabelsPrinted(orgId, [code], false)
        tellOthersLabelsChanged(orgId)
      },
    }),
    [orgId],
  )

  const saveAll = async () => {
    if (saving || !dirty.length) return
    setSaving(true)
    setDone(null)
    setError(null)
    let ok = 0
    let failed = 0
    for (const code of dirty) {
      const it = byCode.get(code)
      if (!it) continue
      const base = cellsFromItem(it)
      const now = withEdits(base, edits[code])
      if (firstProblem(changedKeys(base, now, it.source === 'purchase'), now)) {
        failed++
        setResults((r) => ({ ...r, [code]: { state: 'error', message: firstProblem(changedKeys(base, now, it.source === 'purchase'), now) ?? '' } }))
        continue
      }
      setResults((r) => ({ ...r, [code]: { state: 'saving' } }))
      let res
      try {
        res = await saveRow(deps, it, now)
      } catch (e) {
        res = { ok: false, saved: [] as CellKey[], error: errMessage(e), warnings: [] as string[], item: undefined }
      }
      const item = res.item
      if (item) setItems((list) => (list ?? []).map((x) => (x.code === code ? { ...x, ...item } : x)))
      setEdits((all) => {
        const next = { ...all }
        if (res.ok) delete next[code]
        else if (next[code]) {
          const left = { ...next[code] }
          for (const k of res.saved) delete left[k]
          next[code] = left
        }
        return next
      })
      setResults((r) => ({
        ...r,
        [code]: res.ok ? { state: 'saved', warnings: res.warnings } : { state: 'error', message: res.error, warnings: res.warnings },
      }))
      if (res.ok) ok++
      else failed++
    }
    setSaving(false)
    setDone(
      failed
        ? `${ok} row${ok === 1 ? '' : 's'} saved. ${failed} didn’t save: the reason is in each row’s Status. What you typed is still there.`
        : `${ok} row${ok === 1 ? '' : 's'} saved.`,
    )
  }

  const discardAll = () => {
    if (!window.confirm(`Throw away ${dirty.length} unsaved change${dirty.length === 1 ? '' : 's'}?`)) return
    setEdits({})
    setResults({})
    setDone(null)
  }

  const sheet = (): SheetSpec => {
    const what = SHOWS.find((s) => s.key === show)?.label ?? 'Donations'
    const made = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return {
      filename: `ohrr-items-donation-${todayStamp()}`,
      sheetName: 'Items',
      title: `Ohio House Rabbit Rescue — donations: ${what}${q.trim() ? ` matching “${q.trim()}”` : ''} · ${shown.length} · ${made}`,
      columns: SHEET_COLUMNS,
      rows: shown.map(sheetRow),
    }
  }
  const simpleSheet = (): SheetSpec => {
    const full = sheet()
    return { ...full, filename: full.filename.replace('ohrr-items-', 'ohrr-items-list-'), columns: SIMPLE_COLUMNS, rows: shown.map(simpleRow), layout: 'print' }
  }

  const reportPdf = {
    label: `Report with photos (PDF) of ${shown.length}`,
    title: 'Ohio House Rabbit Rescue items report',
    filename: `ohrr-items-report-${todayStamp()}`,
    build: async (progress: (msg: string) => void) => (await itemsReportPdf(sheet(), progress, pdfFields)).blob,
  }

  const drawn = shown.slice(0, limit)

  return (
    <Screen className="space-y-4 pb-28">
      <StaffTitle title="Items spreadsheet">
        <p>
          <strong>Change things.</strong> Every donation is one row. Click a box, type, and press Enter to go down a column. Changed boxes turn yellow, and a box with a
          mistake turns red. Nothing is saved until you press <strong>Save changes</strong> at the bottom. Undo on a row puts just that row back. You never have to
          download the list to fix it.
        </p>
        <p>
          <strong>Choose what you see.</strong> The search box and the list picker (Waiting to be sorted, Not sure yet, Done, All donations) narrow the table. The
          downloads take exactly what is shown.
        </p>
        <p>
          <strong>Download or print.</strong> <strong>Report with photos (PDF)</strong> makes pages to print or email: the totals, then one line per item with up to
          four photos, its name and number, and up to six details you choose: press <strong>Change what it shows</strong> under the buttons (box number, where
          it’s kept, worth, donor, notes and more; notes take two of the six). <strong>Spreadsheet (Excel) with photos</strong> has a picture of each item in
          the first column and links to all its photos. <strong>One-page list to print</strong> is the short version: photo, item, where it’s kept and donor.{' '}
          <strong>CSV</strong> is plain text for other programs, so it has photo links, not pictures. Save your changes first: the buttons wait until you do.
        </p>
        <p>
          <strong>Backups.</strong> The first time someone opens this list each day, a copy of every donation is kept. The last 10 days are kept. Press{' '}
          <strong>Backups</strong>, pick a day, and you see what changed or was deleted since. Check the items you want and bring them back: changed words go back,
          and a deleted item comes back with the same number. The copy is taken at the first open of the day, so a mistake made later that day comes back from that
          morning.
        </p>
        <p>Shop stock, auction lots and raffle prizes are not in this table; change those on their own screens.</p>
      </StaffTitle>

      <div className="flex flex-wrap items-center gap-2">
        <Link to="/staff/items" className={`${pill} border-slate-200 bg-white text-slate-600`}>
          <Icon name="arrowLeft" size={16} /> Items
        </Link>
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setLimit(PAGE)
          }}
          placeholder="Search name, number, donor, place or box"
          aria-label="Search the spreadsheet"
          className={`${field} w-80 max-w-full`}
        />
        <select
          value={show}
          onChange={(e) => {
            setShow(e.target.value as Show)
            setLimit(PAGE)
          }}
          aria-label="Which donations"
          className={field}
        >
          {SHOWS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <select value={order} onChange={(e) => setOrder(e.target.value as Order)} aria-label="Order" className={field}>
          {ORDERS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="text-[15px] text-slate-600">{items ? `${shown.length} of ${items.length} shown` : ''}</span>
        <button type="button" onClick={() => setShowBackups((v) => !v)} aria-expanded={showBackups} className={`${pill} ml-auto border-slate-300 bg-white text-slate-700`}>
          <Icon name="clock" size={16} /> Backups
        </button>
      </div>
      {/* Downloads sit at the top, where people look (sponsor 2026-11-22: at the bottom of a long table they were missed). */}
      {items && shown.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
          <p className="text-[15px] font-bold text-ink">Download or print the {shown.length} shown</p>
          {dirty.length > 0 ? (
            <p className="text-[15px] text-slate-600">Save your changes first, so the file matches the table.</p>
          ) : (
            <>
              <ExportButtons spec={sheet} label={`Spreadsheet (Excel) with photos of ${shown.length}`} simple={simpleSheet} pdf={reportPdf} />
              <ReportFieldPicker value={pdfFields} onChange={setPdfFields} />
            </>
          )}
          <p className="text-sm text-slate-500">The search and the list picker above choose what goes in the file.</p>
        </div>
      )}
      {backupMade && !showBackups && <p className="text-[15px] text-slate-600">Today’s backup of this list was saved. Open Backups to go back to an earlier day.</p>}
      {showBackups && (
        <SheetBackups
          api={backupApi}
          current={everything}
          canRestore={canEdit}
          blockedReason={dirty.length > 0 ? 'Save or throw away your spreadsheet changes first, then bring things back.' : null}
          onRestored={load}
          onClose={() => setShowBackups(false)}
        />
      )}

      {!canEdit && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-[15px] text-amber-900">You can look at the list and download it. Changing items needs a different role.</p>}
      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-[15px] font-bold text-red-800">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className={`rounded-2xl px-4 py-3 text-[15px] font-bold ${done.includes('didn’t') ? 'bg-amber-50 text-amber-900' : 'bg-green-50 text-green-900'}`}>
          {done}
        </p>
      )}
      {items === null && !error && <Spinner />}

      {items && shown.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-base text-slate-500">
          {items.length === 0 ? 'No donations yet.' : 'Nothing matches that. Try “All donations” or clear the search.'}
        </div>
      )}

      {items && shown.length > 0 && (
        <>
          <SheetGrid rows={drawn} edits={edits} results={results} editable={canEdit && !saving} locations={suggest.locations} categories={suggest.categories} statusOf={(i) => statusLabel(i as TaggedItem)} onEdit={onEdit} onUndo={onUndo} />
          {shown.length > drawn.length && (
            <button type="button" onClick={() => setLimit((n) => n + PAGE)} className={`${pill} border-slate-200 bg-white text-slate-700`}>
              Show {Math.min(PAGE, shown.length - drawn.length)} more ({shown.length - drawn.length} not shown yet)
            </button>
          )}
        </>
      )}

      {/* The save bar stays in view while you work down a long table. */}
      {canEdit && dirty.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-brand-orange bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3">
            <p className="min-w-0 flex-1 text-[15px] font-bold text-ink">
              {dirty.length} row{dirty.length === 1 ? '' : 's'} changed, not saved yet
              {problems ? ` · ${problems} with a box that needs fixing (red)` : ''}
            </p>
            <button type="button" onClick={discardAll} disabled={saving} className={`${pill} border-slate-300 bg-white text-slate-700`}>
              Throw away changes
            </button>
            <button type="button" onClick={() => void saveAll()} disabled={saving || problems > 0} className={`${pill} border-brand-orange bg-brand-orange text-ink`}>
              <Icon name="check" size={18} /> {saving ? 'Saving…' : `Save changes (${dirty.length})`}
            </button>
          </div>
        </div>
      )}
    </Screen>
  )
}
