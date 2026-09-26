// My Bunny — local-first "care companion" data for the visitor's OWN rabbit(s).
//
// Everything lives on the device. Metadata (bunnies, reminders, weights, health
// notes) is one versioned JSON blob in localStorage under `ohrr.mybunny.v2`;
// photos live in IndexedDB (see photos.ts), one record per bunny id, so a
// rescue or foster can keep up to MAX_BUNNIES rabbits without hitting
// localStorage's ~5 MB ceiling. Signed out, nothing is transmitted. Signed in
// (update 31), the account sync (features/account/sync.ts) also keeps a copy of
// the JSON — without the photos — on the person's OHRR account; the pure merge
// it uses is `mergeSynced()` below, and every edit stamps `updatedAt` so the
// newest copy of a bunny, reminder or note wins. The photos follow separately
// (update 32, features/account/photoSync.ts).
//
// v1 (`ohrr.mybunny.v1`) embedded each photo as `photoDataUrl` in the JSON. On
// first load after the upgrade the v1 blob is read, the photos are copied into
// IndexedDB, the JSON is re-saved as v2 with `hasPhoto: true` instead of the
// data URL, and the v1 key is removed once every photo landed.
//
// Same useSyncExternalStore pattern as lib/profile.ts and lib/follow.ts, so any
// screen re-renders when the data changes. All localStorage access is wrapped
// in try/catch — in private mode or when the quota is full the app keeps
// working in memory and `getLastSaveError()` tells the UI.
//
// The only relative import is photos.ts, which has no top-level browser
// access, so the pure helpers here can still be exercised by a plain `node`
// script (see scripts/mybunny-check.ts).

import { useSyncExternalStore } from 'react'
// Explicit .ts extension so plain `node scripts/mybunny-check.ts` can resolve it too.
import { deletePhoto, getAllPhotos, putPhoto, putPhotos } from './photos.ts'

/* ------------------------------------------------------------------ types */

export type Sex = 'female' | 'male' | 'unknown'

/** The person's relationship to the rabbit — how a rescue, foster or sponsor keeps records. */
export type BunnyRole = 'pet' | 'foster' | 'sponsored' | 'resident'

export const BUNNY_ROLES: readonly BunnyRole[] = ['pet', 'foster', 'sponsored', 'resident']

export const ROLE_LABEL: Record<BunnyRole, string> = {
  pet: 'My pet',
  foster: 'Foster',
  sponsored: 'Sponsored',
  resident: 'Rescue resident',
}

export type ArchiveReason = 'adopted' | 'rehomed' | 'passed' | 'other'

export const ARCHIVE_REASONS: readonly ArchiveReason[] = ['adopted', 'rehomed', 'passed', 'other']

export const ARCHIVE_REASON_LABEL: Record<ArchiveReason, string> = {
  adopted: 'Adopted',
  rehomed: 'Rehomed',
  passed: 'Passed away',
  other: 'Other',
}

export interface BunnyArchive {
  reason: ArchiveReason
  /** YYYY-MM-DD */
  date: string
  note?: string
}

export interface Bunny {
  id: string
  name: string
  /** True when a downscaled photo is stored in IndexedDB under this bunny's id. */
  hasPhoto?: boolean
  role: BunnyRole
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
  /** Set when the bunny has left (adopted, rehomed, passed away…). Records are kept. */
  archived?: BunnyArchive
  /** ISO timestamp */
  createdAt: string
  /** ISO timestamp of the last edit (update 31) — how the account sync picks the newest copy. */
  updatedAt?: string
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
  /** ISO timestamp of the last edit (update 31). */
  updatedAt?: string
}

export type WeightUnit = 'lb' | 'g'

/** A dated entry on a bunny's health timeline (often saved from a Bunny Help topic). */
export interface HealthNote {
  id: string
  bunnyId: string
  /** YYYY-MM-DD */
  date: string
  topicSlug?: string
  topicTitle?: string
  /** What you noticed. */
  noticed: string
  /** What you did about it. */
  did?: string
  /** Optional follow-up (e.g. "vet Thursday"). */
  followUp?: string
  resolved: boolean
  /** ISO timestamp */
  createdAt: string
  /** ISO timestamp of the last edit (update 31). */
  updatedAt?: string
}

