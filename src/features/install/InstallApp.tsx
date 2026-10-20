// "Put OHRR on your phone" (2026-10-20, sponsor: "ensure that a user right now
// could install this app to a phone for both android and ios"). Opened in a
// browser, the app can be added to the home screen and then opens full-screen
// like any other app:
//
//   Android (Chrome, Edge, Samsung Internet)  the browser offers "Install";
//       we keep its offer (beforeinstallprompt) and show an Install button
//   iPhone / iPad                             Safari has no button a page can
//       press, so the steps are shown (Share → Add to Home Screen)
//
// Hidden once the app is installed, and inside the Android / iOS builds.
import { useEffect, useState } from 'react'
import { SectionLabel, Card, btn } from '../../components/ui'
import { isNative } from '../../native/platform'
import { isIphone, isStandalone } from '../account/push'

interface InstallOffer extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// The browser makes its offer once, early — often before Settings is open.
let offer: InstallOffer | null = null
const listeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    offer = e as InstallOffer
    listeners.forEach((f) => f())
  })
  window.addEventListener('appinstalled', () => {
    offer = null
    listeners.forEach((f) => f())
  })
}

export default function InstallApp() {
  const [, redraw] = useState(0)
  const [done, setDone] = useState(false)
  useEffect(() => {
    const f = () => redraw((n) => n + 1)
    listeners.add(f)
    return () => {
      listeners.delete(f)
    }
  }, [])

  if (isNative || isStandalone()) return null
  const iphone = isIphone()

  const install = async () => {
    if (!offer) return
    await offer.prompt()
    const { outcome } = await offer.userChoice
    offer = null
    if (outcome === 'accepted') setDone(true)
    redraw((n) => n + 1)
  }

  return (
    <section className="space-y-2">
      <SectionLabel>Put OHRR on your phone</SectionLabel>
      <Card className="space-y-2">
        {done ? (
          <p className="text-sm text-slate-600">Done — OHRR is on your home screen. Open it from there.</p>
        ) : offer ? (
          <>
            <p className="text-sm text-slate-600">Add OHRR to your home screen. It opens full-screen, like any other app, and it’s free.</p>
            <button type="button" onClick={install} className={`${btn.primary} w-full`}>
              Install the OHRR app
            </button>
          </>
        ) : iphone ? (
          <>
            <p className="text-sm text-slate-600">Add OHRR to your home screen. It opens full-screen, like any other app, and it’s free.</p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
              <li>Open this page in Safari.</li>
              <li>Tap the Share button (the square with an arrow pointing up).</li>
              <li>Tap “Add to Home Screen”, then “Add”.</li>
            </ol>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600">Add OHRR to your home screen. It opens full-screen, like any other app, and it’s free.</p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
              <li>Open this page in Chrome.</li>
              <li>Tap the menu (the three dots in the top corner).</li>
              <li>Tap “Install app” or “Add to Home screen”.</li>
            </ol>
          </>
        )}
      </Card>
    </section>
  )
}
