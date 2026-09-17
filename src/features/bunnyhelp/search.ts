// Client-side search over Bunny Help topics — free, no server.
//
// The corpus is tiny (a few dozen topics, ~15 aliases each), so precision
// matters more than recall: a false "Bleeding" or "Not eating" result is an
// emergency card in someone's face. Matching therefore works on WORDS at word
// boundaries (exact, prefix-stem for ≥4 chars, one-edit typo for ≥5 chars) and
// on whole alias phrases; a topic needs at least half the meaningful words to
// count. fuse.js adds whole-phrase fuzziness but only near-exact hits count.
// Results rank emergency → vet-today → watch → tip, then by match quality.
import Fuse from 'fuse.js'
import { URGENCY_RANK, type CareTopic } from './types.ts'

export interface TopicIndex {
  fuse: Fuse<CareTopic>
  topics: CareTopic[]
}

export function buildIndex(topics: CareTopic[]): TopicIndex {
  return {
    topics,
    fuse: new Fuse(topics, {
      keys: [
        { name: 'title', weight: 3 },
        { name: 'aliases', weight: 2 },
        { name: 'summary', weight: 1 },
      ],
      threshold: 0.38,
      ignoreLocation: true,
      minMatchCharLength: 2,
      includeScore: true,
    }),
  }
}

/* --------------------------------------------------------- query cleanup */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Normalise what people actually type: "My bunny is not eating!!" → "not eating",
 * and with a name, "Clover keeps hiding" → "hiding".
 */
export function cleanQuery(raw: string, bunnyName?: string): string {
  let q = raw.trim()
  const name = bunnyName?.trim()
  if (name) q = q.replace(new RegExp(`^${escapeRegExp(name)}\\s+`, 'i'), '')
  return q
    .replace(/^(my\s+)?(bunny|rabbit|bun)\s+/i, '')
    .replace(/^(is|has|keeps|won'?t|wont|isn'?t|is not|has been|seems|looks)\s+/i, '')
    .replace(/[!?.]+$/g, '')
    .trim()
}

// Words that appear in almost every query and would make any topic "match".
const STOPWORDS = new Set([
  'not', 'the', 'and', 'with', 'her', 'his', 'our', 'its', 'has', 'had', 'was', 'are', 'for', 'but',
  'too', 'very', 'much', 'lot', 'lots', 'keeps', 'keep', 'been', 'being', 'all', 'any', 'some',
  'this', 'that', 'then', 'than', 'from', 'into', 'onto', 'out', 'off', 'over', 'under', 'just',
  'only', 'also', 'still', 'again', 'more', 'most', 'less', 'like', 'when', 'what', 'why', 'how',
  'who', 'bunny', 'bunnies', 'rabbit', 'rabbits', 'bun', 'buns', 'she', 'him', 'they', 'them',
  'their', 'does', 'doesnt', 'dont', 'isnt', 'wont', 'cant', 'have', 'always', 'never', 'today',
  'yesterday', 'week', 'days', 'day', 'now', 'suddenly', 'started', 'seems', 'looks', 'long',
  'time', 'lately', 'really', 'bit', 'little', 'getting', 'about', 'around', 'since', 'after',
  'before', 'while', 'every', 'each', 'one', 'two', 'few', 'can', 'could', 'should', 'would',
])

function normalize(s: string): string {
  return s.toLowerCase().replace(/[’']/g, '')
}

function words(s: string): string[] {
  return normalize(s).split(/[^a-z0-9]+/).filter(Boolean)
}

function meaningfulTokens(q: string): string[] {
  return words(q).filter((t) => t.length >= 3 && !STOPWORDS.has(t))
}

/* ------------------------------------------------------ word matching */

/** Damerau-Levenshtein distance ≤ 1 (one substitution, insertion, deletion or swap). */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true
  const la = a.length
  const lb = b.length
  if (Math.abs(la - lb) > 1) return false
  let i = 0
  while (i < la && i < lb && a[i] === b[i]) i++
  if (la === lb) {
    // substitution or adjacent swap
    if (a.slice(i + 1) === b.slice(i + 1)) return true
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2)
  }
  // insertion / deletion
  return la > lb ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i)
}

