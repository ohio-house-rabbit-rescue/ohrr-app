import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Screen, Card, SectionLabel, ActionCard, ExternalCard, btn } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { MbIcon } from '../../mybunny/icons'
import { BackLink, EmergencyCard, Field, VetDirectoryLink, mbInput } from '../../mybunny/ui'
import { HOP_SHOP_TO, VET_DIRECTORY } from '../../mybunny/links'
import { useMyBunny, findBunny, addHealthNote, todayIso, type Bunny } from '../../mybunny/storage'
import { useCareTopics, useLearnSlugs } from '../useTopics'
import { CategoryChip, Disclaimer, NotReviewedLine, UrgencyChip, WhatToDo } from '../ui'
import { RESOURCES_URL, type CareTopic } from '../types'

export default function HelpTopic() {
  const { slug } = useParams()
  const [params] = useSearchParams()
  const { topics, loading } = useCareTopics()
  const learnSlugs = useLearnSlugs()
  const data = useMyBunny()
  const topic = topics.find((t) => t.slug === slug)
  const bunnyParam = params.get('bunny') ?? undefined
  const bunny = findBunny(data, bunnyParam)
  const q = params.get('q') ?? ''

  if (!topic) {
    return (
      <Screen className="space-y-4 text-center">
        <h1 className="pt-6 font-display text-xl font-extrabold text-ink">
          {loading ? 'Loading…' : 'That topic isn’t here'}
        </h1>
        {!loading && (
          <Link to="/my-bunny/help" className={`${btn.blue} mx-auto`}>
            Browse Bunny Help
          </Link>
        )}
      </Screen>
    )
  }

  const back = bunny ? `/my-bunny/${bunny.id}` : '/my-bunny/help'
  const backLabel = bunny ? bunny.name : 'Bunny Help'
  const urgentVet = topic.show_vets || topic.urgency === 'emergency' || topic.urgency === 'vet-today'
  const learnTo = topic.article_slug && learnSlugs.has(topic.article_slug) ? `/learn/${topic.article_slug}` : null
  const showServices = topic.category === 'bonding' || topic.category === 'grooming'

  return (
    <Screen className="space-y-5">
      <BackLink to={back} label={backLabel} />

      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          <UrgencyChip urgency={topic.urgency} size="md" />
          <CategoryChip category={topic.category} />
        </div>
        <h1 className="mt-2 font-display text-2xl font-black leading-tight text-ink">{topic.title}</h1>
        {topic.summary && <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{topic.summary}</p>}
      </div>

      {topic.urgency === 'emergency' && <EmergencyCard />}

      <Card className="space-y-3">
        <h2 className="font-display text-[15px] font-extrabold text-ink">What to do</h2>
        <WhatToDo body={topic.what_to_do} />
        <NotReviewedLine topic={topic} />
      </Card>

      <section className="space-y-2.5">
        <SectionLabel>Next steps</SectionLabel>
        {learnTo ? (
          <ActionCard to={learnTo} title="Read OHRR’s care article" subtitle="In the Learn section of this app" icon="book" />
        ) : (
          <ExternalCard
            href={RESOURCES_URL}
            title="OHRR’s care resources"
            description="The full guides on ohiohouserabbitrescue.org"
            icon="book"
          />
        )}
        {urgentVet &&
          (VET_DIRECTORY.to ? (
            <ActionCard to={VET_DIRECTORY.to} title="Find a rabbit-savvy vet" subtitle="OHRR’s vet directory" icon="phone" tone="orange" />
          ) : (
            <ExternalCard
              href={VET_DIRECTORY.href}
              title="Find a rabbit-savvy vet"
              description="OHRR’s vet directory"
              icon="phone"
              tone="orange"
            />
          ))}
        {showServices && (
          <ActionCard
            to="/services"
            title="OHRR Bunny Services"
            subtitle="Bonding sessions & vet clinic days"
            icon="calendar"
          />
        )}
        {topic.hopshop_note && (
          <ActionCard to={HOP_SHOP_TO} title="Hop Shop" subtitle={topic.hopshop_note} icon="bag" tone="orange" />
        )}
      </section>

      <SaveAsHealthNote topic={topic} bunnies={data.bunnies} bunny={bunny} q={q} />

      <Disclaimer className="px-1" />
    </Screen>
  )
}

/* ------------------------------------------------- save as a health note */

function SaveAsHealthNote({
  topic,
  bunnies,
  bunny,
  q,
}: {
  topic: CareTopic
  bunnies: Bunny[]
  bunny?: Bunny
  q: string
}) {
  const navigate = useNavigate()
  const today = todayIso()
  const [open, setOpen] = useState(false)
  const [bunnyId, setBunnyId] = useState(bunny?.id ?? bunnies[0]?.id ?? '')
  const [date, setDate] = useState(today)
  const [noticed, setNoticed] = useState(q ? `${topic.title} — ${q}` : topic.title)
  const [did, setDid] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (bunnies.length === 0) {
    return (
      <Card className="border-slate-200 bg-slate-50/80">
        <p className="text-sm leading-relaxed text-slate-600">
          Add your bunny to My Bunny to keep a dated health timeline — handy at the vet.
        </p>
        <Link to="/my-bunny/new" className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-brand-blue">
          Add your bunny <Icon name="chevron" size={14} />
        </Link>
      </Card>
    )
  }

  const target = bunnies.find((b) => b.id === bunnyId) ?? bunnies[0]

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!noticed.trim()) {
      setError('Say what you noticed.')
      return
    }
    addHealthNote({
      bunnyId: target.id,
      date,
      topicSlug: topic.slug,
      topicTitle: topic.title,
      noticed,
      did,
      followUp,
      resolved: false,
    })
    navigate(`/my-bunny/${target.id}#health`, { replace: true })
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${btn.outline} w-full`}>
        <MbIcon name="edit" size={15} /> Save as a health note for {target.name}
      </button>
    )
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="space-y-3">
        <p className="font-display text-[15px] font-extrabold text-ink">Health note</p>
        {bunnies.length > 1 && (
          <Field label="Which bunny?">
            <select className={mbInput} value={target.id} onChange={(e) => setBunnyId(e.target.value)}>
              {bunnies.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Date">
          <input type="date" className={mbInput} value={date} max={today} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="What you noticed">
          <textarea className={mbInput} rows={2} value={noticed} onChange={(e) => setNoticed(e.target.value)} maxLength={500} required />
        </Field>
        <Field label="What you did" optional>
          <input className={mbInput} value={did} onChange={(e) => setDid(e.target.value)} maxLength={300} placeholder="e.g. called the vet, changed litter" />
        </Field>
        <Field label="Follow-up" optional>
          <input className={mbInput} value={followUp} onChange={(e) => setFollowUp(e.target.value)} maxLength={200} placeholder="e.g. vet visit Thursday" />
        </Field>
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" className={`${btn.primary} flex-1`}>
            Save to {target.name}’s timeline
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
        <p className="text-xs text-slate-400">Stays on this phone with the rest of My Bunny; included in Backup.</p>
      </form>
    </Card>
  )
}
