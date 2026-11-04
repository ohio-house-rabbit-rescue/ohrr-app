// Who sees the guided start, and what each person has ticked off. Identical in the app and the website.
//
// SEEING IT. The Staff → Features switch "Guided start" (walkthrough_enabled):
//   * no row yet, or ON       → every member of the team sees it (the demo).
//   * OFF (launch day)        → only people who joined the team AFTER it was switched off see it: the guide stays
//                               as the "new to this app" walk-through (OHRR, 2026-11-04). The row's updated_at is
//                               the launch moment; a membership's created_at says when someone joined.
//
// TICKS. One row per ticked step in staff_walkthrough (update 56), the person's own. Before that update has been
// run, or with no signal, ticks are kept on this device instead — quietly, with no error shown — and are copied up
// the next time the table answers.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, useGuideWho } from './guideEnv'
import { GUIDE_FLAG, HIDDEN_ID } from './walkthrough'

export interface GuideAccess {
  loading: boolean
  /** May this person see the guide at all. */
  visible: boolean
  mode: 'demo' | 'newcomers'
}

interface Probe {
  at: number
  promise: Promise<{ visible: boolean; mode: 'demo' | 'newcomers' }>
}
const probes = new Map<string, Probe>()
const TTL_MS = 30_000

function probeAccess(membershipId: string): Promise<{ visible: boolean; mode: 'demo' | 'newcomers' }> {
  const have = probes.get(membershipId)
  if (have && Date.now() - have.at < TTL_MS) return have.promise
  const promise = (async () => {
    const { data: row, error } = await supabase.from('app_settings').select('value, updated_at').eq('key', GUIDE_FLAG).limit(1).maybeSingle()
    const enabled = !error && row ? (row.value as { enabled?: boolean } | null)?.enabled !== false : true
    if (enabled) return { visible: true, mode: 'demo' as const }
    // Switched off: only the people who joined after that.
    const { data: me } = await supabase.from('memberships').select('created_at').eq('id', membershipId).maybeSingle()
    const joined = me?.created_at ? Date.parse(me.created_at) : NaN
    const launched = row?.updated_at ? Date.parse(row.updated_at) : NaN
    return { visible: Number.isFinite(joined) && Number.isFinite(launched) && joined > launched, mode: 'newcomers' as const }
  })().catch(() => ({ visible: true, mode: 'demo' as const }))
  probes.set(membershipId, { at: Date.now(), promise })
  return promise
}

export function useGuideAccess(): GuideAccess {
  const who = useGuideWho()
  const [state, setState] = useState<GuideAccess>({ loading: true, visible: false, mode: 'demo' })
  const id = who.membershipId
  useEffect(() => {
    if (!who.ready) return
    if (!id) {
      setState({ loading: false, visible: false, mode: 'demo' })
      return
    }
    let alive = true
    void probeAccess(id).then((r) => {
      if (alive) setState({ loading: false, ...r })
    })
    return () => {
      alive = false
    }
  }, [who.ready, id])
  return state
}

const localKey = (userId: string) => `ohrr.guide.${userId}`
function readLocal(userId: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(localKey(userId)) ?? '[]') as unknown
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}
function writeLocal(userId: string, ids: Iterable<string>) {
  try {
    localStorage.setItem(localKey(userId), JSON.stringify([...ids]))
  } catch {
    /* private window: ticks last until the page closes */
  }
}

export interface GuideProgress {
  loading: boolean
  done: ReadonlySet<string>
  hidden: boolean
  setDone: (id: string, on: boolean) => void
  hide: () => void
  unhide: () => void
}

export function useGuideProgress(): GuideProgress {
  const who = useGuideWho()
  const userId = who.userId
  const [ids, setIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  // false once the table has said it isn't there (update 56 not run): stop asking.
  const [remote, setRemote] = useState(true)

  useEffect(() => {
    if (!who.ready) return
    if (!userId) {
      setLoading(false)
      return
    }
    let alive = true
    const local = readLocal(userId)
    setIds(new Set(local))
    void supabase
      .from('staff_walkthrough')
      .select('step_key')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (!alive) return
        if (error || !data) {
          setRemote(false)
          setLoading(false)
          return
        }
        const have = new Set(data.map((r) => r.step_key))
        const merged = new Set([...have, ...local])
        setIds(merged)
        writeLocal(userId, merged)
        setLoading(false)
        // Ticks made on this device before the table existed go up now.
        const missing = local.filter((k) => !have.has(k))
        if (missing.length) void supabase.from('staff_walkthrough').upsert(missing.map((step_key) => ({ user_id: userId, step_key })), { onConflict: 'user_id,step_key', ignoreDuplicates: true })
      })
    return () => {
      alive = false
    }
  }, [who.ready, userId])

  const setDone = useCallback(
    (id: string, on: boolean) => {
      if (!userId) return
      setIds((prev) => {
        const next = new Set(prev)
        if (on) next.add(id)
        else next.delete(id)
        writeLocal(userId, next)
        return next
      })
      if (!remote) return
      const q = on
        ? supabase.from('staff_walkthrough').upsert({ user_id: userId, step_key: id }, { onConflict: 'user_id,step_key', ignoreDuplicates: true })
        : supabase.from('staff_walkthrough').delete().eq('user_id', userId).eq('step_key', id)
      void q.then(({ error }) => {
        if (error) setRemote(false)
      })
    },
    [userId, remote],
  )

  return useMemo(
    () => ({
      loading,
      done: ids,
      hidden: ids.has(HIDDEN_ID),
      setDone,
      hide: () => setDone(HIDDEN_ID, true),
      unhide: () => setDone(HIDDEN_ID, false),
    }),
    [loading, ids, setDone],
  )
}
