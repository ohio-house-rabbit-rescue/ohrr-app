import { Link } from 'react-router-dom'
import { event } from '../data/event'

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-stone-200 bg-white">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <img src="/bunny.svg" alt="" className="h-8 w-8" />
            <span className="font-bold text-stone-900">Midwest BunFest</span>
          </div>
          <p className="mt-3 text-sm text-stone-600">
            The flagship annual fundraiser of Ohio House Rabbit Rescue — a 501(c)(3)
            nonprofit rabbit rescue in Columbus, Ohio.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-stone-900">Explore</h3>
          <ul className="mt-3 space-y-2 text-sm text-stone-600">
            <li><Link to="/schedule" className="hover:text-emerald-700">Schedule</Link></li>
            <li><Link to="/vendors" className="hover:text-emerald-700">Vendors</Link></li>
            <li><Link to="/partners" className="hover:text-emerald-700">Rescue Partners</Link></li>
            <li><Link to="/visit" className="hover:text-emerald-700">Plan Your Visit</Link></li>
            <li><Link to="/give" className="font-medium text-emerald-700 hover:text-emerald-800">Support OHRR</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-stone-900">Official sites</h3>
          <ul className="mt-3 space-y-2 text-sm text-stone-600">
            <li>
              <a href={event.links.bunfest} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-700">
                midwestbunfest.org
              </a>
            </li>
            <li>
              <a href={event.links.ohrr} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-700">
                ohiohouserabbitrescue.org
              </a>
            </li>
            <li>
              <a href={event.links.bunfestFacebook} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-700">
                BunFest on Facebook
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-stone-200">
        <div className="mx-auto max-w-5xl px-4 py-4 text-xs text-stone-500">
          Unofficial companion app · in development. Event details shown here are
          preliminary — always confirm against the{' '}
          <a href={event.links.bunfest} target="_blank" rel="noopener noreferrer" className="underline hover:text-emerald-700">
            official BunFest site
          </a>
          .
        </div>
      </div>
    </footer>
  )
}
