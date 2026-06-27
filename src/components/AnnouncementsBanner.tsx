import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { Icon } from './icons'
import type { Database } from '../lib/database.types'

type Announcement = Database['public']['Tables']['announcements']['Row']

// Live staff-posted notices, shown on the OHRR home screen. Reads PUBLISHED
// announcements from Supabase (RLS only returns published rows to the public).
// Renders nothing when the backend isn't configured, the table is absent, or
// there are no published announcements — so it's always safe to mount.
export default function AnnouncementsBanner() {
  const [items, setItems] = useState<Announcement[]>([])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    supabase
      .from('announcements')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (active && data) setItems(data)
      })
    return () => {
      active = false
    }
  }, [])

  if (items.length === 0) return null

  return (
    <div className="space-y-2">
      {items.map((a) => (
        <div
          key={a.id}
          className="rounded-2xl border border-brand-orange/30 bg-brand-orange-50/60 px-4 py-3"
        >
          <div className="flex items-start gap-2.5">
            <Icon name="info" size={17} className="mt-0.5 shrink-0 text-brand-orange" />
            <div className="min-w-0">
              <p className="font-display text-sm font-extrabold text-ink">{a.title}</p>
              <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                {a.body}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
