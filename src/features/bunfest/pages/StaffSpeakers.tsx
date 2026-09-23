// Staff → BunFest → Schedule → Speakers.
//
// The people giving the talks: name, letters after it, where they're from, a
// bio and an optional photo. A speaker is kept from year to year — a vet who
// speaks every October has one record — and each talk says who gives it.
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { Card, Badge, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner, FormError, staffInput } from '../../../components/staffui'
import StaffImageField from '../../../components/StaffImageField'
import { deletePresenter, listPresenters, savePresenter, type PresenterRow } from '../api'

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

  return (
    <div className="space-y-3">
      <Card className="text-sm leading-relaxed text-slate-600">
        Everyone who gives a talk. Pick them on each session so the schedule links to their bio; the
        Speakers page lists whoever has a talk this year.
      </Card>
      <FormError>{error}</FormError>
      {rows === null && !error && <Spinner />}

      {rows?.map((p) =>
        editing === p.id ? (
          <Card key={p.id}>
            <SpeakerForm orgId={orgId} initial={p} onDone={done} />
          </Card>
        ) : (
          <Card key={p.id}>
            <div className="flex items-start gap-3">
              {p.photo_url ? (
                <img src={p.photo_url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-blue-50 text-brand-blue">
                  <Icon name="users" size={20} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-display text-[15px] font-extrabold text-ink">
                    {p.name}
                    {p.credentials ? `, ${p.credentials}` : ''}
                  </span>
                  {!p.is_published && <Badge tone="orange">Hidden</Badge>}
                </span>
                {p.affiliation && <span className="block text-xs text-slate-500">{p.affiliation}</span>}
              </span>
              <button type="button" onClick={() => setEditing(p.id)} className="shrink-0 text-sm font-bold text-brand-blue">
                Edit
              </button>
            </div>
          </Card>
        ),
      )}

      {editing === 'new' ? (
        <Card>
          <SpeakerForm orgId={orgId} initial={null} onDone={done} />
        </Card>
      ) : (
        <button type="button" onClick={() => setEditing('new')} className={`${btn.outline} w-full`}>
          <Icon name="plus" size={16} /> Add a speaker
        </button>
      )}
    </div>
  )
}

function SpeakerForm({ orgId, initial, onDone }: { orgId: string; initial: PresenterRow | null; onDone: () => Promise<void> }) {
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
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const txt = (k: keyof typeof d) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
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
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm font-semibold text-slate-700">
        Name
        <input className={staffInput} required value={d.name} onChange={txt('name')} placeholder="Barbara Oglesbee" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          Letters after the name
          <input className={staffInput} value={d.credentials} onChange={txt('credentials')} placeholder="DVM" />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          From
          <input className={staffInput} value={d.affiliation} onChange={txt('affiliation')} placeholder="MedVet Hilliard" />
        </label>
      </div>
      <label className="block text-sm font-semibold text-slate-700">
        About them
        <textarea className={staffInput} rows={6} value={d.bio} onChange={txt('bio')} />
      </label>
      {user && (
        <StaffImageField
          label="Photo (optional)"
          value={d.photo_url}
          userId={user.id}
          onChange={(url) => setD((cur) => ({ ...cur, photo_url: url }))}
          onBusyChange={setPhotoBusy}
        />
      )}
      <label className="block text-sm font-semibold text-slate-700">
        Their website
        <input className={staffInput} inputMode="url" value={d.website} onChange={txt('website')} />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input
          type="checkbox"
          className="h-5 w-5 rounded border-slate-300 text-brand-blue"
          checked={d.is_published}
          onChange={(e) => setD({ ...d, is_published: e.target.checked })}
        />
        People can see this
      </label>
      <FormError>{error}</FormError>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || photoBusy || !d.name.trim()} className={`${btn.primary} flex-1 disabled:opacity-60`}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        {initial &&
          (confirmDelete ? (
            <button
              type="button"
              onClick={() => deletePresenter(initial.id).then(onDone).catch((e) => setError(errMessage(e)))}
              className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-bold text-white"
            >
              Confirm delete
            </button>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-full border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600">
              Delete
            </button>
          ))}
      </div>
    </form>
  )
}
