// "Backups": the days that have a saved copy of the donations list, what differs from now, and a button to
// bring items back. Plain Tailwind and no app-specific imports, so the same file lives in the app
// (src/features/scan/SheetBackups.tsx) and the website (src/components/SheetBackups.tsx) — keep the two the same.
// The page around it (ItemsSheet) hands in the calls and the list as it is now.
import { useEffect, useMemo, useState } from 'react'
import { backupCsv, diffBackup, type BackupDay, type BackupDiff, type BackupFull, type RestoreResult } from './sheetBackup'
import type { SheetItem } from './sheetSave'

export interface BackupApi {
  list(): Promise<BackupDay[] | null>
  get(id: string): Promise<BackupFull>
  restore(id: string, codes: string[]): Promise<RestoreResult>
}

const errText = (e: unknown): string => (e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e))

/** "Today", "Yesterday" or "Mon, Nov 17". */
function dayName(day: string): string {
  const d = new Date(`${day}T00:00:00`)
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  const diff = Math.round((t.getTime() - d.getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

const btn = 'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-base font-bold disabled:opacity-50'
const PLACE: Record<string, string> = { raffle: 'raffle', auction: 'auction', stock: 'Hop Shop' }

export default function SheetBackups({
  api,
  current,
  canRestore,
  blockedReason,
  onRestored,
  onClose,
}: {
  api: BackupApi
  /** Every item as it is now (any kind). */
  current: SheetItem[]
  canRestore: boolean
  /** Set while there are unsaved spreadsheet changes: bringing things back waits. */
  blockedReason: string | null
  onRestored: () => void | Promise<void>
  onClose: () => void
}) {
  const [days, setDays] = useState<BackupDay[] | null | undefined>(undefined)
  const [picked, setPicked] = useState<string | null>(null)
  const [full, setFull] = useState<BackupFull | null>(null)
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RestoreResult | null>(null)

  useEffect(() => {
    let alive = true
    api
      .list()
      .then((d) => alive && setDays(d))
      .catch((e) => {
        if (!alive) return
        setDays([])
        setError(errText(e))
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const open = async (d: BackupDay) => {
    setPicked(d.id)
    setFull(null)
    setTicked(new Set())
    setResult(null)
    setError(null)
    setBusy('Opening that day…')
    try {
      setFull(await api.get(d.id))
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(null)
    }
  }

  const byCode = useMemo(() => new Map(current.map((i) => [i.code, i])), [current])
  const diffs = useMemo<BackupDiff[]>(() => (full ? diffBackup(full.items, byCode) : []), [full, byCode])
  const bringable = diffs.filter((d) => d.state !== 'moved')
  const changed = diffs.filter((d) => d.state === 'changed').length
  const deleted = diffs.filter((d) => d.state === 'deleted').length
  const moved = diffs.length - bringable.length
  const pickedDay = days?.find((d) => d.id === picked)

  const toggle = (code: string) =>
    setTicked((s) => {
      const n = new Set(s)
      if (n.has(code)) n.delete(code)
      else n.add(code)
      return n
    })

  const bringBack = async () => {
    if (!picked || !pickedDay || ticked.size === 0 || blockedReason) return
    const n = ticked.size
    const when = dayName(pickedDay.backup_day)
    const how = when === 'Today' ? 'at the start of today' : when === 'Yesterday' ? 'yesterday' : `on ${when}`
    if (!window.confirm(`Bring back ${n} item${n === 1 ? '' : 's'} to how ${n === 1 ? 'it was' : 'they were'} ${how}? Changed items go back to their old words. Deleted items are made again with the same number.`)) return
    setBusy('Bringing back…')
    setError(null)
    setResult(null)
    try {
      const r = await api.restore(picked, [...ticked])
      setResult(r)
      setTicked(new Set())
      await onRestored()
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(null)
    }
  }

  const download = () => {
    if (!full) return
    const blob = new Blob([backupCsv(full.items)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ohrr-donations-backup-${full.backup_day}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  return (
    <section aria-label="Backups" className="space-y-3 rounded-2xl border-2 border-brand-blue/30 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold text-slate-900">Backups of the donations list</h2>
        <button type="button" onClick={onClose} className={`${btn} border-slate-300 bg-white text-slate-700`}>
          Close
        </button>
      </div>
      <p className="text-base text-slate-700">
        The first time this list is opened each day, a copy is saved. The last 10 days are kept. Pick a day to see what is different now, then bring back what you need.
      </p>

      {days === undefined && <p className="text-base text-slate-600">Looking for backups…</p>}
      {days === null && <p className="rounded-xl bg-amber-50 px-3 py-2 text-base text-amber-900">Backups need database update 58, which hasn’t been run yet.</p>}
      {days && days.length === 0 && !error && <p className="text-base text-slate-600">No backup has been saved yet. Today’s is saved the next time this list is opened.</p>}

      {days && days.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Days with a backup">
          {days.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => void open(d)}
              aria-pressed={picked === d.id}
              className={`${btn} ${picked === d.id ? 'border-brand-blue bg-brand-blue text-white' : 'border-slate-300 bg-white text-slate-700'}`}
            >
              {dayName(d.backup_day)} · {d.item_count} item{d.item_count === 1 ? '' : 's'}
            </button>
          ))}
        </div>
      )}

      {busy && <p className="text-base font-bold text-slate-700">{busy}</p>}
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-base font-bold text-red-800">
          {error}
        </p>
      )}
      {result && (
        <div role="status" className={`rounded-xl px-3 py-2 text-base ${result.skipped.length ? 'bg-amber-50 text-amber-900' : 'bg-green-50 text-green-900'}`}>
          <p className="font-bold">
            Brought back {result.restored} changed item{result.restored === 1 ? '' : 's'} and made {result.recreated} deleted item{result.recreated === 1 ? '' : 's'} again.
          </p>
          {result.skipped.map((s) => (
            <p key={s.code}>
              <span className="font-mono font-bold">{s.code}</span>: {s.why}
            </p>
          ))}
        </div>
      )}

      {full && pickedDay && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 text-base font-bold text-slate-900">
              {dayName(pickedDay.backup_day)}’s copy has {full.item_count} item{full.item_count === 1 ? '' : 's'}.{' '}
              {diffs.length === 0
                ? 'Nothing is different now.'
                : `Since then: ${changed} changed, ${deleted} deleted${moved ? `, ${moved} sorted into the raffle, auction or shop` : ''}.`}
            </p>
            <button type="button" onClick={download} className={`${btn} border-slate-300 bg-white text-slate-700`}>
              Download that day’s list
            </button>
          </div>

          {bringable.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setTicked(new Set(bringable.map((d) => d.code)))} className={`${btn} border-slate-300 bg-white text-slate-700`}>
                  Check all {bringable.length}
                </button>
                <button type="button" onClick={() => setTicked(new Set())} disabled={ticked.size === 0} className={`${btn} border-slate-300 bg-white text-slate-700`}>
                  Clear checks
                </button>
                <button
                  type="button"
                  onClick={() => void bringBack()}
                  disabled={!canRestore || ticked.size === 0 || Boolean(busy) || Boolean(blockedReason)}
                  className={`${btn} border-brand-orange bg-brand-orange text-ink`}
                >
                  Bring back {ticked.size} checked
                </button>
              </div>
              {blockedReason && <p className="text-base font-bold text-amber-900">{blockedReason}</p>}
              {!canRestore && <p className="text-base text-slate-600">Bringing items back needs a different role. You can still look and download.</p>}
            </>
          )}

          {diffs.length > 0 && (
            <ul className="max-h-[50vh] divide-y divide-slate-200 overflow-auto rounded-xl border border-slate-200">
              {diffs.map((d) => (
                <li key={d.code} className="flex gap-3 px-3 py-2">
                  {d.state === 'moved' ? (
                    <span className="mt-1 h-5 w-5 shrink-0" aria-hidden="true" />
                  ) : (
                    <input
                      type="checkbox"
                      checked={ticked.has(d.code)}
                      onChange={() => toggle(d.code)}
                      aria-label={`Bring back ${d.title} (${d.code})`}
                      className="mt-1 h-5 w-5 shrink-0 accent-[#0669AC]"
                    />
                  )}
                  <div className="min-w-0 flex-1 text-base">
                    <p className="font-bold text-slate-900">
                      {d.title} <span className="font-mono text-sm font-bold tracking-wider text-slate-500">{d.code}</span>
                    </p>
                    {d.state === 'deleted' && <p className="font-semibold text-red-800">Deleted. Checking it makes it again with the same number.</p>}
                    {d.state === 'moved' && <p className="text-slate-600">Now in the {PLACE[d.movedTo ?? ''] ?? d.movedTo}. Left alone.</p>}
                    {d.changes.map((c) => (
                      <p key={c.key} className="text-slate-700">
                        <span className="font-semibold">{c.label.charAt(0).toUpperCase() + c.label.slice(1)}:</span> was <strong>{c.then}</strong>, now <strong>{c.now}</strong>
                      </p>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
