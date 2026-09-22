import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Screen, Card, btn } from '../components/ui'
import { Icon } from '../components/icons'
import PhotoField from '../components/PhotoField'
import { ohrr } from '../data/ohrr'
import { submitRequest } from '../lib/requests'
import { useFormDraft, DRAFT_NOTE } from '../lib/formDraft'

const input =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20'


export default function ShareTail() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [photoBusy, setPhotoBusy] = useState(false)
  const [form, setForm, clearDraft, restored] = useFormDraft('happy-tail', {
    name: '',
    email: '',
    bunny: '',
    since: '',
    story: '',
    photoUrl: '',
  })

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const onSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setStatus('submitting')
    try {
      await submitRequest('happy-tail', { ...form, photo: form.photoUrl })
      clearDraft()
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <Screen className="space-y-4 text-center">
        <div className="pt-6 text-5xl" aria-hidden>
          <img src="/ohrr-mark.png" alt="" className="mx-auto h-14 w-14 object-contain" />
        </div>
        <h1 className="font-display text-xl font-extrabold text-ink">Thank you!</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          We got {form.bunny ? `${form.bunny}’s` : 'your'} story, {form.name || 'friend'}. OHRR will
          review it (and reply about photos) before adding it to Happy Tails.
        </p>
        <Link to="/tails" className={`${btn.blue} mx-auto`}>
          Back to Happy Tails
        </Link>
      </Screen>
    )
  }

  return (
    <Screen className="space-y-4">
      <Link
        to="/tails"
        className="inline-flex items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
      >
        <Icon name="arrowLeft" size={16} /> Happy Tails
      </Link>

      <div>
        <p className="text-xs font-extrabold uppercase tracking-wider text-brand-orange">
          Happy Tails
        </p>
        <h1 className="mt-1 font-display text-2xl font-black text-ink">Share your Happy Tail</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          Adopted a bunny from OHRR? Tell us how they’re doing and we’ll add your story.
        </p>
      </div>

      <Card>
        <form
          name="happy-tail"
          onSubmit={onSubmit}
          className="space-y-3"
        >
          <p className="hidden">
            <label>
              Don’t fill this out: <input name="bot-field" />
            </label>
          </p>

          <label className="block text-sm font-semibold text-slate-700">
            Your name
            <input className={input} name="name" required value={form.name} onChange={set('name')} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Email
            <input
              className={input}
              type="email"
              name="email"
              required
              value={form.email}
              onChange={set('email')}
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Your bunny’s name
            <input className={input} name="bunny" required value={form.bunny} onChange={set('bunny')} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            When did you adopt?
            <input
              className={input}
              name="since"
              placeholder="e.g. March 2025"
              value={form.since}
              onChange={set('since')}
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Your story
            <textarea
              className={input}
              name="story"
              rows={4}
              required
              placeholder="How are they settling in? Favorite spot, funny habits, milestones…"
              value={form.story}
              onChange={set('story')}
            />
          </label>
          {restored && (
            <p className="rounded-xl bg-brand-blue-50/70 px-3 py-2 text-xs font-semibold text-brand-blue">{DRAFT_NOTE}</p>
          )}
          <PhotoField
            label="A photo of your bunny"
            hint="This is the picture OHRR would publish with your story."
            value={form.photoUrl}
            onChange={(url) => setForm((f) => ({ ...f, photoUrl: url }))}
            onBusyChange={setPhotoBusy}
          />
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
            OHRR reads every story before it goes on the Happy Tails page.
          </p>

          {status === 'error' && (
            <p className="text-sm font-semibold text-red-600">
              Something went wrong — please try again, or email OHRR at {ohrr.phone}.
            </p>
          )}

          <button
            type="submit"
            disabled={status === 'submitting'}
            className={`${btn.primary} w-full disabled:opacity-60`}
          >
            {status === 'submitting' ? 'Sending…' : 'Submit your story'}
          </button>
        </form>
      </Card>
    </Screen>
  )
}
