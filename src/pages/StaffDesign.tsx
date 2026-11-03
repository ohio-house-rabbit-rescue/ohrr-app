// Staff → Web page design: how the app AND the website look, from one place.
//
// Colors, a soft picture behind the pages, a picture behind the home welcome band, and which
// sections the home page shows and in what order. It is saved once (app_settings `design_site`)
// and both sites read it, so they always match. For Founders, Developers and anyone given the
// "Web page admin" task; the database checks the same thing (update 54).
//
// While someone edits, the new look is tried on this screen only. Nothing changes for visitors
// until they tap Publish, and every published look is kept so it can be put back.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { errMessage } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Card, Screen } from '../components/ui'
import { Icon } from '../components/icons'
import { StaffTitle } from '../components/StaffTitle'
import { ChoiceCard, EditorForm, Field, Part } from '../components/StaffJob'
import StaffImageField from '../components/StaffImageField'
import { Spinner } from '../components/staffui'
import { StatusNote } from '../features/scan/ScanUI'
import { fetchSettings, setSetting } from '../features/settings/useSetting'
import { useCanDesign } from '../lib/designAccess'
import {
  DEFAULT_BLUE,
  DEFAULT_DESIGN,
  DEFAULT_ORANGE,
  DESIGN_HISTORY_KEY,
  DESIGN_HISTORY_MAX,
  DESIGN_KEY,
  HOME_SECTIONS,
  colorProblem,
  getPublishedDesign,
  parseDesign,
  previewDesign,
  resolveHome,
  setPublishedDesign,
  type SectionSetting,
  type SiteDesign,
  type Surface,
} from '../lib/design'
import type { Json } from '../lib/database.types'

interface Ctx {
  orgId: string
  userId: string
}

interface HistoryItem {
  at: string
  label: string
  design: SiteDesign
}

function parseHistory(v: Json | undefined): HistoryItem[] {
  const items = v && typeof v === 'object' && !Array.isArray(v) ? v.items : null
  if (!Array.isArray(items)) return []
  const out: HistoryItem[] = []
  for (const it of items) {
    if (!it || typeof it !== 'object' || Array.isArray(it)) continue
    if (typeof it.at !== 'string' || typeof it.label !== 'string') continue
    out.push({ at: it.at, label: it.label.slice(0, 120), design: parseDesign(it.design) })
  }
  return out.slice(0, DESIGN_HISTORY_MAX)
}

const sameDesign = (a: SiteDesign, b: SiteDesign) => JSON.stringify(a) === JSON.stringify(b)

