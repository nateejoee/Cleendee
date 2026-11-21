// ภาพถ่ายประจำบริการและงานเสริม (พนักงานใส่เสื้อโลโก้ CleenDee) ถ้าไม่มีภาพเฉพาะใช้ภาพทำความสะอาดทั่วไป
import general from '../assets/ill/cleaning.webp'
import deep from '../assets/ill/svc/deep_cleaning.webp'
import office from '../assets/ill/svc/office_cleaning.webp'
import ac from '../assets/ill/svc/ac_cleaning.webp'
import ironing from '../assets/ill/svc/ironing.webp'
import sofa from '../assets/ill/svc/sofa_cleaning.webp'
import mattress from '../assets/ill/svc/mattress_cleaning.webp'
import laundry from '../assets/ill/svc/laundry.webp'
import fridge from '../assets/ill/svc/fridge.webp'
import windows from '../assets/ill/svc/windows.webp'
import oven from '../assets/ill/svc/oven.webp'
import wardrobe from '../assets/ill/svc/wardrobe.webp'

const SERVICE: Record<string, string> = { general_cleaning: general, deep_cleaning: deep, office_cleaning: office, ac_cleaning: ac, ironing, sofa_cleaning: sofa, mattress_cleaning: mattress }
const ADDON: Record<string, string> = { ironing, laundry, fridge, windows, oven, wardrobe }

export const serviceImage = (code: string) => SERVICE[code] ?? general
export const addonImage = (code: string): string | undefined => ADDON[code]
