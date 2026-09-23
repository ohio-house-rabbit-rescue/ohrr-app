import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import OhrrLayout from './components/OhrrLayout'
import BunfestLayout from './components/BunfestLayout'
// OHRR host app
import OhrrHome from './pages/OhrrHome'
import Adopt from './pages/Adopt'
import AdoptHowItWorks from './pages/AdoptHowItWorks'
import AdoptRabbit from './pages/AdoptRabbit'
import Events from './pages/Events'
import Vets from './pages/Vets'
import FoundRabbit from './pages/FoundRabbit'
import FoundReport from './pages/FoundReport'
import PageTitle from './components/PageTitle'
import Tails from './pages/Tails'
import TailDetail from './pages/TailDetail'
import ShareTail from './pages/ShareTail'
import Services from './pages/Services'
import AdoptionApplication from './pages/AdoptionApplication'
import MailingList from './pages/MailingList'
import BecomeSupporter from './pages/BecomeSupporter'
import FosterForm from './pages/FosterForm'
// Bookings — shifts & appointments (replaces SignUp.com links and the old appointment form)
import BookPage from './features/bookings/pages/BookPage'
import BookingCancel from './features/bookings/pages/BookingCancel'
import StaffBookings from './features/bookings/pages/StaffBookings'
import ServiceLetter from './features/bookings/pages/ServiceLetter'
import ImpactPage from './features/impact/pages/ImpactPage'
import StaffImpact from './features/impact/pages/StaffImpact'
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
import Speakers from './pages/Speakers'
import BunfestPage from './pages/BunfestPage'
import RaffleCatalog from './features/raffle/RaffleCatalog'
import RaffleItemDetail from './features/raffle/RaffleItemDetail'
// Staff backend (Supabase-gated)
import StaffLayout from './components/StaffLayout'
import { RequireMembership } from './components/staffui'
import StaffSignIn from './pages/StaffSignIn'
import StaffResetPassword from './pages/StaffResetPassword'
import StaffOnboard from './pages/StaffOnboard'
import StaffJoin from './pages/StaffJoin'
import StaffHome from './pages/StaffHome'
import HopShopManager from './pages/HopShopManager'
import StaffTeam from './pages/StaffTeam'
import StaffActivity from './pages/StaffActivity'
import StaffAnnouncements from './pages/StaffAnnouncements'
import StaffHomeScreen from './pages/StaffHomeScreen'
import StaffVolunteer from './pages/StaffVolunteer'
import StaffLearn from './pages/StaffLearn'
import StaffAdopt from './pages/StaffAdopt'
import StaffEvents from './pages/StaffEvents'
import StaffVets from './pages/StaffVets'
import StaffRaffle from './pages/StaffRaffle'
// Sponsors — Phase 1 (public partners/perks + staff manager)
import PartnersPage from './features/sponsors/PartnersPage'
import PartnerPerksPage from './features/sponsors/PartnerPerksPage'
import StaffSponsors from './pages/StaffSponsors'
import StaffFeatures from './pages/StaffFeatures'
import StaffOrgDetails from './pages/StaffOrgDetails'
import StaffBunnyHelp from './pages/StaffBunnyHelp'
import StaffInbox from './pages/StaffInbox'
// My Bunny (local-first care companion) — lazy so it stays out of the main bundle
const MyBunnyRoutes = lazy(() => import('./features/mybunny/routes'))
// Scan an item (camera + tag printer) — lazy: the barcode reader is big
const ScanFlow = lazy(() => import('./features/scan/pages/ScanFlow'))
const CounterHome = lazy(() => import('./features/counter/pages/CounterHome'))
const CounterSell = lazy(() => import('./features/counter/pages/CounterSell'))
const CounterAdd = lazy(() => import('./features/counter/pages/CounterAdd'))
const CounterToday = lazy(() => import('./features/counter/pages/CounterToday'))
const CounterDoor = lazy(() => import('./features/counter/pages/Door'))
const CounterDoorSetup = lazy(() => import('./features/counter/pages/DoorSetup'))
const CounterGate = lazy(() => import('./features/counter/CounterShell').then((m) => ({ default: m.CounterGate })))
const ItemsList = lazy(() => import('./features/scan/pages/ItemsList'))
const PrintTags = lazy(() => import('./features/scan/pages/PrintTags'))
const TagLanding = lazy(() => import('./features/scan/pages/TagLanding'))
// Share kit — canvas + QR, lazy
const StaffShare = lazy(() => import('./features/share/pages/StaffShare'))
const PostQueue = lazy(() => import('./features/share/pages/PostQueue'))
const Flyers = lazy(() => import('./features/share/pages/Flyers'))
const BreedGuide = lazy(() => import('./features/breeds/pages/BreedGuide'))
const RaffleDesk = lazy(() => import('./features/raffle/tickets/pages/RaffleDesk'))
const TicketPage = lazy(() => import('./features/raffle/tickets/pages/TicketPage'))
const BreedDetail = lazy(() => import('./features/breeds/pages/BreedDetail'))
const Outreach = lazy(() => import('./features/share/pages/Outreach'))
const StaffBunfest = lazy(() => import('./features/bunfest/pages/StaffBunfest'))
const StaffTails = lazy(() => import('./features/tails/pages/StaffTails'))
const MyHours = lazy(() => import('./features/volunteers/pages/MyHours'))
const StaffVolunteers = lazy(() => import('./features/volunteers/pages/StaffVolunteers'))
const CallPage = lazy(() => import('./features/volunteers/pages/CallPage'))
const StaffCalls = lazy(() => import('./features/volunteers/pages/StaffCalls'))
const StaffCallRoute = lazy(() => import('./features/volunteers/pages/StaffCalls').then((m) => ({ default: m.StaffCallRoute })))
const PostEditor = lazy(() => import('./features/share/pages/PostEditor'))

