// /staff/boxes/:code — one box (update 46): what's in it, adding items by
// scanning their labels (the camera stays on for the next one) or ticking them
// in a list, and printing the 4 × 6 in box label and a letter-size packing
// list. Scanning a box label anywhere in the app lands here.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { Icon } from '../../../components/icons'
import { Screen } from '../../../components/ui'
import { Spinner, staffInput } from '../../../components/staffui'
import { isNative } from '../../../native/platform'
import { shareFileNative } from '../../../native/share'
import Scanner from '../Scanner'
import { BigButton, ErrorBox } from '../ScanUI'
import { listItems } from '../api'
import { boxName, isBoxCode, normalizeCode } from '../codes'
import { labelDataUrl, labelsPdf } from '../labels'
import { PAGE_SIZE, filterRows, groupByDay, type ListRow } from '../labelList'
import BluetoothPrint from '../printer/BluetoothPrint'
import { KIND_META, type TaggedItem } from '../types'
import { BOX_SIZE, boxByCode, boxLabel, deleteBox, markBoxesPrinted, packingListPdf, putInBox, saveBox, takeOutOfBox, type Box, type BoxPutResult } from '../boxes'

type Mode = 'list' | 'scan' | 'type' | 'pick'

interface LogLine {
  ok: boolean
  text: string
}

interface PickRow extends ListRow {
  photo_url: string | null
  box: TaggedItem['box']
}

const SELECT =
  'mt-1 block min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-base font-semibold text-ink outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/15'

/** What happened to one scanned or ticked item, in a sentence. */
function resultLines(res: BoxPutResult, codes: string[]): LogLine[] {
  const out: LogLine[] = []
  for (const c of res.not_found) out.push({ ok: false, text: `No item has the code ${c}. Add it first (Add a donation), then scan it again.` })
  for (const m of res.moved) out.push({ ok: true, text: `${m.title} — moved here from ${boxName(m.from)}.` })
  const fresh = res.added - res.moved.length
  if (fresh > 0 && codes.length === 1) {
    const last = [...(res.box?.items ?? [])].sort((a, b) => (b.boxed_at ?? '').localeCompare(a.boxed_at ?? ''))[0]
    out.push({ ok: true, text: `Added: ${last?.title ?? codes[0]}.` })
  } else if (fresh > 0) {
    out.push({ ok: true, text: `${fresh} item${fresh === 1 ? '' : 's'} added.` })
  }
  if (res.added === 0 && res.not_found.length === 0) out.push({ ok: true, text: codes.length === 1 ? 'Already in this box.' : 'They were already in this box.' })
  return out
}

