// รูปสำรองเมื่อผู้ใช้ยังไม่มีรูปโปรไฟล์ (ภาพเงาพรีเมี่ยมจาก ChatGPT)
// helper = แม่บ้าน/ช่าง ใส่เสื้อโปโลโลโก้คลีนดี, user = ลูกค้าทั่วไป ไม่มีเครื่องแบบ
import helperF from '../assets/ill/maid-placeholder.webp'
import helperM from '../assets/ill/helper-placeholder-m.webp'
import userF from '../assets/ill/user-placeholder-f.webp'
import userM from '../assets/ill/user-placeholder-m.webp'
import userN from '../assets/ill/user-placeholder-n.webp'

export type PersonKind = 'helper' | 'user'
export function placeholderImg(kind: PersonKind, gender?: string | null) {
  if (kind === 'helper') return gender === 'male' ? helperM : helperF
  return gender === 'male' ? userM : gender === 'female' ? userF : userN
}
