// Route group for /my-bunny/* — mounted lazily from App.tsx so none of this
// feature lands in the main bundle until someone opens it.
import { Routes, Route, Navigate } from 'react-router-dom'
import BunnyList from './pages/BunnyList'
import BunnyForm from './pages/BunnyForm'
import BunnyProfile from './pages/BunnyProfile'
import ReminderForm from './pages/ReminderForm'

export default function MyBunnyRoutes() {
  return (
    <Routes>
      <Route index element={<BunnyList />} />
      <Route path="new" element={<BunnyForm />} />
      <Route path=":id" element={<BunnyProfile />} />
      <Route path=":id/edit" element={<BunnyForm />} />
      <Route path=":id/reminders/new" element={<ReminderForm />} />
      <Route path=":id/reminders/:rid/edit" element={<ReminderForm />} />
      <Route path="*" element={<Navigate to="/my-bunny" replace />} />
    </Routes>
  )
}
