import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import type { Database } from './database.types'
import type { IconName } from '../components/icons'
import { seedCareArticles, type SeedArticle } from '../data/careArticles'

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

// Split text into plain runs and tappable URLs / emails, so links inside a
// staff-written body (or a seeded article) work without any markup.
export type TextRun = { type: 'text'; text: string } | { type: 'link'; href: string; text: string }

const LINK_RE = /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"’”)]|[\w.+-]+@[\w-]+\.[\w.-]+\w)/g

export function linkify(text: string): TextRun[] {
  const runs: TextRun[] = []
  let last = 0
  for (const m of text.matchAll(LINK_RE)) {
    const idx = m.index ?? 0
    if (idx > last) runs.push({ type: 'text', text: text.slice(last, idx) })
    const raw = m[0]
    const isEmail = !raw.startsWith('http')
    runs.push({
      type: 'link',
      href: isEmail ? `mailto:${raw}` : raw,
      text: isEmail ? raw : raw.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    })
    last = idx + raw.length
  }
  if (last < text.length) runs.push({ type: 'text', text: text.slice(last) })
  return runs
}

// The bundled articles as importable rows (the staff editor's one-click
// "Import the built-in guides", and the app's fallback when the table is empty).
export type StarterArticle = Omit<SeedArticle, 'source'>

export function starterArticles(): StarterArticle[] {
  return seedCareArticles.map(({ source: _source, ...a }) => a)
}

// The seed shaped like DB rows so Learn/LearnTopic render one shape either way.
export function fallbackArticles(): CareArticle[] {
  const now = '1970-01-01T00:00:00.000Z'
  return seedCareArticles.map((a) => ({
    id: a.slug,
    org_id: '',
    slug: a.slug,
    title: a.title,
    icon: a.icon,
    summary: a.summary,
    body: a.body,
    tip: a.tip,
    sort_order: a.sort_order,
    is_published: true,
    created_by: null,
    created_at: now,
    updated_at: now,
  }))
}

export function articleSource(slug: string): string | undefined {
  return seedCareArticles.find((a) => a.slug === slug)?.source
}

// Public hook: live PUBLISHED care articles, ordered. null while loading, [] when
// none/absent — so callers fall back to the bundled seed.
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
      .then(({ data, error }) => {
        if (active) setItems(error ? [] : (data ?? []))
      })
    return () => {
      active = false
    }
  }, [])

  return items
}
