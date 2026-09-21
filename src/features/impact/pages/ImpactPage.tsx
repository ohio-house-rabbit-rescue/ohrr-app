// /impact — what OHRR did this year, in numbers donors and sponsors can
// repeat. Reads published rows only; shows nothing until staff publish one.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Screen, Card, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner } from '../../../components/staffui'
import { ohrr } from '../../../data/ohrr'
import { IMPACT_FIELDS, fmtMoney, fmtNumber, listPublishedImpact, type ImpactYear } from '../api'

export default function ImpactPage() {
  const [years, setYears] = useState<ImpactYear[] | null>(null)
  const [pick, setPick] = useState<number | null>(null)
  useEffect(() => {
    listPublishedImpact()
      .then((y) => {
        setYears(y)
        setPick(y[0]?.year ?? null)
      })
      .catch(() => setYears([]))
  }, [])
  const y = years?.find((r) => r.year === pick) ?? null

  return (
    <>
      <PageHeader icon="sparkles" title="Our impact" subtitle="What your gifts, hours and adoptions added up to." />
      <Screen className="space-y-4">
        {years === null && <Spinner />}
        {years && years.length === 0 && (
          <Card className="text-sm text-slate-600">
            <p className="font-bold text-ink">This year’s numbers are being counted.</p>
            <p className="mt-1">
              Ask us anything at{' '}
              <a href={`mailto:${ohrr.email}`} className="font-semibold text-brand-blue">
                {ohrr.email}
              </a>
              .
            </p>
          </Card>
        )}
        {years && years.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {years.map((r) => (
              <button key={r.year} type="button" onClick={() => setPick(r.year)} className={`min-h-[40px] rounded-full px-4 text-sm font-bold ${pick === r.year ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>
                {r.year}
              </button>
            ))}
          </div>
        )}
        {y && (
          <>
            <h2 className="font-display text-xl font-black text-ink">{y.year}</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {IMPACT_FIELDS.filter((f) => y[f.key] != null).map((f) => (
                <Card key={f.key} className="text-center">
                  <p className="font-display text-3xl font-black text-brand-blue">{f.money ? fmtMoney(y[f.key] as number) : fmtNumber(y[f.key] as number)}</p>
                  <p className="mt-0.5 text-xs font-bold uppercase tracking-wide text-slate-500">{f.label}</p>
                </Card>
              ))}
            </div>
            {y.note && <p className="text-sm leading-relaxed text-slate-600">{y.note}</p>}
            {y.highlights.length > 0 && (
              <Card>
                <p className="font-display text-[15px] font-extrabold text-ink">Highlights</p>
                <ul className="mt-2 space-y-1.5">
                  {y.highlights.map((h) => (
                    <li key={h} className="flex gap-2 text-sm text-slate-700">
                      <Icon name="check" size={16} className="mt-0.5 shrink-0 text-brand-orange" />
                      {h}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Link to="/give" className={`${btn.primary} w-full`}>
                Give
              </Link>
              <Link to="/volunteer" className={`${btn.outline} w-full`}>
                Volunteer
              </Link>
            </div>
          </>
        )}
      </Screen>
    </>
  )
}