/** Save a new look for everyone, keeping the one it replaces so it can be put back. */
async function publish(next: SiteDesign, label: string, ctx: Ctx): Promise<void> {
  const rows = await fetchSettings(ctx.orgId)
  const before = rows[DESIGN_KEY] == null ? DEFAULT_DESIGN : parseDesign(rows[DESIGN_KEY])
  const clean = parseDesign(next)
  if (!sameDesign(before, clean)) {
    const history: HistoryItem[] = [
      { at: new Date().toISOString(), label, design: before },
      ...parseHistory(rows[DESIGN_HISTORY_KEY]),
    ].slice(0, DESIGN_HISTORY_MAX)
    await setSetting(DESIGN_HISTORY_KEY, { items: history } as unknown as Json, ctx)
  }
  await setSetting(DESIGN_KEY, clean as unknown as Json, ctx)
  setPublishedDesign(clean)
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/* ------------------------------------------------------------------ */

export default function StaffDesign() {
  const { part } = useParams()
  const { user, membership } = useAuth()
  const { ready, can } = useCanDesign()
  const [note, setNote] = useState<string | null>(null)

  // Whatever was being tried goes back to the published look when this screen is left.
  useEffect(() => () => previewDesign(null), [])

  if (!ready) return <Spinner />
  if (!can || !membership || !user) {
    return (
      <Screen className="space-y-3 pt-2">
        <StaffTitle title="Web page design" />
        <Card className="border-slate-200 bg-slate-50/80">
          <p className="text-[15px] leading-relaxed text-slate-600">
            This is for the people who look after how the app and website look. Ask a Founder to give you the “Web page admin” task if you should have it.
          </p>
        </Card>
      </Screen>
    )
  }
  const ctx: Ctx = { orgId: membership.orgId, userId: user.id }
  const done = (text: string) => {
    setNote(text)
  }

  if (part === 'colors') return <Colors ctx={ctx} onDone={done} />
  if (part === 'pictures') return <Pictures ctx={ctx} onDone={done} />
  if (part === 'home') return <HomeSections ctx={ctx} onDone={done} />
  if (part === 'history') return <History ctx={ctx} onDone={done} />
  if (part) return <Navigate to="/staff/design" replace />

  return (
    <Screen className="space-y-4 pt-2">
      <StaffTitle title="Web page design">
        <p>
          Change how OHRR looks, once, for the app and the website together. Nothing changes for visitors until you tap Publish, and the
          look it replaces is kept so you can put it back.
        </p>
      </StaffTitle>
      {note && (
        <StatusNote key={note} className="rounded-2xl bg-emerald-50 px-4 py-3 text-[15px] font-semibold text-emerald-800">
          {note}
        </StatusNote>
      )}
      <div className="space-y-3">
        <ChoiceCard to="/staff/design/colors" icon="sparkles" title="Colors" text="The blue and the orange. The lighter and darker shades follow." />
        <ChoiceCard to="/staff/design/pictures" icon="camera" title="Background pictures" text="A soft picture behind the pages, and one behind the welcome band." />
        <ChoiceCard to="/staff/design/home" icon="home" title="Home page sections" text="Which sections show, and in what order." />
        <ChoiceCard to="/staff/design/history" icon="clock" title="Earlier looks" text="Put an earlier look back, or go back to the standard one." />
      </div>
    </Screen>
  )
}

/* ------------------------------------------------------------------ */
/* A part's frame: title, back link                                    */
/* ------------------------------------------------------------------ */

function Back() {
  return (
    <Link to="/staff/design" className="inline-flex min-h-[44px] items-center gap-1 text-[15px] font-bold text-brand-blue">
      <Icon name="chevron" size={14} className="rotate-180" /> Web page design
    </Link>
  )
}

/** Shared by the three edit screens: the draft, trying it, publishing it. */
function useDraft(ctx: Ctx, onDone: (text: string) => void, label: string, success: string) {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<SiteDesign>(() => getPublishedDesign())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Try the draft on this screen as it changes.
  useEffect(() => {
    previewDesign(draft)
  }, [draft])

  const save = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await publish(draft, label, ctx)
      onDone(success)
      navigate('/staff/design')
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(false)
    }
  }, [draft, label, ctx, onDone, success, navigate])

  return { draft, setDraft, busy, error, save, cancel: () => navigate('/staff/design') }
}

/* ------------------------------------------------------------------ */

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="color"
        aria-label={`${label} color picker`}
        value={value}
        onChange={(e) => onChange(e.target.value.toLowerCase())}
        className="h-14 w-20 cursor-pointer rounded-xl border-2 border-slate-200 bg-white p-1"
      />
      <input
        aria-label={`${label} color code`}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value.toLowerCase())
        }}
        maxLength={7}
        spellCheck={false}
        className="min-h-[48px] w-32 rounded-xl border-2 border-slate-200 bg-white px-3 font-mono text-base"
      />
    </div>
  )
}

function Colors({ ctx, onDone }: { ctx: Ctx; onDone: (text: string) => void }) {
  const { draft, setDraft, busy, error, save, cancel } = useDraft(ctx, onDone, 'Colors', 'Published. The app and the website now use these colors.')
  const problem = useMemo(() => colorProblem(draft.blue, draft.orange), [draft.blue, draft.orange])
  const isStandard = draft.blue === DEFAULT_BLUE && draft.orange === DEFAULT_ORANGE

  // Only a safe pair is tried on the screen.
  const set = (k: 'blue' | 'orange', v: string) => setDraft((d) => ({ ...d, [k]: v }))
  useEffect(() => {
    if (problem) previewDesign(null)
  }, [problem])

  return (
    <Screen className="space-y-3 pt-2">
      <Back />
      <EditorForm
        title="Colors"
        hint="Pick the two colors. This whole screen shows the result as you pick; visitors see nothing until you Publish."
        onSubmit={save}
        onCancel={cancel}
        busy={busy}
        saveLabel="Publish these colors"
        canSave={!problem}
        error={error ?? problem}
      >
        <div className="space-y-3">
          <Part n="A">Blue</Part>
          <p className="text-sm text-slate-600">Buttons, links and the welcome band. White words sit on it, so it has to be a strong blue.</p>
          <ColorField label="Blue" value={draft.blue} onChange={(v) => set('blue', v)} />
        </div>
        <div className="space-y-3">
          <Part n="B">Orange</Part>
          <p className="text-sm text-slate-600">The highlight: Volunteer, Donate and call-outs. Dark words sit on it.</p>
          <ColorField label="Orange" value={draft.orange} onChange={(v) => set('orange', v)} />
        </div>
        <Field label="Put the standard colors back" hint="OHRR blue and orange, as the logo has them.">
          <button
            type="button"
            disabled={isStandard}
            onClick={() => setDraft((d) => ({ ...d, blue: DEFAULT_BLUE, orange: DEFAULT_ORANGE }))}
            className="mt-2 inline-flex min-h-[44px] items-center rounded-full border-2 border-slate-200 bg-white px-4 text-[15px] font-bold text-slate-700 disabled:opacity-50"
          >
            Use the standard colors
          </button>
        </Field>
      </EditorForm>
    </Screen>
  )
}

