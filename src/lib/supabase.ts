import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://ybjwioqjgjjxwqgrcoou.supabase.co'
const KEY = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_m3iY8dh73BoLDGnkCfSS3w_Fxt5av3N'

export const sb = createClient(SUPABASE_URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
})

export type Role = 'customer' | 'maid' | 'admin'
export type Profile = { id: string; role: Role; full_name: string | null; phone: string | null; lang: 'th' | 'en'; district_id: number | null; points: number }
export type District = { id: number; province_code: string; name_th: string; name_en: string; active: boolean }
export type Maid = { id: string; nickname: string; bio: string | null; photo_url: string | null; status: string; district_id: number | null; id_verified: boolean; background_checked: boolean }
export type Rating = { maid_id: string; avg_rating: number | null; review_count: number; jobs_done: number }
export type BookingStatus = 'pending_payment' | 'payment_review' | 'awaiting_maid' | 'confirmed' | 'on_the_way' | 'working' | 'completed' | 'cancelled_by_customer' | 'refunded_no_maid' | 'payment_rejected'
export type Booking = {
  id: number; customer_id: string; maid_id: string | null; chose_maid: boolean; service_type_id: number; package_id: number | null
  district_id: number; start_at: string; end_at: string; note: string | null; tags: string[]
  base_price: number; choose_maid_fee: number; points_used: number; points_discount: number; promo_discount: number
  total_price: number; maid_payout: number; status: BookingStatus; needs_replacement: boolean
  created_at: string; confirmed_at: string | null; completed_at: string | null; cancelled_at: string | null
}
export type Quote = { base: number; choose_maid_fee: number; promo_discount: number; points_used: number; points_discount: number; total: number; maid_payout: number; duration_hours: number; points_available: number }

export function errMsg(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e)
  return m
}

const ERR: Record<string, [string, string]> = {
  maid_busy: ['แม่บ้านไม่ว่างเวลานี้ ลองเลือกเวลาอื่น', 'This helper is busy then. Try another time'],
  start_too_soon: ['ต้องจองล่วงหน้าอย่างน้อย 2 ชั่วโมง', 'Please book at least 2 hours ahead'],
  address_not_found: ['กรุณาเลือกที่อยู่', 'Please choose an address'],
  area_not_served: ['ยังไม่เปิดให้บริการในพื้นที่นี้', 'We do not serve this area yet'],
  maid_not_available: ['แม่บ้านคนนี้ยังรับงานไม่ได้', 'This helper is not available'],
  invalid_state: ['ทำรายการนี้ไม่ได้ในตอนนี้', 'This action is not available now'],
  job_taken: ['มีแม่บ้านคนอื่นรับงานนี้ไปแล้ว', 'Another helper already took this job'],
  claim_too_late: ['เกิน 3 วันหลังวันทำงานแล้ว', 'More than 3 days after the job'],
  photo_required: ['กรุณาแนบรูปถ่ายอย่างน้อย 1 รูป', 'Please attach at least one photo'],
  amount_out_of_range: ['จำนวนเงินต้องไม่เกิน 10,000 บาท', 'Amount must be 1–10,000 THB'],
  forbidden: ['ไม่มีสิทธิ์ทำรายการนี้', 'Not allowed'],
  not_signed_in: ['กรุณาเข้าสู่ระบบ', 'Please log in'],
  'Invalid login credentials': ['อีเมลหรือรหัสผ่านไม่ถูกต้อง', 'Wrong email or password'],
}
export function friendly(e: unknown, lang: 'th' | 'en') {
  const m = errMsg(e)
  for (const k of Object.keys(ERR)) if (m.includes(k)) return ERR[k][lang === 'th' ? 0 : 1]
  if (m.startsWith('maid_busy_on')) return (lang === 'th' ? 'แม่บ้านไม่ว่างวันที่ ' : 'Helper busy on ') + m.split(' ').pop()
  return m
}
