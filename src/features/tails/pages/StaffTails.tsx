// Staff → Happy Tails: the published stories.
//
// Most stories arrive through the Inbox ("Publish as a Happy Tail"); this is
// where they are edited, reordered, hidden or removed afterwards — and where a
// story that came in by email or at the counter can be written up by hand.
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../lib/auth'
import { errMessage, supabase } from '../../../lib/supabase'
import { Screen, Card, Badge } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner, FormError, staffInput } from '../../../components/staffui'
import { isNative } from '../../../native/platform'
import { pickPhoto, type PhotoSource } from '../../../native/camera'
import { dataUrlToBlob, uploadItemPhoto } from '../../scan/api'
import { TAIL_STATUS, exampleTail, type TailStatus } from '../../../data/tails'
import { ExampleBadge } from '../../../components/tailbits'
import { deleteTail, listTails, saveTail, type TailRow } from '../api'
import { Explain, StaffTitle } from '../../../components/StaffTitle'
import { CardActions, EditorForm, Field, Optional, StepButton, pill } from '../../../components/StaffJob'
import { CheckRow, PartBox, confirmRemove, useCardAction, useSaving } from '../../../components/ContentEditorBits'

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

  // Stories show highest number first, so a new one gets the top number and
  // appears first (newest first). Moving a story renumbers the list n … 1 and
  // writes only the rows whose number changes.
  const topOrder = rows && rows.length ? Math.max(...rows.map((r) => r.sort_order)) + 1 : 1
  const move = async (index: number, dir: -1 | 1) => {
    if (!rows) return
    const to = index + dir
    if (to < 0 || to >= rows.length) return
    const next = [...rows]
    ;[next[index], next[to]] = [next[to], next[index]]
    for (let i = 0; i < next.length; i++) {
      const want = next.length - i
      if (next[i].sort_order === want) continue
      const { error } = await supabase.from('happy_tails').update({ sort_order: want }).eq('id', next[i].id)
      if (error) throw error
    }
    await load()
  }

  return (
    <Screen className="space-y-4">
      <StaffTitle title="Happy Tails">
        <p>
          Adoption stories on the app and the website. Most come in through the Inbox — publish one there, then edit it
          here. Newest first; use Move up and Move down to change the order.
        </p>
      </StaffTitle>

      {editing !== 'new' && (
        <div>
          <StepButton tone="orange" icon="plus" onClick={() => setEditing('new')}>
            Add a story
          </StepButton>
        </div>
      )}

      {editing === 'new' && (
        <TailForm
          orgId={orgId}
          initial={null}
          newOrder={topOrder}
          onCancel={() => setEditing(null)}
          onDone={async () => {
            setEditing(null)
            await load()
          }}
        />
      )}

      <FormError>{error}</FormError>
      {rows === null && !error && <Spinner />}
      {rows && !rows.some((r) => r.is_published) && <ExampleNote />}

      {rows?.map((r, i) =>
        editing === r.id ? (
          <TailForm
            key={r.id}
            orgId={orgId}
            initial={r}
            newOrder={topOrder}
            onCancel={() => setEditing(null)}
            onDone={async () => {
              setEditing(null)
              await load()
            }}
          />
        ) : (
          <TailCard
            key={r.id}
            row={r}
            first={i === 0}
            last={i === rows.length - 1}
            onEdit={() => setEditing(r.id)}
            onMove={(dir) => move(i, dir)}
            onChanged={load}
          />
        ),
      )}
    </Screen>
  )
}

