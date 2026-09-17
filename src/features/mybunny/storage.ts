// My Bunny — local-first "care companion" data for the visitor's OWN rabbit(s).
//
// Everything lives on the device (localStorage, one versioned JSON blob under
// `ohrr.mybunny.v1`). No account, no backend, nothing is transmitted. Same
// useSyncExternalStore pattern as lib/profile.ts and lib/follow.ts, so any
// screen re-renders when the data changes. All localStorage access is wrapped
// in try/catch — in private mode or when the quota is full the app keeps
// working in memory and `getLastSaveError()` tells the UI.
//
// This module deliberately has no relative imports so its pure helpers can be
// exercised by a plain `node` script (see scripts/check-mybunny.ts).

import { useSyncExternalStore } from 'react'

/* ------------------------------------------------------------------ types */

export type Sex = 'female' | 'male' | 'unknown'

export interface Bunny {
  id: string
  name: string
  /** Downscaled (≤512px) JPEG data URL chosen by the user. */
  photoDataUrl?: string
  /** YYYY-MM-DD */
  birthday?: string
  /** Used when the birthday isn't known. Age keeps counting up from `approxAgeAsOf`. */
  approxAgeMonths?: number
  /** YYYY-MM-DD the approximate age was entered. */
  approxAgeAsOf?: string
  sex?: Sex
  breed?: string
  /** YYYY-MM-DD spayed / neutered */
  fixedOn?: string
  notes?: string
  /** ISO timestamp */
  createdAt: string
}

export interface WeightEntry {
  /** YYYY-MM-DD */
  date: string
  grams: number
}

export type ReminderType = 'nails' | 'rhdv2' | 'vet' | 'hay' | 'pellets' | 'litter' | 'custom'

export interface Reminder {
  id: string
  bunnyId: string
  type: ReminderType
  title: string
  /** Repeat every N days, or null for a one-off. */
  intervalDays: number | null
  /** YYYY-MM-DD */
  nextDue: string
  /** YYYY-MM-DD */
  lastDone?: string
  notes?: string
}

export type WeightUnit = 'lb' | 'g'

export interface MyBunnyData {
  version: 1
  bunnies: Bunny[]
  /** Weight log per bunny id, sorted by date ascending. */
  weights: Record<string, WeightEntry[]>
  reminders: Reminder[]
  prefs: { weightUnit: WeightUnit }
}

export const STORAGE_KEY = 'ohrr.mybunny.v1'

/* --------------------------------------------------- reminder suggestions */

export interface ReminderPreset {
  type: ReminderType
  title: string
  intervalDays: number | null
  /** Shown next to the preset; "typical" wording on purpose — never a prescription. */
  hint: string
}

// Typical starting points that rabbit owners commonly use. They are editable
// suggestions, and the UI always says "confirm with your vet".
export const REMINDER_PRESETS: readonly ReminderPreset[] = [
  { type: 'nails', title: 'Nail trim', intervalDays: 42, hint: 'Typically every 6 weeks' },
  { type: 'rhdv2', title: 'RHDV2 vaccine booster', intervalDays: 365, hint: 'Typically yearly' },
  { type: 'vet', title: 'Vet check-up', intervalDays: 365, hint: 'Typically yearly' },
  { type: 'hay', title: 'Hay restock', intervalDays: 14, hint: 'Typically every 2 weeks' },
  { type: 'pellets', title: 'Pellets restock', intervalDays: 28, hint: 'Typically every 4 weeks' },
  { type: 'litter', title: 'Litter change', intervalDays: 3, hint: 'Typically every 3 days' },
  { type: 'custom', title: '', intervalDays: null, hint: 'Anything else you want to track' },
]

export function presetFor(type: ReminderType): ReminderPreset {
  return REMINDER_PRESETS.find((p) => p.type === type) ?? REMINDER_PRESETS[REMINDER_PRESETS.length - 1]
}

/* ------------------------------------------------------------ date helpers */

const DAY_MS = 86_400_000
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Local calendar date as YYYY-MM-DD. */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now)
}

