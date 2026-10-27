// Staff → Home screen: the big cards at the top of the app's home screen (and
// the website's home page — one `hero_slides` table feeds both).
//
// The website's staff area could already edit these; the phone couldn't, so a
// volunteer with only a phone couldn't change what the app opens on. Same rows,
// same rules, laid out for a thumb.
import { useCallback, useEffect, useState } from 'react'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Badge, Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { StaffTitle, Explain } from '../components/StaffTitle'
import { Spinner, FormError, staffInput } from '../components/staffui'
import { CardActions, EditorForm, Field, Part, StepButton, pill } from '../components/StaffJob'
import StaffImageField from '../components/StaffImageField'
import { slideVisual } from '../data/heroSlides'

type Placement = 'hero' | 'featured' | 'happening'

interface Row {
  id: string
  placement: Placement
  headline: string
  subline: string | null
  image_url: string | null
  cta_label: string | null
  cta_url: string | null
  starts_at: string | null
  ends_at: string | null
  is_published: boolean
  sort_order: number
}

interface Draft {
  placement: Placement
  headline: string
  subline: string
  image_url: string
  cta_label: string
  cta_url: string
  starts_at: string
  ends_at: string
  is_published: boolean
  sort_order: string
}

const empty = (placement: Placement): Draft => ({
  placement,
  headline: '',
  subline: '',
  image_url: '',
  cta_label: '',
  cta_url: '',
  starts_at: '',
  ends_at: '',
  is_published: true,
  sort_order: '0',
})

