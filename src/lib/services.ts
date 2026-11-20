import { useEffect, useState } from 'react'
import { sb, type Addon, type Service } from './supabase'

// โหลดรายการบริการและงานเสริม (เก็บไว้ในหน่วยความจำ ไม่ต้องโหลดซ้ำทุกหน้า)
let svcCache: Service[] | null = null
let addonCache: Addon[] | null = null
export function useServices() {
  const [s, setS] = useState<Service[] | null>(svcCache)
  useEffect(() => { sb.from('service_types').select('*').order('sort').then(({ data }) => { svcCache = (data as Service[]) || []; setS(svcCache) }) }, [])
  return s
}
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
