import { Routes, Route } from 'react-router-dom'
import OhrrLayout from './components/OhrrLayout'
import BunfestLayout from './components/BunfestLayout'
// OHRR host app
import OhrrHome from './pages/OhrrHome'
import Adopt from './pages/Adopt'
import AdoptRabbit from './pages/AdoptRabbit'
import Tails from './pages/Tails'
import TailDetail from './pages/TailDetail'
import Services from './pages/Services'
import ServiceSignup from './pages/ServiceSignup'
import Learn from './pages/Learn'
import LearnTopic from './pages/LearnTopic'
import Volunteer from './pages/Volunteer'
import About from './pages/About'
import Give from './pages/Give'
import NotFound from './pages/NotFound'
// Midwest BunFest sub-app
import BunfestHome from './pages/BunfestHome'
import Schedule from './pages/Schedule'
import Vendors from './pages/Vendors'
import VendorDetail from './pages/VendorDetail'
import Partners from './pages/Partners'
import PartnerDetail from './pages/PartnerDetail'
import Sponsors from './pages/Sponsors'
import Visit from './pages/Visit'

export default function App() {
  return (
    <Routes>
      {/* OHRR host app */}
      <Route element={<OhrrLayout />}>
        <Route path="/" element={<OhrrHome />} />
        <Route path="/adopt" element={<Adopt />} />
        <Route path="/adopt/:id" element={<AdoptRabbit />} />
        <Route path="/tails" element={<Tails />} />
        <Route path="/tails/:id" element={<TailDetail />} />
        <Route path="/services" element={<Services />} />
        <Route path="/services/signup" element={<ServiceSignup />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/learn/:id" element={<LearnTopic />} />
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
        <Route path="vendors/:id" element={<VendorDetail />} />
        <Route path="partners" element={<Partners />} />
        <Route path="partners/:id" element={<PartnerDetail />} />
        <Route path="sponsors" element={<Sponsors />} />
        <Route path="visit" element={<Visit />} />
        <Route path="give" element={<Give />} />
      </Route>
    </Routes>
  )
}
