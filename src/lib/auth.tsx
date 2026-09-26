import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from './supabase'
import { CAPABILITIES, type Capability } from './capabilities'
import { accessEnded, isMissingColumn } from './staffLevels'
import type { MembershipRole, MembershipStatus } from './database.types'

export interface Membership {
  id: string
  orgId: string
  role: MembershipRole
  status: MembershipStatus
  /** The last day of their access, YYYY-MM-DD (update 30); null = no end. */
  accessUntil: string | null
}

interface AuthValue {
  /** Whether VITE_SUPABASE_* env is present. When false, staff screens show a notice. */
  configured: boolean
  /** True until the initial session + membership load settles. */
  loading: boolean
  user: User | null
  /** The signed-in user's OHRR membership, or null if they haven't onboarded yet (or their access ended or is on hold). */
  membership: Membership | null
  /** When their access ran out (YYYY-MM-DD), if that's why they aren't on the team. */
  accessEndedOn: string | null
  /** Their own membership exists but is on hold (status 'disabled'): someone turns it back on, no invite needed. */
  accessOnHold: boolean
  /** Effective capabilities (owner/admin implicitly hold all). */
  capabilities: Set<Capability>
  /** UI gate — the DB still enforces every write regardless. */
  can: (key: Capability) => boolean
  /** Reload membership + capabilities (e.g. after redeeming a code). */
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

// The last membership that loaded, kept on this device: a door or counter
// phone that loses signal keeps working instead of being sent to sign in.
const MEMBER_CACHE = 'ohrr.staff.membership.v1'
const readCached = (uid: string): { membership: Membership; capabilities: Capability[] } | null => {
  try {
    const v = JSON.parse(localStorage.getItem(MEMBER_CACHE) ?? 'null')
    return v && v.userId === uid ? v : null
  } catch {
    return null
  }
}
const writeCached = (uid: string, m: Membership | null, caps: Capability[]) => {
  try {
    if (m) localStorage.setItem(MEMBER_CACHE, JSON.stringify({ userId: uid, membership: m, capabilities: caps }))
    else localStorage.removeItem(MEMBER_CACHE)
  } catch {
    /* private mode */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [capabilities, setCapabilities] = useState<Set<Capability>>(new Set())
  const [accessEndedOn, setAccessEndedOn] = useState<string | null>(null)
  const [accessOnHold, setAccessOnHold] = useState(false)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  // 1) Track the auth session. The onAuthStateChange callback only sets state
  //    synchronously (no awaited Supabase calls inside it — that can deadlock the
  //    auth lock); membership loading happens in the effect below.
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setSessionLoaded(true)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setSessionLoaded(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = user?.id ?? null

  const loadMembership = useCallback(async () => {
    if (!isSupabaseConfigured || !userId) {
      setMembership(null)
      setCapabilities(new Set())
      setAccessEndedOn(null)
      setAccessOnHold(false)
      return
    }
    // Not on the team (any more): no membership, and why — an end date that
    // has passed, or someone put them on hold (status 'disabled').
    const notOnTeam = (endedOn: string | null, onHold = false) => {
      setMembership(null)
      setCapabilities(new Set())
      setAccessEndedOn(endedOn)
      setAccessOnHold(onHold)
    }
    // Their OWN row: RLS lets a member read everyone's in their org, so without
    // the user_id filter this could pick up someone else's (and their level).
    // A policy lets people read their own row whatever its status, so a row
    // that's on hold comes back too — and the join screen can say so instead
    // of asking for an invite code (which never switches anyone back on).
    // access_until arrives with update 30; before it, read the row without it.
    const withEnd = await supabase
      .from('memberships')
      .select('id, org_id, role, status, access_until')
      .eq('user_id', userId)
      .limit(10)
    let rows: { id: string; org_id: string; role: MembershipRole; status: MembershipStatus; access_until: string | null }[] | null =
      withEnd.data
    let error = withEnd.error
    if (error && isMissingColumn(error)) {
      const plain = await supabase
        .from('memberships')
        .select('id, org_id, role, status')
        .eq('user_id', userId)
        .limit(10)
      rows = plain.data ? plain.data.map((r) => ({ ...r, access_until: null })) : null
      error = plain.error
    }
    if (error) {
      // No signal (or the server is unreachable): use what this device knew —
      // unless the access it knew of has run out or been put on hold since.
      const cached = readCached(userId)
      const cachedEnded = cached && accessEnded(cached.membership.accessUntil) ? cached.membership.accessUntil : null
      const cachedOnHold = cached?.membership.status === 'disabled'
      if (cachedEnded || cachedOnHold) return notOnTeam(cachedEnded, cachedOnHold)
      setMembership(cached?.membership ?? null)
      setCapabilities(new Set(cached?.capabilities ?? []))
      setAccessEndedOn(null)
      setAccessOnHold(false)
      return
    }
    if (!rows || rows.length === 0) {
      // No row. If this device knew of an end date that has passed (say the
      // own-row policy isn't there), keep it so the join screen can say why.
      const cached = readCached(userId)
      const endedOn = cached && accessEnded(cached.membership.accessUntil) ? cached.membership.accessUntil : null
      if (!endedOn) writeCached(userId, null, [])
      return notOnTeam(endedOn)
    }
    // An active row first; otherwise the one on hold.
    const r = rows.find((x) => x.status === 'active') ?? rows[0]
    const m: Membership = { id: r.id, orgId: r.org_id, role: r.role, status: r.status, accessUntil: r.access_until ?? null }
    // On hold, or past their last day (America/New_York): not on the team.
    // The database already refuses them; the join screen says why. Kept on
    // this device (with no tasks) so an offline phone says the same.
    const endedOn = accessEnded(m.accessUntil) ? m.accessUntil : null
    const onHold = m.status !== 'active'
    if (endedOn || onHold) {
      writeCached(userId, m, [])
      return notOnTeam(endedOn, onHold)
    }
    setAccessEndedOn(null)
    setAccessOnHold(false)
    setMembership(m)

    if (m.role === 'owner' || m.role === 'admin') {
      setCapabilities(new Set(CAPABILITIES))
      writeCached(userId, m, [...CAPABILITIES])
      return
    }
    const { data: grants, error: grantsError } = await supabase
      .from('membership_permissions')
      .select('permission_key')
      .eq('membership_id', m.id)
    if (grantsError) {
      setCapabilities(new Set(readCached(userId)?.capabilities ?? []))
      return
    }
    const caps = (grants ?? []).map((g) => g.permission_key as Capability)
    setCapabilities(new Set(caps))
    writeCached(userId, m, caps)
  }, [userId])

  // 2) Load membership once the session has settled and whenever the user changes.
  useEffect(() => {
    if (!sessionLoaded) return
    let active = true
    ;(async () => {
      await loadMembership()
      if (active) setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [sessionLoaded, loadMembership])

  const can = useCallback(
    (key: Capability) => {
      if (membership && (membership.role === 'owner' || membership.role === 'admin')) return true
      return capabilities.has(key)
    },
    [membership, capabilities],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    try {
      localStorage.removeItem(MEMBER_CACHE)
    } catch {
      /* private mode */
    }
    setMembership(null)
    setCapabilities(new Set())
    setAccessEndedOn(null)
    setAccessOnHold(false)
  }, [])

  const value: AuthValue = {
    configured: isSupabaseConfigured,
    loading,
    user,
    membership,
    accessEndedOn,
    accessOnHold,
    capabilities,
    can,
    refresh: loadMembership,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
