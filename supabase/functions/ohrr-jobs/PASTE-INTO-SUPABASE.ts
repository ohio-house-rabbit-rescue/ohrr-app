// =============================================================
// OHRR — the "ohrr-jobs" Edge Function (update 32). Paste ALL of this into
// Supabase → Edge Functions → Deploy a new function → Via Editor, name it
// exactly  ohrr-jobs , switch "Verify JWT" OFF, and Deploy.
// (The code repository keeps it as supabase/functions/ohrr-jobs/.)
// =============================================================
// OHRR's one Supabase Edge Function (update 32). Two jobs:
//
//   push      send a phone notification (web push) to everyone who asked for
//             that topic — a new volunteer call, event or rabbit, or one staff
//             wrote in Staff → Send a notification
//   rabbits   read OHRR's RescueGroups listing and bring the rabbits table up
//             to date (every morning, and from Staff → Adoptable rabbits)
//   init      make the web-push keys the first time (they're kept in the
//             database, never in code or chat)
//
// It is only ever called by the database itself (pg_net, from a trigger or the
// daily schedule), which sends the shared secret kept in push_config. Deploy it
// in Supabase → Edge Functions as "ohrr-jobs" with "Verify JWT" switched OFF —
// the secret does that job. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
// provided to every Edge Function by Supabase.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

interface Config {
  public_key: string | null
  private_key: string | null
  trigger_secret: string
}

async function config(): Promise<Config> {
  const { data, error } = await db.from('push_config').select('public_key, private_key, trigger_secret').eq('id', 1).single()
  if (error || !data) throw new Error(`push_config: ${error?.message ?? 'missing'}`)
  return data as Config
}

async function ensureKeys(cfg: Config): Promise<Config> {
  if (cfg.public_key && cfg.private_key) return cfg
  const keys = webpush.generateVAPIDKeys()
  const { error } = await db
    .from('push_config')
    .update({ public_key: keys.publicKey, private_key: keys.privateKey, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .is('public_key', null)
  if (error) throw new Error(`saving keys: ${error.message}`)
  return await config()
}

async function sendPush(id: string, cfg: Config) {
  const { data: msg, error } = await db.from('push_messages').select('*').eq('id', id).single()
  if (error || !msg) throw new Error(`message ${id}: ${error?.message ?? 'not found'}`)
  if (msg.sent_at) return { skipped: 'already sent' }

  let q = db.from('push_subscriptions').select('id, endpoint, p256dh, auth, fail_count')
  q = msg.only_user ? q.eq('user_id', msg.only_user) : q.contains('topics', [msg.topic])
  const { data: subs, error: subErr } = await q
  if (subErr) throw new Error(`subscriptions: ${subErr.message}`)

  webpush.setVapidDetails('https://ohrr-app.pages.dev', cfg.public_key!, cfg.private_key!)
  const payload = JSON.stringify({ title: msg.title, body: msg.body ?? '', url: msg.url ?? '/', tag: msg.dedupe_key ?? msg.id })
  let sent = 0
  let failed = 0
  const gone: string[] = []
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 })
      sent++
      await db.from('push_subscriptions').update({ last_sent_at: new Date().toISOString(), fail_count: 0 }).eq('id', s.id)
    } catch (e) {
      failed++
      const code = (e as { statusCode?: number }).statusCode
      // 404 / 410: the phone unsubscribed or the app was removed — forget it.
      if (code === 404 || code === 410 || (s.fail_count ?? 0) >= 5) gone.push(s.id)
      else await db.from('push_subscriptions').update({ fail_count: (s.fail_count ?? 0) + 1 }).eq('id', s.id)
    }
  }
  if (gone.length) await db.from('push_subscriptions').delete().in('id', gone)
  await db.from('push_messages').update({ sent_at: new Date().toISOString(), sent_count: sent, failed_count: failed }).eq('id', id)
  return { sent, failed, removed: gone.length }
}

