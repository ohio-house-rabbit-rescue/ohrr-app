// /partners/perks — "Partner perks": sponsors that offer a perk (perk_title set).
// Each card shows the logo, the perk, a "Show code" reveal when there's a code,
// and the sponsor's website. Empty state when no partner has a perk.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Screen, Card, Badge } from '../../components/ui'
import { Icon } from '../../components/icons'
import { useSponsors } from './hooks'
import { SponsorLogo } from './SponsorLogo'
import { hrefFor, prettyUrl, tierLabel, type Sponsor } from './types'

function PerkCard({ s }: { s: Sponsor }) {
  const [revealed, setRevealed] = useState(false)

  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-3">
        <SponsorLogo name={s.name} logoUrl={s.logoUrl} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold uppercase tracking-wide text-slate-400">
            {s.name}
          </p>
          <h3 className="mt-0.5 font-display text-[15px] font-extrabold text-ink">
            {s.perkTitle}
          </h3>
          <div className="mt-1">
            <Badge tone="slate">{tierLabel(s.tier)}</Badge>
          </div>
        </div>
      </div>

      {s.perkDetail && (
        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{s.perkDetail}</p>
      )}

      {s.perkCode &&
        (revealed ? (
          <div className="rounded-xl border border-dashed border-brand-orange/50 bg-brand-orange-50/60 px-4 py-3 text-center">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Your code
            </p>
            <p className="mt-0.5 select-all font-mono text-lg font-bold tracking-wider text-ink">
              {s.perkCode}
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-orange px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-orange-dark active:scale-[.98]"
          >
            <Icon name="ticket" size={15} /> Show code
          </button>
        ))}

      {s.website && (
        <a
          href={hrefFor(s.website)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex max-w-full items-center gap-1.5 text-sm font-semibold text-brand-blue hover:text-brand-blue-dark"
        >
          <Icon name="external" size={14} className="shrink-0" />
          <span className="truncate">{prettyUrl(s.website)}</span>
        </a>
      )}
    </Card>
  )
}

export default function PartnerPerksPage() {
  const sponsors = useSponsors()
  const perks = sponsors?.filter((s) => s.perkTitle) ?? []

  return (
    <>
      <PageHeader
        icon="gift"
        title="Partner perks"
        subtitle="Offers from OHRR’s partners for the rabbit community. Each perk’s terms are set by that partner."
      />
      <Screen className="space-y-4">
        {sponsors === null ? (
          <p className="py-8 text-center text-sm font-semibold text-slate-400">Loading perks…</p>
        ) : perks.length === 0 ? (
          <Card className="border-slate-200 bg-slate-50/80 text-center">
            <p className="text-sm leading-relaxed text-slate-600">
              No partner perks right now. Check back — offers appear here as partners share them.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {perks.map((s) => (
              <PerkCard key={s.id} s={s} />
            ))}
          </div>
        )}

        <Link
          to="/partners"
          className="inline-flex items-center gap-1 px-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark"
        >
          <Icon name="arrowLeft" size={14} /> All partners
        </Link>
      </Screen>
    </>
  )
}