export interface MyBunnyData {
  version: 2
  bunnies: Bunny[]
  /** Weight log per bunny id, sorted by date ascending. */
  weights: Record<string, WeightEntry[]>
  reminders: Reminder[]
  /** Health timeline entries across all bunnies. */
  health: HealthNote[]
  prefs: { weightUnit: WeightUnit }
}

export const STORAGE_KEY = 'ohrr.mybunny.v2'
/** The pre-IndexedDB blob, read once and migrated. */
export const LEGACY_STORAGE_KEY = 'ohrr.mybunny.v1'

/** Active (non-archived) bunnies per phone. Photos are in IndexedDB, so this is a UX limit, not a storage one. */
export const MAX_BUNNIES = 100

export const LIMIT_MESSAGE = `That’s ${MAX_BUNNIES} bunnies on this phone — the most My Bunny can keep track of. Archive or remove one to add another.`

/* ---------------------------------------------------------- naming */

/** 1 → "My Bunny", 2 → "My Bunnies", 3+ → "My Fluffle" (a group of rabbits is a fluffle). */
export function collectionTitle(activeCount: number): string {
  if (activeCount >= 3) return 'My Fluffle'
  if (activeCount === 2) return 'My Bunnies'
  return 'My Bunny'
}

export const FLUFFLE_NOTE = 'A group of rabbits is called a fluffle.'

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

/* ------------------------------------------------------------- sanitize */

function emptyData(): MyBunnyData {
  return { version: 2, bunnies: [], weights: {}, reminders: [], health: [], prefs: { weightUnit: 'lb' } }
}

const REMINDER_TYPES: ReminderType[] = ['nails', 'rhdv2', 'vet', 'hay', 'pellets', 'litter', 'custom']
const SEXES: Sex[] = ['female', 'male', 'unknown']

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isPhotoDataUrl(v: unknown): v is string {
  return typeof v === 'string' && v.startsWith('data:image/')
}

function sanitizeArchive(v: unknown): BunnyArchive | undefined {
  if (!isRecord(v)) return undefined
  const reason = ARCHIVE_REASONS.includes(v.reason as ArchiveReason) ? (v.reason as ArchiveReason) : 'other'
  if (!isIsoDate(v.date)) return undefined
  return { reason, date: v.date, ...(str(v.note) ? { note: (v.note as string).trim() } : {}) }
}

/**
 * A v1 record carried its photo inline as `photoDataUrl`; v2 keeps only a
 * `hasPhoto` flag (the picture itself lives in IndexedDB). Either form of input
 * sanitizes to the v2 shape — the inline photo is stripped here and picked up
 * separately by `extractPhotos()`.
 */
function sanitizeBunny(v: unknown): Bunny | null {
  if (!isRecord(v)) return null
  const id = str(v.id)
  const name = str(v.name)
  if (!id || !name) return null
  const hasPhoto = v.hasPhoto === true || isPhotoDataUrl(v.photoDataUrl)
  const role = BUNNY_ROLES.includes(v.role as BunnyRole) ? (v.role as BunnyRole) : 'pet'
  const sex = SEXES.includes(v.sex as Sex) ? (v.sex as Sex) : undefined
  const approx =
    typeof v.approxAgeMonths === 'number' && Number.isFinite(v.approxAgeMonths) && v.approxAgeMonths >= 0
      ? Math.round(v.approxAgeMonths)
      : undefined
  const archived = sanitizeArchive(v.archived)
  return {
    id,
    name: name.trim(),
    ...(hasPhoto ? { hasPhoto: true } : {}),
    role,
    ...(isIsoDate(v.birthday) ? { birthday: v.birthday } : {}),
    ...(approx !== undefined ? { approxAgeMonths: approx } : {}),
    ...(isIsoDate(v.approxAgeAsOf) ? { approxAgeAsOf: v.approxAgeAsOf } : {}),
    ...(sex ? { sex } : {}),
    ...(str(v.breed) ? { breed: (v.breed as string).trim() } : {}),
    ...(isIsoDate(v.fixedOn) ? { fixedOn: v.fixedOn } : {}),
    ...(str(v.notes) ? { notes: v.notes as string } : {}),
    ...(archived ? { archived } : {}),
    createdAt: typeof v.createdAt === 'string' ? v.createdAt : new Date().toISOString(),
    ...(str(v.updatedAt) ? { updatedAt: v.updatedAt as string } : {}),
  }
}

