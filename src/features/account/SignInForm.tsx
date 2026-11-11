// Sign in / Create account / Forgot password — one form for everyone (update
// 31). Staff sign in here too: /staff/signin sends people to /account with a
// `next` that goes back to the staff area, and an invite code is what adds the
// staff features to the same login.
//
// OHRR's Supabase has "Confirm email" ON (2026-11): signUp() hands back no
// session, an email with a link goes out, and the "Check your email" screen
// below takes over. If the setting is switched off, signUp() returns a session
// and that screen is simply never shown.
//
// Someone who came in by an invite link (the code is kept by pendingInvite)
// gets a shorter, warmer version: a welcome, three boxes, one button. Their
// confirmation link comes back to the join screen with the code in it, so the
// tap in the email finishes the job on whatever device they open it.
import { useState } from 'react'
import { supabase, errMessage } from '../../lib/supabase'
import { btn, Card, Screen } from '../../components/ui'
import { Icon } from '../../components/icons'
import { FormError, PasswordInput, staffInput } from '../../components/staffui'
import { authOrigin } from '../../lib/appUrl'
import { rememberPendingName, saveMyName } from './profile'
import { getPendingInvite } from '../../lib/pendingInvite'

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
  const [again, setAgain] = useState<'idle' | 'sending' | 'sent' | 'wait'>('idle')
  // They opened an invite link: its code is waiting on this phone.
  const inviteCode = getPendingInvite()
  // Where the confirmation email's link lands. With an invite, the join screen with the code in it.
  const confirmTo = inviteCode ? `${authOrigin()}/staff/join?code=${encodeURIComponent(inviteCode)}` : `${authOrigin()}/account`

  const switchTo = (m: Mode) => {
    setMode(m)
    setError(null)
    setInfo(null)
  }

  const sendAgain = async () => {
    setAgain('sending')
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: confirmTo } })
    // Supabase allows one a minute; any refusal reads the same to the person waiting.
    setAgain(error ? 'wait' : 'sent')
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
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: confirmTo } })
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
          // "Confirm email" is on: keep the name for their first sign-in.
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
        <h1 className="font-display text-2xl font-black text-ink">One more step: check your email</h1>
        <p className="text-base leading-relaxed text-slate-600">
          We just sent an email to <strong className="break-all">{email}</strong>.
        </p>
        <ol className="mx-auto max-w-sm space-y-3 text-left text-base leading-relaxed text-slate-700">
          {[
            'Open your email. Look for a new message asking you to confirm. It can say it is from “Supabase”, which sends it for OHRR.',
            'Tap the link in that email.',
            inviteCode ? 'That’s it. The link opens the app again, and you’re on the team.' : 'Come back here and sign in.',
          ].map((line, i) => (
            <li key={line} className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-blue font-display text-base font-black text-white" aria-hidden>
                {i + 1}
              </span>
              <span className="pt-0.5">{line}</span>
            </li>
          ))}
        </ol>
        <div className="mx-auto max-w-sm space-y-2 rounded-2xl bg-slate-50 px-4 py-3 text-left">
          <p className="text-sm leading-relaxed text-slate-600">No email after a few minutes? Look in your spam or junk folder. Still nothing?</p>
          <button
            type="button"
            onClick={() => void sendAgain()}
            disabled={again === 'sending'}
            className="min-h-[48px] w-full rounded-full border-2 border-brand-blue bg-white px-5 text-base font-bold text-brand-blue disabled:opacity-60"
          >
            {again === 'sending' ? 'Sending…' : 'Send it again'}
          </button>
          {again === 'sent' && (
            <p className="text-sm font-semibold text-green-800" role="status">
              Sent again. Give it a minute or two.
            </p>
          )}
          {again === 'wait' && (
            <p className="text-sm font-semibold text-slate-700" role="status">
              It can only be sent once a minute. Wait a minute, then tap Send it again.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setCheckEmail(false)
            setAgain('idle')
            switchTo('signin')
          }}
          className="min-h-[44px] text-sm font-bold text-brand-blue"
        >
          I tapped the link. Sign in
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

  // Invited: one welcome, a line or two, nothing else to read.
  const invited = Boolean(inviteCode) && mode !== 'forgot'
  const heading =
    mode === 'forgot'
      ? 'Reset password'
      : invited
        ? mode === 'signup'
          ? 'Welcome. You’re invited to the OHRR team'
          : 'Sign in to join the OHRR team'
        : mode === 'signup'
          ? 'Create your account'
          : forStaff
            ? 'Staff sign-in'
            : 'Sign in'
  const sub =
    mode === 'forgot'
      ? 'Enter your email and we’ll send a link to set a new password.'
      : invited
        ? mode === 'signup'
          ? 'Fill in the three boxes, then tap the button. That’s all.'
          : 'Use the email your invitation came to.'
        : forStaff
          ? mode === 'signup'
            ? 'Staff and volunteers use the same OHRR account as everyone else. Create it here, then tap the link in your invite email.'
            : 'Staff and volunteers use the same OHRR account as everyone else. Sign in, and the staff area opens.'
          : 'One account for the OHRR app: your favorite rabbits, saved BunFest sessions and My Bunny on any phone, and the emails you want from OHRR.'
  const submitLabel =
    status === 'submitting'
      ? 'Working…'
      : mode === 'signin'
        ? 'Sign in'
        : mode === 'signup'
          ? invited
            ? 'Create my sign-in'
            : 'Create account'
          : 'Send reset link'

  return (
    <Screen className="space-y-5">
      <div className="pt-2">
        <h1 className="font-display text-2xl font-black text-ink">{heading}</h1>
        {notice && <p className="mt-2 rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">{notice}</p>}
        <p className={`mt-1 leading-relaxed text-slate-600 ${invited ? 'text-base' : 'text-sm'}`}>{sub}</p>
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
              Your name {!invited && <span className="font-normal text-slate-400">(optional)</span>}
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
            {invited && mode === 'signup' && (
              <span className="mt-1 block text-sm font-normal text-slate-600">Use the email your invitation came to.</span>
            )}
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
              {mode === 'signup' && (
                <span className={`mt-1 block font-normal ${invited ? 'text-sm text-slate-600' : 'text-xs text-slate-500'}`}>
                  {invited ? 'Make up a new one, at least 8 characters. You’ll use it each time you sign in.' : 'At least 8 characters.'}
                </span>
              )}
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
          {mode === 'signin' ? 'New here?' : invited ? 'Already have an OHRR account?' : 'Already have an account?'}{' '}
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
