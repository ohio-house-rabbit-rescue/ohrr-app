// The company card — one editor for everyone OHRR deals with, used by Hop Shop
// → Suppliers and BunFest → Vendors (they are one list: `suppliers`, with
// is_supplier / is_vendor). OHRR asked for "photo, address, [donations] they
// might have done and so forth … they dont need to [be] on the site but we need
// it in the staff backend", so the card is grouped into:
//
//   Contact · Where · Online · Photo · Paperwork · At BunFest · How we order ·
//   Notes and "Invite again?"   — one Save for all of these
//   BunFest, year by year · Given to OHRR   — lists that save row by row
//
// Everything from update 27 (photo, socials, paperwork, the two lists) hides
// until that SQL has been run; the older fields keep working either way.
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { errMessage } from '../../lib/supabase'
import { btn } from '../../components/ui'
import { Icon } from '../../components/icons'
import { FormError, staffInput } from '../../components/staffui'
import { saveVendorDetails } from '../bunfest/api'
import { fromCents, money, ORDER_HOW_LABEL, toCents, type OrderHow } from './api'
import {
  auctionItemsGivenBy,
  daysUntil,
  deleteDonation,
  deleteVendorYear,
  DONATION_KIND_LABEL,
  facebookUrl,
  fmtDate,
  instagramUrl,
  insuranceState,
  INVITE_AGAIN_LABEL,
  listDonations,
  listVendorYears,
  markThanked,
  paperworkFlags,
  removeCompanyPhoto,
  saveCompany,
  saveDonation,
  saveVendorYear,
  thankYouMailto,
  todayISO,
  uploadCompanyPhoto,
  vendorRecordsReady,
  withScheme,
  type Company,
  type CompanyExtras,
  type Donation,
  type DonationKind,
  type GiftTotals,
  type GivenAuctionItem,
  type InviteAgain,
  type VendorYear,
} from './companies'

const label = 'block text-sm font-semibold text-slate-700'
const linkRow = 'mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold text-brand-blue'
const smallBtn =
  'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60'
const dangerBtn =
  'inline-flex min-h-[44px] items-center justify-center rounded-full border border-red-200 px-4 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-60'

/** Is update 27 in? `null` while asking. */
export function useVendorRecordsReady(): boolean | null {
  const [ready, setReady] = useState<boolean | null>(null)
  useEffect(() => {
    let live = true
    void vendorRecordsReady().then((r) => live && setReady(r))
    return () => {
      live = false
    }
  }, [])
  return ready
}