/** Inline photos (v1 blobs and backup files) keyed by bunny id — what goes into IndexedDB. */
export function extractPhotos(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!isRecord(raw) || !Array.isArray(raw.bunnies)) return out
  for (const b of raw.bunnies) {
    if (isRecord(b) && str(b.id) && isPhotoDataUrl(b.photoDataUrl)) out[b.id as string] = b.photoDataUrl
  }
  return out
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
    ...(str(v.updatedAt) ? { updatedAt: v.updatedAt as string } : {}),
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

function sanitizeHealthNote(v: unknown, bunnyIds: Set<string>): HealthNote | null {
  if (!isRecord(v)) return null
  const id = str(v.id)
  const bunnyId = str(v.bunnyId)
  const noticed = str(v.noticed)
  if (!id || !bunnyId || !noticed || !bunnyIds.has(bunnyId) || !isIsoDate(v.date)) return null
  return {
    id,
    bunnyId,
    date: v.date,
    ...(str(v.topicSlug) ? { topicSlug: (v.topicSlug as string).trim() } : {}),
    ...(str(v.topicTitle) ? { topicTitle: (v.topicTitle as string).trim() } : {}),
    noticed: noticed.trim(),
    ...(str(v.did) ? { did: (v.did as string).trim() } : {}),
    ...(str(v.followUp) ? { followUp: (v.followUp as string).trim() } : {}),
    resolved: v.resolved === true,
    createdAt: typeof v.createdAt === 'string' ? v.createdAt : new Date().toISOString(),
    ...(str(v.updatedAt) ? { updatedAt: v.updatedAt as string } : {}),
  }
}

/** Sort ascending by date, keeping only the last entry per date. */
function sortWeights(entries: WeightEntry[]): WeightEntry[] {
  const byDate = new Map<string, WeightEntry>()
  for (const e of entries) byDate.set(e.date, e)
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

/** Coerce anything (v1 blobs, backups, hand-edited files, garbage) into a valid v2 dataset. */
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
  const health = Array.isArray(raw.health)
    ? raw.health.map((h) => sanitizeHealthNote(h, ids)).filter((h): h is HealthNote => h !== null)
    : []
  const prefs =
    isRecord(raw.prefs) && raw.prefs.weightUnit === 'g' ? { weightUnit: 'g' as const } : base.prefs
  return { version: 2, bunnies, weights: sanitizeWeights(raw.weights, ids), reminders, health, prefs }
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

/* -------------------------------------------------------------- the store */

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** v2 when present; otherwise the v1 blob (re-saved as v2 on the first write). */
function load(): { data: MyBunnyData; fromLegacy: boolean } {
  const v2 = readKey(STORAGE_KEY)
  if (v2 !== null) return { data: parseData(v2), fromLegacy: false }
  const v1 = readKey(LEGACY_STORAGE_KEY)
  if (v1 !== null) return { data: parseData(v1), fromLegacy: true }
  return { data: emptyData(), fromLegacy: false }
}

const loaded = load()
let data: MyBunnyData = loaded.data
let lastSaveError: string | null = null
const listeners = new Set<() => void>()

function persist(next: MyBunnyData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    lastSaveError = null
    return true
  } catch (e) {
    // Private mode / quota exceeded. Keep working in memory.
    lastSaveError =
      e instanceof Error && /quota/i.test(e.name + e.message)
        ? 'This phone’s storage for the app is full — remove a bunny or some notes to make room.'
        : 'Couldn’t save on this phone (private browsing?). Changes will be lost when you close the app.'
    return false
  }
}

function commit(next: MyBunnyData) {
  data = next
  persist(next)
  listeners.forEach((l) => l())
}

/**
 * One-time v1 → v2 migration of photos. Runs at load whenever the v1 key still
 * exists: its inline photos are copied into IndexedDB (only for bunnies that
 * still have `hasPhoto`, so a photo removed since isn't resurrected), the v2
 * blob is written, and the v1 key is removed once every photo landed. If any
 * write fails the v1 key stays, so the next load simply tries again.
 */
