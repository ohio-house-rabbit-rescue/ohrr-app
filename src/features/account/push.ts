// Phone notifications (update 32 — web push). The web app only: the phone
// app's WebView can't take web push, so inside the Android / iOS app My OHRR
// keeps its on-phone reminders and says notifications come with the
// app-store version.
//
//   the key       push_public_key() — the function's VAPID public key
//                 (base64url), or null until it has made one: init_push()
//                 asks it to, then we look again ~3 s later (twice at most)
//   subscribing   pushManager.subscribe() on the service worker (public/sw.js
//                 shows the notification and opens its link), then
//                 save_push_subscription() with the topics ticked. Works signed
//                 out; signed in, the phone is tied to the account.
//   topics        push_subscription_topics(endpoint) reads them back;
//                 remove_push_subscription(endpoint) forgets the phone
//   a test        send_test_notification() — signed in, to their own phones
//
// iPhone: web push only works once OHRR has been added to the Home Screen and
// opened from there (public/manifest.webmanifest makes it open as an app).
// Until update 32 is run the functions don't exist: callers get 'missing'.
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import type { PushTopic } from '../../lib/database.types'
import { isNative } from '../../native/platform'
import { getDeviceInterests, isMissing, type Interest } from './emailList'

export const PUSH_TOPICS: readonly { key: PushTopic; label: string }[] = [
  { key: 'volunteer', label: 'Volunteer opportunities' },
  { key: 'events', label: 'Events' },
  { key: 'adoptions', label: 'New rabbits up for adoption' },
  { key: 'bunfest', label: 'Midwest BunFest' },
  { key: 'news', label: 'News from OHRR' },
]

export const PUSH_TOPIC_LABEL = Object.fromEntries(PUSH_TOPICS.map((t) => [t.key, t.label])) as Record<PushTopic, string>

export function isPushTopic(v: unknown): v is PushTopic {
  return typeof v === 'string' && PUSH_TOPICS.some((t) => t.key === v)
}

/** Only known topics, once each, in the list's order. */
export function cleanTopics(list: readonly unknown[]): PushTopic[] {
  return PUSH_TOPICS.map((t) => t.key).filter((k) => list.includes(k))
}

/** The email interests that have a notification of the same kind. */
const FROM_INTEREST: Partial<Record<Interest, PushTopic>> = {
  volunteer: 'volunteer',
  events: 'events',
  adoptions: 'adoptions',
  bunfest: 'bunfest',
  newsletter: 'news',
}

/** What's ticked to begin with: their email choices where they match, else volunteer calls. */
export function defaultTopics(): PushTopic[] {
  const mine = cleanTopics(getDeviceInterests().map((i) => FROM_INTEREST[i]))
  return mine.length > 0 ? mine : ['volunteer']
}

/* ------------------------------------------------------ this phone */

export function isIphone(): boolean {
  if (typeof navigator === 'undefined') return false
  // iPadOS reports itself as a Mac with a touch screen.
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** Opened from the Home Screen (as an app), not in a browser tab. */
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches)
}

/**
 * What this phone can do:
 *   native       the Android / iOS app (no web push in its WebView)
 *   home-screen  an iPhone in Safari: add OHRR to the Home Screen first
 *   unsupported  a browser without web push
 *   ok
 */
export type PushSupport = 'native' | 'home-screen' | 'unsupported' | 'ok'

export function pushSupport(): PushSupport {
  if (isNative) return 'native'
  if (typeof window === 'undefined') return 'unsupported'
  if (isIphone() && !isStandalone()) return 'home-screen'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  return 'ok'
}

export function notificationPermission(): NotificationPermission {
  return typeof Notification === 'undefined' ? 'default' : Notification.permission
}

/** The service worker, once it's running (main.tsx registers it on the web, in the built app). */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  let reg = await navigator.serviceWorker.getRegistration()
  // The first visit can get here before main.tsx's registration has started.
  if (!reg && import.meta.env.PROD) reg = await navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  if (!reg) return null
  if (reg.active) return reg
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 10_000))])
}

/** This phone's current subscription, if it has one. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== 'ok') return null
  const reg = await navigator.serviceWorker.getRegistration()
  return reg ? reg.pushManager.getSubscription() : null
}

/* ------------------------------------------------------------ the key */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

let cachedKey: string | null = null

/**
 * The function's public key. `init`: if there isn't one yet, ask the function
 * to make it and look again (twice at most). 'missing' = update 32 isn't in.
 * Throws when the database can't be reached.
 */
export async function pushPublicKey(init: boolean): Promise<string | null | 'missing'> {
  if (cachedKey) return cachedKey
  if (!isSupabaseConfigured) return 'missing'
  const ask = async () => {
    const { data, error } = await supabase.rpc('push_public_key')
    if (error) {
      if (isMissing(error)) return 'missing' as const
      throw new Error(error.message)
    }
    return data || null
  }
  let key = await ask()
  for (let i = 0; init && key === null && i < 2; i++) {
    await supabase.rpc('init_push')
    await wait(3000)
    key = await ask()
  }
  if (key && key !== 'missing') cachedKey = key
  return key
}

