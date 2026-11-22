import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { I18nProvider, localStorageGet } from './lib/i18n'
import { AuthProvider, useAuth } from './lib/auth'
import { Onboarding, Login, AdminLogin, Home, Service } from './pages/Start'
import { BookingLocation, BookMaid, MaidProfile, BookTime, BookDetails, BookConfirm, Pay } from './pages/Book'
import { Support, AdminSupport } from './pages/Support'
import { AdminAuditLog } from './pages/AuditLog'
import { Notifications } from './pages/Notifications'
import { Bookings, BookingDetail, Receipt, Claim, Messages, Account, Addresses, Favorites } from './pages/MyBookings'
import { RewardsDetail } from './pages/RewardsDetail'
import { MaidHome, MaidJob, MaidAvailability, MaidIncome, MaidApply } from './pages/Maid'
import { EditProfile, MaidEditProfile } from './pages/Profile'
import { AdminHome, AdminMoney, AdminMaids, AdminSettings, AdminPublicPages } from './pages/Admin'
import { Loading, LoginWall } from './components/ui'
import { Faq, Guarantee, Privacy, Terms } from './pages/PublicPages'
import { NotFound } from './pages/NotFound'
import { PageTitle } from './lib/pageTitle'
import { ThemeProvider } from './lib/theme'
import { Motion, TopProgress, BackToTop, OfflineBar } from './lib/fx'
import { useI18n, type Key } from './lib/i18n'
import imgLogin from './assets/ill/login.webp'
import imgChat from './assets/ill/chat.webp'
import imgSched from './assets/ill/schedule.webp'
import { useEffect, useState, type ReactNode } from 'react'
import { RatePrompt } from './components/Rating'
import { DeskNav, DeskFooter, DeskLineFab } from './components/DeskNav'

// หน้าที่ต้องเข้าสู่ระบบก่อน (คนที่ยังไม่สมัครดูได้แค่หน้าแรก บริการ และโปรไฟล์แม่บ้าน — แบบแอป bTaskee)
// tab = หน้าที่อยู่ในเมนูหลัก (แสดงแถบเมนูด้วย) · ที่เหลือเป็นหน้าย่อย แสดงปุ่มย้อนกลับ
function Member({ children, title, text, img = imgLogin, tab = false }: { children: ReactNode; title: Key; text: Key; img?: string; tab?: boolean }) {
  const { session, ready } = useAuth(); const { t } = useI18n()
  if (!ready) return <Loading />
  if (!session) return <LoginWall title={t(title)} text={t(text)} img={img} tabs={tab} />
  return <>{children}</>
}

// หน้าแอดมิน: ถ้ายังไม่เข้าสู่ระบบ ไปที่หน้าเข้าสู่ระบบของแอดมิน
function AdminOnly({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth()
  if (!ready) return <Loading />
  if (!session) return <Navigate to="/admin/login" replace />
  return <>{children}</>
}

function Root() {
  const { profile, ready } = useAuth()
  const [next] = useState(() => {
    try { const path = sessionStorage.getItem('cd_next'); return path?.startsWith('/') && !path.startsWith('//') && !path.includes('\\') ? path : null } catch { return null }
  })
  useEffect(() => { if (profile && next) { try { sessionStorage.removeItem('cd_next') } catch { /* storage unavailable */ } } }, [profile, next])
  if (!ready) return <Loading />
  if (profile && next && next !== '/') return <Navigate to={next} replace />
  if (!localStorageGet('cd_onboarded') && !profile) return <Navigate to="/welcome" replace />
  if (profile?.role === 'admin') return <Navigate to="/admin" replace />
  if (profile?.role === 'maid') return <Navigate to="/maid" replace />
  return <Home />
}

export default function App() {
  return <I18nProvider><ThemeProvider><AuthProvider><BrowserRouter><div className="app">
    <PageTitle /><Motion /><TopProgress /><OfflineBar /><BackToTop /><RatePrompt />
    <DeskNav />
    <Routes>
      <Route path="/" element={<Root />} />
      <Route path="/home" element={<Home />} />
      <Route path="/welcome" element={<Onboarding />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/service" element={<Service />} />
      <Route path="/service/:code" element={<Service />} />
      <Route path="/guarantee" element={<Guarantee />} />
      <Route path="/faq" element={<Faq />} />
      <Route path="/terms" element={<Terms />} />
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
      <Route path="/support" element={<Support />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/account" element={<Account />} />
      <Route path="/account/addresses" element={<Member title="my_addresses" text="lw_page"><Addresses /></Member>} />
      <Route path="/account/profile" element={<Member title="edit_profile" text="lw_page"><EditProfile /></Member>} />
      <Route path="/account/favorites" element={<Member title="favorites" text="lw_page"><Favorites /></Member>} />
      <Route path="/account/rewards" element={<Member title="my_points" text="lw_page"><RewardsDetail /></Member>} />
      <Route path="/maid" element={<Member title="tab_jobs" text="lw_page"><MaidHome /></Member>} />
      <Route path="/maid/job/:id" element={<Member title="tab_jobs" text="lw_page"><MaidJob /></Member>} />
      <Route path="/maid/availability" element={<Member title="tab_avail" text="lw_page"><MaidAvailability /></Member>} />
      <Route path="/maid/income" element={<Member title="tab_income" text="lw_page"><MaidIncome /></Member>} />
      <Route path="/maid/profile" element={<Member title="mp_title" text="lw_page"><MaidEditProfile /></Member>} />
      <Route path="/maid/apply" element={<Member title="become_maid" text="lw_page"><MaidApply /></Member>} />
      <Route path="/admin" element={<AdminOnly><AdminHome /></AdminOnly>} />
      <Route path="/admin/log" element={<AdminOnly><AdminAuditLog /></AdminOnly>} />
      <Route path="/admin/support" element={<AdminOnly><AdminSupport /></AdminOnly>} />
      <Route path="/admin/money" element={<AdminOnly><AdminMoney /></AdminOnly>} />
      <Route path="/admin/maids" element={<AdminOnly><AdminMaids /></AdminOnly>} />
      <Route path="/admin/settings" element={<AdminOnly><AdminSettings /></AdminOnly>} />
      <Route path="/admin/settings/pages" element={<AdminOnly><AdminPublicPages /></AdminOnly>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    <DeskFooter />
    <DeskLineFab />
  </div></BrowserRouter></AuthProvider></ThemeProvider></I18nProvider>
}
