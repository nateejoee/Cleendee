import { THAI_KEEP_WORDS } from './thaiKeepWords'

// ===== ไม่ให้เบราว์เซอร์ตัดบรรทัดกลางคำไทย =====
// เบราว์เซอร์แยกคำประสมไทยเป็นท่อน (เช่น ค่าใช้|จ่าย, ตรวจ|สอบ, ราย|เดือน) แล้วตัดบรรทัดตรงรอยต่อได้
// วิธีแก้: ตัดคำทั้งประโยคด้วยตัวตัดคำของเบราว์เซอร์ (Intl.Segmenter = ICU ชุดเดียวกับที่ใช้ตัดบรรทัด)
// แล้วใส่ตัวเชื่อมคำที่มองไม่เห็น (U+2060) เฉพาะรอยต่อที่อยู่ "ข้างใน" คำประสมจากรายการ THAI_KEEP_WORDS
// (ไม่ใส่ทุกตัวอักษร เพราะจะทำให้ตัวตัดคำของเบราว์เซอร์อ่านคำถัดไปผิดแล้วตัดกลางคำอื่นแทน)
const WJ = /⁠/g
const words = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('th', { granularity: 'word' }) : null
const EXTRA = ['การันตี', 'คลีนดี', 'แม่บ้าน', 'ทำความสะอาด', 'ยืนยันตัวตน', 'บัตรประชาชน', 'ตรวจประวัติ', 'ห้องนอน', 'ชั้นเดียว', 'ทาวน์เฮาส์', 'ตึกแถว']
const LIST = [...new Set([...THAI_KEEP_WORDS, ...EXTRA])].sort((a, b) => b.length - a.length) // คำยาวก่อน
const TH = /[฀-๿]/

export function joinThai(input: string) {
  if (!words || !TH.test(input)) return input
  const s = input.replace(WJ, '')
  const inside = new Set<number>() // ตำแหน่งที่ต้องห้ามตัด (อยู่ภายในคำประสม)
  // ทุกคำในรายการ รวมคำที่ซ้อนทับกัน (เช่น "มีค่า" กับ "ค่าใช้จ่าย")
  for (const w of LIST) { let k = s.indexOf(w); while (k >= 0) { for (let i = k + 1; i < k + w.length; i++) inside.add(i); k = s.indexOf(w, k + 1) } }
  if (!inside.size) return s
  let out = '', last = 0
  for (const seg of words.segment(s)) {
    if (seg.index > 0 && inside.has(seg.index)) { out += s.slice(last, seg.index) + '⁠'; last = seg.index }
  }
  return out + s.slice(last)
}

// ประมวลผลข้อความทุกโหนดในหน้า และคอยจับข้อความที่ React เพิ่ม/เปลี่ยนภายหลัง
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE', 'OPTION'])
function fix(n: Node) {
  if (n.nodeType === 3) {
    const p = n.parentElement; if (!p || SKIP.has(p.tagName) || p.isContentEditable) return
    const v = n.nodeValue || ''; if (!TH.test(v)) return
    const j = joinThai(v); if (j !== v) n.nodeValue = j
    return
  }
  if (n.nodeType !== 1 || SKIP.has((n as Element).tagName)) return
  const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT); let t: Node | null
  const list: Node[] = []; while ((t = w.nextNode())) list.push(t)
  list.forEach(fix)
}
export function startThaiWrap() {
  if (typeof document === 'undefined' || !words) return
  fix(document.body)
  new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') fix(m.target); else m.addedNodes.forEach(fix) } })
    .observe(document.body, { subtree: true, childList: true, characterData: true })
}
