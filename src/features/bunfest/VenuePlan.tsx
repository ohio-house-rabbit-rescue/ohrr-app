// Draws one room of the BunFest venue to scale: walls and doors, the fixed
// areas, and every table — free tables numbered, each stand's side-by-side
// tables as one block with its name once, and a heavier edge on the side
// customers stand on.
//
// The same drawing serves the public map, the staff "who sits where" preview
// and the venue designer (which can tap a row, area or door to edit it), so
// what staff see is what visitors get. Depends only on React and ./floor, so
// the website and the BunFest site keep identical copies.
import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { fitLines, formatNumbers, runBox, type AreaKind, type Block, type Room, type Side, type TableAssignment } from './floor'

export interface TableColors {
  vendor: (category: string | null) => string
  rescue: string
  other: string
}

export const DEFAULT_TABLE_COLORS: TableColors = {
  vendor: () => '#0669ac',
  rescue: '#b8620c',
  other: '#475569',
}

export function holderLabel(h: TableAssignment | null): string {
  if (!h) return 'Free'
  return h.name ?? 'Reserved'
}

function colorOf(h: TableAssignment, c: TableColors): string {
  return h.kind === 'rescue' ? c.rescue : h.kind === 'other' ? c.other : c.vendor(h.category)
}

const AREA_STYLE: Record<AreaKind, { fill: string; stroke: string; text: string }> = {
  stage: { fill: '#334155', stroke: '#1e293b', text: '#ffffff' },
  service: { fill: '#e6f1fa', stroke: '#9cc4de', text: '#0a5a93' },
  shop: { fill: '#fdecd3', stroke: '#f0c48a', text: '#8a4f08' },
  amenity: { fill: '#eef2f7', stroke: '#cbd5e1', text: '#334155' },
  seating: { fill: '#f0f7fc', stroke: '#b7d4ea', text: '#0a5a93' },
  restroom: { fill: '#f1f5f9', stroke: '#cbd5e1', text: '#475569' },
  blocked: { fill: '#e2e8f0', stroke: '#94a3b8', text: '#475569' },
}

const MARGIN = 4 // feet around the room, for door labels and the scale bar
const WALL = 0.4

export type PickKind = 'run' | 'area' | 'door'

/** Where a door sits on its wall, as a rectangle over the wall line. */
function doorRect(room: Room, wall: Side, at: number, width: number) {
  switch (wall) {
    case 'top':
      return { x: at, y: -WALL, w: width, h: WALL * 2 }
    case 'bottom':
      return { x: at, y: room.depth - WALL, w: width, h: WALL * 2 }
    case 'left':
      return { x: -WALL, y: at, w: WALL * 2, h: width }
    case 'right':
      return { x: room.width - WALL, y: at, w: WALL * 2, h: width }
  }
}

/** The edge of a block on its customer side. */
function frontLine(b: { x: number; y: number; w: number; h: number }, front: Side) {
  switch (front) {
    case 'top':
      return { x1: b.x, y1: b.y, x2: b.x + b.w, y2: b.y }
    case 'bottom':
      return { x1: b.x, y1: b.y + b.h, x2: b.x + b.w, y2: b.y + b.h }
    case 'left':
      return { x1: b.x, y1: b.y, x2: b.x, y2: b.y + b.h }
    case 'right':
      return { x1: b.x + b.w, y1: b.y, x2: b.x + b.w, y2: b.y + b.h }
  }
}

function onKey(fn?: () => void) {
  return (e: KeyboardEvent<SVGGElement>) => {
    if (fn && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      fn()
    }
  }
}

/** A label that fits its box, rotated to run along a tall, thin one. */
function FitText({
  x,
  y,
  w,
  h,
  text,
  size,
  color,
  weight = 700,
  maxLines = 3,
}: {
  x: number
  y: number
  w: number
  h: number
  text: string
  size: number
  color: string
  weight?: number
  maxLines?: number
}) {
  const vertical = h > w * 1.6
  const along = vertical ? h : w
  const across = vertical ? w : h
  const lines = fitLines(text, along - size * 0.6, size, Math.max(1, Math.min(maxLines, Math.floor(across / (size * 1.25)))))
  if (lines.length === 0) return null
  const cx = x + w / 2
  const cy = y + h / 2
  const lineH = size * 1.2
  const start = -((lines.length - 1) * lineH) / 2
  return (
    <text
      transform={vertical ? `rotate(-90 ${cx} ${cy})` : undefined}
      fill={color}
      fontSize={size}
      fontWeight={weight}
      textAnchor="middle"
      style={{ pointerEvents: 'none' }}
    >
      {lines.map((l, i) => (
        <tspan key={i} x={cx} y={cy + start + i * lineH + size * 0.36}>
          {l}
        </tspan>
      ))}
    </text>
  )
}

