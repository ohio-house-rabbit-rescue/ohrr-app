// Labels printed on one phone or computer show up as printed on every other
// open labels page at once (2026-10-27, sponsor: "it sends an update when an
// event happens" — no polling, to spare phone batteries).
//
// Printing already marks the labels in the database. After that, the page sends
// a short "labels changed" message on a Supabase Realtime broadcast channel for
// the rescue; every other open labels page (app or website) hears it and reads
// the list again — through the database and its rules, so the message itself
// carries nothing but the nudge. No SQL is needed for broadcast. If the message
// can't get through, the page still reads the list again when it comes back
// into view.
//
// The website has a copy in src/lib/labelSync.ts — keep the two the same.
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

const EVENT = 'labels-changed'

let channel: RealtimeChannel | null = null
let channelOrg = ''
const listeners = new Set<() => void>()

function join(orgId: string): RealtimeChannel {
  if (channel && channelOrg === orgId) return channel
  if (channel) void supabase.removeChannel(channel)
  channelOrg = orgId
  channel = supabase.channel(`labels:${orgId}`, { config: { broadcast: { self: false } } })
  channel.on('broadcast', { event: EVENT }, () => listeners.forEach((l) => l())).subscribe()
  return channel
}

/** Call `onChange` whenever another device prints (or un-marks) labels. Returns the stop function. */
export function listenForLabelChanges(orgId: string, onChange: () => void): () => void {
  join(orgId)
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
    if (listeners.size === 0 && channel) {
      void supabase.removeChannel(channel)
      channel = null
      channelOrg = ''
    }
  }
}

/** Tell the other open labels pages that labels were marked (or un-marked) printed. */
export function tellOthersLabelsChanged(orgId: string): void {
  void join(orgId)
    .send({ type: 'broadcast', event: EVENT, payload: {} })
    .catch(() => {
      /* they'll catch up when their page comes back into view */
    })
}
