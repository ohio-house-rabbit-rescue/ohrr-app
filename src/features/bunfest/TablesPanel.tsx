// Draws one room's tables: free tables numbered, each stand's side-by-side
// tables as one block with the name once. Used by the public map and by the
// staff screen's live preview, so what staff see is exactly what visitors get.
//
// Depends only on React and ./floor, so the website and the BunFest site keep
// identical copies.
import type { KeyboardEvent } from 'react'
import {
  fitLines,
  formatNumbers,
  layoutRoom,
  type Block,
  type NumberedRow,
  type RoomId,
  type TableAssignment,
} from './floor'

/** Readable on any fill: tinted background, coloured edge, dark text. */
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

function colorOf(h: TableAssignment, colors: TableColors): string {
  if (h.kind === 'rescue') return colors.rescue
  if (h.kind === 'other') return colors.other
  return colors.vendor(h.category)
}

export function holderLabel(h: TableAssignment | null): string {
  if (!h) return 'Free'
  return h.name ?? 'Reserved'
}

export function TablesPanel({
  room,
  rows,
  blocks,
  selected,
  onSelect,
  colors = DEFAULT_TABLE_COLORS,
  label,
}: {
  room: RoomId
  rows: NumberedRow[]
  blocks: Block[]
  /** A table number in the selected block. */
  selected?: number
  onSelect?: (block: Block) => void
  colors?: TableColors
  label: string
}) {
  const { width, height, placed } = layoutRoom(rows, blocks, room)
  if (placed.length === 0) return null

  const key = (b: Block) => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect?.(b)
    }
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="group" aria-label={label}>
      {placed.map(({ block: b, x, y, w, h }) => {
        const nums = formatNumbers(b.numbers)
        const isSel = selected !== undefined && b.numbers.includes(selected)
        const holder = b.holder

        if (!holder) {
          return (
            <g
              key={nums}
              role={onSelect ? 'button' : undefined}
              tabIndex={onSelect ? 0 : undefined}
              aria-label={`Table ${nums}, free`}
              onClick={onSelect ? () => onSelect(b) : undefined}
              onKeyDown={onSelect ? key(b) : undefined}
              style={onSelect ? { cursor: 'pointer' } : undefined}
            >
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx={3}
                fill="#ffffff"
                stroke={isSel ? '#0f172a' : '#cbd5e1'}
                strokeWidth={isSel ? 2 : 1}
                strokeDasharray={isSel ? undefined : '3 2'}
              />
              <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="central" fill="#94a3b8" fontSize={9} fontWeight={700}>
                {nums}
              </text>
            </g>
          )
        }

        const c = colorOf(holder, colors)
        const name = holderLabel(holder)
        const fs = 7.2
        const lines = fitLines(name, w - 6, fs, 3)
        const top = y + 13 + (h - 13 - lines.length * (fs + 1.6)) / 2

        return (
          <g
            key={nums}
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : undefined}
            aria-label={`${b.numbers.length > 1 ? 'Tables' : 'Table'} ${nums}, ${name}`}
            onClick={onSelect ? () => onSelect(b) : undefined}
            onKeyDown={onSelect ? key(b) : undefined}
            style={onSelect ? { cursor: 'pointer' } : undefined}
          >
            <title>{`${nums} · ${name}`}</title>
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              rx={3}
              fill={c}
              fillOpacity={isSel ? 0.3 : 0.14}
              stroke={isSel ? '#0f172a' : c}
              strokeWidth={isSel ? 2.2 : 1.2}
            />
            <text x={x + 4} y={y + 8.5} fill={c} fontSize={7} fontWeight={900}>
              {nums}
            </text>
            <text fill="#0f172a" fontSize={fs} fontWeight={700} textAnchor="middle">
              {lines.map((l, i) => (
                <tspan key={i} x={x + w / 2} y={top + i * (fs + 1.6) + fs * 0.8}>
                  {l}
                </tspan>
              ))}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
