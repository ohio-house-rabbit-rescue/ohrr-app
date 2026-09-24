// /staff/hours-letter?email=&name=&kind=&from=&to= — a volunteer's hours letter,
// written from the record.
//
// Five kinds, because the people asking are different: a school giving credit,
// a service member's command (the Military Outstanding Volunteer Service Medal),
// an employer's volunteer programme, "to whom it may concern", and a
// certificate of appreciation to frame. The volunteer's details (their
// school, branch, employer) are remembered on their record from sign-up, so a
// letter is a couple of taps. Every letter thanks them.
//
// Print or save as PDF on a computer; in the phone app, share the page image.
//
// Certificates are OHRR's to give (update 25): only staff who make volunteer
// certificates see that kind. "Certificates to consider" on the staff home
// opens this screen with ?kind=certificate&heading=achievement|appreciation
// &suggestion=<id>; printing, saving or sharing the certificate marks that
// suggestion as made. The signer's name can be written as the signature.
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { supabase, errMessage } from '../../../lib/supabase'
import { btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner, staffInput } from '../../../components/staffui'
import { hoursHistory, type HoursLine } from '../api'
import { isNative } from '../../../native/platform'
import { canvasToBlob } from '../../share/render'
import { savePngAsync } from '../../share/share'
import { canvasToPdf } from '../../../lib/pdf'
import { exportBlob } from '../../../lib/exportFile'
import { fmtHours } from '../../volunteers/calls'
import { LETTER_KINDS, buildLetter, letterText, longDate, type LetterInput, type LetterKind } from '../../volunteers/letters'
import { paintCertificate, paintLetter } from '../../volunteers/paint'
import { useOrgBits } from '../../volunteers/orgBits'

const iso = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

