import { Link } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { useServices, svcName } from '../lib/services'
import type { Maid, Rating } from '../lib/supabase'
import { Icon } from './ui'

// การ์ดแม่บ้านแนะนำ (ใช้ทั้งหน้าแรกมือถือและคอม): รูปด้านบน ป้ายตรวจสอบ คะแนน พื้นที่ และบริการที่รับ
// ถ้ายังไม่มีรูป ใช้พื้นไล่สีโทนแบรนด์ + อักษรย่อตัวใหญ่ + ลายบ้านจางๆ แทน
const TONES = [['#22355E', '#3E5A8C'], ['#7A5A1E', '#C9A24D'], ['#1F5C4A', '#3F9A7B'], ['#5B3E78', '#8C6BB0'], ['#7A3B2E', '#C0705A']]
const SHORT: Record<string, [string, string]> = {
  general_cleaning: ['บ้านทั่วไป', 'Home'], deep_cleaning: ['ทำความสะอาดใหญ่', 'Deep clean'], office_cleaning: ['ออฟฟิศ', 'Office'],
  ironing: ['รีดผ้า', 'Ironing'], ac_cleaning: ['ล้างแอร์', 'Air-con'], sofa_cleaning: ['โซฟา', 'Sofa'], mattress_cleaning: ['ที่นอน', 'Mattress'],
}

export function MaidCard({ m, area }: { m: Maid & Partial<Rating>; area?: string }) {
  const { lang } = useI18n(); const th = lang === 'th'; const services = useServices()
  const tone = TONES[[...m.id].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length]
  const offered = (services || []).filter(s => s.active && (m.services || []).includes(s.code))
  const chips = offered.slice(0, 2).map(s => SHORT[s.code]?.[th ? 0 : 1] ?? svcName(s, lang))
  const more = offered.length - chips.length
  const checked = m.background_checked || m.id_verified
  return <Link to={'/maid-profile/' + m.id} className="mc2">
    <span className="mc2-ph" style={{ '--a': tone[0], '--b': tone[1] } as React.CSSProperties}>
      {m.photo_url ? <img src={m.photo_url} alt="" loading="lazy" /> : <>
        <svg className="mc2-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.2 12 4l9 7.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M6 10v8.5h12V10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
        <span className="mc2-ini">{m.nickname.slice(0, 1)}</span></>}
      {checked && <span className="mc2-ok"><Icon n="shield" size={13} />{th ? 'ตรวจประวัติแล้ว' : 'Verified'}</span>}
    </span>
    <span className="mc2-body">
      <span className="mc2-top"><b>{m.nickname}</b>
        {m.review_count ? <span className="mc2-rate"><span className="star">★</span>{m.avg_rating ?? '–'}<small>({m.review_count})</small></span>
          : <span className="mc2-new">{th ? 'แม่บ้านใหม่' : 'New'}</span>}</span>
      {area && <span className="mc2-area"><Icon n="pin" size={13} />{area}</span>}
      {chips.length > 0 && <span className="mc2-chips">{chips.map(c => <i key={c}>{c}</i>)}{more > 0 && <i>+{more}</i>}</span>}
    </span>
  </Link>
}
