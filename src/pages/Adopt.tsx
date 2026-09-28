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
import { useMarkSeen } from '../features/account/forYouCounts'

const AGE_ORDER: AgeGroup[] = ['Baby', 'Young', 'Adult', 'Senior']

/** One card in the list: a rabbit, or a bonded pair (`mate` set) shown together. */
type Listing = { rabbit: Rabbit; mate?: Rabbit }

/**
 * A bonded pair is two listings that must go home together, each tagged
 * "Adopted together with <name>". The list shows them as one card, named for
 * both and opening the first (as the website does). A partner is matched only
 * when exactly one other listing has that name, so two rabbits sharing a name
 * can never pair the wrong bunnies; a tag on just one side is enough.
 */
function pairUp(list: Rabbit[]): Listing[] {
  const mateOf = new Map<string, Rabbit>()
  for (const r of list) {
    const want = (r.tags ?? [])
      .map((t) => /adopted together with (.+)/i.exec(t)?.[1]?.trim().toLowerCase())
      .find(Boolean)
    if (!want || mateOf.has(r.id)) continue
    const hits = list.filter((o) => o.id !== r.id && o.name.trim().toLowerCase() === want)
    if (hits.length !== 1 || mateOf.has(hits[0].id)) continue
    mateOf.set(r.id, hits[0])
    mateOf.set(hits[0].id, r)
  }
  const out: Listing[] = []
  const shown = new Set<string>()
  for (const r of list) {
    if (shown.has(r.id)) continue
    const mate = mateOf.get(r.id)
    if (mate) shown.add(mate.id)
    out.push({ rabbit: r, mate })
  }
  return out
}

export default function Adopt() {
  // Every listed rabbit is here, so "New for you" counts them as seen.
  useMarkSeen('adoptions')
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

  // Pair up before filtering, so a pair shows under either partner's age group.
  const list = useMemo(() => {
    const all = pairUp(rabbits ?? [])
    return filter === 'All' ? all : all.filter((l) => l.rabbit.age === filter || l.mate?.age === filter)
  }, [rabbits, filter])

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
            {list.map((l) => (
              <RabbitCard key={l.rabbit.id} rabbit={l.rabbit} mate={l.mate} />
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

// "Adult", or "Female & Male" when a pair differ.
function both(a?: string, b?: string): string | undefined {
  return a && b && a !== b ? `${a} & ${b}` : a || b
}

function RabbitCard({ rabbit: r, mate }: { rabbit: Rabbit; mate?: Rabbit }) {
  const name = mate ? `${r.name} & ${mate.name}` : r.name
  const status = [r, mate].find((x) => x?.status && !/available|adoptable/i.test(x.status))?.status
  return (
    <Link
      to={`/adopt/${r.id}`}
      className="group flex gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md active:translate-y-0"
    >
      {/* One photo, as on the website: a pair's first photo on RescueGroups is already the two together. */}
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl">
        <RabbitPhoto name={mate ? `${r.name} and ${mate.name}` : r.name} photo={r.photo ?? mate?.photo} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-display text-base font-extrabold text-ink">{name}</h3>
          {(r.bonded || mate) && <Badge tone="orange">Pair</Badge>}
          {status && <Badge tone="slate">{status}</Badge>}
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {both(r.age, mate?.age) && <Badge tone="slate">{both(r.age, mate?.age)}</Badge>}
          {both(r.sex, mate?.sex) && <Badge tone="slate">{both(r.sex, mate?.sex)}</Badge>}
          {both(r.breed, mate?.breed) && <Badge tone="slate">{both(r.breed, mate?.breed)}</Badge>}
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
