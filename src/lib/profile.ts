import { sb } from './supabase'

// ---------- รูปโปรไฟล์: ตรวจไฟล์ ตัดเป็นสี่เหลี่ยมจัตุรัส ย่อเป็น JPEG ~400px แล้วอัปโหลดเข้า avatars/<uid>/<uuid>.jpg ----------
// รับรูปจากกล้องมือถือได้ทุกขนาด (ไม่เกิน 30 MB) เพราะย่อในเครื่องก่อนอัปโหลด ไฟล์ที่ส่งจริงเหลือราว 30-60 KB
// บางเครื่องไม่ระบุชนิดไฟล์ จึงดูจากนามสกุลด้วย ถ้าเบราว์เซอร์เปิดรูปไม่ได้ (เช่น HEIC บางรุ่น) squareJpeg จะแจ้ง bad_image
const PHOTO_EXT = /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i
export const photoFileOk = (f: File) => (f.type.startsWith('image/') || (!f.type && PHOTO_EXT.test(f.name))) && f.size <= 30 * 1024 * 1024

export async function squareJpeg(file: File, size = 400): Promise<Blob> {
  const src = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src })
    const s = Math.min(img.naturalWidth, img.naturalHeight)
    if (!s) throw new Error('bad_image')
    const out = Math.min(size, s)
    const c = document.createElement('canvas'); c.width = out; c.height = out
    const ctx = c.getContext('2d'); if (!ctx) throw new Error('bad_image')
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, out, out) // PNG โปร่งใสให้พื้นขาว
    ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, out, out)
    return await new Promise<Blob>((ok, fail) => c.toBlob(b => (b ? ok(b) : fail(new Error('bad_image'))), 'image/jpeg', 0.86))
  } finally { URL.revokeObjectURL(src) }
}

// อัปโหลดได้อย่างเดียว (ไม่ทับไฟล์เดิม) จึงตั้งชื่อไฟล์ใหม่ทุกครั้ง
export async function uploadAvatar(uid: string, file: File): Promise<string> {
  const blob = await squareJpeg(file)
  const bucket = sb.storage.from('avatars')
  const path = `${uid}/${crypto.randomUUID()}.jpg`
  const r = await bucket.upload(path, blob, { contentType: 'image/jpeg' })
  if (r.error) throw r.error
  return bucket.getPublicUrl(path).data.publicUrl
}

// ---------- ตรวจข้อมูลฝั่งเครื่อง ----------
export const digits = (v: string) => v.replace(/\D/g, '')
export const phoneOk = (v: string) => /^0\d{8,9}$/.test(digits(v)) // แบบเดียวกับหน้าจอง (Book.tsx)
export const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
// วันนี้ตามเวลาไทย ย้อนหลัง n ปี (YYYY-MM-DD)
export function yearsAgo(n: number) { const d = new Date(Date.now() + 7 * 3600e3); d.setUTCFullYear(d.getUTCFullYear() - n); return d.toISOString().slice(0, 10) }
export const BIRTH_MIN = '1900-01-02'


export const BANKS: [string, string, string][] = [ // [ค่าที่บันทึก, ชื่อไทย, ชื่ออังกฤษ]
  ['กสิกรไทย (KBank)', 'ธนาคารกสิกรไทย', 'Kasikornbank (KBank)'], ['ไทยพาณิชย์ (SCB)', 'ธนาคารไทยพาณิชย์', 'Siam Commercial Bank (SCB)'],
  ['กรุงเทพ (BBL)', 'ธนาคารกรุงเทพ', 'Bangkok Bank (BBL)'], ['กรุงไทย (KTB)', 'ธนาคารกรุงไทย', 'Krungthai Bank (KTB)'],
  ['กรุงศรีอยุธยา (BAY)', 'ธนาคารกรุงศรีอยุธยา', 'Krungsri (BAY)'], ['ทหารไทยธนชาต (ttb)', 'ธนาคารทหารไทยธนชาต', 'TMBThanachart (ttb)'],
  ['ออมสิน (GSB)', 'ธนาคารออมสิน', 'Government Savings Bank (GSB)'], ['ธ.ก.ส. (BAAC)', 'ธ.ก.ส.', 'BAAC'],
  ['อาคารสงเคราะห์ (GHB)', 'ธนาคารอาคารสงเคราะห์', 'Government Housing Bank (GHB)'], ['ซีไอเอ็มบี ไทย (CIMB)', 'ธนาคารซีไอเอ็มบี ไทย', 'CIMB Thai'],
  ['ยูโอบี (UOB)', 'ธนาคารยูโอบี', 'UOB'], ['เกียรตินาคินภัทร (KKP)', 'ธนาคารเกียรตินาคินภัทร', 'Kiatnakin Phatra (KKP)'],
  ['แลนด์ แอนด์ เฮ้าส์ (LH Bank)', 'ธนาคารแลนด์ แอนด์ เฮ้าส์', 'LH Bank'], ['อิสลามแห่งประเทศไทย (iBank)', 'ธนาคารอิสลามแห่งประเทศไทย', 'Islamic Bank of Thailand'],
]
export const maskAcc = (a: string | null | undefined) => { const d = digits(a ?? ''); return d ? '•••• ' + d.slice(-4) : '–' }

