// One drop-off (update 40): who gave it, what they gave and where each thing
// is now, and the thank-you letter — edit it, print it, email it, copy it,
// then mark them as thanked.
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { Icon } from '../../../components/icons'
import { Screen, SectionLabel } from '../../../components/ui'
import { Spinner, staffInput } from '../../../components/staffui'
import { isNative } from '../../../native/platform'
import { dropoffDetail, isNeeds40, setDropoffThanked, updateDropoff, type DonationLine, type Dropoff } from '../api'
import { BigButton, ErrorBox } from '../ScanUI'
import { KIND_META, usDate } from '../types'
import { inGivenOrder, lineCode, lineLabel, plural, thankYouLetter, thankYouMailto, toggleLetterValues, whereNow, worthLine, THANK_YOU_SUBJECT } from '../letters'

type Detail = Dropoff & { lines: DonationLine[] }
type Phase = 'loading' | 'ready' | 'missing' | 'needs40' | 'error'

const actionBtn =
  'inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl px-4 font-display text-base font-extrabold transition active:scale-[.98] disabled:opacity-40'

export default function DropoffDetail() {
  const { id = '' } = useParams()
  const { membership, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const allowed = KIND_META.donation.caps.some((c) => can(c))
  const [data, setData] = useState<Detail | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', date: '', note: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [withValues, setWithValues] = useState(false)
  // null = the letter as made (it follows the drop-off); a string = what they typed.
  const [edited, setEdited] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [thanking, setThanking] = useState(false)
  const req = useRef(0)

  const load = useCallback(async () => {
    const n = ++req.current
    try {
      const d = await dropoffDetail(orgId, id)
      if (n !== req.current) return
      setData(d)
      setPhase(d ? 'ready' : 'missing')
    } catch (e) {
      if (n !== req.current) return
      if (isNeeds40(e)) setPhase('needs40')
      else {
        setError(errMessage(e))
        setPhase('error')
      }
    }
  }, [orgId, id])

  useEffect(() => {
    if (orgId && allowed && id) void load()
    return () => {
      req.current++
    }
  }, [orgId, allowed, id, load])

  const lines = useMemo(() => inGivenOrder(data?.lines ?? []), [data])
  const made = useMemo(() => (data ? thankYouLetter(data, data.lines, withValues) : ''), [data, withValues])
  const letter = edited ?? made
  const anyValue = lines.some((l) => l.value_total_cents != null)
  const email = (data?.donor_email ?? '').trim()

  const startEdit = () => {
    if (!data) return
    setForm({ name: data.donor_name ?? '', email: data.donor_email ?? '', date: data.received_on?.slice(0, 10) ?? '', note: data.note ?? '' })
    setFormError(null)
    setEditing(true)
  }

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!data) return
    setSaving(true)
    setFormError(null)
    try {
      const d = await updateDropoff(orgId, data.id, { donorName: form.name, donorEmail: form.email, receivedOn: form.date || null, note: form.note })
      setData((cur) => (cur ? { ...cur, ...d } : cur))
      setEditing(false)
      // The items' donor name and date follow the drop-off; read them back.
      void load()
    } catch (err) {
      setFormError(isNeeds40(err) ? 'This needs database update 40.' : errMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const toggleValues = (on: boolean) => {
    setWithValues(on)
    if (edited !== null && data) setEdited(toggleLetterValues(edited, data.lines, on))
  }

  const copy = async () => {
    setMsg(null)
    try {
      await navigator.clipboard.writeText(letter)
      setMsg('Copied. Paste it into an email, a message or a card.')
    } catch {
      setMsg('Couldn’t copy on this device — press and hold in the letter, Select all, then Copy.')
    }
  }

  // On the web, print just the letter. In the phone app there's no print
  // dialog: the share sheet has Print (iOS), Mail, Messages and more.
  const print = async () => {
    setMsg(null)
    if (isNative) {
      try {
        const { shareTextNative } = await import('../../../native/share')
        await shareTextNative(letter, THANK_YOU_SUBJECT)
      } catch (e) {
        setMsg(errMessage(e))
      }
      return
    }
    window.print()
  }

  const setThanked = async (thanked: boolean) => {
    if (!data) return
    setThanking(true)
    setMsg(null)
    try {
      const d = await setDropoffThanked(orgId, data.id, thanked)
      setData((cur) => (cur ? { ...cur, ...d } : cur))
    } catch (e) {
      setMsg(isNeeds40(e) ? 'This needs database update 40.' : errMessage(e))
    } finally {
      setThanking(false)
    }
  }

  const name = (data?.donor_name ?? '').trim()

  return (
    <>
      <Screen className="space-y-4 print:hidden">
        <div className="pt-1">
          <Link to="/staff/dropoffs" className="inline-flex min-h-[44px] items-center gap-1 text-base font-bold text-brand-blue">
            <Icon name="arrowLeft" size={20} /> Drop-offs
          </Link>
        </div>

        {!allowed ? (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-base text-slate-600">Drop-offs are for the people who sort donations.</p>
        ) : phase === 'needs40' ? (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-base text-slate-600">This needs database update 40.</p>
        ) : phase === 'missing' ? (
          <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-base text-slate-500">That drop-off isn’t here any more.</p>
        ) : phase === 'error' ? (
          <ErrorBox>{error}</ErrorBox>
        ) : !data ? (
          <Spinner />
        ) : (
          <>
            {/* Who, when, note — and Edit */}
            {editing ? (
              <form onSubmit={(e) => void saveEdit(e)} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="font-display text-lg font-extrabold text-ink">Edit the drop-off</p>
                <label className="block text-sm font-bold text-slate-600">
                  Who gave it
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name, family or business" autoComplete="off" className={`${staffInput} min-h-[48px] text-base`} />
                </label>
                <label className="block text-sm font-bold text-slate-600">
                  Their email (for the thank-you)
                  <input
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="name@example.com"
                    autoComplete="off"
                    className={`${staffInput} min-h-[48px] text-base`}
                  />
                </label>
                <label className="block text-sm font-bold text-slate-600">
                  Day it came in
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={`${staffInput} min-h-[48px] text-base`} />
                </label>
                <label className="block text-sm font-bold text-slate-600">
                  Note
                  <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3} className={`${staffInput} text-base`} />
                </label>
                {formError && <ErrorBox>{formError}</ErrorBox>}
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setEditing(false)} className={`${actionBtn} bg-slate-100 text-ink`}>
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className={`${actionBtn} bg-brand-blue text-white`}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h1 className={`font-display text-2xl font-black leading-tight ${name ? 'text-ink' : 'text-slate-500'}`}>{name || 'Not named'}</h1>
                    {email ? (
                      <a href={`mailto:${email}`} className="mt-1 block break-all text-base font-semibold text-brand-blue">
                        {email}
                      </a>
                    ) : (
                      <p className="mt-1 text-base text-slate-500">No email</p>
                    )}
                    <p className="mt-1 text-base text-slate-600">
                      Came in {usDate(data.received_on)} · {plural(data.items, 'item')} · {plural(data.pieces, 'piece')}
                    </p>
                    {data.note && <p className="mt-2 whitespace-pre-wrap text-base text-slate-600">{data.note}</p>}
                  </div>
                  <button type="button" onClick={startEdit} className="inline-flex min-h-[44px] shrink-0 items-center rounded-xl border-2 border-brand-blue/50 px-4 text-[15px] font-bold text-brand-blue">
                    Edit
                  </button>
                </div>
              </div>
            )}

            {/* What they gave */}
            <SectionLabel>What they gave</SectionLabel>
            {lines.length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-center text-base text-slate-500">Nothing added to this drop-off yet.</p>
            )}
            <ul className="space-y-2.5">
              {lines.map((l) => {
                const code = lineCode(l)
                const worth = worthLine(l)
                const body = (
                  <>
                    {l.photo_url ? (
                      <img src={l.photo_url} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" loading="lazy" />
                    ) : (
                      <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-blue-50 text-brand-blue">
                        <Icon name="gift" size={24} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[17px] font-extrabold leading-snug text-ink">{lineLabel(l)}</span>
                      {l.split_from && <span className="block text-sm text-slate-500">Split off from the line above</span>}
                      {worth && <span className="mt-0.5 block text-sm text-slate-600">Worth {worth}</span>}
                      <span className="mt-0.5 block text-sm font-semibold text-slate-700">{whereNow(l, true)}</span>
                      {code && <span className="mt-0.5 block font-mono text-xs font-bold tracking-widest text-slate-400">{code}</span>}
                    </span>
                  </>
                )
                return (
                  <li key={l.id}>
                    {code ? (
                      <Link
                        to={`/staff/scan?code=${encodeURIComponent(code)}`}
                        className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition active:scale-[.99]"
                      >
                        {body}
                        <Icon name="chevron" size={18} className="shrink-0 text-slate-300" />
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-3">{body}</div>
                    )}
                  </li>
                )
              })}
            </ul>

            {/* The thank-you letter */}
            <SectionLabel>Thank-you letter</SectionLabel>
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              {data.thanked_at ? (
                <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
                  <Icon name="check" size={15} /> Thanked {usDate(data.thanked_at)}
                </p>
              ) : (
                <p className="inline-flex rounded-full bg-brand-orange-50 px-3 py-1 text-sm font-bold text-brand-orange-dark">Thank-you to send</p>
              )}
              <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl bg-slate-50 px-3">
                <input type="checkbox" checked={withValues} onChange={(e) => toggleValues(e.target.checked)} className="h-6 w-6 shrink-0 accent-brand-blue" />
                <span className="text-base font-semibold text-ink">Show values in the letter</span>
              </label>
              {withValues && !anyValue && <p className="text-sm text-slate-500">None of these has a value yet.</p>}
              <textarea
                value={letter}
                onChange={(e) => setEdited(e.target.value)}
                // Tall enough for the whole letter on a phone (about 32 characters a line).
                rows={Math.min(36, Math.max(12, letter.split('\n').reduce((n, row) => n + Math.max(1, Math.ceil(row.length / 32)), 1)))}
                aria-label="The thank-you letter"
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-3 text-base leading-relaxed text-ink outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/15"
              />
              {edited !== null && edited !== made && (
                <button type="button" onClick={() => setEdited(null)} className="min-h-[44px] text-[15px] font-bold text-brand-blue">
                  Start the letter over
                </button>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => void print()} className={`${actionBtn} bg-brand-blue text-white`}>
                  <Icon name="printer" size={20} /> {isNative ? 'Print or share' : 'Print'}
                </button>
                <button type="button" onClick={() => void copy()} className={`${actionBtn} border-2 border-brand-blue/50 bg-white text-brand-blue`}>
                  Copy
                </button>
                {email && (
                  <a href={thankYouMailto(email, letter)} className={`${actionBtn} col-span-2 bg-brand-orange text-ink`}>
                    <Icon name="mail" size={20} /> Email it
                  </a>
                )}
              </div>
              {!email && <p className="text-[15px] text-slate-600">No email for this donor — print it or copy it.</p>}
              {msg && <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{msg}</p>}

              {data.thanked_at ? (
                <BigButton tone="plain" disabled={thanking} onClick={() => void setThanked(false)}>
                  Not thanked yet
                </BigButton>
              ) : (
                <BigButton tone="outline" icon="check" disabled={thanking} onClick={() => void setThanked(true)}>
                  Mark as thanked
                </BigButton>
              )}
            </div>
          </>
        )}
      </Screen>

      {/* print-only: just the letter */}
      {data && <div className="dropoff-letter hidden whitespace-pre-wrap print:block">{letter}</div>}
      <style>{`
        @media print {
          @page { size: letter; margin: 1in; }
          html, body { background: white !important; }
          header, nav, [data-tabbar] { display: none !important; }
          [class*="max-w-[480px]"] { max-width: none !important; box-shadow: none !important; padding: 0 !important; }
          .dropoff-letter { font-family: 'Open Sans', Arial, sans-serif; font-size: 12pt; line-height: 1.5; color: #000; }
        }
      `}</style>
    </>
  )
}
