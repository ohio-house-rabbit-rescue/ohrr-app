import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Screen, Card, SegTabs, btn } from '../../../components/ui'
import { MbIcon } from '../icons'
import { BackLink, Field, SaveWarning, VetNote, mbInput, useDocumentTitle } from '../ui'
import { isNative } from '../../../native/platform'
import { cancelReminder, resyncReminder } from '../../../native/notifications'
import {
  useMyBunny,
  findBunny,
  addReminder,
  updateReminder,
  deleteReminder,
  presetFor,
  addDays,
  todayIso,
  isIsoDate,
  activeBunnies,
  collectionTitle,
  REMINDER_PRESETS,
  type Reminder,
  type ReminderType,
  type ReminderInput,
} from '../storage'

const TYPE_LABELS: Record<ReminderType, string> = {
  nails: 'Nail trim',
  rhdv2: 'RHDV2 booster',
  vet: 'Vet check-up',
  hay: 'Hay restock',
  pellets: 'Pellets restock',
  litter: 'Litter change',
  custom: 'Custom',
}
const TYPE_OPTIONS = REMINDER_PRESETS.map((p) => TYPE_LABELS[p.type])
type TypeLabel = (typeof TYPE_OPTIONS)[number]
function typeFromLabel(label: string): ReminderType {
  return (Object.keys(TYPE_LABELS) as ReminderType[]).find((t) => TYPE_LABELS[t] === label) ?? 'custom'
}
function isReminderType(v: string | null): v is ReminderType {
  return v !== null && v in TYPE_LABELS
}

const REPEAT_OPTIONS = ['No repeat', '3 days', '2 weeks', '4 weeks', '6 weeks', 'Yearly', 'Custom'] as const
type RepeatOption = (typeof REPEAT_OPTIONS)[number]
const repeatDays: Record<RepeatOption, number | null | 'custom'> = {
  'No repeat': null,
  '3 days': 3,
  '2 weeks': 14,
  '4 weeks': 28,
  '6 weeks': 42,
  Yearly: 365,
  Custom: 'custom',
}
function optionForDays(days: number | null): RepeatOption {
  const hit = (Object.keys(repeatDays) as RepeatOption[]).find((k) => repeatDays[k] === days)
  return hit ?? 'Custom'
}

/** New (`…/reminders/new?type=nails`) and edit (`…/reminders/:rid/edit`) share this screen. */
export default function ReminderForm() {
  const { id, rid } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const data = useMyBunny()
  const bunny = findBunny(data, id)
  const existing = rid ? data.reminders.find((r) => r.id === rid && r.bunnyId === id) : undefined
  const title = collectionTitle(activeBunnies(data).length)
  useDocumentTitle(bunny ? `${existing ? 'Edit reminder' : 'New reminder'} · ${bunny.name} · ${title}` : title)

  if (!bunny || (rid && !existing)) {
    return (
      <Screen className="space-y-4 text-center">
        <h1 className="pt-6 font-display text-xl font-extrabold text-ink">
          {bunny ? 'That reminder isn’t here any more' : 'That bunny isn’t on this phone'}
        </h1>
        <Link to={bunny ? `/my-bunny/${bunny.id}` : '/my-bunny'} className={`${btn.blue} mx-auto`}>
          {bunny ? `Back to ${bunny.name}` : `Back to ${title}`}
        </Link>
      </Screen>
    )
  }

  const requested = params.get('type')
  const initialType: ReminderType = existing?.type ?? (isReminderType(requested) ? requested : 'nails')

  return (
    <Form
      key={existing?.id ?? `new-${initialType}`}
      bunnyId={bunny.id}
      bunnyName={bunny.name}
      existing={existing}
      initialType={initialType}
      onDone={() => navigate(`/my-bunny/${bunny.id}`, { replace: true })}
    />
  )
}

