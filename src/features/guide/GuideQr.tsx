// A small QR code for the printed guide (the paper has to carry the app's address as something a camera can read).
// Identical in the app and the website; both already depend on `qrcode`.
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export default function GuideQr({ value, size = 120, alt }: { value: string; size?: number; alt: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(value, { errorCorrectionLevel: 'M', margin: 1, width: size * 3 })
      .then((d) => alive && setSrc(d))
      .catch(() => alive && setSrc(''))
    return () => {
      alive = false
    }
  }, [value, size])
  if (!src) return <span className="block bg-slate-100" style={{ width: size, height: size }} />
  return <img src={src} alt={alt} width={size} height={size} className="bg-white" />
}