/* ------------------------------------------------------------------ */

function PictureSlot({
  ctx,
  title,
  hint,
  slot,
  draft,
  setDraft,
  setBusy,
}: {
  ctx: Ctx
  title: string
  hint: string
  slot: 'pageImage' | 'bandImage'
  draft: SiteDesign
  setDraft: React.Dispatch<React.SetStateAction<SiteDesign>>
  setBusy: (b: boolean) => void
}) {
  const img = draft[slot]
  const patch = (p: Partial<typeof img>) => setDraft((d) => ({ ...d, [slot]: { ...d[slot], ...p } }))
  return (
    <div className="space-y-3">
      <StaffImageField
        label={title}
        hint={hint}
        value={img.url ?? ''}
        userId={ctx.userId}
        onChange={(url) => patch({ url: url || null })}
        onBusyChange={setBusy}
      />
      {img.url && (
        <label className="block text-sm font-semibold text-slate-700">
          How soft: {img.veil} %
          <input
            type="range"
            min={0}
            max={90}
            step={5}
            value={img.veil}
            onChange={(e) => patch({ veil: Number(e.target.value) })}
            className="mt-2 block w-full"
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            More softness lets the page’s own words stand out. A busy picture needs more.
          </span>
        </label>
      )}
    </div>
  )
}

function Pictures({ ctx, onDone }: { ctx: Ctx; onDone: (text: string) => void }) {
  const { draft, setDraft, busy, error, save, cancel } = useDraft(ctx, onDone, 'Background pictures', 'Published. The app and the website now use these pictures.')
  const [uploading, setUploading] = useState(false)
  return (
    <Screen className="space-y-3 pt-2">
      <Back />
      <EditorForm
        title="Background pictures"
        hint="Both are optional. A light, simple picture works best; the pages’ words are always kept readable."
        onSubmit={save}
        onCancel={cancel}
        busy={busy || uploading}
        saveLabel="Publish these pictures"
        error={error}
      >
        <div className="space-y-3">
          <Part n="A" hint="optional">Behind the pages</Part>
          <PictureSlot
            ctx={ctx}
            title="Page picture"
            hint="Shows faintly behind every public page of the app and the website."
            slot="pageImage"
            draft={draft}
            setDraft={setDraft}
            setBusy={setUploading}
          />
        </div>
        <div className="space-y-3">
          <Part n="B" hint="optional">Behind the welcome band</Part>
          <PictureSlot
            ctx={ctx}
            title="Welcome band picture"
            hint="The blue band at the top of the home page. Leave it empty for the plain band."
            slot="bandImage"
            draft={draft}
            setDraft={setDraft}
            setBusy={setUploading}
          />
        </div>
      </EditorForm>
    </Screen>
  )
}

/* ------------------------------------------------------------------ */

