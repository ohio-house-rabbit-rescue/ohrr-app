// App settings for owners/admins (route /staff/settings; gated on
// settings.manage — the DB enforces it too). Today it holds the "Test features"
// switches: features the public app shows ONLY while a switch is on. Each
// switch is one `app_settings` row ({"enabled": true}); the list of switches
// lives in features/settings/testFeatures.ts so adding one is a single entry.
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Badge, Card, Screen, SectionLabel } from '../components/ui'
import { Spinner, FormError } from '../components/staffui'
import { fetchSettings, setSetting } from '../features/settings/useSetting'
import { TEST_FEATURES, RAFFLE_TICKETS_FLAG } from '../features/settings/testFeatures'
import { ORG_PROFILE_FALLBACK, ORG_PROFILE_KEY, type OrgProfile } from '../lib/orgProfile'
import { staffInput } from '../components/staffui'
import { btn } from '../components/ui'
import type { Json } from '../lib/database.types'

function isEnabled(value: Json | undefined): boolean {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && value.enabled === true)
}

function Switch({
  on,
  disabled,
  label,
  onChange,
}: {
  on: boolean
  disabled?: boolean
  label: string
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
        on ? 'bg-brand-blue' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

export default function StaffSettings() {
  const { user, membership, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const allowed = can('settings.manage')

  const [values, setValues] = useState<Record<string, Json>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orgId || !allowed) {
      setLoading(false)
      return
    }
    setError(null)
    try {
      setValues(await fetchSettings(orgId))
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setLoading(false)
    }
  }, [orgId, allowed])

  useEffect(() => {
    load()
  }, [load])

  const toggle = async (key: string, enabled: boolean) => {
    setBusyKey(key)
    setError(null)
    try {
      await setSetting(key, { enabled }, { orgId, userId: user?.id })
      setValues((v) => ({ ...v, [key]: { enabled } }))
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusyKey(null)
    }
  }

  if (!allowed) {
    return (
      <Screen className="space-y-3 pt-2">
        <h1 className="font-display text-2xl font-black text-ink">Settings</h1>
        <Card className="border-slate-200 bg-slate-50/80">
          <p className="text-sm leading-relaxed text-slate-600">
            You don’t have access to change app settings. An owner or admin can grant the
            “Change app settings and turn test features on/off” capability.
          </p>
        </Card>
      </Screen>
    )
  }

  return (
    <Screen className="space-y-5">
      <div className="pt-1">
        <h1 className="font-display text-2xl font-black text-ink">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          App-wide switches. Changes apply to everyone the next time the app loads.
        </p>
      </div>

      <OrgDetails orgId={orgId} userId={user?.id ?? null} values={values} onSaved={load} />

      <section className="space-y-2.5">
        <SectionLabel>Test features</SectionLabel>
        <Card className="space-y-4">
          <p className="text-xs leading-relaxed text-slate-500">
            Test features are visible to the public only while switched on. Switch one on to try
            it in the live app; switch it off to hide it again.
          </p>

          {loading ? (
            <Spinner label="Loading settings…" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {TEST_FEATURES.map((f) => {
                const on = values[f.key] === undefined ? Boolean(f.defaultOn) : isEnabled(values[f.key])
                return (
                  <li key={f.key} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-display text-[15px] font-extrabold text-ink">
                        {f.label}
                        {on ? <Badge tone="orange">On · public can see it</Badge> : <Badge tone="slate">Off</Badge>}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">{f.description}</p>
                      {f.key === RAFFLE_TICKETS_FLAG && can('events.bunfest.manage') && (
                        <p className="mt-1.5 text-xs text-slate-500">
                          Set the ticket price and details in{' '}
                          <Link to="/staff/raffle" className="font-bold text-brand-blue hover:text-brand-blue-dark">
                            Silent Auction → Auction setup
                          </Link>
                          . Preview it on the{' '}
                          <Link to="/bunfest/p/raffle" className="font-bold text-brand-blue hover:text-brand-blue-dark">
                            BunFest raffle page
                          </Link>
                          .
                        </p>
                      )}
                    </div>
                    <Switch
                      on={on}
                      disabled={busyKey === f.key}
                      label={f.label}
                      onChange={(next) => toggle(f.key, next)}
                    />
                  </li>
                )
              })}
            </ul>
          )}

          <FormError>{error}</FormError>
        </Card>
      </section>
    </Screen>
  )
}

/**
 * Hours, phone, address and a holiday notice — the details that appear across
 * the app and the website. They used to be constants in the code, so a closure
 * or a new number needed a new build. Blank means "use the built-in value".
 */
function OrgDetails({
  orgId,
  userId,
  values,
  onSaved,
}: {
  orgId: string
  userId: string | null
  values: Record<string, Json>
  onSaved: () => Promise<void>
}) {
  const stored = (values[ORG_PROFILE_KEY] ?? {}) as Partial<OrgProfile>
  const [d, setD] = useState<OrgProfile>(ORG_PROFILE_FALLBACK)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fill the form once the settings have loaded.
  useEffect(() => {
    setD({
      hours: stored.hours ?? ORG_PROFILE_FALLBACK.hours,
      hours_short: stored.hours_short ?? ORG_PROFILE_FALLBACK.hours_short,
      hopshop_hours: stored.hopshop_hours ?? ORG_PROFILE_FALLBACK.hopshop_hours,
      notice: stored.notice ?? '',
      phone: stored.phone ?? ORG_PROFILE_FALLBACK.phone,
      email: stored.email ?? ORG_PROFILE_FALLBACK.email,
      address: stored.address ?? ORG_PROFILE_FALLBACK.address,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values])

  const txt = (k: keyof OrgProfile) => (e: { target: { value: string } }) => {
    setSaved(false)
    setD({ ...d, [k]: e.target.value })
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await setSetting(ORG_PROFILE_KEY, { ...d } as unknown as Json, { orgId, userId })
      setSaved(true)
      await onSaved()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-2.5">
      <SectionLabel>OHRR details</SectionLabel>
      <Card className="space-y-3">
        <p className="text-xs leading-relaxed text-slate-500">
          Shown wherever the app and the website mention the rescue’s hours, phone or address. Everyone sees the change
          the next time they open the app.
        </p>
        <label className="block text-sm font-semibold text-slate-700">
          Notice (leave empty for none)
          <input className={staffInput} value={d.notice} onChange={txt('notice')} placeholder="Closed Sun 25 Oct — we’re all at BunFest!" />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Hours, in full
          <input className={staffInput} value={d.hours} onChange={txt('hours')} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-semibold text-slate-700">
            Hours, short
            <input className={staffInput} value={d.hours_short} onChange={txt('hours_short')} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Hop Shop hours
            <input className={staffInput} value={d.hopshop_hours} onChange={txt('hopshop_hours')} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-semibold text-slate-700">
            Phone
            <input className={staffInput} type="tel" value={d.phone} onChange={txt('phone')} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Email
            <input className={staffInput} type="email" value={d.email} onChange={txt('email')} />
          </label>
        </div>
        <label className="block text-sm font-semibold text-slate-700">
          Address
          <input className={staffInput} value={d.address} onChange={txt('address')} />
        </label>
        <FormError>{error}</FormError>
        {saved && <p className="text-sm font-bold text-green-700">Saved.</p>}
        <button type="button" onClick={save} disabled={busy} className={`${btn.primary} w-full disabled:opacity-60`}>
          {busy ? 'Saving…' : 'Save OHRR details'}
        </button>
      </Card>
    </section>
  )
}
