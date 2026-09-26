// The sign-in email and the password — for everyone with an account (moved
// here from Staff → My account, update 31). Both go through Supabase's own
// updateUser(); nothing here needs a database change.
import { useState, type FormEvent } from 'react'
import { supabase, errMessage } from '../../lib/supabase'
import { btn, Card } from '../../components/ui'
import { FormError, PasswordInput, staffInput } from '../../components/staffui'
import { authOrigin } from '../../lib/appUrl'

/**
 * Changing the sign-in email. Supabase emails a link to the new address and
 * only switches once it's opened, so until then the old one still signs in.
 */
export function EmailForm({ email, pending }: { email: string; pending: string | null }) {
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<{ to: string; from: string } | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const to = next.trim()
    if (!to) return
    if (to.toLowerCase() === email.toLowerCase()) {
      setError('That’s already your sign-in email.')
      return
    }
    setBusy(true)
    try {
      // The link comes back to the real app, to My OHRR.
      const { error } = await supabase.auth.updateUser({ email: to }, { emailRedirectTo: `${authOrigin()}/account` })
      if (error) throw error
      setSent({ to, from: email })
      setNext('')
    } catch (err) {
      setError(errMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-slate-600">
          You sign in with <strong className="break-all text-ink">{email}</strong>.
        </p>
        {sent ? (
          <div className="space-y-1 rounded-xl bg-green-50 px-3 py-2.5 text-sm text-green-800">
            <p className="font-semibold">
              We sent a link to <span className="break-all">{sent.to}</span>. Your sign-in email changes when you open it.
              Until then, keep signing in with <span className="break-all">{sent.from}</span>.
            </p>
            <p className="text-xs">If a link comes to {sent.from} as well, open that one too.</p>
          </div>
        ) : (
          pending && (
            <p className="rounded-xl bg-brand-blue-50 px-3 py-2.5 text-sm text-slate-700">
              Waiting for you to open the link sent to <strong className="break-all">{pending}</strong>.
            </p>
          )
        )}
        <label className="block text-sm font-semibold text-slate-700">
          New email
          <input
            className={staffInput}
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            required
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <FormError>{error}</FormError>
        <button type="submit" disabled={busy || !next.trim()} className={`${btn.blue} w-full disabled:opacity-60`}>
          {busy ? 'Sending…' : 'Change my email'}
        </button>
      </form>
    </Card>
  )
}

/** A new password while signed in — no email round trip. */
export function PasswordForm() {
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setDone(false)
    if (password.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    if (password !== again) {
      setError('The two passwords don’t match.')
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
      setPassword('')
      setAgain('')
    } catch (err) {
      const msg = errMessage(err)
      // "Secure password change" wants a recent sign-in.
      setError(
        /reauthenticat/i.test(msg)
          ? 'For safety this needs a fresh sign-in: sign out, sign back in, then change your password here.'
          : msg,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm font-semibold text-slate-700">
          New password
          <PasswordInput
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => {
              setDone(false)
              setPassword(e.target.value)
            }}
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Type it again
          <PasswordInput
            autoComplete="new-password"
            required
            minLength={8}
            value={again}
            onChange={(e) => {
              setDone(false)
              setAgain(e.target.value)
            }}
          />
        </label>
        <p className="text-xs text-slate-500">At least 8 characters.</p>
        <FormError>{error}</FormError>
        {done && <p className="text-sm font-bold text-green-700">Password changed.</p>}
        <button type="submit" disabled={busy || !password || !again} className={`${btn.blue} w-full disabled:opacity-60`}>
          {busy ? 'Saving…' : 'Change my password'}
        </button>
      </form>
    </Card>
  )
}
