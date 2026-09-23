import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './lib/auth'
import NativeBridge from './native/NativeBridge'
import { applyTextSize } from './lib/textSize'
import { isNative } from './native/platform'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      {/* No-op on the web; inside the Android/iOS app: splash, status bar, back button, external links */}
      <NativeBridge />
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
