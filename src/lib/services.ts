import { useEffect, useState } from 'react'
import { sb, type Addon, type Service } from './supabase'

// โหลดรายการบริการและงานเสริม (เก็บไว้ในหน่วยความจำ ไม่ต้องโหลดซ้ำทุกหน้า)
let svcCache: Service[] | null = null
let addonCache: Addon[] | null = null
// failed = โหลดไม่สำเร็จ (ไม่ใช่ "ไม่มีบริการ") ให้หน้าจอแสดงปุ่มลองอีกครั้งได้
export function useServicesLoad() {
  const [s, setS] = useState<Service[] | null>(svcCache)
  const [failed, setFailed] = useState(false); const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    sb.from('service_types').select('*').order('sort').then(({ data, error }) => {
      if (error) { setFailed(!svcCache); setS(svcCache ?? []); return }
      svcCache = (data as Service[]) || []; setFailed(false); setS(svcCache)
    })
  }, [attempt])
  return { services: s, failed, retry: () => { setFailed(false); setS(svcCache); setAttempt(n => n + 1) } }
}
export function useServices() { return useServicesLoad().services }
export function useAddons() {
  const [a, setA] = useState<Addon[] | null>(addonCache)
  useEffect(() => { sb.from('service_addons').select('*').order('sort').then(({ data }) => { addonCache = (data as Addon[]) || []; setA(addonCache) }) }, [])
  return a
}
export const svcName = (s: Service | undefined, lang: 'th' | 'en') => (s ? (lang === 'th' ? s.name_th : s.name_en) : '')
export const svcUnit = (s: Service | undefined, lang: 'th' | 'en') => (s ? (lang === 'th' ? s.unit_th : s.unit_en) : '')
// ชั่วโมงทำงาน = ชั่วโมงที่เลือก (หรือเวลาต่อชิ้น x จำนวน) + เวลางานเสริม ปัดขึ้นเป็นชั่วโมง
export function jobHours(s: Service | undefined, qty: number, addons: Addon[]) {
  if (!s) return qty
  const mins = (s.pricing === 'hourly' ? qty * 60 : qty * s.minutes_per_unit) + addons.reduce((a, x) => a + x.minutes, 0)
  return Math.ceil(mins / 60)
}
