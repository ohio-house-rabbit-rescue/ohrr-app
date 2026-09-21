// Staff → Outreach letters: six ready-to-send emails (campus, vets, pet
// stores, schools, apartments, local media). Type your name once, who it is
// for, then Open in Mail / Copy / Share. The words are OHRR's own; nothing
// to write.
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../lib/auth'
import { Screen, Card, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { staffInput } from '../../../components/staffui'
import { OUTREACH, fillLetter, mailtoFor, type OutreachLetter } from '../outreach'
import { copyText } from '../share'

const SENDER_KEY = 'ohrr.outreach.sender'

export default function Outreach() {
  const { can } = useAuth()
  const [pick, setPick] = useState<OutreachLetter | null>(null)
  const [sender, setSender] = useState('')
  const [org, setOrg] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    try {
      setSender(localStorage.getItem(SENDER_KEY) ?? '')
    } catch {
      /* private mode */
    }
  }, [])
  useEffect(() => {
    try {
      if (sender) localStorage.setItem(SENDER_KEY, sender)
    } catch {
      /* ignore */
    }
  }, [sender])

  const filled = useMemo(() => (pick ? fillLetter(pick, sender, org) : null), [pick, sender, org])

  if (!can('announcements.post')) return <Screen><p className="text-sm text-slate-600">You don’t have access to outreach letters.</p></Screen>

  if (!pick) {
    return (
      <Screen className="space-y-4">
        <div className="pt-1">
          <h1 className="font-display text-2xl font-black text-ink">Outreach letters</h1>
          <p className="mt-1 text-sm text-slate-600">Ready-to-send emails that put OHRR in front of the people it is missing. Pick who you are writing to.</p>
        </div>
        <div className="space-y-2">
          {OUTREACH.map((l) => (
            <button key={l.id} type="button" onClick={() => { setPick(l); setStatus(null) }} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[15px] font-extrabold text-ink">{l.audience}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{l.when}</span>
              </span>
              <Icon name="chevron" size={18} className="shrink-0 text-slate-300" />
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">Each letter links to the right page with its own tag, so the analytics show which ones bring people in. Pair the campus, vet and store letters with a printed flyer.</p>
      </Screen>
    )
  }

  const copy = async () => {
    if (!filled) return
    setStatus((await copyText(`Subject: ${filled.subject}\n\n${filled.body}`)) ? 'Copied — paste it into any email.' : 'Could not copy. Select the text and copy it.')
  }
  const share = async () => {
    if (!filled) return
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: filled.subject, text: `${filled.subject}\n\n${filled.body}` })
        setStatus('Sent to the share sheet.')
      } else await copy()
    } catch {
      /* cancelled */
    }
  }

  return (
    <Screen className="space-y-4">
      <button type="button" onClick={() => setPick(null)} className="inline-flex min-h-[44px] items-center gap-1 text-base font-bold text-brand-blue">
        <Icon name="arrowLeft" size={20} /> Outreach letters
      </button>
      <div>
        <h1 className="font-display text-xl font-black text-ink">{pick.audience}</h1>
        <p className="mt-1 text-xs text-slate-500">{pick.when}</p>
      </div>
      <Card className="space-y-3">
        <label className="block text-sm font-semibold text-slate-700">
          Your name (signs the letter)
          <input className={staffInput} value={sender} onChange={(e) => setSender(e.target.value)} placeholder="Bev" autoComplete="name" />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Who is it for? (optional)
          <input className={staffInput} value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Ohio State Pre-Vet Club" />
        </label>
      </Card>
      {filled && (
        <>
          <a href={mailtoFor(filled.subject, filled.body)} className={`${btn.primary} w-full py-4 text-base`}>
            <Icon name="mail" size={18} /> Open in Mail
          </a>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void copy()} className={`${btn.outline} w-full`}>
              Copy the letter
            </button>
            <button type="button" onClick={() => void share()} className={`${btn.outline} w-full`}>
              <Icon name="external" size={16} /> Share
            </button>
          </div>
          {status && <p className="rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">{status}</p>}
          <Card>
            <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Subject</p>
            <p className="mt-0.5 font-semibold text-ink">{filled.subject}</p>
            <p className="mt-3 text-xs font-extrabold uppercase tracking-wider text-slate-400">Letter</p>
            <pre className="mt-1 whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">{filled.body}</pre>
          </Card>
        </>
      )}
    </Screen>
  )
}
