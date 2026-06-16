import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Schedule from './pages/Schedule'
import Vendors from './pages/Vendors'
import Partners from './pages/Partners'
import Sponsors from './pages/Sponsors'
import Visit from './pages/Visit'
import Give from './pages/Give'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/vendors" element={<Vendors />} />
        <Route path="/partners" element={<Partners />} />
        <Route path="/sponsors" element={<Sponsors />} />
        <Route path="/visit" element={<Visit />} />
        <Route path="/give" element={<Give />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
