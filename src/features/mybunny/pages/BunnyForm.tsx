import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Screen, Card, SegTabs, btn } from '../../../components/ui'
import { MbIcon } from '../icons'
import { BackLink, BunnyAvatar, Field, SaveWarning, mbInput, useDocumentTitle } from '../ui'
import { downscaleImage, dataUrlKb, PHOTO_MAX_PX } from '../photo'
import { useBunnyPhoto } from '../photos'
import { isNative } from '../../../native/platform'
import { pickPhoto, type PhotoSource } from '../../../native/camera'
import { cancelReminders } from '../../../native/notifications'
import {
  useMyBunny,
  findBunny,
  addBunny,
  updateBunny,
  deleteBunny,
  setBunnyPhoto,
  getMyBunny,
  remindersFor,
  activeBunnies,
  atBunnyLimit,
  collectionTitle,
  ageMonths,
  todayIso,
  BUNNY_ROLES,
  ROLE_LABEL,
  LIMIT_MESSAGE,
  MAX_BUNNIES,
  type Sex,
  type BunnyRole,
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
  const title = collectionTitle(activeBunnies(data).length)
  useDocumentTitle(existing ? `Edit ${existing.name} · ${title}` : `Add a bunny · ${title}`)

  if (editing && !existing) return <Missing />
  if (!editing && atBunnyLimit(data)) return <AtLimit title={title} />

  return (
    <Form
      key={existing?.id ?? 'new'}
      existing={existing}
      title={title}
      onDone={(bunnyId) => navigate(`/my-bunny/${bunnyId}`, { replace: true })}
      onDeleted={() => navigate('/my-bunny', { replace: true })}
    />
  )
}