/** YYYY-MM-DD -> Date at local midnight, or null when malformed. */
export function parseIsoDate(iso: string | undefined | null): Date | null {
  if (!iso) return null
  const m = ISO_DATE.exec(iso)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

export function isIsoDate(v: unknown): v is string {
  return typeof v === 'string' && parseIsoDate(v) !== null
}

export function addDays(iso: string, days: number): string {
  const d = parseIsoDate(iso) ?? new Date()
  d.setDate(d.getDate() + days)
  return toIsoDate(d)
}

/** Whole days from `from` to `to` (positive when `to` is later). DST-safe via rounding. */
export function daysBetween(from: string, to: string): number {
  const a = parseIsoDate(from)
  const b = parseIsoDate(to)
  if (!a || !b) return 0
  return Math.round((b.getTime() - a.getTime()) / DAY_MS)
}

/** Days until `iso` from today (negative when it's already past). */
export function daysUntil(iso: string, today: string = todayIso()): number {
  return daysBetween(today, iso)
}

/** "Sep 17" this year, "Sep 17, 2027" otherwise. */
export function formatDate(iso: string, today: string = todayIso()): string {
  const d = parseIsoDate(iso)
  if (!d) return iso
  const sameYear = iso.slice(0, 4) === today.slice(0, 4)
  try {
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      ...(sameYear ? {} : { year: 'numeric' }),
    })
  } catch {
    return iso
  }
}

/* ------------------------------------------------------------ due status */

export type DueStatus = 'overdue' | 'today' | 'soon' | 'later'

/** `soon` = within the next 7 days. */
export function dueStatus(nextDue: string, today: string = todayIso()): DueStatus {
  const n = daysUntil(nextDue, today)
  if (n < 0) return 'overdue'
  if (n === 0) return 'today'
  if (n <= 7) return 'soon'
  return 'later'
}

export function describeDue(nextDue: string, today: string = todayIso()): string {
  const n = daysUntil(nextDue, today)
  if (n < 0) {
    const late = -n
    if (late >= 14) return `Overdue since ${formatDate(nextDue, today)}`
    return `Overdue by ${late} day${late === 1 ? '' : 's'}`
  }
  if (n === 0) return 'Due today'
  if (n === 1) return 'Due tomorrow'
  if (n <= 13) return `Due in ${n} days`
  return `Due ${formatDate(nextDue, today)}`
}

export function formatInterval(days: number | null): string {
  if (days === null) return 'Doesn’t repeat'
  if (days === 365 || days === 366) return 'Yearly'
  if (days === 1) return 'Daily'
  if (days === 7) return 'Weekly'
  if (days % 7 === 0) return `Every ${days / 7} weeks`
  return `Every ${days} days`
}

/**
 * The reminder after it's been done. Repeating reminders roll forward by the
 * interval from the day it was actually done (trimmed nails today → next trim
 * in 6 weeks, even if the reminder was overdue). One-offs keep their date and
 * just record `lastDone`, which the UI treats as completed.
 */
export function advance(r: Reminder, doneOn: string = todayIso()): Reminder {
  if (r.intervalDays === null || r.intervalDays <= 0) return { ...r, lastDone: doneOn }
  return { ...r, lastDone: doneOn, nextDue: addDays(doneOn, r.intervalDays) }
}

/** A one-off reminder that's been marked done is no longer "upcoming". */
export function isUpcoming(r: Reminder): boolean {
  return !(r.intervalDays === null && r.lastDone)
}

/* ------------------------------------------------------------------- age */

/** Whole months between two ISO dates (calendar-aware). */
export function monthsBetween(from: string, to: string): number {
  const a = parseIsoDate(from)
  const b = parseIsoDate(to)
  if (!a || !b) return 0
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  if (b.getDate() < a.getDate()) months -= 1
  return Math.max(0, months)
}

type AgeFields = Pick<Bunny, 'birthday' | 'approxAgeMonths' | 'approxAgeAsOf'>

/** Age in months, or null when nothing is known. */
export function ageMonths(b: AgeFields, today: string = todayIso()): number | null {
  if (b.birthday && parseIsoDate(b.birthday)) return monthsBetween(b.birthday, today)
  if (typeof b.approxAgeMonths === 'number' && b.approxAgeMonths >= 0) {
    const since =
      b.approxAgeAsOf && parseIsoDate(b.approxAgeAsOf) ? monthsBetween(b.approxAgeAsOf, today) : 0
    return b.approxAgeMonths + since
  }
  return null
}

