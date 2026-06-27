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
    if (error || !rows || rows.length === 0) {
      setMembership(null)
      setCapabilities(new Set())
      return
    }
    const r = rows[0]
    const m: Membership = { id: r.id, orgId: r.org_id, role: r.role, status: r.status }
    setMembership(m)

    if (m.role === 'owner' || m.role === 'admin') {
      setCapabilities(new Set(CAPABILITIES))
      return
    }
    const { data: grants } = await supabase
      .from('membership_permissions')
      .select('permission_key')
      .eq('membership_id', m.id)
    setCapabilities(new Set((grants ?? []).map((g) => g.permission_key as Capability)))
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
