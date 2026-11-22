import { Link } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { useServices, svcName } from '../lib/services'
import type { Maid, Rating } from '../lib/supabase'
import { Icon } from './ui'
import { MaidSilhouette } from './MaidSilhouette'

// การ์ดแม่บ้านแนะนำ (ใช้ทั้งหน้าแรกมือถือและคอม): รูปด้านบน ป้ายตรวจสอบ คะแนน พื้นที่ และบริการที่รับ
// ถ้ายังไม่มีรูป ใช้ภาพเงาแม่บ้านใส่เสื้อคลีนดีแทน (MaidSilhouette)
const SHORT: Record<string, [string, string]> = {
  general_cleaning: ['บ้านทั่วไป', 'Home'], deep_cleaning: ['ทำความสะอาดใหญ่', 'Deep clean'], office_cleaning: ['ออฟฟิศ', 'Office'],
  ironing: ['รีดผ้า', 'Ironing'], ac_cleaning: ['ล้างแอร์', 'Air-con'], sofa_cleaning: ['โซฟา', 'Sofa'], mattress_cleaning: ['ที่นอน', 'Mattress'],
}

export function MaidCard({ m, area }: { m: Maid & Partial<Rating>; area?: string }) {
  const { lang } = useI18n(); const th = lang === 'th'; const services = useServices()
  const offered = (services || []).filter(s => s.active && (m.services || []).includes(s.code))
  const chips = offered.slice(0, 2).map(s => SHORT[s.code]?.[th ? 0 : 1] ?? svcName(s, lang))
  const more = offered.length - chips.length
  const checked = m.background_checked || m.id_verified
  return <Link to={'/maid-profile/' + m.id} className="mc2">
    <span className={'mc2-ph' + (m.photo_url ? '' : ' sil')}>
      {m.photo_url ? <img src={m.photo_url} alt="" loading="lazy" /> : <MaidSilhouette seed={m.id} gender={m.gender} />}
      {checked && <span className="mc2-ok"><Icon n="shield" size={13} />{th ? 'ตรวจประวัติแล้ว' : 'Verified'}</span>}
    </span>
    <span className="mc2-body">
      <span className="mc2-top"><b>{m.nickname}</b>
        {m.review_count ? <span className="mc2-rate"><span className="star">★</span>{m.avg_rating ?? '–'}<small>({m.review_count})</small></span>
          : <span className="mc2-new">{th ? 'แม่บ้านใหม่' : 'New'}</span>}</span>
      {m.trained_at && <span className="mc2-trained"><Icon n="star" size={12} />{th ? 'ผ่านการอบรม' : 'Trained'}</span>}
      {area && <span className="mc2-area"><Icon n="pin" size={13} />{area}</span>}
      {chips.length > 0 && <span className="mc2-chips">{chips.map(c => <i key={c}>{c}</i>)}{more > 0 && <i>+{more}</i>}</span>}
    </span>
  </Link>
}
