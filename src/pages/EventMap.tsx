import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { rooms, zones, entrances, CATEGORY_COLOR, type RoomId, type FloorZone } from '../data/floorplan'
import { useBunfestVendors, useRescuePartners, vendorCategoriesOf } from '../features/bunfest/content'
import { useBunfestFloor } from '../features/bunfest/floorData'
import { formatNumbers, ROOM_NAMES, type Block, type TableAssignment } from '../features/bunfest/floor'
import { TablesPanel, holderLabel, type TableColors } from '../features/bunfest/TablesPanel'
import { PageHeader, Screen, Card, SampleNote, btn } from '../components/ui'
import { Icon } from '../components/icons'

// The bundled categories keep their colours; anything OHRR adds gets a stable
// one from the same palette, so the map and the legend always agree.
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

const ZONE_STYLE: Record<FloorZone['kind'], { fill: string; text: string }> = {
  stage: { fill: '#334155', text: '#ffffff' },
  service: { fill: '#e6f1fa', text: '#0a5a93' },
  amenity: { fill: '#eef2f7', text: '#475569' },
  restroom: { fill: '#f1f5f9', text: '#64748b' },
  sitting: { fill: '#eaf4fb', text: '#0a5a93' },
  shop: { fill: '#fdecd3', text: '#b5710c' },
  entrance: { fill: '#ffffff', text: '#475569' },
}

function splitLabel(label: string): string[] {
  if (label.length <= 12) return [label]
  const words = label.split(' ')
  const mid = Math.ceil(words.length / 2)
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
}

function Zone({ z }: { z: FloorZone }) {
  const s = ZONE_STYLE[z.kind]
  const lines = splitLabel(z.label)
  const cx = z.x + z.w / 2
  const cy = z.y + z.h / 2
  return (
    <g>
      <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={3} fill={s.fill} stroke="#cbd5e1" strokeWidth={0.8} />
      {z.kind === 'sitting' &&
        [0, 1, 2].flatMap((r) =>
          [0, 1].map((c) => (
            <circle key={`${r}-${c}`} cx={z.x + 24 + c * 24} cy={z.y + 16 + r * 14} r={4.5} fill="none" stroke="#9cc4de" strokeWidth={1} />
          )),
        )}
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill={s.text} fontSize={6.6} fontWeight={700}>
        {lines.length === 1 ? (
          lines[0]
        ) : (
          <>
            <tspan x={cx} dy={-3.2}>{lines[0]}</tspan>
            <tspan x={cx} dy={7.4}>{lines[1]}</tspan>
          </>
        )}
      </text>
    </g>
  )
}

/** The room at a glance: the fixed areas, and where the tables are. */
function RoomOverview({ roomId, tables }: { roomId: RoomId; tables: string }) {
  const room = rooms.find((r) => r.id === roomId)!
  const ent = entrances.find((e) => e.room === roomId)
  const g = room.grid
  return (
    <svg viewBox={`0 0 ${room.viewW} ${room.viewH}`} className="w-full" role="img" aria-label={`${room.name} layout`}>
      <rect x={14} y={10} width={312} height={220} rx={6} fill="#fafbfc" stroke="#94a3b8" strokeWidth={1.6} />
      {ent && (
        <>
          <rect x={ent.side === 'left' ? 10 : 322} y={ent.y - 14} width={8} height={28} fill="#fafbfc" />
          <text
            x={ent.side === 'left' ? 6 : 334}
            y={ent.y}
            textAnchor={ent.side === 'left' ? 'start' : 'end'}
            fill="#64748b"
            fontSize={6}
            fontWeight={700}
          >
            Entrance
          </text>
        </>
      )}
      {zones
        .filter((z) => z.room === roomId)
        .map((z) => (
          <Zone key={z.label + z.x} z={z} />
        ))}
      {/* Where the stands are — drawn table by table below. */}
      <rect x={g.x} y={g.y} width={g.w} height={g.h} rx={4} fill="#fff4e5" stroke="#eb891c" strokeWidth={1.2} strokeDasharray="4 2" />
      <text x={g.x + g.w / 2} y={g.y + g.h / 2 - 5} textAnchor="middle" fill="#b8620c" fontSize={8} fontWeight={900}>
        Vendors &amp; rescues
      </text>
      <text x={g.x + g.w / 2} y={g.y + g.h / 2 + 7} textAnchor="middle" fill="#b8620c" fontSize={7.5} fontWeight={700}>
        {tables}
      </text>
    </svg>
  )
}

