import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  rooms,
  zones,
  entrances,
  placeBooths,
  roomName,
  CATEGORY_COLOR,
  type RoomId,
  type FloorZone,
  type PlacedBooth,
} from '../data/floorplan'
import { useBunfestVendors, vendorCategoriesOf, type BunfestVendor } from '../features/bunfest/content'
import { PageHeader, Screen, Card, SampleNote, Badge, btn } from '../components/ui'
import { Icon } from '../components/icons'

// The bundled categories keep their colours; anything OHRR adds gets a stable
// one from the same palette, so the map and the legend always agree.
const EXTRA_COLORS = ['#0669ac', '#e0950f', '#2f9e7f', '#9b6cc4', '#d9663d', '#4b7bb5', '#b5710c']
function colorFor(category: string): string {
  const known = CATEGORY_COLOR[category as keyof typeof CATEGORY_COLOR]
  if (known) return known
  let h = 0
  for (const ch of category) h = (h * 31 + ch.charCodeAt(0)) % 997
  return EXTRA_COLORS[h % EXTRA_COLORS.length]
}

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

function RoomPlan({
  roomId,
  booths,
  byId,
  selected,
  onSelect,
}: {
  roomId: RoomId
  booths: PlacedBooth[]
  byId: Map<string, BunfestVendor>
  selected?: string
  onSelect: (vendorId: string) => void
}) {
  const room = rooms.find((r) => r.id === roomId)!
  const roomZones = zones.filter((z) => z.room === roomId)
  const ent = entrances.find((e) => e.room === roomId)

  return (
    <svg viewBox={`0 0 ${room.viewW} ${room.viewH}`} className="w-full" role="img" aria-label={`${room.name} floor plan`}>
      {/* walls */}
      <rect x={14} y={10} width={312} height={220} rx={6} fill="#fafbfc" stroke="#94a3b8" strokeWidth={1.6} />

      {/* vendor block backdrop */}
      <rect
        x={room.grid.x - 3}
        y={room.grid.y - 10}
        width={room.grid.w + 6}
        height={room.grid.h + 13}
        rx={3}
        fill="#ffffff"
        stroke="#cbd5e1"
        strokeDasharray="3 2"
        strokeWidth={0.8}
      />
      <text x={room.grid.x} y={room.grid.y - 3} fill="#94a3b8" fontSize={6.2} fontWeight={800} letterSpacing={0.4}>
        VENDORS
      </text>

      {/* entrance gap + label */}
      {ent && (
        <>
          <rect
            x={ent.side === 'left' ? 10 : 322}
            y={ent.y - 14}
            width={8}
            height={28}
            fill="#fafbfc"
          />
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

      {roomZones.map((z) => (
        <Zone key={z.label + z.x} z={z} />
      ))}

      {/* booths */}
      {booths.map((b) => {
        const vendor = byId.get(b.vendorId)
        const color = vendor ? colorFor(vendor.category) : '#94a3b8'
        const isSel = selected === b.vendorId
        return (
          <g key={b.label} onClick={() => onSelect(b.vendorId)} style={{ cursor: 'pointer' }}>
            <title>{`${b.label} · ${vendor?.name ?? ''}`}</title>
            <rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx={2}
              fill={color}
              fillOpacity={isSel ? 1 : 0.82}
              stroke={isSel ? '#0b0b0b' : '#ffffff'}
              strokeWidth={isSel ? 2 : 0.8}
            />
            <text
              x={b.x + b.w / 2}
              y={b.y + b.h / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#ffffff"
              fontSize={7}
              fontWeight={800}
            >
              {b.index + 1}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function EventMap() {
  const [params, setParams] = useSearchParams()
  const initial = params.get('vendor') ?? undefined
  const [selected, setSelected] = useState<string | undefined>(initial)
  const { items: vendors, assignments, source } = useBunfestVendors()
  const byId = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors])
  // A booth number OHRR typed wins over the computed "B3".
  const labels = useMemo(
    () => Object.fromEntries(vendors.map((v) => [v.id, v.booth])) as Record<string, string | undefined>,
    [vendors],
  )
  const categories = useMemo(() => vendorCategoriesOf(vendors), [vendors])

  const select = (vendorId: string) => {
    setSelected(vendorId)
    const next = new URLSearchParams(params)
    next.set('vendor', vendorId)
    setParams(next, { replace: true })
  }

  // Vendor list grouped by room, in booth order.
  const byRoom = useMemo(
    () => rooms.map((r) => ({ room: r, booths: placeBooths(assignments, r.id, labels) })),
    [assignments, labels],
  )
  const selVendor = selected ? byId.get(selected) : undefined
  const selBooth = selected ? byRoom.flatMap((r) => r.booths).find((b) => b.vendorId === selected) : undefined

  return (
    <>
      <PageHeader
        icon="mappin"
        title="Event Map"
        subtitle="Find vendors, the stages, the Hop Shop, spa, and more — laid out across the Burgundy and Emerald Rooms."
      />
      <Screen className="space-y-5">
        <SampleNote>
          The room layout follows BunFest’s 2025 map.{' '}
          {source === 'seed'
            ? 'Booth numbers and table counts are an estimate to show how the floor comes together — OHRR sets the final placements under Staff → BunFest.'
            : 'Booths are where OHRR has placed this year’s vendors; the rooms themselves follow the published map.'}
        </SampleNote>

        {/* Selected vendor detail */}
        {selVendor && selBooth && (
          <Card className="border-brand-blue/30 bg-brand-blue-50/40">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-display text-base font-extrabold text-ink">{selVendor.name}</h3>
                <p className="mt-0.5 text-sm text-slate-600">{selVendor.category}</p>
              </div>
              <span
                className="shrink-0 rounded-lg px-2.5 py-1 font-display text-sm font-black text-white"
                style={{ background: colorFor(selVendor.category) }}
              >
                {selBooth.label}
              </span>
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Icon name="mappin" size={13} className="text-brand-blue" />
                {roomName(selBooth.room)}
              </span>
              <span>
                {selBooth.tables === 2 ? 'Two 8-ft tables' : 'One 8-ft table'}
              </span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to={`/bunfest/vendors/${selVendor.id}`} className={`${btn.blue} px-4 py-2`}>
                Vendor details
              </Link>
              {selVendor.url && (
                <a
                  href={selVendor.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${btn.outline} px-4 py-2`}
                >
                  Visit shop <Icon name="external" size={13} />
                </a>
              )}
            </div>
          </Card>
        )}

        {/* The two rooms */}
        {rooms.map((r) => (
          <div key={r.id} className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-slate-500">
                {r.name}
              </h2>
              <span className="text-[11px] font-semibold text-slate-400">
                {r.id === 'burgundy' ? 'tables run left → right' : 'tables run top → bottom'}
              </span>
            </div>
            <Card className="p-2">
              <RoomPlan
                roomId={r.id}
                booths={byRoom.find((x) => x.room.id === r.id)?.booths ?? []}
                byId={byId}
                selected={selected}
                onSelect={select}
              />
            </Card>
          </div>
        ))}

        {/* Legend */}
        <Card>
          <h3 className="font-display text-xs font-extrabold uppercase tracking-wide text-slate-400">
            Vendor categories
          </h3>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
            {categories.map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <span className="h-3 w-3 rounded-sm" style={{ background: colorFor(c) }} />
                {c}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Tap a booth to see the vendor. Education sessions are upstairs.
          </p>
        </Card>

        {/* Vendor directory by room/booth */}
        {byRoom.map(({ room, booths }) => (
          <div key={room.id} className="space-y-2">
            <h3 className="px-1 font-display text-xs font-extrabold uppercase tracking-wider text-slate-400">
              {room.name} · {booths.length} vendors
            </h3>
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              {booths.map((b) => {
                const v = byId.get(b.vendorId)
                if (!v) return null
                const isSel = selected === b.vendorId
                return (
                  <button
                    key={b.label}
                    type="button"
                    onClick={() => select(b.vendorId)}
                    className={`flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 ${
                      isSel ? 'bg-brand-blue-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className="inline-flex h-7 w-9 shrink-0 items-center justify-center rounded-md font-display text-xs font-black text-white"
                      style={{ background: colorFor(v.category) }}
                    >
                      {b.label}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">{v.name}</span>
                      <span className="block truncate text-xs text-slate-500">{v.category}</span>
                    </span>
                    {b.tables === 2 && <Badge tone="slate">×2</Badge>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        <Link to="/bunfest/vendors" className={`${btn.outline} w-full`}>
          Browse all vendors
        </Link>
      </Screen>
    </>
  )
}
