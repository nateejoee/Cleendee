import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useI18n } from './i18n'

// ชื่อแท็บเบราว์เซอร์ตามหน้า เช่น "จองแม่บ้าน · CleenDee คลีนดี" (หน้าแรกใช้ชื่อเต็มเดิม)
const BRAND = 'CleenDee คลีนดี'
const HOME_TITLE = 'CleenDee คลีนดี – แม่บ้านคลีนดี'
// [ขึ้นต้นด้วย path, ไทย, อังกฤษ] เรียงจากเฉพาะเจาะจงไปกว้าง
const TITLES: [string, string, string][] = [
  ['/book/time', 'เลือกวันและเวลา', 'Pick date & time'], ['/book/details', 'รายละเอียดงาน', 'Job details'], ['/book/confirm', 'ยืนยันการจอง', 'Confirm booking'],
  ['/book', 'จองแม่บ้าน', 'Book a helper'], ['/maid-profile/', 'โปรไฟล์แม่บ้าน', 'Helper profile'], ['/pay/', 'ชำระเงิน', 'Payment'],
  ['/bookings/', 'รายละเอียดการจอง', 'Booking details'], ['/bookings', 'การจองของฉัน', 'My bookings'], ['/receipt/', 'ใบเสร็จ', 'Receipt'], ['/claim/', 'แจ้งเคลม', 'Claim'],
  ['/messages', 'ข้อความ', 'Messages'], ['/support', 'ติดต่อทีมงาน', 'Support'], ['/notifications', 'การแจ้งเตือน', 'Notifications'],
  ['/account/addresses', 'ที่อยู่ของฉัน', 'My addresses'], ['/account/profile', 'แก้ไขโปรไฟล์', 'Edit profile'], ['/account/favorites', 'แม่บ้านคนโปรด', 'Favourite helpers'],
  ['/account/rewards', 'สิทธิ์สมาชิก', 'Membership'], ['/account', 'บัญชีของฉัน', 'My account'],
  ['/service/', 'บริการ', 'Service'], ['/service', 'บริการทั้งหมด', 'Services'], ['/guarantee', 'การรับประกันงาน', 'Guarantee'], ['/privacy', 'นโยบายความเป็นส่วนตัว', 'Privacy policy'],
  ['/terms', 'ข้อกำหนดการใช้บริการ', 'Terms of service'], ['/faq', 'คำถามที่พบบ่อย', 'FAQ'], ['/login', 'เข้าสู่ระบบ', 'Log in'], ['/welcome', 'ยินดีต้อนรับ', 'Welcome'],
  ['/maid/job/', 'รายละเอียดงาน', 'Job details'], ['/maid/availability', 'วันที่รับงานได้', 'Availability'], ['/maid/income', 'รายได้', 'Income'],
  ['/maid/profile', 'โปรไฟล์แม่บ้าน', 'Helper profile'], ['/maid/apply', 'สมัครเป็นแม่บ้าน', 'Become a helper'], ['/maid', 'งานของฉัน', 'My jobs'],
  ['/admin/login', 'เข้าสู่ระบบแอดมิน', 'Admin login'], ['/admin/log', 'ประวัติการทำงาน · แอดมิน', 'Audit log · Admin'], ['/admin/support', 'ข้อความลูกค้า · แอดมิน', 'Support · Admin'],
  ['/admin/money', 'การเงิน · แอดมิน', 'Money · Admin'], ['/admin/maids', 'แม่บ้าน · แอดมิน', 'Helpers · Admin'], ['/admin/settings', 'ตั้งค่า · แอดมิน', 'Settings · Admin'], ['/admin', 'ภาพรวม · แอดมิน', 'Overview · Admin'],
]
const KNOWN = ['/', '/home']

export function usePageTitle() {
  const { pathname } = useLocation(); const { lang } = useI18n()
  useEffect(() => {
    if (KNOWN.includes(pathname)) { document.title = HOME_TITLE; return }
    const hit = TITLES.find(([p]) => p.endsWith('/') ? pathname.startsWith(p) : pathname === p || pathname.startsWith(p + '/'))
    const name = hit ? (lang === 'th' ? hit[1] : hit[2]) : (lang === 'th' ? 'ไม่พบหน้านี้' : 'Page not found')
    document.title = name + ' · ' + BRAND
  }, [pathname, lang])
}
export function PageTitle() { usePageTitle(); return null }
