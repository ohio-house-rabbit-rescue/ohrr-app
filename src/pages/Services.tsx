import { Link } from 'react-router-dom'
import { bonding, clinicInfo } from '../data/services'
import { PageHeader, Screen, Card, SectionLabel, btn } from '../components/ui'
import MyBookingsCard from '../features/bookings/MyBookingsCard'
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
        <MyBookingsCard />

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
            <Link to="/book/bonding-session" className={`${btn.primary} mt-4 w-full`}>
              Request a bonding session
              <Icon name="chevron" size={16} />
            </Link>
          </Card>
        </section>

        {/* Vet clinic — dates and times come from Staff → Bookings */}
        <section className="space-y-2.5">
          <SectionLabel>Mobile Vet Clinic</SectionLabel>
          <Card>
            <h2 className="font-display text-lg font-extrabold text-ink">{clinicInfo.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{clinicInfo.blurb}</p>
            <Link to="/book/vet-clinic" className={`${btn.blue} mt-4 w-full`}>
              See clinic times
              <Icon name="chevron" size={16} />
            </Link>
          </Card>
        </section>
      </Screen>
    </>
  )
}
