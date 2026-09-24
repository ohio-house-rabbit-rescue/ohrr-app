// "Enter the email you applied with" — the short first step before an
// approved-only sign-up (a Bunny Socialization or Buncare shift, a volunteer
// call). The database has the final say — it refuses a sign-up from an email
// that isn't approved — but asking first means nobody fills in a whole form
// only to be turned away at the end.
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Card, btn } from '../../components/ui'
import { Icon } from '../../components/icons'
import { errMessage } from '../../lib/supabase'
import { useOrgProfile } from '../../lib/orgProfile'
import { checkMessage, kindLabel, rememberVolunteerEmail, savedVolunteerEmail, volunteerCheck, type CheckResult } from './approval'

const input =
  'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-ink outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20'

export const applyHref = (role?: string | null) => (role ? `/volunteer/apply?role=${encodeURIComponent(role)}` : '/volunteer/apply')

export default function ApprovalGate({
  where,
  role,
  what,
  onApproved,
  onOpen,
}: {
  /** The shift type's slug or the call's slug — what the email is checked against. */
  where: { type?: string; call?: string }
  /** The kind of volunteer it's for ('socialization', 'events' …). */
  role: string
  /** What they're signing up for, for the email to OHRR. */
  what: string
  onApproved: (email: string, firstName?: string) => void
  /** The check says anyone can sign up after all. */
  onOpen: () => void
}) {
  const org = useOrgProfile()
  const [email, setEmail] = useState(savedVolunteerEmail)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const check = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const r = await volunteerCheck(email.trim(), where)
      setBusy(false)
      if (r.state === 'approved') {
        rememberVolunteerEmail(email)
        onApproved(email.trim().toLowerCase(), r.firstName)
      } else if (r.state === 'open') {
        onOpen()
      } else {
        setResult(r)
      }
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
    }
  }

  // Not approved (yet): say why, and what to do next.
  if (result && result.state !== 'invalid') {
    const msg = checkMessage(result)
    const mail = `mailto:${org.email}?subject=${encodeURIComponent(`Signing up for ${what}`)}&body=${encodeURIComponent(
      `Hi OHRR,\n\nI’d like to sign up for ${what}. The email I applied with is ${email.trim()}.\n\nThank you,\n`,
    )}`
    return (
      <Card className="space-y-3">
        <p className="font-display text-lg font-extrabold text-ink">{msg.title}</p>
        <p className="text-base leading-relaxed text-slate-700">{msg.body}</p>
        <p className="text-sm text-slate-500">You entered {email.trim()}.</p>
        <div className="flex flex-col gap-2">
          {result.state !== 'closed' && (
            <Link to={applyHref(result.role ?? role)} className={`${btn.primary} w-full !py-3.5 text-base`}>
              Apply to volunteer
            </Link>
          )}
          <a href={mail} className={`${btn.outline} w-full !py-3 text-base`}>
            <Icon name="mail" size={17} /> Email OHRR
          </a>
        </div>
        <button
          type="button"
          onClick={() => setResult(null)}
          className="inline-flex min-h-[44px] w-full items-center justify-center text-base font-bold text-brand-blue"
        >
          Try another email
        </button>
      </Card>
    )
  }

  const invalid = result?.state === 'invalid' ? checkMessage(result) : null
  return (
    <Card className="space-y-3">
      <div>
        <p className="font-display text-lg font-extrabold text-ink">Enter the email you applied with</p>
        <p className="mt-1 text-base leading-relaxed text-slate-600">
          Only volunteers approved for {kindLabel(role)} can sign up here. We’ll check your email, then show you the times.
        </p>
      </div>
      <form onSubmit={check} className="space-y-3">
        <label className="block text-base font-semibold text-slate-700">
          Email
          <input
            className={input}
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {invalid && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-base text-red-700">
            <span className="font-semibold">{invalid.title}.</span> {invalid.body}
          </p>
        )}
        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-base font-semibold text-red-700">{error}</p>}
        <button type="submit" disabled={busy || !email.trim()} className={`${btn.blue} w-full !py-3.5 text-base disabled:opacity-60`}>
          {busy ? 'Checking…' : 'Continue'}
        </button>
      </form>
      <Link to={applyHref(role)} className="inline-flex min-h-[44px] items-center gap-1 text-base font-bold text-brand-blue">
        New here? Apply to volunteer <Icon name="chevron" size={16} />
      </Link>
    </Card>
  )
}
