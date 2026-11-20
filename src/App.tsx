import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { I18nProvider, localStorageGet } from './lib/i18n'
import { AuthProvider, useAuth } from './lib/auth'
import { Onboarding, Login, Home, Service } from './pages/Start'
import { BookMaid, MaidProfile, BookTime, BookDetails, BookConfirm, Pay } from './pages/Book'
import { Bookings, BookingDetail, Claim, Messages, Account, Addresses, Favorites } from './pages/MyBookings'
import { MaidHome, MaidJob, MaidAvailability, MaidIncome, MaidApply } from './pages/Maid'
import { AdminHome, AdminMoney, AdminMaids, AdminSettings } from './pages/Admin'
import { Loading } from './components/ui'
import { Privacy } from './pages/Privacy'

function Root() {
  const { profile, ready } = useAuth()
  if (!ready) return <Loading />
  if (!localStorageGet('cd_onboarded') && !profile) return <Navigate to="/welcome" replace />
  if (profile?.role === 'admin') return <Navigate to="/admin" replace />
  if (profile?.role === 'maid') return <Navigate to="/maid" replace />
  return <Home />
}

export default function App() {
  return <I18nProvider><AuthProvider><BrowserRouter><div className="app">
    <Routes>
      <Route path="/" element={<Root />} />
      <Route path="/home" element={<Home />} />
      <Route path="/welcome" element={<Onboarding />} />
      <Route path="/login" element={<Login />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/service" element={<Service />} />
      <Route path="/book" element={<BookMaid />} />
      <Route path="/maid-profile/:id" element={<MaidProfile />} />
      <Route path="/book/time" element={<BookTime />} />
      <Route path="/book/details" element={<BookDetails />} />
      <Route path="/book/confirm" element={<BookConfirm />} />
      <Route path="/pay/:kind/:id" element={<Pay />} />
      <Route path="/bookings" element={<Bookings />} />
      <Route path="/bookings/:id" element={<BookingDetail />} />
      <Route path="/claim/:id" element={<Claim />} />
      <Route path="/messages" element={<Messages />} />
      <Route path="/account" element={<Account />} />
      <Route path="/account/addresses" element={<Addresses />} />
      <Route path="/account/favorites" element={<Favorites />} />
      <Route path="/maid" element={<MaidHome />} />
      <Route path="/maid/job/:id" element={<MaidJob />} />
      <Route path="/maid/availability" element={<MaidAvailability />} />
      <Route path="/maid/income" element={<MaidIncome />} />
      <Route path="/maid/apply" element={<MaidApply />} />
      <Route path="/admin" element={<AdminHome />} />
      <Route path="/admin/money" element={<AdminMoney />} />
      <Route path="/admin/maids" element={<AdminMaids />} />
      <Route path="/admin/settings" element={<AdminSettings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </div></BrowserRouter></AuthProvider></I18nProvider>
}
