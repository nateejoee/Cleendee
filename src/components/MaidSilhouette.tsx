// รูปสำรองของแม่บ้านที่ยังไม่มีรูปจริง: ภาพเงาแม่บ้านไม่มีหน้า ใส่เสื้อโปโลปักโลโก้คลีนดี (ภาพจาก ChatGPT)
import placeholder from '../assets/ill/maid-placeholder.webp'

export function MaidSilhouette({ round = false }: { seed?: string; round?: boolean }) {
  return <img className={'maid-sil' + (round ? ' round' : '')} src={placeholder} alt="" aria-hidden="true" loading="lazy" />
}
