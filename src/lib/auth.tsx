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
import type { MembershipRole, MembershipStatus } from './database.types'

export interface Membership {
  id: string
  orgId: string
  role: MembershipRole
  status: MembershipStatus
}

interface AuthValue {
  /** Whether VITE_SUPABASE_* env is present. When false, staff screens show a notice. */
  configured: boolean
  /** True until the initial session + membership load settles. */
  loading: boolean
  user: User | null
  /** The signed-in user's OHRR membership, or null if they haven't onboarded yet. */
  membership: Membership | null
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
      return
    }
    // RLS lets a member read their own membership row (and only their org's).
    const { data: rows, error } = await supabase
      .from('memberships')
      .select('id, org_id, role, status')
      .eq('status', 'active')
      .limit(1)
    if (error) {
      // No signal (or the server is unreachable): use what this device knew.
      const cached = readCached(userId)
      setMembership(cached?.membership ?? null)
      setCapabilities(new Set(cached?.capabilities ?? []))
      return
    }
    if (!rows || rows.length === 0) {
      writeCached(userId, null, [])
      setMembership(null)
      setCapabilities(new Set())
      return
    }
    const r = rows[0]
    const m: Membership = { id: r.id, orgId: r.org_id, role: r.role, status: r.status }
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
  }, [])

  const value: AuthValue = {
    configured: isSupabaseConfigured,
    loading,
    user,
    membership,
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
