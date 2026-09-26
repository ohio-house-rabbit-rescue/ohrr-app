// Mounted once inside <BrowserRouter> (see main.tsx). Renders nothing. On the
// web it does nothing at all; inside the Android / iOS app it:
//   - paints the status bar brand blue and hides the splash after first render
//   - sends external http(s) links to the system browser
//   - makes Android's back button walk the in-app history (and leave from Home)
//   - opens the right bunny when a care-reminder notification is tapped (or
//     the session, event or booking for My OHRR's phone reminders)

import { useEffect } from 'react'
import type { PluginListenerHandle } from '@capacitor/core'
import { useNavigate } from 'react-router-dom'
import { isAndroid, isNative, initNativeShell } from './platform'
import { installExternalLinkHandler } from './browser'

export default function NativeBridge() {
  const navigate = useNavigate()

  // Splash + status bar: once, after React has painted the first screen.
  useEffect(() => {
    if (!isNative) return
    const raf = requestAnimationFrame(() => void initNativeShell())
    return () => cancelAnimationFrame(raf)
  }, [])

  // External links → system browser.
  useEffect(() => installExternalLinkHandler(), [])

  // Notification tap → that bunny's page.
  useEffect(() => {
    if (!isNative) return
    return listen(async () => {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      return LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        // "Remind me on this phone" (My OHRR) says where it belongs: a session,
        // an event or a booking. Care reminders carry their bunny.
        const to = action.notification.extra?.to
        if (typeof to === 'string' && to.startsWith('/') && !to.startsWith('//')) {
          navigate(to)
          return
        }
        const bunnyId = action.notification.extra?.bunnyId
        navigate(typeof bunnyId === 'string' && bunnyId ? `/my-bunny/${bunnyId}` : '/my-bunny')
      })
    })
  }, [navigate])

  // Android hardware back button. Registering a listener disables Capacitor's
  // default, so: on Home → leave the app; otherwise go back (or Home if there's
  // nowhere to go back to, e.g. the app was opened straight onto a deep link).
  useEffect(() => {
    if (!isAndroid) return
    return listen(async () => {
      const { App } = await import('@capacitor/app')
      return App.addListener('backButton', ({ canGoBack }) => {
        if (window.location.pathname === '/') {
          void App.exitApp()
        } else if (canGoBack) {
          window.history.back()
        } else {
          navigate('/', { replace: true })
        }
      })
    })
  }, [navigate])

  return null
}

/**
 * Subscribe to a Capacitor plugin event from an effect. The plugin modules
 * load asynchronously, so if the effect is cleaned up before the listener
 * exists (React StrictMode does this in dev) the late handle is removed too.
 */
function listen(subscribe: () => Promise<PluginListenerHandle>): () => void {
  let handle: PluginListenerHandle | undefined
  let cancelled = false
  void subscribe()
    .then((h) => {
      if (cancelled) void h.remove()
      else handle = h
    })
    .catch((err) => console.warn('[native] listener', err))
  return () => {
    cancelled = true
    void handle?.remove()
  }
}
