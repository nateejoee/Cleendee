import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { I18nProvider, localStorageGet } from './lib/i18n'
import { AuthProvider, useAuth } from './lib/auth'
import { Onboarding, Login, Home, Service, Guarantee } from './pages/Start'
import { BookingLocation, BookMaid, MaidProfile, BookTime, BookDetails, BookConfirm, Pay } from './pages/Book'
import { Bookings, BookingDetail, Receipt, Claim, Messages, Account, Addresses, Favorites } from './pages/MyBookings'
import { MaidHome, MaidJob, MaidAvailability, MaidIncome, MaidApply } from './pages/Maid'
import { AdminHome, AdminMoney, AdminMaids, AdminSettings } from './pages/Admin'
import { Loading, LoginWall } from './components/ui'
import { Privacy } from './pages/Privacy'
import { ThemeProvider } from './lib/theme'
import { Motion, TopProgress, BackToTop, OfflineBar } from './lib/fx'
import { useI18n, type Key } from './lib/i18n'
import imgLogin from './assets/ill/login.webp'
import imgChat from './assets/ill/chat.webp'
import imgSched from './assets/ill/schedule.webp'
import type { ReactNode } from 'react'

// หน้าที่ต้องเข้าสู่ระบบก่อน (คนที่ยังไม่สมัครดูได้แค่หน้าแรก บริการ และโปรไฟล์แม่บ้าน — แบบแอป bTaskee)
// tab = หน้าที่อยู่ในเมนูหลัก (แสดงแถบเมนูด้วย) · ที่เหลือเป็นหน้าย่อย แสดงปุ่มย้อนกลับ
function Member({ children, title, text, img = imgLogin, tab = false }: { children: ReactNode; title: Key; text: Key; img?: string; tab?: boolean }) {
  const { session, ready } = useAuth(); const { t } = useI18n()
  if (!ready) return <Loading />
  if (!session) return <LoginWall title={t(title)} text={t(text)} img={img} tabs={tab} />
  return <>{children}</>
}

function Root() {
  const { profile, ready } = useAuth()
  if (!ready) return <Loading />
  // กลับไปหน้าที่ตั้งใจจะเข้าก่อนถูกขอให้เข้าสู่ระบบ
  if (profile) { let next: string | null = null; try { next = sessionStorage.getItem('cd_next'); sessionStorage.removeItem('cd_next') } catch { /* ignore */ }
    if (next && next !== '/') return <Navigate to={next} replace /> }
  if (!localStorageGet('cd_onboarded') && !profile) return <Navigate to="/welcome" replace />
  if (profile?.role === 'admin') return <Navigate to="/admin" replace />
  if (profile?.role === 'maid') return <Navigate to="/maid" replace />
  return <Home />
}

export default function App() {
  return <I18nProvider><ThemeProvider><AuthProvider><BrowserRouter><div className="app">
    <Motion /><TopProgress /><OfflineBar /><BackToTop />
    <Routes>
      <Route path="/" element={<Root />} />
      <Route path="/home" element={<Home />} />
      <Route path="/welcome" element={<Onboarding />} />
      <Route path="/login" element={<Login />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/service" element={<Service />} />
      <Route path="/service/:code" element={<Service />} />
      <Route path="/guarantee" element={<Guarantee />} />
      <Route path="/receipt/:id" element={<Member title="receipt" text="lw_page"><Receipt /></Member>} />
            <Route path="/book" element={<Member tab title="tab_book" text="lw_book"><BookingLocation><BookMaid /></BookingLocation></Member>} />
      <Route path="/maid-profile/:id" element={<MaidProfile />} />
      <Route path="/book/time" element={<Member title="pick_date" text="lw_book"><BookingLocation><BookTime /></BookingLocation></Member>} />
      <Route path="/book/details" element={<Member title="tell_maid" text="lw_book"><BookingLocation><BookDetails /></BookingLocation></Member>} />
      <Route path="/book/confirm" element={<Member title="confirm_booking" text="lw_book"><BookingLocation><BookConfirm /></BookingLocation></Member>} />
      <Route path="/pay/:kind/:id" element={<Member title="pay_title" text="lw_page"><Pay /></Member>} />
      <Route path="/bookings" element={<Member tab title="my_bookings" text="lw_bookings" img={imgSched}><Bookings /></Member>} />
      <Route path="/bookings/:id" element={<Member title="details" text="lw_page"><BookingDetail /></Member>} />
      <Route path="/claim/:id" element={<Member title="claim" text="lw_page"><Claim /></Member>} />
      <Route path="/messages" element={<Member tab title="tab_msgs" text="lw_msgs" img={imgChat}><Messages /></Member>} />
      <Route path="/account" element={<Account />} />
      <Route path="/account/addresses" element={<Member title="my_addresses" text="lw_page"><Addresses /></Member>} />
      <Route path="/account/favorites" element={<Member title="favorites" text="lw_page"><Favorites /></Member>} />
      <Route path="/maid" element={<Member title="tab_jobs" text="lw_page"><MaidHome /></Member>} />
      <Route path="/maid/job/:id" element={<Member title="tab_jobs" text="lw_page"><MaidJob /></Member>} />
      <Route path="/maid/availability" element={<Member title="tab_avail" text="lw_page"><MaidAvailability /></Member>} />
      <Route path="/maid/income" element={<Member title="tab_income" text="lw_page"><MaidIncome /></Member>} />
      <Route path="/maid/apply" element={<Member title="become_maid" text="lw_page"><MaidApply /></Member>} />
      <Route path="/admin" element={<Member title="a_title" text="lw_page"><AdminHome /></Member>} />
      <Route path="/admin/money" element={<Member title="tab_money" text="lw_page"><AdminMoney /></Member>} />
      <Route path="/admin/maids" element={<Member title="tab_maids" text="lw_page"><AdminMaids /></Member>} />
      <Route path="/admin/settings" element={<Member title="tab_settings" text="lw_page"><AdminSettings /></Member>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </div></BrowserRouter></AuthProvider></ThemeProvider></I18nProvider>
}
