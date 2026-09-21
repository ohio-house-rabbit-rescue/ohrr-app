// "What kind of bunny do I have?" — three plain questions (ears, size, coat)
// narrow the breed cards; tap a card for the full page. Says up front that
// most rescue rabbits are mixes, because they are.
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Screen, Card, SectionLabel } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { BREEDS, COAT_LABEL, SIZE_LABEL, type BreedCoat, type BreedEars, type BreedSize } from '../../../data/breeds'

type Pick<T extends string> = T | 'any'

function Pills<T extends string>({ options, value, onChange }: { options: { key: Pick<T>; label: string }[]; value: Pick<T>; onChange: (v: Pick<T>) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
          className={`min-h-[40px] rounded-full px-3.5 text-sm font-bold ${value === o.key ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function BreedGuide() {
  const [ears, setEars] = useState<Pick<BreedEars>>('any')
  const [size, setSize] = useState<Pick<BreedSize>>('any')
  const [coat, setCoat] = useState<Pick<BreedCoat>>('any')

  const matches = useMemo(
    () => BREEDS.filter((b) => (ears === 'any' || b.ears === ears) && (size === 'any' || b.size === size) && (coat === 'any' || b.coat === coat)),
    [ears, size, coat],
  )
  const filtering = ears !== 'any' || size !== 'any' || coat !== 'any'

  return (
    <>
      <PageHeader icon="search" title="What kind of bunny do I have?" subtitle="Answer three questions and see the breeds that fit. Most rabbits are a mix — and that’s fine." />
      <Screen className="space-y-5">
        <Card className="border-brand-orange/20 bg-brand-orange-50/50">
          <p className="text-sm leading-relaxed text-slate-700">
            <span className="font-bold text-ink">Most rescue rabbits are mixed breed.</span> If your bunny doesn’t match one card exactly, that’s normal — care is the same for every rabbit. This guide is for curiosity, not paperwork.
          </p>
        </Card>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <SectionLabel>Ears</SectionLabel>
            <Pills<BreedEars>
              options={[
                { key: 'any', label: 'Not sure' },
                { key: 'lop', label: 'Hang down (lop)' },
                { key: 'upright', label: 'Stand up' },
              ]}
              value={ears}
              onChange={setEars}
            />
          </div>
          <div className="space-y-1.5">
            <SectionLabel>Grown weight</SectionLabel>
            <Pills<BreedSize>
              options={[{ key: 'any', label: 'Not sure' }, ...(Object.keys(SIZE_LABEL) as BreedSize[]).map((k) => ({ key: k, label: SIZE_LABEL[k] }))]}
              value={size}
              onChange={setSize}
            />
          </div>
          <div className="space-y-1.5">
            <SectionLabel>Coat</SectionLabel>
            <Pills<BreedCoat>
              options={[{ key: 'any', label: 'Not sure' }, ...(Object.keys(COAT_LABEL) as BreedCoat[]).map((k) => ({ key: k, label: COAT_LABEL[k] }))]}
              value={coat}
              onChange={setCoat}
            />
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <SectionLabel>{filtering ? `${matches.length} breed${matches.length === 1 ? ' fits' : 's fit'}` : `${BREEDS.length} breeds`}</SectionLabel>
            {filtering && (
              <button type="button" onClick={() => { setEars('any'); setSize('any'); setCoat('any') }} className="text-xs font-bold text-brand-blue">
                Clear
              </button>
            )}
          </div>
          {matches.length === 0 ? (
            <Card>
              <p className="text-sm text-slate-600">No recognised breed matches all three answers — which usually means a mix. Try “Not sure” on one of them.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {matches.map((b) => (
                <Link key={b.slug} to={`/learn/breeds/${b.slug}`} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="aspect-square w-full bg-slate-100">
                    <img src={b.photo} alt={b.name} loading="lazy" className="h-full w-full object-cover" />
                  </div>
                  <div className="p-3">
                    <p className="font-display text-sm font-extrabold text-ink">{b.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {b.ears === 'lop' ? 'Lop ears' : 'Upright ears'} · {SIZE_LABEL[b.size]}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <Card className="space-y-2">
          <p className="text-sm font-bold text-ink">Adopting? Breed matters less than you think.</p>
          <p className="text-sm leading-relaxed text-slate-600">Temperament comes from the individual rabbit, not the breed. Meet the rabbits at the Adoption Center and let one pick you.</p>
          <Link to="/adopt" className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue">
            See who’s waiting <Icon name="chevron" size={14} />
          </Link>
        </Card>
        <p className="px-1 text-xs leading-relaxed text-slate-400">Breed facts follow each breed’s Wikipedia article and the ARBA recognised-breeds list; photos are freely licensed Wikimedia Commons images, credited in Settings.</p>
      </Screen>
    </>
  )
}