/** "2 yrs 3 mo", "7 mo", "6 wks"; approximate ages get an "about " prefix. */
export function formatAge(b: AgeFields, today: string = todayIso()): string | null {
  const months = ageMonths(b, today)
  if (months === null) return null
  const approx = !(b.birthday && parseIsoDate(b.birthday))
  let text: string
  if (months < 2 && !approx && b.birthday) {
    const weeks = Math.floor(daysBetween(b.birthday, today) / 7)
    text = weeks < 1 ? 'newborn' : `${weeks} wk${weeks === 1 ? '' : 's'}`
  } else if (months < 12) {
    text = `${months} mo`
  } else {
    const y = Math.floor(months / 12)
    const m = months % 12
    text = m === 0 ? `${y} yr${y === 1 ? '' : 's'}` : `${y} yr${y === 1 ? '' : 's'} ${m} mo`
  }
  return approx ? `about ${text}` : text
}

/* ---------------------------------------------------------------- weight */

export const GRAMS_PER_OZ = 28.349523125

export function gramsToLbOz(grams: number): { lb: number; oz: number } {
  const totalOz = grams / GRAMS_PER_OZ
  let lb = Math.floor(totalOz / 16)
  let oz = Math.round((totalOz - lb * 16) * 10) / 10
  if (oz >= 16) {
    lb += 1
    oz = 0
  }
  return { lb, oz }
}

export function lbOzToGrams(lb: number, oz: number): number {
  return Math.round((lb * 16 + oz) * GRAMS_PER_OZ)
}

export function formatWeight(grams: number, unit: WeightUnit): string {
  if (unit === 'g') return `${Math.round(grams).toLocaleString()} g`
  const { lb, oz } = gramsToLbOz(grams)
  if (lb === 0) return `${oz} oz`
  return `${lb} lb ${oz} oz`
}

/** Signed difference, e.g. "+1.2 oz" / "−40 g"; null when under the display resolution. */
export function formatWeightDelta(grams: number, unit: WeightUnit): string | null {
  const sign = grams < 0 ? '−' : '+'
  const abs = Math.abs(grams)
  if (unit === 'g') {
    const g = Math.round(abs)
    return g === 0 ? null : `${sign}${g.toLocaleString()} g`
  }
  const oz = Math.round((abs / GRAMS_PER_OZ) * 10) / 10
  if (oz === 0) return null
  if (oz >= 16) {
    const lb = Math.floor(oz / 16)
    const rest = Math.round((oz - lb * 16) * 10) / 10
    return `${sign}${lb} lb ${rest} oz`
  }
  return `${sign}${oz} oz`
}

/* -------------------------------------------------------------- the store */

function emptyData(): MyBunnyData {
  return { version: 1, bunnies: [], weights: {}, reminders: [], prefs: { weightUnit: 'lb' } }
}

const REMINDER_TYPES: ReminderType[] = ['nails', 'rhdv2', 'vet', 'hay', 'pellets', 'litter', 'custom']
const SEXES: Sex[] = ['female', 'male', 'unknown']

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function sanitizeBunny(v: unknown): Bunny | null {
  if (!isRecord(v)) return null
  const id = str(v.id)
  const name = str(v.name)
  if (!id || !name) return null
  const photo =
    typeof v.photoDataUrl === 'string' && v.photoDataUrl.startsWith('data:image/')
      ? v.photoDataUrl
      : undefined
  const sex = SEXES.includes(v.sex as Sex) ? (v.sex as Sex) : undefined
  const approx =
    typeof v.approxAgeMonths === 'number' && Number.isFinite(v.approxAgeMonths) && v.approxAgeMonths >= 0
      ? Math.round(v.approxAgeMonths)
      : undefined
  return {
    id,
    name: name.trim(),
    ...(photo ? { photoDataUrl: photo } : {}),
    ...(isIsoDate(v.birthday) ? { birthday: v.birthday } : {}),
    ...(approx !== undefined ? { approxAgeMonths: approx } : {}),
    ...(isIsoDate(v.approxAgeAsOf) ? { approxAgeAsOf: v.approxAgeAsOf } : {}),
    ...(sex ? { sex } : {}),
    ...(str(v.breed) ? { breed: (v.breed as string).trim() } : {}),
    ...(isIsoDate(v.fixedOn) ? { fixedOn: v.fixedOn } : {}),
    ...(str(v.notes) ? { notes: v.notes as string } : {}),
    createdAt: typeof v.createdAt === 'string' ? v.createdAt : new Date().toISOString(),
  }
}

