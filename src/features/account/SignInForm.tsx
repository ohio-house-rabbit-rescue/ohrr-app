// Sign in / Create account / Forgot password — one form for everyone (update
// 31). Staff sign in here too: /staff/signin sends people to /account with a
// `next` that goes back to the staff area, and an invite code is what adds the
// staff features to the same login.
//
// Sign-up needs no confirmation email (OHRR's Supabase has "Confirm email"
// off), so signUp() hands back a session straight away; if that setting is
// ever turned back on, the "Confirm your email" screen below still covers it.
import { useState } from 'react'
import { supabase, errMessage } from '../../lib/supabase'
import { btn, Card, Screen } from '../../components/ui'
import { Icon } from '../../components/icons'
import { FormError, PasswordInput, staffInput } from '../../components/staffui'
import { authOrigin } from '../../lib/appUrl'
import { rememberPendingName, saveMyName } from './profile'

type Mode = 'signin' | 'signup' | 'forgot'

export default function SignInForm({
  startWith = 'signin',
  forStaff = false,
  notice,
}: {
  startWith?: Mode
  /** Heading for the staff area (they came from /staff/signin). */
  forStaff?: boolean
  /** A green line at the top, e.g. "Your account has been deleted." */
  notice?: string
}) {
  const [mode, setMode] = useState<Mode>(startWith)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting'>('idle')
  const [error, setError] = useState<string | null>(null)
  // A plain note above the form, e.g. "That email already has an account."
  const [info, setInfo] = useState<string | null>(null)
  const [checkEmail, setCheckEmail] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const switchTo = (m: Mode) => {
    setMode(m)
    setError(null)
    setInfo(null)
  }

  const onSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setStatus('submitting')
    try {
      if (mode === 'forgot') {
        // Always point the email at the real app — someone who opened the old
        // netlify.app mirror would otherwise be sent back to it.
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${authOrigin()}/account/reset`,
        })
        if (error) throw error
        setResetSent(true)
        return
      }
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
        // That email already has an account. Depending on the project's
        // settings Supabase either says so, or hands back a user with no
        // identities and no session — and then no email ever comes, so
        // "Confirm your email" would be a dead end. Send them to sign in.
        const taken =
          (error && (error.code === 'user_already_exists' || /already (registered|exists)/i.test(error.message))) ||
          (!error && data.user && data.user.identities?.length === 0)
        if (taken) {
          setMode('signin')
          setInfo('That email already has an account. Sign in instead, or use Forgot password.')
          return
        }
        if (error) throw error
        if (!data.session) {
          // "Confirm email" is on after all: keep the name for their first sign-in.
          rememberPendingName(name)
          setCheckEmail(true)
          return
        }
        // The name is optional, and an account without one works fine.
        if (name.trim() && data.user) await saveMyName(data.user.id, name).catch(() => rememberPendingName(name))
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      }
      // Signed in: the page this form sits on takes it from here.
    } catch (err) {
      setError(errMessage(err))
    } finally {
      setStatus('idle')
    }
  }

  // Signup with "Confirm email" on: the interstitial.
  if (checkEmail) {
    return (
      <Screen className="space-y-4 text-center">
        <div className="pt-6 text-brand-blue" aria-hidden>
          <Icon name="mail" size={40} className="mx-auto" />
        </div>
        <h1 className="font-display text-xl font-extrabold text-ink">Confirm your email</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          We sent a confirmation link to <strong>{email}</strong>. Open it, then come back and sign in.
        </p>
        <button
          type="button"
          onClick={() => {
            setCheckEmail(false)
            switchTo('signin')
          }}
          className={`${btn.blue} mx-auto`}
        >
          Back to sign in
        </button>
      </Screen>
    )
  }

  // Forgot password: "check your email for the reset link" interstitial.
  if (resetSent) {
    return (
      <Screen className="space-y-4 text-center">
        <div className="pt-6 text-brand-blue" aria-hidden>
          <Icon name="mail" size={40} className="mx-auto" />
        </div>
        <h1 className="font-display text-xl font-extrabold text-ink">Check your email</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          If an account exists for <strong>{email}</strong>, we sent a link to reset your password.
        </p>
        <ul className="mx-auto max-w-sm space-y-1.5 text-left text-sm text-slate-600">
          <li className="flex gap-2">
            <span className="text-brand-orange">•</span> Open it on <strong>this device</strong> if you can — that's
            where the new password gets set.
          </li>
          <li className="flex gap-2">
            <span className="text-brand-orange">•</span> It works <strong>once</strong>, and expires after about an
            hour.
          </li>
          <li className="flex gap-2">
            <span className="text-brand-orange">•</span> Nothing after a few minutes? Check spam — it comes from
            Supabase on OHRR's behalf.
          </li>
        </ul>
        <button
          type="button"
          onClick={() => {
            setResetSent(false)
            switchTo('signin')
          }}
          className={`${btn.blue} mx-auto`}
        >
          Back to sign in
        </button>
      </Screen>
    )
  }

  const heading =
    mode === 'forgot'
      ? 'Reset password'
      : mode === 'signup'
        ? 'Create your account'
        : forStaff
          ? 'Staff sign-in'
          : 'Sign in'
  const sub =
    mode === 'forgot'
      ? 'Enter your email and we’ll send a link to set a new password.'
      : forStaff
        ? 'Staff and volunteers use the same OHRR account as everyone else. Sign in, and the staff area opens.'
        : 'One account for the OHRR app: your favourite rabbits, saved BunFest sessions and My Bunny on any phone, and the emails you want from OHRR.'
  const submitLabel =
    status === 'submitting'
      ? 'Working…'
      : mode === 'signin'
        ? 'Sign in'
        : mode === 'signup'
          ? 'Create account'
          : 'Send reset link'

  return (
    <Screen className="space-y-5">
      <div className="pt-2">
        <h1 className="font-display text-2xl font-black text-ink">{heading}</h1>
        {notice && <p className="mt-2 rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">{notice}</p>}
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{sub}</p>
        {mode === 'signup' && forStaff && (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            After you create your account, you’ll enter the invite code the person bringing you on gave you.
          </p>
        )}
      </div>

      {info && (
        <p className="rounded-xl bg-brand-blue-50 px-3 py-2.5 text-sm font-semibold text-brand-blue-dark" role="status">
          {info}
        </p>
      )}

      <Card>
        <form onSubmit={onSubmit} className="space-y-3">
          {mode === 'signup' && (
            <label className="block text-sm font-semibold text-slate-700">
              Your name <span className="font-normal text-slate-400">(optional)</span>
              <input
                className={staffInput}
                autoComplete="name"
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          <label className="block text-sm font-semibold text-slate-700">
            Email
            <input
              className={staffInput}
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {mode !== 'forgot' && (
            <label className="block text-sm font-semibold text-slate-700">
              Password
              <PasswordInput
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {mode === 'signup' && <span className="mt-1 block text-xs font-normal text-slate-500">At least 8 characters.</span>}
            </label>
          )}

          {mode === 'signin' && (
            <button
              type="button"
              onClick={() => switchTo('forgot')}
              className="min-h-[44px] text-sm font-semibold text-brand-blue hover:text-brand-blue-dark"
            >
              Forgot password?
            </button>
          )}

          <FormError>{error}</FormError>

          <button type="submit" disabled={status === 'submitting'} className={`${btn.primary} w-full disabled:opacity-60`}>
            {submitLabel}
          </button>
        </form>
      </Card>

      {mode === 'forgot' ? (
        <p className="text-center text-sm text-slate-500">
          <button
            type="button"
            onClick={() => switchTo('signin')}
            className="min-h-[44px] font-bold text-brand-blue hover:text-brand-blue-dark"
          >
            ← Back to sign in
          </button>
        </p>
      ) : (
        <p className="text-center text-sm text-slate-500">
          {mode === 'signin' ? 'New here?' : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => switchTo(mode === 'signin' ? 'signup' : 'signin')}
            className="min-h-[44px] font-bold text-brand-blue hover:text-brand-blue-dark"
          >
            {mode === 'signin' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      )}
    </Screen>
  )
}
