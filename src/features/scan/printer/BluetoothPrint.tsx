// "Print by Bluetooth" on the labels pages (2026-10-23, sponsor: "I think we
// need a Bluetooth connection not wifi" — OHRR's Phomemo PM-249-WF). Each label
// is painted at the printer's 203 dpi and sent straight to it; no printer app
// in between. The first tap asks which printer to use; the apps remember it.
//
// The printer's language comes from an untested open-source profile, so the
// settings hold the fixes for a first print that comes out wrong: darker or
// lighter, plain mode (nothing prints), flip (comes out reversed), and every
// Bluetooth device (the printer isn't in the list).
import { useState } from 'react'
import { errMessage } from '../../../lib/supabase'
import { isNative } from '../../../native/platform'
import { isIphone } from '../../account/push'
import { Icon } from '../../../components/icons'
import { BigButton } from '../ScanUI'
import { renderLabel, type LabelItem, type LabelSize } from '../labels'
import { PRINTER_DPI, buildJob, toRaster, type Darkness } from './tspl'
import { bluetoothAvailable, choosePrinter, connectedPrinter, ensurePrinter, forgetPrinter, rememberedPrinter, sendJob } from './bluetooth'

const OPTS_KEY = 'ohrr.labels.btOptions'

interface BtOptions {
  darkness: Darkness
  plain: boolean
  /** Named "swap" since 2026-10-27, when 0 = black became the default: a phone
   *  that ticked the old "flip" to fix its first print mustn't flip it back. */
  swap: boolean
  anyName: boolean
}
const DEFAULTS: BtOptions = { darkness: 'normal', plain: false, swap: false, anyName: false }

function loadOpts(): BtOptions {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(OPTS_KEY) ?? '{}') as Partial<BtOptions>) }
  } catch {
    return DEFAULTS
  }
}

const plural = (n: number) => `${n} label${n === 1 ? '' : 's'}`
const cancelled = (e: unknown) => /cancel/i.test(errMessage(e)) || (e instanceof DOMException && e.name === 'NotFoundError')

export interface BtLabel {
  code: string
  item: LabelItem
  copies: number
}

