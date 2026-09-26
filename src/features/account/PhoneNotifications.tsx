// "Notifications on this phone" (My OHRR) and the one-time question in the
// "For you" area on Home (update 32 — web push; see push.ts). Signed in or
// not: the database takes a phone either way. "Send me a test" needs sign-in.
// Inside the Android / iOS app there's no web push: the section says so and
// the phone reminders carry on as before.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { PushTopic } from '../../lib/database.types'
import { Card, SectionLabel, btn } from '../../components/ui'
import { Icon } from '../../components/icons'
import { FormError, Spinner } from '../../components/staffui'
import {
  NOT_READY,
  NOT_YET,
  PUSH_TOPICS,
  PermissionDenied,
  currentSubscription,
  decidePrompt,
  defaultTopics,
  howToAllow,
  loadTopics,
  notificationPermission,
  promptDecided,
  pushPublicKey,
  pushSupport,
  saveSubscription,
  sendTestNotification,
  turnOffPush,
  turnOnPush,
} from './push'

type State =
  | { kind: 'loading' | 'native' | 'home-screen' | 'unsupported' | 'missing' | 'not-ready' | 'denied' | 'error' }
  | { kind: 'ready'; sub: PushSubscription | null }

const NATIVE_NOTE =
  'Notifications when the app is closed come with the app-store version. For now, reminders you set on this phone still work.'
const HOME_SCREEN_NOTE = 'On iPhone: tap Share → Add to Home Screen, open OHRR from there, then turn this on.'

