// The site design: ONE shared look for the app and the website.
//
// SHARED FILE. src/lib/design.ts in ohrr-app and in ohrr-website are the same
// file: change one, copy it to the other (same pattern as features.ts / settings.ts).
//
// What staff can change (Staff → Web page design, for people holding the
// "Web page admin" task, plus Founders and Developers):
//   * the two brand colors (the lighter/darker shades are worked out from them),
//   * a soft picture behind the pages, and a picture behind the home welcome band,
//   * which sections the home page shows, and in what order.
// Everything is chosen from a short list of safe settings, so nobody can make a
// page unreadable: colors must pass a contrast check, pictures sit under a veil,
// and the welcome band and the sections people rely on can't be removed.
//
// It is stored as ONE publicly readable app_settings row, key `design_site`, so
// every value is sanitized here before it reaches CSS. A bad or missing row
// leaves the standard OHRR look. The last good design is kept on the device so
// the app opens in the right look straight away, even offline.
import { useSyncExternalStore } from 'react'

export const DESIGN_KEY = 'design_site'
/** Earlier published designs, newest first (app_settings row `design_history`). */
export const DESIGN_HISTORY_KEY = 'design_history'
export const DESIGN_HISTORY_MAX = 10
/** The task that opens the design screens (Founders and Developers always can). */
export const DESIGN_CAPABILITY = 'site.design'

export const DEFAULT_BLUE = '#0669ac'
export const DEFAULT_ORANGE = '#eb891c'

export type Surface = 'app' | 'web'

export interface ImageSetting {
  /** A picture in the site-images bucket (or one of the site's own /img files). */
  url: string | null
  /** How much of a soft color covers the picture, 0–90 %, so text on top stays readable. */
  veil: number
}

export interface SectionSetting {
  id: string
  on: boolean
}

export interface SiteDesign {
  v: 1
  blue: string
  orange: string
  /** Behind every public page. */
  pageImage: ImageSetting
  /** Behind the welcome band at the top of the home page. */
  bandImage: ImageSetting
  /** The home page's sections for each of the two places, in order. */
  home: Record<Surface, SectionSetting[]>
}

export interface HomeSectionInfo {
  id: string
  label: string
  hint: string
}

/**
 * The home-page sections staff can show, hide and reorder, in the order they
 * come in until someone changes it. The welcome band at the top is always there.
 * The two places overlap but aren't identical: each shows only the sections it has.
 */
export const HOME_SECTIONS: Record<Surface, HomeSectionInfo[]> = {
  web: [
    { id: 'help-needed', label: 'Volunteers needed', hint: 'Shows by itself while a volunteer call is open.' },
    { id: 'happening', label: 'What’s happening', hint: 'The picture cards staff set up under Home screen.' },
    { id: 'thinking', label: 'Thinking about getting a rabbit?', hint: 'The two-minute check.' },
    { id: 'presented-by', label: 'Presented by', hint: 'Sponsor logos.' },
    { id: 'how-to-help', label: 'Help us help them', hint: 'Volunteer, Foster, Donate.' },
    { id: 'this-week', label: 'Hours and the next event', hint: 'The quiet line at the bottom.' },
  ],
  app: [
    { id: 'help-needed', label: 'Volunteers needed', hint: 'Shows by itself while a volunteer call is open.' },
    { id: 'for-you', label: 'What’s new for you', hint: 'Updates for the things a person follows.' },
    { id: 'presented-by', label: 'Presented by', hint: 'Sponsor logos.' },
    { id: 'my-bunny', label: 'My Bunny and search', hint: 'A person’s own rabbit, Bunny Help and their bookings.' },
    { id: 'slides', label: 'Picture cards', hint: 'The sliding cards staff set up under Home screen.' },
    { id: 'quick-actions', label: 'Quick actions', hint: 'The six big buttons.' },
    { id: 'thinking', label: 'Thinking about getting a rabbit?', hint: 'The two-minute check.' },
    { id: 'explore', label: 'Explore', hint: 'The list of everything else.' },
    { id: 'visit', label: 'Visit card', hint: 'Hours and Schedule a visit.' },
  ],
}

const DEFAULT_HOME = (): Record<Surface, SectionSetting[]> => ({
  web: HOME_SECTIONS.web.map((s) => ({ id: s.id, on: true })),
  app: HOME_SECTIONS.app.map((s) => ({ id: s.id, on: true })),
})

export const DEFAULT_DESIGN: SiteDesign = {
  v: 1,
  blue: DEFAULT_BLUE,
  orange: DEFAULT_ORANGE,
  pageImage: { url: null, veil: 85 },
  bandImage: { url: null, veil: 55 },
  home: DEFAULT_HOME(),
}

