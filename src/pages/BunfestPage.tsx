import { Link, useParams } from 'react-router-dom'
import { bunfestPageById } from '../data/bunfestPages'
import { PageHeader, Screen, Card, Badge, SectionLabel, btn } from '../components/ui'
import { ContactLinks } from '../components/ContactLinks'
import { Icon } from '../components/icons'

export default function BunfestPage() {
  const { id } = useParams()
  const page = bunfestPageById(id)

  if (!page) {
    return (
      <Screen className="space-y-4 text-center">
        <h1 className="pt-6 font-display text-xl font-extrabold text-ink">Page not found</h1>
        <Link to="/bunfest" className={`${btn.blue} mx-auto`}>
          Back to BunFest
        </Link>
      </Screen>
    )
  }

  const p = page

  return (
    <>
      <PageHeader icon={p.icon} title={p.title} subtitle={p.subtitle} />
      <Screen className="space-y-5">
        <Link
          to="/bunfest"
          className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
        >
          <Icon name="arrowLeft" size={16} /> Midwest BunFest
        </Link>

        {(p.sponsor || p.chips) && (
          <div className="flex flex-wrap items-center gap-2">
            {p.sponsor && <Badge tone="orange">{p.sponsor}</Badge>}
            {p.chips?.map((c) => (
              <Badge key={c} tone="blue">
                {c}
              </Badge>
            ))}
          </div>
        )}

        {/* Highlighted rule (e.g. vaccination) */}
        {p.note && (
          <div className="flex gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
            <Icon name="info" size={16} className="mt-0.5 shrink-0" />
            <p>{p.note}</p>
          </div>
        )}

        {/* Sections */}
        <div className="space-y-3">
          {p.sections.map((s, i) => (
            <Card key={i}>
              {s.heading && (
                <h2 className="font-display text-[15px] font-extrabold text-ink">{s.heading}</h2>
              )}
              {s.body && (
                <p className={`text-sm leading-relaxed text-slate-600 ${s.heading ? 'mt-1.5' : ''}`}>
                  {s.body}
                </p>
              )}
              {s.list && (
                <ul className={`space-y-2 ${s.heading ? 'mt-2' : ''}`}>
                  {s.list.map((item, j) => (
                    <li key={j} className="flex gap-2.5 text-sm leading-relaxed text-slate-700">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>

        {/* Email sign-up (e.g. toymaking) */}
        {p.emailSignup && (
          <a href={`mailto:${p.emailSignup}`} className={`${btn.primary} w-full`}>
            <Icon name="mail" size={15} /> Email to sign up
          </a>
        )}

        {/* Contact (e.g. host hotel) */}
        {p.contact && (
          <section className="space-y-2.5">
            <SectionLabel>Contact</SectionLabel>
            <Card>
              <ContactLinks
                address={p.contact.address}
                phone={p.contact.phone}
                url={p.contact.url}
                urlLabel={p.contact.urlLabel}
              />
            </Card>
          </section>
        )}

        {/* Related in-app links */}
        {p.related && p.related.length > 0 && (
          <section className="space-y-2.5">
            <SectionLabel>{p.relatedLabel ?? 'Related'}</SectionLabel>
            <div className="space-y-2">
              {p.related.map((r) => (
                <Link
                  key={r.to}
                  to={r.to}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white p-3 text-sm font-semibold text-ink transition hover:border-slate-300 hover:shadow-sm"
                >
                  {r.label}
                  <Icon name="chevron" size={16} className="shrink-0 text-slate-300" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </Screen>
    </>
  )
}