export function VenuePlan({
  room,
  blocks,
  selectedTable,
  onSelectBlock,
  pick,
  onPick,
  colors = DEFAULT_TABLE_COLORS,
  label,
}: {
  room: Room
  blocks: Block[]
  selectedTable?: number
  onSelectBlock?: (b: Block) => void
  /** The designer's current selection, outlined. */
  pick?: { kind: PickKind; id: string } | null
  /** The designer: tap a row, area or door to edit it. */
  onPick?: (kind: PickKind, id: string) => void
  colors?: TableColors
  label: string
}) {
  const W = room.width + MARGIN * 2
  const H = room.depth + MARGIN * 2
  const here = blocks.filter((b) => b.roomId === room.id)
  const designing = !!onPick
  const picked = (kind: PickKind, id: string) => pick?.kind === kind && pick.id === id

  return (
    <svg
      viewBox={`${-MARGIN} ${-MARGIN} ${W} ${H}`}
      className="block w-full"
      role="group"
      aria-label={label}
      style={{ fontFamily: '"Open Sans", "Segoe UI", Arial, sans-serif' }}
    >
      <defs>
        <pattern id={`hatch-${room.id}`} width="1.4" height="1.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="1.4" stroke="#94a3b8" strokeWidth="0.35" />
        </pattern>
      </defs>

      {/* floor and walls */}
      <rect x={0} y={0} width={room.width} height={room.depth} fill="#fbfcfd" stroke="#64748b" strokeWidth={WALL} />

      {/* fixed areas */}
      {room.areas.map((a) => {
        const s = AREA_STYLE[a.kind]
        const sel = picked('area', a.id)
        return (
          <g
            key={a.id}
            role={designing ? 'button' : undefined}
            tabIndex={designing ? 0 : undefined}
            aria-label={designing ? `Edit ${a.label || 'area'}` : undefined}
            onClick={designing ? () => onPick('area', a.id) : undefined}
            onKeyDown={onKey(designing ? () => onPick('area', a.id) : undefined)}
            style={designing ? { cursor: 'pointer' } : undefined}
          >
            <rect
              x={a.x}
              y={a.y}
              width={a.w}
              height={a.h}
              rx={0.5}
              fill={a.kind === 'blocked' ? `url(#hatch-${room.id})` : s.fill}
              stroke={sel ? '#eb891c' : s.stroke}
              strokeWidth={sel ? 0.6 : 0.2}
            />
            {a.kind === 'seating' &&
              Array.from({ length: Math.max(0, Math.min(12, Math.floor(a.w / 7) * Math.floor(a.h / 7))) }).map((_, i) => {
                const cols = Math.max(1, Math.floor(a.w / 7))
                return (
                  <circle
                    key={i}
                    cx={a.x + 3.5 + (i % cols) * 7}
                    cy={a.y + 3.5 + Math.floor(i / cols) * 7}
                    r={1.3}
                    fill="none"
                    stroke="#9cc4de"
                    strokeWidth={0.25}
                  />
                )
              })}
            {a.label && <FitText x={a.x} y={a.y} w={a.w} h={a.h} text={a.label} size={1.7} color={s.text} />}
          </g>
        )
      })}

      {/* doors: a gap in the wall, and the label outside it */}
      {room.doors.map((d) => {
        const r = doorRect(room, d.wall, d.at, d.width)
        const sel = picked('door', d.id)
        const lx = d.wall === 'left' ? -0.6 : d.wall === 'right' ? room.width + 0.6 : d.at + d.width / 2
        const ly = d.wall === 'top' ? -1.2 : d.wall === 'bottom' ? room.depth + 2.2 : d.at + d.width / 2
        return (
          <g
            key={d.id}
            role={designing ? 'button' : undefined}
            tabIndex={designing ? 0 : undefined}
            aria-label={designing ? `Edit ${d.label || 'door'}` : undefined}
            onClick={designing ? () => onPick('door', d.id) : undefined}
            onKeyDown={onKey(designing ? () => onPick('door', d.id) : undefined)}
            style={designing ? { cursor: 'pointer' } : undefined}
          >
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={sel ? '#eb891c' : '#ffffff'} />
            <text
              x={lx}
              y={ly}
              fontSize={1.5}
              fontWeight={800}
              fill="#475569"
              textAnchor={d.wall === 'left' ? 'end' : d.wall === 'right' ? 'start' : 'middle'}
              dominantBaseline={d.wall === 'left' || d.wall === 'right' ? 'central' : undefined}
              transform={
                d.wall === 'left' || d.wall === 'right' ? `rotate(${d.wall === 'left' ? -90 : 90} ${lx} ${ly})` : undefined
              }
              style={{ pointerEvents: 'none' }}
            >
              {d.label}
            </text>
          </g>
        )
      })}

      {/* the designer: tap a whole row to edit it */}
      {designing &&
        room.runs.map((r) => {
          const b = runBox(r)
          const sel = picked('run', r.id)
          return (
            <rect
              key={`pick-${r.id}`}
              x={b.x - 0.6}
              y={b.y - 0.6}
              width={b.w + 1.2}
              height={b.h + 1.2}
              rx={0.6}
              fill={sel ? '#eb891c22' : 'transparent'}
              stroke={sel ? '#eb891c' : 'transparent'}
              strokeWidth={0.5}
              strokeDasharray={sel ? '1 0.6' : undefined}
              style={{ cursor: 'pointer' }}
              role="button"
              tabIndex={0}
              aria-label="Edit this row of tables"
              onClick={() => onPick('run', r.id)}
              onKeyDown={onKey(() => onPick('run', r.id))}
            />
          )
        })}

      {/* tables */}
      {here.map((b) => {
        const nums = formatNumbers(b.numbers)
        const isSel = selectedTable !== undefined && b.numbers.includes(selectedTable)
        const h = b.holder
        const c = h ? colorOf(h, colors) : '#94a3b8'
        const front = frontLine(b, b.front)
        const clickable = !!onSelectBlock && !designing
        const text = h ? `${nums} · ${holderLabel(h)}` : nums
        return (
          <g
            key={nums}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            aria-label={`${b.numbers.length > 1 ? 'Tables' : 'Table'} ${nums}, ${holderLabel(h)}`}
            onClick={clickable ? () => onSelectBlock(b) : undefined}
            onKeyDown={onKey(clickable ? () => onSelectBlock(b) : undefined)}
            style={{ cursor: clickable ? 'pointer' : undefined, pointerEvents: designing ? 'none' : undefined }}
          >
            <title>{h ? `${nums} · ${holderLabel(h)}` : `Table ${nums} · free`}</title>
            <rect
              x={b.x + 0.08}
              y={b.y + 0.08}
              width={b.w - 0.16}
              height={b.h - 0.16}
              rx={0.25}
              fill={h ? c : '#ffffff'}
              fillOpacity={h ? (isSel ? 0.35 : 0.16) : 1}
              stroke={isSel ? '#0f172a' : h ? c : '#cbd5e1'}
              strokeWidth={isSel ? 0.45 : 0.15}
              strokeDasharray={h || isSel ? undefined : '0.5 0.35'}
            />
            <line {...front} stroke={h ? c : '#94a3b8'} strokeWidth={0.45} strokeLinecap="round" />
            <FitText x={b.x} y={b.y} w={b.w} h={b.h} text={text} size={1.15} color={h ? '#0f172a' : '#64748b'} weight={h ? 700 : 600} maxLines={2} />
          </g>
        )
      })}

      {/* scale bar */}
      <g transform={`translate(0 ${room.depth + 2.4})`} style={{ pointerEvents: 'none' }}>
        <line x1={0} y1={0} x2={10} y2={0} stroke="#64748b" strokeWidth={0.3} />
        <line x1={0} y1={-0.5} x2={0} y2={0.5} stroke="#64748b" strokeWidth={0.3} />
        <line x1={10} y1={-0.5} x2={10} y2={0.5} stroke="#64748b" strokeWidth={0.3} />
        <text x={11} y={0.5} fontSize={1.4} fill="#64748b" fontWeight={700}>
          10 ft
        </text>
      </g>
    </svg>
  )
}

/**
 * Zoom for a phone: a to-scale room is too small to read at phone width, so
 * the drawing can be enlarged and scrolled. Buttons, not pinch, so it works
 * the same for everyone.
 */
export function ZoomBox({ children, initial = 1 }: { children: ReactNode; initial?: number }) {
  const [zoom, setZoom] = useState(initial)
  const steps = [1, 1.5, 2, 3]
  const i = steps.indexOf(zoom)
  return (
    <div className="space-y-1.5">
      <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
        <div style={{ width: `${zoom * 100}%` }}>{children}</div>
      </div>
      <div className="flex items-center justify-end gap-2">
        {zoom === 1 && <span className="mr-auto text-xs text-slate-500">Zoom in to read the names</span>}
        <button
          type="button"
          onClick={() => setZoom(steps[Math.max(0, i - 1)])}
          disabled={i <= 0}
          aria-label="Zoom out"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-xl font-bold text-slate-600 disabled:opacity-40"
        >
          −
        </button>
        <span className="w-12 text-center text-sm font-bold text-slate-600">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={() => setZoom(steps[Math.min(steps.length - 1, i + 1)])}
          disabled={i >= steps.length - 1}
          aria-label="Zoom in"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-xl font-bold text-slate-600 disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  )
}
