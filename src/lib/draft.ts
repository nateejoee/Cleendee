// การจองที่กำลังกรอก (เก็บใน sessionStorage ให้กดย้อนกลับได้)
export type Draft = {
  service: string // รหัสบริการ เช่น general_cleaning
  qty: number | null // จำนวนชั่วโมง หรือจำนวนเครื่อง/ชิ้น
  addons: string[] // งานเสริม
  promo: string // โค้ดส่วนลด
  maidId: string | null
  date: string | null // YYYY-MM-DD
  hour: number | null
  plan: 'once' | 'biweekly' | 'weekly'
  addressId: number | null
  tags: string[]
  note: string
  usePoints: boolean
}
const KEY = 'cd_draft'
export const emptyDraft: Draft = { service: 'general_cleaning', qty: null, addons: [], promo: '', maidId: null, date: null, hour: null, plan: 'once', addressId: null, tags: [], note: '', usePoints: false }
export function getDraft(): Draft {
  try { return { ...emptyDraft, ...JSON.parse(sessionStorage.getItem(KEY) || '{}') } } catch { return { ...emptyDraft } }
}
export function setDraft(p: Partial<Draft>) {
  const d = { ...getDraft(), ...p }
  try { sessionStorage.setItem(KEY, JSON.stringify(d)) } catch { /* ignore */ }
  return d
}
export function clearDraft() { try { sessionStorage.removeItem(KEY) } catch { /* ignore */ } }
export function startIso(date: string, hour: number) { return `${date}T${String(hour).padStart(2, '0')}:00:00+07:00` }
export function bkkToday(offsetDays = 0) {
  const d = new Date(Date.now() + 7 * 3600e3 + offsetDays * 86400e3)
  return d.toISOString().slice(0, 10)
}
