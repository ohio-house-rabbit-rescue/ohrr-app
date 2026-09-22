// Staff → Happy Tails: the published stories.
//
// Most stories arrive through the Inbox ("Publish as a Happy Tail"); this is
// where they are edited, reordered, hidden or removed afterwards — and where a
// story that came in by email or at the counter can be written up by hand.
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../../lib/auth'
import { errMessage } from '../../../lib/supabase'
import { Screen, Card, Badge, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner, FormError, staffInput } from '../../../components/staffui'
import { isNative } from '../../../native/platform'
import { pickPhoto, type PhotoSource } from '../../../native/camera'
import { dataUrlToBlob, uploadItemPhoto } from '../../scan/api'
import { TAIL_STATUS, type TailStatus } from '../../../data/tails'
import { deleteTail, listTails, saveTail, type TailRow } from '../api'

export default function StaffTails() {
  const { membership } = useAuth()
  const orgId = membership?.orgId ?? ''
  const [rows, setRows] = useState<TailRow[] | null>(null)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!orgId) return
    try {
      setRows(await listTails(orgId))
    } catch (e) {
      setError(errMessage(e))
    }
  }, [orgId])
  useEffect(() => {
    void load()
  }, [load])

  return (
    <Screen className="space-y-4">
      <div className="pt-1">
        <h1 className="font-display text-2xl font-black text-ink">Happy Tails</h1>
        <p className="mt-1 text-sm text-slate-600">
          Adoption stories on the app and the website. Most come in through the Inbox — publish one there, then edit it
          here.
        </p>
      </div>

      <FormError>{error}</FormError>
      {rows === null && !error && <Spinner />}
      {rows && rows.length === 0 && (
        <Card className="text-sm text-slate-600">
          No published stories yet — until there is one, the app shows clearly-labelled samples.
        </Card>
      )}

      {rows?.map((r) =>
        editing === r.id ? (
          <Card key={r.id}>
            <TailForm
              orgId={orgId}
              initial={r}
              onDone={async () => {
                setEditing(null)
                await load()
              }}
            />
          </Card>
        ) : (
          <Card key={r.id}>
            <div className="flex items-start gap-3">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-300">
                {r.photo_url ? <img src={r.photo_url} alt="" className="h-full w-full object-cover" /> : <Icon name="sparkles" size={24} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-display text-[15px] font-extrabold text-ink">{r.bunny}</span>
                  <Badge tone="slate">{TAIL_STATUS[r.status as TailStatus]?.label ?? r.status}</Badge>
                  {!r.is_published && <Badge tone="orange">Hidden</Badge>}
                </span>
                <span className="block text-xs text-slate-500">
                  {[r.family, r.since].filter(Boolean).join(' · ')}
                </span>
                <span className="mt-0.5 block line-clamp-2 text-sm text-slate-600">{r.summary}</span>
              </span>
              <button type="button" onClick={() => setEditing(r.id)} className="shrink-0 text-sm font-bold text-brand-blue">
                Edit
              </button>
            </div>
          </Card>
        ),
      )}

      {editing === 'new' ? (
        <Card>
          <TailForm
            orgId={orgId}
            initial={null}
            onDone={async () => {
              setEditing(null)
              await load()
            }}
          />
        </Card>
      ) : (
        <button type="button" onClick={() => setEditing('new')} className={`${btn.outline} w-full`}>
          <Icon name="plus" size={16} /> Write one by hand
        </button>
      )}
    </Screen>
  )
}

