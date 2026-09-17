import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Screen, Card, SectionLabel, SegTabs, Badge, ActionCard, ExternalCard, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { MbIcon } from '../icons'
import {
  BackLink,
  BunnyAvatar,
  BunnyPhoto,
  CalendarHint,
  DuePill,
  EmergencyCard,
  Field,
  RoleChip,
  SaveWarning,
  VetNote,
  WeightChart,
  mbInput,
  useDocumentTitle,
} from '../ui'
import { HOP_SHOP_TO, LEARN_TO, VET_DIRECTORY } from '../links'
import HealthNotesSection from '../HealthNotes'
import HelpSearch from '../../bunnyhelp/HelpSearch'
import { isNative } from '../../../native/platform'
import {
  scheduleReminder,
  cancelReminder,
  cancelReminders,
  isReminderScheduled,
  resyncReminder,
  type ScheduleOutcome,
} from '../../../native/notifications'
import { formatFireTime } from '../../../native/reminderSchedule'
import {
  buildReminderIcs,
  buildAllRemindersIcs,
  downloadIcs,
  googleCalendarUrl,
  reminderEvent,
  reminderFilename,
  allRemindersFilename,
} from '../ics'
import {
  useMyBunny,
  getMyBunny,
  findBunny,
  remindersFor,
  isUpcoming,
  weightsFor,
  healthNotesFor,
  markReminderDone,
  addWeight,
  deleteWeight,
  setWeightUnit,
  archiveBunny,
  restoreBunny,
  activeBunnies,
  collectionTitle,
  todayIso,
  formatAge,
  formatDate,
  formatInterval,
  formatWeight,
  formatWeightDelta,
  gramsToLbOz,
  lbOzToGrams,
  REMINDER_PRESETS,
  ARCHIVE_REASONS,
  ARCHIVE_REASON_LABEL,
  type ArchiveReason,
  type Bunny,
  type Reminder,
  type WeightEntry,
  type WeightUnit,
} from '../storage'

const SEX_LABEL = { female: 'Female', male: 'Male', unknown: 'Sex not sure' } as const