export default function BluetoothPrint({
  labels,
  size,
  busy,
  setBusy,
  onPrinted,
  onError,
  compact = false,
}: {
  labels: BtLabel[]
  size: LabelSize
  busy: string | null
  setBusy: (b: string | null) => void
  /** Called once everything is sent: the codes printed and a note to show. */
  onPrinted: (codes: string[], note: string) => void
  onError: (msg: string | null) => void
  /** In a page's sticky footer: a shorter button, one line under it, and nothing at all where Bluetooth can't work. */
  compact?: boolean
}) {
  const [opts, setOpts] = useState<BtOptions>(loadOpts)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState<string | null>(() => connectedPrinter()?.name ?? (isNative ? (rememberedPrinter()?.name ?? null) : null))

  if (!bluetoothAvailable()) {
    // Safari on iPhone, Firefox: no Bluetooth for web pages.
    if (compact) return null
    return (
      <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
        {isIphone()
          ? 'Printing straight to the Bluetooth label printer needs the OHRR app from the App Store (on its way). On this iPhone, use Print or share and the printer’s Labelife app.'
          : 'Printing straight to the Bluetooth label printer works in Chrome or Edge, and in the OHRR Android app.'}
      </p>
    )
  }

  const save = (o: Partial<BtOptions>) => {
    const next = { ...opts, ...o }
    setOpts(next)
    try {
      localStorage.setItem(OPTS_KEY, JSON.stringify(next))
    } catch {
      /* private mode */
    }
  }

  const total = labels.reduce((n, l) => n + l.copies, 0)

  const change = async () => {
    onError(null)
    try {
      setBusy('Choosing the printer…')
      const p = await choosePrinter(opts.anyName)
      setName(p.name)
    } catch (e) {
      if (!cancelled(e)) onError(`Couldn’t connect to the printer: ${errMessage(e)}`)
    } finally {
      setBusy(null)
    }
  }

  const print = async () => {
    if (labels.length === 0) return
    onError(null)
    try {
      // The printer list has to open straight from the tap, so this comes first.
      let p = await ensurePrinter()
      if (!p) {
        setBusy('Choosing the printer…')
        p = await choosePrinter(opts.anyName)
      }
      setName(p.name)
      let sent = 0
      for (const l of labels) {
        const at = `Label ${sent + 1}${l.copies > 1 ? `–${sent + l.copies}` : ''} of ${total}`
        setBusy(`${at}: painting…`)
        const canvas = document.createElement('canvas')
        await renderLabel(canvas, l.item, size, PRINTER_DPI)
        const dither = size.hIn >= 3 && !!l.item.photo_url
        const job = buildJob(toRaster(canvas, { flip: opts.swap, dither }), { copies: l.copies, darkness: opts.darkness, plain: opts.plain, flip: opts.swap, dither })
        await sendJob(job, (f) => setBusy(`${at}: sending ${Math.round(f * 100)}%`))
        sent += l.copies
      }
      onPrinted(
        labels.map((l) => l.code),
        `${plural(sent)} sent to ${p.name} and marked as printed.`,
      )
    } catch (e) {
      if (!cancelled(e)) onError(`Couldn’t print by Bluetooth: ${errMessage(e)} Check the printer is on, has labels and is close by, then try again.`)
    } finally {
      setBusy(null)
    }
  }

  const chip = (on: boolean) =>
    `min-h-[44px] rounded-full px-4 text-[15px] font-bold transition ${on ? 'bg-brand-blue text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600'}`
  const check = 'flex min-h-[44px] items-start gap-2 text-[15px] text-slate-700'

  // Which printer, and the way to pick or change it. Under the button, or
  // (compact) at the top of the settings.
  const printerRow = (
    <div className="flex flex-wrap items-center gap-x-3 text-sm text-slate-600">
      <span>{name ? `Printer: ${name}` : 'The first time, pick the printer from the list (its name starts PM-).'}</span>
      <button type="button" onClick={() => void change()} disabled={!!busy} className="min-h-[44px] font-bold text-brand-blue">
        {name ? 'Change' : 'Pick the printer'}
      </button>
      {!compact && (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="min-h-[44px] font-bold text-brand-blue">
          {open ? 'Hide printer settings' : 'Printer settings'}
        </button>
      )}
    </div>
  )

  return (
    <div className="space-y-2">
      {compact ? (
        <div className="flex gap-2">
          <BigButton onClick={() => void print()} disabled={!!busy || labels.length === 0} icon="printer" tone="blue" className="!min-h-[52px] flex-1 text-base">
            {busy ?? `${plural(total)} by Bluetooth`}
          </BigButton>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label="Printer settings"
            title="Printer settings"
            className={`inline-flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl border-2 ${open ? 'border-brand-blue bg-brand-blue-50 text-brand-blue' : 'border-slate-200 bg-white text-slate-600'}`}
          >
            <Icon name="settings" size={22} />
          </button>
        </div>
      ) : (
        <>
          <BigButton onClick={() => void print()} disabled={!!busy || labels.length === 0} icon="printer" tone="blue">
            {busy ?? `Print ${plural(total)} by Bluetooth`}
          </BigButton>
          {printerRow}
        </>
      )}
      {open && (
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
          {compact && printerRow}
          <p className="text-base font-bold text-ink">Darkness</p>
          <div className="flex flex-wrap gap-2">
            {(['light', 'normal', 'dark'] as Darkness[]).map((d) => (
              <button key={d} type="button" onClick={() => save({ darkness: d })} aria-pressed={opts.darkness === d} className={chip(opts.darkness === d)}>
                {d === 'light' ? 'Lighter' : d === 'normal' ? 'Normal' : 'Darker'}
              </button>
            ))}
          </div>
          <p className="pt-2 text-base font-bold text-ink">If the first label comes out wrong</p>
          <label className={check}>
            <input type="checkbox" checked={opts.plain} onChange={(e) => save({ plain: e.target.checked })} className="mt-0.5 h-6 w-6 shrink-0 accent-brand-blue" />
            <span>Nothing prints, or it prints noise — send the picture in plain mode</span>
          </label>
          <label className={check}>
            <input type="checkbox" checked={opts.swap} onChange={(e) => save({ swap: e.target.checked })} className="mt-0.5 h-6 w-6 shrink-0 accent-brand-blue" />
            <span>Black and white come out swapped — flip them</span>
          </label>
          <label className={check}>
            <input type="checkbox" checked={opts.anyName} onChange={(e) => save({ anyName: e.target.checked })} className="mt-0.5 h-6 w-6 shrink-0 accent-brand-blue" />
            <span>The printer isn’t in the list — show every Bluetooth device</span>
          </label>
          <p className="text-sm text-slate-500">
            Use the label size that is in the printer (4 × 6 in for shipping labels). Turn the printer on before you tap Print; it must not be connected to
            another phone at the same time.
          </p>
          {name && (
            <button
              type="button"
              onClick={() => {
                void forgetPrinter()
                setName(null)
              }}
              className="min-h-[44px] text-sm font-bold text-brand-blue"
            >
              Forget this printer
            </button>
          )}
        </div>
      )}
    </div>
  )
}