function tokenMatchesWord(tok: string, word: string): boolean {
  if (word === tok) return true
  if (tok.length >= 4 && word.length >= 4 && (word.startsWith(tok) || tok.startsWith(word))) return true
  // one-edit typos ("diarhea", "lethargik") — but never across the first letter,
  // or "eating" would match "dating"
  if (tok.length >= 5 && word.length >= 5 && tok[0] === word[0]) return withinOneEdit(tok, word)
  return false
}

interface TopicWords {
  title: string[]
  all: string[]
  /** normalised title + aliases, for whole-phrase matching */
  phrases: string[]
}

const cache = new WeakMap<CareTopic, TopicWords>()
function topicWords(t: CareTopic): TopicWords {
  let w = cache.get(t)
  if (!w) {
    const title = [...new Set(words(t.title))]
    const all = [...new Set([...title, ...t.aliases.flatMap(words), ...words(t.summary)])]
    const phrases = [t.title, ...t.aliases].map((p) => words(p).join(' ')).filter((p) => p.length >= 4)
    w = { title, all, phrases }
    cache.set(t, w)
  }
  return w
}

/** Does `phrase` occur in `text` (or vice versa) at word boundaries? */
function phraseMatch(text: string, phrase: string): boolean {
  const [long, short] = text.length >= phrase.length ? [text, phrase] : [phrase, text]
  if (short.length < 4) return false
  return new RegExp(`(^|\\s)${escapeRegExp(short)}(\\s|$)`).test(long)
}

/* ----------------------------------------------------------- search */

export function searchTopics(index: TopicIndex, raw: string, limit = 6, bunnyName?: string): CareTopic[] {
  const q = cleanQuery(raw, bunnyName)
  if (q.length < 2) return []
  const qNorm = words(q).join(' ')
  const toks = meaningfulTokens(q)
  const best = new Map<string, { item: CareTopic; score: number }>()
  const put = (item: CareTopic, score: number) => {
    const prev = best.get(item.id)
    if (!prev || score < prev.score) best.set(item.id, { item, score })
  }

  // 1) Word / phrase matching — the precise signal.
  for (const item of index.topics) {
    const w = topicWords(item)
    if (w.phrases.some((p) => phraseMatch(qNorm, p))) {
      put(item, words(item.title).join(' ') === qNorm ? 0 : 0.01)
      continue
    }
    if (toks.length === 0) continue
    let matched = 0
    let inTitle = 0
    for (const tok of toks) {
      if (w.title.some((word) => tokenMatchesWord(tok, word))) {
        matched += 1
        inTitle += 1
      } else if (w.all.some((word) => tokenMatchesWord(tok, word))) {
        matched += 1
      }
    }
    const coverage = matched / toks.length
    if (coverage >= 0.5) put(item, 0.02 + (1 - coverage) * 0.5 - inTitle * 0.005)
  }

  // 2) Whole-phrase fuzzy match (fuse.js) — only near-exact hits count, so
  //    "sneezing" can never surface "Bleeding".
  for (const h of index.fuse.search(q, { limit: limit * 2 })) {
    if ((h.score ?? 1) <= 0.15) put(h.item, 0.3 + (h.score ?? 0))
  }

  return [...best.values()]
    .sort((a, b) => {
      const ua = URGENCY_RANK[a.item.urgency]
      const ub = URGENCY_RANK[b.item.urgency]
      if (ua !== ub) return ua - ub
      if (a.score !== b.score) return a.score - b.score
      return a.item.sort_order - b.item.sort_order
    })
    .slice(0, limit)
    .map((h) => h.item)
}

export function hasEmergency(topics: CareTopic[]): boolean {
  return topics.some((t) => t.urgency === 'emergency')
}