function Section({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-slate-100 pt-3">
      <div>
        <h4 className="font-display text-[15px] font-extrabold text-ink">{title}</h4>
        {hint && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

/* ================================================================ list row */

/** The small photo beside a company's name in the list. */
export function CompanyThumb({ c }: { c: Company }) {
  if (!c.photo_url) return null
  return (
    <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100">
      <img src={c.photo_url} alt="" className="h-full w-full object-cover" />
    </span>
  )
}

/** The summary under a company's name: what they've given and the paperwork flags. */
export function CompanySummary({ c, gifts }: { c: Company; gifts?: GiftTotals | null }) {
  const flags = paperworkFlags(c)
  if (!gifts?.count && flags.length === 0) return null
  const tone = { red: 'bg-red-50 text-red-700', orange: 'bg-brand-orange-50 text-brand-orange-dark', slate: 'bg-slate-100 text-slate-600' }
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
      {gifts && gifts.count > 0 && (
        <span className="font-bold text-green-700">
          {gifts.count} gift{gifts.count === 1 ? '' : 's'}
          {gifts.cents > 0 ? ` · ${money(gifts.cents)}` : ''}
        </span>
      )}
      {flags.map((f) => (
        <span key={f.text} className={`rounded-full px-2 py-0.5 font-semibold ${tone[f.tone]}`}>
          {f.text}
        </span>
      ))}
    </span>
  )
}

/* ================================================================ the card */

interface Draft {
  name: string
  is_supplier: boolean
  is_vendor: boolean
  contact_name: string
  email: string
  phone: string
  website: string
  address: string
  account_number: string
  order_how: OrderHow | ''
  order_notes: string
  lead_days: string
  min_order: string
  notes: string
  is_active: boolean
  // update 27
  photo_url: string | null
  instagram: string
  facebook: string
  shop_url: string
  mailing_address: string
  license_number: string
  agreement_signed_on: string
  insurance_expires: string
  needs_power: boolean
  booth_notes: string
  invite_again: InviteAgain | ''
  // what visitors see (BunFest screen only)
  category: string
  blurb: string
  sort: string
  years: number[]
  published: boolean
}

function draftFrom(c: Company | null, mode: 'shop' | 'bunfest'): Draft {
  return {
    name: c?.name ?? '',
    is_supplier: c?.is_supplier ?? mode === 'shop',
    is_vendor: c?.is_vendor ?? mode === 'bunfest',
    contact_name: c?.contact_name ?? '',
    email: c?.email ?? '',
    phone: c?.phone ?? '',
    website: c?.website ?? '',
    address: c?.address ?? '',
    account_number: c?.account_number ?? '',
    order_how: c?.order_how ?? '',
    order_notes: c?.order_notes ?? '',
    lead_days: c?.lead_days == null ? '' : String(c.lead_days),
    min_order: c?.min_order ?? '',
    notes: c?.notes ?? '',
    is_active: c?.is_active ?? true,
    photo_url: c?.photo_url ?? null,
    instagram: c?.instagram ?? '',
    facebook: c?.facebook ?? '',
    shop_url: c?.shop_url ?? '',
    mailing_address: c?.mailing_address ?? '',
    license_number: c?.license_number ?? '',
    agreement_signed_on: c?.agreement_signed_on ?? '',
    insurance_expires: c?.insurance_expires ?? '',
    needs_power: c?.needs_power ?? false,
    booth_notes: c?.booth_notes ?? '',
    invite_again: c?.invite_again ?? '',
    category: c?.vendor_category ?? '',
    blurb: c?.vendor_blurb ?? '',
    sort: String(c?.vendor_sort ?? 0),
    years: c?.vendor_years ?? [new Date().getFullYear()],
    published: c?.vendor_published ?? false,
  }
}

export function CompanyForm({
  orgId,
  initial,
  mode,
  canDelete = false,
  onDelete,
  onSaved,
  onCancel,
  onGiftsChanged,
  yearPicker,
}: {
  orgId: string
  initial: Company | null
  /** 'shop' = Hop Shop → Suppliers; 'bunfest' = BunFest → Vendors (adds what visitors see). */
  mode: 'shop' | 'bunfest'
  canDelete?: boolean
  onDelete?: () => Promise<void>
  onSaved: () => Promise<void>
  onCancel?: () => void
  /** The gift log changed — refresh the totals in the list. */
  onGiftsChanged?: () => void
  /** BunFest screen: its "Years at BunFest" chips. */
  yearPicker?: (years: number[], onChange: (years: number[]) => void) => ReactNode
}) {
  const ready = useVendorRecordsReady()
  const [d, setD] = useState<Draft>(() => draftFrom(initial, mode))
  const [busy, setBusy] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const txt = (k: keyof Draft) => (e: { target: { value: string } }) => setD((x) => ({ ...x, [k]: e.target.value }))
  const nul = (s: string) => s.trim() || null
  const bunfest = mode === 'bunfest'

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoBusy(true)
    setError(null)
    try {
      const url = await uploadCompanyPhoto(file, orgId)
      // A photo uploaded and then replaced before saving is never used — tidy it now.
      if (d.photo_url && d.photo_url !== initial?.photo_url) void removeCompanyPhoto(d.photo_url)
      setD((x) => ({ ...x, photo_url: url }))
    } catch (err) {
      setError(`The photo didn’t save: ${errMessage(err)}`)
    } finally {
      setPhotoBusy(false)
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (!d.is_supplier && !d.is_vendor) throw new Error('Tick Supplier, Vendor, or both.')
      const extras: CompanyExtras | null = ready
        ? {
            photo_url: d.photo_url,
            instagram: nul(d.instagram),
            facebook: nul(d.facebook),
            shop_url: withScheme(d.shop_url),
            mailing_address: nul(d.mailing_address),
            license_number: nul(d.license_number),
            agreement_signed_on: d.agreement_signed_on || null,
            insurance_expires: d.insurance_expires || null,
            needs_power: d.needs_power,
            booth_notes: nul(d.booth_notes),
            invite_again: d.invite_again || null,
          }
        : null
      const saved = await saveCompany(
        {
          ...(initial ? { id: initial.id } : {}),
          org_id: orgId,
          name: d.name.trim(),
          is_supplier: d.is_supplier,
          is_vendor: d.is_vendor,
          contact_name: nul(d.contact_name),
          email: nul(d.email),
          phone: nul(d.phone),
          website: withScheme(d.website),
          address: nul(d.address),
          notes: nul(d.notes),
          // The ordering side belongs to the shop screen; BunFest leaves it as it was.
          ...(bunfest
            ? {}
            : {
                account_number: nul(d.account_number),
                order_how: d.order_how || null,
                order_notes: nul(d.order_notes),
                lead_days: d.lead_days === '' ? null : Number(d.lead_days),
                min_order: nul(d.min_order),
                is_active: d.is_active,
              }),
        },
        extras,
      )
      if (bunfest) {
        await saveVendorDetails(saved.id, {
          category: nul(d.category),
          blurb: nul(d.blurb),
          booth: initial?.vendor_booth ?? null,
          room: initial?.vendor_room ?? null,
          tables: initial?.vendor_tables ?? 1,
          published: d.published,
          sort: Number(d.sort) || 0,
          years: d.years,
        })
      }
      if (extras && initial?.photo_url && initial.photo_url !== d.photo_url) void removeCompanyPhoto(initial.photo_url)
      await onSaved()
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
    }
  }

  const doDelete = async () => {
    if (!onDelete) return
    setBusy(true)
    setError(null)
    try {
      await onDelete()
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
    }
  }

  const ins = insuranceState(d.insurance_expires)
  const insDays = d.insurance_expires ? daysUntil(d.insurance_expires) : null
  const links = [
    ['Website', withScheme(d.website)],
    ['Shop', ready ? withScheme(d.shop_url) : null],
    ['Instagram', ready ? instagramUrl(d.instagram) : null],
    ['Facebook', ready ? facebookUrl(d.facebook) : null],
  ].filter((l): l is [string, string] => !!l[1])

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="space-y-3">
        <label className={label}>
          Company
          <input className={staffInput} required value={d.name} onChange={txt('name')} placeholder={bunfest ? 'Bunny Brook Designs' : 'Small Pet Select'} />
        </label>
        {!bunfest && (
          <div className="grid grid-cols-2 gap-2">
            <label className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700">
              <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-brand-blue" checked={d.is_supplier} onChange={(e) => setD({ ...d, is_supplier: e.target.checked })} />
              Supplier — we buy from them
            </label>
            <label className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700">
              <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-brand-orange" checked={d.is_vendor} onChange={(e) => setD({ ...d, is_vendor: e.target.checked })} />
              Vendor — sells at BunFest
            </label>
          </div>
        )}

        {/* Photo */}
        {ready && (
          <Section title="Photo" hint="Their booth, their products or their logo — for the team, not the website.">
            <div className="flex items-center gap-3">
              <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-slate-300">
                {d.photo_url ? <img src={d.photo_url} alt="" className="h-full w-full object-cover" /> : <Icon name="camera" size={28} />}
              </span>
              <div className="flex flex-wrap gap-2">
                <label className={`${smallBtn} cursor-pointer text-brand-blue ${photoBusy ? 'opacity-60' : ''}`}>
                  <Icon name="camera" size={16} />
                  {photoBusy ? 'Saving photo…' : d.photo_url ? 'Replace photo' : 'Add a photo'}
                  <input type="file" accept="image/*" disabled={photoBusy} className="hidden" onChange={onPhoto} />
                </label>
                {d.photo_url && (
                  <button type="button" onClick={() => setD({ ...d, photo_url: null })} disabled={photoBusy} className={smallBtn}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          </Section>
        )}

        {/* Contact */}
        <Section title="Contact">
          <label className={label}>
            Contact person
            <input className={staffInput} value={d.contact_name} onChange={txt('contact_name')} autoComplete="off" />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={label}>
              Email
              <input className={staffInput} type="email" inputMode="email" value={d.email} onChange={txt('email')} autoComplete="off" />
            </label>
            <label className={label}>
              Phone
              <input className={staffInput} type="tel" value={d.phone} onChange={txt('phone')} autoComplete="off" />
            </label>
          </div>
          {(d.email.trim() || d.phone.trim()) && (
            <p className={linkRow}>
              {d.email.trim() && <a href={`mailto:${d.email.trim()}`} className="inline-flex min-h-[44px] items-center">{d.email.trim()}</a>}
              {d.phone.trim() && <a href={`tel:${d.phone.trim()}`} className="inline-flex min-h-[44px] items-center">{d.phone.trim()}</a>}
            </p>
          )}
        </Section>

        {/* Where */}
        <Section title="Where">
          <label className={label}>
            Address
            <textarea className={staffInput} rows={2} value={d.address} onChange={txt('address')} />
          </label>
          {ready && (
            <label className={label}>
              Mailing address <span className="font-normal text-slate-500">(if it’s different)</span>
              <textarea className={staffInput} rows={2} value={d.mailing_address} onChange={txt('mailing_address')} />
            </label>
          )}
        </Section>

        {/* Online */}
        <Section title="Online">
          <label className={label}>
            {bunfest ? 'Website (visitors see this link)' : 'Website (ordering page if there is one)'}
            <input className={staffInput} inputMode="url" value={d.website} onChange={txt('website')} placeholder="bunnybrookdesigns.com" />
          </label>
          {ready && (
            <>
              <label className={label}>
                Online shop <span className="font-normal text-slate-500">(Etsy or their own)</span>
                <input className={staffInput} inputMode="url" value={d.shop_url} onChange={txt('shop_url')} placeholder="etsy.com/shop/bunnybrook" />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className={label}>
                  Instagram
                  <input className={staffInput} value={d.instagram} onChange={txt('instagram')} placeholder="@bunnybrook" autoCapitalize="none" />
                </label>
                <label className={label}>
                  Facebook
                  <input className={staffInput} value={d.facebook} onChange={txt('facebook')} placeholder="facebook.com/bunnybrook" autoCapitalize="none" />
                </label>
              </div>
            </>
          )}
          {links.length > 0 && (
            <p className={linkRow}>
              {links.map(([name, href]) => (
                <a key={name} href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-1">
                  {name} <Icon name="external" size={13} />
                </a>
              ))}
            </p>
          )}
        </Section>

        {/* Paperwork */}
        {ready && (
          <Section title="Paperwork">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className={label}>
                Vendor agreement signed on
                <input className={staffInput} type="date" value={d.agreement_signed_on} onChange={txt('agreement_signed_on')} />
              </label>
              <label className={label}>
                Insurance expires
                <input className={staffInput} type="date" value={d.insurance_expires} onChange={txt('insurance_expires')} />
              </label>
            </div>
            {ins === 'expired' && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                Their insurance ran out on {fmtDate(d.insurance_expires)} — ask for a new certificate.
              </p>
            )}
            {ins === 'soon' && insDays != null && (
              <p className="rounded-xl bg-brand-orange-50 px-3 py-2 text-sm font-semibold text-brand-orange-dark">
                Their insurance ends {insDays === 0 ? 'today' : `in ${insDays} day${insDays === 1 ? '' : 's'}`} ({fmtDate(d.insurance_expires)}).
              </p>
            )}
            <label className={label}>
              Vendor’s licence no.
              <input className={staffInput} value={d.license_number} onChange={txt('license_number')} placeholder="Ohio vendor’s licence, if they have one" />
            </label>
          </Section>
        )}

        {/* At BunFest */}
        {d.is_vendor && (
          <Section
            title="At BunFest"
            hint={
              bunfest
                ? 'Category, “About them” and the website are what visitors read. Their table numbers are set on the Floor plan tab.'
                : 'What visitors read about them (category, “About them”, whether they’re listed) is on BunFest → Vendors.'
            }
          >
            {bunfest && (
              <>
                <label className={label}>
                  Category
                  <input className={staffInput} value={d.category} onChange={txt('category')} placeholder="Jewelry & Gifts" />
                </label>
                <label className={label}>
                  About them (visitors read this)
                  <textarea className={staffInput} rows={2} value={d.blurb} onChange={txt('blurb')} placeholder="Handmade bunny-themed jewelry, home decor and ornaments." />
                </label>
                <label className={label}>
                  Order in the list
                  <input inputMode="numeric" className={staffInput} value={d.sort} onChange={(e) => setD({ ...d, sort: e.target.value.replace(/[^0-9]/g, '') })} />
                </label>
                {yearPicker?.(d.years, (years) => setD((x) => ({ ...x, years })))}
                <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-slate-700">
                  <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-brand-blue" checked={d.published} onChange={(e) => setD({ ...d, published: e.target.checked })} />
                  Show this vendor to visitors
                </label>
              </>
            )}
            {ready && (
              <>
                <label className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700">
                  <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-brand-blue" checked={d.needs_power} onChange={(e) => setD({ ...d, needs_power: e.target.checked })} />
                  Needs power at their table
                </label>
                <label className={label}>
                  Booth notes <span className="font-normal text-slate-500">(team only)</span>
                  <textarea className={staffInput} rows={2} value={d.booth_notes} onChange={txt('booth_notes')} placeholder="Brings a tent · needs a wall behind them · arrives early" />
                </label>
              </>
            )}
          </Section>
        )}

        {/* How we order */}
        {d.is_supplier && !bunfest && (
          <Section title="How we order">
            <div className="grid grid-cols-2 gap-3">
              <label className={label}>
                How
                <select className={staffInput} value={d.order_how} onChange={txt('order_how')}>
                  <option value="">—</option>
                  {(Object.keys(ORDER_HOW_LABEL) as OrderHow[]).map((k) => (
                    <option key={k} value={k}>
                      {ORDER_HOW_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                Account #
                <input className={staffInput} value={d.account_number} onChange={txt('account_number')} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className={label}>
                Days to arrive
                <input className={staffInput} inputMode="numeric" value={d.lead_days} onChange={(e) => setD({ ...d, lead_days: e.target.value.replace(/[^0-9]/g, '') })} />
              </label>
              <label className={label}>
                Minimum order
                <input className={staffInput} value={d.min_order} onChange={txt('min_order')} placeholder="$75 · 6 bags" />
              </label>
            </div>
            <label className={label}>
              Ordering notes
              <textarea className={staffInput} rows={2} value={d.order_notes} onChange={txt('order_notes')} placeholder="Free shipping over $75. Rescue discount code on file with Bev." />
            </label>
          </Section>
        )}

        {/* Notes and invite again */}
        <Section title={ready && d.is_vendor ? 'Notes and “Invite again?”' : 'Notes'}>
          <label className={label}>
            Notes <span className="font-normal text-slate-500">(team only)</span>
            <textarea className={staffInput} rows={3} value={d.notes} onChange={txt('notes')} />
          </label>
          {ready && d.is_vendor && (
            <div>
              <span className={label}>Invite them to BunFest again?</span>
              <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label="Invite them again?">
                {(['yes', 'maybe', 'no'] as InviteAgain[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={d.invite_again === v}
                    onClick={() => setD({ ...d, invite_again: d.invite_again === v ? '' : v })}
                    className={`min-h-[44px] min-w-[72px] rounded-full px-4 text-sm font-bold ${
                      d.invite_again === v
                        ? v === 'no'
                          ? 'bg-slate-700 text-white'
                          : v === 'maybe'
                            ? 'bg-brand-orange text-white'
                            : 'bg-green-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {INVITE_AGAIN_LABEL[v]}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!bunfest && (
            <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-brand-blue" checked={d.is_active} onChange={(e) => setD({ ...d, is_active: e.target.checked })} />
              Active (shows in the supplier list on items)
            </label>
          )}
        </Section>

        <FormError>{error}</FormError>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy || photoBusy || !d.name.trim()} className={`${btn.primary} min-h-[44px] flex-1 disabled:opacity-60`}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} disabled={busy} className={smallBtn}>
              Cancel
            </button>
          )}
          {initial &&
            canDelete &&
            onDelete &&
            (confirmDelete ? (
              <button type="button" onClick={doDelete} disabled={busy} className="min-h-[44px] rounded-full bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-60">
                Confirm delete
              </button>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className={dangerBtn}>
                Delete
              </button>
            ))}
        </div>
      </form>

      {ready && !initial && (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
          Save the company first — then you can add each BunFest year with them and log what they’ve given OHRR.
        </p>
      )}
      {ready && initial && initial.is_vendor && <VendorYears supplierId={initial.id} orgId={orgId} />}
      {ready && initial && <Given company={initial} orgId={orgId} onChanged={onGiftsChanged} />}
    </div>
  )
}

/* ====================================================== BunFest, by year */

interface YearDraft {
  year: string
  tables: string
  booth: string
  fee: string
  paid_on: string
  paid_how: string
  notes: string
}

function yearDraft(y: VendorYear | null, year: number): YearDraft {
  return {
    year: String(y?.year ?? year),
    tables: y?.tables == null ? '' : String(y.tables),
    booth: y?.booth ?? '',
    fee: fromCents(y?.fee_cents),
    paid_on: y?.paid_on ?? '',
    paid_how: y?.paid_how ?? '',
    notes: y?.notes ?? '',
  }
}

function VendorYears({ supplierId, orgId }: { supplierId: string; orgId: string }) {
  const [rows, setRows] = useState<VendorYear[] | null>(null)
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setRows(await listVendorYears(supplierId))
    } catch (e) {
      setError(errMessage(e))
    }
  }, [supplierId])
  useEffect(() => {
    void load()
  }, [load])

  const now = new Date().getFullYear()
  const nextYear = rows && rows.some((r) => r.year === now) ? Math.max(...rows.map((r) => r.year)) + 1 : now
  const done = async () => {
    setEditing(null)
    await load()
  }

  return (
    <Section title="BunFest, year by year" hint="Tables, booth and the table fee for each year they came. Team only.">
      <FormError>{error}</FormError>
      {rows && rows.length === 0 && editing !== 'new' && <p className="text-sm text-slate-500">No years added yet.</p>}
      <ul className="space-y-2">
        {rows?.map((y) =>
          editing === y.year ? (
            <li key={y.year} className="rounded-xl border border-slate-200 p-3">
              <YearForm supplierId={supplierId} orgId={orgId} initial={y} fallbackYear={y.year} onDone={done} onCancel={() => setEditing(null)} />
            </li>
          ) : (
            <li key={y.year} className="flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-2">
              <span className="min-w-0 flex-1 text-sm">
                <span className="font-display font-extrabold text-ink">{y.year}</span>
                <span className="text-slate-600">
                  {[
                    y.tables != null ? `${y.tables} table${y.tables === 1 ? '' : 's'}` : null,
                    y.booth ? `booth ${y.booth}` : null,
                    y.fee_cents != null ? `fee ${money(y.fee_cents)}` : null,
                  ]
                    .filter(Boolean)
                    .map((s) => ` · ${s}`)
                    .join('')}
                </span>
                <span className={`block text-xs ${y.paid_on ? 'text-green-700' : y.fee_cents ? 'text-brand-orange-dark' : 'text-slate-500'}`}>
                  {y.paid_on ? `Paid ${fmtDate(y.paid_on)}${y.paid_how ? ` · ${y.paid_how}` : ''}` : y.fee_cents ? 'Not paid yet' : ''}
                </span>
                {y.notes && <span className="block text-xs text-slate-500">{y.notes}</span>}
              </span>
              <button type="button" onClick={() => setEditing(y.year)} className="min-h-[44px] shrink-0 px-2 text-sm font-bold text-brand-blue">
                Edit
              </button>
            </li>
          ),
        )}
      </ul>
      {editing === 'new' ? (
        <div className="rounded-xl border border-slate-200 p-3">
          <YearForm supplierId={supplierId} orgId={orgId} initial={null} fallbackYear={nextYear} onDone={done} onCancel={() => setEditing(null)} />
        </div>
      ) : (
        <button type="button" onClick={() => setEditing('new')} className={`${smallBtn} w-full text-brand-blue`}>
          <Icon name="plus" size={16} /> Add a year
        </button>
      )}
    </Section>
  )
}

function YearForm({
  supplierId,
  orgId,
  initial,
  fallbackYear,
  onDone,
  onCancel,
}: {
  supplierId: string
  orgId: string
  initial: VendorYear | null
  fallbackYear: number
  onDone: () => Promise<void>
  onCancel: () => void
}) {
  const [f, setF] = useState<YearDraft>(() => yearDraft(initial, fallbackYear))
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof YearDraft) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  const num = (k: keyof YearDraft) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value.replace(/[^0-9]/g, '') }))

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const year = Number(f.year)
      if (!year || year < 2009 || year > 2100) throw new Error('Give the year, e.g. 2026.')
      const tables = f.tables === '' ? null : Number(f.tables)
      if (tables != null && tables > 20) throw new Error('Up to 20 tables.')
      await saveVendorYear(
        {
          supplier_id: supplierId,
          org_id: orgId,
          year,
          tables,
          booth: f.booth.trim() || null,
          fee_cents: toCents(f.fee),
          paid_on: f.paid_on || null,
          paid_how: f.paid_how.trim() || null,
          notes: f.notes.trim() || null,
        },
        initial?.year,
      )
      await onDone()
    } catch (e) {
      setError(errMessage(e))
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!initial) return
    setBusy(true)
    try {
      await deleteVendorYear(supplierId, initial.year)
      await onDone()
    } catch (e) {
      setError(errMessage(e))
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <label className={label}>
          Year
          <input className={staffInput} inputMode="numeric" value={f.year} onChange={num('year')} />
        </label>
        <label className={label}>
          Tables
          <input className={staffInput} inputMode="numeric" value={f.tables} onChange={num('tables')} placeholder="1" />
        </label>
        <label className={label}>
          Booth
          <input className={staffInput} value={f.booth} onChange={set('booth')} placeholder="B4" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className={label}>
          Table fee ($)
          <input className={staffInput} type="number" min="0" step="0.01" inputMode="decimal" value={f.fee} onChange={set('fee')} placeholder="0.00" />
        </label>
        <label className={label}>
          Paid on
          <input className={staffInput} type="date" value={f.paid_on} onChange={set('paid_on')} />
        </label>
      </div>
      <label className={label}>
        Paid how
        <input className={staffInput} value={f.paid_how} onChange={set('paid_how')} placeholder="cash · check 1042 · PayPal" />
      </label>
      <label className={label}>
        Notes
        <input className={staffInput} value={f.notes} onChange={set('notes')} placeholder="Shared a table with …" />
      </label>
      <FormError>{error}</FormError>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void save()} disabled={busy} className={`${btn.blue} min-h-[44px] flex-1 !py-2 disabled:opacity-60`}>
          {busy ? 'Saving…' : initial ? 'Save year' : 'Add year'}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className={smallBtn}>
          Cancel
        </button>
        {initial &&
          (confirmDelete ? (
            <button type="button" onClick={() => void remove()} disabled={busy} className="min-h-[44px] rounded-full bg-red-600 px-4 text-sm font-bold text-white">
              Confirm
            </button>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className={dangerBtn}>
              Delete
            </button>
          ))}
      </div>
    </div>
  )
}

/* ========================================================= given to OHRR */

function Given({ company, orgId, onChanged }: { company: Company; orgId: string; onChanged?: () => void }) {
  const [gifts, setGifts] = useState<Donation[] | null>(null)
  const [auction, setAuction] = useState<GivenAuctionItem[]>([])
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setGifts(await listDonations(company.id))
    } catch (e) {
      setError(errMessage(e))
    }
    try {
      setAuction(await auctionItemsGivenBy(company.id))
    } catch {
      setAuction([])
    }
  }, [company.id])
  useEffect(() => {
    void load()
  }, [load])

  const done = async () => {
    setEditing(null)
    await load()
    onChanged?.()
  }
  const thank = async (g: Donation, on: string | null) => {
    setError(null)
    try {
      await markThanked(g.id, on)
      await load()
    } catch (e) {
      setError(errMessage(e))
    }
  }

  const total = (gifts ?? []).reduce((sum, g) => sum + (g.value_cents ?? 0), 0)
  const count = gifts?.length ?? 0

  return (
    <Section
      title="Given to OHRR"
      hint={
        count > 0
          ? `${count} gift${count === 1 ? '' : 's'}${total > 0 ? ` · ${money(total)} in stated values` : ''}`
          : 'Auction items, raffle prizes, goods for the rabbits, money, sponsorship, services.'
      }
    >
      <FormError>{error}</FormError>
      <ul className="space-y-2">
        {gifts?.map((g) =>
          editing === g.id ? (
            <li key={g.id} className="rounded-xl border border-slate-200 p-3">
              <GiftForm company={company} orgId={orgId} initial={g} onDone={done} onCancel={() => setEditing(null)} />
            </li>
          ) : (
            <li key={g.id} className="rounded-xl bg-slate-50 px-3 py-2">
              <div className="flex items-start gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink">{g.description}</span>
                  <span className="block text-xs text-slate-500">
                    {[DONATION_KIND_LABEL[g.kind], fmtDate(g.given_on), g.event_year ? `BunFest ${g.event_year}` : null, g.value_cents != null ? money(g.value_cents) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  {g.notes && <span className="block text-xs text-slate-500">{g.notes}</span>}
                  <span className={`mt-0.5 block text-xs font-semibold ${g.acknowledged_on ? 'text-green-700' : 'text-brand-orange-dark'}`}>
                    {g.acknowledged_on ? `Thank-you sent ${fmtDate(g.acknowledged_on)}` : 'No thank-you sent yet'}
                  </span>
                </span>
                <button type="button" onClick={() => setEditing(g.id)} className="min-h-[44px] shrink-0 px-2 text-sm font-bold text-brand-blue">
                  Edit
                </button>
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                <a href={thankYouMailto(company, g)} className={`${smallBtn} text-brand-blue`}>
                  <Icon name="mail" size={15} /> Email a thank-you
                </a>
                {g.acknowledged_on ? (
                  <button type="button" onClick={() => void thank(g, null)} className={smallBtn}>
                    Undo thank-you
                  </button>
                ) : (
                  <button type="button" onClick={() => void thank(g, todayISO())} className={smallBtn}>
                    <Icon name="check" size={15} /> Mark thank-you sent
                  </button>
                )}
              </div>
            </li>
          ),
        )}
      </ul>
      {editing === 'new' ? (
        <div className="rounded-xl border border-slate-200 p-3">
          <GiftForm company={company} orgId={orgId} initial={null} onDone={done} onCancel={() => setEditing(null)} />
        </div>
      ) : (
        <button type="button" onClick={() => setEditing('new')} className={`${smallBtn} w-full text-brand-blue`}>
          <Icon name="plus" size={16} /> Log a gift
        </button>
      )}

      {auction.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-bold text-ink">Silent-auction items that name them</p>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
            {auction.map((a) => (
              <li key={a.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-ink">{a.title}</span>
                <span className="shrink-0 text-xs text-slate-500">
                  {[a.value_cents != null ? money(a.value_cents) : null, a.event_slug.match(/\d{4}/)?.[0] ?? null, a.status === 'won' ? 'won' : null]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">Set on each item in Silent Auction (“Given by”). Log it above too if you want it in the total.</p>
        </div>
      )}
    </Section>
  )
}

interface GiftDraft {
  kind: DonationKind
  description: string
  value: string
  given_on: string
  event_year: string
  acknowledged_on: string
  notes: string
}

function GiftForm({
  company,
  orgId,
  initial,
  onDone,
  onCancel,
}: {
  company: Company
  orgId: string
  initial: Donation | null
  onDone: () => Promise<void>
  onCancel: () => void
}) {
  const [f, setF] = useState<GiftDraft>(() => ({
    kind: initial?.kind ?? 'auction',
    description: initial?.description ?? '',
    value: fromCents(initial?.value_cents),
    given_on: initial?.given_on ?? todayISO(),
    event_year: initial?.event_year == null ? '' : String(initial.event_year),
    acknowledged_on: initial?.acknowledged_on ?? '',
    notes: initial?.notes ?? '',
  }))
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof GiftDraft) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      if (!f.description.trim()) throw new Error('Say what they gave.')
      const year = f.event_year === '' ? null : Number(f.event_year)
      if (year != null && (year < 2009 || year > 2100)) throw new Error('The BunFest year looks wrong.')
      await saveDonation({
        ...(initial ? { id: initial.id } : {}),
        org_id: orgId,
        supplier_id: company.id,
        kind: f.kind,
        description: f.description.trim(),
        value_cents: toCents(f.value),
        given_on: f.given_on || todayISO(),
        event_year: year,
        acknowledged_on: f.acknowledged_on || null,
        notes: f.notes.trim() || null,
      })
      await onDone()
    } catch (e) {
      setError(errMessage(e))
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!initial) return
    setBusy(true)
    try {
      await deleteDonation(initial.id)
      await onDone()
    } catch (e) {
      setError(errMessage(e))
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <label className={label}>
        What kind
        <select className={staffInput} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as DonationKind })}>
          {(Object.keys(DONATION_KIND_LABEL) as DonationKind[]).map((k) => (
            <option key={k} value={k}>
              {DONATION_KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        What they gave
        <input className={staffInput} value={f.description} onChange={set('description')} placeholder="Handmade bunny quilt for the silent auction" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className={label}>
          Value ($)
          <input className={staffInput} type="number" min="0" step="0.01" inputMode="decimal" value={f.value} onChange={set('value')} placeholder="if they gave one" />
        </label>
        <label className={label}>
          Given on
          <input className={staffInput} type="date" value={f.given_on} onChange={set('given_on')} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className={label}>
          For BunFest
          <input className={staffInput} inputMode="numeric" value={f.event_year} onChange={(e) => setF({ ...f, event_year: e.target.value.replace(/[^0-9]/g, '').slice(0, 4) })} placeholder="year, if any" />
        </label>
        <label className={label}>
          Thank-you sent
          <input className={staffInput} type="date" value={f.acknowledged_on} onChange={set('acknowledged_on')} />
        </label>
      </div>
      <label className={label}>
        Notes
        <input className={staffInput} value={f.notes} onChange={set('notes')} />
      </label>
      <FormError>{error}</FormError>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void save()} disabled={busy} className={`${btn.blue} min-h-[44px] flex-1 !py-2 disabled:opacity-60`}>
          {busy ? 'Saving…' : initial ? 'Save gift' : 'Add gift'}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className={smallBtn}>
          Cancel
        </button>
        {initial &&
          (confirmDelete ? (
            <button type="button" onClick={() => void remove()} disabled={busy} className="min-h-[44px] rounded-full bg-red-600 px-4 text-sm font-bold text-white">
              Confirm
            </button>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className={dangerBtn}>
              Delete
            </button>
          ))}
      </div>
    </div>
  )
}
