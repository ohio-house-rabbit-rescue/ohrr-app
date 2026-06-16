import { Link } from 'react-router-dom'
import { Container } from '../components/ui'

export default function NotFound() {
  return (
    <Container className="py-24 text-center">
      <div className="text-6xl" aria-hidden>🐰</div>
      <h1 className="mt-4 text-2xl font-bold text-stone-900">Page not found</h1>
      <p className="mt-2 text-stone-600">
        This bunny hopped off somewhere. Let’s get you back on track.
      </p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-full bg-emerald-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-emerald-700"
      >
        Back to home
      </Link>
    </Container>
  )
}