export default function BoxDetail() {
  const { code: rawCode = '' } = useParams()
  const code = normalizeCode(rawCode)
  const { membership } = useAuth()
  const orgId = membership?.orgId ?? ''
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [box, setBox] = useState<Box | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>(() => (searchParams.get('scan') ? 'scan' : 'list'))
  const [log, setLog] = useState<LogLine[]>([])
  const [scanBusy, setScanBusy] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [place, setPlace] = useState('')
  const [memo, setMemo] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [printImgs, setPrintImgs] = useState<string[]>([])
  const [copies, setCopies] = useState(1)

  // Another box (a link, or a box label scanned elsewhere): start fresh.
  useEffect(() => {
    setMode(searchParams.get('scan') ? 'scan' : 'list')
    setLog([])
    setNote(null)
    setEditing(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const load = useCallback(async () => {
    if (!orgId || !code) return
    try {
      const b = await boxByCode(orgId, code)
      setBox(b)
      setError(null)
    } catch (e) {
      setError(errMessage(e))
      setBox((b) => b ?? null)
    }
  }, [orgId, code])

  useEffect(() => {
    void load()
    const again = () => document.visibilityState === 'visible' && void load()
    document.addEventListener('visibilitychange', again)
    return () => document.removeEventListener('visibilitychange', again)
  }, [load])

  // The label preview follows what's in the box.
  const labelKey = box ? JSON.stringify([box.code, box.location, box.items.map((i) => i.title)]) : ''
  useEffect(() => {
    if (!box) return
    let alive = true
    labelDataUrl(boxLabel(box), BOX_SIZE, 120)
      .then((u) => alive && setPreview(u))
      .catch(() => alive && setPreview(null))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelKey])

  const addCodes = async (codes: string[]) => {
    if (!box) return
    const res = await putInBox(orgId, box.code, codes)
    if (res.box) setBox(res.box)
    return res
  }

  // One scanned (or typed) code: an item goes in; a box label is just pointed out.
  const handleCode = async (raw: string) => {
    if (!box) return
    const c = normalizeCode(raw)
    if (!c) {
      setLog((l) => [{ ok: false, text: 'That didn’t look like a label. Try again, or type the code.' }, ...l])
      return
    }
    if (isBoxCode(c)) {
      setLog((l) => [{ ok: false, text: c === box.code ? 'That’s this box’s own label — scan an item’s label.' : `That’s the label of ${boxName(c)}, not an item.` }, ...l])
      return
    }
    setScanBusy(true)
    try {
      const res = await addCodes([c])
      if (res) setLog((l) => [...resultLines(res, [c]), ...l].slice(0, 20))
    } catch (e) {
      setLog((l) => [{ ok: false, text: errMessage(e) }, ...l])
    } finally {
      setScanBusy(false)
    }
  }

  const remove = async (itemCode: string) => {
    setError(null)
    try {
      await takeOutOfBox(orgId, [itemCode])
      await load()
    } catch (e) {
      setError(errMessage(e))
    }
  }

  const saveDetails = async () => {
    if (!box) return
    setBusy('Saving…')
    setError(null)
    try {
      setBox(await saveBox(orgId, box.code, place, memo))
      setEditing(false)
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const remove_box = async () => {
    if (!box) return
    if (!window.confirm(`Delete ${boxName(box.code)}? The ${box.items.length} item${box.items.length === 1 ? '' : 's'} in it stay — they just won’t be in a box.`)) return
    setBusy('Deleting…')
    try {
      await deleteBox(orgId, box.code)
      navigate('/staff/boxes', { replace: true })
    } catch (e) {
      setError(errMessage(e))
      setBusy(null)
    }
  }

  const marked = async (msg: string) => {
    if (!box) return
    setNote(msg)
    try {
      await markBoxesPrinted(orgId, [box.code])
      setBox((b) => (b ? { ...b, label_printed_at: new Date().toISOString() } : b))
    } catch {
      /* the note still stands */
    }
  }

  const save = async (blob: Blob, name: string, title: string) => {
    if (isNative) return (await shareFileNative(blob, name, title)) !== 'cancelled'
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    return true
  }

  const printWeb = async () => {
    if (!box) return
    setBusy('Making the label…')
    setError(null)
    try {
      const img = await labelDataUrl(boxLabel(box), BOX_SIZE)
      setPrintImgs(Array.from({ length: copies }, () => img))
      await new Promise((r) => setTimeout(r, 150))
      window.print()
      await marked(`${boxName(box.code)} label sent to print.`)
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const labelPdf = async () => {
    if (!box) return
    setBusy('Making the PDF…')
    setError(null)
    try {
      const label = boxLabel(box)
      const blob = await labelsPdf(Array.from({ length: copies }, () => label), BOX_SIZE)
      if (await save(blob, `ohrr-${box.code.toLowerCase()}-label.pdf`, `OHRR ${boxName(box.code)} label`)) await marked(`${boxName(box.code)} label: a 4 × 6 in PDF.`)
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const listPdf = async () => {
    if (!box) return
    setBusy('Making the packing list…')
    setError(null)
    try {
      const blob = await packingListPdf(box)
      if (await save(blob, `ohrr-${box.code.toLowerCase()}-packing-list.pdf`, `OHRR ${boxName(box.code)} packing list`)) setNote('Packing list made — print it on letter paper to go inside the box.')
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(null)
    }
  }

  if (box === undefined) {
    return (
      <Screen className="space-y-4">
        <ErrorBox>{error}</ErrorBox>
        {!error && <Spinner />}
      </Screen>
    )
  }
  if (box === null) {
    return (
      <Screen className="space-y-4">
        <BackLink />
        <h1 className="font-display text-2xl font-black text-ink">{isBoxCode(code) ? boxName(code) : code}</h1>
        <ErrorBox>{error}</ErrorBox>
        {!error && <p className="text-base text-slate-600">There’s no box with that number.</p>}
      </Screen>
    )
  }

  const name = boxName(box.code)
  return (
    <>
      <Screen className="space-y-4 print:hidden">
        <div className="pt-1">
          <BackLink />
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <h1 className="font-display text-3xl font-black text-ink">{name}</h1>
            <span className="font-mono text-sm font-bold tracking-widest text-slate-400">{box.code}</span>
          </div>
          {!editing ? (
            <p className="mt-1 text-base text-slate-600">
              {box.items.length} item{box.items.length === 1 ? '' : 's'}
              {box.location ? ` · Kept: ${box.location}` : ''}{' '}
              <button
                type="button"
                onClick={() => {
                  setPlace(box.location ?? '')
                  setMemo(box.note ?? '')
                  setEditing(true)
                }}
                className="min-h-[44px] font-bold text-brand-blue"
              >
                {box.location || box.note ? 'Change' : 'Where is it kept?'}
              </button>
            </p>
          ) : null}
          {!editing && box.note && <p className="text-base text-slate-500">{box.note}</p>}
        </div>

        {editing && (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <label className="block text-base font-bold text-ink">
              Where it’s kept
              <input value={place} onChange={(e) => setPlace(e.target.value)} maxLength={120} placeholder="e.g. Garage shelf B" className={`mt-1 ${staffInput}`} />
            </label>
            <label className="block text-base font-bold text-ink">
              Note <span className="font-normal text-slate-500">(optional)</span>
              <textarea value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={500} rows={2} className={`mt-1 ${staffInput}`} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <BigButton tone="blue" onClick={() => void saveDetails()} disabled={!!busy}>
                Save
              </BigButton>
              <BigButton tone="plain" onClick={() => setEditing(false)}>
                Cancel
              </BigButton>
            </div>
          </div>
        )}

        <ErrorBox>{error}</ErrorBox>

        {/* Adding items */}
        {mode === 'list' && (
          <div className="grid grid-cols-2 gap-2">
            <BigButton onClick={() => setMode('scan')} icon="scan">
              Scan items in
            </BigButton>
            <BigButton tone="outline" onClick={() => setMode('pick')}>
              Pick from a list
            </BigButton>
          </div>
        )}
        {(mode === 'scan' || mode === 'type') && (
          <div className="space-y-3 rounded-2xl border-2 border-brand-orange/60 bg-white p-3">
            <p className="font-display text-lg font-extrabold text-ink">Scan each item’s label</p>
            {mode === 'scan' ? (
              <Scanner onResult={(raw) => void handleCode(raw)} onTypeInstead={() => setMode('type')} paused={scanBusy} />
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const t = typed
                  setTyped('')
                  void handleCode(t)
                }}
                className="flex gap-2"
              >
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="DON-00042"
                  aria-label="Item code"
                  autoFocus
                  autoCapitalize="characters"
                  className={`${staffInput} font-mono`}
                />
                <button type="submit" disabled={!typed.trim() || scanBusy} className="min-h-[48px] shrink-0 rounded-xl bg-brand-blue px-4 font-bold text-white disabled:opacity-40">
                  Add
                </button>
              </form>
            )}
            {log.length > 0 && (
              <ul className="space-y-1" aria-live="polite">
                {log.slice(0, 5).map((l, i) => (
                  <li key={i} className={`flex items-start gap-2 rounded-xl px-3 py-2 text-[15px] font-semibold ${l.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'} ${i > 0 ? 'opacity-60' : ''}`}>
                    <Icon name={l.ok ? 'check' : 'x'} size={18} className="mt-0.5 shrink-0" />
                    {l.text}
                  </li>
                ))}
              </ul>
            )}
            <div className="grid grid-cols-2 gap-2">
              <BigButton tone="blue" onClick={() => setMode('list')}>
                Done · {box.items.length} in the box
              </BigButton>
              <BigButton tone="plain" onClick={() => setMode(mode === 'scan' ? 'type' : 'scan')}>
                {mode === 'scan' ? 'Type a code' : 'Use the camera'}
              </BigButton>
            </div>
          </div>
        )}
        {mode === 'pick' && (
          <Picker
            orgId={orgId}
            box={box}
            onCancel={() => setMode('list')}
            onPut={async (codes) => {
              const res = await addCodes(codes)
              if (res) setLog(resultLines(res, codes))
              setMode('list')
            }}
          />
        )}
        {mode === 'list' && log.length > 0 && (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{log.map((l) => l.text).join(' ')}</p>
        )}

        {/* What's in it */}
        {mode !== 'pick' && (
          <section className="space-y-2">
            <h2 className="font-display text-lg font-extrabold text-ink">In this box</h2>
            {box.items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-center text-base text-slate-500">Nothing yet — scan the items’ labels to put them in.</div>
            ) : (
              <ul className="space-y-2">
                {box.items.map((i) => (
                  <li key={i.code} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                    {i.photo_url ? (
                      <img src={i.photo_url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" loading="lazy" />
                    ) : (
                      <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                        <Icon name={KIND_META[i.kind]?.icon ?? 'box'} size={22} />
                      </span>
                    )}
                    <Link to={`/staff/scan?code=${encodeURIComponent(i.code)}`} className="min-w-0 flex-1">
                      <span className="block truncate font-display text-base font-extrabold text-ink">{i.title}</span>
                      <span className="block truncate font-mono text-xs font-bold text-slate-400">{i.code}</span>
                    </Link>
                    <button type="button" onClick={() => void remove(i.code)} className="min-h-[44px] shrink-0 px-2 text-[15px] font-bold text-red-700" aria-label={`Take ${i.title} out of the box`}>
                      Take out
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* The box label */}
        {mode === 'list' && (
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="font-display text-lg font-extrabold text-ink">Box label · 4 × 6 in</h2>
            {preview && <img src={preview} alt={`${name} label preview`} className="mx-auto w-full max-w-[16rem] rounded-lg border border-slate-200 shadow-sm" style={{ aspectRatio: '4 / 6' }} />}
            <label className="block text-sm font-bold text-slate-600">
              Copies
              <select value={copies} onChange={(e) => setCopies(Number(e.target.value))} className={SELECT}>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? '1 label' : `${n} labels`}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {isNative ? (
                <BigButton onClick={() => void labelPdf()} disabled={!!busy} icon="printer" className="col-span-2">
                  {busy ?? 'Print or share the label'}
                </BigButton>
              ) : (
                <>
                  <BigButton onClick={() => void printWeb()} disabled={!!busy} icon="printer">
                    {busy ?? 'Print'}
                  </BigButton>
                  <BigButton onClick={() => void labelPdf()} disabled={!!busy} tone="outline">
                    PDF
                  </BigButton>
                </>
              )}
            </div>
            <BluetoothPrint
              labels={[{ code: box.code, item: boxLabel(box), copies }]}
              size={BOX_SIZE}
              busy={busy}
              setBusy={setBusy}
              onError={setError}
              onPrinted={(_codes, msg) => void marked(msg)}
            />
            <BigButton tone="plain" onClick={() => void listPdf()} disabled={!!busy} icon="file">
              Packing list (letter paper)
            </BigButton>
            {note && <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{note}</p>}
            <p className="text-sm text-slate-500">
              {box.label_printed_at ? 'The label has been printed. ' : ''}
              Put a 4 × 6 in roll in the printer first. The label lists the names; scanning it opens this page with everything in the box.
            </p>
          </section>
        )}

        {mode === 'list' && (
          <button type="button" onClick={() => void remove_box()} disabled={!!busy} className="min-h-[44px] text-[15px] font-bold text-red-700">
            Delete this box
          </button>
        )}
      </Screen>

      {/* print-only: the box label at 4 × 6 in */}
      <div className="hidden print:block">
        {printImgs.map((src, i) => (
          <div key={i} className="label-page">
            <img src={src} alt="" />
          </div>
        ))}
      </div>
      <style>{`
        @media print {
          @page { size: ${BOX_SIZE.wIn}in ${BOX_SIZE.hIn}in; margin: 0; }
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          header { display: none !important; }
          [class*="max-w-[480px]"] { max-width: none !important; box-shadow: none !important; padding: 0 !important; }
          .label-page { width: ${BOX_SIZE.wIn}in; height: ${BOX_SIZE.hIn}in; overflow: hidden; page-break-after: always; break-after: page; }
          .label-page img { display: block; width: ${BOX_SIZE.wIn}in; height: ${BOX_SIZE.hIn}in; }
        }
      `}</style>
    </>
  )
}

function BackLink() {
  return (
    <Link to="/staff/boxes" className="inline-flex min-h-[44px] items-center gap-1 text-base font-bold text-brand-blue">
      <Icon name="arrowLeft" size={20} /> Boxes
    </Link>
  )
}

/** Tick items to put in the box: those not in any box yet, newest first, by day. */
function Picker({ orgId, box, onPut, onCancel }: { orgId: string; box: Box; onPut: (codes: string[]) => Promise<void>; onCancel: () => void }) {
  const [rows, setRows] = useState<PickRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [which, setWhich] = useState<'nobox' | 'all'>('nobox')
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    listItems(orgId)
      .then((items) => {
        if (!alive) return
        setRows(
          items.map((i) => ({
            code: i.code,
            title: i.title,
            sub: [KIND_META[i.kind].label, i.donated_by ? `Gift of ${i.donated_by}` : null].filter(Boolean).join(' · '),
            label_printed_at: i.label_printed_at ?? null,
            added: i.created_at ?? null,
            kind: i.kind,
            photo_url: i.photo_url,
            box: i.box ?? null,
          })),
        )
      })
      .catch((e) => alive && setError(errMessage(e)))
    return () => {
      alive = false
    }
  }, [orgId])

  const inThis = useMemo(() => new Set(box.items.map((i) => i.code)), [box.items])
  const base = (rows ?? []).filter((r) => !inThis.has(r.code) && (which === 'all' || !r.box))
  const shown = filterRows(base, { show: 'all', when: 'any', kind: 'all', sort: 'newest' }, q, picked)
  const groups = groupByDay(shown.slice(0, limit), 'newest')
  const toggle = (c: string) =>
    setPicked((p) => {
      const n = new Set(p)
      if (n.has(c)) n.delete(c)
      else n.add(c)
      return n
    })

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-extrabold text-ink">Pick items for {boxName(box.code)}</h2>
        <button type="button" onClick={onCancel} className="min-h-[44px] px-2 text-[15px] font-bold text-brand-blue">
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm font-bold text-slate-600">
          Show
          <select value={which} onChange={(e) => setWhich(e.target.value as 'nobox' | 'all')} className={SELECT}>
            <option value="nobox">Not in a box yet</option>
            <option value="all">Everything</option>
          </select>
        </label>
        <label className="text-sm font-bold text-slate-600">
          Find
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or code" className={SELECT} />
        </label>
      </div>
      <BigButton
        onClick={async () => {
          setBusy(true)
          setError(null)
          try {
            await onPut([...picked])
          } catch (e) {
            setError(errMessage(e))
            setBusy(false)
          }
        }}
        disabled={busy || picked.size === 0}
        icon="box"
      >
        {busy ? 'Putting them in…' : picked.size === 0 ? 'Tick the items for this box' : `Put ${picked.size} in ${boxName(box.code)}`}
      </BigButton>
      <ErrorBox>{error}</ErrorBox>
      {rows === null && !error && <Spinner />}
      {rows && shown.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-center text-base text-slate-500">
          {which === 'nobox' && !q.trim() ? 'Every item is in a box already.' : 'Nothing matches.'}
        </div>
      )}
      {groups.map((g) => (
        <section key={g.heading || 'all'} className="space-y-2">
          {g.heading && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <h3 className="font-display text-base font-extrabold text-ink">
                {g.heading} <span className="font-sans text-sm font-semibold text-slate-500">· {g.rows.length}</span>
              </h3>
              <button type="button" onClick={() => setPicked((p) => new Set([...p, ...g.rows.map((r) => r.code)]))} className="min-h-[44px] px-2 text-[15px] font-bold text-brand-blue">
                Tick these {g.rows.length}
              </button>
            </div>
          )}
          <ul className="space-y-2">
            {g.rows.map((r) => {
              const on = picked.has(r.code)
              return (
                <li key={r.code}>
                  <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition ${on ? 'border-brand-blue bg-brand-blue-50/50' : 'border-slate-200 bg-white'}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(r.code)} className="h-6 w-6 shrink-0 accent-brand-blue" aria-label={`Put ${r.title} in the box`} />
                    {r.photo_url ? (
                      <img src={r.photo_url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" loading="lazy" />
                    ) : (
                      <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                        <Icon name={KIND_META[r.kind as TaggedItem['kind']]?.icon ?? 'box'} size={22} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-base font-extrabold text-ink">{r.title}</span>
                      <span className="block truncate text-sm text-slate-600">
                        {r.sub}
                        {r.box ? ` · now in ${boxName(r.box.code)}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-xs font-bold text-slate-400">{r.code}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      {shown.length > limit && (
        <button type="button" onClick={() => setLimit((l) => l + PAGE_SIZE)} className="min-h-[48px] w-full rounded-2xl border-2 border-brand-blue/50 bg-white text-[15px] font-bold text-brand-blue">
          Show {Math.min(PAGE_SIZE, shown.length - limit)} more ({shown.length - limit} not shown yet)
        </button>
      )}
    </section>
  )
}
