// One breed: photo, how to tell it, weight, origin, and the way back to the
// finder. Facts are the breed's Wikipedia article (linked at the bottom).
import { Link, useParams } from 'react-router-dom'
import { Screen, Card, SectionLabel, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { BREEDS, COAT_LABEL, SIZE_LABEL, findBreed } from '../../../data/breeds'

export default function BreedDetail() {
  const { slug } = useParams()
  const b = findBreed(slug)
  if (!b) {
    return (
      <Screen className="space-y-4 text-center">
        <h1 className="pt-6 font-display text-xl font-extrabold text-ink">Breed not found</h1>
        <Link to="/learn/breeds" className={`${btn.blue} mx-auto`}>
          All breeds
        </Link>
      </Screen>
    )
  }
  const similar = BREEDS.filter((o) => o.slug !== b.slug && o.ears === b.ears && (o.size === b.size || o.coat === b.coat)).slice(0, 4)

  return (
    <Screen className="space-y-4">
      <Link to="/learn/breeds" className="inline-flex min-h-[44px] items-center gap-1 text-base font-bold text-brand-blue">
        <Icon name="arrowLeft" size={20} /> What kind of bunny?
      </Link>
      <div className="overflow-hidden rounded-2xl bg-slate-100 shadow-sm">
        <img src={b.photo} alt={b.name} className="aspect-[4/3] w-full object-cover" />
      </div>
      <div>
        <h1 className="font-display text-2xl font-black text-ink">{b.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {b.ears === 'lop' ? 'Lop ears' : 'Upright ears'} · {COAT_LABEL[b.coat]} · {SIZE_LABEL[b.size]}
        </p>
      </div>
      <Card className="space-y-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">How to tell</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">{b.look}</p>
        </div>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Grown weight</p>
          <p className="mt-1 text-sm text-slate-700">{b.weight}</p>
        </div>
        {b.colours && (
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Colours</p>
            <p className="mt-1 text-sm text-slate-700">{b.colours}</p>
          </div>
        )}
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Where it comes from</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">{b.origin}</p>
        </div>
      </Card>
      <Card className="border-brand-orange/20 bg-brand-orange-50/50">
        <p className="text-sm leading-relaxed text-slate-700">
          Every breed needs the same things: unlimited hay, a rabbit-savvy vet, a spay or neuter, and room to run. See{' '}
          <Link to="/learn" className="font-semibold text-brand-blue">
            Rabbit Care
          </Link>
          .
        </p>
      </Card>
      {similar.length > 0 && (
        <div className="space-y-2.5">
          <SectionLabel>Easily confused with</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            {similar.map((o) => (
              <Link key={o.slug} to={`/learn/breeds/${o.slug}`} className="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm">
                <img src={o.photo} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-ink">{o.name}</span>
                  <span className="block text-xs text-slate-500">{SIZE_LABEL[o.size]}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
      <p className="px-1 text-xs text-slate-400">
        Facts from{' '}
        <a href={b.source} target="_blank" rel="noopener noreferrer" className="underline">
          Wikipedia
        </a>{' '}
        (checked 2026-09-21). Photo credit in Settings.
      </p>
    </Screen>
  )
}
