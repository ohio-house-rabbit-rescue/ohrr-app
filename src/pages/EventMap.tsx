import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CATEGORY_COLOR } from '../data/floorplan'
import { useBunfestVendors, useRescuePartners, vendorCategoriesOf } from '../features/bunfest/content'
import { useBunfestFloor } from '../features/bunfest/floorData'
import { formatNumbers, roomRanges, type Block, type TableAssignment } from '../features/bunfest/floor'
import { VenuePlan, ZoomBox, holderLabel, type TableColors } from '../features/bunfest/VenuePlan'
import { PageHeader, Screen, Card, SampleNote, btn } from '../components/ui'
import { Icon } from '../components/icons'

// The bundled categories keep their colours; anything OHRR adds gets a stable
// one from the same palette, so the map and the key always agree.
const EXTRA_COLORS = ['#0669ac', '#e0950f', '#2f9e7f', '#9b6cc4', '#d9663d', '#4b7bb5', '#b5710c']
function colorFor(category: string | null): string {
  if (!category) return '#0669ac'
  const known = CATEGORY_COLOR[category as keyof typeof CATEGORY_COLOR]
  if (known) return known
  let h = 0
  for (const ch of category) h = (h * 31 + ch.charCodeAt(0)) % 997
  return EXTRA_COLORS[h % EXTRA_COLORS.length]
}

const COLORS: TableColors = { vendor: colorFor, rescue: '#b8620c', other: '#475569' }

const kindLabel = (h: TableAssignment | null) =>
  !h ? 'Nobody has this table yet' : h.kind === 'rescue' ? 'Rescue partner' : h.kind === 'other' ? 'At BunFest' : (h.category ?? 'Vendor')

