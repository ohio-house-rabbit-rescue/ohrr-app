import { Routes, Route } from 'react-router-dom'
import OhrrLayout from './components/OhrrLayout'
import BunfestLayout from './components/BunfestLayout'
// OHRR host app
import OhrrHome from './pages/OhrrHome'
import Adopt from './pages/Adopt'
import Learn from './pages/Learn'
import Volunteer from './pages/Volunteer'
import About from './pages/About'
import Give from './pages/Give'
import NotFound from './pages/NotFound'
// Midwest BunFest sub-app
import BunfestHome from './pages/BunfestHome'
import Schedule from './pages/Schedule'
import Vendors from './pages/Vendors'
import Partners from './pages/Partners'
import Sponsors from './pages/Sponsors'
import Visit from './pages/Visit'

export default function App() {
  return (
    <Routes>
      {/* OHRR host app */}
      <Route element={<OhrrLayout />}>
        <Route path="/" element={<OhrrHome />} />
        <Route path="/adopt" element={<Adopt />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/volunteer" element={<Volunteer />} />
        <Route path="/support" element={<Give />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Midwest BunFest sub-app (distinct look & feel) */}
      <Route path="/bunfest" element={<BunfestLayout />}>
        <Route index element={<BunfestHome />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="vendors" element={<Vendors />} />
        <Route path="partners" element={<Partners />} />
        <Route path="sponsors" element={<Sponsors />} />
        <Route path="visit" element={<Visit />} />
        <Route path="give" element={<Give />} />
      </Route>
    </Routes>
  )
}
