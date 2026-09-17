import { Link, useParams } from 'react-router-dom'
import { findWay, type VolunteerWay as Way } from '../data/volunteer'
import { Screen, Card, SectionLabel, Badge, btn } from '../components/ui'
import { Icon } from '../components/icons'
import { RichText } from '../components/ArticleBody'
import { useVolunteerOpportunities, type VolunteerOpp } from '../lib/volunteerOpps'

// Link into the in-app interest form, pre-filled with the role, its stable
// code, and the specific shift the volunteer tapped.
function signupHref(role: string, code: string, item?: string) {
  const params = new URLSearchParams({ role, code })
  if (item) params.set('item', item)
  return `/volunteer/signup?${params.toString()}`
}

// Staff-posted open shifts for this position (the live volunteer_opportunities feed).
function OpenShifts({ opps, way }: { opps: VolunteerOpp[]; way: Way }) {
  return (
    <div className="space-y-3">
      {opps.map((o) => (
        <Card key={o.id}>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-base font-extrabold text-ink">{o.title}</h3>
            {o.spots && <Badge tone="orange">{o.spots}</Badge>}
          </div>
          {o.when_text && (
            <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
              <Icon name="calendar" size={14} className="shrink-0 text-brand-blue" />
              {o.when_text}
            </p>
          )}
          {o.where_text && (
            <p className="mt-0.5 flex items-center gap-2 text-sm text-slate-600">
              <Icon name="mappin" size={14} className="shrink-0 text-brand-blue" />
              {o.where_text}
            </p>
          )}
          {o.detail && (
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
              <RichText text={o.detail} />
            </p>
          )}
          <Link to={signupHref(way.title, way.code, o.title)} className={`${btn.blue} mt-3 w-full`}>
            Sign up <Icon name="chevron" size={16} />
          </Link>
        </Card>
      ))}
    </div>
  )
}

export default function VolunteerWay() {
  const { slug } = useParams()
  const way = findWay(slug)
  const live = useVolunteerOpportunities(slug ?? '')

  if (!way) {
    return (
      <Screen className="space-y-4 text-center">
        <p className="pt-6 text-sm text-slate-600">We couldn’t find that volunteer role.</p>
        <Link to="/volunteer" className={`${btn.blue} mx-auto`}>
          Back to Volunteer
        </Link>
      </Screen>
    )
  }

  // The seeded position row duplicates this page's own content — only show
  // rows staff added beyond it as "open shifts".
  const shifts = (live ?? []).filter((o) => o.title.trim() !== way.title)

  return (
    <Screen className="space-y-6">
      <Link
        to="/volunteer"
        className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
      >
        <Icon name="arrowLeft" size={16} /> Volunteer
      </Link>

      <div>
        <Badge tone="orange">{way.commitment}</Badge>
        <h1 className="mt-2 font-display text-2xl font-black text-ink">{way.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          <RichText text={way.summary} />
        </p>
      </div>

      <section className="space-y-2.5">
        <SectionLabel>Requirements</SectionLabel>
        <Card>
          <ul className="space-y-2.5">
            {way.requirements.map((r, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-700">
                <Icon name="info" size={15} className="mt-0.5 shrink-0 text-brand-orange" />
                <span>
                  <RichText text={r} />
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section className="space-y-2.5">
        <SectionLabel>Location</SectionLabel>
        <Card>
          <p className="flex items-start gap-2 text-sm font-semibold text-ink">
            <Icon name="mappin" size={15} className="mt-0.5 shrink-0 text-brand-blue" />
            {way.location}
          </p>
          {way.locationDetail && (
            <ul className="mt-2.5 space-y-2 border-t border-slate-100 pt-2.5">
              {way.locationDetail.map((d, i) => (
                <li key={i} className="text-sm leading-relaxed text-slate-600">
                  {d}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section className="space-y-2.5">
        <SectionLabel>Sign me up!</SectionLabel>
        <Card className="space-y-3">
          {way.signup.map((s, i) => {
            const external = !s.href.startsWith('mailto:')
            return (
              <div key={s.href}>
                <a
                  href={s.href}
                  target={external ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  className={`${i === 0 ? btn.primary : btn.outline} w-full`}
                >
                  {s.label} <Icon name={external ? 'external' : 'mail'} size={14} />
                </a>
                {s.note && <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{s.note}</p>}
              </div>
            )
          })}
          {way.notes?.map((n, i) => (
            <p key={i} className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
              <RichText text={n} />
            </p>
          ))}
        </Card>
      </section>

      <section className="space-y-2.5">
        <SectionLabel>Open shifts</SectionLabel>
        {shifts.length > 0 ? (
          <OpenShifts opps={shifts} way={way} />
        ) : (
          <Card className="border-slate-200 bg-slate-50/80">
            <p className="text-sm leading-relaxed text-slate-600">
              {live === null
                ? 'Checking for open shifts…'
                : 'Open shifts posted by OHRR staff will appear here. Use the sign-up above to get started.'}
            </p>
          </Card>
        )}
        <Link
          to={signupHref(way.title, way.code)}
          className="inline-flex items-center gap-1 px-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
        >
          Or tell OHRR you’re interested in-app <Icon name="chevron" size={14} />
        </Link>
      </section>
    </Screen>
  )
}
