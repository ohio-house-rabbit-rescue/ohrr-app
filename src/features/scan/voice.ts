// Say the name instead of typing it (Receive items, Search). The browser's own
// speech recognition (Chrome, Edge, Safari) does the listening. It does not
// work everywhere, and a Samsung S20 showed why that must never fail silently
// (2026-11-01: "the voice did not work"):
//   · inside the Android app (a WebView) the mic button looks fine but nothing
//     is ever heard, so the button is not shown there at all;
//   · in Chrome the microphone may be blocked, or the phone's voice service
//     may be off — the reason is said in words, under the field.
// Every phone's keyboard has its own microphone key, which always works, so the
// tip points at it whenever the button can't be used.
import { useCallback, useEffect, useRef, useState } from 'react'
import { isNative } from '../../native/platform'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Recognition: any =
  typeof window !== 'undefined' && ((window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition)

/** The Android app's web view can't listen, whatever it claims. */
const canListen = Boolean(Recognition) && !isNative

export const KEYBOARD_MIC_TIP = 'To speak, tap the box and use the microphone key on your keyboard.'

function reason(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return `The microphone is blocked for this page. Allow it in the browser’s site settings. ${KEYBOARD_MIC_TIP}`
    case 'no-speech':
      return 'Nothing was heard. Tap the microphone and speak close to the phone.'
    case 'audio-capture':
      return `No microphone was found. ${KEYBOARD_MIC_TIP}`
    case 'network':
      return `Voice needs an internet connection. ${KEYBOARD_MIC_TIP}`
    case 'aborted':
      return ''
    default:
      return `Voice didn’t work on this phone. ${KEYBOARD_MIC_TIP}`
  }
}

/**
 * `onText` gets what was said (live while talking, final at the end).
 * `supported` false → don't show a mic button; show `KEYBOARD_MIC_TIP` instead.
 */
export function useVoiceInput(onText: (text: string, final: boolean) => void) {
  const [listening, setListening] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recogRef = useRef<any>(null)
  const heard = useRef(false)
  const onTextRef = useRef(onText)
  onTextRef.current = onText

  const stop = useCallback(() => {
    try {
      recogRef.current?.stop?.()
    } catch {
      /* already stopped */
    }
  }, [])

  useEffect(() => stop, [stop])

  const toggle = useCallback(() => {
    if (!canListen) return
    if (recogRef.current && listening) {
      stop()
      return
    }
    setMessage(null)
    heard.current = false
    try {
      const recog = new Recognition()
      recogRef.current = recog
      recog.lang = 'en-US'
      recog.interimResults = true
      recog.maxAlternatives = 1
      recog.continuous = false
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recog.onresult = (e: any) => {
        let text = ''
        let final = false
        for (let i = 0; i < (e.results?.length ?? 0); i++) {
          text += String(e.results[i]?.[0]?.transcript ?? '')
          if (e.results[i]?.isFinal) final = true
        }
        text = text.trim()
        if (text) {
          heard.current = true
          onTextRef.current(text, final)
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recog.onerror = (e: any) => {
        setMessage(reason(String(e?.error ?? '')) || null)
        heard.current = true // the error already said why
        setListening(false)
      }
      recog.onend = () => {
        setListening(false)
        if (!heard.current) setMessage(reason('no-speech'))
      }
      setListening(true)
      recog.start()
    } catch {
      setListening(false)
      setMessage(`Voice didn’t start on this phone. ${KEYBOARD_MIC_TIP}`)
    }
  }, [listening, stop])

  return { supported: canListen, listening, message, toggle, stop }
}

/** "plush bunny" → "Plush bunny". */
export const sentenceCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
