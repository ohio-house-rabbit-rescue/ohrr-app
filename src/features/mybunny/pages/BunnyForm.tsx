import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Screen, Card, SegTabs, btn } from '../../../components/ui'
import { MbIcon } from '../icons'
import { BackLink, BunnyAvatar, Field, SaveWarning, mbInput } from '../ui'
import { downscaleImage, dataUrlKb, PHOTO_MAX_PX } from '../photo'
import {
  useMyBunny,
  findBunny,
  addBunny,
  updateBunny,
  deleteBunny,
  ageMonths,
  todayIso,
  type Sex,
  type BunnyInput,
} from '../storage'

const AGE_MODES = ['Birthday', 'Approximate age'] as const
type AgeMode = (typeof AGE_MODES)[number]

const SEX_OPTIONS = ['Female', 'Male', 'Not sure'] as const
type SexOption = (typeof SEX_OPTIONS)[number]
const sexFromOption: Record<SexOption, Sex> = { Female: 'female', Male: 'male', 'Not sure': 'unknown' }
const optionFromSex: Record<Sex, SexOption> = { female: 'Female', male: 'Male', unknown: 'Not sure' }

/** Add (`/my-bunny/new`) and edit (`/my-bunny/:id/edit`) share this screen. */
export default function BunnyForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const data = useMyBunny()
  const existing = id ? findBunny(data, id) : undefined
  const editing = Boolean(id)

  if (editing && !existing) return <Missing />

  return <Form key={existing?.id ?? 'new'} existing={existing} onDone={(bunnyId) => navigate(`/my-bunny/${bunnyId}`, { replace: true })} onDeleted={() => navigate('/my-bunny', { replace: true })} />
}