function Form({
  existing,
  title,
  onDone,
  onDeleted,
}: {
  existing: ReturnType<typeof findBunny>
  title: string
  onDone: (bunnyId: string) => void
  onDeleted: () => void
}) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)
  const today = todayIso()
  const hadApprox = existing?.approxAgeMonths !== undefined && !existing?.birthday
  const currentApproxMonths = hadApprox && existing ? (ageMonths(existing, today) ?? 0) : 0

  // The stored photo (IndexedDB) shows until the person picks or removes one;
  // `photoTouched` is what tells us to write the change on save.
  const stored = useBunnyPhoto(existing?.id, existing?.hasPhoto)
  const [photo, setPhoto] = useState<string | undefined>(undefined)
  const [photoTouched, setPhotoTouched] = useState(false)
  const shownPhoto = photoTouched ? photo : stored
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoErr, setPhotoErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState(existing?.name ?? '')
  const [role, setRole] = useState<BunnyRole>(existing?.role ?? 'pet')
  const [ageMode, setAgeMode] = useState<AgeMode>(hadApprox ? 'Approximate age' : 'Birthday')
  const [birthday, setBirthday] = useState(existing?.birthday ?? '')
  const [approxYears, setApproxYears] = useState(hadApprox ? String(Math.floor(currentApproxMonths / 12)) : '')
  const [approxMonths, setApproxMonths] = useState(hadApprox ? String(currentApproxMonths % 12) : '')
  const [sexOpt, setSexOpt] = useState<SexOption | ''>(existing?.sex ? optionFromSex[existing.sex] : '')
  const [breed, setBreed] = useState(existing?.breed ?? '')
  const [fixedOn, setFixedOn] = useState(existing?.fixedOn ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [error, setError] = useState<string | null>(null)

  // A picked File (web) or a data URL (native camera plugin) → same downscale.
  const usePhoto = async (source: Blob | string) => {
    setPhotoBusy(true)
    setPhotoErr(null)
    try {
      setPhoto(await downscaleImage(source))
      setPhotoTouched(true)
    } catch (err) {
      setPhotoErr(err instanceof Error ? err.message : 'Couldn’t use that photo.')
    } finally {
      setPhotoBusy(false)
    }
  }

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // so choosing the same file again still fires onChange
    if (!file) return
    await usePhoto(file)
  }

  // Inside the Android/iOS app the buttons call the native camera / photo
  // picker; in a browser they click the hidden file inputs as before.
  const pick = async (source: PhotoSource) => {
    if (!isNative) {
      ;(source === 'camera' ? cameraRef : libraryRef).current?.click()
      return
    }
    setPhotoErr(null)
    try {
      const dataUrl = await pickPhoto(source)
      if (dataUrl) await usePhoto(dataUrl)
    } catch (err) {
      setPhotoErr(err instanceof Error ? err.message : 'Couldn’t get that photo.')
    }
  }

  const removePhoto = () => {
    setPhoto(undefined)
    setPhotoTouched(true)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Give your bunny a name.')
      return
    }
    // Every optional key is set explicitly (possibly undefined) so an edit can
    // clear a field, not just add one. `hasPhoto` is owned by setBunnyPhoto.
    const input: BunnyInput = {
      name,
      role,
      hasPhoto: existing?.hasPhoto,
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
    setSaving(true)
    try {
      let bunnyId: string
      if (existing) {
        updateBunny(existing.id, input)
        bunnyId = existing.id
      } else {
        bunnyId = addBunny(input).id
      }
      if (photoTouched) await setBunnyPhoto(bunnyId, photo)
      onDone(bunnyId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t save.')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = () => {
    if (!existing) return
    const ok = window.confirm(
      `Remove ${existing.name} from this phone? Their reminders, weight log, health notes and photo go too. This can’t be undone (unless you have a backup).`,
    )
    if (!ok) return
    // Native app: drop any scheduled "remind me on this phone" notifications too.
    void cancelReminders(remindersFor(getMyBunny(), existing.id).map((r) => r.id))
    deleteBunny(existing.id)
    onDeleted()
  }

  const previewBunny = { id: existing?.id ?? 'new', name: name || '?', hasPhoto: false }
  const photoBtn = `${btn.outline} px-3.5 py-2 disabled:opacity-60`

  return (
    <Screen className="space-y-4">
      <BackLink to={existing ? `/my-bunny/${existing.id}` : '/my-bunny'} label={existing ? existing.name : title} />

      <div>
        <p className="text-xs font-extrabold uppercase tracking-wider text-brand-blue">{title}</p>
        <h1 className="mt-1 font-display text-2xl font-black text-ink">
          {existing ? `Edit ${existing.name}` : 'Add a bunny'}
        </h1>
        {!existing && (
          <p className="mt-1 text-sm text-slate-500">Only the name is required — add the rest whenever.</p>
        )}
      </div>

      <SaveWarning />

      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          {/* Photo — camera or library; both go through the same downscale */}
          <div className="flex items-center gap-4">
            <BunnyAvatar bunny={previewBunny} src={shownPhoto} size={80} />
            <div className="min-w-0 flex-1 space-y-1.5">
              {photoBusy ? (
                <p className="text-sm font-bold text-slate-500">Shrinking…</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void pick('camera')} className={photoBtn}>
                    <MbIcon name="camera" size={15} /> Take a photo
                  </button>
                  <button type="button" onClick={() => void pick('library')} className={photoBtn}>
                    <MbIcon name="upload" size={15} /> Choose from library
                  </button>
                  {shownPhoto && (
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="rounded-full px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100"
                    >
                      Remove
                    </button>
                  )}
                </div>
              )}
              <p className="text-xs leading-relaxed text-slate-400">
                {shownPhoto
                  ? `Shrunk to ${PHOTO_MAX_PX}px (about ${dataUrlKb(shownPhoto)} KB) and kept on this phone only.`
                  : `Photos are shrunk to ${PHOTO_MAX_PX}px and kept on this phone only.`}
              </p>
              {photoErr && <p className="text-xs font-semibold text-red-600">{photoErr}</p>}
              {/* `capture` opens the phone's camera directly; without it the picker shows the library. */}
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={onPhoto}
                aria-label="Take a photo"
              />
              <input
                ref={libraryRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPhoto}
                aria-label="Choose a photo from your library"
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

          <Field label="This bunny is" hint="How you’re connected — handy if you foster, sponsor or help run a rescue.">
            <select className={mbInput} value={role} onChange={(e) => setRole(e.target.value as BunnyRole)} required>
              {BUNNY_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
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

          <Field label="Breed" optional hint="Not sure? Learn → What kind of bunny do I have? walks you through it.">
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

          <button type="submit" disabled={photoBusy || saving} className={`${btn.primary} w-full disabled:opacity-60`}>
            {saving ? 'Saving…' : existing ? 'Save changes' : 'Save bunny'}
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

function AtLimit({ title }: { title: string }) {
  return (
    <Screen className="space-y-4">
      <BackLink to="/my-bunny" label={title} />
      <Card className="space-y-3">
        <h1 className="font-display text-xl font-extrabold text-ink">That’s a full fluffle</h1>
        <p className="text-sm leading-relaxed text-slate-600">{LIMIT_MESSAGE}</p>
        <p className="text-xs leading-relaxed text-slate-400">
          Archiving keeps a bunny’s whole record (profile, weights, notes, reminders) — it just moves them out of
          your active {MAX_BUNNIES}.
        </p>
        <Link to="/my-bunny" className={`${btn.blue} w-full`}>
          Back to {title}
        </Link>
      </Card>
    </Screen>
  )
}
