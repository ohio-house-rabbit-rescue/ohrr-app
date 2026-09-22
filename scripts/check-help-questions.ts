// Quick check that question-shaped queries land on the right Bunny Help topic.
//   npx tsx scripts/check-help-questions.ts
import { buildIndex, cleanQuery, searchTopics } from '../src/features/bunnyhelp/search'
import { SEED_TOPICS } from '../src/features/bunnyhelp/seedTopics'
import type { CareTopic } from '../src/features/bunnyhelp/types'

const topics: CareTopic[] = SEED_TOPICS.map((s, i) => ({
  id: String(i),
  slug: s.slug,
  title: s.title,
  aliases: [...s.aliases],
  category: s.category,
  urgency: s.urgency,
  summary: s.summary,
  what_to_do: s.what_to_do,
  article_slug: s.article_slug,
  show_vets: s.show_vets,
  hopshop_note: s.hopshop_note,
  reviewed_by: null,
  reviewed_at: null,
  is_published: true,
  sort_order: i,
}))
const index = buildIndex(topics)

const cases: [string, string][] = [
  ['Did my bunny stop eating?', 'not-eating'],
  ['Is my bunny eating?', 'not-eating'],
  ['Why is my bunny hiding?', 'lethargic'],
  ['Does my bunny have diarrhea?', 'soft-stools'],
  ['Is my bunny’s poop normal?', 'soft-stools'],
  ['Why is my bunny digging the carpet?', 'digging-chewing'],
  ['What can my bunny eat?', 'greens-fruit'],
  ['Why is my bunny peeing outside the box?', 'litter-box-stopped'],
  ['My bunny is not eating', 'not-eating'],
  ['Clover keeps hiding', 'lethargic'],
]

let failed = 0
for (const [q, want] of cases) {
  const cleaned = cleanQuery(q, 'Clover')
  const got = searchTopics(index, q, 3, 'Clover').map((t) => t.slug)
  const ok = got[0] === want || got.includes(want)
  if (!ok) failed++
  console.log(`${ok ? 'ok ' : 'MISS'} "${q}" → "${cleaned}" → ${got.join(', ') || '(none)'}`)
}
if (failed) {
  console.log(`${failed} miss(es)`)
  process.exit(1)
}
