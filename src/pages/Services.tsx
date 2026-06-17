import { Link } from 'react-router-dom'
import { bonding, clinicInfo, clinicDays } from '../data/services'
import { PageHeader, Screen, Card, SectionLabel, SampleNote, btn } from '../components/ui'
import { Icon } from '../components/icons'

export default function Services() {
  return (
    <>
      <PageHeader
        icon="calendar"
        title="Bunny Services"
        subtitle="Bonding sessions and mobile vet-clinic days for your rabbit — book a time and bring your bunny in."
      />
      <Screen className="space-y-6">
        {/* Bonding */}
        <section className="space-y-2.5">
          <SectionLabel>Bonding</SectionLabel>
          <Card>
            <h2 className="font-display text-lg font-extrabold text-ink">{bonding.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{bonding.blurb}</p>
            <ol className="mt-3 space-y-2">
              {bonding.steps.map((s, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-slate-700">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-blue-50 text-xs font-bold text-brand-blue">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
            <Link to="/services/signup?type=bonding" className={`${btn.primary} mt-4 w-full`}>
              Request a bonding session
              <Icon name="chevron" size={16} />
            </Link>
          </Card>
        </section>

        {/* Vet clinic */}
        <section className="space-y-2.5">
          <SectionLabel>Mobile Vet Clinic</SectionLabel>
          <p className="px-1 text-sm leading-relaxed text-slate-600">{clinicInfo.blurb}</p>
          <SampleNote>
            These clinic dates are sample data — OHRR’s confirmed dates will appear here.
          </SampleNote>
          <div className="space-y-3">
            {clinicDays.map((d) => (
              <Card key={d.id}>
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-orange-50 leading-none text-brand-orange">
                    <span className="text-[10px] font-bold uppercase">
                      {d.date.split(' ')[0].slice(0, 3)}
                    </span>
                    <span className="font-display text-lg font-black">{d.date.match(/\d+/)?.[0]}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-base font-extrabold text-ink">
                      {d.weekday}, {d.date}
                    </h3>
                    <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
                      <Icon name="mappin" size={14} className="shrink-0 text-slate-400" />
                      {d.location}
                    </p>
                    {d.note && (
                      <p className="mt-0.5 text-xs font-semibold text-brand-orange">{d.note}</p>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">
                  Reserve a time
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {d.slots.map((t) => (
                    <Link
                      key={t}
                      to={`/services/signup?type=clinic&date=${encodeURIComponent(
                        `${d.weekday}, ${d.date}`,
                      )}&time=${encodeURIComponent(t)}`}
                      className="rounded-full border border-brand-blue/30 bg-brand-blue-50 px-3 py-1.5 text-sm font-bold text-brand-blue transition hover:bg-brand-blue hover:text-white"
                    >
                      {t}
                    </Link>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </section>
      </Screen>
    </>
  )
}
