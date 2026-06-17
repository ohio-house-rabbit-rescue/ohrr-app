import { Link, useParams } from 'react-router-dom'
import {
  findWay,
  socialBunnies,
  socialShifts,
  transportRuns,
  outreachEvents,
  fosterInfo,
  type VolunteerWay as Way,
} from '../data/volunteer'
import { Screen, Card, SectionLabel, SampleNote, Badge, btn } from '../components/ui'
import { Icon } from '../components/icons'
import { RabbitPhoto } from '../components/RabbitPhoto'

// Link into the sign-up form, pre-filled with the role, its stable code, and the
// specific thing the volunteer tapped (a shift, a run, an event, or fostering) —
// so the submission OHRR receives says exactly what they signed up for.
function signupHref(role: string, code: string, item?: string) {
  const params = new URLSearchParams({ role, code })
  if (item) params.set('item', item)
  return `/volunteer/signup?${params.toString()}`
}

export default function VolunteerWay() {
  const { slug } = useParams()
  const way = findWay(slug)

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
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{way.blurb}</p>
      </div>

      {slug === 'socialization' && <Socialization way={way} />}
      {slug === 'vet-transport' && <VetTransport way={way} />}
      {slug === 'events' && <Events way={way} />}
      {slug === 'foster' && <Foster way={way} />}
    </Screen>
  )
}

function Socialization({ way }: { way: Way }) {
  return (
    <>
      <section className="space-y-2.5">
        <SectionLabel>Bunnies who’d love a visit</SectionLabel>
        <SampleNote>These bunnies are sample profiles to show how socialization works.</SampleNote>
        <div className="space-y-3">
          {socialBunnies.map((b) => (
            <Card key={b.name} className="flex gap-4">
              <span className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                <RabbitPhoto name={b.name} photo={b.photo} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-[15px] font-extrabold text-ink">{b.name}</h3>
                  <Badge tone="blue">{b.trait}</Badge>
                </div>
                <p className="text-xs font-semibold text-slate-400">{b.age}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{b.note}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-2.5">
        <SectionLabel>Open socialization shifts</SectionLabel>
        <div className="space-y-2.5">
          {socialShifts.map((s) => (
            <Card key={s.id} className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-blue-50 leading-none text-brand-blue">
                <span className="text-[10px] font-bold uppercase">{s.day.slice(0, 3)}</span>
                <span className="font-display text-lg font-black">{s.date.match(/\d+/)?.[0]}</span>
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-sm font-extrabold text-ink">
                  {s.day}, {s.date}
                </h3>
                <p className="text-sm text-slate-500">{s.time}</p>
                <p className="text-xs font-semibold text-brand-orange">
                  {s.spots} {s.spots === 1 ? 'spot' : 'spots'} left
                </p>
              </div>
              <Link
                to={signupHref(way.title, way.code, `${s.day}, ${s.date} · ${s.time}`)}
                className="rounded-full bg-brand-blue px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-blue-dark"
              >
                Sign up
              </Link>
            </Card>
          ))}
        </div>
      </section>
    </>
  )
}

function VetTransport({ way }: { way: Way }) {
  return (
    <section className="space-y-2.5">
      <SectionLabel>Upcoming transport runs</SectionLabel>
      <SampleNote>These runs are sample data to show how claiming a ride works.</SampleNote>
      <div className="space-y-3">
        {transportRuns.map((r) => (
          <Card key={r.id}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-base font-extrabold text-ink">{r.date}</h3>
              <Badge tone="slate">{r.window}</Badge>
            </div>
            <div className="mt-2 space-y-1.5 text-sm text-slate-600">
              <p className="flex items-center gap-2">
                <Icon name="mappin" size={14} className="shrink-0 text-brand-blue" />
                <span>
                  <span className="font-semibold text-ink">{r.from}</span> → {r.to}
                </span>
              </p>
              <p className="flex items-center gap-2">
                <Icon name="heart" size={14} className="shrink-0 text-brand-orange" />
                {r.bunny}
              </p>
            </div>
            {r.note && <p className="mt-1 text-xs italic text-slate-400">{r.note}</p>}
            <Link
              to={signupHref(way.title, way.code, `${r.date} · ${r.from} → ${r.to}`)}
              className={`${btn.blue} mt-3 w-full`}
            >
              Claim this run
              <Icon name="chevron" size={16} />
            </Link>
          </Card>
        ))}
      </div>
    </section>
  )
}

function Events({ way }: { way: Way }) {
  return (
    <section className="space-y-2.5">
      <SectionLabel>Events needing hands</SectionLabel>
      <SampleNote>These events are sample data — OHRR’s real calendar will appear here.</SampleNote>
      <div className="space-y-3">
        {outreachEvents.map((e) => (
          <Card key={e.id}>
            <h3 className="font-display text-base font-extrabold text-ink">{e.name}</h3>
            <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
              <Icon name="calendar" size={14} className="shrink-0 text-brand-blue" />
              {e.date}
            </p>
            <p className="mt-0.5 flex items-center gap-2 text-sm text-slate-600">
              <Icon name="mappin" size={14} className="shrink-0 text-brand-blue" />
              {e.location}
            </p>
            <p className="mt-2 text-xs font-bold uppercase tracking-wide text-brand-orange">
              {e.need}
            </p>
            <Link
              to={signupHref(way.title, way.code, `${e.name} · ${e.date}`)}
              className={`${btn.blue} mt-3 w-full`}
            >
              Sign up to help
              <Icon name="chevron" size={16} />
            </Link>
          </Card>
        ))}
      </div>
    </section>
  )
}

function Foster({ way }: { way: Way }) {
  return (
    <section className="space-y-2.5">
      <SectionLabel>How fostering works</SectionLabel>
      <Card>
        <ol className="space-y-2.5">
          {fosterInfo.steps.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-slate-700">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-blue-50 text-xs font-bold text-brand-blue">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
        <p className="mt-3 rounded-xl bg-brand-orange-50 px-3 py-2 text-xs leading-relaxed text-brand-orange">
          {fosterInfo.note}
        </p>
        <Link to={signupHref(way.title, way.code)} className={`${btn.primary} mt-4 w-full`}>
          I’m interested in fostering
          <Icon name="chevron" size={16} />
        </Link>
      </Card>
    </section>
  )
}
