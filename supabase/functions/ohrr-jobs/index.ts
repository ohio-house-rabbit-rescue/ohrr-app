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
import { fetchRescueGroupsRabbits } from './rescuegroups.ts'

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
