import { useEffect, useState } from 'react'
import type { Session } from '../data/sessions'
import { event } from '../data/event'
import { downloadIcs, googleCalendarUrl } from '../lib/ics'
import { Icon } from './icons'
import { isNative } from '../native/platform'

// A bottom-sheet chooser for adding saved sessions to a calendar. Apple/iOS gets
// a single .ics with every saved session; Google Calendar adds one event per
// link (Google's template endpoint is one-at-a-time), so those are listed out.
export default function CalendarSheet({
  sessions,
  onClose,
}: {
  sessions: Session[]
  onClose: () => void
}) {
  // Inside the native app a blob (.ics) download can't reach the calendar app, so
  // only the Google links are offered there (they open in the system browser).
  const [showGoogle, setShowGoogle] = useState(isNative)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Add to calendar"
    >
      <button className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />

      <div className="relative z-10 max-h-[85vh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 shadow-2xl">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200" />

        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-extrabold text-ink">Add to your calendar</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {sessions.length} session{sessions.length === 1 ? '' : 's'} · {event.dateShort}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
          >
            <Icon name="chevron" size={18} className="rotate-90" />
          </button>
        </div>

        {/* Apple / iOS — one file, all sessions (web only) */}
        {!isNative && (
        <button
          type="button"
          onClick={() => {
            downloadIcs(sessions, 'my-bunfest-schedule.ics')
            onClose()
          }}
          className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 p-3.5 text-left transition hover:border-slate-300 hover:bg-slate-50"
        >
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Icon name="apple" size={24} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[15px] font-extrabold text-ink">
              Apple / iOS Calendar
            </span>
            <span className="mt-0.5 block text-sm text-slate-500">
              Adds all {sessions.length} at once (.ics file)
            </span>
          </span>
        </button>
        )}

        {/* Google — one event per link */}
        <button
          type="button"
          onClick={() => setShowGoogle((v) => !v)}
          aria-expanded={showGoogle}
          className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-slate-200 p-3.5 text-left transition hover:border-slate-300 hover:bg-slate-50"
        >
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-blue-50 text-brand-blue">
            <Icon name="calendar" size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[15px] font-extrabold text-ink">
              Google Calendar
            </span>
            <span className="mt-0.5 block text-sm text-slate-500">
              Tap a session to add it
            </span>
          </span>
          <Icon
            name="chevron"
            size={18}
            className={`shrink-0 text-slate-300 transition ${showGoogle ? 'rotate-90' : ''}`}
          />
        </button>

        {showGoogle && (
          <ul className="mt-2 space-y-1.5 rounded-2xl bg-slate-50 p-2">
            {sessions.map((s) => {
              const url = googleCalendarUrl(s)
              if (!url) return null
              return (
                <li key={s.id}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm transition hover:bg-brand-blue-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-brand-orange">{s.time}</span>
                      <span className="block truncate text-sm font-semibold text-ink">{s.title}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue">
                      Add <Icon name="external" size={14} />
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
        )}

        <p className="mt-4 text-center text-xs text-slate-400">
          {isNative ? 'Each link opens Google Calendar in your browser' : 'On iPhone choose Apple · on Android choose Google'}
        </p>
      </div>
    </div>
  )
}
