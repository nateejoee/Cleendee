// รูปสำรองของแม่บ้าน/ช่างที่ยังไม่มีรูปจริง: ภาพเงาไม่มีหน้า ใส่เสื้อโปโลปักโลโก้คลีนดี (ภาพจาก ChatGPT) แยกหญิง/ชาย
import { placeholderImg } from '../lib/placeholders'

export function MaidSilhouette({ round = false, gender }: { seed?: string; round?: boolean; gender?: string | null }) {
  return <img className={'maid-sil' + (round ? ' round' : '')} src={placeholderImg('helper', gender)} alt="" aria-hidden="true" loading="lazy" />
}
