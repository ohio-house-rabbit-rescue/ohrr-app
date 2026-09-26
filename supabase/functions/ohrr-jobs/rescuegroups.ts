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

export interface RgRabbit {
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
export async function fetchRescueGroupsRabbits(): Promise<RgRabbit[]> {
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
