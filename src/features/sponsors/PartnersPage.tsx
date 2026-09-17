// /partners — "Our Partners": live sponsors grouped by tier (presenting →
// program → community → friend), bigger cards for higher tiers. Shows a clean
// empty state until staff add real sponsors; never seeds or invents any.
import { Link } from 'react-router-dom'
import { PageHeader, Screen, Card, Badge, SectionLabel, btn } from '../../components/ui'
import { Icon } from '../../components/icons'
import { ohrr } from '../../data/ohrr'
import { useSponsors } from './hooks'
import { SponsorLogo } from './SponsorLogo'
import { groupByTier, hrefFor, prettyUrl, tierLabel, type Sponsor, type SponsorTier } from './types'

export const SPONSOR_INQUIRY_EMAIL = ohrr.email
export const SPONSOR_INFO_URL = 'https://ohrr-website.pages.dev/give'

function WebsiteLink({ website, className = '' }: { website: string; className?: string }) {
  return (
    <a
      href={hrefFor(website)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex max-w-full items-center gap-1.5 text-sm font-semibold text-brand-blue hover:text-brand-blue-dark ${className}`}
    >
      <Icon name="external" size={14} className="shrink-0" />
      <span className="truncate">{prettyUrl(website)}</span>
    </a>
  )
}

/* Presenting partner — hero-sized card: big logo, name, blurb, website. */
function PresentingCard({ s }: { s: Sponsor }) {
  return (
    <Card className="border-brand-blue/30 ring-1 ring-brand-blue/20">
      <div className="flex justify-center pb-3 pt-1">
        <SponsorLogo name={s.name} logoUrl={s.logoUrl} size="xl" />
      </div>
      <div className="text-center">
        <Badge tone="blue">{tierLabel(s.tier)}</Badge>
        <h3 className="mt-2 font-display text-xl font-extrabold text-ink">{s.name}</h3>
        {s.blurb && <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.blurb}</p>}
        {s.website && <WebsiteLink website={s.website} className="mt-3" />}
      </div>
    </Card>
  )
}

/* Program sponsor — large logo beside name/blurb. */
function ProgramCard({ s }: { s: Sponsor }) {
  return (
    <Card>
      <div className="flex justify-center pb-3">
        <SponsorLogo name={s.name} logoUrl={s.logoUrl} size="lg" />
      </div>
      <h3 className="font-display text-base font-extrabold text-ink">{s.name}</h3>
      {s.blurb && <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.blurb}</p>}
      {s.website && <WebsiteLink website={s.website} className="mt-2.5" />}
    </Card>
  )
}

/* Community supporter — standard row card. */
function CommunityCard({ s }: { s: Sponsor }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <SponsorLogo name={s.name} logoUrl={s.logoUrl} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[15px] font-extrabold text-ink">{s.name}</h3>
          {s.blurb && <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.blurb}</p>}
          {s.website && <WebsiteLink website={s.website} className="mt-1.5" />}
        </div>
      </div>
    </Card>
  )
}

/* Friend of OHRR — compact row. */
function FriendRow({ s }: { s: Sponsor }) {
  return (
    <div className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <SponsorLogo name={s.name} logoUrl={s.logoUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-extrabold text-ink">{s.name}</p>
        {s.website && <WebsiteLink website={s.website} className="text-xs" />}
      </div>
    </div>
  )
}

function TierGroup({ tier, sponsors }: { tier: SponsorTier; sponsors: Sponsor[] }) {
  if (tier === 'friend') {
    return (
      <div className="space-y-2.5">
        <SectionLabel>{tierLabel(tier)}s</SectionLabel>
        <Card className="divide-y divide-slate-100">
          {sponsors.map((s) => (
            <FriendRow key={s.id} s={s} />
          ))}
        </Card>
      </div>
    )
  }
  const CardFor = tier === 'presenting' ? PresentingCard : tier === 'program' ? ProgramCard : CommunityCard
  return (
    <div className="space-y-2.5">
      <SectionLabel>{tierLabel(tier)}s</SectionLabel>
      <div className="grid grid-cols-1 gap-3">
        {sponsors.map((s) => (
          <CardFor key={s.id} s={s} />
        ))}
      </div>
    </div>
  )
}

/* "Interested in sponsoring?" footer — tappable email + website, no invented tiers/pricing. */
export function SponsorInquiryCard() {
  return (
    <div className="rounded-2xl bg-gradient-to-b from-brand-blue to-brand-blue-dark px-6 py-7 text-center text-white">
      <h2 className="font-display text-xl font-extrabold">
        Interested in sponsoring OHRR or Midwest BunFest?
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-white/85">
        We’d love to talk. Email us, or read about supporting OHRR on our website.
      </p>
      <a
        href={`mailto:${SPONSOR_INQUIRY_EMAIL}`}
        className="mt-4 inline-flex max-w-full items-center gap-2 break-all text-sm font-bold text-white underline decoration-white/50 underline-offset-4"
      >
        <Icon name="mail" size={15} className="shrink-0" /> {SPONSOR_INQUIRY_EMAIL}
      </a>
      <div>
        <a
          href={SPONSOR_INFO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`${btn.white} mt-4`}
        >
          Support OHRR on our website <Icon name="external" size={14} />
        </a>
      </div>
    </div>
  )
}

export default function PartnersPage() {
  const sponsors = useSponsors()
  const groups = sponsors ? groupByTier(sponsors) : []
  const hasPerks = Boolean(sponsors?.some((s) => s.perkTitle))

  return (
    <>
      <PageHeader
        icon="award"
        title="Our Partners"
        subtitle="The businesses and friends whose support makes OHRR’s rescue work and Midwest BunFest possible."
      />
      <Screen className="space-y-6">
        {hasPerks && (
          <Link
            to="/partners/perks"
            className="group flex items-center gap-4 rounded-2xl border border-brand-orange/30 bg-brand-orange-50/60 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-brand-orange">
              <Icon name="gift" size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[15px] font-extrabold text-ink">
                Partner perks
              </span>
              <span className="mt-0.5 block text-sm text-slate-500">
                Offers from our partners for the OHRR community
              </span>
            </span>
            <Icon
              name="chevron"
              size={18}
              className="shrink-0 text-slate-300 transition group-hover:text-brand-orange"
            />
          </Link>
        )}

        {sponsors === null ? (
          <p className="py-8 text-center text-sm font-semibold text-slate-400">Loading partners…</p>
        ) : groups.length === 0 ? (
          <Card className="border-slate-200 bg-slate-50/80 text-center">
            <p className="text-sm leading-relaxed text-slate-600">
              Our BunFest 2026 partners will be announced here.
            </p>
          </Card>
        ) : (
          groups.map((g) => <TierGroup key={g.tier} tier={g.tier} sponsors={g.sponsors} />)
        )}

        <SponsorInquiryCard />
      </Screen>
    </>
  )
}
