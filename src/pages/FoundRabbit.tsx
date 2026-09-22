import { Link } from 'react-router-dom'
import { PageHeader, Screen, Card, SectionLabel, btn } from '../components/ui'
import { Icon } from '../components/icons'
import {
  foundContacts,
  wildOrDomestic,
  reportDetails,
  catchSteps,
  babiesWarning,
  fieldRescue,
  admissions,
} from '../data/found'
import { ohrr } from '../data/ohrr'

export default function FoundRabbit() {
  return (
    <>
      <PageHeader
        icon="mappin"
        title="Found a rabbit?"
        subtitle="A domestic rabbit outdoors can’t survive on its own. Here’s how to help — and what to do if you need to surrender one."
      />
      <Screen className="space-y-6">
        {/* Fast path: who to contact */}
        <Card className="border-brand-orange/30 bg-brand-orange-50/60">
          <h2 className="font-display text-base font-extrabold text-ink">Report it</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            In Columbus, stray reports go to the CHRS Help Line — they coordinate the Columbus Rabbit
            Field Rescue volunteers. Include:
          </p>
          <ul className="mt-2 space-y-1.5">
            {reportDetails.map((d) => (
              <li key={d} className="flex gap-2 text-sm text-slate-700">
                <Icon name="info" size={15} className="mt-0.5 shrink-0 text-brand-orange" />
                {d}
              </li>
            ))}
          </ul>
          <Link to="/found/report" className={`${btn.primary} mt-3 w-full`}>
            <Icon name="camera" size={17} /> Report it here — with a photo
          </Link>
          <div className="mt-2 flex flex-wrap gap-2">
            <a href={foundContacts.ohrrPhoneHref} className={`${btn.outline} px-4 py-2`}>
              <Icon name="phone" size={15} /> Call OHRR
            </a>
            <a
              href={`mailto:${foundContacts.chrsHelpLine}?subject=Stray%20domestic%20rabbit%20report`}
              className={`${btn.outline} px-4 py-2`}
            >
              <Icon name="mail" size={15} /> CHRS Help Line
            </a>
          </div>
          <p className="mt-2.5 break-all text-xs text-slate-500">
            {foundContacts.chrsHelpLine} · OHRR {foundContacts.ohrrPhone} ·{' '}
            <a href={`mailto:${foundContacts.ohrrEmail}`} className="font-semibold text-brand-blue">
              {foundContacts.ohrrEmail}
            </a>
          </p>
        </Card>

        {/* Domestic or wild */}
        <section className="space-y-2.5">
          <SectionLabel>{wildOrDomestic.heading}</SectionLabel>
          <Card>
            <p className="text-sm leading-relaxed text-slate-700">{wildOrDomestic.text}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {wildOrDomestic.wildNote}{' '}
              <a
                href={wildOrDomestic.wildUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-brand-blue underline decoration-brand-blue/30 underline-offset-2"
              >
                Ohio Wildlife Center
              </a>
            </p>
          </Card>
        </section>

        {/* Catch steps */}
        <section className="space-y-2.5">
          <SectionLabel>Catching a stray</SectionLabel>
          <div className="space-y-3">
            {catchSteps.map((s, i) => (
              <Card key={s.title} className="flex gap-3.5">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-blue text-sm font-black text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-[15px] font-extrabold text-ink">{s.title}</h3>
                  <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{s.text}</p>
                </div>
              </Card>
            ))}
          </div>
          <div className="flex gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
            <Icon name="info" size={16} className="mt-0.5 shrink-0" />
            <p>
              <strong className="font-bold">Babies:</strong> {babiesWarning}
            </p>
          </div>
          <Link
            to="/learn/tips-for-catching-a-stray"
            className="inline-flex items-center gap-1 px-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
          >
            Read OHRR’s full Tips for Catching a Stray <Icon name="chevron" size={14} />
          </Link>
        </section>

        {/* Field rescue */}
        <section className="space-y-2.5">
          <SectionLabel>Columbus field rescue</SectionLabel>
          <Card>
            <p className="text-sm leading-relaxed text-slate-700">{fieldRescue.text}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Want to be one of the rescuers?{' '}
              <Link to="/volunteer/field-rescue" className="font-semibold text-brand-blue">
                Become a Bunny Field Rescuer
              </Link>
              .
            </p>
          </Card>
        </section>

        {/* Need to surrender */}
        <section className="space-y-2.5">
          <SectionLabel>Need to surrender a rabbit?</SectionLabel>
          <Card className="space-y-2.5">
            <p className="text-sm leading-relaxed text-slate-700">{admissions.intro}</p>
            <p className="text-sm leading-relaxed text-slate-700">{admissions.noSpace}</p>
            <p className="text-sm leading-relaxed text-slate-600">{admissions.funding}</p>
            <p className="rounded-xl bg-brand-blue-50 px-3 py-2 text-sm font-semibold text-brand-blue">
              {admissions.contactFirst}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <a href={`mailto:${ohrr.email}?subject=Rabbit%20surrender%20inquiry`} className={`${btn.blue} px-4 py-2`}>
                <Icon name="mail" size={15} /> Email OHRR
              </a>
              <a href={ohrr.phoneHref} className={`${btn.outline} px-4 py-2`}>
                <Icon name="phone" size={15} /> {ohrr.phone}
              </a>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-2.5">
            {admissions.forms.map((f) => (
              <Link
                key={f.url}
                to={f.url}
                className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-blue-50 text-brand-blue">
                  <Icon name="book" size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[15px] font-extrabold text-ink">{f.title}</span>
                  <span className="block text-xs text-slate-500">{f.text}</span>
                </span>
                <Icon name="chevron" size={16} className="shrink-0 text-slate-300" />
              </Link>
            ))}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-1 text-sm font-bold text-brand-blue">
            <a href={admissions.policyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
              Admissions Policy (PDF) <Icon name="external" size={13} />
            </a>
            <a href={admissions.surrenderPolicyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
              Surrender &amp; Relinquishment Policy (PDF) <Icon name="external" size={13} />
            </a>
            <Link to="/surrender" className="inline-flex items-center gap-1">
              How surrender works, step by step <Icon name="chevron" size={13} />
            </Link>
          </div>
        </section>
      </Screen>
    </>
  )
}