function migrateLegacy() {
  const raw = readKey(LEGACY_STORAGE_KEY)
  if (raw === null) return
  if (loaded.fromLegacy) persist(data)
  let photos: Record<string, string> = {}
  try {
    photos = extractPhotos(JSON.parse(raw))
  } catch {
    // Unreadable v1 blob: nothing to carry over.
  }
  const keep = new Set(data.bunnies.filter((b) => b.hasPhoto).map((b) => b.id))
  for (const id of Object.keys(photos)) if (!keep.has(id)) delete photos[id]
  void putPhotos(photos).then((failed) => {
    if (failed.length > 0) return
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch {
      /* leave it; harmless */
    }
  })
}

migrateLegacy()

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

const getSnapshot = () => data

/** Every change to the data (the account sync listens here). */
export function subscribeMyBunny(cb: () => void): () => void {
  return subscribe(cb)
}

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

export type BunnyInput = Omit<Bunny, 'id' | 'createdAt' | 'updatedAt'>

const nowIso = () => new Date().toISOString()

/** Throws with LIMIT_MESSAGE when the phone already has MAX_BUNNIES active bunnies. */
export function addBunny(input: BunnyInput): Bunny {
  if (atBunnyLimit(data)) throw new Error(LIMIT_MESSAGE)
  const at = nowIso()
  const bunny: Bunny = {
    ...cleanBunnyInput(input),
    id: newId('b'),
    createdAt: at,
    updatedAt: at,
  }
  commit({ ...data, bunnies: [...data.bunnies, bunny] })
  return bunny
}

export function updateBunny(id: string, patch: Partial<BunnyInput>): void {
  commit({
    ...data,
    bunnies: data.bunnies.map((b) =>
      b.id === id ? { id: b.id, createdAt: b.createdAt, ...cleanBunnyInput({ ...b, ...patch }), updatedAt: nowIso() } : b,
    ),
  })
}

/** The dataset with one bunny's `updatedAt` set to now. */
function touchBunny(d: MyBunnyData, id: string): MyBunnyData {
  const at = nowIso()
  return { ...d, bunnies: d.bunnies.map((b) => (b.id === id ? { ...b, updatedAt: at } : b)) }
}

/**
 * Store or remove a bunny's photo (IndexedDB) and flip its `hasPhoto` flag.
 * Resolves false — and sets the save warning — when the photo couldn't be kept.
 */
export async function setBunnyPhoto(id: string, dataUrl: string | undefined): Promise<boolean> {
  if (!dataUrl) {
    await deletePhoto(id)
    if (findBunny(data, id)?.hasPhoto) updateBunny(id, { hasPhoto: false })
    return true
  }
  const ok = await putPhoto(id, dataUrl)
  if (ok) {
    if (!findBunny(data, id)?.hasPhoto) updateBunny(id, { hasPhoto: true })
  } else {
    if (findBunny(data, id)?.hasPhoto) updateBunny(id, { hasPhoto: false })
    lastSaveError = 'Couldn’t keep the photo on this phone (private browsing, or storage is blocked). Everything else was saved.'
    listeners.forEach((l) => l())
  }
  return ok
}

/**
 * The photo came from (or was removed on) the account (update 32): flip
 * `hasPhoto` WITHOUT stamping `updatedAt` — `hasPhoto` is this phone's
 * business, so nothing about the bunny itself changed.
 */
export function markPhotoHere(id: string, has: boolean): void {
  const b = findBunny(data, id)
  if (!b || Boolean(b.hasPhoto) === has) return
  commit({
    ...data,
    bunnies: data.bunnies.map((x) => {
      if (x.id !== id) return x
      const { hasPhoto: _drop, ...rest } = x
      return has ? { ...rest, hasPhoto: true } : rest
    }),
  })
}

/** Removes the bunny plus its reminders, weight log, health notes and photo. */
export function deleteBunny(id: string): void {
  const weights = { ...data.weights }
  delete weights[id]
  commit({
    ...data,
    bunnies: data.bunnies.filter((b) => b.id !== id),
    reminders: data.reminders.filter((r) => r.bunnyId !== id),
    health: data.health.filter((h) => h.bunnyId !== id),
    weights,
  })
  void deletePhoto(id)
}

