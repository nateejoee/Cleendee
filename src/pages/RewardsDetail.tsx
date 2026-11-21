import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { sb } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useI18n, money, fmtDate } from '../lib/i18n'
import { TopBar, Loading } from '../components/ui'
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

    {/* สิทธิ์แต่ละระดับ */}
    <div className="pad mt16"><div className="sec-title">{th ? 'สิทธิ์ของแต่ละระดับ' : 'Tier benefits'}</div>
      <div className="card rw-tiers">{ORDER.map(k => <div key={k} className={'rw-tier t-' + k + (k === tier ? ' on' : '')}>
        <span className="rw-dot" aria-hidden="true" />
        <span className="rw-tn"><b>{NAME[k]}</b>{k === tier && <em>{th ? 'ระดับของคุณ' : 'Your tier'}</em>}
          <small>{k === 'member' ? (th ? 'เมื่อสมัครสมาชิก' : 'When you sign up') : (th ? `ใช้จ่ายสะสม ${money(from(k))} บาทขึ้นไป` : `From ${money(from(k))} THB spent`)}</small></span>
        <span className="rw-mult">×{d?.mults?.[k] ?? 1}<small>{th ? 'แต้ม' : 'points'}</small></span>
      </div>)}</div></div>

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