/* ------------------------------------------------------------------ */
/* Checking what comes out of the database                             */
/* ------------------------------------------------------------------ */

const HEX = /^#[0-9a-f]{6}$/i
// Only the site's own pictures: a path on this site, or the public site-images bucket.
const SITE_IMAGE = /^(\/(?!\/)[A-Za-z0-9\-._~/%]+|https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/site-images\/[A-Za-z0-9\-._~/%]+)$/

const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)

export function cleanImageUrl(v: unknown): string | null {
  return typeof v === 'string' && v.length <= 600 && SITE_IMAGE.test(v) ? v : null
}

function parseImage(v: unknown, fallback: ImageSetting): ImageSetting {
  if (!isObj(v)) return { ...fallback }
  const veil = typeof v.veil === 'number' && Number.isFinite(v.veil) ? Math.min(90, Math.max(0, Math.round(v.veil))) : fallback.veil
  return { url: cleanImageUrl(v.url), veil }
}

function parseSections(v: unknown, surface: Surface): SectionSetting[] {
  const known = HOME_SECTIONS[surface].map((s) => s.id)
  const out: SectionSetting[] = []
  if (Array.isArray(v)) {
    for (const item of v) {
      if (!isObj(item) || typeof item.id !== 'string') continue
      if (!known.includes(item.id) || out.some((o) => o.id === item.id)) continue
      out.push({ id: item.id, on: item.on !== false })
    }
  }
  // A section that is new since this was saved joins the end, shown.
  for (const id of known) if (!out.some((o) => o.id === id)) out.push({ id, on: true })
  return out
}

/** Whatever is stored → a safe design. Each field falls back to the standard look by itself. */
export function parseDesign(raw: unknown): SiteDesign {
  const r = isObj(raw) ? raw : {}
  const blue = typeof r.blue === 'string' && HEX.test(r.blue) ? r.blue.toLowerCase() : DEFAULT_BLUE
  const orange = typeof r.orange === 'string' && HEX.test(r.orange) ? r.orange.toLowerCase() : DEFAULT_ORANGE
  // A color that would make text unreadable is not used, even if it was stored.
  const bad = colorProblem(blue, orange)
  const home = isObj(r.home) ? r.home : {}
  return {
    v: 1,
    blue: bad ? DEFAULT_BLUE : blue,
    orange: bad ? DEFAULT_ORANGE : orange,
    pageImage: parseImage(r.pageImage, DEFAULT_DESIGN.pageImage),
    bandImage: parseImage(r.bandImage, DEFAULT_DESIGN.bandImage),
    home: { web: parseSections(home.web, 'web'), app: parseSections(home.app, 'app') },
  }
}

/** The sections of one place, in order, each with whether it is shown. */
export function resolveHome(surface: Surface, d: SiteDesign): SectionSetting[] {
  return parseSections(d.home[surface], surface)
}

/* ------------------------------------------------------------------ */
/* Color math                                                          */
/* ------------------------------------------------------------------ */

type RGB = [number, number, number]

const toRgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB
const toHex = (c: RGB) => `#${c.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('')}`
const darken = (hex: string, f: number): string => toHex(toRgb(hex).map((n) => n * f) as RGB)
const mixWhite = (hex: string, t: number): string => toHex(toRgb(hex).map((n) => n + (255 - n) * t) as RGB)

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((n) => {
    const s = n / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const INK = '#2f3a45'

/**
 * Null when the pair is safe to use, otherwise one plain sentence saying why not.
 * Blue carries white text (buttons, the welcome band) and is used as link text on white;
 * orange carries dark text (badges) and must still show on white.
 */
export function colorProblem(blue: string, orange: string): string | null {
  if (contrast(blue, '#ffffff') < 4.5) return 'That blue is too light: white words on it would be hard to read. Pick a deeper blue.'
  if (luminance(blue) < 0.012) return 'That blue is so dark it looks black. Pick a blue people can see is blue.'
  if (contrast(orange, INK) < 4) return 'That orange is too dark: dark words on it would be hard to read. Pick a lighter orange.'
  if (contrast(orange, '#ffffff') < 1.6) return 'That orange is too pale: it would disappear on a white page. Pick a stronger orange.'
  return null
}

/** Darken until the color reads on white at the given contrast (for orange used as text). */
function readableOnWhite(hex: string, target: number): string {
  let c = hex
  for (let i = 0; i < 40 && contrast(c, '#ffffff') < target; i++) c = darken(c, 0.96)
  return c
}

/** The CSS variables for a pair of brand colors; the lighter and darker shades follow. */
export function paletteVars(blue: string, orange: string): Record<string, string> {
  const vars: Record<string, string> = {}
  if (blue !== DEFAULT_BLUE) {
    vars['--color-brand-blue'] = blue
    vars['--color-brand-blue-dark'] = darken(blue, 0.81)
    vars['--color-brand-blue-50'] = mixWhite(blue, 0.92)
  }
  if (orange !== DEFAULT_ORANGE) {
    vars['--color-brand-orange'] = orange
    vars['--color-brand-orange-dark'] = darken(orange, 0.88)
    vars['--color-brand-orange-50'] = mixWhite(orange, 0.9)
    vars['--color-brand-orange-100'] = mixWhite(orange, 0.75)
    vars['--color-brand-orange-ink'] = readableOnWhite(darken(orange, 0.65), 6)
    vars['--color-brand-orange-nav'] = readableOnWhite(darken(orange, 0.76), 4.6)
  }
  return vars
}

const rgba = (hex: string, alpha: number) => {
  const [r, g, b] = toRgb(hex)
  return `rgba(${r},${g},${b},${alpha})`
}

/* ------------------------------------------------------------------ */
/* Putting a design on the page                                        */
/* ------------------------------------------------------------------ */

const ALL_VARS = [
  '--color-brand-blue',
  '--color-brand-blue-dark',
  '--color-brand-blue-50',
  '--color-brand-orange',
  '--color-brand-orange-dark',
  '--color-brand-orange-50',
  '--color-brand-orange-100',
  '--color-brand-orange-ink',
  '--color-brand-orange-nav',
  '--design-page-image',
  '--design-band-image-app',
  '--design-band-image-web',
]

/** Sets the design's variables on the page. A null design puts the standard look back. */
export function applyDesign(d: SiteDesign | null): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement.style
  for (const name of ALL_VARS) root.removeProperty(name)
  if (!d) return
  for (const [k, v] of Object.entries(paletteVars(d.blue, d.orange))) root.setProperty(k, v)
  if (d.pageImage.url) {
    const veil = rgba('#ffffff', d.pageImage.veil / 100)
    root.setProperty('--design-page-image', `linear-gradient(${veil},${veil}),url("${d.pageImage.url}")`)
  }
  if (d.bandImage.url) {
    const v = d.bandImage.veil / 100
    const darkBlue = paletteVars(d.blue, d.orange)['--color-brand-blue-dark'] ?? darken(d.blue, 0.81)
    const deep = rgba(darkBlue, v)
    const light = rgba('#ffffff', v)
    root.setProperty('--design-band-image-app', `linear-gradient(${deep},${deep}),url("${d.bandImage.url}")`)
    root.setProperty('--design-band-image-web', `linear-gradient(${light},${light}),url("${d.bandImage.url}")`)
  }
}

const CACHE_KEY = 'ohrr.design.v1'

function readCache(): SiteDesign | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? parseDesign(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

function writeCache(d: SiteDesign | null): void {
  try {
    if (d) localStorage.setItem(CACHE_KEY, JSON.stringify(d))
    else localStorage.removeItem(CACHE_KEY)
  } catch {
    // private window or blocked storage: the design just isn't remembered
  }
}

/* ------------------------------------------------------------------ */
/* The design in use                                                   */
/* ------------------------------------------------------------------ */

let published: SiteDesign = readCache() ?? DEFAULT_DESIGN
let shown: SiteDesign = published
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

if (shown !== DEFAULT_DESIGN) applyDesign(shown)

/** The design on screen now. */
export const getDesign = (): SiteDesign => shown

/** The design visitors get (not a try-out in progress). */
export const getPublishedDesign = (): SiteDesign => published

export function useDesign(): SiteDesign {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    getDesign,
    getDesign,
  )
}

/** The design everyone gets. Remembered on this device. */
export function setPublishedDesign(d: SiteDesign): void {
  published = d
  shown = d
  writeCache(d)
  applyDesign(d)
  emit()
}

/** Try a design on this screen only (staff, while editing). null puts the published one back. */
export function previewDesign(d: SiteDesign | null): void {
  shown = d ?? published
  applyDesign(shown)
  emit()
}

/**
 * Called once as the page starts. `fetchRow` returns the stored `design_site` value
 * (or null); a failure leaves whatever the device remembered.
 */
export function startDesign(fetchRow: () => Promise<unknown>): void {
  void fetchRow()
    .then((row) => {
      if (row == null) {
        // Nothing published (or it was cleared): the standard look.
        setPublishedDesign(DEFAULT_DESIGN)
        writeCache(null)
        return
      }
      setPublishedDesign(parseDesign(row))
    })
    .catch(() => undefined)
}