export default function BunnyProfile() {
  const { id } = useParams()
  const data = useMyBunny()
  const bunny = findBunny(data, id)
  const title = collectionTitle(activeBunnies(data).length)
  useDocumentTitle(bunny ? `${bunny.name} · ${title}` : title)

  if (!bunny) {
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

  const today = todayIso()
  const reminders = remindersFor(data, bunny.id)
  const weights = weightsFor(data, bunny.id)
  const health = healthNotesFor(data, bunny.id)
  const age = formatAge(bunny, today)
  const archived = Boolean(bunny.archived)

  return (
    <div>
      <ProfileHeader bunny={bunny} title={title} />

      <Screen className="space-y-6">
        {bunny.archived && <ArchivedBanner bunny={bunny} today={today} />}

        <div>
          <h1 className="font-display text-2xl font-black text-ink">{bunny.name}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <RoleChip role={bunny.role} />
            {age && <Badge tone="blue">{age}</Badge>}
            {bunny.sex && bunny.sex !== 'unknown' && <Badge tone="blue">{SEX_LABEL[bunny.sex]}</Badge>}
            {bunny.breed && <Badge tone="slate">{bunny.breed}</Badge>}
            {bunny.fixedOn && <Badge tone="slate">Spayed/neutered {formatDate(bunny.fixedOn, today)}</Badge>}
          </div>
        </div>

        <SaveWarning />

        {/* Bunny Help — "Clover is…" routes to OHRR's own guidance; notes save to the timeline below */}
        <HelpSearch bunnyId={bunny.id} bunnyName={bunny.name} />

        <RemindersSection bunny={bunny} reminders={reminders} today={today} archived={archived} />

        <WeightSection bunny={bunny} entries={weights} unit={data.prefs.weightUnit} today={today} />

        <HealthNotesSection bunny={bunny} notes={health} today={today} />

        <section className="space-y-2.5">
          <SectionLabel>Quick links</SectionLabel>
          <ActionCard
            to={HOP_SHOP_TO}
            title="Restock hay & pellets"
            subtitle="OHRR Hop Shop — supplies & merch that fund rescue"
            icon="bag"
            tone="orange"
          />
          {VET_DIRECTORY.to ? (
            <ActionCard to={VET_DIRECTORY.to} title="Find a rabbit-savvy vet" subtitle="OHRR’s vet directory" icon="phone" />
          ) : (
            <ExternalCard
              href={VET_DIRECTORY.href}
              title="Find a rabbit-savvy vet"
              description="OHRR’s vet directory"
              icon="phone"
            />
          )}
          <ActionCard
            to={LEARN_TO}
            title="Rabbit care articles"
            subtitle="Diet, living space, litter, bonding & health"
            icon="book"
          />
        </section>

        {bunny.notes && (
          <Card>
            <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-slate-400">Notes</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{bunny.notes}</p>
          </Card>
        )}

        {!archived && <ArchiveSection bunny={bunny} today={today} />}

        <EmergencyCard />
      </Screen>
    </div>
  )
}

/* ------------------------------------------------------------- header */

function ProfileHeader({ bunny, title }: { bunny: Bunny; title: string }) {
  const editBtn =
    'inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold shadow-md backdrop-blur transition'
  const noPhoto = (
    <div className="bg-gradient-to-b from-brand-blue to-brand-blue-dark px-5 pb-6 pt-4 text-white">
      <div className="flex items-center justify-between">
        <BackLinkOnBlue title={title} />
        <Link to={`/my-bunny/${bunny.id}/edit`} className={`${editBtn} bg-white/15 text-white hover:bg-white/25`}>
          <MbIcon name="edit" size={15} /> Edit
        </Link>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <BunnyAvatar bunny={{ ...bunny, hasPhoto: false }} size={72} />
        <Link
          to={`/my-bunny/${bunny.id}/edit`}
          className="text-sm font-semibold text-white/80 underline decoration-white/40 underline-offset-2 hover:text-white"
        >
          Add a photo of {bunny.name}
        </Link>
      </div>
    </div>
  )
  if (!bunny.hasPhoto) return noPhoto
  return (
    <div className="relative">
      <div className={`w-full overflow-hidden bg-slate-100 ${bunny.archived ? 'grayscale-[30%]' : ''}`}>
        <BunnyPhoto bunny={bunny} className="aspect-[4/3] h-auto w-full" />
      </div>
      <Link
        to="/my-bunny"
        aria-label={`Back to ${title}`}
        className="absolute left-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink shadow-md backdrop-blur transition hover:bg-white"
      >
        <Icon name="arrowLeft" size={20} />
      </Link>
      <Link to={`/my-bunny/${bunny.id}/edit`} className={`${editBtn} absolute right-4 top-4 bg-white/90 text-ink hover:bg-white`}>
        <MbIcon name="edit" size={15} /> Edit
      </Link>
    </div>
  )
}

function BackLinkOnBlue({ title }: { title: string }) {
  return (
    <Link to="/my-bunny" className="inline-flex items-center gap-1 text-sm font-bold text-white/90 hover:text-white">
      <Icon name="arrowLeft" size={16} /> {title}
    </Link>
  )
}

/* ------------------------------------------------------------ archive */

/** Shown at the top of an archived bunny's profile: reason, date, note, and the way back. */
function ArchivedBanner({ bunny, today }: { bunny: Bunny; today: string }) {
  const [err, setErr] = useState<string | null>(null)
  const a = bunny.archived!
  const restore = () => {
    try {
      restoreBunny(bunny.id)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Couldn’t restore.')
    }
  }
  return (
    <Card className="border-slate-300 bg-slate-100/80">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-200 text-slate-600">
          <MbIcon name="lock" size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Archived</p>
          <p className="mt-0.5 font-display text-[15px] font-extrabold text-ink">
            {ARCHIVE_REASON_LABEL[a.reason]} · {formatDate(a.date, today)}
          </p>
          {a.note && <p className="mt-1 text-sm leading-relaxed text-slate-600">{a.note}</p>}
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            {bunny.name}’s records are kept here, but they’re off Home and their reminders aren’t counted.
          </p>
          <button type="button" onClick={restore} className={`${btn.outline} mt-3 px-4 py-2`}>
            Restore {bunny.name}
          </button>
          {err && <p className="mt-2 text-xs font-semibold text-red-600">{err}</p>}
        </div>
      </div>
    </Card>
  )
}

/** "Archive this bunny" — reason, date (default today) and an optional note. Nothing is deleted. */
function ArchiveSection({ bunny, today }: { bunny: Bunny; today: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ArchiveReason>('adopted')
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    // Native app: an archived bunny's reminders stop nudging this phone.
    void cancelReminders(remindersFor(getMyBunny(), bunny.id).map((r) => r.id))
    archiveBunny(bunny.id, { reason, date, note })
    setOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!open) {
    return (
      <section className="space-y-1.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mx-auto flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100"
        >
          <MbIcon name="lock" size={15} /> Archive this bunny
        </button>
        <p className="text-center text-xs leading-relaxed text-slate-400">
          Adopted out, rehomed or passed away? Archiving keeps every record but takes {bunny.name} off Home.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-2.5">
      <SectionLabel>Archive {bunny.name}</SectionLabel>
      <Card>
        <form onSubmit={onSubmit} className="space-y-3">
          <p className="text-sm leading-relaxed text-slate-600">
            {bunny.name}’s profile, weight log, health notes and reminders stay on this phone; they just move to
            the Archived list and stop being counted. You can restore them any time.
          </p>
          <Field label="Reason">
            <select className={mbInput} value={reason} onChange={(e) => setReason(e.target.value as ArchiveReason)}>
              {ARCHIVE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {ARCHIVE_REASON_LABEL[r]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input type="date" className={mbInput} value={date} max={today} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="Note" optional hint="e.g. who adopted them, or anything you want to remember.">
            <input className={mbInput} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          </Field>
          <div className="flex gap-2">
            <button type="submit" className={`${btn.blue} flex-1`}>
              Archive {bunny.name}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </Card>
    </section>
  )
}

/* ---------------------------------------------------------- reminders */

const smallBtn =
  'inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 active:scale-[.98]'
const smallBtnBlue =
  'inline-flex items-center gap-1.5 rounded-full bg-brand-blue px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-blue-dark active:scale-[.98]'

function RemindersSection({
  bunny,
  reminders,
  today,
  archived,
}: {
  bunny: Bunny
  reminders: Reminder[]
  today: string
  archived: boolean
}) {
  const upcoming = reminders.filter(isUpcoming)
  const completed = reminders.filter((r) => !isUpcoming(r))
  const usedTypes = new Set(upcoming.map((r) => r.type))
  // No nudges to track more for a bunny who has left.
  const suggestions = archived ? [] : REMINDER_PRESETS.filter((p) => p.type !== 'custom' && !usedTypes.has(p.type))
  const newTo = `/my-bunny/${bunny.id}/reminders/new`

  const addAll = () => downloadIcs(buildAllRemindersIcs(upcoming, bunny.name), allRemindersFilename(bunny.name))

  // Native app: schedule every upcoming reminder on this phone in one go.
  const [allMsg, setAllMsg] = useState<string | null>(null)
  const remindAll = async () => {
    let set = 0
    let denied = false
    for (const r of upcoming) {
      const res = await scheduleReminder(r, bunny.name)
      if (res.status === 'scheduled') set += 1
      if (res.status === 'denied') denied = true
    }
    setAllMsg(
      denied
        ? 'Notifications are turned off for OHRR — allow them in your phone’s Settings, then try again.'
        : `All set — ${set} reminder${set === 1 ? '' : 's'} will pop up on this phone at 9:00 AM when due.`,
    )
    window.setTimeout(() => setAllMsg(null), 8000)
  }

  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between">
        <SectionLabel>Care reminders{archived ? ' · not counted while archived' : ''}</SectionLabel>
        <Link to={newTo} className="inline-flex items-center gap-1 px-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark">
          <MbIcon name="plus" size={14} /> Add
        </Link>
      </div>

      {upcoming.length === 0 ? (
        <Card>
          <p className="text-sm leading-relaxed text-slate-600">
            {archived
              ? 'No reminders on record.'
              : 'No reminders yet. Start with the usual ones — each has a typical interval you can change.'}
          </p>
        </Card>
      ) : (
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          {upcoming.map((r) => (
            <ReminderRow key={r.id} r={r} bunny={bunny} today={today} />
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-1.5">
          <p className="px-1 text-xs font-bold text-slate-500">{upcoming.length === 0 ? 'Suggested' : 'Also track'}</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((p) => (
              <Link
                key={p.type}
                to={`${newTo}?type=${p.type}`}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-brand-blue/40 hover:text-brand-blue"
              >
                <MbIcon name="plus" size={12} /> {p.title}
                <span className="font-semibold text-slate-400">· {p.hint.replace('Typically ', '')}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <VetNote className="px-1" />

      {upcoming.length > 1 && !isNative && (
        <div className="space-y-1.5 pt-1">
          <button type="button" onClick={addAll} className={`${btn.blue} w-full`}>
            <Icon name="calendar" size={16} /> Add all {upcoming.length} reminders to my phone’s calendar
          </button>
          <CalendarHint className="px-1" />
        </div>
      )}
      {upcoming.length > 1 && isNative && (
        <div className="space-y-1.5 pt-1">
          <button type="button" onClick={() => void remindAll()} className={`${btn.blue} w-full`}>
            <MbIcon name="bell" size={16} /> Remind me about all {upcoming.length} on this phone
          </button>
          {allMsg ? (
            <p className="px-1 text-xs font-bold text-emerald-600">{allMsg}</p>
          ) : (
            <NotifyHint className="px-1" />
          )}
        </div>
      )}

      {completed.length > 0 && (
        <details className="rounded-2xl border border-slate-200/80 bg-slate-50/60 px-4 py-3">
          <summary className="cursor-pointer text-sm font-bold text-slate-600">
            Completed ({completed.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {completed.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-sm text-slate-600">
                <span className="min-w-0 truncate">
                  {r.title} <span className="text-slate-400">· done {r.lastDone ? formatDate(r.lastDone, today) : ''}</span>
                </span>
                <Link to={`/my-bunny/${bunny.id}/reminders/${r.id}/edit`} className="shrink-0 text-xs font-bold text-brand-blue">
                  Edit
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

function ReminderRow({ r, bunny, today }: { r: Reminder; bunny: Bunny; today: string }) {
  const [doneMsg, setDoneMsg] = useState<string | null>(null)
  const [calMsg, setCalMsg] = useState(false)

  const onDone = () => {
    const next = markReminderDone(r.id, today)
    if (!next) return
    // Native app: if this reminder is set on the phone, move it to the new date
    // (a one-off that's now complete has no next date, so it's cancelled).
    if (isUpcoming(next)) void resyncReminder(next, bunny.name)
    else void cancelReminder(next.id)
    setDoneMsg(next.intervalDays ? `Done today — next ${formatDate(next.nextDue, today)}` : 'Done — moved to Completed')
    window.setTimeout(() => setDoneMsg(null), 4000)
  }

  const onCalendar = () => {
    downloadIcs(buildReminderIcs(r, bunny.name), reminderFilename(r, bunny.name))
    setCalMsg(true)
    window.setTimeout(() => setCalMsg(false), 6000)
  }

  if (isNative) return <NativeReminderRow r={r} bunny={bunny} today={today} onDone={onDone} doneMsg={doneMsg} />

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-[15px] font-extrabold text-ink">{r.title}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatInterval(r.intervalDays)}
            {r.lastDone && ` · last done ${formatDate(r.lastDone, today)}`}
          </p>
          {r.notes && <p className="mt-1 text-xs leading-relaxed text-slate-500">{r.notes}</p>}
        </div>
        <DuePill nextDue={r.nextDue} today={today} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={onDone} className={smallBtn}>
          <MbIcon name="check" size={13} /> Mark done
        </button>
        <button type="button" onClick={onCalendar} className={smallBtnBlue}>
          <Icon name="calendar" size={13} /> Add to my phone’s calendar
        </button>
        <Link to={`/my-bunny/${bunny.id}/reminders/${r.id}/edit`} className={smallBtn}>
          <MbIcon name="edit" size={13} /> Edit
        </Link>
      </div>
      {doneMsg && <p className="mt-2 text-xs font-bold text-emerald-600">{doneMsg}</p>}
      {calMsg && (
        <div className="mt-2 space-y-1">
          <CalendarHint />
          <p className="text-xs text-slate-400">
            Use Google Calendar?{' '}
            <a
              href={googleCalendarUrl(reminderEvent(r, bunny.name))}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-brand-blue underline"
            >
              Add it there instead
            </a>
            .
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Inside the Android / iOS app the calendar (.ics) download can't work, so the
 * row offers "Remind me on this phone" — a local notification at 9:00 AM on the
 * due date (and the next few occurrences of a repeat). Tapping again turns it off.
 */
function NativeReminderRow({
  r,
  bunny,
  today,
  onDone,
  doneMsg,
}: {
  r: Reminder
  bunny: Bunny
  today: string
  onDone: () => void
  doneMsg: string | null
}) {
  const [on, setOn] = useState<boolean | null>(null) // null = still checking
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null)

  useEffect(() => {
    let live = true
    // If the plugin can't answer (shouldn't happen in the app), treat it as "not set" so the button still works.
    void isReminderScheduled(r.id).then(
      (v) => live && setOn(v),
      () => live && setOn(false),
    )
    return () => {
      live = false
    }
  }, [r.id, r.nextDue, r.intervalDays])

  const say = (tone: 'ok' | 'warn', text: string, ms = 7000) => {
    setMsg({ tone, text })
    window.setTimeout(() => setMsg(null), ms)
  }

  const toggle = async () => {
    setBusy(true)
    try {
      if (on) {
        await cancelReminder(r.id)
        setOn(false)
        say('ok', 'Reminder turned off on this phone.', 4000)
      } else {
        const res: ScheduleOutcome = await scheduleReminder(r, bunny.name)
        if (res.status === 'scheduled') {
          setOn(true)
          const more = res.count > 1 ? ` (and the next ${res.count - 1} after that)` : ''
          say('ok', `Set — ${formatFireTime(res.first)}${more}.`)
        } else if (res.status === 'denied') {
          say('warn', 'Notifications are turned off for OHRR. Allow them in your phone’s Settings, then tap again.', 10000)
        }
      }
    } catch {
      say('warn', 'Couldn’t set that reminder. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-[15px] font-extrabold text-ink">{r.title}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatInterval(r.intervalDays)}
            {r.lastDone && ` · last done ${formatDate(r.lastDone, today)}`}
          </p>
          {r.notes && <p className="mt-1 text-xs leading-relaxed text-slate-500">{r.notes}</p>}
        </div>
        <DuePill nextDue={r.nextDue} today={today} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={onDone} className={smallBtn}>
          <MbIcon name="check" size={13} /> Mark done
        </button>
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={busy || on === null}
          aria-pressed={on === true}
          className={`${on ? smallBtn : smallBtnBlue} disabled:opacity-60`}
        >
          <MbIcon name="bell" size={13} /> {on ? 'Reminding on this phone' : 'Remind me on this phone'}
        </button>
        <Link to={`/my-bunny/${bunny.id}/reminders/${r.id}/edit`} className={smallBtn}>
          <MbIcon name="edit" size={13} /> Edit
        </Link>
      </div>
      {doneMsg && <p className="mt-2 text-xs font-bold text-emerald-600">{doneMsg}</p>}
      {msg && (
        <p className={`mt-2 text-xs font-bold ${msg.tone === 'ok' ? 'text-emerald-600' : 'text-amber-700'}`}>{msg.text}</p>
      )}
      {on && !msg && (
        <p className="mt-2 text-xs text-slate-400">
          Pops up at 9:00 AM when due — tap the bell again to turn it off.
        </p>
      )}
    </div>
  )
}

/** Native counterpart of CalendarHint. */
function NotifyHint({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs leading-relaxed text-slate-400 ${className}`}>
      Each reminder pops up as a notification on this phone at 9:00 AM on its due date — even if the
      app is closed. Mark it done and the next one is set automatically.
    </p>
  )
}

/* ------------------------------------------------------------- weight */

const UNIT_OPTIONS = ['lb · oz', 'g'] as const
type UnitOption = (typeof UNIT_OPTIONS)[number]
const unitFromOption: Record<UnitOption, WeightUnit> = { 'lb · oz': 'lb', g: 'g' }
const optionFromUnit: Record<WeightUnit, UnitOption> = { lb: 'lb · oz', g: 'g' }

function WeightSection({
  bunny,
  entries,
  unit,
  today,
}: {
  bunny: Bunny
  entries: WeightEntry[]
  unit: WeightUnit
  today: string
}) {
  const latest = entries[entries.length - 1]
  const previous = entries[entries.length - 2]
  const delta = latest && previous ? formatWeightDelta(latest.grams - previous.grams, unit) : null

  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>Weight</SectionLabel>
        <SegTabs options={UNIT_OPTIONS} value={optionFromUnit[unit]} onChange={(o) => setWeightUnit(unitFromOption[o])} />
      </div>
      <Card className="space-y-4">
        {latest ? (
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="font-display text-2xl font-black text-brand-blue">{formatWeight(latest.grams, unit)}</span>
            <span className="text-xs text-slate-500">
              {formatDate(latest.date, today)}
              {delta && previous && (
                <>
                  {' '}
                  · {delta} since {formatDate(previous.date, today)}
                </>
              )}
            </span>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-slate-600">
            No weights logged yet. A kitchen or baby scale works — log one whenever you weigh {bunny.name}.
          </p>
        )}

        <WeightChart entries={entries} unit={unit} />

        <AddWeightForm bunnyId={bunny.id} unit={unit} today={today} latest={latest} />

        {entries.length > 0 && (
          <details className="rounded-xl bg-slate-50 px-3 py-2">
            <summary className="cursor-pointer text-xs font-bold text-slate-500">
              All entries ({entries.length})
            </summary>
            <ul className="mt-1 divide-y divide-slate-200/70">
              {[...entries].reverse().map((e) => (
                <li key={e.date} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                  <span className="text-slate-600">{formatDate(e.date, today)}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-ink">{formatWeight(e.grams, unit)}</span>
                    <button
                      type="button"
                      onClick={() => deleteWeight(bunny.id, e.date)}
                      aria-label={`Delete weight entry for ${formatDate(e.date, today)}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-red-600"
                    >
                      <MbIcon name="trash" size={14} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <p className="text-xs leading-relaxed text-slate-400">
          Stored in grams; shown in {unit === 'lb' ? 'pounds and ounces' : 'grams'}. A steady change over several
          weigh-ins is worth mentioning to your vet.
        </p>
      </Card>
    </section>
  )
}

function AddWeightForm({
  bunnyId,
  unit,
  today,
  latest,
}: {
  bunnyId: string
  unit: WeightUnit
  today: string
  latest?: WeightEntry
}) {
  const [date, setDate] = useState(today)
  const [lb, setLb] = useState('')
  const [oz, setOz] = useState('')
  const [grams, setGrams] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const placeholder = latest ? gramsToLbOz(latest.grams) : null

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    let g = 0
    if (unit === 'g') g = Math.round(parseFloat(grams) || 0)
    else g = lbOzToGrams(parseFloat(lb) || 0, parseFloat(oz) || 0)
    if (!(g > 0)) {
      setErr('Enter a weight above zero.')
      return
    }
    if (g > 20000) {
      setErr('That looks too heavy for a rabbit — check the number.')
      return
    }
    addWeight(bunnyId, { date, grams: g })
    setErr(null)
    setLb('')
    setOz('')
    setGrams('')
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2500)
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2.5 rounded-xl border border-slate-200/80 p-3">
      <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Log a weight</p>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Date">
          <input type="date" className={mbInput} value={date} max={today} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        {unit === 'g' ? (
          <Field label="Grams">
            <input
              type="number"
              inputMode="decimal"
              min={1}
              step={1}
              className={mbInput}
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
              placeholder={latest ? String(latest.grams) : 'e.g. 1900'}
            />
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Field label="lb">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                className={mbInput}
                value={lb}
                onChange={(e) => setLb(e.target.value)}
                placeholder={placeholder ? String(placeholder.lb) : '4'}
              />
            </Field>
            <Field label="oz">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={15.9}
                step={0.1}
                className={mbInput}
                value={oz}
                onChange={(e) => setOz(e.target.value)}
                placeholder={placeholder ? String(placeholder.oz) : '3.2'}
              />
            </Field>
          </div>
        )}
      </div>
      {err && <p className="text-xs font-semibold text-red-600">{err}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" className={`${btn.blue} px-4 py-2`}>
          <MbIcon name="scale" size={15} /> Log weight
        </button>
        {saved && <span className="text-sm font-bold text-emerald-600">Saved</span>}
      </div>
    </form>
  )
}