function periodFor(p: string): { from: string; to: string } {
  const now = new Date()
  const y = now.getFullYear()
  if (p === 'last-year') return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` }
  if (p === '12') {
    const a = new Date(now)
    a.setFullYear(y - 1)
    a.setDate(a.getDate() + 1)
    return { from: iso(a), to: iso(now) }
  }
  if (p === 'all') return { from: '2009-01-01', to: iso(now) }
  return { from: `${y}-01-01`, to: iso(now) }
}

const PERIODS = new Set(['year', 'last-year', '12', 'all'])

export default function ServiceLetter() {
  const { membership, user, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const org = useOrgBits()
  const [params] = useSearchParams()
  const email = params.get('email') ?? ''
  const name = params.get('name') || email
  // A certificate is for the staff who make them.
  const kinds = LETTER_KINDS.filter((k) => k.value !== 'certificate' || can('volunteers.certificates'))
  const startKind = params.get('kind')
  const [kind, setKind] = useState<LetterKind>(
    startKind && kinds.some((k) => k.value === startKind) ? (startKind as LetterKind) : 'general',
  )
  const startPeriod = params.get('from') ? 'custom' : PERIODS.has(params.get('period') ?? '') ? (params.get('period') as string) : 'year'
  const [period, setPeriod] = useState(startPeriod)
  const [from, setFrom] = useState(params.get('from') ?? periodFor(startPeriod === 'custom' ? 'year' : startPeriod).from)
  const [to, setTo] = useState(params.get('to') ?? periodFor(startPeriod === 'custom' ? 'year' : startPeriod).to)
  const [heading, setHeading] = useState<'appreciation' | 'achievement'>(params.get('heading') === 'achievement' ? 'achievement' : 'appreciation')
  const [signed, setSigned] = useState(true)
  const suggestion = params.get('suggestion')
  const [marked, setMarked] = useState(false)
  const [details, setDetails] = useState<Record<string, string>>({})
  const [volunteerId, setVolunteerId] = useState<string | null>(null)
  const [lines, setLines] = useState<HoursLine[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [savedDetails, setSavedDetails] = useState(false)

  // What they told us at sign-up: the kind of letter, and its details.
  useEffect(() => {
    if (!orgId || !email) return
    supabase
      .from('volunteers')
      .select('id, hours_for, letter_details')
      .eq('org_id', orgId)
      // Case-insensitive, but literal: `_` and `%` are wildcards to ilike, and `_` is common in emails.
      .ilike('email', email.replace(/[\\%_]/g, (c) => '\\' + c))
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setVolunteerId(data.id)
        setDetails((d) => ({ ...(data.letter_details ?? {}), ...d }))
        if (!startKind && data.hours_for) {
          const k = { school: 'school', military: 'military', workplace: 'workplace', community: 'general', other: 'general' }[data.hours_for] as LetterKind
          setKind(k)
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, email])

  useEffect(() => {
    if (!orgId || !email) return
    setLines(null)
    hoursHistory(orgId, email, from, to)
      .then((l) => setLines([...l].sort((a, b) => a.on_date.localeCompare(b.on_date))))
      .catch((e) => setError(errMessage(e)))
  }, [orgId, email, from, to])

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  // "Everything" starts from their first recorded day, not the rescue's founding.
  const letterFrom = period === 'all' && lines && lines.length > 0 ? lines[0].on_date : from
  const input: LetterInput | null = lines ? { kind, name, details, from: letterFrom, to, lines, org, today } : null
  const letter = useMemo(() => (input ? buildLetter(input) : null), [input])
  const kindMeta = LETTER_KINDS.find((k) => k.value === kind)!
  const certTitle = heading === 'achievement' ? 'Certificate of Achievement' : 'Certificate of Appreciation'
  const title = kind === 'certificate' ? certTitle : (letter?.title ?? '')
  const sign = signed && Boolean(org.signerName)
  const fileBase = `ohrr-${kind}-hours-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`

  // The certificate they came here to make: take it off "Certificates to consider".
  const markMade = async () => {
    if (!suggestion || marked || kind !== 'certificate') return
    const { error } = await supabase
      .from('certificate_suggestions')
      .update({ status: 'made', handled_by: user?.id ?? null, handled_at: new Date().toISOString() })
      .eq('id', suggestion)
    if (!error) setMarked(true)
  }

  const paint = async (): Promise<HTMLCanvasElement | null> => {
    if (!letter || !input) return null
    const canvas = document.createElement('canvas')
    if (kind === 'certificate') {
      await paintCertificate(canvas, { name, lines: letter.paragraphs.slice(1), date: today, signer: letter.signer, org, heading: certTitle, signed: sign })
    } else {
      await paintLetter(canvas, {
        date: today,
        recipient: letter.recipient,
        title: letter.title,
        salutation: letter.salutation,
        paragraphs: letter.paragraphs,
        table: letter.table ? { lines: input.lines, total: letter.total } : undefined,
        closing: letter.closing,
        signer: letter.signer,
        signed: sign,
        footer: letter.footer,
        org,
      })
    }
    return canvas
  }

  const share = async () => {
    setSharing(true)
    try {
      const canvas = await paint()
      if (canvas) {
        const r = await savePngAsync(await canvasToBlob(canvas), `${fileBase}.png`)
        if (r !== 'cancelled') await markMade()
      }
    } catch (e) {
      setError(errMessage(e))
    }
    setSharing(false)
  }

  const savePdf = async () => {
    setSharing(true)
    try {
      const canvas = await paint()
      if (canvas) {
        const r = await exportBlob(`${fileBase}.pdf`, await canvasToPdf(canvas, `${title} - ${name}`))
        if (r === 'saved' || r === 'shared') await markMade()
      }
    } catch (e) {
      setError(errMessage(e))
    }
    setSharing(false)
  }

  const saveDetails = async () => {
    if (!volunteerId) return
    const { error } = await supabase.from('volunteers').update({ letter_details: details }).eq('id', volunteerId)
    if (error) setError(errMessage(error))
    else {
      setSavedDetails(true)
      setTimeout(() => setSavedDetails(false), 1800)
    }
  }

  return (
    <>
      <div className="space-y-4 px-5 pt-3 print:hidden">
        <Link to="/staff/volunteers" className="inline-flex min-h-[44px] items-center gap-1 text-base font-bold text-brand-blue">
          <Icon name="arrowLeft" size={20} /> Volunteers
        </Link>
        <div>
          <h1 className="font-display text-2xl font-black text-ink">Hours letter for {name}</h1>
          <p className="text-sm text-slate-600">Written from the hours on record. Every letter thanks them.</p>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-700">Who it’s for</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {kinds.map((k) => (
              <button
                key={k.value}
                type="button"
                aria-pressed={kind === k.value}
                onClick={() => setKind(k.value)}
                className={`min-h-[44px] rounded-full px-4 text-sm font-bold ${kind === k.value ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
              >
                {k.value === 'certificate' ? 'Certificate' : k.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">{kindMeta.hint}</p>
        </div>

        {kind === 'certificate' && (
          <div>
            <p className="text-sm font-semibold text-slate-700">Certificate of</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {(
                [
                  ['appreciation', 'Appreciation'],
                  ['achievement', 'Achievement'],
                ] as const
              ).map(([h, label]) => (
                <button
                  key={h}
                  type="button"
                  aria-pressed={heading === h}
                  onClick={() => setHeading(h)}
                  className={`min-h-[44px] rounded-full px-4 text-sm font-bold ${heading === h ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-500">Achievement suits an hours mark; appreciation suits anything.</p>
          </div>
        )}

        {org.signerName && (
          <label className="flex min-h-[44px] items-center gap-3 text-sm font-semibold text-slate-700">
            <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-brand-blue" checked={signed} onChange={(e) => setSigned(e.target.checked)} />
            Sign with {org.signerName}’s name
          </label>
        )}

        {kindMeta.ask.length > 0 && (
          <div className="space-y-2">
            {kindMeta.ask.map((q) => (
              <label key={q.key} className="block text-sm font-semibold text-slate-700">
                {q.label}
                <input className={staffInput} placeholder={q.placeholder} value={details[q.key] ?? ''} onChange={(e) => setDetails({ ...details, [q.key]: e.target.value })} />
              </label>
            ))}
            {volunteerId && (
              <button type="button" onClick={() => void saveDetails()} className="text-sm font-bold text-brand-blue">
                {savedDetails ? 'Saved to their record' : 'Keep these on their record'}
              </button>
            )}
          </div>
        )}

        <div>
          <p className="text-sm font-semibold text-slate-700">Which hours</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {(
              [
                ['year', 'This year'],
                ['last-year', 'Last year'],
                ['12', 'Last 12 months'],
                ['all', 'Everything'],
                ['custom', 'Choose dates'],
              ] as const
            ).map(([p, label]) => (
              <button
                key={p}
                type="button"
                aria-pressed={period === p}
                onClick={() => {
                  setPeriod(p)
                  if (p !== 'custom') {
                    const r = periodFor(p)
                    setFrom(r.from)
                    setTo(r.to)
                  }
                }}
                className={`min-h-[44px] rounded-full px-4 text-sm font-bold ${period === p ? 'bg-ink text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <label className="block text-sm font-semibold text-slate-700">
                From
                <input type="date" className={staffInput} value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                To
                <input type="date" className={staffInput} value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
            </div>
          )}
        </div>

        {!org.signerName && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Nobody is set to sign these yet, so the letter has a blank signature line.{' '}
            <Link to="/staff/details" className="font-bold underline">
              Set who signs
            </Link>
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {isNative ? (
            <button type="button" onClick={() => void share()} className={btn.primary} disabled={!letter || sharing}>
              <Icon name="printer" size={16} /> {sharing ? 'Making the letter…' : 'Print / share the letter'}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  window.print()
                  void markMade()
                }}
                className={btn.primary}
                disabled={!letter}
              >
                <Icon name="printer" size={16} /> Print
              </button>
              <button type="button" onClick={() => void savePdf()} className={btn.blue} disabled={!letter || sharing}>
                {sharing ? 'Making the PDF…' : 'Save as PDF'}
              </button>
            </>
          )}
          {letter && input && (
            <a
              href={`mailto:${email}?subject=${encodeURIComponent(`${title} — ${name}`)}&body=${encodeURIComponent(letterText(letter, input))}`}
              className={btn.outline}
            >
              <Icon name="mail" size={16} /> Email it to {name.split(' ')[0]}
            </a>
          )}
        </div>
        {marked && <p className="text-sm font-bold text-green-700">Done — it’s off the Certificates to consider list.</p>}
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        {lines === null && !error && <Spinner />}
        {lines && lines.length === 0 && (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">No hours are recorded for {name} in these dates.</p>
        )}
      </div>

      {letter && input && kind === 'certificate' && (
        <div className="letter mx-5 my-5 rounded-2xl border-[10px] border-double border-brand-blue bg-white p-10 text-center print:m-0 print:rounded-none">
          <img src="/ohrr-mark.png" alt="" className="mx-auto h-24 w-24" />
          <p className="mt-6 font-display text-lg font-extrabold tracking-[0.2em] text-brand-orange">{certTitle.toUpperCase()}</p>
          <p className="mt-6 font-display text-5xl font-black text-ink">{name}</p>
          {letter.paragraphs.slice(1).map((p) => (
            <p key={p} className="mx-auto mt-5 max-w-xl text-xl leading-relaxed text-slate-700">
              {p}
            </p>
          ))}
          <div className="mx-auto mt-16 grid max-w-2xl grid-cols-2 gap-10 text-sm text-slate-600">
            <div>
              <div className="flex h-10 items-end justify-center border-b border-slate-400">
                {sign && <span className="signature text-3xl leading-none text-blue-900">{letter.signer.name}</span>}
              </div>
              <p className="mt-2 font-bold text-ink">{letter.signer.name || 'Signature'}</p>
              <p>{letter.signer.title ? `${letter.signer.title}, ${org.name}` : org.name}</p>
            </div>
            <div>
              <div className="h-10 border-b border-slate-400" />
              <p className="mt-2 font-bold text-ink">{today}</p>
              <p>Date</p>
            </div>
          </div>
        </div>
      )}

      {letter && input && kind !== 'certificate' && (
        <div className="letter mx-5 my-5 rounded-2xl border border-slate-200 bg-white p-6 print:m-0 print:rounded-none print:border-0 print:p-0">
          <div className="flex items-center gap-3 border-b-4 border-brand-blue pb-4">
            <img src="/ohrr-mark.png" alt="" className="h-14 w-14" />
            <div>
              <p className="font-display text-xl font-black text-brand-blue">{org.name}</p>
              <p className="text-sm text-slate-600">
                {[org.address, org.email].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <p className="mt-6 text-sm text-slate-600">{today}</p>
          {letter.recipient.length > 0 && (
            <div className="mt-4 text-base text-ink">
              {letter.recipient.map((r) => (
                <p key={r}>{r}</p>
              ))}
            </div>
          )}
          <h1 className="mt-5 font-display text-2xl font-black text-ink">{letter.title}</h1>
          {letter.salutation && <p className="mt-4 text-base text-ink">{letter.salutation}</p>}
          {letter.paragraphs.map((p) => (
            <p key={p} className="mt-3 text-base leading-relaxed text-ink">
              {p}
            </p>
          ))}
          {letter.table && (
            <table className="mt-5 w-full text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-1.5 pr-3">Date</th>
                  <th className="py-1.5 pr-3">Activity</th>
                  <th className="py-1.5 text-right">Hours</th>
                </tr>
              </thead>
              <tbody>
                {input.lines.map((l, i) => (
                  <tr key={`${l.on_date}-${i}`} className="border-b border-slate-100">
                    <td className="whitespace-nowrap py-1.5 pr-3">{longDate(l.on_date)}</td>
                    <td className="py-1.5 pr-3">{l.activity.replace(/\s*\(volunteer call\)$/i, '')}</td>
                    <td className="py-1.5 text-right">{fmtHours(l.hours)}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className="py-2" colSpan={2}>
                    Total
                  </td>
                  <td className="py-2 text-right">{fmtHours(letter.total)} hours</td>
                </tr>
              </tbody>
            </table>
          )}
          <p className="mt-6 text-base text-ink">{letter.closing}</p>
          <div className="mt-10 max-w-xs text-sm text-slate-600">
            <div className="flex h-10 items-end border-b border-slate-400">
              {sign && <span className="signature pl-2 text-3xl leading-none text-blue-900">{letter.signer.name}</span>}
            </div>
            {letter.signer.name && <p className="mt-1 font-bold text-ink">{letter.signer.name}</p>}
            {letter.signer.title && <p>{letter.signer.title}</p>}
            <p>{org.name}</p>
          </div>
        </div>
      )}
      <style>{`
        @font-face { font-family: 'OHRR Signature'; src: url(/fonts/dancing-script-600.woff2) format('woff2'); font-weight: 600; font-display: swap; }
        .signature { font-family: 'OHRR Signature', cursive; font-weight: 600; }
        @media print {
          @page { size: letter; margin: 0.8in; }
          header, nav, [data-tabbar] { display: none !important; }
          [class*="max-w-[480px]"] { max-width: none !important; box-shadow: none !important; }
          .letter { font-size: 12pt; }
        }
      `}</style>
    </>
  )
}