// ISO (UTC) ⟷ the browser's datetime-local value (local time, no seconds).
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function toIso(local: string): string | null {
  if (!local) return null
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function fromRow(r: Row): Draft {
  return {
    placement: r.placement,
    headline: r.headline,
    subline: r.subline ?? '',
    image_url: r.image_url ?? '',
    cta_label: r.cta_label ?? '',
    cta_url: r.cta_url ?? '',
    starts_at: toLocalInput(r.starts_at),
    ends_at: toLocalInput(r.ends_at),
    is_published: r.is_published,
    sort_order: String(r.sort_order),
  }
}

function toRow(d: Draft) {
  return {
    placement: d.placement,
    headline: d.headline.trim(),
    subline: d.subline.trim() || null,
    image_url: d.image_url.trim() || null,
    cta_label: d.cta_label.trim() || null,
    cta_url: d.cta_url.trim() || null,
    starts_at: toIso(d.starts_at),
    ends_at: toIso(d.ends_at),
    is_published: d.is_published,
    sort_order: Number(d.sort_order) || 0,
  }
}

/** What the card's picture slot will show: the image, else its fixed icon. */
function Preview({ r }: { r: Row }) {
  const v = slideVisual({ imageUrl: r.image_url ?? undefined, ctaUrl: r.cta_url ?? undefined })
  if (v && 'image' in v) return <img src={v.image} alt="" className="h-full w-full object-cover" />
  return (
    <div className="flex h-full w-full items-center justify-center bg-brand-blue-50 text-brand-blue">
      <Icon name={v && 'icon' in v ? v.icon : 'home'} size={26} />
    </div>
  )
}

const newLabel: Record<Placement, string> = { hero: 'New big card', featured: 'New featured card', happening: 'New picture card' }

export default function StaffHomeScreen() {
  const { membership, user, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const userId = user?.id ?? ''
  const allowed = can('announcements.post')

  const [items, setItems] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState<Placement | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orgId || !allowed) return
    const { data, error } = await supabase
      .from('hero_slides')
      .select('id,placement,headline,subline,image_url,cta_label,cta_url,starts_at,ends_at,is_published,sort_order')
      .eq('org_id', orgId)
      .order('sort_order', { ascending: false })
    if (error) setError(errMessage(error))
    else setItems((data ?? []) as Row[])
  }, [orgId, allowed])
  useEffect(() => {
    void load()
  }, [load])

  if (!allowed) {
    return (
      <Screen>
        <Card className="text-base text-slate-600">Ask an owner or admin for access to post announcements.</Card>
      </Screen>
    )
  }

  const save = async (d: Draft, id?: string) => {
    const { error } = id
      ? await supabase.from('hero_slides').update(toRow(d)).eq('id', id)
      : await supabase.from('hero_slides').insert({ org_id: orgId, ...toRow(d) })
    if (error) throw error
    setCreating(null)
    setEditingId(null)
    await load()
  }

  const toggle = async (r: Row) => {
    setBusyId(r.id)
    setError(null)
    const { error } = await supabase.from('hero_slides').update({ is_published: !r.is_published }).eq('id', r.id)
    if (error) setError(errMessage(error))
    else await load()
    setBusyId(null)
  }

  // The list is in order, highest number first. Moving a card swaps it with its
  // neighbor and renumbers the group so no two share a number.
  const move = async (rows: Row[], i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= rows.length) return
    const next = rows.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    setBusyId(rows[i].id)
    setError(null)
    try {
      for (let k = 0; k < next.length; k++) {
        const want = next.length - k
        if (next[k].sort_order !== want) {
          const { error } = await supabase.from('hero_slides').update({ sort_order: want }).eq('id', next[k].id)
          if (error) throw error
        }
      }
      await load()
    } catch (err) {
      setError(errMessage(err))
    }
    setBusyId(null)
  }

  const groups: { key: Placement; title: string; hint: string }[] = [
    { key: 'hero', title: 'Big cards', hint: 'The swipeable cards at the top of Home. Up to 3; the first in this list shows first.' },
    { key: 'featured', title: 'Featured cards', hint: 'The row after them. Up to 4; the first in this list shows first.' },
    {
      key: 'happening',
      title: 'What’s happening (website)',
      hint: 'Picture cards on the website’s home page: news, fundraisers, events. Up to 4. Give each a picture; give an event an end date and its card hides itself afterwards.',
    },
  ]

  return (
    <Screen className="space-y-5">
      <StaffTitle title="Home screen">
        <p>
          What the app opens on, and the picture cards on the website’s home page. Leave a group empty and it shows the built-in cards.
        </p>
        <p>Use Move up and Move down to change which card shows first. Hide takes a card off without losing it. To remove one for good, tap Edit, then Remove.</p>
      </StaffTitle>

      <FormError>{error}</FormError>
      {items === null && !error && <Spinner />}

      {items !== null &&
        groups.map((g) => {
          const rows = items.filter((r) => r.placement === g.key)
          return (
            <section key={g.key} className="space-y-2.5">
              <div>
                <h2 className="font-display text-lg font-extrabold text-ink">{g.title}</h2>
                <Explain label="About this group" className="mt-1">
                  <p>{g.hint}</p>
                </Explain>
              </div>

              {creating === g.key ? (
                <SlideForm
                  heading={newLabel[g.key]}
                  initial={empty(g.key)}
                  userId={userId}
                  saveLabel="Add"
                  onSubmit={(d) => save(d)}
                  onCancel={() => setCreating(null)}
                />
              ) : (
                <StepButton tone="orange" icon="plus" onClick={() => setCreating(g.key)}>
                  {newLabel[g.key]}
                </StepButton>
              )}

              {rows.length === 0 && creating !== g.key && <p className="text-base text-slate-600">None yet — the built-in cards show.</p>}

              {rows.map((r, i) =>
                editingId === r.id ? (
                  <SlideForm
                    key={r.id}
                    heading="Edit this card"
                    initial={fromRow(r)}
                    userId={userId}
                    saveLabel="Save"
                    onSubmit={(d) => save(d, r.id)}
                    onCancel={() => setEditingId(null)}
                    onRemove={async () => {
                      const { error } = await supabase.from('hero_slides').delete().eq('id', r.id)
                      if (error) throw error
                      setEditingId(null)
                      await load()
                    }}
                  />
                ) : (
                  <Card key={r.id} className="space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
                        <Preview r={r} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-display text-base font-extrabold text-ink">{r.headline}</span>
                          {!r.is_published && <Badge tone="orange">Hidden</Badge>}
                        </span>
                        {r.subline && <span className="block text-sm text-slate-600">{r.subline}</span>}
                        {r.cta_url && <span className="block text-sm text-slate-500">Opens {r.cta_url}</span>}
                      </span>
                    </div>
                    <CardActions>
                      <button type="button" onClick={() => setEditingId(r.id)} className={pill.blue}>
                        Edit
                      </button>
                      <button type="button" onClick={() => void toggle(r)} disabled={busyId === r.id} className={pill.outline}>
                        {r.is_published ? 'Hide' : 'Show'}
                      </button>
                      <button type="button" onClick={() => void move(rows, i, -1)} disabled={busyId !== null || i === 0} className={pill.outline}>
                        Move up
                      </button>
                      <button type="button" onClick={() => void move(rows, i, 1)} disabled={busyId !== null || i === rows.length - 1} className={pill.outline}>
                        Move down
                      </button>
                    </CardActions>
                  </Card>
                ),
              )}
            </section>
          )
        })}
    </Screen>
  )
}