/** Pure: the dataset with one bunny archived (records untouched). */
export function applyArchive(d: MyBunnyData, id: string, archive: BunnyArchive): MyBunnyData {
  const clean: BunnyArchive = {
    reason: ARCHIVE_REASONS.includes(archive.reason) ? archive.reason : 'other',
    date: isIsoDate(archive.date) ? archive.date : todayIso(),
    ...(archive.note?.trim() ? { note: archive.note.trim() } : {}),
  }
  return { ...d, bunnies: d.bunnies.map((b) => (b.id === id ? { ...b, archived: clean } : b)) }
}

/** Pure: the dataset with one bunny back in the active list. */
export function applyRestore(d: MyBunnyData, id: string): MyBunnyData {
  return {
    ...d,
    bunnies: d.bunnies.map((b) => {
      if (b.id !== id) return b
      const { archived: _drop, ...rest } = b
      return rest
    }),
  }
}

export function archiveBunny(id: string, archive: BunnyArchive): void {
  commit(touchBunny(applyArchive(data, id, archive), id))
}

/** Throws with LIMIT_MESSAGE when restoring would exceed MAX_BUNNIES active bunnies. */
export function restoreBunny(id: string): void {
  if (findBunny(data, id)?.archived && atBunnyLimit(data)) throw new Error(LIMIT_MESSAGE)
  commit(touchBunny(applyRestore(data, id), id))
}

