import { useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Screen, Card, SectionLabel, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { MbIcon } from '../icons'
import { BunnyAvatar, DuePill, EmergencyCard, PrivacyLine, SaveWarning, dueText } from '../ui'
import { downloadBlob } from '../ics'
import {
  useMyBunny,
  todayIso,
  dueCount,
  dueStatus,
  describeDue,
  formatAge,
  nextReminder,
  exportJson,
  importJson,
  backupFilename,
  type Bunny,
  type MyBunnyData,
} from '../storage'

const SEX_LABEL = { female: 'Female', male: 'Male', unknown: '' } as const

export default function BunnyList() {
  const data = useMyBunny()
  const today = todayIso()
  const counts = dueCount(data, today)
  const hasBunnies = data.bunnies.length > 0

  return (
    <>
      <PageHeader
        icon="heart"
        title="My Bunny"
        subtitle="A care companion for your own rabbit — reminders that live in your phone’s calendar, a weight log, and a profile."
      />
      <Screen className="space-y-5">
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

        {hasBunnies ? (
          <div className="space-y-2.5">
            <SectionLabel>Your rabbits</SectionLabel>
            {data.bunnies.map((b) => (
              <BunnyRow key={b.id} bunny={b} data={data} today={today} />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}

        <Link to="/my-bunny/new" className={`${btn.primary} w-full`}>
          <MbIcon name="plus" size={16} /> {hasBunnies ? 'Add another bunny' : 'Add your bunny'}
        </Link>

        <EmergencyCard />

        <BackupRestore data={data} />
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
        <span className="block truncate font-display text-[16px] font-extrabold text-ink">{bunny.name}</span>
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

function EmptyState() {
  const rows = [
    {
      icon: <MbIcon name="bell" size={20} />,
      title: 'Care reminders in your phone’s calendar',
      text: 'Nail trims, RHDV2 boosters, vet check-ups, hay & pellet restocks — added to your calendar so your phone alerts you.',
    },
    {
      icon: <MbIcon name="scale" size={20} />,
      title: 'A weight log with a trend line',
      text: 'Small changes are easy to miss. Logging weight makes them visible.',
    },
    {
      icon: <Icon name="heart" size={20} />,
      title: 'A profile for each rabbit',
      text: 'Photo, birthday or age, breed, spay/neuter date and notes — handy at the vet.',
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

function BackupRestore({ data }: { data: MyBunnyData }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const weightCount = Object.values(data.weights).reduce((n, list) => n + list.length, 0)

  const backup = () => {
    downloadBlob(new Blob([exportJson(data)], { type: 'application/json' }), backupFilename())
    setMsg({ tone: 'ok', text: 'Backup file saved. Keep it somewhere safe (Files, Drive, email to yourself).' })
  }

  const restore = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const result = importJson(await file.text())
      setMsg({
        tone: 'ok',
        text: `Restored ${result.bunnies} bunn${result.bunnies === 1 ? 'y' : 'ies'}, ${result.reminders} reminder${
          result.reminders === 1 ? '' : 's'
        } and ${result.weights} weight entr${result.weights === 1 ? 'y' : 'ies'}.`,
      })
    } catch (err) {
      setMsg({ tone: 'err', text: err instanceof Error ? err.message : 'Couldn’t read that file.' })
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
          <button type="button" onClick={backup} className={btn.outline} disabled={data.bunnies.length === 0}>
            <MbIcon name="download" size={15} /> Back up
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className={btn.outline}>
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
          On this phone: {data.bunnies.length} bunn{data.bunnies.length === 1 ? 'y' : 'ies'} ·{' '}
          {data.reminders.length} reminder{data.reminders.length === 1 ? '' : 's'} · {weightCount} weight{' '}
          entr{weightCount === 1 ? 'y' : 'ies'}
        </p>
      </Card>
    </section>
  )
}
