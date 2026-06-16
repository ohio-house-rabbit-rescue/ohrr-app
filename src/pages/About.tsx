import { ohrr } from '../data/ohrr'
import { PageHeader, Screen, Card, btn } from '../components/ui'
import { Icon } from '../components/icons'

export default function About() {
  return (
    <>
      <PageHeader
        icon="info"
        title="About OHRR"
        subtitle="Ohio’s first rescue and adoption center just for rabbits."
      />
      <Screen className="space-y-4">
        <div className="flex justify-center pb-1 pt-2">
          <img src="/ohrr-logo.jpg" alt="Ohio House Rabbit Rescue" className="w-60 max-w-full" />
        </div>
        <Card>
          <h3 className="font-display text-base font-extrabold text-ink">Our mission</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Ohio House Rabbit Rescue operates an adoption center for rescued rabbits, runs a
            robust adoption program, and educates the public on caring for rabbits as indoor
            companions.
          </p>
        </Card>

        <Card>
          <h3 className="font-display text-base font-extrabold text-ink">Our story</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Founded in {ohrr.founded}, OHRR opened Ohio’s first rescue-and-adoption center
            exclusively for domestic rabbits in 2013 — answering the hundreds of rabbits
            surrendered in Central Ohio each year. Today the goal is 125+ adoptions a year.
          </p>
        </Card>

        <Card>
          <h3 className="font-display text-base font-extrabold text-ink">Visit & contact</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Icon name="mappin" size={15} className="shrink-0 text-brand-blue" />
              <span className="text-slate-600">{ohrr.address}</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="phone" size={15} className="shrink-0 text-brand-blue" />
              <a href={ohrr.phoneHref} className="font-semibold text-brand-blue">
                {ohrr.phone}
              </a>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="clock" size={15} className="shrink-0 text-brand-blue" />
              <span className="text-slate-600">{ohrr.hours}</span>
            </div>
          </dl>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <a href={ohrr.links.contact} target="_blank" rel="noopener noreferrer" className={btn.blue}>
            Contact us
          </a>
          <a
            href={ohrr.links.admissions}
            target="_blank"
            rel="noopener noreferrer"
            className={`${btn.white} border border-slate-200`}
          >
            Surrender a rabbit
          </a>
        </div>

        <p className="px-1 text-center text-xs text-slate-400">
          501(c)(3) nonprofit · EIN {ohrr.ein} · est. {ohrr.founded}
        </p>
      </Screen>
    </>
  )
}