export default function EventMap() {
  const [params, setParams] = useSearchParams()
  const floor = useBunfestFloor()
  const { items: vendors } = useBunfestVendors()
  const { items: partners } = useRescuePartners()

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
  const assigned = floor.assignments.length > 0
  const categories = useMemo(() => vendorCategoriesOf(vendors), [vendors])

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
        subtitle="The Burgundy and Emerald Rooms — the stages, the Hop Shop, spa and lounge, and every vendor and rescue by table."
      />
      <Screen className="space-y-5">
        {!assigned && !floor.loading && (
          <SampleNote>
            Table numbers go up here as OHRR places this year’s vendors and rescues. The rooms follow
            BunFest’s published map.
          </SampleNote>
        )}

        {/* Who's at the table you tapped */}
        {selBlock && (
          <Card className="border-brand-blue/30 bg-brand-blue-50/40">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-base font-extrabold text-ink">{holderLabel(selBlock.holder)}</h3>
                <p className="mt-0.5 text-sm text-slate-600">
                  {selBlock.holder?.kind === 'rescue'
                    ? 'Rescue partner'
                    : selBlock.holder?.kind === 'other'
                      ? 'At BunFest'
                      : selBlock.holder
                        ? (selBlock.holder.category ?? 'Vendor')
                        : 'Nobody has this table yet'}
                </p>
              </div>
              <span className="shrink-0 rounded-lg bg-white px-2.5 py-1 font-display text-sm font-black text-ink ring-1 ring-slate-200">
                {selBlock.numbers.length > 1 ? 'Tables' : 'Table'} {formatNumbers(selBlock.numbers)}
              </span>
            </div>
            <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
              <Icon name="mappin" size={13} className="text-brand-blue" />
              {ROOM_NAMES[selBlock.room]}
            </p>
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

        {/* The two rooms: the overview, then every table */}
        {rooms.map((r) => {
          const roomRows = floor.rows.filter((x) => x.room === r.id)
          const range =
            roomRows.length > 0 ? `Tables ${roomRows[0].first}–${roomRows[roomRows.length - 1].last}` : 'No tables'
          return (
            <section key={r.id} className="space-y-1.5">
              <h2 className="px-1 font-display text-sm font-extrabold uppercase tracking-wide text-slate-500">{r.name}</h2>
              <Card className="space-y-2 p-2">
                <RoomOverview roomId={r.id} tables={range} />
                <TablesPanel
                  room={r.id}
                  rows={floor.rows}
                  blocks={floor.blocks}
                  selected={selected}
                  onSelect={select}
                  colors={COLORS}
                  label={`${r.name} tables`}
                />
              </Card>
            </section>
          )
        })}

        {/* Legend */}
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
          <p className="mt-2 text-xs text-slate-500">
            Tap a table to see who’s there. Side-by-side tables that belong to one stand are shown as
            one. Education sessions are upstairs.
          </p>
        </Card>

        {/* Everyone, by table */}
        {stands.length > 0 &&
          rooms.map((r) => {
            const here = stands.filter((s) => s.block.room === r.id)
            if (here.length === 0) return null
            return (
              <div key={r.id} className="space-y-2">
                <h3 className="px-1 font-display text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  {r.name} · {here.length} {here.length === 1 ? 'stand' : 'stands'}
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
                          <span className="block truncate text-xs text-slate-500">
                            {s.holder.kind === 'rescue' ? 'Rescue partner' : s.holder.kind === 'other' ? 'At BunFest' : (s.holder.category ?? 'Vendor')}
                          </span>
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
