// Shared bits for the Bunny Help screens: urgency chips, the light-markdown
// renderer for `what_to_do`, and the closing disclaimer.
import { MbIcon } from '../mybunny/icons'
import { CATEGORY_LABEL, DISCLAIMER, URGENCY_LABEL, type CareTopic, type TopicUrgency } from './types'

const urgencyTone: Record<TopicUrgency, string> = {
  emergency: 'bg-red-600 text-white',
  'vet-today': 'bg-red-50 text-red-700 ring-1 ring-red-200',
  watch: 'bg-brand-orange-50 text-brand-orange ring-1 ring-brand-orange/30',
  tip: 'bg-brand-blue-50 text-brand-blue',
}

export function UrgencyChip({ urgency, size = 'sm' }: { urgency: TopicUrgency; size?: 'sm' | 'md' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full font-bold ${urgencyTone[urgency]} ${
        size === 'md' ? 'px-3 py-1 text-xs' : 'px-2.5 py-0.5 text-[11px]'
      }`}
    >
      {urgency === 'emergency' && <MbIcon name="alert" size={size === 'md' ? 13 : 11} />}
      {URGENCY_LABEL[urgency]}
    </span>
  )
}

export function CategoryChip({ category }: { category: CareTopic['category'] }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
      {CATEGORY_LABEL[category]}
    </span>
  )
}

/* ---- light markdown (same dialect as the Learn articles) ---- */

export type Block =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }

export function parseBlocks(body: string): Block[] {
  const blocks: Block[] = []
  for (const raw of body.split(/\n\s*\n/)) {
    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length === 0) continue
    // a heading may be followed directly by bullets or a paragraph in the same chunk
    let rest = lines
    if (rest[0].startsWith('## ')) {
      blocks.push({ type: 'heading', text: rest[0].slice(3).trim() })
      rest = rest.slice(1)
      if (rest.length === 0) continue
    }
    if (rest.every((l) => l.startsWith('- '))) {
      blocks.push({ type: 'list', items: rest.map((l) => l.slice(2).trim()) })
    } else {
      // mixed: paragraph lines first, then any trailing bullets
      const firstBullet = rest.findIndex((l) => l.startsWith('- '))
      const para = firstBullet === -1 ? rest : rest.slice(0, firstBullet)
      if (para.length) blocks.push({ type: 'paragraph', text: para.join(' ') })
      if (firstBullet !== -1) {
        blocks.push({ type: 'list', items: rest.slice(firstBullet).map((l) => l.replace(/^- /, '').trim()) })
      }
    }
  }
  return blocks
}

export function WhatToDo({ body }: { body: string }) {
  const blocks = parseBlocks(body)
  if (blocks.length === 0) return null
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => {
        if (b.type === 'heading') {
          return (
            <h3 key={i} className="pt-1 font-display text-sm font-extrabold uppercase tracking-wide text-slate-400">
              {b.text}
            </h3>
          )
        }
        if (b.type === 'list') {
          return (
            <ul key={i} className="space-y-1.5">
              {b.items.map((item, j) => (
                <li key={j} className="flex items-start gap-2 text-sm leading-relaxed text-slate-700">
                  <span aria-hidden className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-orange" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )
        }
        return (
          <p key={i} className="text-sm leading-relaxed text-slate-700">
            {b.text}
          </p>
        )
      })}
    </div>
  )
}

export function Disclaimer({ className = '' }: { className?: string }) {
  return <p className={`text-xs leading-relaxed text-slate-500 ${className}`}>{DISCLAIMER}</p>
}

/** Shown on health topics until staff record who reviewed them. */
export function NotReviewedLine({ topic }: { topic: CareTopic }) {
  if (topic.category !== 'health') return null
  if (topic.reviewed_by) {
    return (
      <p className="text-xs text-slate-400">
        Reviewed by {topic.reviewed_by}
        {topic.reviewed_at ? ` · ${topic.reviewed_at}` : ''}
      </p>
    )
  }
  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
      <MbIcon name="alert" size={13} className="shrink-0" /> Not yet vet-reviewed
    </p>
  )
}
