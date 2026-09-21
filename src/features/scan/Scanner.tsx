// The camera view that reads OHRR QR tags and retail barcodes. Uses the
// browser's built-in BarcodeDetector where it exists (Chrome / Android WebView —
// fast, no download) and falls back to ZXing (loaded on demand) everywhere
// else, including iPhone. Works in the plain web app and inside the Capacitor
// app (the WebView hands getUserMedia the app's camera permission).
//
// Fires `onResult` ONCE with the raw text, then stops the camera. The parent
// decides what the text means (codes.ts normalizeCode).
import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/icons'
import { btn } from '../../components/ui'

type Phase = 'starting' | 'scanning' | 'blocked' | 'nocamera' | 'failed'

interface DetectedLike {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedLike[]>
}
interface BarcodeDetectorCtor {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike
  getSupportedFormats?: () => Promise<string[]>
}

const WANTED_FORMATS = ['qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']

function nativeDetector(): BarcodeDetectorCtor | null {
  const w = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }
  return typeof w.BarcodeDetector === 'function' ? w.BarcodeDetector : null
}

function buzz() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(60)
  } catch {
    /* not supported */
  }
}

export default function Scanner({
  onResult,
  onTypeInstead,
  paused = false,
}: {
  onResult: (raw: string) => void
  /** "Type the code instead" — shown large under the camera and on every error. */
  onTypeInstead: () => void
  /** True while the parent is busy with a result; the camera stays off. */
  paused?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [phase, setPhase] = useState<Phase>('starting')
  const [torch, setTorch] = useState<{ track: MediaStreamTrack; on: boolean } | null>(null)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  useEffect(() => {
    if (paused) return
    const video = videoRef.current
    if (!video) return
    let stopped = false
    let stream: MediaStream | null = null
    let raf = 0
    let zxingStop: (() => void) | null = null

    const finish = (raw: string) => {
      if (stopped) return
      stopped = true
      buzz()
      stopAll()
      onResultRef.current(raw)
    }

    const stopAll = () => {
      cancelAnimationFrame(raf)
      if (zxingStop) {
        try {
          zxingStop()
        } catch {
          /* already stopped */
        }
        zxingStop = null
      }
      stream?.getTracks().forEach((t) => t.stop())
      stream = null
      if (video) video.srcObject = null
    }

    ;(async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPhase('nocamera')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
      } catch (err) {
        const name = (err as { name?: string })?.name ?? ''
        setPhase(name === 'NotAllowedError' || name === 'SecurityError' ? 'blocked' : name === 'NotFoundError' ? 'nocamera' : 'failed')
        return
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      video.srcObject = stream
      try {
        await video.play()
      } catch {
        /* autoplay policies — the muted/playsInline attributes make this rare */
      }
      const track = stream.getVideoTracks()[0]
      const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean }
      if (caps.torch) setTorch({ track, on: false })
      setPhase('scanning')

      const Native = nativeDetector()
      if (Native) {
        let formats = WANTED_FORMATS
        try {
          const supported = await Native.getSupportedFormats?.()
          if (supported?.length) formats = WANTED_FORMATS.filter((f) => supported.includes(f))
        } catch {
          /* use the defaults */
        }
        const detector = new Native({ formats })
        let last = 0
        const tick = async (now: number) => {
          if (stopped) return
          if (now - last > 140 && video.readyState >= 2) {
            last = now
            try {
              const found = await detector.detect(video)
              const hit = found.find((f) => f.rawValue)
              if (hit) return finish(hit.rawValue)
            } catch {
              /* a frame failed to decode — keep going */
            }
          }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return
      }

      // Fallback: ZXing, loaded only when we get here.
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ])
        if (stopped) return
        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.QR_CODE,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
        ])
        hints.set(DecodeHintType.TRY_HARDER, true)
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 })
        const controls = await reader.decodeFromStream(stream, video, (result) => {
          if (result) finish(result.getText())
        })
        zxingStop = () => controls.stop()
      } catch {
        if (!stopped) setPhase('failed')
      }
    })()

    return () => {
      stopped = true
      stopAll()
    }
  }, [paused])

  const toggleTorch = async () => {
    if (!torch) return
    try {
      await torch.track.applyConstraints({ advanced: [{ torch: !torch.on } as MediaTrackConstraintSet] })
      setTorch({ track: torch.track, on: !torch.on })
    } catch {
      /* torch not really available */
    }
  }

  const trouble = phase === 'blocked' || phase === 'nocamera' || phase === 'failed'

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-3xl bg-slate-900" style={{ aspectRatio: '3 / 4' }}>
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`h-full w-full object-cover ${trouble || paused ? 'opacity-0' : ''}`}
        />
        {/* viewfinder corners */}
        {!trouble && !paused && (
          <div className="pointer-events-none absolute inset-[12%] rounded-2xl">
            {['top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl', 'top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl', 'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl', 'bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl'].map((c) => (
              <span key={c} className={`absolute h-10 w-10 border-white/90 ${c}`} />
            ))}
          </div>
        )}
        {phase === 'starting' && !trouble && !paused && (
          <p className="absolute inset-x-0 bottom-5 text-center text-sm font-bold text-white/85">Starting the camera…</p>
        )}
        {phase === 'scanning' && !paused && (
          <p className="absolute inset-x-0 bottom-5 text-center text-[15px] font-extrabold text-white drop-shadow">
            Point at the tag or barcode
          </p>
        )}
        {paused && (
          <p className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white/85">Got it…</p>
        )}
        {trouble && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-white">
            <Icon name="camera" size={40} className="text-white/70" />
            <p className="font-display text-lg font-black">
              {phase === 'blocked' ? 'The camera is turned off for this app' : phase === 'nocamera' ? 'No camera found' : 'The camera didn’t start'}
            </p>
            <p className="text-sm text-white/80">
              {phase === 'blocked'
                ? 'You can allow the camera in your phone’s settings, or type the code below.'
                : 'You can still type the code that’s printed on the tag.'}
            </p>
          </div>
        )}
        {torch && phase === 'scanning' && !paused && (
          <button
            type="button"
            onClick={toggleTorch}
            className={`absolute right-3 top-3 rounded-full px-3.5 py-2 text-xs font-bold ${torch.on ? 'bg-white text-ink' : 'bg-black/50 text-white'}`}
          >
            {torch.on ? 'Light on' : 'Light'}
          </button>
        )}
      </div>

      <button type="button" onClick={onTypeInstead} className={`${btn.outline} w-full py-3.5 text-base`}>
        <Icon name="keyboard" size={20} /> Type the code instead
      </button>
    </div>
  )
}
