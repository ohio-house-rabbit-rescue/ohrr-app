import { useMemo, useState } from 'react'
import { vendors, vendorCategories } from '../data/vendors'
import { PageHeader, Container, Card, Badge, SampleBanner } from '../components/ui'

export default function Vendors() {
  const [category, setCategory] = useState<string>('All')
  const categories = ['All', ...vendorCategories]

  const list = useMemo(
    () => (category === 'All' ? vendors : vendors.filter((v) => v.category === category)),
    [category],
  )

  return (
    <>
      <PageHeader
        title="Vendor Marketplace"
        subtitle="Specialty rabbit shopping — toys, hay, handmade goods, and treats you won’t find in local pet stores."
      />
      <Container className="py-8">
        <SampleBanner>
          This is a sample directory to show the layout. The confirmed vendor
          lineup is announced closer to the event.
        </SampleBanner>

        {/* Category filter */}
        <div className="mt-6 flex flex-wrap gap-2">
          {categories.map((c) => {
            const active = c === category
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={[
                  'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-emerald-600 text-white'
                    : 'border border-stone-300 bg-white text-stone-600 hover:bg-stone-100',
                ].join(' ')}
              >
                {c}
              </button>
            )
          })}
        </div>

        {/* Vendor grid */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((v) => (
            <Card key={v.id}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-stone-900">{v.name}</h3>
              </div>
              <div className="mt-2">
                <Badge>{v.category}</Badge>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-stone-600">{v.description}</p>
            </Card>
          ))}
        </div>
      </Container>
    </>
  )
}
