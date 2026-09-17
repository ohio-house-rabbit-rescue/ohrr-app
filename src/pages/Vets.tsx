import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Screen, Card, SectionLabel, Badge, SegTabs } from '../components/ui'
import { Icon } from '../components/icons'
import { useVets, telHref, phoneDigits, prettyUrl } from '../lib/vets'
import { mapsUrl } from '../lib/events'
import {
  VET_REGIONS,
  VET_DISCLAIMER,
  EMERGENCY_VET,
  VET_EXTERNAL_LISTS,
  type Vet,
} from '../data/vets'
import PresentedBy from '../features/sponsors/PresentedBy'

function PhoneLink({ value }: { value: string }) {
  const digits = phoneDigits(value)
  if (!digits) return <span className="text-sm text-slate-600">{value}</span>
  return (
    <a href={telHref(digits)} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-blue">
      <Icon name="phone" size={15} className="shrink-0" /> {value}
    </a>
  )
}

function VetCard({ vet }: { vet: Vet }) {
  const fullAddress = [vet.address, vet.city].filter(Boolean).join(', ')
  const mappable = Boolean(vet.address && /\d/.test(vet.address))
  return (
    <Card className={vet.isEmergency ? 'border-red-200' : ''}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-base font-extrabold leading-tight text-ink">{vet.name}</h3>
        {vet.isEmergency && (
          <span className="shrink-0 rounded-full bg-red-600 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-white">
            Emergency
          </span>
        )}
      </div>
      {vet.doctors && <p className="mt-0.5 text-sm text-slate-500">{vet.doctors}</p>}
      {vet.notes && (
        <p className="mt-1.5 text-sm font-semibold text-brand-orange">{vet.notes}</p>
      )}

      <div className="mt-3 space-y-2">
        {fullAddress && (
          <div className="flex items-start gap-2 text-sm text-slate-600">
            <Icon name="mappin" size={15} className="mt-0.5 shrink-0 text-brand-blue" />
            {mappable ? (
              <a
                href={mapsUrl(fullAddress)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-brand-blue underline decoration-brand-blue/30 underline-offset-2"
              >
                {fullAddress}
              </a>
            ) : (
              <span>{fullAddress}</span>
            )}
          </div>
        )}
        {vet.phone && <PhoneLink value={vet.phone} />}
        {vet.phone2 && <PhoneLink value={vet.phone2} />}
        {vet.email && (
          <a
            href={`mailto:${vet.email}`}
            className="flex items-center gap-2 break-all text-sm font-semibold text-brand-blue"
          >
            <Icon name="mail" size={15} className="shrink-0" /> {vet.email}
          </a>
        )}
        {vet.website && (
          <a
            href={vet.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 break-all text-sm font-semibold text-brand-blue"
          >
            <Icon name="external" size={15} className="shrink-0" /> {prettyUrl(vet.website)}
          </a>
        )}
      </div>
    </Card>
  )
}

const REGION_OPTIONS = [...VET_REGIONS, 'All'] as const
type RegionFilter = (typeof REGION_OPTIONS)[number]

export default function Vets() {
  const { vets, source } = useVets()
  const [region, setRegion] = useState<RegionFilter>('Central Ohio')

  // Regions that actually have vets (live data may add new ones — tolerate them).
  const regions = useMemo(() => {
    const present = new Set(vets.filter((v) => !v.isLowCostSpay).map((v) => v.region))
    const known = VET_REGIONS.filter((r) => present.has(r))
    const extra = [...present].filter((r) => !(VET_REGIONS as readonly string[]).includes(r))
    return [...known, ...extra, 'All'] as RegionFilter[]
  }, [vets])

  const list = useMemo(
    () =>
      vets.filter((v) => !v.isLowCostSpay && (region === 'All' || v.region === region)),
    [vets, region],
  )
  const emergencies = list.filter((v) => v.isEmergency)
  const regular = list.filter((v) => !v.isEmergency)
  const lowCost = vets.filter((v) => v.isLowCostSpay)

  return (
    <>
      <PageHeader
        icon="phone"
        title="Find a rabbit-savvy vet"
        subtitle="Rabbits are exotic pets — these vets know bunnies. Tap to call, tap the address for directions."
      />
      <Screen className="space-y-5">
        <PresentedBy surface="find-a-vet" />
        {/* Emergency banner */}
        <a
          href={telHref(EMERGENCY_VET.phone)}
          className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 transition active:scale-[.99]"
        >
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white">
            <Icon name="phone" size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-extrabold uppercase tracking-wider text-red-700">
              After-hours emergencies
            </span>
            <span className="block font-display text-[15px] font-extrabold leading-tight text-ink">
              {EMERGENCY_VET.name}, 24/7 exotics
            </span>
            <span className="block text-sm font-bold text-red-700">Tap to call {EMERGENCY_VET.phone}</span>
          </span>
          <Icon name="chevron" size={18} className="shrink-0 text-red-300" />
        </a>

        <SegTabs options={regions} value={region} onChange={setRegion} wrap />

        {emergencies.length > 0 && (
          <section className="space-y-2.5">
            <SectionLabel>24/7 &amp; after-hours</SectionLabel>
            <div className="space-y-3">
              {emergencies.map((v) => (
                <VetCard key={v.id} vet={v} />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-2.5">
          <SectionLabel>{region === 'All' ? 'All regions' : region}</SectionLabel>
          {regular.length === 0 ? (
            <Card className="border-slate-200 bg-slate-50/80 text-center">
              <p className="text-sm text-slate-600">No vets listed for this region yet.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {regular.map((v) => (
                <VetCard key={v.id} vet={v} />
              ))}
            </div>
          )}
        </section>

        {lowCost.length > 0 && (
          <section className="space-y-2.5">
            <SectionLabel>Low-cost spay / neuter</SectionLabel>
            <div className="space-y-3">
              {lowCost.map((v) => (
                <VetCard key={v.id} vet={v} />
              ))}
            </div>
            <p className="px-1 text-xs leading-relaxed text-slate-500">
              Why fix your bunny?{' '}
              <Link to="/learn/spay-neuter" className="font-semibold text-brand-blue">
                Spay/Neuter: It’s More than Population Control
              </Link>
            </p>
          </section>
        )}

        <section className="space-y-2.5">
          <SectionLabel>More vet lists</SectionLabel>
          <Card className="divide-y divide-slate-100 !p-0">
            {VET_EXTERNAL_LISTS.map((l) => (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-brand-blue"
              >
                {l.label}
                <Icon name="external" size={14} className="shrink-0 text-slate-300" />
              </a>
            ))}
          </Card>
        </section>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
          <p className="text-xs leading-relaxed text-slate-500">{VET_DISCLAIMER}</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400">
            <Badge tone="slate">{source === 'live' ? 'Kept current by OHRR staff' : 'From ohiohouserabbitrescue.org'}</Badge>
          </p>
        </div>
      </Screen>
    </>
  )
}
