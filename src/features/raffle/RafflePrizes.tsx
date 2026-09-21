// The ticket-raffle prizes staff scanned in (Scan an item → "Raffle prize").
// Public read of raffle_prizes (RLS: published rows only). Available prizes
// first, drawn ones greyed at the end. Nothing renders until there is at
// least one published prize, so the page reads the same as before until then.
import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'
import { Card, SectionLabel, Badge } from '../../components/ui'
import { RafflePhoto } from './RafflePhoto'
import { AUCTION_EVENT_SLUG, formatValue } from './types'

type Prize = Pick<
  Database['public']['Tables']['raffle_prizes']['Row'],
  'id' | 'title' | 'description' | 'donated_by' | 'value_cents' | 'photo_url' | 'status'
>

export function useRafflePrizes(eventSlug = AUCTION_EVENT_SLUG): Prize[] | null {
  const [items, setItems] = useState<Prize[] | null>(null)
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setItems([])
      return
    }
    let active = true
    supabase
      .from('raffle_prizes')
      .select('id, title, description, donated_by, value_cents, photo_url, status')
      .eq('event_slug', eventSlug)
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .order('title', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return
        const rows = error ? [] : ((data ?? []) as Prize[])
        setItems([...rows.filter((r) => r.status !== 'drawn'), ...rows.filter((r) => r.status === 'drawn')])
      })
    return () => {
      active = false
    }
  }, [eventSlug])
  return items
}

export function RafflePrizes() {
  const prizes = useRafflePrizes()
  if (!prizes || prizes.length === 0) return null
  const left = prizes.filter((p) => p.status !== 'drawn').length
  return (
    <section className="space-y-2.5">
      <SectionLabel>Raffle prizes</SectionLabel>
      <p className="px-1 text-xs text-slate-500">
        {left === prizes.length ? `${prizes.length} prize${prizes.length === 1 ? '' : 's'} to be drawn.` : `${left} of ${prizes.length} still to be drawn.`} Tickets are sold at the raffle table.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {prizes.map((p) => {
          const drawn = p.status === 'drawn'
          const value = formatValue(p.value_cents)
          return (
            <Card key={p.id} className={`!p-0 overflow-hidden ${drawn ? 'opacity-60' : ''}`}>
              <div className="aspect-square w-full bg-slate-100">
                <RafflePhoto title={p.title} photo={p.photo_url} />
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-sm font-extrabold leading-snug text-ink">{p.title}</h3>
                  {drawn && <Badge tone="slate">Drawn</Badge>}
                </div>
                {p.donated_by && <p className="mt-0.5 text-xs font-semibold text-slate-400">Donated by {p.donated_by}</p>}
                {value && <p className="mt-0.5 text-xs text-slate-600">Value {value}</p>}
                {p.description && <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-600">{p.description}</p>}
              </div>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