function sanitizeReminder(v: unknown, bunnyIds: Set<string>): Reminder | null {
  if (!isRecord(v)) return null
  const id = str(v.id)
  const bunnyId = str(v.bunnyId)
  const title = str(v.title)
  if (!id || !bunnyId || !title || !bunnyIds.has(bunnyId) || !isIsoDate(v.nextDue)) return null
  const type = REMINDER_TYPES.includes(v.type as ReminderType) ? (v.type as ReminderType) : 'custom'
  const interval =
    typeof v.intervalDays === 'number' && Number.isFinite(v.intervalDays) && v.intervalDays >= 1
      ? Math.round(v.intervalDays)
      : null
  return {
    id,
    bunnyId,
    type,
    title: title.trim(),
    intervalDays: interval,
    nextDue: v.nextDue,
    ...(isIsoDate(v.lastDone) ? { lastDone: v.lastDone } : {}),
    ...(str(v.notes) ? { notes: v.notes as string } : {}),
  }
}

function sanitizeWeights(v: unknown, bunnyIds: Set<string>): Record<string, WeightEntry[]> {
  const out: Record<string, WeightEntry[]> = {}
  if (!isRecord(v)) return out
  for (const [bunnyId, list] of Object.entries(v)) {
    if (!bunnyIds.has(bunnyId) || !Array.isArray(list)) continue
    const entries = list
      .filter(
        (e): e is WeightEntry =>
          isRecord(e) &&
          isIsoDate(e.date) &&
          typeof e.grams === 'number' &&
          Number.isFinite(e.grams) &&
          e.grams > 0,
      )
      .map((e) => ({ date: e.date, grams: Math.round(e.grams) }))
    out[bunnyId] = sortWeights(entries)
  }
  return out
}

/** Sort ascending by date, keeping only the last entry per date. */
function sortWeights(entries: WeightEntry[]): WeightEntry[] {
  const byDate = new Map<string, WeightEntry>()
  for (const e of entries) byDate.set(e.date, e)
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

/** Coerce anything (old versions, hand-edited backups, garbage) into a valid dataset. */
export function sanitize(raw: unknown): MyBunnyData {
  const base = emptyData()
  if (!isRecord(raw)) return base
  const bunnies = Array.isArray(raw.bunnies)
    ? raw.bunnies.map(sanitizeBunny).filter((b): b is Bunny => b !== null)
    : []
  const ids = new Set(bunnies.map((b) => b.id))
  const reminders = Array.isArray(raw.reminders)
    ? raw.reminders.map((r) => sanitizeReminder(r, ids)).filter((r): r is Reminder => r !== null)
    : []
  const prefs =
    isRecord(raw.prefs) && raw.prefs.weightUnit === 'g' ? { weightUnit: 'g' as const } : base.prefs
  return { version: 1, bunnies, weights: sanitizeWeights(raw.weights, ids), reminders, prefs }
}

/** Safe JSON parse → sanitized dataset (never throws). */
export function parseData(text: string | null | undefined): MyBunnyData {
  if (!text) return emptyData()
  try {
    return sanitize(JSON.parse(text))
  } catch {
    return emptyData()
  }
}

function load(): MyBunnyData {
  try {
    return parseData(localStorage.getItem(STORAGE_KEY))
  } catch {
    return emptyData()
  }
}

let data: MyBunnyData = load()
let lastSaveError: string | null = null
const listeners = new Set<() => void>()

function commit(next: MyBunnyData) {
  data = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    lastSaveError = null
  } catch (e) {
    // Private mode / quota exceeded (large photos). Keep working in memory.
    lastSaveError =
      e instanceof Error && /quota/i.test(e.name + e.message)
        ? 'This phone’s storage for the app is full — try a smaller photo or remove one.'
        : 'Couldn’t save on this phone (private browsing?). Changes will be lost when you close the app.'
  }
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

const getSnapshot = () => data

export function useMyBunny(): MyBunnyData {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function getMyBunny(): MyBunnyData {
  return data
}

export function getLastSaveError(): string | null {
  return lastSaveError
}

const getSaveError = () => lastSaveError

/** Reactive version of getLastSaveError() — null when the last save succeeded. */
export function useSaveError(): string | null {
  return useSyncExternalStore(subscribe, getSaveError, getSaveError)
}

export function newId(prefix = 'b'): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
  }
}

