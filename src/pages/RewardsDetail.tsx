import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { sb } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useI18n, money, fmtDate } from '../lib/i18n'
import { TopBar, Loading, Icon } from '../components/ui'
import { Empty } from '../components/EmptyArt'
import { RewardsCard } from '../components/Rewards'

// หน้ารายละเอียดบัตรสมาชิก: ยอดใช้จ่ายสะสม สิทธิ์แต่ละระดับ วิธีได้/แลกแต้ม และประวัติแต้ม
type Tier = { spent: number; tier: string; mult: number; next: string | null; next_at: number | null; mults: Record<string, number>; levels?: Record<string, number> }
type Row = { id: number; delta: number; reason: string; booking_id: number | null; created_at: string }
type Rule = { baht_per_point: number; redeem_points: number; redeem_value: number }
const NAME: Record<string, string> = { member: 'Member', silver: 'Silver', gold: 'Gold', platinum: 'Platinum' }
const ORDER = ['member', 'silver', 'gold', 'platinum']

export function RewardsDetail() {
  const { lang } = useI18n(); const th = lang === 'th'; const { profile, session } = useAuth()
  const [d, setD] = useState<Tier | null>(null)
  const [rows, setRows] = useState<Row[] | null>(null)
  // ค่าเริ่มต้นตรงกับในระบบ ถ้าอ่านตั้งค่าไม่ได้ก็ใช้ค่านี้
  const [rule, setRule] = useState<Rule>({ baht_per_point: 100, redeem_points: 50, redeem_value: 100 })
  useEffect(() => {
    sb.rpc('my_tier').then(({ data }) => setD(data as Tier | null))
    sb.from('settings').select('baht_per_point,redeem_points,redeem_value').limit(1).maybeSingle().then(({ data }) => { if (data) setRule(data as Rule) })
  }, [])
  useEffect(() => {
    if (!session) return
    sb.from('points_ledger').select('id,delta,reason,booking_id,created_at').eq('customer_id', session.user.id).order('created_at', { ascending: false }).limit(100)
      .then(({ data, error }) => setRows(error ? [] : (data as Row[])))
  }, [session])

  const tier = d?.tier ?? 'member'
  const from = (k: string) => k === 'member' ? 0 : (d?.levels?.[k] ?? 0)
  const why: Record<string, [string, string]> = { earn: ['ได้แต้มจากงานที่เสร็จ', 'Earned from a finished job'], redeem: ['ใช้แต้มเป็นส่วนลด', 'Used as a discount'], return: ['คืนแต้ม (ยกเลิก/คืนเงิน)', 'Points returned (cancel/refund)'] }

  return <div className="page nobar dp-sub rw-page"><TopBar title={th ? 'บัตรสมาชิก' : 'Membership card'} />
    <div className="pad mt12"><RewardsCard points={profile?.points ?? 0} name={profile?.full_name} since={profile?.created_at} /></div>

    {/* ยอดใช้จ่ายสะสม */}
    <div className="pad mt16"><div className="sec-title">{th ? 'ยอดใช้จ่ายสะสม' : 'Total spent'}</div>
      <div className="card rw-spent">{!d ? <Loading /> : <>
        <div className="rw-big">{money(d.spent)} <small>{th ? 'บาท' : 'THB'}</small></div>
        <div className="small muted">{th ? 'นับจากงานที่ทำเสร็จแล้วเท่านั้น' : 'Counts finished jobs only'}</div>
        <div className="rw-next">{d.next && d.next_at
          ? (th ? <>ใช้จ่ายอีก <b>{money(d.next_at - d.spent)} บาท</b> เพื่อเป็น <b>{NAME[d.next]}</b></> : <>Spend <b>{money(d.next_at - d.spent)} THB</b> more to reach <b>{NAME[d.next]}</b></>)
          : (th ? 'คุณอยู่ระดับสูงสุดแล้ว' : 'You are at the top tier')}</div>
      </>}</div></div>

    {/* สิทธิ์แต่ละระดับ แบบแท็บ (อิง Shopee Rewards) */}
    <div className="pad mt16"><div className="sec-title">{th ? 'สิทธิพิเศษตามระดับ' : 'Benefits by tier'}</div>
      <TierBenefits d={d} rule={rule} /></div>

    {/* วิธีได้แต้มและแลกแต้ม */}
    <div className="pad mt16"><div className="sec-title">{th ? 'วิธีได้แต้มและแลกแต้ม' : 'Earn and use points'}</div>
      <div className="card rw-how">
        <div><span className="rw-n">1</span><span><b>{th ? 'ได้แต้มเมื่องานเสร็จ' : 'Earn when a job is done'}</b><small>{th ? `ทุก ${money(rule.baht_per_point)} บาท ได้ 1 แต้ม คูณตามระดับของคุณ` : `1 point per ${money(rule.baht_per_point)} THB, multiplied by your tier`}</small></span></div>
        <div><span className="rw-n">2</span><span><b>{th ? 'แลกเป็นส่วนลด' : 'Use as a discount'}</b><small>{th ? `ครบ ${rule.redeem_points} แต้ม ลด ${money(rule.redeem_value)} บาท` : `${rule.redeem_points} points = ${money(rule.redeem_value)} THB off`}</small></span></div>
        <div><span className="rw-n">3</span><span><b>{th ? 'ใช้ตอนจอง' : 'Apply when booking'}</b><small>{th ? `เปิด "ใช้แต้ม" ในหน้ายืนยันการจอง ถ้ายกเลิกงาน ระบบคืนแต้มให้` : `Turn on "Use points" at checkout. Cancelled jobs get their points back`}</small></span></div>
      </div></div>

    {/* ประวัติแต้ม */}
    <div className="pad mt16" style={{ paddingBottom: 28 }}><div className="sec-title">{th ? 'ประวัติแต้ม' : 'Points history'}</div>
      {rows === null ? <Loading /> : rows.length === 0
        ? <Empty art="wallet" title={th ? 'ยังไม่มีประวัติแต้ม' : 'No points yet'} sub={th ? 'แต้มจะขึ้นที่นี่หลังงานแรกเสร็จ' : 'Points show here after your first finished job'} small />
        : <div className="card rw-hist">{rows.map(r => <div key={r.id} className="rw-row">
          <span className="rw-rt"><b>{(why[r.reason] ?? [r.reason, r.reason])[th ? 0 : 1]}</b>
            <small>{fmtDate(r.created_at, lang, { day: 'numeric', month: 'short', year: 'numeric' })}{r.booking_id && <> · <Link to={'/bookings/' + r.booking_id}>{th ? 'งาน' : 'Job'} #{r.booking_id}</Link></>}</small></span>
          <span className={'rw-d' + (r.delta < 0 ? ' neg' : '')}>{r.delta > 0 ? '+' : ''}{money(r.delta)}</span></div>)}</div>}
    </div>
  </div>
}

// สิทธิ์ของแต่ละระดับ: แท็บ Member / Silver / Gold / Platinum แต่ละแท็บมีรายการสิทธิ์พร้อมเงื่อนไข (ระบบใช้ให้อัตโนมัติตอนจอง)
type Perk = { tier: string; coupon_value: number; coupon_min: number; coupons_per_month: number; free_choose_maid: boolean; urgent_discount_pct: number }
function TierBenefits({ d, rule }: { d: Tier | null; rule: Rule }) {
  const { lang } = useI18n(); const th = lang === 'th'; const { session } = useAuth()
  const my = d?.tier ?? 'member'
  const [tab, setTab] = useState<string | null>(null); const cur = tab ?? my
  const [perks, setPerks] = useState<Perk[] | null>(null); const [used, setUsed] = useState(0)
  const [fees, setFees] = useState({ choose_maid_fee: 20, urgent_fee: 200 })
  useEffect(() => {
    sb.from('tier_perks').select('*').then(({ data }) => setPerks((data as Perk[]) || []))
    sb.from('settings').select('choose_maid_fee,urgent_fee').limit(1).maybeSingle().then(({ data }) => { if (data) setFees(data as typeof fees) })
    if (session) sb.rpc('my_tier_coupons_used').then(({ data }) => setUsed(Number(data) || 0))
  }, [session])
  const p = perks?.find(x => x.tier === cur)
  const mult = d?.mults?.[cur] ?? 1
  const rank = (k: string) => ORDER.indexOf(k)
  const from = cur === 'member' ? 0 : (d?.levels?.[cur] ?? 0)
  // ข้อความสถานะของแท็บ: ระดับของคุณ / ผ่านมาแล้ว / ต้องใช้จ่ายอีกเท่าไร
  const status = cur === my ? (th ? 'ระดับปัจจุบันของคุณ' : 'Your current tier')
    : rank(cur) < rank(my) ? (th ? 'คุณผ่านระดับนี้มาแล้ว' : 'You have passed this tier')
    : (th ? `ปลดล็อกเมื่อใช้จ่ายสะสม ${money(from)} บาท (อีก ${money(Math.max(0, from - (d?.spent ?? 0)))} บาท)` : `Unlocks at ${money(from)} THB spent (${money(Math.max(0, from - (d?.spent ?? 0)))} THB to go)`)
  const items: { ic: string; t: string; s: string; extra?: string }[] = []
  items.push({ ic: 'star', t: th ? `แต้มสะสม ×${mult}` : `Points ×${mult}`, s: th ? `ทุก ${money(rule.baht_per_point)} บาท ได้ ${mult} แต้ม · ${rule.redeem_points} แต้มแลกส่วนลด ${money(rule.redeem_value)} บาท` : `${mult} pts per ${money(rule.baht_per_point)} THB · ${rule.redeem_points} pts = ${money(rule.redeem_value)} THB off` })
  if (p && p.coupons_per_month > 0 && p.coupon_value > 0) items.push({ ic: 'ticket', t: th ? `คูปองลด ${money(p.coupon_value)} บาท ทุกเดือน` : `${money(p.coupon_value)} THB coupon every month`,
    s: th ? `ขั้นต่ำ ${money(p.coupon_min)} บาท · ใช้ได้ ${p.coupons_per_month} ครั้ง/เดือน · ใช้ให้อัตโนมัติตอนจอง` : `Min ${money(p.coupon_min)} THB · ${p.coupons_per_month}× per month · applied automatically`,
    extra: cur === my && session ? (th ? `เดือนนี้ใช้ไป ${Math.min(used, p.coupons_per_month)}/${p.coupons_per_month}` : `Used ${Math.min(used, p.coupons_per_month)}/${p.coupons_per_month} this month`) : undefined })
  if (p?.free_choose_maid) items.push({ ic: 'team', t: th ? 'ฟรีค่าเลือกแม่บ้านเอง' : 'Free choice of helper', s: th ? `ปกติ ${money(fees.choose_maid_fee)} บาทต่อคน` : `Normally ${money(fees.choose_maid_fee)} THB per helper` })
  if (p && p.urgent_discount_pct > 0) items.push({ ic: 'clock', t: p.urgent_discount_pct >= 100 ? (th ? 'ฟรีค่าเรียกด่วน' : 'Free urgent booking') : (th ? `ลดค่าเรียกด่วน ${p.urgent_discount_pct}%` : `${p.urgent_discount_pct}% off urgent fee`),
    s: th ? `จากปกติ ${money(fees.urgent_fee)} บาท เหลือ ${money(Math.round(fees.urgent_fee * (100 - p.urgent_discount_pct) / 100))} บาท` : `${money(fees.urgent_fee)} → ${money(Math.round(fees.urgent_fee * (100 - p.urgent_discount_pct) / 100))} THB` })
  items.push({ ic: 'shield', t: th ? 'การันตีงาน CleenDee' : 'CleenDee guarantee', s: th ? 'แม่บ้านไม่มาหาคนแทนหรือคืนเงิน · ของเสียหายชดเชย' : 'No-show replacement or refund · damage compensation' })
  return <div className="card rw-tabs-card">
    {/* การ์ด 4 ใบเรียงเฉียงแบบบัตรสมาชิกจริง กดการ์ดเพื่อเปลี่ยนแท็บได้ */}
    <div className="rw-deck">{ORDER.map((k, i) => <button key={k} type="button" tabIndex={-1} aria-hidden="true" onClick={() => setTab(k)}
      className={'rw-mini t-' + k + (k === cur ? ' on' : '')} style={{ ['--i' as string]: i }}>
      <span className="rw-mini-sheen" />
      <svg className="rw-mini-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.2 12 4l9 7.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M6 10v8.5h12V10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
      <b>{NAME[k].toUpperCase()}</b>
      <span className="rw-mini-brand">CleenDee</span>
    </button>)}<i className="rw-spark s1" /><i className="rw-spark s2" /><i className="rw-spark s3" /></div>
    <div className="rw-tabs" role="tablist">{ORDER.map(k => <button key={k} role="tab" aria-selected={k === cur} className={k === cur ? 'on' : ''} onClick={() => setTab(k)}>{NAME[k]}</button>)}</div>
    <div className={'rw-status' + (cur === my ? ' me' : rank(cur) > rank(my) ? ' lock' : '')}>{status}</div>
    {!perks ? <Loading /> : <div className="rw-perks">{items.map(x => <div key={x.t} className="rw-perk">
      <span className={'rw-pi t-' + cur}><Icon n={x.ic} size={22} /></span>
      <span className="rw-pt"><b>{x.t}</b><small>{x.s}</small>{x.extra && <em>{x.extra}</em>}</span></div>)}</div>}
  </div>
}
