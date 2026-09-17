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
                const on = isEnabled(values[f.key])
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
