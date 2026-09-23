// Staff → BunFest → Floor plan → Design the venue.
//
// Next year may be a different building with a different number of rooms, so
// the venue is designed here rather than written into the app: rooms with a
// size, rows of tables in them, the fixed areas (stage, spa, restrooms …) and
// the doors. Everything is in feet from the room's left and top walls, typed
// or nudged, with the room drawn to scale underneath. Tap anything in the
// drawing to edit it.
//
// It's a form, not a drag-and-drop canvas, on purpose: it works the same on a
// phone and a laptop, and a row lands exactly where it's typed.
import { useMemo, useState } from 'react'
import { errMessage } from '../../../lib/supabase'
import { Card, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { FormError, staffInput } from '../../../components/staffui'
import { saveVenue } from '../api'
import {
  AREA_KINDS,
  checkVenue,
  duplicateRun,
  newId,
  newRoom,
  newRun,
  placeTables,
  buildBlocks,
  roomRanges,
  runRanges,
  totalTables,
  type Area,
  type AreaKind,
  type Door,
  type Room,
  type Side,
  type TableRun,
  type Venue,
} from '../floor'
import { VenuePlan, ZoomBox, type PickKind } from '../VenuePlan'

type Pick = { kind: PickKind; id: string } | null

/** A typed number with big − / + either side (typing always works too). */
function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 1000,
  hint,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  step?: number
  min?: number
  max?: number
  hint?: string
}) {
  const [text, setText] = useState<string | null>(null)
  const clamp = (n: number) => Math.max(min, Math.min(max, Math.round(n * 2) / 2))
  const shown = text ?? String(value)
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <span className="mt-1 flex items-center gap-1.5">
        <button
          type="button"
          aria-label={`${label}: less`}
          onClick={() => onChange(clamp(value - step))}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-bold text-slate-600"
        >
          −
        </button>
        <input
          className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2 text-center font-display text-base font-extrabold text-ink outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
          inputMode="decimal"
          value={shown}
          onChange={(e) => {
            setText(e.target.value)
            const n = Number(e.target.value)
            if (e.target.value.trim() !== '' && Number.isFinite(n)) onChange(clamp(n))
          }}
          onBlur={() => setText(null)}
        />
        <button
          type="button"
          aria-label={`${label}: more`}
          onClick={() => onChange(clamp(value + step))}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-bold text-slate-600"
        >
          +
        </button>
      </span>
      {hint && <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span>}
    </label>
  )
}