/** base64url → the bytes pushManager.subscribe() wants. */
function keyBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (b64url + '='.repeat((4 - (b64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function sameKey(sub: PushSubscription, key: Uint8Array): boolean {
  const had = sub.options.applicationServerKey
  if (!had) return false
  const a = new Uint8Array(had)
  return a.length === key.length && a.every((v, i) => v === key[i])
}

/* ------------------------------------------------------ on and off */

export const NOT_READY = 'Notifications aren’t switched on yet.'
export const NOT_YET = 'Notifications on this phone switch on with OHRR’s next update.'

/** Thrown when the phone (or the person) said no to notifications. */
export class PermissionDenied extends Error {
  constructor() {
    super('Notifications are blocked for OHRR on this phone.')
  }
}

/** Save (or re-save) this phone's subscription with these topics. */
export async function saveSubscription(sub: PushSubscription, topics: PushTopic[]): Promise<void> {
  const keys = sub.toJSON().keys ?? {}
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: sub.endpoint,
    p_p256dh: keys.p256dh ?? '',
    p_auth: keys.auth ?? '',
    p_topics: cleanTopics(topics),
    p_user_agent: navigator.userAgent.slice(0, 200),
  })
  if (error) throw new Error(isMissing(error) ? NOT_YET : error.message)
}

/**
 * Turn notifications on for these topics. Call it straight from the tap: the
 * permission question comes first, while the tap still counts (iPhone insists).
 * Throws PermissionDenied, or an Error with a message to show.
 */
export async function turnOnPush(topics: PushTopic[]): Promise<PushSubscription> {
  const answer = await Notification.requestPermission()
  if (answer !== 'granted') throw new PermissionDenied()
  const key = await pushPublicKey(true)
  if (key === 'missing') throw new Error(NOT_YET)
  if (!key) throw new Error(NOT_READY)
  const reg = await registration()
  if (!reg) throw new Error('This browser can’t take notifications from OHRR right now. Close it, open OHRR again and try once more.')
  const bytes = keyBytes(key)
  let sub = await reg.pushManager.getSubscription()
  // Made with an older key (the function's keys were remade): start again.
  if (sub && !sameKey(sub, bytes)) {
    await sub.unsubscribe().catch(() => false)
    sub = null
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes })
  await saveSubscription(sub, topics)
  decidePrompt()
  return sub
}

/** Turn them off: the database forgets this phone, and the phone forgets the subscription. */
export async function turnOffPush(sub: PushSubscription): Promise<void> {
  const { error } = await supabase.rpc('remove_push_subscription', { p_endpoint: sub.endpoint })
  if (error && !isMissing(error)) throw new Error(error.message)
  await sub.unsubscribe().catch(() => false)
  decidePrompt()
}

/** This phone's topics as the database has them; null = it doesn't know this phone. */
export async function loadTopics(sub: PushSubscription): Promise<PushTopic[] | null | 'missing'> {
  const { data, error } = await supabase.rpc('push_subscription_topics', { p_endpoint: sub.endpoint })
  if (error) {
    if (isMissing(error)) return 'missing'
    throw new Error(error.message)
  }
  return data ? cleanTopics(data) : null
}

/** Signed in: a test to their own phones. Re-saves this phone first so it's tied to the account. */
export async function sendTestNotification(sub: PushSubscription, topics: PushTopic[]): Promise<void> {
  await saveSubscription(sub, topics)
  const { error } = await supabase.rpc('send_test_notification')
  if (error) throw new Error(isMissing(error) ? NOT_YET : error.message)
}

/** How to allow notifications again, for this phone. */
export function howToAllow(): string {
  if (isIphone())
    return 'Notifications are blocked for OHRR. To allow them: open the iPhone’s Settings → Notifications → OHRR → turn on Allow Notifications, then come back and turn this on.'
  if (/Android/i.test(navigator.userAgent))
    return 'Notifications are blocked for OHRR. To allow them: tap the icon left of the address bar (or ⋮ → Settings → Site settings) → Notifications → Allow, then come back and turn this on.'
  return 'Notifications are blocked for OHRR in this browser. Allow them in the browser’s site settings (the icon left of the address), then come back and turn this on.'
}

/* ------------------------------------------- the "For you" question */

const PROMPT_KEY = 'ohrr.push.prompt.v1'

/** They answered the Home question, or chose in My OHRR: don't ask again. */
export function decidePrompt() {
  try {
    localStorage.setItem(PROMPT_KEY, 'decided')
  } catch {
    /* private mode — it may ask again next time */
  }
}

export function promptDecided(): boolean {
  try {
    return localStorage.getItem(PROMPT_KEY) === 'decided'
  } catch {
    return false
  }
}
