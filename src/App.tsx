import { Routes, Route } from 'react-router-dom'
import OhrrLayout from './components/OhrrLayout'
import BunfestLayout from './components/BunfestLayout'
// OHRR host app
import OhrrHome from './pages/OhrrHome'
import Adopt from './pages/Adopt'
import AdoptRabbit from './pages/AdoptRabbit'
import Tails from './pages/Tails'
import TailDetail from './pages/TailDetail'
import ShareTail from './pages/ShareTail'
import Services from './pages/Services'
import ServiceSignup from './pages/ServiceSignup'
import Learn from './pages/Learn'
import LearnTopic from './pages/LearnTopic'
import Volunteer from './pages/Volunteer'
import VolunteerWay from './pages/VolunteerWay'
import VolunteerSignup from './pages/VolunteerSignup'
import About from './pages/About'
import Give from './pages/Give'
import HopShop from './pages/HopShop'
import Surrender from './pages/Surrender'
import SurrenderForm from './pages/SurrenderForm'
import Appointment from './pages/Appointment'
import Settings from './pages/Settings'
import Help from './pages/Help'
import Search from './pages/Search'
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
import EventMap from './pages/EventMap'
import BunfestPage from './pages/BunfestPage'
import SilentAuction from './pages/SilentAuction'
// Staff backend (Supabase-gated)
import StaffLayout from './components/StaffLayout'
import { RequireMembership } from './components/staffui'
import StaffSignIn from './pages/StaffSignIn'
import StaffOnboard from './pages/StaffOnboard'
import StaffHome from './pages/StaffHome'
import HopShopManager from './pages/HopShopManager'

export default function App() {
  return (
    <Routes>
      {/* OHRR host app */}
      <Route element={<OhrrLayout />}>
        <Route path="/" element={<OhrrHome />} />
        <Route path="/adopt" element={<Adopt />} />
        <Route path="/adopt/:id" element={<AdoptRabbit />} />
        <Route path="/tails" element={<Tails />} />
        <Route path="/tails/share" element={<ShareTail />} />
        <Route path="/tails/:id" element={<TailDetail />} />
        <Route path="/services" element={<Services />} />
        <Route path="/services/signup" element={<ServiceSignup />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/learn/:id" element={<LearnTopic />} />
        <Route path="/volunteer" element={<Volunteer />} />
        <Route path="/volunteer/signup" element={<VolunteerSignup />} />
        <Route path="/volunteer/:slug" element={<VolunteerWay />} />
        <Route path="/support" element={<Give />} />
        <Route path="/hop-shop" element={<HopShop />} />
        <Route
          path="/rescues"
          element={
            <Partners
              base="/rescues"
              title="Find a Rescue"
              subtitle="Rabbit rescues across the country — search by name, state, or region."
            />
          }
        />
        <Route path="/rescues/:id" element={<PartnerDetail base="/rescues" />} />
        <Route path="/appointment" element={<Appointment />} />
        <Route path="/surrender" element={<Surrender />} />
        <Route path="/surrender/form" element={<SurrenderForm />} />
        <Route path="/about" element={<About />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/help" element={<Help />} />
        <Route path="/search" element={<Search />} />
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
        <Route path="map" element={<EventMap />} />
        <Route path="silent-auction" element={<SilentAuction />} />
        <Route path="p/:id" element={<BunfestPage />} />
        <Route path="give" element={<Give />} />
      </Route>

      {/* Staff backend — Supabase auth + capability-gated tools (separate shell) */}
      <Route path="/staff" element={<StaffLayout />}>
        <Route index element={<StaffHome />} />
        <Route path="signin" element={<StaffSignIn />} />
        <Route path="start" element={<StaffOnboard />} />
        <Route element={<RequireMembership />}>
          <Route path="hopshop" element={<HopShopManager />} />
        </Route>
      </Route>
    </Routes>
  )
}