function SlideForm({
  heading,
  initial,
  userId,
  saveLabel,
  onSubmit,
  onCancel,
  onRemove,
}: {
  heading: string
  initial: Draft
  userId: string
  saveLabel: string
  onSubmit: (d: Draft) => Promise<void>
  onCancel: () => void
  onRemove?: () => Promise<void>
}) {
  const [d, setD] = useState<Draft>(initial)
  const [busy, setBusy] = useState(false)
  const [imageBusy, setImageBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const txt = (k: keyof Draft) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value })

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
    }
  }

  return (
    <EditorForm
      title={heading}
      hint="Cards show on the app’s home screen and the website’s home page."
      onSubmit={() => run(() => onSubmit(d))}
      onCancel={onCancel}
      busy={busy || imageBusy}
      saveLabel={saveLabel}
      canSave={!!d.headline.trim()}
      error={error}
      remove={onRemove ? { label: 'Remove', confirm: `Remove “${initial.headline}”? This can’t be undone.`, onRemove: () => run(onRemove) } : undefined}
    >
      <div className="space-y-3">
        <Part n="A" hint="needed">
          What it says
        </Part>
        <Field label="Headline" needed>
          <input className={staffInput} required value={d.headline} onChange={txt('headline')} placeholder="Midwest BunFest 2026 — Binky On!" />
        </Field>
        <Field label="One line under it">
          <textarea className={staffInput} rows={2} value={d.subline} onChange={txt('subline')} />
        </Field>
      </div>

      <div className="space-y-3">
        <Part n="B" hint="optional">
          Picture
        </Part>
        <StaffImageField
          label="Picture"
          hint="Leave it empty and the card shows its fixed icon — photos are for real content (a rabbit, an item, the BunFest logo)."
          value={d.image_url}
          userId={userId}
          onChange={(url) => setD({ ...d, image_url: url })}
          onBusyChange={setImageBusy}
        />
      </div>

      <div className="space-y-3">
        <Part n="C" hint="optional">
          Button
        </Part>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Button says">
            <input className={staffInput} value={d.cta_label} onChange={txt('cta_label')} placeholder="Enter BunFest" />
          </Field>
          <Field label="Opens">
            <input className={staffInput} value={d.cta_url} onChange={txt('cta_url')} placeholder="/bunfest" />
          </Field>
        </div>
      </div>

      <div className="space-y-3">
        <Part n="D" hint="optional">
          When it shows
        </Part>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Show from">
            <input type="datetime-local" className={staffInput} value={d.starts_at} onChange={txt('starts_at')} />
          </Field>
          <Field label="Show until">
            <input type="datetime-local" className={staffInput} value={d.ends_at} onChange={txt('ends_at')} />
          </Field>
        </div>
        <Field label="Order number (higher shows first)" hint="Or leave it and use Move up and Move down on the list.">
          <input inputMode="numeric" className={staffInput} value={d.sort_order} onChange={(e) => setD({ ...d, sort_order: e.target.value.replace(/[^0-9]/g, '') })} />
        </Field>
        <label className="flex min-h-[44px] items-center gap-3 text-base font-semibold text-slate-700">
          <input type="checkbox" className="h-6 w-6 rounded border-slate-300 text-brand-blue" checked={d.is_published} onChange={(e) => setD({ ...d, is_published: e.target.checked })} />
          People can see this
        </label>
      </div>
    </EditorForm>
  )
}
