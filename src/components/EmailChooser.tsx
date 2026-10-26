import { useEffect, useState } from 'react'
import { Icon } from './icons'
import { gmailComposeUrl, mailAsText, parseMailto, sendMail, setEmailWith, setMailHandler, type MailParts } from '../lib/emailWith'

// Mounted once. On a computer, an email link asks the first time whether to
// write it in Gmail, hand it to the computer's email program, or copy it —
// then does that from then on (Settings → Sending email changes it).
export default function EmailChooser() {
  const [pending, setPending] = useState<{ href: string; mail: MailParts } | null>(null)
  const [remember, setRemember] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const ask = (href: string) => {
      setCopied(false)
      setPending({ href, mail: parseMailto(href) })
    }
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      const href = a?.getAttribute('href') ?? ''
      if (!/^mailto:/i.test(href)) return
      if (sendMail(href, ask)) e.preventDefault()
    }
    document.addEventListener('click', onClick)
    setMailHandler((href) => sendMail(href, ask))
    return () => {
      document.removeEventListener('click', onClick)
      setMailHandler(null)
    }
  }, [])

  useEffect(() => {
    if (!pending) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPending(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending])

  if (!pending) return null
  const { href, mail } = pending
  const close = () => setPending(null)

  const gmail = () => {
    if (remember) setEmailWith('gmail')
    window.open(gmailComposeUrl(mail), '_blank', 'noopener')
    close()
  }
  const program = () => {
    if (remember) setEmailWith('app')
    window.location.href = href
    close()
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(mailAsText(mail))
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const choice = 'flex w-full items-center gap-3 rounded-2xl border border-slate-200 p-3.5 text-left transition hover:border-slate-300 hover:bg-slate-50'
  const tile = 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-blue-50 text-brand-blue'

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Send this email with">
      <button className="absolute inset-0 bg-black/40" aria-label="Close" onClick={close} />
      <div className="relative z-10 max-h-[85vh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl bg-white p-5 pb-6 shadow-2xl sm:rounded-3xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-extrabold text-ink">Send this email with…</h2>
            <p className="mt-0.5 break-words text-sm text-slate-500">
              {mail.to ? `To ${mail.to}` : mail.bcc ? `To ${mail.bcc.split(',').length} people (Bcc)` : 'A new email'}
              {mail.subject ? ` · ${mail.subject}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="space-y-2">
          <button type="button" onClick={gmail} className={choice}>
            <span className={tile}>
              <Icon name="mail" size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[15px] font-extrabold text-ink">Gmail</span>
              <span className="mt-0.5 block text-sm text-slate-500">A new Gmail message opens in this browser, all filled in.</span>
            </span>
          </button>
          <button type="button" onClick={program} className={choice}>
            <span className={tile}>
              <Icon name="device" size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[15px] font-extrabold text-ink">This computer's email program</span>
              <span className="mt-0.5 block text-sm text-slate-500">Whatever the computer is set to use, such as Outlook or Mail.</span>
            </span>
          </button>
          <button type="button" onClick={() => void copy()} className={choice}>
            <span className={tile}>
              <Icon name="file" size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[15px] font-extrabold text-ink">{copied ? 'Copied' : 'Copy it'}</span>
              <span className="mt-0.5 block text-sm text-slate-500">
                {copied ? 'Paste it into any email — the address and subject are at the top.' : 'The address, subject and message, to paste into any email.'}
              </span>
            </span>
          </button>
        </div>

        <label className="mt-4 flex min-h-[44px] items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-5 w-5 accent-brand-blue" />
          Remember Gmail or the email program on this computer
        </label>
        <p className="text-xs text-slate-500">Change it any time in Settings → Sending email.</p>
      </div>
    </div>
  )
}
