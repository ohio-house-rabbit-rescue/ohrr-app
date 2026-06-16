import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getAdoptables } from '../lib/adopt'
import type { Rabbit } from '../data/adoptables'
import { ohrr } from '../data/ohrr'
import { Screen, Card, Badge, btn } from '../components/ui'
import { Icon } from '../components/icons'
import { RabbitPhoto } from '../components/RabbitPhoto'

export default function AdoptRabbit() {
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [rabbit, setRabbit] = useState<Rabbit | undefined>()

  useEffect(() => {
    let active = true
    getAdoptables().then((r) => {
      if (!active) return
      setRabbit(r.rabbits.find((x) => x.id === id))
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [id])

  if (loading) {
    return (
      <Screen>
        <div className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-slate-100" />
        <div className="mt-4 h-6 w-32 animate-pulse rounded bg-slate-100" />
      </Screen>
    )
  }

  if (!rabbit) {
    return (
      <Screen className="space-y-4 text-center">
        <div className="pt-6 text-5xl" aria-hidden>
          🐰
        </div>
        <h1 className="font-display text-xl font-extrabold text-ink">This bunny has hopped on</h1>
        <p className="text-sm text-slate-600">
          This rabbit may have found their forever home. Plenty more are still looking!
        </p>
        <Link to="/adopt" className={`${btn.blue} mx-auto`}>
          See adoptable rabbits
        </Link>
      </Screen>
    )
  }

  const r = rabbit
  const attributes = [
    r.spayedNeutered && 'Spayed / neutered',
    r.houseTrained && 'Litter-trained',
    r.size && `${r.size} size`,
    r.coat && `${r.coat} coat`,
    r.colors && r.colors.length > 0 && r.colors.join(', '),
    r.specialNeeds && 'Special needs',
  ].filter(Boolean) as string[]

  return (
    <div>
      {/* Photo header with an in-app back button */}
      <div className="relative">
        <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
          <RabbitPhoto name={r.name} photo={r.photo} />
        </div>
        <Link
          to="/adopt"
          aria-label="Back to adoptable rabbits"
          className="absolute left-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink shadow-md backdrop-blur transition hover:bg-white"
        >
          <Icon name="arrowLeft" size={20} />
        </Link>
      </div>

      <Screen className="space-y-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-black text-ink">{r.name}</h1>
            {r.bonded && <Badge tone="orange">Bonded pair</Badge>}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r.age && <Badge tone="blue">{r.age}</Badge>}
            {r.sex && <Badge tone="blue">{r.sex}</Badge>}
            {r.breed && <Badge tone="slate">{r.breed}</Badge>}
          </div>
        </div>

        {/* Extra photos, if the listing has them */}
        {r.photos && r.photos.length > 1 && (
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            {r.photos.slice(0, 6).map((p, i) => (
              <img
                key={i}
                src={p}
                alt={`${r.name} photo ${i + 1}`}
                loading="lazy"
                className="h-20 w-20 shrink-0 rounded-xl object-cover"
              />
            ))}
          </div>
        )}

        {r.description && (
          <Card>
            <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-slate-400">
              Meet {r.name}
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
              {r.description}
            </p>
          </Card>
        )}

        {attributes.length > 0 && (
          <Card>
            <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-slate-400">
              Good to know
            </h2>
            <ul className="mt-3 grid grid-cols-1 gap-2">
              {attributes.map((a) => (
                <li key={a} className="flex items-center gap-2 text-sm text-slate-700">
                  <Icon name="heart" size={15} className="shrink-0 text-brand-orange" />
                  {a}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Apply — the one intentional hand-off to OHRR's real application */}
        <div className="space-y-2 pt-1">
          <a
            href={ohrr.links.application}
            target="_blank"
            rel="noopener noreferrer"
            className={`${btn.primary} w-full`}
          >
            Apply to adopt {r.name}
            <Icon name="chevron" size={16} />
          </a>
          <p className="text-center text-xs leading-relaxed text-slate-500">
            Adoptions are by appointment ·{' '}
            <a href={ohrr.phoneHref} className="font-semibold text-brand-blue">
              {ohrr.phone}
            </a>
          </p>
        </div>
      </Screen>
    </div>
  )
}