export function PhoneNotificationsSection({ signedIn }: { signedIn: boolean }) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [topics, setTopics] = useState<PushTopic[]>(defaultTopics)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const support = pushSupport()
    if (support !== 'ok') {
      setState({ kind: support })
      return
    }
    let alive = true
    void (async () => {
      try {
        const key = await pushPublicKey(true)
        if (!alive) return
        if (key === 'missing') return setState({ kind: 'missing' })
        if (!key) return setState({ kind: 'not-ready' })
        if (notificationPermission() === 'denied') return setState({ kind: 'denied' })
        const sub = await currentSubscription()
        const saved = sub ? await loadTopics(sub) : null
        if (!alive) return
        if (saved === 'missing') return setState({ kind: 'missing' })
        if (saved) setTopics(saved)
        // A subscription the database has forgotten counts as off.
        setState({ kind: 'ready', sub: saved ? sub : null })
      } catch {
        if (alive) setState({ kind: 'error' })
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // Signed out, the phone app has nothing to add here.
  if (state.kind === 'native' && !signedIn) return null

  const sub = state.kind === 'ready' ? state.sub : null
  const on = Boolean(sub)

  const run = async (op: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      await op()
    } catch (e) {
      if (e instanceof PermissionDenied) setState({ kind: 'denied' })
      else if (e instanceof Error && e.message === NOT_READY) setState({ kind: 'not-ready' })
      else if (e instanceof Error && e.message === NOT_YET) setState({ kind: 'missing' })
      else setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const flip = () =>
    run(async () => {
      if (sub) {
        await turnOffPush(sub)
        setState({ kind: 'ready', sub: null })
        setMsg('Off — OHRR won’t send notifications to this phone.')
        return
      }
      if (topics.length === 0) throw new Error('Tick at least one first.')
      const made = await turnOnPush(topics)
      setState({ kind: 'ready', sub: made })
      setMsg('On — you’ll get a notification about what’s ticked.')
    })

  const tick = (k: PushTopic) => {
    const next = PUSH_TOPICS.map((t) => t.key).filter((x) => (x === k ? !topics.includes(k) : topics.includes(x)))
    if (sub && next.length === 0) {
      setError('Tick at least one, or turn notifications off.')
      return
    }
    setTopics(next)
    if (sub) void run(() => saveSubscription(sub, next).then(() => setMsg('Saved.')))
  }

  const test = () =>
    run(async () => {
      if (!sub) return
      await sendTestNotification(sub, topics)
      setMsg('Sent — it should arrive in a few seconds.')
    })

  return (
    <section className="space-y-2">
      <SectionLabel>Notifications on this phone</SectionLabel>
      {state.kind === 'loading' ? (
        <Card>
          <Spinner />
        </Card>
      ) : state.kind === 'ready' ? (
        <Card className="space-y-3">
          <button
            type="button"
            role="switch"
            aria-checked={on}
            disabled={busy}
            onClick={() => void flip()}
            className="flex min-h-[48px] w-full items-center justify-between gap-3 text-left disabled:opacity-60"
          >
            <span>
              <span className="block font-display text-[15px] font-extrabold text-ink">Notify me on this phone</span>
              <span className="block text-sm text-slate-500">
                {on ? 'When OHRR has news about what you tick' : 'Off — tick what you’d like, then turn this on'}
              </span>
            </span>
            <span
              aria-hidden
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${on ? 'bg-brand-blue' : 'bg-slate-300'}`}
            >
              <span className={`absolute h-6 w-6 rounded-full bg-white shadow transition ${on ? 'left-[22px]' : 'left-0.5'}`} />
            </span>
          </button>
          <fieldset className="space-y-1 border-t border-slate-100 pt-2" disabled={busy}>
            <legend className="sr-only">Notify me about</legend>
            {PUSH_TOPICS.map((t) => (
              <label key={t.key} className="flex min-h-[44px] items-center gap-2.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0 rounded border-slate-300 text-brand-blue"
                  checked={topics.includes(t.key)}
                  onChange={() => tick(t.key)}
                />
                {t.label}
              </label>
            ))}
          </fieldset>
          <FormError>{error}</FormError>
          {msg && !busy && <p className="text-sm font-bold text-green-700">{msg}</p>}
          {on &&
            (signedIn ? (
              <button type="button" disabled={busy} onClick={() => void test()} className={`${btn.outline} w-full disabled:opacity-60`}>
                Send me a test
              </button>
            ) : (
              <p className="text-xs text-slate-500">Sign in to send yourself a test.</p>
            ))}
          <p className="text-xs leading-relaxed text-slate-500">
            Only for this phone{signedIn ? '' : ', and you don’t need an account'}. Turn it off here any time.
          </p>
        </Card>
      ) : (
        <Card>
          <p className="text-sm leading-relaxed text-slate-600">
            {state.kind === 'native'
              ? NATIVE_NOTE
              : state.kind === 'home-screen'
                ? HOME_SCREEN_NOTE
                : state.kind === 'denied'
                  ? howToAllow()
                  : state.kind === 'missing'
                    ? NOT_YET
                    : state.kind === 'not-ready'
                      ? NOT_READY
                      : state.kind === 'unsupported'
                        ? 'This browser can’t take notifications from OHRR. On Android, use Chrome; on iPhone, add OHRR to the Home Screen.'
                        : 'Couldn’t check notifications just now. Check your connection and open this page again.'}
          </p>
        </Card>
      )}
    </section>
  )
}

/**
 * The one-time question in the "For you" area on Home, for people who haven't
 * decided: only where it can work (a browser with web push, iPhone from the
 * Home Screen) and once the notifications are switched on. "Yes" turns on
 * volunteer calls; the rest is in My OHRR.
 */
export function NotificationsPrompt({ className = '' }: { className?: string }) {
  const [show, setShow] = useState(false)
  const [phase, setPhase] = useState<'ask' | 'busy' | 'on' | 'denied' | 'error'>('ask')
  const [error, setError] = useState('')

  useEffect(() => {
    if (pushSupport() !== 'ok' || promptDecided() || notificationPermission() !== 'default') return
    let alive = true
    pushPublicKey(false)
      .then((k) => {
        if (alive && k && k !== 'missing') setShow(true)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  if (!show) return null

  const yes = async () => {
    setPhase('busy')
    try {
      await turnOnPush(['volunteer'])
      setPhase('on')
    } catch (e) {
      decidePrompt()
      if (e instanceof PermissionDenied) setPhase('denied')
      else {
        setError(e instanceof Error ? e.message : 'Something went wrong.')
        setPhase('error')
      }
    }
  }
  const close = () => {
    decidePrompt()
    setShow(false)
  }

  return (
    <section aria-label="Notifications" className={`rounded-2xl border border-brand-blue/25 bg-white px-3.5 py-3 shadow-sm ${className}`}>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-blue-50 text-brand-blue">
          <Icon name="device" size={20} />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          {phase === 'on' ? (
            <p className="text-sm leading-relaxed text-slate-700">
              Done — you’ll get a notification when OHRR needs volunteers. Events and new rabbits too?{' '}
              <Link to="/account" className="font-bold text-brand-blue">
                Choose in My OHRR
              </Link>
              .
            </p>
          ) : phase === 'denied' ? (
            <p className="text-sm leading-relaxed text-slate-700">{howToAllow()}</p>
          ) : phase === 'error' ? (
            <p className="text-sm leading-relaxed text-slate-700">{error}</p>
          ) : (
            <>
              <p className="font-display text-[15px] font-extrabold leading-snug text-ink">
                Get a notification when OHRR needs volunteers?
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={phase === 'busy'}
                  onClick={() => void yes()}
                  className="inline-flex min-h-[44px] items-center rounded-full bg-brand-blue px-4 text-sm font-bold text-white disabled:opacity-60"
                >
                  {phase === 'busy' ? 'Turning on…' : 'Yes, notify me'}
                </button>
                <button
                  type="button"
                  disabled={phase === 'busy'}
                  onClick={close}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-slate-200 px-4 text-sm font-bold text-slate-600"
                >
                  No thanks
                </button>
              </div>
            </>
          )}
        </div>
        {phase !== 'ask' && phase !== 'busy' && (
          <button type="button" aria-label="Close" onClick={close} className="-mr-1.5 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center text-slate-400">
            <Icon name="x" size={18} />
          </button>
        )}
      </div>
    </section>
  )
}