/** Two or more big choices, one of them on. */
function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: [T, string][]
  onChange: (v: T) => void
}) {
  return (
    <div>
      <span className="block text-sm font-semibold text-slate-700">{label}</span>
      <div className="mt-1 flex gap-2">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={`min-h-[44px] flex-1 rounded-full px-2 text-sm font-bold ${
              value === v ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600'
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function StaffVenue({
  orgId,
  year,
  venue,
  saved,
  hasAssignments,
  startOptions,
  onChange,
  onSaved,
}: {
  orgId: string
  year: number
  /** What's being edited; null until a starting point is chosen. */
  venue: Venue | null
  /** What's in the database, for Undo and "unsaved changes". */
  saved: Venue | null
  hasAssignments: boolean
  /** Ways to start a year that has no venue yet. */
  startOptions: { label: string; hint: string; venue: () => Promise<Venue> | Venue }[]
  onChange: (v: Venue | null) => void
  onSaved: () => Promise<void>
}) {
  const [roomId, setRoomId] = useState<string | null>(venue?.rooms[0]?.id ?? null)
  const [tab, setTab] = useState<PickKind>('run')
  const [pick, setPick] = useState<Pick>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const room = venue?.rooms.find((r) => r.id === roomId) ?? venue?.rooms[0] ?? null
  const check = useMemo(() => (venue ? checkVenue(venue) : { errors: [], warnings: [] }), [venue])
  const blocks = useMemo(() => (venue ? buildBlocks(placeTables(venue), []) : []), [venue])
  const rRanges = useMemo(() => (venue ? runRanges(venue) : new Map<string, [number, number]>()), [venue])
  const roomRange = venue && room ? roomRanges(venue).get(room.id) : null
  const dirty = !!venue && JSON.stringify(venue) !== JSON.stringify(saved)

  /* ------------------------------------------------ editing helpers */

  const setRoom = (id: string, patch: Partial<Room>) =>
    venue && onChange({ ...venue, rooms: venue.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)) })

  const setItem = <K extends 'runs' | 'areas' | 'doors'>(key: K, id: string, patch: Partial<Room[K][number]>) =>
    room && setRoom(room.id, { [key]: (room[key] as Room[K]).map((x) => (x.id === id ? { ...x, ...patch } : x)) } as Partial<Room>)

  const addItem = <K extends 'runs' | 'areas' | 'doors'>(key: K, item: Room[K][number]) => {
    if (!room) return
    setRoom(room.id, { [key]: [...(room[key] as Room[K]), item] } as Partial<Room>)
    setTab(key === 'runs' ? 'run' : key === 'areas' ? 'area' : 'door')
    setPick({ kind: key === 'runs' ? 'run' : key === 'areas' ? 'area' : 'door', id: item.id })
  }

  const removeItem = (key: 'runs' | 'areas' | 'doors', id: string) => {
    if (!room) return
    setRoom(room.id, { [key]: (room[key] as { id: string }[]).filter((x) => x.id !== id) } as Partial<Room>)
    setPick(null)
  }

  const moveRoom = (id: string, by: -1 | 1) => {
    if (!venue) return
    const i = venue.rooms.findIndex((r) => r.id === id)
    const j = i + by
    if (j < 0 || j >= venue.rooms.length) return
    const rooms = [...venue.rooms]
    ;[rooms[i], rooms[j]] = [rooms[j], rooms[i]]
    onChange({ ...venue, rooms })
  }

  const save = async () => {
    if (!venue) return
    setBusy(true)
    setError(null)
    try {
      await saveVenue(orgId, year, venue.name, venue)
      await onSaved()
    } catch (e) {
      setError(errMessage(e))
    }
    setBusy(false)
  }

  /* ------------------------------------------------ no venue yet */

  if (!venue) {
    return (
      <Card className="space-y-3">
        <div>
          <h2 className="font-display text-[15px] font-extrabold text-ink">Start the {year} floor plan</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Nothing is designed for {year} yet. Start from a venue you’ve used before and change what’s
            different, or start with an empty room.
          </p>
        </div>
        {startOptions.map((o) => (
          <button
            key={o.label}
            type="button"
            disabled={starting}
            onClick={async () => {
              setStarting(true)
              try {
                const v = await o.venue()
                onChange(v)
                setRoomId(v.rooms[0]?.id ?? null)
              } catch (e) {
                setError(errMessage(e))
              }
              setStarting(false)
            }}
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left hover:bg-slate-50 disabled:opacity-60"
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-blue-50 text-brand-blue">
              <Icon name="mappin" size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-ink">{o.label}</span>
              <span className="block text-xs text-slate-500">{o.hint}</span>
            </span>
            <Icon name="chevron" size={18} className="shrink-0 text-slate-300" />
          </button>
        ))}
        <FormError>{error}</FormError>
      </Card>
    )
  }

  const selRun = pick?.kind === 'run' ? room?.runs.find((r) => r.id === pick.id) : undefined
  const selArea = pick?.kind === 'area' ? room?.areas.find((a) => a.id === pick.id) : undefined
  const selDoor = pick?.kind === 'door' ? room?.doors.find((d) => d.id === pick.id) : undefined

  return (
    <div className="space-y-3">
      {/* ------------------------------------------------ the venue */}
      <Card className="space-y-3">
        <label className="block text-sm font-semibold text-slate-700">
          Venue
          <input className={staffInput} value={venue.name} onChange={(e) => onChange({ ...venue, name: e.target.value })} placeholder="The Makoy" />
        </label>
        <div>
          <span className="block text-sm font-semibold text-slate-700">Rooms</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {venue.rooms.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setRoomId(r.id)
                  setPick(null)
                }}
                className={`min-h-[44px] rounded-full px-4 text-sm font-bold ${
                  room?.id === r.id ? 'bg-ink text-white' : 'border border-slate-200 bg-white text-slate-600'
                }`}
              >
                {r.name || 'Unnamed room'}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                const r = newRoom(`Room ${venue.rooms.length + 1}`)
                onChange({ ...venue, rooms: [...venue.rooms, r] })
                setRoomId(r.id)
                setPick(null)
              }}
              className="min-h-[44px] rounded-full border border-dashed border-slate-300 px-4 text-sm font-bold text-brand-blue"
            >
              + Add a room
            </button>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-slate-500">
          Tables are numbered room by room in this order, row by row — {totalTables(venue)} tables in all.
        </p>
      </Card>

      {room && (
        <>
          {/* ------------------------------------------------ the room */}
          <Card className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700">
              Room name
              <input className={staffInput} value={room.name} onChange={(e) => setRoom(room.id, { name: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Width (ft)" value={room.width} min={5} step={2} onChange={(width) => setRoom(room.id, { width })} hint="left to right" />
              <NumberField label="Depth (ft)" value={room.depth} min={5} step={2} onChange={(depth) => setRoom(room.id, { depth })} hint="top to bottom" />
            </div>
            <label className="block text-sm font-semibold text-slate-700">
              A line for visitors (optional)
              <input className={staffInput} value={room.note} onChange={(e) => setRoom(room.id, { note: e.target.value })} placeholder="Stairs up to the education sessions" />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => moveRoom(room.id, -1)} className={`${btn.outline} !px-3 !py-2 text-xs`}>
                Move earlier
              </button>
              <button type="button" onClick={() => moveRoom(room.id, 1)} className={`${btn.outline} !px-3 !py-2 text-xs`}>
                Move later
              </button>
              {venue.rooms.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    onChange({ ...venue, rooms: venue.rooms.filter((r) => r.id !== room.id) })
                    setRoomId(null)
                    setPick(null)
                  }}
                  className="rounded-full border border-red-200 px-3 py-2 text-xs font-bold text-red-600"
                >
                  Remove this room
                </button>
              )}
            </div>
          </Card>

          {/* ------------------------------------------------ the drawing */}
          <div className="space-y-1">
            <p className="px-1 text-xs font-bold text-slate-500">
              {room.name}
              {roomRange ? ` · tables ${roomRange[0]}–${roomRange[1]}` : ' · no tables yet'} · tap anything to edit it
            </p>
            <ZoomBox>
              <VenuePlan
                room={room}
                blocks={blocks}
                pick={pick}
                onPick={(kind, id) => {
                  setTab(kind)
                  setPick({ kind, id })
                }}
                label={`${room.name} design`}
              />
            </ZoomBox>
          </div>

          {/* ------------------------------------------------ what's in it */}
          <Card className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['run', `Tables · ${room.runs.length}`],
                  ['area', `Areas · ${room.areas.length}`],
                  ['door', `Doors · ${room.doors.length}`],
                ] as [PickKind, string][]
              ).map(([k, text]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setTab(k)
                    setPick(null)
                  }}
                  className={`min-h-[44px] rounded-full text-sm font-bold ${
                    tab === k ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {text}
                </button>
              ))}
            </div>

            {tab === 'run' && (
              <div className="space-y-2">
                {room.runs.map((r, i) => {
                  const [a, z] = rRanges.get(r.id) ?? [0, 0]
                  const open = selRun?.id === r.id
                  return (
                    <div key={r.id} className={`rounded-xl border ${open ? 'border-brand-orange' : 'border-slate-200'}`}>
                      <button
                        type="button"
                        onClick={() => setPick(open ? null : { kind: 'run', id: r.id })}
                        className="flex min-h-[48px] w-full items-center justify-between gap-2 px-3 text-left"
                      >
                        <span className="text-sm font-bold text-ink">
                          Row {i + 1} · tables {a}–{z}
                        </span>
                        <span className="text-xs text-slate-500">
                          {r.tables} × {r.length} ft {r.across ? '→' : '↓'}
                        </span>
                      </button>
                      {open && (
                        <RunEditor
                          run={r}
                          onChange={(patch) => setItem('runs', r.id, patch)}
                          onDuplicate={() => addItem('runs', duplicateRun(r))}
                          onDelete={() => removeItem('runs', r.id)}
                        />
                      )}
                    </div>
                  )
                })}
                <button type="button" onClick={() => addItem('runs', newRun(room))} className={`${btn.outline} w-full`}>
                  <Icon name="plus" size={16} /> Add a row of tables
                </button>
              </div>
            )}

            {tab === 'area' && (
              <div className="space-y-2">
                {room.areas.map((a) => {
                  const open = selArea?.id === a.id
                  return (
                    <div key={a.id} className={`rounded-xl border ${open ? 'border-brand-orange' : 'border-slate-200'}`}>
                      <button
                        type="button"
                        onClick={() => setPick(open ? null : { kind: 'area', id: a.id })}
                        className="flex min-h-[48px] w-full items-center justify-between gap-2 px-3 text-left"
                      >
                        <span className="text-sm font-bold text-ink">{a.label || 'Unnamed area'}</span>
                        <span className="text-xs text-slate-500">{AREA_KINDS.find((k) => k.value === a.kind)?.label}</span>
                      </button>
                      {open && <AreaEditor area={a} onChange={(patch) => setItem('areas', a.id, patch)} onDelete={() => removeItem('areas', a.id)} />}
                    </div>
                  )
                })}
                <button
                  type="button"
                  onClick={() => addItem('areas', { id: newId('area'), label: 'New area', kind: 'amenity', x: 4, y: 4, w: 12, h: 8 })}
                  className={`${btn.outline} w-full`}
                >
                  <Icon name="plus" size={16} /> Add an area
                </button>
                <p className="text-xs leading-relaxed text-slate-500">
                  An odd-shaped room? Draw it as a rectangle and add a “Not part of the room” area over the
                  corner that isn’t there.
                </p>
              </div>
            )}

            {tab === 'door' && (
              <div className="space-y-2">
                {room.doors.map((d) => {
                  const open = selDoor?.id === d.id
                  return (
                    <div key={d.id} className={`rounded-xl border ${open ? 'border-brand-orange' : 'border-slate-200'}`}>
                      <button
                        type="button"
                        onClick={() => setPick(open ? null : { kind: 'door', id: d.id })}
                        className="flex min-h-[48px] w-full items-center justify-between gap-2 px-3 text-left"
                      >
                        <span className="text-sm font-bold text-ink">{d.label || 'Door'}</span>
                        <span className="text-xs text-slate-500">{WALL_NAMES[d.wall]} wall</span>
                      </button>
                      {open && <DoorEditor door={d} room={room} onChange={(patch) => setItem('doors', d.id, patch)} onDelete={() => removeItem('doors', d.id)} />}
                    </div>
                  )
                })}
                <button
                  type="button"
                  onClick={() => addItem('doors', { id: newId('door'), label: 'Entrance', wall: 'bottom', at: Math.max(0, room.width / 2 - 3), width: 6 })}
                  className={`${btn.outline} w-full`}
                >
                  <Icon name="plus" size={16} /> Add a door
                </button>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ------------------------------------------------ check and save */}
      {(check.errors.length > 0 || check.warnings.length > 0) && (
        <Card className="space-y-1.5">
          {check.errors.map((e) => (
            <p key={e} className="flex gap-2 text-sm font-semibold text-red-700">
              <Icon name="info" size={16} className="mt-0.5 shrink-0" /> {e}
            </p>
          ))}
          {check.warnings.map((w) => (
            <p key={w} className="flex gap-2 text-sm text-amber-800">
              <Icon name="info" size={16} className="mt-0.5 shrink-0" /> {w}
            </p>
          ))}
        </Card>
      )}

      <Card className="space-y-2">
        {hasAssignments && dirty && (
          <p className="text-xs leading-relaxed text-amber-800">
            Tables are already given out for {year}. Adding, removing or reordering rows renumbers the
            tables after the change — check “Who sits where” after saving.
          </p>
        )}
        <FormError>{error}</FormError>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={busy || check.errors.length > 0 || (!dirty && !!saved)}
            className={`${btn.primary} flex-1 disabled:opacity-60`}
          >
            {busy ? 'Saving…' : saved ? (dirty ? 'Save the venue' : 'Saved') : 'Save this venue'}
          </button>
          {dirty && saved && (
            <button type="button" onClick={() => onChange(saved)} className={`${btn.outline} shrink-0`}>
              Undo changes
            </button>
          )}
        </div>
      </Card>
    </div>
  )
}