async function refreshRabbits() {
  const started = new Date().toISOString()
  try {
    const rabbits = await fetchRescueGroupsRabbits()
    // Nothing listed at all is far more likely a RescueGroups hiccup than every
    // rabbit adopted overnight — leave everything as it is.
    if (rabbits.length === 0) throw new Error('RescueGroups listed no rabbits — nothing changed')
    const { data, error } = await db.rpc('sync_rescuegroups_rabbits', { p_rows: rabbits })
    if (error) throw new Error(error.message)
    await db.from('job_runs').insert({ job: 'rabbits', started_at: started, ok: true, detail: data })
    return data
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await db.from('job_runs').insert({ job: 'rabbits', started_at: started, ok: false, detail: { error: message } })
    throw e
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  let body: { action?: string; id?: string } = {}
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad body' }, 400)
  }
  try {
    let cfg = await config()
    if (req.headers.get('x-ohrr-secret') !== cfg.trigger_secret) return json({ error: 'not allowed' }, 401)
    cfg = await ensureKeys(cfg)
    if (body.action === 'init') return json({ ok: true, public_key: cfg.public_key })
    if (body.action === 'push' && body.id) return json(await sendPush(body.id, cfg))
    if (body.action === 'rabbits') return json(await refreshRabbits())
    return json({ error: 'unknown action' }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})

// ---------------------------------------------------------------
// RescueGroups (the same as rescuegroups.ts in the code repository)
// ---------------------------------------------------------------
// OHRR's adoptable rabbits, read from its public RescueGroups.org listing
// (organisation 6091 — the listing ohiohouserabbitrescue.org/adopt/adoptable-bunnies/
// shows, which also feeds Petfinder and Adopt-a-Pet). The same rules as
// scripts/rescuegroups-rabbits.py, which loaded the first rabbits by hand;
// this runs every morning inside Supabase (the ohrr-jobs function). No imports,
// so it runs the same in Deno and in Node (scripts/rescuegroups-check.ts).

const BASE = 'https://toolkit.rescuegroups.org/iframe/fb/v1.0/'
const ORG = '6091'
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; OHRR app; +https://ohrr-app.pages.dev)' }

// RescueGroups' catch-all breed — it means "not given", so it isn't shown.
const NO_BREED = new Set(['bunny rabbit', 'rabbit'])
// OHRR's own closing line on every listing; the app has its own Apply button.
const BOILERPLATE = /^If you have read our Adoption Policy/i

interface RgRabbit {
  source_id: string
  name: string
  status: 'Available' | 'Pending' | 'Adopted'
  sex: string | null
  age: string | null
  breed: string | null
  size: string | null
  house_trained: boolean
  bonded: boolean
  description: string | null
  tags: string[]
  photos: string[]
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…' }
function unescape(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

function text(fragment: string): string {
  let t = fragment.replace(/<br\s*\/?>/gi, '\n')
  t = t.replace(/<\/p>\s*/gi, '\n\n')
  t = t.replace(/<[^>]+>/g, '')
  t = unescape(t).replace(/ /g, ' ')
  t = t.replace(/[ \t]+/g, ' ')
  t = t.replace(/\n\s*\n\s*(\n\s*)+/g, '\n\n')
  return t.trim()
}

async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: UA })
  if (!res.ok) throw new Error(`RescueGroups answered ${res.status}`)
  return await res.text()
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function listingIds(): Promise<string[]> {
  const ids: string[] = []
  for (let page = 1; page <= 20; page++) {
    const s = await get(`${BASE}?breed=&age=&sex=&page=${page}&ids=${ORG}&species=`)
    const found = [...s.matchAll(/pet\?animalID=(\d+)&/g)].map((m) => m[1])
    const fresh = [...new Set(found)].filter((i) => !ids.includes(i))
    if (fresh.length === 0) break
    ids.push(...fresh)
    await sleep(400)
  }
  return ids
}

interface Raw {
  id: string
  name: string
  breed: string | null
  sex: string | null
  age: string | null
  status: string
  size: string | null
  house_trained: boolean
  special_needs: boolean
  photos: string[]
  description: string
}

async function rabbit(aid: string): Promise<Raw> {
  const s = await get(`${BASE}pet?animalID=${aid}&ids=${ORG}&species=&breed=&age=&sex=&page=1&url=http://www.ohiohouserabbitrescue.org/`)
  const span = (i: string) => {
    const m = s.match(new RegExp(`id="${i}">([\\s\\S]*?)</span>`))
    return m ? text(m[1]).replace(/^[:\s]+|[:\s]+$/g, '') : ''
  }
  const info: Record<string, string> = {}
  for (const m of s.matchAll(/<td class="petInfoTitle">([\s\S]*?)<\/td><td class="petInfoValue">([\s\S]*?)<\/td>/g)) {
    info[text(m[1]).replace(/:+$/, '')] = text(m[2])
  }
  const extraBlock = s.match(/<strong>Additional Info:<\/strong>([\s\S]*?)<\/div>/)
  const extra = extraBlock ? [...extraBlock[1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => text(m[1])) : []
  let photos = [...new Set([...s.matchAll(/href="(https:\/\/cdn\.rescuegroups\.org\/[^"]+\.(?:jpe?g|png|gif))"/gi)].map((m) => m[1]))]
  if (photos.length === 0) {
    photos = [...new Set([...s.matchAll(/src="(https:\/\/cdn\.rescuegroups\.org\/[^"]+\.(?:jpe?g|png|gif))"/gi)].map((m) => m[1]))]
  }
  const d = s.match(/<div class="rgDescription">([\s\S]*?)<\/div><\/div>/)
  const paras = (d ? text(d[1]).split('\n\n') : []).filter((p) => p && !BOILERPLATE.test(p))
  const breed = span('rgPetDetailsBreed')
  const nameMatch = s.match(/<div class="pageCenterTitle"[^>]*>([\s\S]*?)<\/div>/)
  if (!nameMatch) throw new Error(`No name on RescueGroups listing ${aid}`)
  return {
    id: aid,
    name: text(nameMatch[1]),
    breed: NO_BREED.has(breed.toLowerCase()) ? null : breed || null,
    sex: span('rgPetDetailsSex') || null,
    age: span('rgPetDetailsAge') || null,
    status: info['Status'] ?? '',
    size: info['Size'] || null,
    house_trained: extra.includes('House trained'),
    special_needs: extra.includes('Has Special Needs'),
    photos,
    description: paras.join('\n\n'),
  }
}

function statusOf(s: string): RgRabbit['status'] {
  const l = s.toLowerCase()
  if (l.includes('pending')) return 'Pending'
  if (l.includes('adopted')) return 'Adopted'
  return 'Available'
}

/** Every rabbit OHRR lists on RescueGroups today, in listing order. */
async function fetchRescueGroupsRabbits(): Promise<RgRabbit[]> {
  const raws: Raw[] = []
  for (const id of await listingIds()) {
    raws.push(await rabbit(id))
    await sleep(300)
  }
  return raws.map((r) => {
    // Bonded pairs are two listings sharing one write-up that says so.
    const mates = /bonded|adopted together/i.test(r.description)
      ? raws.filter((o) => o !== r && o.description === r.description).map((o) => o.name)
      : []
    return {
      source_id: `rescuegroups:${r.id}`,
      name: r.name,
      status: statusOf(r.status),
      sex: r.sex,
      age: r.age,
      breed: r.breed,
      size: r.size,
      house_trained: r.house_trained,
      bonded: mates.length > 0,
      description: r.description || null,
      tags: [...(r.special_needs ? ['Special needs'] : []), ...mates.map((m) => `Adopted together with ${m}`)],
      photos: r.photos,
    }
  })
}
