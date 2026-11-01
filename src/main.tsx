import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { applyTextSize } from './lib/textSize'
import { isNative } from './native/platform'
import { loadCurrentEvent } from './lib/currentEvent'
import './index.css'

// The reader's text-size choice, before anything renders.
applyTextSize()

// The offline cache (public/sw.js): the app — and the Counter and Door — keep
// opening on a phone with no signal. Web only; the phone apps carry their
// files already.
if (import.meta.env.PROD && !isNative && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}

// Which event the auction and raffle are for (Staff → Silent Auction) is read
// first, then the rest of the app loads — so every screen sees the same event
// from its first line, with no change to the code for a new one.
async function start() {
  await loadCurrentEvent()
  const [{ default: App }, { AuthProvider }, { default: NativeBridge }, { default: EmailChooser }] = await Promise.all([
    import('./App'),
    import('./lib/auth'),
    import('./native/NativeBridge'),
    import('./components/EmailChooser'),
  ])
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        {/* No-op on the web; inside the Android/iOS app: splash, status bar, back button, external links */}
        <NativeBridge />
        {/* On a computer: email links go to Gmail, the email program, or are copied */}
        <EmailChooser />
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>,
  )
}

void start()
