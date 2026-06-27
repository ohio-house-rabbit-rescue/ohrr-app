import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import type { Database } from './database.types'
import type { IconName } from '../components/icons'
import { careTopics, type CareTopic } from '../data/care'

export type CareArticle = Database['public']['Tables']['care_articles']['Row']

// Icons offered in the staff editor (a friendly subset of the app's icon set).
export const CARE_ICONS: IconName[] = [
  'book',
  'home',
  'info',
  'sparkles',
  'users',
  'heart',
  'mappin',
  'apple',
]

export function asIconName(s: string | null | undefined): IconName {
  return (CARE_ICONS as string[]).includes(s ?? '') ? (s as IconName) : 'book'
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'article'
  )
}

// ----- light markdown for article bodies -----
// blank-line-separated blocks; `## ` heading lines; `- ` bullet lines.

export type ArticleBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }

export function parseArticleBody(body: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = []
  for (const raw of body.split(/\n\s*\n/)) {
    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length === 0) continue
    if (lines.every((l) => l.startsWith('- '))) {
      blocks.push({ type: 'list', items: lines.map((l) => l.slice(2).trim()) })
    } else if (lines[0].startsWith('## ')) {
      blocks.push({ type: 'heading', text: lines[0].slice(3).trim() })
      const rest = lines.slice(1)
      if (rest.length) blocks.push({ type: 'paragraph', text: rest.join(' ') })
    } else {
      blocks.push({ type: 'paragraph', text: lines.join(' ') })
    }
  }
  return blocks
}

// Convert a built-in CareTopic's rich sections into the editable markdown body,
// used by the staff editor's one-click "import the built-in guides".
export function careTopicToBody(topic: CareTopic): string {
  return topic.sections
    .map((s) => {
      const parts: string[] = []
      if (s.heading) parts.push(`## ${s.heading}`)
      if (s.body) parts.push(s.body)
      if (s.list) parts.push(s.list.map((i) => `- ${i}`).join('\n'))
      return parts.join('\n\n')
    })
    .join('\n\n')
}

export interface StarterArticle {
  slug: string
  title: string
  icon: string
  summary: string
  body: string
  tip: string | null
  sort_order: number
}

// The built-in guides as importable rows (faithful conversion; cta/link are
// dropped — they can be re-added inline as text if wanted).
export function starterArticles(): StarterArticle[] {
  return careTopics.map((t, i) => ({
    slug: t.id,
    title: t.title,
    icon: t.icon,
    summary: t.summary,
    body: careTopicToBody(t),
    tip: t.tip ?? null,
    sort_order: i,
  }))
}

// Public hook: live PUBLISHED care articles, ordered. null while loading, [] when
// none/absent — so callers fall back to the built-in careTopics.
export function useCareArticles(): CareArticle[] | null {
  const [items, setItems] = useState<CareArticle[] | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setItems([])
      return
    }
    let active = true
    supabase
      .from('care_articles')
      .select('*')
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (active) setItems(data ?? [])
      })
    return () => {
      active = false
    }
  }, [])

  return items
}
