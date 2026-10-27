// Staff → BunFest → Schedule and speakers → Speakers.
//
// The people giving the talks: name, letters after it, where they're from, a
// bio and an optional photo. A speaker is kept from year to year — a vet who
// speaks every October has one record — and each talk says who gives it.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { Card, Badge } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner, FormError, staffInput } from '../../../components/staffui'
import { CardActions, EditorForm, Field, Part, pill } from '../../../components/StaffJob'
import StaffImageField from '../../../components/StaffImageField'
import { deletePresenter, listPresenters, savePresenter, type PresenterRow } from '../api'
import { Explain } from '../../../components/StaffTitle'

export default function StaffSpeakers({ orgId }: { orgId: string }) {
  const [rows, setRows] = useState<PresenterRow[] | null>(null)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orgId) return
    try {
      setRows(await listPresenters(orgId))
    } catch (e) {
      setError(errMessage(e))
    }
  }, [orgId])
  useEffect(() => {
    void load()
  }, [load])

  const done = async () => {
    setEditing(null)
    await load()
  }

  // A–Z by name: a reference list.
  const sorted = useMemo(() => [...(rows ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [rows])

  return (
    <div className="space-y-3">
      <p className="text-[15px] text-slate-600">Everyone who gives a talk, kept from year to year.</p>
      <Explain label="About speakers">
        <p>
          Pick them on each session so the schedule links to their bio; the Speakers page lists whoever has a talk this
          year.
        </p>
      </Explain>
      <FormError>{error}</FormError>
      {rows === null && !error && <Spinner />}

      {sorted.map((p) =>
        editing === p.id ? (
          <SpeakerForm key={p.id} orgId={orgId} initial={p} onDone={done} onCancel={() => setEditing(null)} />
        ) : (
          <Card key={p.id} className="space-y-2">
            <div className="flex items-start gap-3">
              {p.photo_url ? (
                <img src={p.photo_url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-blue-50 text-brand-blue">
                  <Icon name="users" size={22} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-display text-base font-extrabold text-ink">
                    {p.name}
                    {p.credentials ? `, ${p.credentials}` : ''}
                  </span>
                  {!p.is_published && <Badge tone="orange">Hidden</Badge>}
                </span>
                {p.affiliation && <span className="block text-[15px] text-slate-600">{p.affiliation}</span>}
              </span>
            </div>
            <CardActions>
              <button type="button" onClick={() => setEditing(p.id)} className={pill.blue}>
                Edit
              </button>
            </CardActions>
          </Card>
        ),
      )}

      {editing === 'new' ? (
        <SpeakerForm orgId={orgId} initial={null} onDone={done} onCancel={() => setEditing(null)} />
      ) : (
        <button type="button" onClick={() => setEditing('new')} className={pill.orange}>
          <Icon name="plus" size={16} /> Add a speaker
        </button>
      )}
    </div>
  )
}

function SpeakerForm({
  orgId,
  initial,
  onDone,
  onCancel,
}: {
  orgId: string
  initial: PresenterRow | null
  onDone: () => Promise<void>
  onCancel: () => void
}) {
  const { user } = useAuth()
  const [d, setD] = useState({
    name: initial?.name ?? '',
    credentials: initial?.credentials ?? '',
    affiliation: initial?.affiliation ?? '',
    bio: initial?.bio ?? '',
    photo_url: initial?.photo_url ?? '',
    website: initial?.website ?? '',
    is_published: initial?.is_published ?? true,
  })
  const [busy, setBusy] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const txt = (k: keyof typeof d) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value })

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      let website = d.website.trim() || null
      if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`
      await savePresenter({
        ...(initial ? { id: initial.id } : {}),
        org_id: orgId,
        name: d.name.trim(),
        credentials: d.credentials.trim() || null,
        affiliation: d.affiliation.trim() || null,
        bio: d.bio.trim() || null,
        photo_url: d.photo_url || null,
        website,
        is_published: d.is_published,
      })
      await onDone()
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
    }
  }

  return (
    <EditorForm
      title={initial ? `Change ${initial.name}` : 'Add a speaker'}
      hint="Part A is needed. B and C are optional."
      onSubmit={submit}
      onCancel={onCancel}
      busy={busy}
      canSave={!!d.name.trim() && !photoBusy}
      error={error}
      remove={
        initial
          ? {
              label: 'Delete this speaker',
              confirm: `Delete ${initial.name}? Sessions that listed them keep the line of text but lose the link to a bio.`,
              onRemove: () => deletePresenter(initial.id).then(onDone).catch((e) => setError(errMessage(e))),
            }
          : undefined
      }
    >
      <div className="space-y-3">
        <Part n="A" hint="needed">Who</Part>
        <Field label="Name" needed>
          <input className={staffInput} required value={d.name} onChange={txt('name')} placeholder="Barbara Oglesbee" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Letters after the name">
            <input className={staffInput} value={d.credentials} onChange={txt('credentials')} placeholder="DVM" />
          </Field>
          <Field label="From">
            <input className={staffInput} value={d.affiliation} onChange={txt('affiliation')} placeholder="MedVet Hilliard" />
          </Field>
        </div>
      </div>

      <div className="space-y-3">
        <Part n="B" hint="optional">About them</Part>
        <Field label="Bio">
          <textarea className={staffInput} rows={6} value={d.bio} onChange={txt('bio')} />
        </Field>
        {user && (
          <StaffImageField
            label="Photo"
            value={d.photo_url}
            userId={user.id}
            onChange={(url) => setD((cur) => ({ ...cur, photo_url: url }))}
            onBusyChange={setPhotoBusy}
          />
        )}
        <Field label="Their website">
          <input className={staffInput} inputMode="url" value={d.website} onChange={txt('website')} />
        </Field>
      </div>

      <div className="space-y-3">
        <Part n="C" hint="optional">Showing it</Part>
        <label className="flex min-h-[44px] items-center gap-3 text-base font-semibold text-slate-700">
          <input
            type="checkbox"
            className="h-6 w-6 rounded border-slate-300 text-brand-blue"
            checked={d.is_published}
            onChange={(e) => setD({ ...d, is_published: e.target.checked })}
          />
          People can see this
        </label>
      </div>
    </EditorForm>
  )
}
