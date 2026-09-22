// A QR code for a link — the way OHRR hands something over in person: hold up
// the phone, the other person's camera opens it. Used for staff invites, a
// volunteer's hours link and anywhere else a link has to cross a table.
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export default function QrCode({
  value,
  size = 220,
  className = '',
  alt = 'QR code',
}: {
  value: string
  size?: number
  className?: string
  alt?: string
}) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(value, { errorCorrectionLevel: 'M', margin: 1, width: size * 2 })
      .then((d) => alive && setSrc(d))
      .catch(() => alive && setSrc(''))
    return () => {
      alive = false
    }
  }, [value, size])

  if (!src) return <span className={`block rounded-xl bg-slate-100 ${className}`} style={{ width: size, height: size }} />
  return <img src={src} alt={alt} width={size} height={size} className={`rounded-xl bg-white ${className}`} />
}
