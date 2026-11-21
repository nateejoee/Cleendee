import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { useI18n, money } from '../lib/i18n'
import { CountUp } from '../lib/fx'

type Tier = { spent: number; tier: string; mult: number; next: string | null; next_at: number | null; mults: Record<string, number> }
const NAME: Record<string, string> = { member: 'Member', silver: 'Silver', gold: 'Gold', platinum: 'Platinum' }

// การ์ดเดียวของสมาชิก: แต้มที่มี + ระดับ + แต้มคูณ + ความคืบหน้าสู่ระดับถัดไป
export function RewardsCard({ points, onClick }: { points: number; onClick?: () => void }) {
  const { lang } = useI18n(); const th = lang === 'th'
  const [d, setD] = useState<Tier | null>(null)
  useEffect(() => { sb.rpc('my_tier').then(({ data }) => setD(data as Tier | null)) }, [])
  const tier = d?.tier ?? 'member', mult = d?.mult ?? 1
  const pct = d?.next_at ? Math.min(100, Math.round(d.spent / d.next_at * 100)) : 100
  const Tag = onClick ? 'button' : 'div'
  return <Tag className={'rewards t-' + tier} onClick={onClick}>
    <div className="between"><span className="small">{th ? 'แต้มของฉัน' : 'My points'}</span><span className="tier-chip">{NAME[tier]}{mult > 1 ? ` · ×${mult}` : ''}</span></div>
    <div className="v"><CountUp value={points} /> {th ? 'แต้ม' : 'pts'}</div>
    <div className="small">{th ? `ทุก 100 บาทได้ ${mult} แต้ม · ครบ 50 แต้มแลกส่วนลด 100 บาท` : `${mult} pt per 100 THB · 50 pts = 100 THB off`}</div>
    {d && <><div className="tier-bar" role="progressbar" aria-label={th ? 'ความคืบหน้าระดับสมาชิก' : 'Tier progress'} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: pct + '%' }} /></div>
      <div className="small">{d.next && d.next_at
        ? (th ? `ใช้บริการอีก ${money(d.next_at - d.spent)} บาท เป็น ${NAME[d.next]} ได้แต้ม ×${d.mults[d.next]}` : `Spend ${money(d.next_at - d.spent)} THB more for ${NAME[d.next]} (points ×${d.mults[d.next]})`)
        : (th ? 'ระดับสูงสุดแล้ว ขอบคุณที่ใช้บริการ' : 'Top tier reached. Thank you!')}</div></>}
  </Tag>
}