// Drop empty optional fields so the stored record stays tidy. Note: a patch
// that sets a field to undefined clears it (the spread above lets that through).
function cleanBunnyInput(input: BunnyInput): BunnyInput {
  const out: BunnyInput = {
    name: input.name.trim(),
    role: BUNNY_ROLES.includes(input.role) ? input.role : 'pet',
  }
  if (input.hasPhoto === true) out.hasPhoto = true
  if (isIsoDate(input.birthday)) out.birthday = input.birthday
  if (typeof input.approxAgeMonths === 'number' && input.approxAgeMonths >= 0 && !out.birthday) {
    out.approxAgeMonths = Math.round(input.approxAgeMonths)
    out.approxAgeAsOf = isIsoDate(input.approxAgeAsOf) ? input.approxAgeAsOf : todayIso()
  }
  if (input.sex && SEXES.includes(input.sex)) out.sex = input.sex
  if (input.breed?.trim()) out.breed = input.breed.trim()
  if (isIsoDate(input.fixedOn)) out.fixedOn = input.fixedOn
  if (input.notes?.trim()) out.notes = input.notes.trim()
  const archived = sanitizeArchive(input.archived)
  if (archived) out.archived = archived
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

export type ReminderInput = Omit<Reminder, 'id' | 'updatedAt'>

export function addReminder(input: ReminderInput): Reminder {
  const r: Reminder = { ...cleanReminderInput(input), id: newId('r'), updatedAt: nowIso() }
  commit({ ...data, reminders: [...data.reminders, r] })
  return r
}

export function updateReminder(id: string, patch: Partial<ReminderInput>): void {
  commit({
    ...data,
    reminders: data.reminders.map((r) =>
      r.id === id ? { id: r.id, ...cleanReminderInput({ ...r, ...patch }), updatedAt: nowIso() } : r,
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
      updated = { ...advance(r, doneOn), updatedAt: nowIso() }
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

export type HealthNoteInput = Omit<HealthNote, 'id' | 'createdAt' | 'updatedAt'>

export function addHealthNote(input: HealthNoteInput): HealthNote {
  const at = nowIso()
  const note: HealthNote = { ...cleanHealthInput(input), id: newId('h'), createdAt: at, updatedAt: at }
  commit({ ...data, health: [...data.health, note] })
  return note
}

export function updateHealthNote(id: string, patch: Partial<HealthNoteInput>): void {
  commit({
    ...data,
    health: data.health.map((h) =>
      h.id === id ? { id: h.id, createdAt: h.createdAt, ...cleanHealthInput({ ...h, ...patch }), updatedAt: nowIso() } : h,
    ),
  })
}

export function deleteHealthNote(id: string): void {
  commit({ ...data, health: data.health.filter((h) => h.id !== id) })
}

function cleanHealthInput(input: HealthNoteInput): HealthNoteInput {
  const out: HealthNoteInput = {
    bunnyId: input.bunnyId,
    date: isIsoDate(input.date) ? input.date : todayIso(),
    noticed: input.noticed.trim(),
    resolved: input.resolved === true,
  }
  if (input.topicSlug?.trim()) out.topicSlug = input.topicSlug.trim()
  if (input.topicTitle?.trim()) out.topicTitle = input.topicTitle.trim()
  if (input.did?.trim()) out.did = input.did.trim()
  if (input.followUp?.trim()) out.followUp = input.followUp.trim()
  return out
}

/* ---------------------------------------------------------------- queries */

export function findBunny(d: MyBunnyData, id: string | undefined): Bunny | undefined {
  return d.bunnies.find((b) => b.id === id)
}

export function isArchived(b: Pick<Bunny, 'archived'>): boolean {
  return Boolean(b.archived)
}

/** Bunnies still in your care, in the order they were added. */
export function activeBunnies(d: MyBunnyData): Bunny[] {
  return d.bunnies.filter((b) => !b.archived)
}

/** Archived bunnies, most recently archived first. */
export function archivedBunnies(d: MyBunnyData): Bunny[] {
  return d.bunnies
    .filter((b) => b.archived)
    .sort((a, b) => (a.archived!.date < b.archived!.date ? 1 : a.archived!.date > b.archived!.date ? -1 : 0))
}

export function atBunnyLimit(d: MyBunnyData): boolean {
  return activeBunnies(d).length >= MAX_BUNNIES
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

/**
 * How many upcoming reminders are due today or overdue — across all ACTIVE
 * bunnies, or one. An archived bunny's reminders are kept but never counted.
 */
export function dueCount(
  d: MyBunnyData,
  today: string = todayIso(),
  bunnyId?: string,
): { overdue: number; today: number; total: number } {
  const archived = new Set(d.bunnies.filter((b) => b.archived).map((b) => b.id))
  let overdue = 0
  let dueToday = 0
  for (const r of d.reminders) {
    if (bunnyId && r.bunnyId !== bunnyId) continue
    if (archived.has(r.bunnyId)) continue
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

/** A bunny's health notes, newest first (open ones before resolved on the same date). */
export function healthNotesFor(d: MyBunnyData, bunnyId: string): HealthNote[] {
  return d.health
    .filter((h) => h.bunnyId === bunnyId)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1
      if (a.resolved !== b.resolved) return a.resolved ? 1 : -1
      return a.createdAt < b.createdAt ? 1 : -1
    })
}

/* --------------------------------------------------------- backup/restore */

/**
 * Pure: the backup file text. Photos are embedded per bunny as `photoDataUrl`
 * (the same shape v1 used), so one file carries everything — including
 * archived bunnies and their records.
 */
export function buildBackup(d: MyBunnyData, photos: Record<string, string> = {}): string {
  const bunnies = d.bunnies.map((b) => (photos[b.id] ? { ...b, photoDataUrl: photos[b.id] } : b))
  return JSON.stringify(
    { ...d, bunnies, exportedAt: new Date().toISOString(), app: 'ohrr-app/my-bunny' },
    null,
    2,
  )
}

/** Pure: a backup file's text → sanitized dataset + the photos it embedded. Throws on unreadable input. */
export function parseBackup(text: string): { data: MyBunnyData; photos: Record<string, string> } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('That file isn’t a My Bunny backup.')
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.bunnies)) {
    throw new Error('That file isn’t a My Bunny backup.')
  }
  return { data: sanitize(parsed), photos: extractPhotos(parsed) }
}

/** The current data plus every stored photo, as backup file text. */
export async function exportBackup(): Promise<string> {
  const photos = await getAllPhotos()
  return buildBackup(data, photos)
}

export interface ImportResult {
  bunnies: number
  reminders: number
  weights: number
  health: number
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
  const healthIds = new Set(current.health.map((h) => h.id))
  const newHealth = incoming.health.filter((h) => !healthIds.has(h.id))

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
      version: 2,
      bunnies: [...current.bunnies, ...newBunnies],
      reminders: [...current.reminders, ...newReminders],
      weights,
      health: [...current.health, ...newHealth],
      prefs: current.prefs,
    },
    result: {
      bunnies: newBunnies.length,
      reminders: newReminders.length,
      weights: weightCount,
      health: newHealth.length,
    },
  }
}

/**
 * Parse + validate a backup file's text, merge it in, and write the photos of
 * any newly added bunnies to IndexedDB. Throws on unreadable input. `photos`
 * counts the pictures that were actually stored.
 */
export async function importBackup(text: string): Promise<ImportResult & { photos: number }> {
  const { data: incoming, photos } = parseBackup(text)
  const before = new Set(data.bunnies.map((b) => b.id))
  const merged = mergeData(data, incoming)
  const fresh: Record<string, string> = {}
  for (const b of merged.data.bunnies) {
    if (!before.has(b.id) && b.hasPhoto && photos[b.id]) fresh[b.id] = photos[b.id]
  }
  const failed = await putPhotos(fresh)
  if (failed.length > 0) {
    const bad = new Set(failed)
    merged.data.bunnies = merged.data.bunnies.map((b) => {
      if (!bad.has(b.id)) return b
      const { hasPhoto: _drop, ...rest } = b
      return rest
    })
  }
  commit(merged.data)
  return { ...merged.result, photos: Object.keys(fresh).length - failed.length }
}

export function backupFilename(today: string = todayIso()): string {
  return `ohrr-my-bunny-backup-${today}.json`
}

/* ------------------------------------------------------- account sync */
//
// Signed in, the account keeps the same JSON minus the photos (`hasPhoto` is
// this phone's business, so it isn't sent). Since update 32 the photos go to
// the account separately, as files in a private folder — see
// features/account/photoSync.ts. The sync engine (features/account/sync.ts)
// calls these; they're pure apart from applySynced(), so
// scripts/mybunny-check.ts exercises them.

/** What the account stores: the data without `hasPhoto`. */
export function forAccount(d: MyBunnyData): MyBunnyData {
  return {
    ...d,
    bunnies: d.bunnies.map((b) => {
      const { hasPhoto: _drop, ...rest } = b
      return rest
    }),
  }
}

/**
 * What the account held after the last sync on this phone — ids with their
 * `updatedAt` (weights: grams by bunny|date). Small, so it's kept per phone;
 * with it a later merge can tell "deleted over there" from "added here".
 */
export interface SyncBase {
  bunnies: Record<string, string>
  reminders: Record<string, string>
  health: Record<string, string>
  weights: Record<string, number>
  unit: WeightUnit
}

const stampOf = (x: { updatedAt?: string }) => x.updatedAt ?? ''

export function syncBaseOf(d: MyBunnyData): SyncBase {
  const weights: Record<string, number> = {}
  for (const [bunnyId, list] of Object.entries(d.weights)) for (const w of list) weights[`${bunnyId}|${w.date}`] = w.grams
  return {
    bunnies: Object.fromEntries(d.bunnies.map((b) => [b.id, stampOf(b)])),
    reminders: Object.fromEntries(d.reminders.map((r) => [r.id, stampOf(r)])),
    health: Object.fromEntries(d.health.map((h) => [h.id, stampOf(h)])),
    weights,
    unit: d.prefs.weightUnit,
  }
}

/** A stored base back from JSON; null when it isn't one. */
export function readSyncBase(raw: unknown): SyncBase | null {
  if (!isRecord(raw)) return null
  const strings = (v: unknown): Record<string, string> =>
    isRecord(v) ? Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === 'string')) : {}
  const numbers = isRecord(raw.weights)
    ? Object.fromEntries(Object.entries(raw.weights).filter((e): e is [string, number] => typeof e[1] === 'number'))
    : {}
  return {
    bunnies: strings(raw.bunnies),
    reminders: strings(raw.reminders),
    health: strings(raw.health),
    weights: numbers,
    unit: raw.unit === 'g' ? 'g' : 'lb',
  }
}

