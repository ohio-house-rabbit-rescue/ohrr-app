import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { tails, type Tail } from '../data/tails'
import { useFollowing } from '../lib/follow'
import { BunnyPhoto, StatusPill, FollowButton } from '../components/tailbits'
import { PageHeader, Screen, Card, Badge, SampleNote, SegTabs } from '../components/ui'
import { Icon } from '../components/icons'

const FILTERS = ['All', 'Just adopted', 'Going strong', 'Following'] as const
type Filter = (typeof FILTERS)[number]

export default function Tails() {
  const [filter, setFilter] = useState<Filter>('All')
  const following = useFollowing()

  const list = useMemo(() => {
    switch (filter) {
      case 'Just adopted':
        return tails.filter((t) => t.status === 'just-adopted')
      case 'Going strong':
        return tails.filter((t) => t.status === 'going-strong')
      case 'Following':
        return tails.filter((t) => following.has(t.id))
      default:
        return tails
    }
  }, [filter, following])

  return (
    <>
      <PageHeader
        icon="sparkles"
        title="Happy Tails"
        subtitle="Where OHRR bunnies are now — and how they’re doing. Follow the ones you love to check back on their journey."
      />
      <Screen className="space-y-4">
        <SampleNote>
          These are sample stories. Real Happy Tails from OHRR adopters will appear here — adopted
          from OHRR? Share yours below.
        </SampleNote>

        <SegTabs options={FILTERS} value={filter} onChange={setFilter} />

        {list.length === 0 ? (
          <Card className="text-center">
            <p className="py-2 text-sm text-slate-600">
              {filter === 'Following'
                ? 'You’re not following any bunnies yet. Tap the heart on a story to follow along.'
                : 'No stories here yet — check back soon!'}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {list.map((t) => (
              <TailCard key={t.id} tail={t} />
            ))}
          </div>
        )}

        {/* Submission — curated model: OHRR collects and posts these */}
        <Card className="border-brand-orange/20 bg-brand-orange-50/50">
          <h3 className="font-display text-base font-extrabold text-ink">Share your Happy Tail</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Adopted a bunny from OHRR? Send a photo and a quick update and we’ll add your story here.
          </p>
          <Link
            to="/tails/share"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-brand-orange/60 px-5 py-2.5 text-sm font-bold text-brand-orange transition hover:bg-brand-orange-50"
          >
            Submit your story <Icon name="chevron" size={14} />
          </Link>
        </Card>
      </Screen>
    </>
  )
}

function TailCard({ tail: t }: { tail: Tail }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <Link to={`/tails/${t.id}`} className="group flex min-w-0 flex-1 gap-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl">
          <BunnyPhoto name={t.bunny} photo={t.photo} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-display text-base font-extrabold text-ink group-hover:text-brand-blue-dark">
              {t.bunny}
            </h3>
            {t.bonded && <Badge tone="slate">Pair</Badge>}
          </div>
          <div className="mt-1">
            <StatusPill status={t.status} />
          </div>
          <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-slate-500">{t.summary}</p>
          {(t.family || t.since) && (
            <p className="mt-1 truncate text-xs font-semibold text-slate-400">
              {[t.family && `With the ${t.family} family`, t.since].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </Link>
      <FollowButton id={t.id} compact />
    </div>
  )
}
