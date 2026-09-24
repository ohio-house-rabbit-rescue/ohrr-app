// Hand a file to whoever is using the app: the share sheet inside the
// Android/iOS build (a blob download can't reach Files there), an ordinary
// download on the web. Used for CSV exports from the staff screens, and for
// the PDF hours letter a volunteer makes on their own page.
import { isNative } from '../native/platform'

/** Quote a CSV cell the way spreadsheets expect. */
function cell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  // The BOM makes Excel open UTF-8 correctly (names with accents, en dashes).
  return '﻿' + [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
}

/** Save or share a CSV. Resolves 'shared' | 'saved' | 'cancelled' | 'failed'. */
export async function exportCsv(filename: string, csv: string): Promise<'shared' | 'saved' | 'cancelled' | 'failed'> {
  return exportBlob(filename, new Blob([csv], { type: 'text/csv;charset=utf-8' }))
}

/** Save or share any file (a CSV, a volunteer's PDF letter): the share sheet in the phone app, a download on the web. */
export async function exportBlob(filename: string, blob: Blob): Promise<'shared' | 'saved' | 'cancelled' | 'failed'> {
  if (isNative) {
    const { shareFileNative } = await import('../native/share')
    const r = await shareFileNative(blob, filename, undefined, filename)
    return r === 'shared' ? 'shared' : r === 'cancelled' ? 'cancelled' : 'failed'
  }
  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    return 'saved'
  } catch {
    return 'failed'
  }
}

/** A mailto: that BCCs everyone — the polite way to reach a whole shift. */
export function bccMailto(emails: string[], subject: string, body = ''): string {
  const list = [...new Set(emails.filter(Boolean))].join(',')
  const params = new URLSearchParams()
  params.set('bcc', list)
  params.set('subject', subject)
  if (body) params.set('body', body)
  // mailto wants an empty "to"; everyone goes in bcc so nobody sees the others.
  return `mailto:?${params.toString()}`
}
