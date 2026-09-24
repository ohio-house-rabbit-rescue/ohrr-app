import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ohrr, adoptRequirements, RABBIT_READY } from '../data/ohrr'
import { getAdoptables, teaser, type AdoptSource } from '../lib/adopt'
import type { AgeGroup, Rabbit } from '../data/adoptables'
import {
  PageHeader,
  Screen,
  Card,
  Badge,
  SectionLabel,
  SampleNote,
  SegTabs,
  ActionCard,
} from '../components/ui'
import { Icon } from '../components/icons'
import { RabbitPhoto } from '../components/RabbitPhoto'
import { AdoptionStepsCard } from './AdoptHowItWorks'

const AGE_ORDER: AgeGroup[] = ['Baby', 'Young', 'Adult', 'Senior']

export default function Adopt() {
  const [rabbits, setRabbits] = useState<Rabbit[] | null>(null)
  const [source, setSource] = useState<AdoptSource>('sample')
  const [filter, setFilter] = useState<string>('All')

  useEffect(() => {
    let active = true
    getAdoptables().then((r) => {
      if (!active) return
      setRabbits(r.rabbits)
      setSource(r.source)
    })
    return () => {
      active = false
    }
  }, [])

  const ageFilters = useMemo(() => {
    const present = new Set((rabbits ?? []).map((r) => r.age).filter(Boolean) as AgeGroup[])
    return ['All', ...AGE_ORDER.filter((a) => present.has(a))]
  }, [rabbits])

  const list = useMemo(
    () => (filter === 'All' ? rabbits ?? [] : (rabbits ?? []).filter((r) => r.age === filter)),
    [rabbits, filter],
  )

  return (
    <>
      <PageHeader
        icon="heart"
        title="Adopt a Rabbit"
        subtitle="Meet the rabbits currently looking for homes at OHRR. Every adoption is by appointment."
      />
      <Screen className="space-y-4">
        {source === 'sample' ? (
          <SampleNote>
            These are sample rabbits. OHRR’s real adoptable bunnies appear here as soon as staff add
            them (Staff → Adoptable rabbits) — no app update needed.
          </SampleNote>
        ) : (
          <p className="flex items-center gap-1.5 px-1 text-xs font-semibold text-slate-400">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            {source === 'petfinder' ? 'Live from Petfinder' : 'OHRR’s adoptable rabbits'} ·{' '}
            {rabbits?.length ?? 0} bunnies looking for homes
          </p>
        )}

        {/* Before deciding: OHRR's two-minute check */}
        <ActionCard
          to={RABBIT_READY}
          title="Is a rabbit right for us?"
          subtitle="The two-minute check, before you decide"
          icon="help"
          tone="orange"
        />

        {ageFilters.length > 1 && (
          <SegTabs options={ageFilters} value={filter} onChange={setFilter} />
        )}

        {rabbits === null ? (
          <div className="grid grid-cols-1 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3 rounded-2xl border border-slate-200/80 bg-white p-3">
                <div className="h-20 w-20 shrink-0 animate-pulse rounded-xl bg-slate-100" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-32 animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <Card className="text-center">
            <p className="text-sm text-slate-600">
              No rabbits to show in this group right now. Check back soon — new buns arrive often!
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {list.map((r) => (
              <RabbitCard key={r.id} rabbit={r} />
            ))}
          </div>
        )}

        {/* How adopting works — the 3 real steps from OHRR's site */}
        <div className="space-y-2.5 pt-1">
          <SectionLabel>How adopting works</SectionLabel>
          <AdoptionStepsCard />
          <Link
            to="/adopt/how-it-works"
            className="flex items-center justify-between gap-3 rounded-2xl border border-brand-blue/20 bg-brand-blue-50/60 px-4 py-3 text-sm font-bold text-brand-blue"
          >
            <span>Still deciding? Bunny matchmaking · Adoption Policy · Petfinder &amp; Adopt-A-Pet</span>
            <Icon name="chevron" size={16} className="shrink-0" />
          </Link>
        </div>

        {/* Before you adopt */}
        <div className="space-y-2.5 pt-1">
          <SectionLabel>Before you adopt</SectionLabel>
          <Card>
            <p className="text-sm text-slate-600">
              Every OHRR rabbit is spayed/neutered. From the Adoption Policy, adopters agree to:
            </p>
            <ul className="mt-3 space-y-2">
              {adoptRequirements.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-700">
                  <Icon name="heart" size={16} className="mt-0.5 shrink-0 text-brand-orange" /> {r}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card className="border-brand-blue/20 bg-brand-blue-50/60">
          <p className="text-sm leading-relaxed text-slate-600">
            Adoptions are by appointment on Saturdays and Sundays at the Adoption Center in Columbus; we
            send the address with your appointment. Questions? Email{' '}
            <a href={`mailto:${ohrr.email}`} className="break-all font-semibold text-brand-blue">
              {ohrr.email}
            </a>
            .
          </p>
        </Card>
      </Screen>
    </>
  )
}

function RabbitCard({ rabbit: r }: { rabbit: Rabbit }) {
  return (
    <Link
      to={`/adopt/${r.id}`}
      className="group flex gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md active:translate-y-0"
    >
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl">
        <RabbitPhoto name={r.name} photo={r.photo} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-display text-base font-extrabold text-ink">{r.name}</h3>
          {r.bonded && <Badge tone="orange">Pair</Badge>}
          {r.status && !/available|adoptable/i.test(r.status) && (
            <Badge tone="slate">{r.status}</Badge>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {r.age && <Badge tone="slate">{r.age}</Badge>}
          {r.sex && <Badge tone="slate">{r.sex}</Badge>}
          {r.breed && <Badge tone="slate">{r.breed}</Badge>}
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-slate-500">{teaser(r)}</p>
      </div>
      <Icon
        name="chevron"
        size={18}
        className="shrink-0 self-center text-slate-300 transition group-hover:text-brand-orange"
      />
    </Link>
  )
}
