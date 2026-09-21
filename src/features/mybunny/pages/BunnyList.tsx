import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Screen, Card, SectionLabel, SegTabs, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { MbIcon } from '../icons'
import {
  AvatarRow,
  BunnyAvatar,
  DuePill,
  EmergencyCard,
  FluffleNote,
  PrivacyLine,
  RoleChip,
  SaveWarning,
  dueText,
  useDocumentTitle,
} from '../ui'
import { downloadBlob } from '../ics'
import { isNative } from '../../../native/platform'
import HelpSearch from '../../bunnyhelp/HelpSearch'
import {
  useMyBunny,
  todayIso,
  dueCount,
  dueStatus,
  describeDue,
  formatAge,
  formatDate,
  nextReminder,
  activeBunnies,
  archivedBunnies,
  atBunnyLimit,
  collectionTitle,
  exportBackup,
  importBackup,
  backupFilename,
  BUNNY_ROLES,
  ROLE_LABEL,
  ARCHIVE_REASON_LABEL,
  MAX_BUNNIES,
  type Bunny,
  type BunnyRole,
  type MyBunnyData,
} from '../storage'

const SEX_LABEL = { female: 'Female', male: 'Male', unknown: '' } as const

/** Above this many active bunnies the list gets a search box and a role filter. */
const FILTER_THRESHOLD = 8

const ALL_ROLES = 'All'
const ROLE_FILTERS = [ALL_ROLES, ...BUNNY_ROLES.map((r) => ROLE_LABEL[r])] as const
type RoleFilter = (typeof ROLE_FILTERS)[number]
function roleForFilter(f: RoleFilter): BunnyRole | null {
  return BUNNY_ROLES.find((r) => ROLE_LABEL[r] === f) ?? null
}

// Inside the Android/iOS app reminders are phone notifications; on the web they
// go into the phone's calendar (see src/native/notifications.ts).
const REMINDER_WORDS = isNative ? 'reminders that pop up on this phone' : 'reminders that live in your phone’s calendar'
const SUBTITLE: Record<string, string> = {
  'My Bunny': `A care companion for your own rabbit — ${REMINDER_WORDS}, a weight log, and a profile.`,
  'My Bunnies': `Both of your rabbits in one place — ${REMINDER_WORDS}, weight logs, and a profile each.`,
  'My Fluffle': 'Every rabbit in your care in one place — reminders, weight logs, health notes and a profile each.',
}