export default function App() {
  return (
    <>
      {/* The browser tab / shared-link title for the current screen */}
      <PageTitle />
      <Routes>
      {/* OHRR host app */}
      <Route element={<OhrrLayout />}>
        <Route path="/" element={<OhrrHome />} />
        <Route path="/adopt" element={<Adopt />} />
        <Route path="/adopt/how-it-works" element={<AdoptHowItWorks />} />
        <Route path="/adopt/apply" element={<AdoptionApplication />} />
        <Route path="/mailing-list" element={<MailingList />} />
        <Route path="/impact" element={<ImpactPage />} />
        <Route path="/raffle/tickets/:token" element={<Suspense fallback={null}><TicketPage /></Suspense>} />
        <Route path="/support/become-a-supporter" element={<BecomeSupporter />} />
        <Route path="/adopt/:id" element={<AdoptRabbit />} />
        <Route path="/events" element={<Events />} />
        <Route path="/vets" element={<Vets />} />
        <Route path="/found" element={<FoundRabbit />} />
        <Route path="/found/report" element={<FoundReport />} />
        {/* The shared hero/featured slides (website + app) link to /give */}
        <Route path="/give" element={<Navigate to="/support" replace />} />
        <Route path="/tails" element={<Tails />} />
        <Route path="/tails/share" element={<ShareTail />} />
        <Route path="/tails/:id" element={<TailDetail />} />
        <Route path="/services" element={<Services />} />
        <Route path="/services/signup" element={<Navigate to="/services" replace />} />
        <Route path="/book/cancel/:token" element={<BookingCancel />} />
        <Route path="/book/:slug" element={<BookPage />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/learn/breeds" element={<Suspense fallback={null}><BreedGuide /></Suspense>} />
        <Route path="/learn/breeds/:slug" element={<Suspense fallback={null}><BreedDetail /></Suspense>} />
        <Route path="/learn/:id" element={<LearnTopic />} />
        {/* Give / About / Adopt pages brought in from the old site (same table, other sections) */}
        <Route path="/info/:id" element={<LearnTopic />} />
        <Route path="/volunteer" element={<Volunteer />} />
        <Route path="/volunteer/signup" element={<VolunteerSignup />} />
        <Route path="/volunteer/foster" element={<FosterForm />} />
        <Route path="/volunteer/hours" element={<Suspense fallback={null}><MyHours /></Suspense>} />
        <Route path="/volunteer/hours/:token" element={<Suspense fallback={null}><MyHours /></Suspense>} />
        <Route path="/volunteer/call/:slug" element={<Suspense fallback={null}><CallPage /></Suspense>} />
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
        <Route path="/appointment" element={<Navigate to="/book/adoption-visit" replace />} />
        <Route path="/surrender" element={<Surrender />} />
        <Route path="/surrender/form" element={<SurrenderForm />} />
        <Route path="/about" element={<About />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/help" element={<Help />} />
        <Route path="/search" element={<Search />} />
        {/* Sponsors — Phase 1 */}
        <Route path="/partners" element={<PartnersPage />} />
        <Route path="/partners/perks" element={<PartnerPerksPage />} />
        <Route
          path="/my-bunny/*"
          element={
            <Suspense fallback={null}>
              <MyBunnyRoutes />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Midwest BunFest sub-app (distinct look & feel) */}
      <Route path="/bunfest" element={<BunfestLayout />}>
        <Route index element={<BunfestHome />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="speakers" element={<Speakers />} />
        <Route path="vendors" element={<Vendors />} />
        <Route path="vendors/:id" element={<VendorDetail />} />
        <Route path="partners" element={<Partners />} />
        <Route path="partners/:id" element={<PartnerDetail />} />
        <Route path="sponsors" element={<Sponsors />} />
        <Route path="visit" element={<Visit />} />
        <Route path="map" element={<EventMap />} />
        <Route path="silent-auction" element={<Navigate to="/bunfest/auction" replace />} />
        <Route path="auction" element={<RaffleCatalog />} />
        <Route path="auction/:id" element={<RaffleItemDetail />} />
        <Route path="p/:id" element={<BunfestPage />} />
        <Route path="give" element={<Give />} />
      </Route>

      {/* Staff backend — Supabase auth + capability-gated tools (separate shell) */}
      <Route path="/staff" element={<StaffLayout />}>
        <Route index element={<StaffHome />} />
        <Route path="signin" element={<StaffSignIn />} />
        <Route path="reset" element={<StaffResetPassword />} />
        <Route path="start" element={<StaffOnboard />} />
        <Route path="join" element={<StaffJoin />} />
        {/* The Counter keeps working with no signal, so it has its own gate (CounterShell.tsx). */}
        <Route element={<Suspense fallback={null}><CounterGate /></Suspense>}>
          <Route path="counter" element={<Suspense fallback={null}><CounterHome /></Suspense>} />
          <Route path="counter/sell" element={<Suspense fallback={null}><CounterSell /></Suspense>} />
          <Route path="counter/add" element={<Suspense fallback={null}><CounterAdd /></Suspense>} />
          <Route path="counter/today" element={<Suspense fallback={null}><CounterToday /></Suspense>} />
          <Route path="counter/door" element={<Suspense fallback={null}><CounterDoor /></Suspense>} />
          <Route path="counter/door/setup" element={<Suspense fallback={null}><CounterDoorSetup /></Suspense>} />
        </Route>
        <Route element={<RequireMembership />}>
          <Route path="hopshop" element={<HopShopManager />} />
          <Route path="hopshop/reorder" element={<HopShopManager />} />
          <Route path="hopshop/suppliers" element={<HopShopManager />} />
          <Route path="adopt" element={<StaffAdopt />} />
          <Route path="announcements" element={<StaffAnnouncements />} />
          <Route path="home-screen" element={<StaffHomeScreen />} />
          <Route path="volunteer" element={<StaffVolunteer />} />
          <Route path="learn" element={<StaffLearn />} />
          <Route path="vets" element={<StaffVets />} />
          <Route path="events" element={<StaffEvents />} />
          <Route path="bunfest" element={<Suspense fallback={null}><StaffBunfest /></Suspense>} />
          <Route path="tails" element={<Suspense fallback={null}><StaffTails /></Suspense>} />
          <Route path="volunteers" element={<Suspense fallback={null}><StaffVolunteers /></Suspense>} />
          <Route path="calls" element={<Suspense fallback={null}><StaffCalls /></Suspense>} />
          <Route path="calls/:id" element={<Suspense fallback={null}><StaffCallRoute /></Suspense>} />
          <Route path="bunfest/schedule" element={<Suspense fallback={null}><StaffBunfest /></Suspense>} />
          <Route path="bunfest/pages" element={<Suspense fallback={null}><StaffBunfest /></Suspense>} />
          <Route path="bunfest/floor" element={<Suspense fallback={null}><StaffBunfest /></Suspense>} />
          <Route path="bunfest/vendors" element={<Suspense fallback={null}><StaffBunfest /></Suspense>} />
          <Route path="bunfest/partners" element={<Suspense fallback={null}><StaffBunfest /></Suspense>} />
          <Route path="raffle" element={<StaffRaffle />} />
          <Route path="raffle-tickets" element={<Suspense fallback={null}><RaffleDesk /></Suspense>} />
          <Route path="sponsors" element={<StaffSponsors />} />
          <Route path="bunny-help" element={<StaffBunnyHelp />} />
          <Route path="team" element={<StaffTeam />} />
          <Route path="activity" element={<StaffActivity />} />
          <Route path="features" element={<StaffFeatures />} />
          <Route path="details" element={<StaffOrgDetails />} />
          {/* The old combined screen — anyone with it bookmarked lands on Features. */}
          <Route path="settings" element={<Navigate to="/staff/features" replace />} />
          <Route path="inbox" element={<StaffInbox />} />
          <Route path="bookings" element={<StaffBookings />} />
          <Route path="hours-letter" element={<ServiceLetter />} />
          <Route path="impact" element={<StaffImpact />} />
          <Route path="scan" element={<Suspense fallback={null}><ScanFlow /></Suspense>} />
          <Route path="share" element={<Suspense fallback={null}><StaffShare /></Suspense>} />
          <Route path="posts" element={<Suspense fallback={null}><PostQueue /></Suspense>} />
          <Route path="flyers" element={<Suspense fallback={null}><Flyers /></Suspense>} />
          <Route path="outreach" element={<Suspense fallback={null}><Outreach /></Suspense>} />
          <Route path="posts/:id" element={<Suspense fallback={null}><PostEditor /></Suspense>} />
          <Route path="items" element={<Suspense fallback={null}><ItemsList /></Suspense>} />
          <Route path="items/tags" element={<Suspense fallback={null}><PrintTags /></Suspense>} />
        </Route>
      </Route>

      {/* A printed OHRR tag's QR opens here → the scan flow (sign-in first if needed) */}
      <Route path="/t/:code" element={<Suspense fallback={null}><TagLanding /></Suspense>} />
      </Routes>
    </>
  )
}