const WALL_NAMES: Record<Side, string> = { top: 'Top', bottom: 'Bottom', left: 'Left', right: 'Right' }

function RunEditor({
  run,
  onChange,
  onDuplicate,
  onDelete,
}: {
  run: TableRun
  onChange: (patch: Partial<TableRun>) => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  // Turning a row round keeps customers on the matching side.
  const turn = (across: boolean) =>
    onChange({
      across,
      front: across ? (run.front === 'left' ? 'top' : run.front === 'right' ? 'bottom' : run.front) : run.front === 'top' ? 'left' : run.front === 'bottom' ? 'right' : run.front,
    })
  return (
    <div className="space-y-3 border-t border-slate-100 p-3">
      <NumberField label="Tables in this row" value={run.tables} min={1} max={40} onChange={(tables) => onChange({ tables: Math.round(tables) })} />
      <Choice label="The row runs" value={run.across ? 'across' : 'down'} options={[['across', 'Left to right'], ['down', 'Top to bottom']]} onChange={(v) => turn(v === 'across')} />
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="From the left wall (ft)" value={run.x} step={0.5} onChange={(x) => onChange({ x })} />
        <NumberField label="From the top wall (ft)" value={run.y} step={0.5} onChange={(y) => onChange({ y })} />
      </div>
      {run.across ? (
        <Choice label="Customers stand" value={run.front === 'top' ? 'top' : 'bottom'} options={[['top', 'Above'], ['bottom', 'Below']]} onChange={(front) => onChange({ front })} />
      ) : (
        <Choice label="Customers stand" value={run.front === 'left' ? 'left' : 'right'} options={[['left', 'On the left'], ['right', 'On the right']]} onChange={(front) => onChange({ front })} />
      )}
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Table length (ft)" value={run.length} min={2} max={20} step={0.5} onChange={(length) => onChange({ length })} hint="8 ft is a standard banquet table" />
        <NumberField label="Table depth (ft)" value={run.depth} min={1} max={8} step={0.5} onChange={(depth) => onChange({ depth })} hint="usually 2.5 ft" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Walkway after every" value={run.walkEvery} min={0} max={40} onChange={(walkEvery) => onChange({ walkEvery: Math.round(walkEvery) })} hint={run.walkEvery ? `${run.walkEvery} tables` : 'no walkway'} />
        <NumberField label="Walkway width (ft)" value={run.walkWidth} min={2} max={30} step={0.5} onChange={(walkWidth) => onChange({ walkWidth })} />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onDuplicate} className={`${btn.outline} flex-1 !py-2 text-sm`}>
          Copy as the next row
        </button>
        <button type="button" onClick={onDelete} className="rounded-full border border-red-200 px-4 py-2 text-sm font-bold text-red-600">
          Delete
        </button>
      </div>
      <p className="text-xs leading-relaxed text-slate-500">
        “Copy as the next row” puts the copy facing this one across a 6 ft aisle, or back to back
        with it — the usual way rows pair up.
      </p>
    </div>
  )
}

