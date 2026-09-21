// Raffle tickets — the working version for the test app. Numbered tickets
// reserved in the app, paid at the raffle table (no card processing yet),
// drawn in the app or matched to the number pulled from the bucket.
// See supabase/migrations/20260921170000_raffle_tickets.sql.
import { supabase } from '../../../lib/supabase'
import { APP_URL } from '../../mybunny/ics'

export interface RaffleTicket {
  id: string
  no: number
  prize: string | null
  drawn_at: string | null
}
export interface RaffleOrder {
  id: string
  claim_token: string
  event_slug: string
  name: string
  phone: string | null
  email: string | null
  qty: number
  amount_cents: number | null
  status: 'reserved' | 'paid' | 'void'
  source: 'app' | 'table'
  paid_at: string | null
  created_at: string
  tickets: RaffleTicket[]
}
export interface RaffleWinner {
  ticket_id: string
  no: number
  drawn_at: string
  order_id: string
  name: string
  phone: string | null
  source: 'app' | 'table'
  prize_id: string | null
  prize: string | null
  found?: boolean
}
export interface DeskSummary {
  reserved: number
  paid_tickets: number
  paid_cents: number
  drawn: number
}

/** "A-0042" — what people write on a paper stub and what the desk shows. */
export const ticketLabel = (no: number) => `A-${String(no).padStart(4, '0')}`
/** "A-0012 – A-0015" or "A-0012" */
export function ticketRange(tickets: RaffleTicket[]): string {
  if (tickets.length === 0) return ''
  const nos = tickets.map((t) => t.no).sort((a, b) => a - b)
  const consecutive = nos.every((n, i) => i === 0 || n === nos[i - 1] + 1)
  if (consecutive && nos.length > 1) return `${ticketLabel(nos[0])} – ${ticketLabel(nos[nos.length - 1])}`
  return nos.map(ticketLabel).join(', ')
}
export const money = (cents: number | null | undefined) => (cents == null ? null : `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`)

/** Public URL of a reservation's ticket page (what the QR at the table encodes). */
export function ticketPageUrl(token: string): string {
  const base = APP_URL.replace(/\/my-bunny\/?$/, '')
  return `${base}/raffle/tickets/${token}`
}
export function tokenFromScan(raw: string): string | null {
  const m = raw.match(/raffle\/tickets\/([0-9a-f-]{36})/i) ?? raw.match(/^([0-9a-f-]{36})$/i)
  return m ? m[1].toLowerCase() : null
}

export async function reserveTickets(eventSlug: string, qty: number, name: string, phone: string, email?: string): Promise<RaffleOrder> {
  const { data, error } = await supabase.rpc('reserve_raffle_tickets', { p_event: eventSlug, p_qty: qty, p_name: name, p_phone: phone, p_email: email ?? null })
  if (error) throw error
  return data as unknown as RaffleOrder
}
export async function orderByToken(token: string): Promise<RaffleOrder | null> {
  const { data, error } = await supabase.rpc('raffle_order_by_token', { p_token: token })
  if (error) throw error
  return (data as unknown as RaffleOrder | null) ?? null
}

/* ---- staff desk ---- */
export async function deskOrders(orgId: string, eventSlug: string, query?: string): Promise<RaffleOrder[]> {
  const { data, error } = await supabase.rpc('raffle_desk', { p_org: orgId, p_event: eventSlug, p_query: query ?? null })
  if (error) throw error
  return (data as unknown as RaffleOrder[]) ?? []
}
export async function deskSummary(orgId: string, eventSlug: string): Promise<DeskSummary | null> {
  const { data, error } = await supabase.rpc('raffle_desk_summary', { p_org: orgId, p_event: eventSlug })
  if (error) throw error
  return (data as unknown as DeskSummary | null) ?? null
}
export async function setOrderStatus(id: string, status: RaffleOrder['status']): Promise<RaffleOrder> {
  const { data, error } = await supabase.rpc('set_raffle_order_status', { p_id: id, p_status: status })
  if (error) throw error
  return data as unknown as RaffleOrder
}
export async function sellAtTable(orgId: string, eventSlug: string, qty: number, name: string, phone?: string, amountCents?: number | null): Promise<RaffleOrder> {
  const { data, error } = await supabase.rpc('sell_raffle_tickets_at_table', { p_org: orgId, p_event: eventSlug, p_qty: qty, p_name: name, p_phone: phone ?? null, p_amount_cents: amountCents ?? null })
  if (error) throw error
  return data as unknown as RaffleOrder
}
export async function drawTicket(orgId: string, eventSlug: string, prizeId?: string | null): Promise<RaffleWinner> {
  const { data, error } = await supabase.rpc('draw_raffle_ticket', { p_org: orgId, p_event: eventSlug, p_prize_id: prizeId ?? null })
  if (error) throw error
  return data as unknown as RaffleWinner
}
export async function recordBucketDraw(orgId: string, eventSlug: string, ticketNo: number, prizeId?: string | null): Promise<RaffleWinner> {
  const { data, error } = await supabase.rpc('record_bucket_draw', { p_org: orgId, p_event: eventSlug, p_ticket_no: ticketNo, p_prize_id: prizeId ?? null })
  if (error) throw error
  return data as unknown as RaffleWinner
}
export async function undoDraw(ticketId: string): Promise<void> {
  const { error } = await supabase.rpc('undo_raffle_draw', { p_ticket_id: ticketId })
  if (error) throw error
}
export async function winners(orgId: string, eventSlug: string): Promise<RaffleWinner[]> {
  const { data, error } = await supabase.rpc('raffle_winners', { p_org: orgId, p_event: eventSlug })
  if (error) throw error
  return (data as unknown as RaffleWinner[]) ?? []
}
