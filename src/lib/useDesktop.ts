import { useLayoutEffect, useSyncExternalStore } from 'react'

// จอคอม (≥1024px) ใช้โครงหน้าแบบเว็บไซต์ (เมนูด้านบน + ท้ายหน้าเต็ม) — ต่ำกว่านั้นเป็นแบบแอปมือถือ/แท็บเล็ตเหมือนเดิม
export const DESKTOP_QUERY = '(min-width:1024px)'

function subscribe(cb: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mq = window.matchMedia(DESKTOP_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const snapshot = () => typeof window !== 'undefined' && !!window.matchMedia?.(DESKTOP_QUERY).matches

export function useIsDesktop() {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}

// ---- มีหน้าที่ต้องการเมนูลูกค้าอยู่หรือไม่ (CustomerTabs ลงทะเบียน แล้ว DeskNav แสดงเมนูด้านบนแทนเมนูข้าง) ----
let wanted = 0
const subs = new Set<() => void>()
const emit = () => subs.forEach(f => f())
const subWanted = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const useCustomerShellWanted = () => useSyncExternalStore(subWanted, () => wanted > 0, () => false)

/** เรียกใน CustomerTabs: บนจอคอมคืนค่า true (ให้ซ่อนเมนูข้าง) และขอให้แสดงเมนูด้านบนแทน */
export function useCustomerShell() {
  const desk = useIsDesktop()
  useLayoutEffect(() => {
    if (!desk) return
    wanted++; emit()
    return () => { wanted--; emit() }
  }, [desk])
  return desk
}
