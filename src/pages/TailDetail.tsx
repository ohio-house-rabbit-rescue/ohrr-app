import { Link, useParams } from 'react-router-dom'
import { useHappyTails } from '../features/tails/api'
import { BunnyPhoto, StatusPill, FollowButton } from '../components/tailbits'
import { Screen, Card, Badge, btn } from '../components/ui'
import { Icon } from '../components/icons'

export default function TailDetail() {
  const { id } = useParams()
  const { items: tails, loading } = useHappyTails()
  const tail = tails.find((t) => t.id === id)

  if (!tail && loading) return null
  if (!tail) {
    return (
      <Screen className="space-y-4 text-center">
        <div className="pt-6 text-5xl" aria-hidden>
          <img src="/ohrr-mark.png" alt="" className="mx-auto h-14 w-14 object-contain" />
        </div>
        <h1 className="font-display text-xl font-extrabold text-ink">Story not found</h1>
        <Link to="/tails" className={`${btn.blue} mx-auto`}>
          Back to Happy Tails
        </Link>
      </Screen>
    )
  }

  const t = tail

  return (
    <div>
      <div className="relative">
        <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
          <BunnyPhoto name={t.bunny} photo={t.photo} />
        </div>
        <Link
          to="/tails"
          aria-label="Back to Happy Tails"
          className="absolute left-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink shadow-md backdrop-blur transition hover:bg-white"
        >
          <Icon name="arrowLeft" size={20} />
        </Link>
      </div>

      <Screen className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-black text-ink">{t.bunny}</h1>
              {t.bonded && <Badge tone="slate">Bonded pair</Badge>}
            </div>
            <div className="mt-2">
              <StatusPill status={t.status} />
            </div>
            {(t.family || t.since) && (
              <p className="mt-2 text-sm font-semibold text-slate-500">
                {[t.family && `With the ${t.family} family`, t.since].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <FollowButton id={t.id} />
        </div>

        <p className="text-sm leading-relaxed text-slate-700">{t.summary}</p>

        {/* Looking-for-a-home bunnies get a path straight to adoption */}
        {t.status === 'looking' && (
          <Link to="/adopt" className={`${btn.primary} w-full`}>
            Meet {t.bunny} & adoptable rabbits
            <Icon name="chevron" size={16} />
          </Link>
        )}

        <Card>
          <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-slate-400">
            {t.bunny}’s journey
          </h2>
          <ul className="mt-4 space-y-4">
            {t.timeline.map((e, i) => (
              <li key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-brand-blue" />
                  {i < t.timeline.length - 1 && (
                    <span className="mt-1 w-px flex-1 bg-slate-200" aria-hidden />
                  )}
                </div>
                <div className="-mt-0.5 pb-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    {e.date}
                  </p>
                  {e.status && (
                    <div className="mt-1">
                      <StatusPill status={e.status} />
                    </div>
                  )}
                  <p className="mt-1 text-sm leading-relaxed text-slate-700">{e.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </Screen>
    </div>
  )
}