/** Key-order-free JSON, for "is this the same record?". */
function canonical(v: unknown): string {
  return JSON.stringify(v, (_k, val: unknown) =>
    isRecord(val) ? Object.fromEntries(Object.keys(val).sort().map((k) => [k, val[k]])) : val,
  )
}

/**
 * One list merged by id. `base` null = the first sign-in on this phone: the
 * union, and for an id on both sides the newer `updatedAt` (a stamped copy
 * beats an unstamped one). With a base, an id missing on one side was deleted
 * there — it goes, unless the other side edited it since (an edit beats a
 * delete). When nothing says which copy is newer, `onTie` decides.
 */
function mergeById<T extends { id: string; updatedAt?: string }>(
  device: T[],
  account: T[],
  base: Record<string, string> | null,
  onTie: (d: T, a: T) => T[],
): T[] {
  const onAccount = new Map(account.map((x) => [x.id, x]))
  const onDevice = new Set(device.map((x) => x.id))
  const out: T[] = []
  for (const d of device) {
    const a = onAccount.get(d.id)
    if (!a) {
      // Deleted on another phone, and not touched here since: let it go.
      if (base && d.id in base && stampOf(d) === base[d.id]) continue
      out.push(d)
      continue
    }
    if (canonical(d) === canonical(a)) {
      out.push(d)
      continue
    }
    const sd = stampOf(d)
    const sa = stampOf(a)
    if (base && d.id in base) {
      if (sd === base[d.id]) {
        out.push(a) // only the account's copy changed
        continue
      }
      if (sa === base[d.id]) {
        out.push(d) // only this phone's copy changed
        continue
      }
    }
    if (sd !== sa && (sd || sa)) {
      out.push(sd > sa ? d : a)
      continue
    }
    out.push(...onTie(d, a))
  }
  for (const a of account) {
    if (onDevice.has(a.id)) continue
    // Deleted on this phone, and not touched on the account since.
    if (base && a.id in base && stampOf(a) === base[a.id]) continue
    out.push(a)
  }
  return out
}

