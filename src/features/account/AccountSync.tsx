// Mounted once (App.tsx). Tells the account sync who is signed in, and pulls
// again when the app comes back to the front or the phone gets signal back.
// Renders nothing.
import { useEffect } from 'react'
import { useAuth } from '../../lib/auth'
import { pullIfStale, setSyncUser } from './sync'

export default function AccountSync() {
  const { user } = useAuth()
  const uid = user?.id ?? null

  useEffect(() => {
    setSyncUser(uid)
  }, [uid])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') pullIfStale()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', pullIfStale)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', pullIfStale)
    }
  }, [])

  return null
}
