// Staff → OHRR details: the hours, phone, address and holiday notice that
// appear across the app and the website.
//
// It shared a screen called "Settings" with the feature switches, which made
// neither of them findable. One row in `app_settings` (`org_profile`); blank
// fields fall back to the values bundled in the app.
import { useCallback, useEffect, useState } from 'react'
import { errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { btn, Card, Screen } from '../components/ui'
import { Spinner, FormError, staffInput } from '../components/staffui'
import { fetchSettings, setSetting } from '../features/settings/useSetting'
import { ORG_PROFILE_FALLBACK, ORG_PROFILE_KEY, type OrgProfile } from '../lib/orgProfile'
import type { Json } from '../lib/database.types'

export default function StaffOrgDetails() {
  const { user, membership, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const allowed = can('settings.manage')

  const [d, setD] = useState<OrgProfile>(ORG_PROFILE_FALLBACK)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orgId || !allowed) {
      setLoading(false)
      return
    }
    try {
      const values = await fetchSettings(orgId)
      const stored = (values[ORG_PROFILE_KEY] ?? {}) as Partial<OrgProfile>
      setD({
        hours: stored.hours ?? ORG_PROFILE_FALLBACK.hours,
        hours_short: stored.hours_short ?? ORG_PROFILE_FALLBACK.hours_short,
        hopshop_hours: stored.hopshop_hours ?? ORG_PROFILE_FALLBACK.hopshop_hours,
        notice: stored.notice ?? '',
        phone: stored.phone ?? ORG_PROFILE_FALLBACK.phone,
        email: stored.email ?? ORG_PROFILE_FALLBACK.email,
        address: stored.address ?? ORG_PROFILE_FALLBACK.address,
      })
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setLoading(false)
    }
  }, [orgId, allowed])
  useEffect(() => {
    void load()
  }, [load])

  const txt = (k: keyof OrgProfile) => (e: { target: { value: string } }) => {
    setSaved(false)
    setD({ ...d, [k]: e.target.value })
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await setSetting(ORG_PROFILE_KEY, { ...d } as unknown as Json, { orgId, userId: user?.id })
      setSaved(true)
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (!allowed) {
    return (
      <Screen className="space-y-3 pt-2">
        <h1 className="font-display text-2xl font-black text-ink">OHRR details</h1>
        <Card className="border-slate-200 bg-slate-50/80">
          <p className="text-sm leading-relaxed text-slate-600">
            Only an owner or admin can change these. They appear on the app and the website, so they’re kept to a few
            people.
          </p>
        </Card>
      </Screen>
    )
  }

  return (
    <Screen className="space-y-4">
      <div className="pt-1">
        <h1 className="font-display text-2xl font-black text-ink">OHRR details</h1>
        <p className="mt-1 text-sm text-slate-600">
          Hours, phone, address and a notice — shown wherever the app or the website mentions the rescue. Everyone sees
          a change the next time they open it.
        </p>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          <Card className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700">
              Notice <span className="font-normal text-slate-400">(leave empty for none)</span>
              <input className={staffInput} value={d.notice} onChange={txt('notice')} placeholder="Closed Sun 25 Oct — we’re all at BunFest!" />
              <span className="mt-1 block text-xs text-slate-500">
                Shown on the app’s home screen and the website’s contact page, right where the hours are.
              </span>
            </label>
          </Card>

          <Card className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700">
              Hours, in full
              <input className={staffInput} value={d.hours} onChange={txt('hours')} />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                Hours, short
                <input className={staffInput} value={d.hours_short} onChange={txt('hours_short')} />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Hop Shop hours
                <input className={staffInput} value={d.hopshop_hours} onChange={txt('hopshop_hours')} />
              </label>
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          </Card>

          <FormError>{error}</FormError>
          {saved && <p className="text-sm font-bold text-green-700">Saved.</p>}
          <button type="button" onClick={save} disabled={busy} className={`${btn.primary} w-full disabled:opacity-60`}>
            {busy ? 'Saving…' : 'Save OHRR details'}
          </button>
        </>
      )}
    </Screen>
  )
}
