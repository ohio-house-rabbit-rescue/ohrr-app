// The health timeline on a bunny's profile: dated notes (often saved from a
// Bunny Help topic) with what you noticed, what you did, a follow-up, and a
// "Resolved" toggle. Local-only, included in Backup / Restore.
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Card, SectionLabel, btn } from '../../components/ui'
import { MbIcon } from './icons'
import { Field, mbInput } from './ui'
import {
  addHealthNote,
  updateHealthNote,
  deleteHealthNote,
  formatDate,
  todayIso,
  type Bunny,
  type HealthNote,
} from './storage'

export default function HealthNotesSection({
  bunny,
  notes,
  today = todayIso(),
}: {
  bunny: Bunny
  notes: HealthNote[]
  today?: string
}) {
  const [adding, setAdding] = useState(false)
  const open = notes.filter((n) => !n.resolved)
  const resolved = notes.filter((n) => n.resolved)

  return (
    <section id="health" className="space-y-2.5">
      <div className="flex items-center justify-between">
        <SectionLabel>Health notes</SectionLabel>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 px-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
          >
            <MbIcon name="plus" size={14} /> Add
          </button>
        )}
      </div>

      {adding && <AddNoteForm bunny={bunny} today={today} onDone={() => setAdding(false)} />}

      {notes.length === 0 && !adding ? (
        <Card className="border-slate-200 bg-slate-50/80">
          <p className="text-sm leading-relaxed text-slate-600">
            Nothing logged yet. Look something up with “{bunny.name} is…” above and save it here, or add a
            note — a dated timeline is handy at the vet.
          </p>
        </Card>
      ) : (
        <>
          {open.length > 0 && (
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              {open.map((n) => (
                <NoteRow key={n.id} note={n} bunny={bunny} today={today} />
              ))}
            </div>
          )}
          {resolved.length > 0 && (
            <details className="rounded-2xl border border-slate-200/80 bg-slate-50/60 px-4 py-3">
              <summary className="cursor-pointer text-sm font-bold text-slate-600">Resolved ({resolved.length})</summary>
              <div className="mt-2 divide-y divide-slate-200/70">
                {resolved.map((n) => (
                  <NoteRow key={n.id} note={n} bunny={bunny} today={today} />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </section>
  )
}

function NoteRow({ note, bunny, today }: { note: HealthNote; bunny: Bunny; today: string }) {
  return (
    <div className="space-y-1.5 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-400">{formatDate(note.date, today)}</p>
          {note.topicSlug && note.topicTitle && (
            <Link
              to={`/my-bunny/help/${note.topicSlug}?bunny=${encodeURIComponent(bunny.id)}`}
              className="mt-0.5 inline-flex items-center rounded-full bg-brand-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-brand-blue"
            >
              {note.topicTitle}
            </Link>
          )}
          <p className={`mt-1 text-sm leading-relaxed ${note.resolved ? 'text-slate-500' : 'text-ink'}`}>{note.noticed}</p>
          {note.did && (
            <p className="text-sm leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-500">Did:</span> {note.did}
            </p>
          )}
          {note.followUp && (
            <p className="text-sm leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-500">Follow-up:</span> {note.followUp}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Delete this health note?')) deleteHealthNote(note.id)
          }}
          aria-label="Delete note"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-red-600"
        >
          <MbIcon name="trash" size={15} />
        </button>
      </div>
      <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
        <input
          type="checkbox"
          checked={note.resolved}
          onChange={(e) => updateHealthNote(note.id, { resolved: e.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue/30"
        />
        Resolved
      </label>
    </div>
  )
}

function AddNoteForm({ bunny, today, onDone }: { bunny: Bunny; today: string; onDone: () => void }) {
  const [date, setDate] = useState(today)
  const [noticed, setNoticed] = useState('')
  const [did, setDid] = useState('')
  const [followUp, setFollowUp] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!noticed.trim()) return
    addHealthNote({ bunnyId: bunny.id, date, noticed, did, followUp, resolved: false })
    onDone()
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Date">
          <input type="date" className={mbInput} value={date} max={today} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="What you noticed">
          <textarea className={mbInput} rows={2} value={noticed} onChange={(e) => setNoticed(e.target.value)} maxLength={500} required />
        </Field>
        <Field label="What you did" optional>
          <input className={mbInput} value={did} onChange={(e) => setDid(e.target.value)} maxLength={300} />
        </Field>
        <Field label="Follow-up" optional>
          <input className={mbInput} value={followUp} onChange={(e) => setFollowUp(e.target.value)} maxLength={200} />
        </Field>
        <div className="flex gap-2">
          <button type="submit" className={`${btn.primary} flex-1`}>
            Save note
          </button>
          <button
            type="button"
            onClick={onDone}
            className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </Card>
  )
}
