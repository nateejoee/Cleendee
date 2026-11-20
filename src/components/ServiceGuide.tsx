import { useState } from 'react'
import { Link } from 'react-router-dom'
import { money, useI18n } from '../lib/i18n'
import type { Service } from '../lib/supabase'
import './BookingHelp.css'

export function HoursGuide({ service, onBook, onEstimate }: { service: Service; onBook: (qty: number) => void; onEstimate: (qty: number | null) => void }) {
  const { lang } = useI18n()
  const th = lang === 'th'
  const [home, setHome] = useState('')
  const homes = [
    { id: 'condo', qty: 3, label: th ? 'คอนโด 1 ห้องนอน' : 'One-bedroom condo' },
    { id: 'house', qty: 4, label: th ? 'บ้าน 2 ห้องนอน' : 'Two-bedroom home' },
    { id: 'two-storey', qty: 6, label: th ? 'บ้าน 2 ชั้น' : 'Two-storey home' },
  ]
  const picked = homes.find(item => item.id === home)
  const qty = picked ? Math.max(service.min_qty, Math.min(service.max_qty, picked.qty)) : null
  return <section className="cd-help card">
    <h2>{th ? 'บ้านของฉันควรจองกี่ชั่วโมง?' : 'How many hours does my home need?'}</h2>
    <label className="field">{th ? 'ลักษณะบ้าน' : 'Home type'}
      <select className="input" value={home} onChange={e => {
        const selected = homes.find(h => h.id === e.target.value)
        setHome(e.target.value)
        onEstimate(selected ? Math.max(service.min_qty, Math.min(service.max_qty, selected.qty)) : null)
      }}>
        <option value="">{th ? 'เลือกประเภทบ้าน' : 'Choose your home type'}</option>
        {homes.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
      </select>
    </label>
    {qty !== null && <div className="stack" aria-live="polite">
      <strong>{th ? 'แนะนำประมาณ ' : 'Allow about '}{qty}{th ? ' ชั่วโมง' : ' hours'} · ฿{money(qty * service.price_per_unit)}</strong>
      <small className="muted">{th ? 'ประมาณการสำหรับงานทั่วไป ปรับชั่วโมงและเพิ่มงานเสริมได้ตอนเลือกเวลา' : 'Estimate for regular cleaning. Adjust hours and extras when choosing a time.'}</small>
      <button className="btn b-ocean" onClick={() => onBook(qty)}>{th ? 'จอง ' : 'Book '}{qty}{th ? ' ชั่วโมง' : ' hours'}</button>
    </div>}
  </section>
}

export function ServiceFAQ({ general, onBook }: { general: boolean; onBook: () => void }) {
  const { lang } = useI18n()
  const th = lang === 'th'
  return <section className="cd-help cd-faq"><h2>{th ? 'คำถามก่อนจอง' : 'Before you book'}</h2>
    <details><summary>{general ? (th ? 'อยากให้เน้นครัว แจ้งตรงไหน?' : 'How do I ask for extra attention in the kitchen?') : (th ? 'แจ้งรายละเอียดงานเพิ่มเติมได้ที่ไหน?' : 'How do I add instructions?')}</summary>
      <p>{th ? 'หลังเลือกวันเวลา ให้ระบุสิ่งที่ต้องการในขั้นรายละเอียดงาน แม่บ้านจะเห็นข้อมูลนี้ในใบนัด' : 'After choosing a time, add instructions in the job details. Your helper will see them on the booking.'}</p>
      <button className="link" onClick={onBook}>{th ? 'เริ่มจองบริการนี้' : 'Book this service'}</button></details>
    <details><summary>{th ? 'ถ้าต้องการเลื่อนนัด ทำอย่างไร?' : 'How do I change my appointment?'}</summary>
      <p>{th ? 'เปิดนัดจากรายการจอง เลือกเลื่อนนัด แล้วเลือกคิวว่าง ระบบจะแสดงตัวเลือกตามสถานะและเงื่อนไขของนัดนั้น' : 'Open your booking and choose Reschedule to see available times. Options depend on the booking status and conditions.'}</p>
      <Link to="/bookings">{th ? 'ไปที่รายการจอง' : 'My bookings'}</Link></details>
    <details><summary>{th ? 'ดูใบเสร็จได้ที่ไหน?' : 'Where can I find my receipt?'}</summary>
      <p>{th ? 'เปิดรายละเอียดนัดในรายการจอง เมื่อมีปุ่มใบเสร็จ คุณสามารถเปิดดูและสั่งพิมพ์ได้' : 'Open the appointment in My bookings. When the receipt is available, you can view and print it there.'}</p>
      <Link to="/bookings">{th ? 'ดูรายการจองของฉัน' : 'View my bookings'}</Link></details>
  </section>
}
