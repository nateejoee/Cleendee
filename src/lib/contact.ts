import { useEffect, useState } from 'react'
import { defaultPhones, readPolicy } from './publicPages'

// ช่องทางติดต่อ CleenDee: LINE OA และเบอร์โทร (เบอร์อ่านจากหน้านโยบายที่แอดมินแก้ได้ ถ้าโหลดไม่ได้ใช้เบอร์ตั้งต้น)
export const LINE_OA = '@716smhqr'
export const LINE_URL = 'https://line.me/R/ti/p/' + LINE_OA

let cache: string[] | null = null
export function useContactPhones() {
  const [phones, setPhones] = useState<string[]>(cache ?? defaultPhones)
  useEffect(() => {
    if (cache) return
    let on = true
    readPolicy('privacy').then(({ data }) => {
      cache = data?.contact_phones?.filter(Boolean).length ? data.contact_phones.filter(Boolean) : defaultPhones
      if (on) setPhones(cache)
    })
    return () => { on = false }
  }, [])
  return phones
}
