// How an email link is sent from a computer, chosen once and kept on the device.
//
// Every "Email it" in the app is a mailto: link, and a computer hands those to
// whatever email program Windows or the Mac is set to use — often one nobody
// opens (an internet provider's mail, an unused Outlook), and some of them drop
// the subject and the message. Gmail in the browser takes the same message from
// its own address instead, so nothing has to be set up on the computer.
// Phones keep the plain link: they open the mail app the person already uses.
import { useSyncExternalStore } from 'react'
import { isNative } from '../native/platform'

export type EmailWith = 'ask' | 'gmail' | 'app'

const KEY = 'ohrr:email-with:v1'
const listeners = new Set<() => void>()

function read(): EmailWith {
  try {
    const raw = localStorage.getItem(KEY)
    return raw === 'gmail' || raw === 'app' ? raw : 'ask'
  } catch {
    return 'ask'
  }
}

let choice: EmailWith = read()

export function setEmailWith(c: EmailWith) {
  choice = c
  try {
    if (c === 'ask') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, c)
  } catch {
    /* private mode — it asks again next time */
  }
  listeners.forEach((l) => l())
}

export function useEmailWith(): EmailWith {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => choice,
  )
}

export function getEmailWith(): EmailWith {
  return choice
}

/** A computer with a mouse — not a phone or tablet, and not the phone app. */
export function onComputer(): boolean {
  if (isNative || typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

export interface MailParts {
  to: string
  cc: string
  bcc: string
  subject: string
  body: string
}

const dec = (s: string) => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** The pieces of a mailto: link (RFC 6068 — a "+" is a plus, spaces come as %20). */
export function parseMailto(href: string): MailParts {
  const rest = href.replace(/^mailto:/i, '')
  const q = rest.indexOf('?')
  const parts: MailParts = { to: dec(q < 0 ? rest : rest.slice(0, q)), cc: '', bcc: '', subject: '', body: '' }
  if (q >= 0) {
    for (const pair of rest.slice(q + 1).split('&')) {
      const eq = pair.indexOf('=')
      if (eq < 0) continue
      const key = pair.slice(0, eq).toLowerCase()
      const value = dec(pair.slice(eq + 1))
      if (key === 'to') parts.to = [parts.to, value].filter(Boolean).join(',')
      else if (key === 'cc' || key === 'bcc' || key === 'subject' || key === 'body') parts[key] = value
    }
  }
  return parts
}

/** A new Gmail message with everything filled in (opens in the signed-in Gmail). */
export function gmailComposeUrl(m: MailParts): string {
  const p = new URLSearchParams({ view: 'cm', fs: '1' })
  if (m.to) p.set('to', m.to)
  if (m.cc) p.set('cc', m.cc)
  if (m.bcc) p.set('bcc', m.bcc)
  if (m.subject) p.set('su', m.subject)
  if (m.body) p.set('body', m.body)
  return `https://mail.google.com/mail/?${p.toString()}`
}

/** The whole message as plain text, to paste into any email. */
export function mailAsText(m: MailParts): string {
  return [
    m.to && `To: ${m.to}`,
    m.cc && `Cc: ${m.cc}`,
    m.bcc && `Bcc: ${m.bcc}`,
    m.subject && `Subject: ${m.subject}`,
    m.body && `\n${m.body}`,
  ]
    .filter(Boolean)
    .join('\n')
}

// EmailChooser (mounted once) answers here; without it, the plain link is used.
let handler: ((href: string) => boolean) | null = null

export function setMailHandler(h: typeof handler) {
  handler = h
}

/** Send a mailto: the way this device sends email (for code that isn't a link). */
export function openMail(href: string) {
  if (handler?.(href)) return
  window.location.href = href
}

/** Gmail, the email program, or ask — true when the link was taken care of here. */
export function sendMail(href: string, ask: (href: string) => void): boolean {
  if (!onComputer()) return false
  const c = getEmailWith()
  if (c === 'app') return false
  if (c === 'gmail') {
    window.open(gmailComposeUrl(parseMailto(href)), '_blank', 'noopener')
    return true
  }
  ask(href)
  return true
}
