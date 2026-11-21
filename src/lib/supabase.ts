import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://ybjwioqjgjjxwqgrcoou.supabase.co'
const KEY = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_m3iY8dh73BoLDGnkCfSS3w_Fxt5av3N'

export const sb = createClient(SUPABASE_URL, KEY, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true },
})

export type Role = 'customer' | 'maid' | 'admin'
export type Profile = { id: string; role: Role; full_name: string | null; phone: string | null; lang: 'th' | 'en'; district_id: number | null; points: number }
export type District = { id: number; province_code: string; name_th: string; name_en: string; active: boolean }
export type Maid = { id: string; nickname: string; bio: string | null; photo_url: string | null; status: string; district_id: number | null; id_verified: boolean; background_checked: boolean; services?: string[] }
export type Rating = { maid_id: string; avg_rating: number | null; review_count: number; jobs_done: number }
export type BookingStatus = 'pending_payment' | 'payment_review' | 'awaiting_maid' | 'confirmed' | 'on_the_way' | 'working' | 'completed' | 'cancelled_by_customer' | 'refunded_no_maid' | 'payment_rejected'
export type Booking = {
  id: number; customer_id: string; maid_id: string | null; chose_maid: boolean; service_type_id: number; package_id: number | null
  district_id: number; start_at: string; end_at: string; note: string | null; tags: string[]
  base_price: number; choose_maid_fee: number; points_used: number; points_discount: number; promo_discount: number
  total_price: number; maid_payout: number; status: BookingStatus; needs_replacement: boolean
  qty: number | null; addons: string[]; addons_price: number; urgent_fee: number; promo_code: string | null
  checklist: { t: string; done: boolean }[]; rescheduled_at: string | null
  offer_maid_id?: string | null; offer_expires_at?: string | null // งานที่ระบบกำลังเสนอให้แม่บ้านคนหนึ่ง
  team_id?: number | null // งาน 2 คน: แถวแรก team_id = id ตัวเอง, แถวคนที่ 2 team_id = id แถวแรก
  created_at: string; confirmed_at: string | null; completed_at: string | null; cancelled_at: string | null
}
// บริการ (ราคาแก้ได้ในหน้าแอดมิน)
export type Service = {
  id: number; code: string; name_th: string; name_en: string; active: boolean; coming_soon: boolean
  pricing: 'hourly' | 'unit'; price_per_unit: number; payout_pct: number; min_qty: number; max_qty: number; default_qty: number; minutes_per_unit: number
  unit_th: string; unit_en: string; icon: string; sort: number; desc_th: string | null; desc_en: string | null
  included_th: string[]; included_en: string[]; excluded_th: string[]; excluded_en: string[]
  allow_team?: boolean // จองแม่บ้าน 2 คนในงานเดียวได้
}
export type Addon = { code: string; name_th: string; name_en: string; price: number; maid_payout: number; minutes: number; service_codes: string[]; active: boolean; sort: number }
// ราคาที่คำนวณจากเซิร์ฟเวอร์ (quote_booking_v2)
export type Quote2 = {
  qty: number; hours: number; base: number; addons_price: number; choose_maid_fee: number; urgent_fee: number
  promo_discount: number; promo_code: string | null; promo_error: string | null; first_discount: boolean
  points_used: number; points_discount: number; total: number; maid_payout: number; points_available: number
  people?: number; base_each?: number
}
export type Quote = { base: number; choose_maid_fee: number; promo_discount: number; points_used: number; points_discount: number; total: number; maid_payout: number; duration_hours: number; points_available: number }

export function errMsg(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e)
  return m
}