export default function EventMap() {
  const [params, setParams] = useSearchParams()
  const floor = useBunfestFloor()
  const { items: vendors } = useBunfestVendors()
  const { items: partners } = useRescuePartners()
  const venue = floor.venue

  // ?table=7 wins; ?vendor=<id> (from a vendor's page) finds their first table.
  const selected = useMemo(() => {
    const t = Number(params.get('table'))
    if (Number.isFinite(t) && t > 0) return t
    const v = params.get('vendor')
    return v ? floor.placeOf('vendor', v).numbers[0] : undefined
  }, [params, floor])

  const select = (b: Block) => {
    const next = new URLSearchParams(params)
    next.set('table', String(b.numbers[0]))
    next.delete('vendor')
    setParams(next, { replace: true })
  }

  const selBlock = selected ? floor.blocks.find((b) => b.numbers.includes(selected)) : undefined
  const selRoom = selBlock && venue ? venue.rooms.find((r) => r.id === selBlock.roomId) : undefined
  const assigned = floor.assignments.length > 0
  const categories = useMemo(() => vendorCategoriesOf(vendors), [vendors])
  const ranges = useMemo(() => (venue ? roomRanges(venue) : new Map()), [venue])

  // Every stand once, in table order, per room.
  const stands = useMemo(() => {
    const seen = new Set<string>()
    return floor.blocks
      .filter((b): b is Block & { holder: TableAssignment } => !!b.holder)
      .filter((b) => {
        const k = `${b.holder.kind}:${b.holder.id ?? b.holder.name}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      .map((b) => {
        const h = b.holder
        const all = h.id ? floor.placeOf(h.kind, h.id).numbers : b.numbers
        return { block: b, holder: h, numbers: all.length > 0 ? all : b.numbers }
      })
  }, [floor])

  const vendorOf = (id: string | null) => (id ? vendors.find((v) => v.id === id) : undefined)
  const partnerOf = (id: string | null) => (id ? partners.find((p) => p.id === id) : undefined)

  return (
    <>
      <PageHeader
        icon="mappin"
        title="Event Map"
        subtitle={
          venue?.name
            ? `${venue.name} — the rooms, the stages and activities, and every vendor and rescue by table.`
            : 'The rooms, the stages and activities, and every vendor and rescue by table.'
        }
      />
      <Screen className="space-y-5">
        {!venue && !floor.loading && (
          <Card className="text-center">
            <p className="font-display text-base font-extrabold text-ink">The floor plan isn’t out yet</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              OHRR publishes the map for {floor.year} closer to the festival.
            </p>
          </Card>
        )}
        {venue && !assigned && !floor.loading && (
          <SampleNote>Table numbers go up here as OHRR places this year’s vendors and rescues.</SampleNote>
        )}

        {/* Who's at the table you tapped */}
        {selBlock && (
          <Card className="border-brand-blue/30 bg-brand-blue-50/40">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-base font-extrabold text-ink">{holderLabel(selBlock.holder)}</h3>
                <p className="mt-0.5 text-sm text-slate-600">{kindLabel(selBlock.holder)}</p>
              </div>
              <span className="shrink-0 rounded-lg bg-white px-2.5 py-1 font-display text-sm font-black text-ink ring-1 ring-slate-200">
                {selBlock.numbers.length > 1 ? 'Tables' : 'Table'} {formatNumbers(selBlock.numbers)}
              </span>
            </div>
            {selRoom && (
              <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                <Icon name="mappin" size={13} className="text-brand-blue" />
                {selRoom.name}
              </p>
            )}
            {selBlock.holder?.kind === 'vendor' && vendorOf(selBlock.holder.id) && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to={`/bunfest/vendors/${selBlock.holder.id}`} className={`${btn.blue} px-4 py-2`}>
                  Vendor details
                </Link>
                {vendorOf(selBlock.holder.id)?.url && (
                  <a href={vendorOf(selBlock.holder.id)!.url} target="_blank" rel="noopener noreferrer" className={`${btn.outline} px-4 py-2`}>
                    Visit shop <Icon name="external" size={13} />
                  </a>
                )}
              </div>
            )}
            {selBlock.holder?.kind === 'rescue' && partnerOf(selBlock.holder.id) && (
              <div className="mt-3">
                <Link to={`/bunfest/partners/${selBlock.holder.id}`} className={`${btn.blue} px-4 py-2`}>
                  About this rescue
                </Link>
              </div>
            )}
          </Card>
        )}

        {/* Each room, to scale */}
        {venue?.rooms.map((room) => {
          const range = ranges.get(room.id)
          return (
            <section key={room.id} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2 px-1">
                <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-slate-500">{room.name}</h2>
                {range && <span className="text-xs font-semibold text-slate-500">Tables {range[0]}–{range[1]}</span>}
              </div>
              {room.note && <p className="px-1 text-sm text-slate-600">{room.note}</p>}
              <ZoomBox>
                <VenuePlan
                  room={room}
                  blocks={floor.blocks}
                  selectedTable={selected}
                  onSelectBlock={select}
                  colors={COLORS}
                  label={`${room.name} floor plan`}
                />
              </ZoomBox>
            </section>
          )
        })}

        {/* Key */}
        {venue && (
          <Card>
            <h3 className="font-display text-xs font-extrabold uppercase tracking-wide text-slate-400">Key</h3>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
              {categories.map((c) => (
                <span key={c} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <span className="h-3 w-3 rounded-sm border" style={{ background: `${colorFor(c)}33`, borderColor: colorFor(c) }} />
                  {c}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <span className="h-3 w-3 rounded-sm border" style={{ background: '#b8620c33', borderColor: '#b8620c' }} />
                Rescue partner
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <span className="h-3 w-3 rounded-sm border border-dashed border-slate-300 bg-white" />
                Free table
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Tap a table to see who’s there. The heavier edge of a table is the side you shop from.
              Side-by-side tables that belong to one stand are shown as one.
            </p>
          </Card>
        )}

        {/* Everyone, by table */}
        {venue &&
          stands.length > 0 &&
          venue.rooms.map((room) => {
            const here = stands.filter((s) => s.block.roomId === room.id)
            if (here.length === 0) return null
            return (
              <div key={room.id} className="space-y-2">
                <h3 className="px-1 font-display text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  {room.name} · {here.length} {here.length === 1 ? 'stand' : 'stands'}
                </h3>
                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                  {here.map((s) => {
                    const isSel = selected !== undefined && s.numbers.includes(selected)
                    const c = s.holder.kind === 'rescue' ? '#b8620c' : s.holder.kind === 'other' ? '#475569' : colorFor(s.holder.category)
                    return (
                      <button
                        key={formatNumbers(s.numbers)}
                        type="button"
                        onClick={() => select(s.block)}
                        className={`flex min-h-[48px] w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 ${
                          isSel ? 'bg-brand-blue-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className="inline-flex h-7 min-w-[2.75rem] shrink-0 items-center justify-center rounded-md border px-1.5 font-display text-xs font-black text-ink"
                          style={{ background: `${c}22`, borderColor: c }}
                        >
                          {formatNumbers(s.numbers)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-ink">{holderLabel(s.holder)}</span>
                          <span className="block truncate text-xs text-slate-500">{kindLabel(s.holder)}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

        <Link to="/bunfest/vendors" className={`${btn.outline} w-full`}>
          Browse all vendors
        </Link>
      </Screen>
    </>
  )
}