function TailForm({ orgId, initial, onDone }: { orgId: string; initial: TailRow | null; onDone: () => Promise<void> }) {
  const [d, setD] = useState({
    bunny: initial?.bunny ?? '',
    family: initial?.family ?? '',
    status: (initial?.status ?? 'going-strong') as TailStatus,
    since: initial?.since ?? '',
    summary: initial?.summary ?? '',
    story: initial?.story ?? '',
    photo_url: initial?.photo_url ?? '',
    is_published: initial?.is_published ?? true,
    sort_order: String(initial?.sort_order ?? 0),
  })
  const [busy, setBusy] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const txt = (k: keyof typeof d) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value })

  const pick = async (source: PhotoSource) => {
    if (!isNative) return
    setError(null)
    try {
      const dataUrl = await pickPhoto(source)
      if (!dataUrl) return
      setPhotoBusy(true)
      const url = await uploadItemPhoto(await dataUrlToBlob(dataUrl), orgId)
      setD((x) => ({ ...x, photo_url: url }))
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setPhotoBusy(false)
    }
  }

  const onFile = async (e: { target: { files: FileList | null; value: string } }) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoBusy(true)
    setError(null)
    try {
      const url = await uploadItemPhoto(file, orgId)
      setD((x) => ({ ...x, photo_url: url }))
    } catch (err) {
      setError(errMessage(err))
    } finally {
      setPhotoBusy(false)
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await saveTail({
        ...(initial ? { id: initial.id } : {}),
        org_id: orgId,
        bunny: d.bunny.trim(),
        family: d.family.trim() || null,
        status: d.status,
        since: d.since.trim() || null,
        summary: d.summary.trim() || 'A new chapter.',
        story: d.story.trim() || null,
        photo_url: d.photo_url.trim() || null,
        is_published: d.is_published,
        sort_order: Number(d.sort_order) || 0,
      })
      await onDone()
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-slate-300">
          {d.photo_url ? <img src={d.photo_url} alt="" className="h-full w-full object-cover" /> : <Icon name="camera" size={28} />}
        </span>
        <div className="flex flex-1 flex-col gap-1.5">
          {isNative ? (
            <>
              <button type="button" onClick={() => void pick('camera')} disabled={photoBusy} className={`${btn.blue} !py-2.5 disabled:opacity-60`}>
                <Icon name="camera" size={18} /> {photoBusy ? 'Saving…' : 'Take a photo'}
              </button>
              <button type="button" onClick={() => void pick('library')} disabled={photoBusy} className="text-sm font-bold text-brand-blue">
                Choose from photos
              </button>
            </>
          ) : (
            <label className={`${btn.blue} cursor-pointer !py-2.5`}>
              <Icon name="camera" size={18} /> {photoBusy ? 'Saving…' : 'Choose a photo'}
              <input type="file" accept="image/*" className="hidden" onChange={onFile} />
            </label>
          )}
          <input className={`${staffInput} !mt-0 text-xs`} value={d.photo_url} onChange={txt('photo_url')} placeholder="…or paste a photo URL" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          Bunny
          <input className={staffInput} required value={d.bunny} onChange={txt('bunny')} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Family
          <input className={staffInput} value={d.family} onChange={txt('family')} placeholder="Patel family" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          How they’re doing
          <select className={staffInput} value={d.status} onChange={txt('status')}>
            {Object.entries(TAIL_STATUS).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Since
          <input className={staffInput} value={d.since} onChange={txt('since')} placeholder="Adopted Mar 2025" />
        </label>
      </div>
      <label className="block text-sm font-semibold text-slate-700">
        One-line summary (on the card)
        <input className={staffInput} required value={d.summary} onChange={txt('summary')} maxLength={160} />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        The story
        <textarea className={staffInput} rows={4} value={d.story} onChange={txt('story')} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-slate-700">
          Order (higher shows first)
          <input inputMode="numeric" className={staffInput} value={d.sort_order} onChange={(e) => setD({ ...d, sort_order: e.target.value.replace(/[^0-9]/g, '') })} />
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-brand-blue" checked={d.is_published} onChange={(e) => setD({ ...d, is_published: e.target.checked })} />
          People can see this
        </label>
      </div>
      <FormError>{error}</FormError>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || photoBusy || !d.bunny.trim()} className={`${btn.primary} flex-1 disabled:opacity-60`}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        {initial &&
          (confirmDelete ? (
            <button
              type="button"
              onClick={() => deleteTail(initial.id).then(onDone).catch((e) => setError(errMessage(e)))}
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
