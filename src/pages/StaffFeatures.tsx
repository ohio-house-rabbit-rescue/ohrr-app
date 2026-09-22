// Staff → Features: the switches an owner or admin uses to turn parts of the
// app on and off for everyone.
//
// This used to be "Settings → Test features", which said neither what it was
// for nor who could use it. The OHRR details (hours, phone, address) that
// shared that screen now live on their own at Staff → OHRR details.
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Badge, Card, Screen, SectionLabel } from '../components/ui'
import { Icon } from '../components/icons'
import { Spinner, FormError } from '../components/staffui'
import { fetchSettings, setSetting } from '../features/settings/useSetting'
import { APP_FEATURES, FEATURE_GROUPS, RAFFLE_TICKETS_FLAG } from '../features/settings/features'
import type { Json } from '../lib/database.types'

function isEnabled(value: Json | undefined): boolean {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && value.enabled === true)
}

function Switch({ on, disabled, label, onChange }: { on: boolean; disabled?: boolean; label: string; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
        on ? 'bg-brand-blue' : 'bg-slate-300'
      }`}
    >
      <span className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-7' : 'translate-x-1'}`} />
    </button>
  )
}

export default function StaffFeatures() {
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
    void load()
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
        <h1 className="font-display text-2xl font-black text-ink">Features</h1>
        <Card className="border-slate-200 bg-slate-50/80">
          <p className="text-sm leading-relaxed text-slate-600">
            Only an owner or admin can turn features on and off. Ask one of them for the “Change app settings” access if
            you need it.
          </p>
        </Card>
      </Screen>
    )
  }

  return (
    <Screen className="space-y-5">
      <div className="pt-1">
        <h1 className="font-display text-2xl font-black text-ink">Features</h1>
        <p className="mt-1 text-sm text-slate-600">
          Turn parts of the app on and off for everyone. A change takes effect the next time someone opens the app — no
          new version needed.
        </p>
      </div>

      <FormError>{error}</FormError>
      {loading ? (
        <Spinner label="Loading features…" />
      ) : (
        FEATURE_GROUPS.map((group) => {
          const items = APP_FEATURES.filter((f) => f.group === group)
          if (items.length === 0) return null
          return (
            <section key={group} className="space-y-2.5">
              <SectionLabel>{group}</SectionLabel>
              <Card>
                <ul className="divide-y divide-slate-100">
                  {items.map((f) => {
                    const on = values[f.key] === undefined ? Boolean(f.defaultOn) : isEnabled(values[f.key])
                    return (
                      <li key={f.key} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 font-display text-[15px] font-extrabold text-ink">
                            {f.label}
                            {on ? <Badge tone="orange">On</Badge> : <Badge tone="slate">Off</Badge>}
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-slate-600">{f.description}</p>
                          {f.key === RAFFLE_TICKETS_FLAG && can('events.bunfest.manage') && (
                            <p className="mt-1.5 text-xs text-slate-500">
                              Set the ticket price in{' '}
                              <Link to="/staff/raffle" className="font-bold text-brand-blue">
                                Silent Auction → Auction setup
                              </Link>
                              .
                            </p>
                          )}
                        </div>
                        <Switch on={on} disabled={busyKey === f.key} label={f.label} onChange={(next) => toggle(f.key, next)} />
                      </li>
                    )
                  })}
                </ul>
              </Card>
            </section>
          )
        })
      )}

      <Card className="border-slate-200 bg-slate-50/80">
        <p className="text-sm text-slate-600">
          Looking for OHRR’s hours, phone or address?{' '}
          <Link to="/staff/details" className="inline-flex items-center gap-1 font-bold text-brand-blue">
            OHRR details <Icon name="chevron" size={14} />
          </Link>
        </p>
      </Card>
    </Screen>
  )
}