/* ------------------------------------------------------------- mutations */

export type BunnyInput = Omit<Bunny, 'id' | 'createdAt'>

export function addBunny(input: BunnyInput): Bunny {
  const bunny: Bunny = {
    ...cleanBunnyInput(input),
    id: newId('b'),
    createdAt: new Date().toISOString(),
  }
  commit({ ...data, bunnies: [...data.bunnies, bunny] })
  return bunny
}

export function updateBunny(id: string, patch: Partial<BunnyInput>): void {
  commit({
    ...data,
    bunnies: data.bunnies.map((b) =>
      b.id === id ? { id: b.id, createdAt: b.createdAt, ...cleanBunnyInput({ ...b, ...patch }) } : b,
    ),
  })
}

/** Removes the bunny plus its reminders and weight log. */
export function deleteBunny(id: string): void {
  const weights = { ...data.weights }
  delete weights[id]
  commit({
    ...data,
    bunnies: data.bunnies.filter((b) => b.id !== id),
    reminders: data.reminders.filter((r) => r.bunnyId !== id),
    weights,
  })
}

// Drop empty optional fields so the stored record stays tidy. Note: a patch
// that sets a field to undefined clears it (the spread above lets that through).
function cleanBunnyInput(input: BunnyInput): BunnyInput {
  const out: BunnyInput = { name: input.name.trim() }
  if (input.photoDataUrl) out.photoDataUrl = input.photoDataUrl
  if (isIsoDate(input.birthday)) out.birthday = input.birthday
  if (typeof input.approxAgeMonths === 'number' && input.approxAgeMonths >= 0 && !out.birthday) {
    out.approxAgeMonths = Math.round(input.approxAgeMonths)
    out.approxAgeAsOf = isIsoDate(input.approxAgeAsOf) ? input.approxAgeAsOf : todayIso()
  }
  if (input.sex && SEXES.includes(input.sex)) out.sex = input.sex
  if (input.breed?.trim()) out.breed = input.breed.trim()
  if (isIsoDate(input.fixedOn)) out.fixedOn = input.fixedOn
  if (input.notes?.trim()) out.notes = input.notes.trim()
  return out
}

export function addWeight(bunnyId: string, entry: WeightEntry): void {
  if (!isIsoDate(entry.date) || !(entry.grams > 0)) return
  const list = sortWeights([
    ...(data.weights[bunnyId] ?? []),
    { date: entry.date, grams: Math.round(entry.grams) },
  ])
  commit({ ...data, weights: { ...data.weights, [bunnyId]: list } })
}

export function deleteWeight(bunnyId: string, date: string): void {
  const list = (data.weights[bunnyId] ?? []).filter((e) => e.date !== date)
  commit({ ...data, weights: { ...data.weights, [bunnyId]: list } })
}

export function setWeightUnit(unit: WeightUnit): void {
  commit({ ...data, prefs: { ...data.prefs, weightUnit: unit } })
}

export type ReminderInput = Omit<Reminder, 'id'>

export function addReminder(input: ReminderInput): Reminder {
  const r: Reminder = { ...cleanReminderInput(input), id: newId('r') }
  commit({ ...data, reminders: [...data.reminders, r] })
  return r
}

export function updateReminder(id: string, patch: Partial<ReminderInput>): void {
  commit({
    ...data,
    reminders: data.reminders.map((r) =>
      r.id === id ? { id: r.id, ...cleanReminderInput({ ...r, ...patch }) } : r,
    ),
  })
}

export function deleteReminder(id: string): void {
  commit({ ...data, reminders: data.reminders.filter((r) => r.id !== id) })
}

export function markReminderDone(id: string, doneOn: string = todayIso()): Reminder | undefined {
  let updated: Reminder | undefined
  commit({
    ...data,
    reminders: data.reminders.map((r) => {
      if (r.id !== id) return r
      updated = advance(r, doneOn)
      return updated
    }),
  })
  return updated
}

function cleanReminderInput(input: ReminderInput): ReminderInput {
  const out: ReminderInput = {
    bunnyId: input.bunnyId,
    type: REMINDER_TYPES.includes(input.type) ? input.type : 'custom',
    title: input.title.trim(),
    intervalDays:
      typeof input.intervalDays === 'number' && input.intervalDays >= 1
        ? Math.round(input.intervalDays)
        : null,
    nextDue: isIsoDate(input.nextDue) ? input.nextDue : todayIso(),
  }
  if (isIsoDate(input.lastDone)) out.lastDone = input.lastDone
  if (input.notes?.trim()) out.notes = input.notes.trim()
  return out
}