export default function BunnyList() {
  const data = useMyBunny()
  const today = todayIso()
  const counts = dueCount(data, today)
  const active = activeBunnies(data)
  const archived = archivedBunnies(data)
  const hasBunnies = active.length > 0
  const title = collectionTitle(active.length)
  const isFluffle = active.length >= 3
  useDocumentTitle(title)

  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>(ALL_ROLES)
  const filtering = active.length > FILTER_THRESHOLD
  const shown = useMemo(() => {
    if (!filtering) return active
    const q = query.trim().toLowerCase()
    const role = roleForFilter(roleFilter)
    return active.filter((b) => (!q || b.name.toLowerCase().includes(q)) && (!role || b.role === role))
  }, [active, filtering, query, roleFilter])

  return (
    <>
      <PageHeader icon="heart" title={title} subtitle={SUBTITLE[title]} />
      <Screen className="space-y-5">
        {isFluffle && <FluffleNote />}
        <PrivacyLine />
        <SaveWarning />

        {counts.total > 0 && (
          <Card
            className={
              counts.overdue > 0 ? 'border-red-200 bg-red-50/70' : 'border-brand-orange/30 bg-brand-orange-50/60'
            }
          >
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                  counts.overdue > 0 ? 'bg-red-100 text-red-700' : 'bg-brand-orange-50 text-brand-orange'
                }`}
              >
                <MbIcon name="bell" size={20} />
              </span>
              <div className="min-w-0">
                <p className="font-display text-[15px] font-extrabold text-ink">
                  {counts.total} reminder{counts.total === 1 ? '' : 's'} need{counts.total === 1 ? 's' : ''}{' '}
                  attention
                </p>
                <p className="text-sm text-slate-600">
                  {[
                    counts.overdue > 0 && `${counts.overdue} overdue`,
                    counts.today > 0 && `${counts.today} due today`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* 3+: the fluffle at a glance — tap a face to open that bunny */}
        {isFluffle && (
          <Card className="px-3 py-3">
            <AvatarRow bunnies={active} showAdd={!atBunnyLimit(data)} />
          </Card>
        )}

        {/* Bunny Help — routes "my bunny is…" to OHRR's own guidance */}
        <HelpSearch bunnyId={active.length === 1 ? active[0].id : undefined} />

        {hasBunnies ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <SectionLabel>Your rabbits</SectionLabel>
              <span className="text-xs font-bold text-slate-400">
                {active.length} of {MAX_BUNNIES}
              </span>
            </div>

            {filtering && (
              <div className="space-y-2">
                <span className="relative block">
                  <Icon name="search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name"
                    autoComplete="off"
                    aria-label="Search your rabbits by name"
                    className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-ink outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                  />
                </span>
                <SegTabs options={ROLE_FILTERS} value={roleFilter} onChange={setRoleFilter} />
              </div>
            )}

            {shown.length === 0 ? (
              <Card className="border-slate-200 bg-slate-50/80">
                <p className="text-sm text-slate-600">No rabbits match that.</p>
              </Card>
            ) : (
              shown.map((b) => <BunnyRow key={b.id} bunny={b} data={data} today={today} />)
            )}
          </div>
        ) : (
          <EmptyState />
        )}

        {atBunnyLimit(data) ? (
          <p className="text-center text-xs leading-relaxed text-slate-500">
            That’s {MAX_BUNNIES} active bunnies — the most My Bunny keeps. Archive or remove one to add another.
          </p>
        ) : (
          <Link to="/my-bunny/new" className={`${btn.primary} w-full`}>
            <MbIcon name="plus" size={16} /> {hasBunnies ? 'Add another bunny' : 'Add your bunny'}
          </Link>
        )}

        {archived.length > 0 && <ArchivedSection bunnies={archived} today={today} />}

        <EmergencyCard />

        <BackupRestore data={data} activeCount={active.length} archivedCount={archived.length} />
      </Screen>
    </>
  )
}

function BunnyRow({ bunny, data, today }: { bunny: Bunny; data: MyBunnyData; today: string }) {
  const age = formatAge(bunny, today)
  const meta = [age, bunny.sex ? SEX_LABEL[bunny.sex] : '', bunny.breed].filter(Boolean).join(' · ')
  const next = nextReminder(data, bunny.id)
  const status = next ? dueStatus(next.nextDue, today) : null

  return (
    <Link
      to={`/my-bunny/${bunny.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md active:translate-y-0"
    >
      <BunnyAvatar bunny={bunny} size={56} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 truncate font-display text-[16px] font-extrabold text-ink">{bunny.name}</span>
          <RoleChip role={bunny.role} className="shrink-0" />
        </span>
        {meta && <span className="mt-0.5 block truncate text-sm text-slate-500">{meta}</span>}
        {next && status ? (
          <span className={`mt-1 flex items-center gap-1.5 text-xs font-semibold ${dueText[status]}`}>
            <MbIcon name="bell" size={13} className="shrink-0" />
            <span className="truncate">
              {next.title} · {describeDue(next.nextDue, today)}
            </span>
          </span>
        ) : (
          <span className="mt-1 block text-xs text-slate-400">No reminders yet</span>
        )}
      </span>
      {next && status && (status === 'overdue' || status === 'today') ? (
        <DuePill nextDue={next.nextDue} today={today} />
      ) : (
        <Icon name="chevron" size={18} className="shrink-0 text-slate-300 transition group-hover:text-brand-orange" />
      )}
    </Link>
  )
}

/** Collapsed list of bunnies who've left — records kept, tap to open (in an archived state). */
function ArchivedSection({ bunnies, today }: { bunnies: Bunny[]; today: string }) {
  return (
    <details className="rounded-2xl border border-slate-200/80 bg-slate-50/60 px-4 py-3">
      <summary className="cursor-pointer text-sm font-bold text-slate-600">Archived ({bunnies.length})</summary>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">
        Not shown on Home or counted in reminders, but every record is kept. Open one to see it or bring it back.
      </p>
      <div className="mt-2 divide-y divide-slate-200/70">
        {bunnies.map((b) => (
          <Link key={b.id} to={`/my-bunny/${b.id}`} className="group flex items-center gap-3 py-2.5">
            <BunnyAvatar bunny={b} size={40} className="opacity-70 grayscale-[35%]" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="min-w-0 truncate text-sm font-bold text-slate-700">{b.name}</span>
                <RoleChip role={b.role} className="shrink-0" />
              </span>
              <span className="block truncate text-xs text-slate-500">
                {b.archived ? `${ARCHIVE_REASON_LABEL[b.archived.reason]} · ${formatDate(b.archived.date, today)}` : ''}
              </span>
            </span>
            <Icon name="chevron" size={16} className="shrink-0 text-slate-300 transition group-hover:text-brand-orange" />
          </Link>
        ))}
      </div>
    </details>
  )
}

function EmptyState() {
  const rows = [
    {
      icon: <MbIcon name="bell" size={20} />,
      title: isNative ? 'Care reminders on this phone' : 'Care reminders in your phone’s calendar',
      text: isNative
        ? 'Nail trims, RHDV2 boosters, vet check-ups, hay & pellet restocks — a notification at 9 AM on the day, even if the app is closed.'
        : 'Nail trims, RHDV2 boosters, vet check-ups, hay & pellet restocks — added to your calendar so your phone alerts you.',
    },
    {
      icon: <MbIcon name="scale" size={20} />,
      title: 'A weight log with a trend line',
      text: 'Small changes are easy to miss. Logging weight makes them visible.',
    },
    {
      icon: <Icon name="heart" size={20} />,
      title: 'A profile for each rabbit',
      text: 'Photo, birthday or age, breed, spay/neuter date and notes — handy at the vet. Foster or sponsor? Keep every rabbit in your care here.',
    },
  ]
  return (
    <Card className="space-y-4">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-wider text-brand-blue">Your rabbit’s care companion</p>
        <h2 className="mt-1 font-display text-xl font-black text-ink">Keep your bunny’s care on track</h2>
      </div>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.title} className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-blue-50 text-brand-blue">
              {r.icon}
            </span>
            <span>
              <span className="block text-sm font-bold text-ink">{r.title}</span>
              <span className="mt-0.5 block text-sm leading-relaxed text-slate-500">{r.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function BackupRestore({
  data,
  activeCount,
  archivedCount,
}: {
  data: MyBunnyData
  activeCount: number
  archivedCount: number
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const weightCount = Object.values(data.weights).reduce((n, list) => n + list.length, 0)
  const total = activeCount + archivedCount

  const backup = async () => {
    setBusy(true)
    try {
      const text = await exportBackup()
      const blob = new Blob([text], { type: 'application/json' })
      if (isNative) {
        // No blob downloads in the WebView: hand the file to the share sheet (Files, Drive, Mail).
        const { shareFileNative } = await import('../../../native/share')
        const out = await shareFileNative(blob, backupFilename(), undefined, 'My Bunny backup')
        if (out === 'shared') setMsg({ tone: 'ok', text: 'Backup sent to the share sheet — save it to Files or Drive, or mail it to yourself.' })
      } else {
        downloadBlob(blob, backupFilename())
        setMsg({
          tone: 'ok',
          text: 'Backup file saved — photos and archived bunnies included. Keep it somewhere safe (Files, Drive, email to yourself).',
        })
      }
    } catch (err) {
      setMsg({ tone: 'err', text: err instanceof Error ? err.message : 'Couldn’t make the backup.' })
    } finally {
      setBusy(false)
    }
  }

  const restore = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const result = await importBackup(await file.text())
      setMsg({
        tone: 'ok',
        text: `Restored ${result.bunnies} bunn${result.bunnies === 1 ? 'y' : 'ies'}, ${result.reminders} reminder${
          result.reminders === 1 ? '' : 's'
        }, ${result.weights} weight entr${result.weights === 1 ? 'y' : 'ies'}, ${result.health} health note${
          result.health === 1 ? '' : 's'
        } and ${result.photos} photo${result.photos === 1 ? '' : 's'}.`,
      })
    } catch (err) {
      setMsg({ tone: 'err', text: err instanceof Error ? err.message : 'Couldn’t read that file.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-2">
      <SectionLabel>Backup &amp; restore</SectionLabel>
      <Card className="space-y-3">
        <p className="text-sm leading-relaxed text-slate-600">
          Because this data lives only on this phone, a backup file is how you keep a copy or move
          it to a new phone. Restoring adds anything from the backup that isn’t already here.
        </p>
        <div className="flex flex-wrap gap-2">
          {/* In the app the backup goes out through the share sheet (src/native/share.ts). */}
          <button
            type="button"
            onClick={backup}
            className={`${btn.outline} disabled:opacity-60`}
            disabled={total === 0 || busy}
          >
            <MbIcon name="download" size={15} /> Back up
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={`${btn.outline} disabled:opacity-60`}
            disabled={busy}
          >
            <MbIcon name="upload" size={15} /> Restore from a file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={restore}
            aria-label="Choose a My Bunny backup file"
          />
        </div>
        {msg && (
          <p className={`text-sm font-semibold ${msg.tone === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
            {msg.text}
          </p>
        )}
        <p className="text-xs text-slate-400">
          On this phone: {total} bunn{total === 1 ? 'y' : 'ies'}
          {archivedCount > 0 ? ` (${archivedCount} archived)` : ''} · {data.reminders.length} reminder
          {data.reminders.length === 1 ? '' : 's'} · {weightCount} weight entr{weightCount === 1 ? 'y' : 'ies'}
        </p>
      </Card>
    </section>
  )
}
