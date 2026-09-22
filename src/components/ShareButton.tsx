// "Share" on the things a visitor would actually post: a rabbit looking for a
// home, a Happy Tail, the festival.
//
// It paints an OHRR-branded square (the mark, the picture, the words and a QR
// back to the app) and hands it to the phone's share sheet, so what lands on
// Instagram or Facebook looks like the rescue — not a screenshot. Where the
// share sheet can't take an image, the words and the link go instead.
import { useState } from 'react'
import { Icon } from './icons'
import { renderSocialCard, type SocialCard } from '../features/share/socialCard'
import { sharePng, shareText } from '../features/share/share'
import { APP_URL } from '../features/mybunny/ics'

/** An in-app path → the full link a share carries. */
export function appLink(path: string): string {
  const base = APP_URL.replace(/\/my-bunny\/?$/, '')
  return `${base}${path}`
}

export default function ShareButton({
  card,
  filename,
  caption,
  label = 'Share',
  className = '',
}: {
  card: Omit<SocialCard, 'link'> & { link: string }
  filename: string
  /** The words that go with the picture. */
  caption: string
  label?: string
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const go = async () => {
    setBusy(true)
    setNote(null)
    try {
      const canvas = document.createElement('canvas')
      await renderSocialCard(canvas, card)
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
      if (!blob) throw new Error('no blob')
      const outcome = await sharePng(blob, filename, `${caption}\n\n${card.link}`)
      if (outcome === 'saved') setNote('Saved to your downloads — post it from there.')
    } catch {
      // Painting can fail on an old WebView; the words still travel.
      const r = await shareText(`${caption}\n\n${card.link}`, card.title)
      if (r === 'copied') setNote('Copied — paste it into your post.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className={className}>
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-brand-blue transition hover:bg-brand-blue-50 disabled:opacity-60"
      >
        <Icon name="sparkles" size={17} /> {busy ? 'Making the picture…' : label}
      </button>
      {note && <span className="mt-1 block text-xs font-semibold text-green-700">{note}</span>}
    </span>
  )
}