const ERR: Record<string, [string, string]> = {
  too_many_messages: ['ส่งข้อความมากเกินไปในวันนี้ กรุณาลองใหม่พรุ่งนี้', 'Too many messages today. Please try again tomorrow'],
  invalid_message: ['ข้อความว่างหรือยาวเกินไป', 'The message is empty or too long'],
  maid_busy: ['แม่บ้านไม่ว่างเวลานี้ ลองเลือกเวลาอื่น', 'This helper is busy then. Try another time'],
  start_too_soon: ['ต้องจองล่วงหน้าอย่างน้อย 2 ชั่วโมง', 'Please book at least 2 hours ahead'],
  address_not_found: ['กรุณาเลือกที่อยู่', 'Please choose an address'],
  area_not_served: ['ยังไม่เปิดให้บริการในพื้นที่นี้', 'We do not serve this area yet'],
  maid_not_available: ['แม่บ้านคนนี้ยังรับงานไม่ได้', 'This helper is not available'],
  invalid_state: ['ทำรายการนี้ไม่ได้ในตอนนี้', 'This action is not available now'],
  full_name_required: ['กรุณากรอกชื่อ-นามสกุลจริง', 'Please enter your full name'],
  phone_invalid: ['เบอร์โทรไม่ถูกต้อง', 'Invalid phone number'],
  admin_cannot_delete: ['บัญชีแอดมินลบเองไม่ได้', 'Admin accounts cannot be deleted here'],
  account_has_active_jobs: ['ยังมีงานที่ยังไม่เสร็จ กรุณายกเลิกหรือรอให้งานเสร็จก่อน', 'You still have unfinished jobs. Cancel them or wait until they are done'],
  account_has_pending_money: ['ยังมีเงินคืน ค่าจ้าง หรือเคลมที่รอดำเนินการ กรุณารอให้เสร็จก่อน', 'You still have a pending refund, payout or claim. Please wait until it is done'],
  quiz_failed: ['ตอบแบบทดสอบถูกไม่ถึง 4 ข้อ ลองทบทวนแล้วตอบใหม่', 'Fewer than 4 quiz answers were correct. Please review and try again'],
  quiz_required: ['กรุณาตอบแบบทดสอบให้ครบทุกข้อ', 'Please answer every quiz question'],
  job_offered_to_other: ['งานนี้กำลังเสนอให้แม่บ้านคนอื่นอยู่ ลองใหม่ภายหลัง', 'This job is being offered to another helper. Try again later'],
  team_not_available: ['บริการนี้ยังจองแม่บ้าน 2 คนไม่ได้', 'This service cannot be booked with 2 helpers'],
  same_helper_twice: ['เลือกแม่บ้านคนเดียวกันซ้ำไม่ได้', 'Please pick two different helpers'],
  phone_required: ['กรุณาใส่เบอร์โทรก่อนจอง', 'Please add your phone number before booking'],
  age_invalid: ['ผู้สมัครต้องมีอายุ 18 ปีขึ้นไป', 'Applicants must be 18 or older'],
  consent_required: ['กรุณายอมรับเงื่อนไขและการตรวจประวัติ', 'Please accept the terms and background check'],
  documents_required: ['กรุณาแนบรูปบัตรและรูปเซลฟี่', 'Please attach your ID photo and selfie'],
  job_taken: ['มีแม่บ้านคนอื่นรับงานนี้ไปแล้ว', 'Another helper already took this job'],
  claim_too_late: ['เกิน 3 วันหลังวันทำงานแล้ว', 'More than 3 days after the job'],
  photo_required: ['กรุณาแนบรูปถ่ายอย่างน้อย 1 รูป', 'Please attach at least one photo'],
  amount_out_of_range: ['จำนวนเงินต้องไม่เกิน 10,000 บาท', 'Amount must be 1–10,000 THB'],
  forbidden: ['ไม่มีสิทธิ์ทำรายการนี้', 'Not allowed'],
  not_signed_in: ['กรุณาเข้าสู่ระบบ', 'Please log in'],
  qty_out_of_range: ['จำนวนไม่อยู่ในช่วงที่จองได้', 'Quantity out of range'],
  service_unavailable: ['บริการนี้ยังไม่เปิด', 'This service is not open yet'],
  reschedule_too_late: ['เลื่อนนัดได้เฉพาะก่อนเวลานัดตามที่กำหนด', 'Too late to reschedule this booking'],
  promo_invalid: ['ไม่พบโค้ดส่วนลดนี้', 'Promo code not found'],
  promo_expired: ['โค้ดส่วนลดหมดอายุหรือยังไม่เริ่ม', 'Promo code is not valid now'],
  promo_used_up: ['โค้ดส่วนลดถูกใช้ครบแล้ว', 'Promo code fully used'],
  promo_already_used: ['คุณใช้โค้ดนี้ไปแล้ว', 'You already used this code'],
  promo_min_total: ['ยอดยังไม่ถึงขั้นต่ำของโค้ดนี้', 'Order total is below this code’s minimum'],
  too_many_photos: ['แนบรูปได้สูงสุด 20 รูป', 'Up to 20 photos'],
  invalid_input: ['ข้อมูลไม่ถูกต้อง', 'Invalid input'],
  'Invalid login credentials': ['อีเมลหรือรหัสผ่านไม่ถูกต้อง', 'Wrong email or password'],
}
export function friendly(e: unknown, lang: 'th' | 'en') {
  const m = errMsg(e)
  for (const k of Object.keys(ERR)) if (m.includes(k)) return ERR[k][lang === 'th' ? 0 : 1]
  if (m.startsWith('maid_busy_on')) return (lang === 'th' ? 'แม่บ้านไม่ว่างวันที่ ' : 'Helper busy on ') + m.split(' ').pop()
  return m
}
