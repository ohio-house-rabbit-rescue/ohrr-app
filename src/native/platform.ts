// Native (Capacitor) detection + app-shell setup. The ONLY place the rest of
// the app should ask "am I inside the Android/iOS app?".
//
// Everything in src/native/ is a no-op on the web: each helper checks
// `isNative` first, and the Capacitor plugin packages are imported lazily
// (`await import(...)`) so they never land in the web bundle's critical path.
// The web app on Cloudflare Pages keeps its file inputs, .ics downloads and
// ordinary links exactly as before.

import { Capacitor } from '@capacitor/core'

/** True inside the Capacitor Android / iOS shell; false in any browser (incl. installed PWA). */
export const isNative: boolean = Capacitor.isNativePlatform()

/** 'android' | 'ios' | 'web' */
export const platform: 'android' | 'ios' | 'web' = Capacitor.getPlatform() as 'android' | 'ios' | 'web'

export const isAndroid = platform === 'android'
export const isIos = platform === 'ios'

/** Brand blue — matches capacitor.config.ts and index.css. */
export const BRAND_BLUE = '#0669ac'

let shellReady = false

/**
 * One-time native shell setup: brand-blue status bar with light icons, then
 * hide the splash screen. Call once after React's first paint (NativeBridge
 * does this). Safe to call on the web — it returns immediately.
 */
export async function initNativeShell(): Promise<void> {
  if (!isNative || shellReady) return
  shellReady = true
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    // Style.Dark = light (white) text/icons, for a dark background.
    await StatusBar.setStyle({ style: Style.Dark })
    if (isAndroid) {
      await StatusBar.setBackgroundColor({ color: BRAND_BLUE })
      await StatusBar.setOverlaysWebView({ overlay: false })
    }
  } catch (err) {
    console.warn('[native] status bar', err)
  }
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide({ fadeOutDuration: 200 })
  } catch (err) {
    console.warn('[native] splash', err)
  }
}
