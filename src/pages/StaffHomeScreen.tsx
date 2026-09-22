// Staff → Home screen: the big cards at the top of the app's home screen (and
// the website's home page — one `hero_slides` table feeds both).
//
// The website's staff area could already edit these; the phone couldn't, so a
// volunteer with only a phone couldn't change what the app opens on. Same rows,
// same rules, laid out for a thumb.
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase, errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { btn, Badge, Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { Spinner, FormError, staffInput } from '../components/staffui'
import StaffImageField from '../components/StaffImageField'
import { slideVisual } from '../data/heroSlides'

type Placement = 'hero' | 'featured'

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

export default function StaffHomeScreen() {
  const { membership, user, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const userId = user?.id ?? ''
  const allowed = can('announcements.post')

  const [items, setItems] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState<Placement | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

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
        <Card className="text-sm text-slate-600">Ask an owner or admin for access to post announcements.</Card>
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

  const groups: { key: Placement; title: string; hint: string }[] = [
    { key: 'hero', title: 'Big cards', hint: 'The swipeable cards at the top of Home. Up to 3, highest number first.' },
    { key: 'featured', title: 'Featured cards', hint: 'The row after them. Up to 4, highest number first.' },
  ]

  return (
    <Screen className="space-y-4">
      <div className="pt-1">
        <h1 className="font-display text-2xl font-black text-ink">Home screen</h1>
        <p className="mt-1 text-sm text-slate-600">
          What the app opens on — and the website’s home page. Leave it empty and both show the built-in cards.
        </p>
      </div>

      <FormError>{error}</FormError>
      {items === null && !error && <Spinner />}

      {items !== null &&
        groups.map((g) => {
          const rows = items.filter((r) => r.placement === g.key)
          return (
            <section key={g.key} className="space-y-2.5">
              <div>
                <h2 className="font-display text-[15px] font-extrabold text-ink">{g.title}</h2>
                <p className="text-xs text-slate-500">{g.hint}</p>
              </div>

              {rows.map((r) =>
                editingId === r.id ? (
                  <Card key={r.id}>
                    <SlideForm
                      initial={fromRow(r)}
                      userId={userId}
                      submitLabel="Save"
                      onSubmit={(d) => save(d, r.id)}
                      onCancel={() => setEditingId(null)}
                      onDelete={async () => {
                        const { error } = await supabase.from('hero_slides').delete().eq('id', r.id)
                        if (error) throw error
                        setEditingId(null)
                        await load()
                      }}
                    />
                  </Card>
                ) : (
                  <Card key={r.id}>
                    <div className="flex items-start gap-3">
                      <span className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
                        <Preview r={r} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-display text-[15px] font-extrabold text-ink">{r.headline}</span>
                          {!r.is_published && <Badge tone="orange">Hidden</Badge>}
                        </span>
                        {r.subline && <span className="block text-xs text-slate-500">{r.subline}</span>}
                        <span className="block text-xs text-slate-400">
                          Order {r.sort_order}
                          {r.cta_url ? ` · → ${r.cta_url}` : ''}
                        </span>
                      </span>
                      <button type="button" onClick={() => setEditingId(r.id)} className="shrink-0 text-sm font-bold text-brand-blue">
                        Edit
                      </button>
                    </div>
                  </Card>
                ),
              )}

              {creating === g.key ? (
                <Card>
                  <SlideForm
                    initial={empty(g.key)}
                    userId={userId}
                    submitLabel="Add"
                    onSubmit={(d) => save(d)}
                    onCancel={() => setCreating(null)}
                  />
                </Card>
              ) : (
                <button type="button" onClick={() => setCreating(g.key)} className={`${btn.outline} w-full`}>
                  <Icon name="plus" size={16} /> Add {g.key === 'hero' ? 'a big card' : 'a featured card'}
                </button>
              )}
            </section>
          )
        })}
    </Screen>
  )
}

function SlideForm({
  initial,
  userId,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial: Draft
  userId: string
  submitLabel: string
  onSubmit: (d: Draft) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
}) {
  const [d, setD] = useState<Draft>(initial)
  const [busy, setBusy] = useState(false)
  const [imageBusy, setImageBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const txt = (k: keyof Draft) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSubmit(d)
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm font-semibold text-slate-700">
        Headline
        <input className={staffInput} required value={d.headline} onChange={txt('headline')} placeholder="Midwest BunFest 2026 — Binky On!" />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        One line under it
        <textarea className={staffInput} rows={2} value={d.subline} onChange={txt('subline')} />
      </label>
      <StaffImageField
        label="Picture"
        hint="Leave it empty and the card shows its fixed icon — photos are for real content (a rabbit, an item, the BunFest logo)."
        value={d.image_url}
        userId={userId}
        onChange={(url) => setD({ ...d, image_url: url })}
        onBusyChange={setImageBusy}
      />
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          Button says
          <input className={staffInput} value={d.cta_label} onChange={txt('cta_label')} placeholder="Enter BunFest" />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Opens
          <input className={staffInput} value={d.cta_url} onChange={txt('cta_url')} placeholder="/bunfest" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          Show from
          <input type="datetime-local" className={staffInput} value={d.starts_at} onChange={txt('starts_at')} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Show until
          <input type="datetime-local" className={staffInput} value={d.ends_at} onChange={txt('ends_at')} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          Order (higher first)
          <input inputMode="numeric" className={staffInput} value={d.sort_order} onChange={(e) => setD({ ...d, sort_order: e.target.value.replace(/[^0-9]/g, '') })} />
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-brand-blue" checked={d.is_published} onChange={(e) => setD({ ...d, is_published: e.target.checked })} />
          People can see this
        </label>
      </div>
      <FormError>{error}</FormError>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || imageBusy || !d.headline.trim()} className={`${btn.primary} flex-1 disabled:opacity-60`}>
          {busy ? 'Saving…' : submitLabel}
        </button>
        {onDelete &&
          (confirmDelete ? (
            <button type="button" onClick={() => onDelete().catch((e) => setError(errMessage(e)))} className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-bold text-white">
              Confirm delete
            </button>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-full border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600">
              Delete
            </button>
          ))}
        <button type="button" onClick={onCancel} className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500">
          Cancel
        </button>
      </div>
    </form>
  )
}