function AreaEditor({ area, onChange, onDelete }: { area: Area; onChange: (patch: Partial<Area>) => void; onDelete: () => void }) {
  return (
    <div className="space-y-3 border-t border-slate-100 p-3">
      <label className="block text-sm font-semibold text-slate-700">
        Label
        <input className={staffInput} value={area.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="Bunny Spa" />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        What it is
        <select className={staffInput} value={area.kind} onChange={(e) => onChange({ kind: e.target.value as AreaKind })}>
          {AREA_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="From the left wall (ft)" value={area.x} step={0.5} onChange={(x) => onChange({ x })} />
        <NumberField label="From the top wall (ft)" value={area.y} step={0.5} onChange={(y) => onChange({ y })} />
        <NumberField label="Width (ft)" value={area.w} min={1} step={0.5} onChange={(w) => onChange({ w })} />
        <NumberField label="Depth (ft)" value={area.h} min={1} step={0.5} onChange={(h) => onChange({ h })} />
      </div>
      <button type="button" onClick={onDelete} className="w-full rounded-full border border-red-200 px-4 py-2 text-sm font-bold text-red-600">
        Delete this area
      </button>
    </div>
  )
}

function DoorEditor({ door, room, onChange, onDelete }: { door: Door; room: Room; onChange: (patch: Partial<Door>) => void; onDelete: () => void }) {
  const along = door.wall === 'top' || door.wall === 'bottom' ? 'from the left end' : 'from the top end'
  const wallLength = door.wall === 'top' || door.wall === 'bottom' ? room.width : room.depth
  return (
    <div className="space-y-3 border-t border-slate-100 p-3">
      <label className="block text-sm font-semibold text-slate-700">
        Label
        <input className={staffInput} value={door.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="Entrance" />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Which wall
        <select className={staffInput} value={door.wall} onChange={(e) => onChange({ wall: e.target.value as Side })}>
          {(['top', 'bottom', 'left', 'right'] as Side[]).map((w) => (
            <option key={w} value={w}>
              {WALL_NAMES[w]}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label={`Distance ${along} (ft)`} value={door.at} step={0.5} max={wallLength} onChange={(at) => onChange({ at })} />
        <NumberField label="Width (ft)" value={door.width} min={2} max={40} step={0.5} onChange={(width) => onChange({ width })} />
      </div>
      <button type="button" onClick={onDelete} className="w-full rounded-full border border-red-200 px-4 py-2 text-sm font-bold text-red-600">
        Delete this door
      </button>
    </div>
  )
}
