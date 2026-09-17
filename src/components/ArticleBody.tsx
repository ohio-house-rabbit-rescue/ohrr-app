import { Icon } from './icons'
import { parseArticleBody, linkify } from '../lib/careContent'

// Renders a run of text with bare URLs / emails turned into tappable links.
export function RichText({ text }: { text: string }) {
  return (
    <>
      {linkify(text).map((r, i) =>
        r.type === 'link' ? (
          <a
            key={i}
            href={r.href}
            target={r.href.startsWith('mailto:') ? undefined : '_blank'}
            rel="noopener noreferrer"
            className="break-all font-semibold text-brand-blue underline decoration-brand-blue/30 underline-offset-2"
          >
            {r.text}
          </a>
        ) : (
          <span key={i}>{r.text}</span>
        ),
      )}
    </>
  )
}

// Renders a light-markdown body (blank-line paragraphs, `## ` headings,
// `- ` bullets) — the format staff write in and the seed articles use.
export function ArticleBody({ body, compact = false }: { body: string; compact?: boolean }) {
  const blocks = parseArticleBody(body)
  return (
    <div className={compact ? 'space-y-2' : 'space-y-2.5'}>
      {blocks.map((b, i) => {
        if (b.type === 'heading')
          return (
            <h2
              key={i}
              className={`font-display font-extrabold text-ink ${compact ? 'mt-1 text-[15px]' : 'mt-2 text-base'} first:mt-0`}
            >
              {b.text}
            </h2>
          )
        if (b.type === 'list')
          return (
            <ul key={i} className="space-y-2">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2 text-sm leading-relaxed text-slate-700">
                  <Icon name="info" size={15} className="mt-0.5 shrink-0 text-brand-orange" />
                  <span>
                    <RichText text={it} />
                  </span>
                </li>
              ))}
            </ul>
          )
        return (
          <p key={i} className="text-sm leading-relaxed text-slate-700">
            <RichText text={b.text} />
          </p>
        )
      })}
    </div>
  )
}