/**
 * This phone's My Bunny and the account's, as one. Both in account form
 * (forAccount); `base` from syncBaseOf() after the last sync here, or null on
 * the first sign-in on this phone. Bunnies, reminders and health notes merge
 * by id, keeping the newest `updatedAt`; with no way to tell (two copies of a
 * bunny from before update 31 that differ), both are kept — the account's as a
 * second bunny, "(from your account)" — so a bunny is never silently dropped.
 * Weights merge by bunny and date; the weight unit follows whichever side
 * changed it.
 */
export function mergeSynced(device: MyBunnyData, account: MyBunnyData, base: SyncBase | null): MyBunnyData {
  const bunnies = mergeById(device.bunnies, account.bunnies, base?.bunnies ?? null, (d, a) => [
    d,
    { ...a, id: newId('b'), name: `${a.name} (from your account)` },
  ])
  // A reminder isn't worth doubling up (it would fire twice): the one done
  // most recently, else the one due later, else this phone's.
  const reminders = mergeById(device.reminders, account.reminders, base?.reminders ?? null, (d, a) => {
    const ld = d.lastDone ?? ''
    const la = a.lastDone ?? ''
    if (ld !== la) return [ld > la ? d : a]
    return [a.nextDue > d.nextDue ? a : d]
  })
  // Notes are someone's own words: keep both.
  const health = mergeById(device.health, account.health, base?.health ?? null, (d, a) => [d, { ...a, id: newId('h') }])

  const dev = syncBaseOf(device).weights
  const acc = syncBaseOf(account).weights
  const was = base?.weights ?? null
  const weights: Record<string, WeightEntry[]> = {}
  for (const key of new Set([...Object.keys(dev), ...Object.keys(acc)])) {
    const d = dev[key]
    const a = acc[key]
    let grams: number | undefined
    if (d !== undefined && a !== undefined) grams = was && was[key] === d ? a : d
    else if (d !== undefined) grams = was && was[key] === d ? undefined : d
    else grams = was && was[key] === a ? undefined : a
    if (grams === undefined) continue
    const cut = key.lastIndexOf('|')
    const bunnyId = key.slice(0, cut)
    ;(weights[bunnyId] ??= []).push({ date: key.slice(cut + 1), grams })
  }

  const unit = base && device.prefs.weightUnit === base.unit ? account.prefs.weightUnit : device.prefs.weightUnit
  // sanitize() drops anything left pointing at a bunny that went, and sorts the weights.
  return sanitize({ version: 2, bunnies, reminders, health, weights, prefs: { weightUnit: unit } })
}

/**
 * Put the account's (merged) copy on this phone. Photos stay as they are: a
 * bunny keeps its picture here if it had one.
 */
export function applySynced(next: MyBunnyData): void {
  const withPhoto = new Set(data.bunnies.filter((b) => b.hasPhoto).map((b) => b.id))
  commit({
    ...next,
    bunnies: next.bunnies.map((b) => {
      const { hasPhoto: _drop, ...rest } = b
      return withPhoto.has(b.id) ? { ...rest, hasPhoto: true } : rest
    }),
  })
}