function TailCard({
  row: r,
  first,
  last,
  onEdit,
  onMove,
  onChanged,
}: {
  row: TailRow
  first: boolean
  last: boolean
  onEdit: () => void
  onMove: (dir: -1 | 1) => Promise<void>
  onChanged: () => Promise<void>
}) {
  const { busy, error, run } = useCardAction()
  const toggle = () =>
    run(async () => {
      const { error } = await supabase.from('happy_tails').update({ is_published: !r.is_published }).eq('id', r.id)
      if (error) throw error
      await onChanged()
    })
  return (
    <Card className="space-y-2">
      <div className="flex items-start gap-3">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-300">
          {r.photo_url ? <img src={r.photo_url} alt="" className="h-full w-full object-cover" /> : <Icon name="sparkles" size={24} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-display text-base font-extrabold text-ink">{r.bunny}</span>
            <Badge tone="slate">{TAIL_STATUS[r.status as TailStatus]?.label ?? r.status}</Badge>
            {r.is_published ? <Badge tone="blue">Shown</Badge> : <Badge tone="orange">Hidden</Badge>}
          </span>
          <span className="block text-sm text-slate-500">{[r.family, r.since].filter(Boolean).join(' · ')}</span>
          <span className="mt-0.5 block line-clamp-2 text-[15px] text-slate-600">{r.summary}</span>
        </span>
      </div>
      <CardActions>
        <button type="button" onClick={onEdit} className={pill.blue}>
          Edit
        </button>
        <button type="button" onClick={() => void toggle()} disabled={busy} className={pill.outline}>
          <Icon name={r.is_published ? 'eyeOff' : 'eye'} size={16} /> {r.is_published ? 'Hide' : 'Show'}
        </button>
        <button type="button" onClick={() => void run(() => onMove(-1))} disabled={busy || first} className={pill.outline}>
          Move up
        </button>
        <button type="button" onClick={() => void run(() => onMove(1))} disabled={busy || last} className={pill.outline}>
          Move down
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (confirmRemove(`the story of ${r.bunny}`))
              void run(async () => {
                await deleteTail(r.id)
                await onChanged()
              })
          }}
          className={pill.red}
        >
          <Icon name="trash" size={16} /> Remove
        </button>
      </CardActions>
      <FormError>{error}</FormError>
    </Card>
  )
}

// Nothing published yet: the public Happy Tails page (app and website) shows the
// built-in example story (data/tails.ts) until the first real one, and staff see
// it here too, so everyone knows what a published story looks like.
function ExampleNote() {
  const t = exampleTail
  return (
    <Card className="space-y-3">
      <p className="text-[15px] leading-relaxed text-slate-600">
        Nothing is published yet, so the Happy Tails page is showing one example story, marked “Example”. It goes away
        by itself when you publish the first real one.
      </p>
      <StepButton to={`/tails/${t.id}`} icon="sparkles">
        See the example as people see it
      </StepButton>
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-2.5">
        <span className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
          <img src={t.photo} alt="" className="h-full w-full object-cover" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-display text-base font-extrabold text-ink">{t.bunny}</span>
            <ExampleBadge />
            <Badge tone="slate">{TAIL_STATUS[t.status].label}</Badge>
          </span>
          <span className="block text-sm text-slate-500">{t.since}</span>
          <span className="mt-0.5 block line-clamp-2 text-[15px] text-slate-600">{t.summary}</span>
        </span>
      </div>
      <Explain label="What a real story has">
        <p>
          A real story has the same parts: a photo, the bunny’s name, how they’re doing, a one-line summary for the card
          and the story itself. Adopters send theirs from Share your Happy Tail on the Happy Tails page; it arrives in
          the Inbox, where you publish it.
        </p>
      </Explain>
      <StepButton to="/tails/share" icon="plus">
        Open the Share your Happy Tail page
      </StepButton>
    </Card>
  )
}

