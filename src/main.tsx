import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './lib/auth'
import NativeBridge from './native/NativeBridge'
import { applyTextSize } from './lib/textSize'
import './index.css'

// The reader's text-size choice, before anything renders.
applyTextSize()

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
