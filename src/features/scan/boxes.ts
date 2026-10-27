// Boxes of items (update 46, 2026-10-27). Sponsor: "i want to scan 12
// donations. they fit in a box. i want that box to have a itemized list and
// label." A box gets the next number (BOX-00012, "Box 12"); items go in by
// scanning their labels or ticking them in a list; the box label lists the
// names, and scanning the box opens the full list. An item is in one box at a
// time, so putting it in another box moves it.
//
// Every call is an RPC (SECURITY DEFINER, checked in the database); before
// update 46 they answer "This needs database update 46."
import { supabase } from '../../lib/supabase'
import type { ItemKind } from './types'

export interface BoxItem {
  code: string
  kind: ItemKind
  title: string
  photo_url: string | null
  quantity: number | null
  boxed_at: string | null
}

export interface Box {
  id: string
  code: string
  box_no: number
  location: string | null
  note: string | null
  label_printed_at: string | null
  created_at: string
  updated_at: string
  items: BoxItem[]
}

export interface BoxPutResult {
  box: Box | null
  added: number
  /** Items that were in another box and moved into this one. */
  moved: { code: string; title: string; from: string }[]
  /** Codes that aren't any item. */
  not_found: string[]
}

export const NEEDS_46 = 'Boxes need database update 46 — it is in RUN-THIS-IN-SUPABASE.sql.'

type BoxFn = 'new_box' | 'box_by_code' | 'list_boxes' | 'box_items_set' | 'save_box' | 'delete_box' | 'mark_boxes_printed'

async function call<T>(fn: BoxFn, args: Record<string, unknown>): Promise<T> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: BoxFn,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>
  const { data, error } = await rpc(fn, args)
  if (error) {
    if (error.code === 'PGRST202' || /could not find the function/i.test(error.message ?? '')) throw new Error(NEEDS_46)
    throw error
  }
  return data as T
}

const blank = (s: string | null | undefined) => (s ?? '').trim() || null

/** A new box with the next number. */
export async function newBox(orgId: string, location?: string | null, note?: string | null): Promise<Box> {
  return call<Box>('new_box', { p_org: orgId, p_location: blank(location), p_note: blank(note) })
}

/** A box and what's in it; null when no box has that code. */
export async function boxByCode(orgId: string, code: string): Promise<Box | null> {
  return (await call<Box | null>('box_by_code', { p_org: orgId, p_code: code })) ?? null
}

/** Every box, newest first. */
export async function listBoxes(orgId: string): Promise<Box[]> {
  return ((await call<Box[] | null>('list_boxes', { p_org: orgId })) ?? []).filter(Boolean)
}

/** Put items in the box (moving them out of any other box). */
export async function putInBox(orgId: string, boxCode: string, codes: string[]): Promise<BoxPutResult> {
  return call<BoxPutResult>('box_items_set', { p_org: orgId, p_box: boxCode, p_codes: codes })
}

/** Take items out of whatever box they're in. */
export async function takeOutOfBox(orgId: string, codes: string[]): Promise<void> {
  await call<BoxPutResult>('box_items_set', { p_org: orgId, p_box: null, p_codes: codes })
}

/** Where it's kept, and the note. */
export async function saveBox(orgId: string, code: string, location: string | null, note: string | null): Promise<Box> {
  return call<Box>('save_box', { p_org: orgId, p_code: code, p_location: blank(location), p_note: blank(note) })
}

/** The box goes; its items stay, just not in a box. */
export async function deleteBox(orgId: string, code: string): Promise<void> {
  await call<null>('delete_box', { p_org: orgId, p_code: code })
}

export async function markBoxesPrinted(orgId: string, codes: string[], printed = true): Promise<number> {
  const n = await call<unknown>('mark_boxes_printed', { p_org: orgId, p_codes: codes, p_printed: printed })
  return typeof n === 'number' ? n : 0
}

/**
 * The packing list: one letter-size page (more when it's long) to tape inside
 * the lid — the box, where it's kept, then every item with its number.
 */
export async function packingListPdf(box: Box): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'in', format: 'letter', orientation: 'portrait' })
  const name = `Box ${box.box_no}`
  const left = 0.75
  const right = 8.5 - 0.75
  let y = 0.9
  const header = () => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('OHIO HOUSE RABBIT RESCUE', left, y)
    y += 0.45
    doc.setFontSize(28)
    doc.text(name, left, y)
    doc.setFont('courier', 'bold')
    doc.setFontSize(12)
    doc.text(box.code, right, y, { align: 'right' })
    y += 0.3
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(12)
    const facts = [box.location ? `Kept: ${box.location}` : null, `${box.items.length} item${box.items.length === 1 ? '' : 's'}`].filter(Boolean).join('  ·  ')
    doc.text(facts, left, y)
    y += 0.2
    if (box.note) {
      const lines = doc.splitTextToSize(box.note, right - left) as string[]
      y += 0.1
      doc.text(lines, left, y)
      y += lines.length * 0.2
    }
    doc.setLineWidth(0.02)
    doc.line(left, y, right, y)
    y += 0.35
  }
  header()
  doc.setFontSize(13)
  box.items.forEach((it, i) => {
    if (y > 10.3) {
      doc.addPage('letter', 'portrait')
      y = 0.9
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text(`${name} (continued)`, left, y)
      y += 0.4
      doc.setFontSize(13)
    }
    doc.setFont('helvetica', 'normal')
    const title = doc.splitTextToSize(`${i + 1}.  ${it.title || 'Untitled'}${it.quantity && it.quantity > 1 ? `  (${it.quantity})` : ''}`, right - left - 1.6) as string[]
    doc.text(title[0], left, y)
    doc.setFont('courier', 'normal')
    doc.setFontSize(11)
    doc.text(it.code, right, y, { align: 'right' })
    doc.setFontSize(13)
    y += 0.3
  })
  if (box.items.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.text('Nothing in this box yet.', left, y)
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Printed ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, left, 10.6)
  return doc.output('blob')
}
