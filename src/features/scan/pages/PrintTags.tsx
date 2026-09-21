// Print a sheet of OHRR tags: a QR code (opens the item in the app) with the
// short code printed large underneath, so a tag can also be typed. Sized for
// Avery 5163 / 8163 labels (2" × 4", 10 per US-Letter sheet); on plain paper
// the same grid prints with cut lines. Codes are random and become real the
// first time someone scans one and fills it in — nothing to register first.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { Icon } from '../../../components/icons'
import { Screen } from '../../../components/ui'
import { newTagCode, shortCode, tagUrl } from '../codes'
import { BigButton } from '../ScanUI'
import { isNative } from '../../../native/platform'
import { renderTagSheet } from '../tagSheet'
import { canvasToBlob } from '../../share/render'
import { savePngAsync } from '../../share/share'

const PER_SHEET = 10

function makeCodes(n: number): string[] {
  const seen = new Set<string>()
  while (seen.size < n) seen.add(newTagCode())
  return [...seen]
}

export default function PrintTags() {
  const [sheets, setSheets] = useState(1)
  const [codes, setCodes] = useState<string[]>(() => makeCodes(PER_SHEET))
  const [qrs, setQrs] = useState<Record<string, string>>({})

  useEffect(() => {
    setCodes((c) => (c.length === sheets * PER_SHEET ? c : makeCodes(sheets * PER_SHEET)))
  }, [sheets])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const out: Record<string, string> = {}
      for (const c of codes) {
        out[c] = await QRCode.toDataURL(tagUrl(c), { errorCorrectionLevel: 'M', margin: 1, width: 320 })
      }
      if (alive) setQrs(out)
    })()
    return () => {
      alive = false
    }
  }, [codes])

  const ready = useMemo(() => codes.every((c) => qrs[c]), [codes, qrs])
  const [sharing, setSharing] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  // In the app there is no window.print(): paint each sheet and hand it to
  // the share sheet (Print / AirPrint on iOS, Files, or send to whoever prints).
  const shareSheets = async () => {
    setSharing(true)
    setNote(null)
    try {
      const canvas = document.createElement('canvas')
      for (let s = 0; s < sheets; s++) {
        await renderTagSheet(canvas, codes.slice(s * PER_SHEET, (s + 1) * PER_SHEET))
        const out = await savePngAsync(await canvasToBlob(canvas), `ohrr-tags-sheet-${s + 1}.png`)
        if (out === 'cancelled') break
      }
      setNote('Each sheet prints on one US-Letter page (choose “Print” or “Save to Files” in the share sheet).')
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Could not make the sheet')
    } finally {
      setSharing(false)
    }
  }

  return (
    <>
      <Screen className="space-y-4 print:hidden">
        <div className="pt-1">
          <Link to="/staff/items" className="inline-flex min-h-[44px] items-center gap-1 text-base font-bold text-brand-blue">
            <Icon name="arrowLeft" size={20} /> Items
          </Link>
          <h1 className="mt-1 font-display text-2xl font-black text-ink">Print tags</h1>
          <p className="mt-1 text-base text-slate-600">
            Stick a tag on each donated item. Scanning the square opens the item in the app; the five characters underneath can be typed instead.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-base font-bold text-ink">How many sheets?</p>
          <p className="text-sm text-slate-500">{PER_SHEET} tags per sheet · Avery 5163 / 8163 labels (2″ × 4″), or plain paper and scissors.</p>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSheets((s) => Math.max(1, s - 1))}
              className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-ink"
              aria-label="One sheet fewer"
            >
              <Icon name="minus" size={24} />
            </button>
            <span className="flex-1 text-center font-display text-3xl font-black text-ink">
              {sheets} <span className="text-base font-bold text-slate-500">sheet{sheets === 1 ? '' : 's'}</span>
            </span>
            <button
              type="button"
              onClick={() => setSheets((s) => Math.min(10, s + 1))}
              className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-blue text-white"
              aria-label="One sheet more"
            >
              <Icon name="plus" size={24} />
            </button>
          </div>
        </div>

        {isNative ? (
          <BigButton onClick={() => void shareSheets()} disabled={!ready || sharing} icon="printer">
            {sharing ? 'Making the sheet…' : `Print or share ${sheets * PER_SHEET} tags`}
          </BigButton>
        ) : (
          <BigButton onClick={() => window.print()} disabled={!ready} icon="printer">
            Print {sheets * PER_SHEET} tags
          </BigButton>
        )}
        {note && <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{note}</p>}
        <BigButton tone="plain" onClick={() => setCodes(makeCodes(sheets * PER_SHEET))}>
          New codes
        </BigButton>
        <p className="text-sm text-slate-500">
          {isNative
            ? 'The share sheet can print (AirPrint), save the sheet, or send it to whoever has the printer. Each print makes a fresh set of codes, so printed sheets never repeat.'
            : 'On a phone, Print offers “Save as PDF” too — send that to whoever has the printer. Each print makes a fresh set of codes, so printed sheets never repeat.'}
        </p>

        {/* on-screen preview */}
        <div className="grid grid-cols-2 gap-2">
          {codes.slice(0, 4).map((c) => (
            <Tag key={c} code={c} qr={qrs[c]} />
          ))}
        </div>
      </Screen>

      {/* print-only sheet(s) */}
      <div className="hidden print:block">
        {Array.from({ length: sheets }, (_, s) => (
          <div key={s} className="tag-sheet">
            {codes.slice(s * PER_SHEET, (s + 1) * PER_SHEET).map((c) => (
              <Tag key={c} code={c} qr={qrs[c]} print />
            ))}
          </div>
        ))}
      </div>

      <style>{`
        @media print {
          @page { size: letter; margin: 0.5in 0.15625in; }
          body { background: white !important; }
          /* the phone-shaped staff shell would clip a letter-size sheet */
          header { display: none !important; }
          [class*="max-w-[480px]"] { max-width: none !important; box-shadow: none !important; }
          .tag-sheet {
            display: grid;
            grid-template-columns: 4in 4in;
            grid-auto-rows: 2in;
            column-gap: 0.1875in;
            row-gap: 0;
            page-break-after: always;
          }
          .tag {
            width: 4in; height: 2in; box-sizing: border-box;
            display: flex; align-items: center; gap: 0.2in; padding: 0.15in 0.25in;
            border: 1px dashed #cbd5e1; border-radius: 0;
          }
          .tag img { width: 1.55in; height: 1.55in; }
          .tag .code { font-size: 30pt; letter-spacing: 0.12em; }
          .tag .brand { font-size: 10pt; }
          .tag .hint { font-size: 8pt; }
        }
      `}</style>
    </>
  )
}

function Tag({ code, qr, print = false }: { code: string; qr?: string; print?: boolean }) {
  return (
    <div className={`tag ${print ? '' : 'flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2'}`}>
      {qr ? <img src={qr} alt="" className={print ? '' : 'h-20 w-20'} /> : <span className={print ? '' : 'h-20 w-20 rounded bg-slate-100'} />}
      <div className="min-w-0 flex-1">
        <p className="brand font-display text-[10px] font-extrabold uppercase tracking-wider text-brand-blue">Ohio House Rabbit Rescue</p>
        <p className="code font-mono text-lg font-black tracking-[0.12em] text-ink">{shortCode(code)}</p>
        <p className="hint text-[10px] leading-tight text-slate-500">Scan with the OHRR app, or type the code.</p>
      </div>
    </div>
  )
}