function Form({
  existing,
  onDone,
  onDeleted,
}: {
  existing: ReturnType<typeof findBunny>
  onDone: (bunnyId: string) => void
  onDeleted: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const today = todayIso()
  const hadApprox = existing?.approxAgeMonths !== undefined && !existing?.birthday
  const currentApproxMonths = hadApprox && existing ? (ageMonths(existing, today) ?? 0) : 0

  const [name, setName] = useState(existing?.name ?? '')
  const [photo, setPhoto] = useState<string | undefined>(existing?.photoDataUrl)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoErr, setPhotoErr] = useState<string | null>(null)
  const [ageMode, setAgeMode] = useState<AgeMode>(hadApprox ? 'Approximate age' : 'Birthday')
  const [birthday, setBirthday] = useState(existing?.birthday ?? '')
  const [approxYears, setApproxYears] = useState(hadApprox ? String(Math.floor(currentApproxMonths / 12)) : '')
  const [approxMonths, setApproxMonths] = useState(hadApprox ? String(currentApproxMonths % 12) : '')
  const [sexOpt, setSexOpt] = useState<SexOption | ''>(existing?.sex ? optionFromSex[existing.sex] : '')
  const [breed, setBreed] = useState(existing?.breed ?? '')
  const [fixedOn, setFixedOn] = useState(existing?.fixedOn ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [error, setError] = useState<string | null>(null)

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // so choosing the same file again still fires onChange
    if (!file) return
    setPhotoBusy(true)
    setPhotoErr(null)
    try {
      setPhoto(await downscaleImage(file))
    } catch (err) {
      setPhotoErr(err instanceof Error ? err.message : 'Couldn’t use that photo.')
    } finally {
      setPhotoBusy(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Give your bunny a name.')
      return
    }
    // Every optional key is set explicitly (possibly undefined) so an edit can
    // clear a field, not just add one.
    const input: BunnyInput = {
      name,
      photoDataUrl: photo,
      birthday: undefined,
      approxAgeMonths: undefined,
      approxAgeAsOf: undefined,
      sex: sexOpt ? sexFromOption[sexOpt] : undefined,
      breed: breed || undefined,
      fixedOn: fixedOn || undefined,
      notes: notes || undefined,
    }
    if (ageMode === 'Birthday') {
      if (birthday) input.birthday = birthday
    } else if (approxYears !== '' || approxMonths !== '') {
      const y = Math.max(0, parseInt(approxYears || '0', 10) || 0)
      const m = Math.max(0, parseInt(approxMonths || '0', 10) || 0)
      input.approxAgeMonths = y * 12 + m
      input.approxAgeAsOf = today
    }
    if (existing) {
      updateBunny(existing.id, input)
      onDone(existing.id)
    } else {
      onDone(addBunny(input).id)
    }
  }

  const onDelete = () => {
    if (!existing) return
    const ok = window.confirm(
      `Remove ${existing.name} from this phone? Their reminders and weight log go too. This can’t be undone (unless you have a backup).`,
    )
    if (!ok) return
    deleteBunny(existing.id)
    onDeleted()
  }

  const previewBunny = { name: name || '?', photoDataUrl: photo }

  return (
    <Screen className="space-y-4">
      <BackLink to={existing ? `/my-bunny/${existing.id}` : '/my-bunny'} label={existing ? existing.name : 'My Bunny'} />

      <div>
        <p className="text-xs font-extrabold uppercase tracking-wider text-brand-blue">My Bunny</p>
        <h1 className="mt-1 font-display text-2xl font-black text-ink">
          {existing ? `Edit ${existing.name}` : 'Add your bunny'}
        </h1>
        {!existing && (
          <p className="mt-1 text-sm text-slate-500">Only the name is required — add the rest whenever.</p>
        )}
      </div>

      <SaveWarning />

      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          {/* Photo */}
          <div className="flex items-center gap-4">
            <BunnyAvatar bunny={previewBunny} size={80} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={photoBusy}
                  className={`${btn.outline} px-4 py-2 disabled:opacity-60`}
                >
                  <MbIcon name="camera" size={15} /> {photoBusy ? 'Shrinking…' : photo ? 'Change photo' : 'Add a photo'}
                </button>
                {photo && !photoBusy && (
                  <button
                    type="button"
                    onClick={() => setPhoto(undefined)}
                    className="rounded-full px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-xs leading-relaxed text-slate-400">
                {photo
                  ? `Shrunk to ${PHOTO_MAX_PX}px (about ${dataUrlKb(photo)} KB) and kept on this phone only.`
                  : `Photos are shrunk to ${PHOTO_MAX_PX}px and kept on this phone only.`}
              </p>
              {photoErr && <p className="text-xs font-semibold text-red-600">{photoErr}</p>}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPhoto}
                aria-label="Choose a photo"
              />
            </div>
          </div>

          <Field label="Name">
            <input
              className={mbInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={40}
              autoComplete="off"
              placeholder="e.g. Clover"
            />
          </Field>

          {/* Age */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">
              Age <span className="ml-1 text-xs font-semibold text-slate-400">(optional)</span>
            </p>
            <SegTabs options={AGE_MODES} value={ageMode} onChange={setAgeMode} wrap />
            {ageMode === 'Birthday' ? (
              <Field label="Birthday" hint="Age is worked out from this.">
                <input
                  type="date"
                  className={mbInput}
                  value={birthday}
                  max={today}
                  onChange={(e) => setBirthday(e.target.value)}
                />
              </Field>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Years">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={20}
                    className={mbInput}
                    value={approxYears}
                    onChange={(e) => setApproxYears(e.target.value)}
                    placeholder="0"
                  />
                </Field>
                <Field label="Months" hint="Keeps counting up from today.">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={11}
                    className={mbInput}
                    value={approxMonths}
                    onChange={(e) => setApproxMonths(e.target.value)}
                    placeholder="0"
                  />
                </Field>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">
              Sex <span className="ml-1 text-xs font-semibold text-slate-400">(optional)</span>
            </p>
            <SegTabs options={SEX_OPTIONS} value={sexOpt as SexOption} onChange={setSexOpt} wrap />
          </div>

          <Field label="Breed" optional>
            <input
              className={mbInput}
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              maxLength={60}
              placeholder="e.g. Holland Lop, mixed, not sure"
            />
          </Field>

          <Field label="Spayed / neutered on" optional hint="Leave blank if not yet, or if you’re not sure of the date.">
            <input
              type="date"
              className={mbInput}
              value={fixedOn}
              max={today}
              onChange={(e) => setFixedOn(e.target.value)}
            />
          </Field>

          <Field label="Notes" optional hint="Vet, microchip, medications, quirks — anything you want handy.">
            <textarea
              className={mbInput}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
            />
          </Field>

          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

          <button type="submit" disabled={photoBusy} className={`${btn.primary} w-full disabled:opacity-60`}>
            {existing ? 'Save changes' : 'Save bunny'}
          </button>
        </form>
      </Card>

      {existing && (
        <button
          type="button"
          onClick={onDelete}
          className="mx-auto flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50"
        >
          <MbIcon name="trash" size={15} /> Remove {existing.name} from this phone
        </button>
      )}
    </Screen>
  )
}

function Missing() {
  return (
    <Screen className="space-y-4 text-center">
      <h1 className="pt-6 font-display text-xl font-extrabold text-ink">That bunny isn’t on this phone</h1>
      <p className="text-sm text-slate-600">It may have been removed, or was added on a different device.</p>
      <Link to="/my-bunny" className={`${btn.blue} mx-auto`}>
        Back to My Bunny
      </Link>
    </Screen>
  )
}
