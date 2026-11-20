// ธีมสี / โหมดมืด / เอฟเฟกต์เรืองแสง (แบบเดียวกับ Seafresh Loader)
// เก็บค่าที่เลือกไว้ใน localStorage แล้วติดเป็น data-attribute บน <html> ให้ CSS เปลี่ยนสีตาม
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { localStorageGet, localStorageSet } from './i18n'

export const BRANDS = ['navy', 'ocean', 'leaf', 'grape', 'rose', 'sunset'] as const
export type Brand = typeof BRANDS[number]
// navy = ธีมเริ่มต้นแบบหรู (กรมท่า + ทองแชมเปญ) สำหรับลูกค้าต่างชาติ/ระดับบน · ocean = สีฟ้า-เหลืองเดิม
// สีตัวอย่างของแต่ละธีม (ใช้แสดงวงกลมในตัวเลือก ต้องตรงกับ styles.css)
export const BRAND_SWATCH: Record<Brand, string> = { navy: '#13294B', ocean: '#1D6FA5', leaf: '#2F8F6B', grape: '#6B4FB3', rose: '#C2457A', sunset: '#D9682B' }

type T = { brand: Brand; dark: boolean; glow: boolean }
const Ctx = createContext<T & { set: (p: Partial<T>) => void }>({ brand: 'navy', dark: false, glow: false, set: () => {} })

function load(): T {
  try { return { brand: 'navy', dark: false, glow: false, ...JSON.parse(localStorageGet('cd_theme') || '{}') } } catch { return { brand: 'navy', dark: false, glow: false } }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [v, setV] = useState<T>(load)
  useEffect(() => {
    const h = document.documentElement
    h.dataset.brand = v.brand
    h.dataset.dark = v.dark ? '1' : ''
    h.dataset.glow = v.glow ? '1' : ''
    // สีแถบเบราว์เซอร์บนมือถือให้ตรงกับธีม
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', v.dark ? '#0F1C28' : BRAND_SWATCH[v.brand])
    localStorageSet('cd_theme', JSON.stringify(v))
  }, [v])
  return <Ctx.Provider value={{ ...v, set: p => setV(o => ({ ...o, ...p })) }}>{children}</Ctx.Provider>
}
export const useTheme = () => useContext(Ctx)
