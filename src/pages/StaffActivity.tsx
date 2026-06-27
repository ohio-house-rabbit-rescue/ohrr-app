import { useCallback, useEffect, useState } from 'react'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Badge, Card, Screen } from '../components/ui'
import { Spinner, FormError } from '../components/staffui'
import type { Database } from '../lib/database.types'

type Entry = Database['public']['Tables']['audit_log']['Row']

// Human-readable verb for each recorded action.
const ACTION_LABELS: Record<string, string> = {
  redeem_master_code: 'became an Owner',
  create_invite_code: 'created an invite code',
  redeem_invite_code: 'joined the team',
  grant_permission: 'granted a capability',
  revoke_permission: 'revoked a capability',
  set_membership_status: 'changed a member’s status',
}

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action.replace(/_/g, ' ')
}

// A short, friendly summary of the detail payload, when there's something useful.
function detailSummary(e: Entry): string | null {
  const d = (e.detail ?? null) as Record<string, unknown> | null
  if (!d) return null
  if (typeof d.key === 'string') return d.key
  if (typeof d.status === 'string') return d.status
  if (typeof d.preset === 'string') return `preset: ${d.preset}`
  if (Array.isArray(d.capabilities) && d.capabilities.length) return d.capabilities.join(', ')
  return null
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function StaffActivity() {
  const { membership, can, user } = useAuth()
  const orgId = membership?.orgId ?? ''
  const allowed = can('audit.view')

  const [entries, setEntries] = useState<Entry[]>([])
  const [emails, setEmails] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orgId || !allowed) {
      setLoading(false)
      return
    }
    setError(null)
    const [logRes, memRes] = await Promise.all([
      supabase
        .from('audit_log')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.rpc('list_org_members', { p_org: orgId }),
    ])
    if (logRes.error) {
      setError(errMessage(logRes.error))
      setLoading(false)
      return
    }
    const map = new Map<string, string>()
    if (!memRes.error && memRes.data) {
      for (const m of memRes.data) map.set(m.user_id, m.email)
    }
    setEmails(map)
    setEntries(logRes.data ?? [])
    setLoading(false)
  }, [orgId, allowed])

  useEffect(() => {
    load()
  }, [load])

  const actorName = (id: string | null) => {
    if (!id) return 'System'
    if (id === user?.id) return 'You'
    return emails.get(id) ?? `Member ${id.slice(0, 6)}`
  }

  if (!allowed) {
    return (
      <Screen className="space-y-3 pt-2">
        <h1 className="font-display text-2xl font-black text-ink">Activity</h1>
        <Card className="border-slate-200 bg-slate-50/80">
          <p className="text-sm leading-relaxed text-slate-600">
            You don’t have access to the activity log. An owner or admin can grant the “View the
            activity log” capability.
          </p>
        </Card>
      </Screen>
    )
  }

  return (
    <Screen className="space-y-4">
      <div className="pt-1">
        <h1 className="font-display text-2xl font-black text-ink">Activity</h1>
        <p className="mt-1 text-sm text-slate-600">
          A record of staff and permission changes — who did what, and when.
        </p>
      </div>

      <FormError>{error}</FormError>

      {loading ? (
        <Spinner label="Loading activity…" />
      ) : entries.length === 0 ? (
        <Card className="border-slate-200 bg-slate-50/80 text-center">
          <p className="text-sm leading-relaxed text-slate-600">No activity recorded yet.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => {
            const detail = detailSummary(e)
            return (
              <Card key={e.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-ink">
                    <span className="font-bold">{actorName(e.actor_user_id)}</span>{' '}
                    {actionLabel(e.action)}
                  </p>
                  {detail && (
                    <div className="mt-1">
                      <Badge tone="slate">{detail}</Badge>
                    </div>
                  )}
                </div>
                <span className="shrink-0 whitespace-nowrap text-xs text-slate-400">
                  {fmtTime(e.created_at)}
                </span>
              </Card>
            )
          })}
        </div>
      )}
    </Screen>
  )
}