function TailForm({
  orgId,
  initial,
  newOrder,
  onCancel,
  onDone,
}: {
  orgId: string
  initial: TailRow | null
  /** The sort number a brand-new story gets (one above the top one). */
  newOrder: number
  onCancel: () => void
  onDone: () => Promise<void>
}) {
  const [d, setD] = useState({
    bunny: initial?.bunny ?? '',
    family: initial?.family ?? '',
    status: (initial?.status ?? 'going-strong') as TailStatus,
    since: initial?.since ?? '',
    summary: initial?.summary ?? '',
    story: initial?.story ?? '',
    photo_url: initial?.photo_url ?? '',
    is_published: initial?.is_published ?? true,
  })
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const txt = (k: keyof typeof d) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value })

  const { busy, error, submit, guard } = useSaving(async () => {
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
      sort_order: initial ? initial.sort_order : newOrder,
    })
    await onDone()
  })

  const pick = async (source: PhotoSource) => {
    if (!isNative) return
    setPhotoError(null)
    try {
      const dataUrl = await pickPhoto(source)
      if (!dataUrl) return
      setPhotoBusy(true)
      const url = await uploadItemPhoto(await dataUrlToBlob(dataUrl), orgId)
      setD((x) => ({ ...x, photo_url: url }))
    } catch (e) {
      setPhotoError(errMessage(e))
    } finally {
      setPhotoBusy(false)
    }
  }

  const onFile = async (e: { target: { files: FileList | null; value: string } }) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoBusy(true)
    setPhotoError(null)
    try {
      const url = await uploadItemPhoto(file, orgId)
      setD((x) => ({ ...x, photo_url: url }))
    } catch (err) {
      setPhotoError(errMessage(err))
    } finally {
      setPhotoBusy(false)
    }
  }

  return (
    <EditorForm
      title={initial ? `Edit the story of ${initial.bunny}` : 'New Happy Tail'}
      hint="Needed parts are marked. Save puts the story on the Happy Tails page right away if it is shown."
      onSubmit={submit}
      onCancel={onCancel}
      busy={busy || photoBusy}
      canSave={d.bunny.trim().length > 0 && d.summary.trim().length > 0}
      error={error ?? photoError}
      remove={
        initial
          ? {
              label: 'Remove this story',
              confirm: 'Remove this story? This can’t be undone.',
              onRemove: guard(async () => {
                await deleteTail(initial.id)
                await onDone()
              }),
            }
          : undefined
      }
    >
      <PartBox n="A" title="Who" hint="needed">
        <Field label="Bunny’s name" needed>
          <input className={staffInput} required value={d.bunny} onChange={txt('bunny')} />
        </Field>
        <Field label="Family">
          <input className={staffInput} value={d.family} onChange={txt('family')} placeholder="Patel family" />
        </Field>
        <div>
          <p className="text-sm font-semibold text-slate-700">
            Photo
            <Optional />
          </p>
          <div className="mt-1.5 flex items-center gap-3">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-slate-300">
              {d.photo_url ? <img src={d.photo_url} alt="" className="h-full w-full object-cover" /> : <Icon name="camera" size={28} />}
            </span>
            <div className="flex flex-1 flex-wrap gap-2">
              {isNative ? (
                <>
                  <button type="button" onClick={() => void pick('camera')} disabled={photoBusy} className={pill.blue}>
                    <Icon name="camera" size={17} /> {photoBusy ? 'Saving…' : 'Take a photo'}
                  </button>
                  <button type="button" onClick={() => void pick('library')} disabled={photoBusy} className={pill.outline}>
                    Choose from photos
                  </button>
                </>
              ) : (
                <label className={`${pill.blue} cursor-pointer`}>
                  <Icon name="camera" size={17} /> {photoBusy ? 'Saving…' : d.photo_url ? 'Choose a different photo' : 'Choose a photo'}
                  <input type="file" accept="image/*" className="hidden" onChange={onFile} />
                </label>
              )}
              {d.photo_url && (
                <button type="button" onClick={() => setD((x) => ({ ...x, photo_url: '' }))} disabled={photoBusy} className={pill.outline}>
                  Take the photo off
                </button>
              )}
            </div>
          </div>
          <Field label="Or paste a photo address">
            <input className={staffInput} value={d.photo_url} onChange={txt('photo_url')} placeholder="https://…" />
          </Field>
        </div>
      </PartBox>

      <PartBox n="B" title="The story" hint="needed">
        <Field label="One-line summary (on the card)" needed>
          <input className={staffInput} required value={d.summary} onChange={txt('summary')} maxLength={160} />
        </Field>
        <Field label="The story">
          <textarea className={staffInput} rows={5} value={d.story} onChange={txt('story')} />
        </Field>
      </PartBox>

      <PartBox n="C" title="How they’re doing" hint="needed">
        <Field label="How they’re doing" needed>
          <select className={staffInput} value={d.status} onChange={txt('status')}>
            {Object.entries(TAIL_STATUS).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Since">
          <input className={staffInput} value={d.since} onChange={txt('since')} placeholder="Adopted Mar 2025" />
        </Field>
      </PartBox>

      <PartBox n="D" title="Showing" hint="optional">
        <CheckRow label="People can see this" checked={d.is_published} onChange={(v) => setD((x) => ({ ...x, is_published: v }))} />
      </PartBox>
    </EditorForm>
  )
}