function HomeSections({ ctx, onDone }: { ctx: Ctx; onDone: (text: string) => void }) {
  const { draft, setDraft, busy, error, save, cancel } = useDraft(ctx, onDone, 'Home page sections', 'Published. The home pages now follow this list.')
  const [surface, setSurface] = useState<Surface>('web')
  const rows = resolveHome(surface, draft)
  const info = HOME_SECTIONS[surface]

  const update = (next: SectionSetting[]) => setDraft((d) => ({ ...d, home: { ...d.home, [surface]: next } }))
  const toggle = (id: string) => update(rows.map((r) => (r.id === id ? { ...r, on: !r.on } : r)))
  const move = (i: number, by: -1 | 1) => {
    const j = i + by
    if (j < 0 || j >= rows.length) return
    const next = rows.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    update(next)
  }

  return (
    <Screen className="space-y-3 pt-2">
      <Back />
      <EditorForm
        title="Home page sections"
        hint="The welcome band at the top is always there. The website and the app share some sections and each has some of its own, so each has its own list."
        onSubmit={save}
        onCancel={cancel}
        busy={busy}
        saveLabel="Publish this order"
        error={error}
      >
        <div className="flex gap-2" role="group" aria-label="Which home page">
          {(['web', 'app'] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={surface === s}
              onClick={() => setSurface(s)}
              className={`min-h-[48px] flex-1 rounded-2xl border-2 px-4 text-base font-bold ${
                surface === s ? 'border-brand-blue bg-brand-blue text-white' : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              {s === 'web' ? 'The website' : 'The app'}
            </button>
          ))}
        </div>
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
          {rows.map((r, i) => {
            const meta = info.find((x) => x.id === r.id)
            return (
              <li key={r.id} className="flex items-center gap-2 px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className={`block text-base font-bold ${r.on ? 'text-ink' : 'text-slate-400 line-through'}`}>{meta?.label ?? r.id}</span>
                  <span className="block text-sm text-slate-500">{meta?.hint}</span>
                </span>
                <button
                  type="button"
                  aria-label={`Move ${meta?.label} up`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-slate-200 text-slate-700 disabled:opacity-30"
                >
                  <Icon name="chevron" size={16} className="-rotate-90" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${meta?.label} down`}
                  disabled={i === rows.length - 1}
                  onClick={() => move(i, 1)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-slate-200 text-slate-700 disabled:opacity-30"
                >
                  <Icon name="chevron" size={16} className="rotate-90" />
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={r.on}
                  aria-label={`Show ${meta?.label}`}
                  onClick={() => toggle(r.id)}
                  className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition ${r.on ? 'bg-brand-blue' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${r.on ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </li>
            )
          })}
        </ul>
      </EditorForm>
    </Screen>
  )
}

/* ------------------------------------------------------------------ */

function History({ ctx, onDone }: { ctx: Ctx; onDone: (text: string) => void }) {
  const navigate = useNavigate()
  const [items, setItems] = useState<HistoryItem[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    fetchSettings(ctx.orgId)
      .then((rows) => live && setItems(parseHistory(rows[DESIGN_HISTORY_KEY])))
      .catch((e) => live && (setItems([]), setError(errMessage(e))))
    return () => {
      live = false
    }
  }, [ctx.orgId])

  const putBack = async (design: SiteDesign, label: string, success: string) => {
    setBusy(true)
    setError(null)
    try {
      await publish(design, label, ctx)
      onDone(success)
      navigate('/staff/design')
    } catch (e) {
      setError(errMessage(e))
      setBusy(false)
    }
  }

  return (
    <Screen className="space-y-3 pt-2">
      <Back />
      <StaffTitle title="Earlier looks">
        <p>Each time you publish, the look it replaces is kept here (the last {DESIGN_HISTORY_MAX}). Putting one back keeps the current one here too, so nothing is lost.</p>
      </StaffTitle>
      {items == null ? (
        <Spinner />
      ) : (
        <Card className="space-y-3">
          {items.length === 0 && <p className="text-[15px] text-slate-600">Nothing has been replaced yet.</p>}
          <ul className="divide-y divide-slate-100">
            {items.map((h, i) => (
              <li key={h.at + i} className="flex flex-wrap items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold text-ink">Before “{h.label}”</span>
                  <span className="block text-sm text-slate-500">replaced {when(h.at)}</span>
                  <span className="mt-1 flex items-center gap-1.5" aria-hidden="true">
                    <span className="inline-block h-5 w-5 rounded-full border border-black/10" style={{ background: h.design.blue }} />
                    <span className="inline-block h-5 w-5 rounded-full border border-black/10" style={{ background: h.design.orange }} />
                  </span>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm('Put this look back for the app and the website?')) void putBack(h.design, 'Put an earlier look back', 'Put back. The app and the website look like that again.')
                  }}
                  className="inline-flex min-h-[44px] items-center rounded-full border-2 border-slate-200 bg-white px-4 text-[15px] font-bold text-brand-blue disabled:opacity-50"
                >
                  Put this one back
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-100 pt-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Go back to the standard OHRR look for the app and the website? Your colors, pictures and home order are replaced (and kept here).')) {
                  void putBack(DEFAULT_DESIGN, 'Standard look', 'The standard OHRR look is back on the app and the website.')
                }
              }}
              className="inline-flex min-h-[48px] items-center rounded-2xl border-2 border-red-200 bg-white px-5 text-base font-bold text-red-700 disabled:opacity-50"
            >
              Go back to the standard OHRR look
            </button>
          </div>
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {error}
            </p>
          )}
        </Card>
      )}
    </Screen>
  )
}
