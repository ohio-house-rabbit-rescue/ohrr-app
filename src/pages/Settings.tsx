import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Screen, Card, SectionLabel, ActionCard, btn } from '../components/ui'
import { TEXT_SIZES, setTextSize, useTextSize } from '../lib/textSize'
import { Icon } from '../components/icons'
import { build, buildLabel } from '../data/version'
import { PHOTO_CREDITS } from '../data/photos'
import { BREED_PHOTO_CREDITS } from '../data/breeds'
import { useAuth } from '../lib/auth'
import { firstName, useMyName } from '../features/account/profile'
import InterestPicker from '../features/account/InterestPicker'
import { getDeviceInterests, joinMailingList, type Interest } from '../features/account/emailList'

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function countList(key: string): number {
  try {
    return (JSON.parse(localStorage.getItem(key) || '[]') as unknown[]).length
  } catch {
    return 0
  }
}

const inputClass =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20'

export default function Settings() {
  const { configured, user, membership } = useAuth()
  const name = firstName(useMyName(user?.id))
  const textSize = useTextSize()

  const savedSessions = countList('ohrr:bunfest:saved-sessions:v1')
  const following = countList('ohrr:following:v1')

  return (
    <>
      <PageHeader
        icon="settings"
        title="Settings"
        subtitle="Your account, text size, your saved data, and which version of the app you're on."
      />
      <Screen className="space-y-6">
        {/* ---- Your account (update 31). The old device-only "Your info" box is gone. ---- */}
        {configured &&
          (user ? (
            <section className="space-y-2">
              <SectionLabel>Your account</SectionLabel>
              <ActionCard
                to="/account"
                title={name ? `My OHRR · ${name}` : 'My OHRR'}
                subtitle="Your name, what you’ve saved, your emails and password"
                icon="user"
                tone="blue"
              />
            </section>
          ) : (
            <section className="space-y-2">
              <SectionLabel>Your account</SectionLabel>
              <Card className="space-y-3">
                <p className="font-display text-[15px] font-extrabold text-ink">
                  Save your favourites and My Bunny to an account
                </p>
                <p className="text-sm leading-relaxed text-slate-600">
                  Sign in on any phone and they’re there — and choose what OHRR emails you about. It’s free, and the
                  app works without one.
                </p>
                <div className="grid gap-2 min-[400px]:grid-cols-2">
                  <Link to="/account" className={`${btn.blue} min-h-[44px]`}>
                    Sign in
                  </Link>
                  <Link to="/account?create=1" className={`${btn.outline} min-h-[44px]`}>
                    Create account
                  </Link>
                </div>
              </Card>
              <JustEmails />
            </section>
          ))}

        {/* ---- Text size ---- */}
        <section className="space-y-2">
          <SectionLabel>Text size</SectionLabel>
          <Card className="space-y-2">
            <p className="text-sm text-slate-600">
              Make everything in the app bigger — the words, the buttons and the spaces between them.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {TEXT_SIZES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTextSize(t.value)}
                  aria-pressed={textSize === t.value}
                  className={`min-h-[52px] rounded-2xl border px-2 font-bold transition ${
                    textSize === t.value
                      ? 'border-brand-blue bg-brand-blue text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                  style={{ fontSize: `${t.scale * 0.9}rem` }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400">Applies everywhere in the app, and stays set on this device.</p>
          </Card>
        </section>

        {/* ---- Saved data summary ---- */}
        <section className="space-y-2">
          <SectionLabel>Your saved data</SectionLabel>
          <Card className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">BunFest sessions saved</span>
              <span className="font-display text-lg font-extrabold text-brand-blue">
                {savedSessions}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Bunnies followed</span>
              <span className="font-display text-lg font-extrabold text-brand-blue">{following}</span>
            </div>
            <p className="pt-1 text-xs text-slate-400">
              {user
                ? 'On this phone, and on your OHRR account so it’s there on any phone you sign in on.'
                : 'Stored on this device — it’s still here when you reopen the app.'}
            </p>
          </Card>
        </section>

        {/* Signed-in staff get a way back to their tools; a visitor sees
             nothing about staff accounts in their own settings. */}
        {membership && (
          <section className="space-y-2">
            <SectionLabel>OHRR staff</SectionLabel>
            <ActionCard
              to="/staff"
              title="Staff dashboard"
              subtitle="Your OHRR tools"
              icon="users"
              tone="blue"
            />
          </section>
        )}

        {/* ---- About / version ---- */}
        <section className="space-y-2">
          <SectionLabel>About this app</SectionLabel>
          <Card className="divide-y divide-slate-100">
            <Row label="Revision" value={`rev ${build.revision}`} />
            <Row label="Version" value={`v${build.version}`} />
            <Row label="Build" value={build.commitShort} />
            <Row label="Updated" value={fmtDate(build.builtAt)} />
          </Card>
          <p className="px-1 text-xs text-slate-400">
            Telling OHRR “{buildLabel}” says exactly which update you’re on.
          </p>
          <p className="px-1 text-xs text-slate-400">
            OHRR App · Ohio House Rabbit Rescue. Built to support rescue, adoption, education, and
            Midwest BunFest.
          </p>
          {/* The in-app page says what an account keeps and links to the full policy. */}
          <Link to="/privacy" className="inline-flex min-h-[44px] items-center gap-1 px-1 text-sm font-bold text-brand-blue">
            Privacy <Icon name="chevron" size={14} />
          </Link>
        </section>

        {/* Staff sign-in, one quiet line — a visitor scrolls past it, and
             someone who works at OHRR can find it without being told. Staff
             use the same account; signed in, what's left is the invite code. */}
        {!membership && (
          <Link
            to="/staff"
            className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <span className="inline-flex items-center gap-2">
              <Icon name="users" size={18} className="text-slate-400" />
              {user ? 'OHRR staff? Enter your invite code' : <>OHRR staff &amp; volunteer sign-in</>}
            </span>
            <Icon name="chevron" size={18} className="shrink-0 text-slate-300" />
          </Link>
        )}

        {/* ---- Photo credits: one line, opened when someone wants them.
             The licences require the credit to be available, not prominent. ---- */}
        <details className="group rounded-2xl border border-slate-200/80 bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3.5 text-sm font-semibold text-slate-600">
            Photo credits
            <Icon name="chevron" size={18} className="shrink-0 text-slate-300 transition group-open:rotate-90" />
          </summary>
          <div className="space-y-2 border-t border-slate-100 px-4 py-3">
            <p className="text-xs leading-relaxed text-slate-500">
              Sample bunny photos and the breed-guide photos are freely-licensed images from Wikimedia Commons. Thanks
              to the photographers:
            </p>
            <ul className="space-y-1.5 text-xs text-slate-500">
              {[...PHOTO_CREDITS, ...BREED_PHOTO_CREDITS.map((c) => ({ ...c, licenseUrl: c.licenseUrl || c.source }))].map((c) => (
                <li key={c.source} className="flex flex-wrap items-center gap-x-1.5">
                  <a href={c.source} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-blue underline">
                    {c.author}
                  </a>
                  <span className="text-slate-400">·</span>
                  <a href={c.licenseUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 underline">
                    {c.license}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </details>
      </Screen>
    </>
  )
}

/**
 * "Just want emails?" — the list without an account: name, email, what about,
 * and the consent line. join_mailing_list (source 'app'); before update 31 it
 * falls back to the Inbox's mailing-list request.
 */
function JustEmails() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [interests, setInterests] = useState<Interest[]>(() => {
    const ticked = getDeviceInterests()
    return ticked.length > 0 ? ticked : ['newsletter']
  })
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (interests.length === 0) {
      setError('Tick at least one.')
      return
    }
    setStatus('sending')
    try {
      await joinMailingList({ name, email, interests, source: 'app' })
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign you up right now.')
      setStatus('idle')
    }
  }

  return (
    <details className="group rounded-2xl border border-slate-200/80 bg-white">
      <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-2 px-4 py-3.5 text-sm font-semibold text-slate-600">
        Just want emails?
        <Icon name="chevron" size={18} className="shrink-0 text-slate-300 transition group-open:rotate-90" />
      </summary>
      <div className="border-t border-slate-100 px-4 py-3">
        {status === 'done' ? (
          <p className="text-sm font-semibold text-green-700">Thanks{name.trim() ? `, ${name.trim().split(/\s+/)[0]}` : ''} — you’re on OHRR’s email list.</p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700">
              Name
              <input className={inputClass} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Email
              <input
                className={inputClass}
                type="email"
                required
                autoComplete="email"
                autoCapitalize="none"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <InterestPicker value={interests} onChange={setInterests} />
            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
            <button type="submit" disabled={status === 'sending'} className={`${btn.primary} w-full disabled:opacity-60`}>
              {status === 'sending' ? 'Signing you up…' : 'Email me'}
            </button>
          </form>
        )}
      </div>
    </details>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm first:pt-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono font-semibold text-ink">{value}</span>
    </div>
  )
}
