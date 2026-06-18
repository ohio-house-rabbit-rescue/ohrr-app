import { Icon } from './icons'
import { btn } from './ui'

// Shows an organization's contact info as individually-tappable rows — address
// (text), phone (opens the dialer), email (opens the mail app), and the website
// shown as text with a "Visit website" button beneath it — so people can reach
// the org through the app instead of just being sent away.

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

function prettyUrl(url: string) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

export function ContactLinks({
  address,
  phone,
  email,
  url,
  urlLabel = 'Visit website',
}: {
  address?: string
  phone?: string
  email?: string
  url?: string
  urlLabel?: string
}) {
  if (!address && !phone && !email && !url) return null

  return (
    <div className="space-y-3">
      {address && (
        <div className="flex items-start gap-2.5 text-sm text-slate-600">
          <Icon name="mappin" size={16} className="mt-0.5 shrink-0 text-brand-blue" />
          <span>{address}</span>
        </div>
      )}
      {phone && (
        <a href={telHref(phone)} className="flex items-center gap-2.5 text-sm font-semibold text-brand-blue">
          <Icon name="phone" size={16} className="shrink-0" /> {phone}
        </a>
      )}
      {email && (
        <a
          href={`mailto:${email}`}
          className="flex items-center gap-2.5 break-all text-sm font-semibold text-brand-blue"
        >
          <Icon name="mail" size={16} className="shrink-0" /> {email}
        </a>
      )}
      {url && (
        <div className="space-y-2">
          <div className="flex items-start gap-2.5 text-sm text-slate-600">
            <Icon name="external" size={16} className="mt-0.5 shrink-0 text-brand-blue" />
            <span className="break-all">{prettyUrl(url)}</span>
          </div>
          <a href={url} target="_blank" rel="noopener noreferrer" className={`${btn.outline} w-full`}>
            {urlLabel} <Icon name="external" size={14} />
          </a>
        </div>
      )}
    </div>
  )
}