function Form({
  bunnyId,
  bunnyName,
  existing,
  initialType,
  onDone,
}: {
  bunnyId: string
  bunnyName: string
  existing?: Reminder
  initialType: ReminderType
  onDone: () => void
}) {
  const today = todayIso()
  const preset = presetFor(initialType)

  const [type, setType] = useState<ReminderType>(initialType)
  const [title, setTitle] = useState(existing?.title ?? preset.title)
  const [titleTouched, setTitleTouched] = useState(Boolean(existing))
  const [intervalDays, setIntervalDays] = useState<number | null>(existing ? existing.intervalDays : preset.intervalDays)
  const [repeatOpt, setRepeatOpt] = useState<RepeatOption>(optionForDays(existing ? existing.intervalDays : preset.intervalDays))
  const [customDays, setCustomDays] = useState(String(existing?.intervalDays ?? 7))
  const [lastDone, setLastDone] = useState(existing?.lastDone ?? '')
  const [nextDue, setNextDue] = useState(existing?.nextDue ?? suggestNextDue('', preset.intervalDays, today))
  const [nextDueTouched, setNextDueTouched] = useState(Boolean(existing))
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [error, setError] = useState<string | null>(null)

  const choosePreset = (label: TypeLabel) => {
    const t = typeFromLabel(label)
    const p = presetFor(t)
    setType(t)
    if (!titleTouched || !title.trim()) setTitle(p.title)
    setIntervalDays(p.intervalDays)
    setRepeatOpt(optionForDays(p.intervalDays))
    if (!nextDueTouched) setNextDue(suggestNextDue(lastDone, p.intervalDays, today))
  }

  const chooseRepeat = (o: RepeatOption) => {
    setRepeatOpt(o)
    const v = repeatDays[o]
    const days = v === 'custom' ? Math.max(1, parseInt(customDays, 10) || 7) : v
    setIntervalDays(days)
    if (!nextDueTouched) setNextDue(suggestNextDue(lastDone, days, today))
  }

  const onCustomDays = (v: string) => {
    setCustomDays(v)
    const days = Math.max(1, parseInt(v, 10) || 1)
    setIntervalDays(days)
    if (!nextDueTouched) setNextDue(suggestNextDue(lastDone, days, today))
  }

  const onLastDone = (v: string) => {
    setLastDone(v)
    if (!nextDueTouched) setNextDue(suggestNextDue(v, intervalDays, today))
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Give the reminder a title.')
      return
    }
    if (!isIsoDate(nextDue)) {
      setError('Pick the next due date.')
      return
    }
    if (repeatOpt !== 'No repeat' && (!intervalDays || intervalDays < 1)) {
      setError('Repeat every how many days?')
      return
    }
    const input: ReminderInput = {
      bunnyId,
      type,
      title,
      intervalDays: repeatOpt === 'No repeat' ? null : intervalDays,
      nextDue,
      lastDone: lastDone || undefined,
      notes: notes || undefined,
    }
    if (existing) {
      updateReminder(existing.id, input)
      // Native app: if it's set on this phone, move the notifications to the new date/title.
      void resyncReminder({ ...input, id: existing.id }, bunnyName)
    } else {
      addReminder(input)
    }
    onDone()
  }

  const onDelete = () => {
    if (!existing) return
    if (!window.confirm(`Delete “${existing.title}” for ${bunnyName}?`)) return
    void cancelReminder(existing.id) // native app: no more nudges for it
    deleteReminder(existing.id)
    onDone()
  }

  const hint = presetFor(type).hint

  return (
    <Screen className="space-y-4">
      <BackLink to={`/my-bunny/${bunnyId}`} label={bunnyName} />

      <div>
        <p className="text-xs font-extrabold uppercase tracking-wider text-brand-blue">Care reminder</p>
        <h1 className="mt-1 font-display text-2xl font-black text-ink">
          {existing ? `Edit ${existing.title}` : `New reminder for ${bunnyName}`}
        </h1>
      </div>

      <SaveWarning />

      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          {!existing && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">What is it?</p>
              <SegTabs options={TYPE_OPTIONS} value={TYPE_LABELS[type]} onChange={choosePreset} wrap />
              {type !== 'custom' && <p className="text-xs text-slate-500">{hint}.</p>}
            </div>
          )}

          <Field label="Title">
            <input
              className={mbInput}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                setTitleTouched(true)
              }}
              required
              maxLength={60}
              placeholder="e.g. Nail trim"
            />
          </Field>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">Repeats</p>
            <SegTabs options={REPEAT_OPTIONS} value={repeatOpt} onChange={chooseRepeat} wrap />
            {repeatOpt === 'Custom' && (
              <Field label="Every how many days?">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={730}
                  className={mbInput}
                  value={customDays}
                  onChange={(e) => onCustomDays(e.target.value)}
                />
              </Field>
            )}
            <VetNote />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Last done" optional hint="Sets the next due date for you.">
              <input type="date" className={mbInput} value={lastDone} max={today} onChange={(e) => onLastDone(e.target.value)} />
            </Field>
            <Field label="Next due">
              <input
                type="date"
                className={mbInput}
                value={nextDue}
                required
                onChange={(e) => {
                  setNextDue(e.target.value)
                  setNextDueTouched(true)
                }}
              />
            </Field>
          </div>

          <Field
            label="Notes"
            optional
            hint={
              isNative
                ? 'Shown in the reminder notification too — e.g. which clinic, what to bring.'
                : 'Goes into the calendar event too — e.g. which clinic, what to bring.'
            }
          >
            <textarea className={mbInput} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
          </Field>

          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

          <button type="submit" className={`${btn.primary} w-full`}>
            {existing ? 'Save changes' : 'Save reminder'}
          </button>
          <p className="text-center text-xs leading-relaxed text-slate-400">
            {isNative
              ? `After saving, tap “Remind me on this phone” on ${bunnyName}’s page so your phone alerts you.`
              : `After saving, use “Add to my phone’s calendar” on ${bunnyName}’s page so your phone alerts you.`}
          </p>
        </form>
      </Card>

      {existing && (
        <button
          type="button"
          onClick={onDelete}
          className="mx-auto flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50"
        >
          <MbIcon name="trash" size={15} /> Delete this reminder
        </button>
      )}
    </Screen>
  )
}

/** Next due = last done + interval when we know when it was last done, else today + interval. */
function suggestNextDue(lastDone: string, intervalDays: number | null, today: string): string {
  if (!intervalDays) return today
  return addDays(isIsoDate(lastDone) ? lastDone : today, intervalDays)
}
