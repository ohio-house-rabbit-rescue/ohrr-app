import { useState } from 'react'
import type { FormEvent } from 'react'
import { PageHeader, Screen, Card, SectionLabel, ActionCard, btn } from '../components/ui'
import { build } from '../data/version'
import { PHOTO_CREDITS } from '../data/photos'
import { useProfile, saveProfile, clearProfile } from '../lib/profile'
import { useAuth } from '../lib/auth'

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
  const profile = useProfile()
  const { membership } = useAuth()
  const [email, setEmail] = useState(profile?.email ?? '')
  const [name, setName] = useState(profile?.name ?? '')
  const [justSaved, setJustSaved] = useState(false)

  const savedSessions = countList('ohrr:bunfest:saved-sessions:v1')
  const following = countList('ohrr:following:v1')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    saveProfile({ email, name })
    setJustSaved(true)
    window.setTimeout(() => setJustSaved(false), 2500)
  }

  const onRemove = () => {
    clearProfile()
    setEmail('')
    setName('')
    setJustSaved(false)
  }

  return (
    <>
      <PageHeader
        icon="settings"
        title="Settings"
        subtitle="Your info, your saved data, and which version of the app you're on."
      />
      <Screen className="space-y-6">
        {/* ---- Your info (optional email identity) ---- */}
        <section className="space-y-2">
          <SectionLabel>Your info</SectionLabel>
          <Card className="space-y-3">
            <p className="text-sm leading-relaxed text-slate-600">
              Add your email so your saved sessions and followed bunnies stay tied to you — and so
              OHRR can reach you about a bunny you're interested in. It's optional, and for now it's
              stored only on this device.
            </p>

            <form onSubmit={onSubmit} className="space-y-3">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Email
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Name <span className="font-semibold normal-case text-slate-300">(optional)</span>
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className={inputClass}
                />
              </label>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button type="submit" className={btn.primary}>
                  {profile ? 'Update' : 'Save'}
                </button>
                {profile && (
                  <button type="button" onClick={onRemove} className={btn.outline}>
                    Remove
                  </button>
                )}
                {justSaved && (
                  <span className="text-sm font-bold text-emerald-600">Saved ✓</span>
                )}
              </div>
            </form>

            {profile && (
              <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Saved as <strong className="font-bold text-slate-700">{profile.email}</strong> · ID{' '}
                {profile.id.slice(0, 8)} · updated {fmtDate(profile.updatedAt)}
              </p>
            )}

            <p className="text-xs leading-relaxed text-slate-400">
              <strong className="font-bold">Privacy:</strong> nothing is sent anywhere yet — this
              stays on your device. A secure database to save this and sync it across devices is
              coming.
            </p>
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
              Stored on this device — it's still here when you reopen the app.
            </p>
          </Card>
        </section>

        {/* ---- Photo credits (honors the sample-image licenses) ---- */}
        <section className="space-y-2">
          <SectionLabel>Photo credits</SectionLabel>
          <Card className="space-y-2">
            <p className="text-xs leading-relaxed text-slate-500">
              Sample bunny photos are freely-licensed images from Wikimedia Commons, shown until
              OHRR’s own rabbit photos are connected. Thanks to the photographers:
            </p>
            <ul className="space-y-1.5 text-xs text-slate-500">
              {PHOTO_CREDITS.map((c) => (
                <li key={c.source} className="flex flex-wrap items-center gap-x-1.5">
                  <a
                    href={c.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-brand-blue underline"
                  >
                    {c.author}
                  </a>
                  <span className="text-slate-400">·</span>
                  <a
                    href={c.licenseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 underline"
                  >
                    {c.license}
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        {/* ---- Staff entry (discreet; staff find it here, public ignores it) ---- */}
        <section className="space-y-2">
          <SectionLabel>OHRR staff</SectionLabel>
          <ActionCard
            to="/staff"
            title={membership ? 'Staff dashboard' : 'Staff sign-in'}
            subtitle={
              membership
                ? 'Manage the Hop Shop, your team, and more'
                : 'For OHRR staff & volunteers — sign in to manage the app'
            }
            icon="users"
            tone="blue"
          />
          <p className="px-1 text-xs leading-relaxed text-slate-400">
            Staff-only. Adopters and visitors don’t need an account here.
          </p>
        </section>

        {/* ---- About / version ---- */}
        <section className="space-y-2">
          <SectionLabel>About this app</SectionLabel>
          <Card className="divide-y divide-slate-100">
            <Row label="Version" value={`v${build.version}`} />
            <Row label="Build" value={build.commitShort} />
            <Row label="Updated" value={fmtDate(build.builtAt)} />
          </Card>
          <p className="px-1 text-xs text-slate-400">
            OHRR App · Ohio House Rabbit Rescue. Built to support rescue, adoption, education, and
            Midwest BunFest.
          </p>
        </section>
      </Screen>
    </>
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
