import { Link } from 'react-router-dom'
import { Screen, btn } from '../components/ui'

export default function NotFound() {
  return (
    <Screen className="py-20 text-center">
      <div className="text-6xl" aria-hidden>
        <img src="/ohrr-mark.png" alt="" className="mx-auto h-14 w-14 object-contain" />
      </div>
      <h1 className="mt-4 font-display text-2xl font-extrabold text-ink">Page not found</h1>
      <p className="mt-2 text-slate-500">This bunny hopped off somewhere.</p>
      <Link to="/" className={`${btn.blue} mt-6`}>
        Back to home
      </Link>
    </Screen>
  )
}
