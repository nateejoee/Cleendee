import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { useI18n, money } from '../lib/i18n'
import { CountUp } from '../lib/fx'

type Tier = { spent: number; tier: string; mult: number; next: string | null; next_at: number | null; mults: Record<string, number>; levels?: Record<string, number> }
const NAME: Record<string, string> = { member: 'Member', silver: 'Silver', gold: 'Gold', platinum: 'Platinum' }
const ORDER = ['member', 'silver', 'gold', 'platinum']

// บัตรสมาชิก CleenDee: แต้ม ระดับ แต้มคูณ และทางไปสู่ระดับถัดไป แต่ละระดับมีผิวบัตรของตัวเอง
export function RewardsCard({ points, onClick, name, since }: { points: number; onClick?: () => void; name?: string | null; since?: string | null }) {
  const { lang } = useI18n(); const th = lang === 'th'
  const [d, setD] = useState<Tier | null>(null)
  useEffect(() => { sb.rpc('my_tier').then(({ data }) => setD(data as Tier | null)) }, [])
  const tier = d?.tier ?? 'member', mult = d?.mult ?? 1
  // ความคืบหน้าภายในขั้นปัจจุบัน (จากเกณฑ์ขั้นนี้ ไปเกณฑ์ขั้นถัดไป)
  const from = d?.levels?.[tier] ?? 0
  const pct = d?.next_at ? Math.max(0, Math.min(100, Math.round((d.spent - from) / Math.max(1, d.next_at - from) * 100))) : 100
  const worth = Math.floor(points / 50) * 100
  const year = since ? new Date(since).getFullYear() : null
  const Tag = onClick ? 'button' : 'div'
  return <Tag className={'memcard t-' + tier} onClick={onClick} aria-label={onClick ? (th ? 'ดูบัตรสมาชิก' : 'Open membership card') : undefined}>
    <span className="mc-sheen" aria-hidden="true" />
    <div className="mc-top">
      <span className="mc-brand"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 11.2 12 4l9 7.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M6 10v8.5h12V10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M18.5 3.2l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z" fill="currentColor" /></svg>CleenDee</span>
      <span className="mc-tier">{NAME[tier]}</span>
    </div>
    <div className="mc-points">
      <span className="mc-num"><CountUp value={points} /></span>
      <span className="mc-unit">{th ? 'แต้ม' : 'points'}{mult > 1 && <em>×{mult}</em>}</span>
    </div>
    <div className="mc-sub">{worth > 0
      ? (th ? `แลกเป็นส่วนลดได้ ${money(worth)} บาท` : `Worth ${money(worth)} THB off`)
      : (th ? `ทุก 100 บาทได้ ${mult} แต้ม · 50 แต้มแลกส่วนลด 100 บาท` : `${mult} pt per 100 THB · 50 pts = 100 THB off`)}</div>
    {d && <div className="mc-path">
      <div className="mc-steps" aria-hidden="true">{ORDER.map(k => <i key={k} className={ORDER.indexOf(k) <= ORDER.indexOf(tier) ? 'on' : ''} />)}</div>
      <div className="mc-bar" role="progressbar" aria-label={th ? 'ความคืบหน้าระดับสมาชิก' : 'Tier progress'} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: pct + '%' }} /></div>
      <div className="mc-next">{d.next && d.next_at
        ? (th ? <>อีก <b>{money(d.next_at - d.spent)} บาท</b> เป็น {NAME[d.next]} · แต้ม ×{d.mults[d.next]}</> : <><b>{money(d.next_at - d.spent)} THB</b> to {NAME[d.next]} · points ×{d.mults[d.next]}</>)
        : (th ? 'ระดับสูงสุดแล้ว ขอบคุณที่อยู่กับเรา' : 'Top tier. Thank you for staying with us')}</div>
    </div>}
    {(name || year) && <div className="mc-foot"><span className="mc-name">{name}</span>{year && <span>{th ? `สมาชิกตั้งแต่ ${year + 543}` : `Since ${year}`}</span>}</div>}
  </Tag>
}
