// Server-side proxy to the Petfinder API.
//
// Why this exists: the Petfinder API uses a client_id + client_secret that must
// NEVER ship to the browser. This function holds them server-side, exchanges
// them for a short-lived token, fetches OHRR's adoptable rabbits, normalizes the
// payload to the shape the app expects, and returns plain JSON the client can
// fetch from `/.netlify/functions/petfinder`.
//
// Set these in Netlify -> Site settings -> Environment variables (server-only,
// do NOT prefix with VITE_, or they'd be bundled into the browser):
//   PETFINDER_CLIENT_ID
//   PETFINDER_CLIENT_SECRET
//   PETFINDER_ORG_ID        (OHRR's Petfinder organization id, e.g. "OH123")
//
// Until those are set the function returns { source: 'unconfigured', rabbits: [] }
// and the app shows its built-in sample rabbits, so nothing breaks before launch.

const TOKEN_URL = 'https://api.petfinder.com/v2/oauth2/token'
const ANIMALS_URL = 'https://api.petfinder.com/v2/animals'

// Reuse the OAuth token across warm invocations instead of minting one per call.
let tokenCache = { token: null, expires: 0 }

async function getToken(clientId, clientSecret) {
  const now = Date.now()
  if (tokenCache.token && now < tokenCache.expires) return tokenCache.token

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  if (!res.ok) throw new Error(`Petfinder token request failed (${res.status})`)
  const data = await res.json()
  // expires_in is seconds; refresh a minute early to be safe.
  tokenCache = { token: data.access_token, expires: now + (data.expires_in - 60) * 1000 }
  return tokenCache.token
}

function decodeEntities(s = '') {
  return s
    .replace(/&#0?39;/g, "'")
    .replace(/&rsquo;|&#8217;/g, '’')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function normalize(a) {
  const photos = (a.photos || [])
    .map((p) => p.large || p.medium || p.full || p.small)
    .filter(Boolean)
  const primary =
    a.primary_photo_cropped?.large || a.primary_photo_cropped?.medium || photos[0] || ''
  const tags = a.tags || []
  return {
    id: String(a.id),
    name: a.name,
    status: a.status,
    sex: a.gender,
    age: a.age,
    breed: a.breeds?.primary || (a.breeds?.mixed ? 'Mixed breed' : ''),
    size: a.size,
    coat: a.coat || '',
    colors: [a.colors?.primary, a.colors?.secondary, a.colors?.tertiary].filter(Boolean),
    spayedNeutered: !!a.attributes?.spayed_neutered,
    houseTrained: !!a.attributes?.house_trained,
    specialNeeds: !!a.attributes?.special_needs,
    description: decodeEntities(a.description || ''),
    tags,
    bonded: tags.some((t) => /bond/i.test(t)),
    photo: primary,
    photos,
    url: a.url,
    publishedAt: a.published_at,
  }
}

export default async (req) => {
  const clientId = process.env.PETFINDER_CLIENT_ID
  const clientSecret = process.env.PETFINDER_CLIENT_SECRET

  let org = process.env.PETFINDER_ORG_ID
  try {
    const override = new URL(req.url).searchParams.get('org')
    if (override) org = override
  } catch {
    /* req.url not parseable — fall back to env */
  }

  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        'Content-Type': 'application/json',
        // Don't let the browser hold a stale copy; cache at Netlify's edge for
        // 10 min and serve-while-revalidating for an hour to spare the API.
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Netlify-CDN-Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
      },
    })

  if (!clientId || !clientSecret || !org) {
    return json({ source: 'unconfigured', rabbits: [] })
  }

  try {
    const token = await getToken(clientId, clientSecret)
    const url = `${ANIMALS_URL}?type=rabbit&status=adoptable&organization=${encodeURIComponent(
      org,
    )}&sort=recent&limit=100`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`Petfinder animals request failed (${res.status})`)
    const data = await res.json()
    const rabbits = (data.animals || []).map(normalize)
    return json({ source: 'petfinder', rabbits, updated: new Date().toISOString() })
  } catch (err) {
    // Never hard-fail the page: report the error and let the client fall back.
    return json({ source: 'error', rabbits: [], error: String(err?.message || err) })
  }
}