/* ---------------------------------------------------------------- queries */

export function findBunny(d: MyBunnyData, id: string | undefined): Bunny | undefined {
  return d.bunnies.find((b) => b.id === id)
}

/** A bunny's reminders, upcoming first (soonest due at the top), then completed one-offs. */
export function remindersFor(d: MyBunnyData, bunnyId: string): Reminder[] {
  return d.reminders
    .filter((r) => r.bunnyId === bunnyId)
    .sort((a, b) => {
      const ua = isUpcoming(a) ? 0 : 1
      const ub = isUpcoming(b) ? 0 : 1
      if (ua !== ub) return ua - ub
      return a.nextDue < b.nextDue ? -1 : a.nextDue > b.nextDue ? 1 : a.title.localeCompare(b.title)
    })
}

export function nextReminder(d: MyBunnyData, bunnyId: string): Reminder | undefined {
  return remindersFor(d, bunnyId).find(isUpcoming)
}

/** How many upcoming reminders are due today or overdue (across all bunnies, or one). */
export function dueCount(
  d: MyBunnyData,
  today: string = todayIso(),
  bunnyId?: string,
): { overdue: number; today: number; total: number } {
  let overdue = 0
  let dueToday = 0
  for (const r of d.reminders) {
    if (bunnyId && r.bunnyId !== bunnyId) continue
    if (!isUpcoming(r)) continue
    const s = dueStatus(r.nextDue, today)
    if (s === 'overdue') overdue += 1
    else if (s === 'today') dueToday += 1
  }
  return { overdue, today: dueToday, total: overdue + dueToday }
}

export function weightsFor(d: MyBunnyData, bunnyId: string): WeightEntry[] {
  return d.weights[bunnyId] ?? []
}

/* --------------------------------------------------------- backup/restore */

export function exportJson(d: MyBunnyData = data): string {
  return JSON.stringify(
    { ...d, exportedAt: new Date().toISOString(), app: 'ohrr-app/my-bunny' },
    null,
    2,
  )
}

export interface ImportResult {
  bunnies: number
  reminders: number
  weights: number
}

/**
 * Merge a backup into the current data — add-only, never destructive: anything
 * in the backup that isn't already on this phone (by id, or by date for
 * weights) is added; what's already here is left exactly as it is. The result
 * counts what was actually added.
 */
export function mergeData(
  current: MyBunnyData,
  incoming: MyBunnyData,
): { data: MyBunnyData; result: ImportResult } {
  const bunnyIds = new Set(current.bunnies.map((b) => b.id))
  const newBunnies = incoming.bunnies.filter((b) => !bunnyIds.has(b.id))
  const reminderIds = new Set(current.reminders.map((r) => r.id))
  const newReminders = incoming.reminders.filter((r) => !reminderIds.has(r.id))

  const weights: Record<string, WeightEntry[]> = { ...current.weights }
  let weightCount = 0
  for (const [bunnyId, list] of Object.entries(incoming.weights)) {
    const have = new Set((weights[bunnyId] ?? []).map((w) => w.date))
    const fresh = list.filter((w) => !have.has(w.date))
    if (fresh.length === 0) continue
    weights[bunnyId] = sortWeights([...(weights[bunnyId] ?? []), ...fresh])
    weightCount += fresh.length
  }
  return {
    data: {
      version: 1,
      bunnies: [...current.bunnies, ...newBunnies],
      reminders: [...current.reminders, ...newReminders],
      weights,
      prefs: current.prefs,
    },
    result: { bunnies: newBunnies.length, reminders: newReminders.length, weights: weightCount },
  }
}

/** Parse + validate a backup file's text, then merge it in. Throws on unreadable input. */
export function importJson(text: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('That file isn’t a My Bunny backup.')
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.bunnies)) {
    throw new Error('That file isn’t a My Bunny backup.')
  }
  const merged = mergeData(data, sanitize(parsed))
  commit(merged.data)
  return merged.result
}

export function backupFilename(today: string = todayIso()): string {
  return `ohrr-my-bunny-backup-${today}.json`
}
