import { FunnelReport } from '../components/FunnelReport'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { bkkToday } from '../lib/draft'
import { sb, friendly, type Booking, type Service, type Addon } from '../lib/supabase'
import { useServices, svcName, svcUnit } from '../lib/services'
import { useI18n, money, fmtDate, fmtTime, type Key } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { AdminTabs, Avatar, Icon, LangToggle, Loading, StatusPill, useToast } from '../components/ui'

import { PublicPageEditor } from './PublicPageEditor'
import { useDistricts } from './Start'
import { usePrices } from './Book'

// ผลตรวจสลิปอัตโนมัติ (รหัสจากเซิร์ฟเวอร์) เป็นข้อความที่อ่านเข้าใจ ไม่รู้จักรหัสก็แสดงรหัสเดิม
const CHECK_NOTE: Record<string, Key> = {
  amount_mismatch: 'chk_amount_mismatch', duplicate_slip: 'chk_duplicate_slip', wrong_receiver: 'chk_wrong_receiver',
  not_image: 'chk_unreadable', bad_image: 'chk_unreadable', no_qr: 'chk_unreadable', not_payment_qr: 'chk_unreadable',
  bank_delay: 'chk_bank_delay', bank_down: 'chk_bank_down', not_found_yet: 'chk_not_found_yet', no_trans_ref: 'chk_no_trans_ref',
  old_slip: 'chk_old_slip', slipok_unreachable: 'chk_slipok_unreachable', slipok_quota: 'chk_slipok_quota',
  slipok_key: 'chk_slipok_account', slipok_branch: 'chk_slipok_account', slipok_expired: 'chk_slipok_account', slipok_package: 'chk_slipok_account',
  slip_missing: 'chk_slip_missing',
}

function useAdminGuard() { const { profile, ready } = useAuth(); return ready && profile?.role !== 'admin' }

// หัวข้อกลุ่มงาน พร้อมจำนวนที่ค้าง — ใช้ซ้ำทุกหน้า Admin
function Section({ id, title, count, hint, action, children }: { id?: string; title: string; count?: number; hint?: string; action?: ReactNode; children: ReactNode }) {
  return <section id={id} className="admin-sec">
    <div className="admin-sec-head"><h2>{title}{count !== undefined && <span className={'admin-count' + (count ? ' on' : '')}>{count}</span>}</h2>{action}</div>
    {hint && <p className="admin-hint">{hint}</p>}{children}</section>
}
function Nothing() { const th = useI18n().lang === 'th'; return <div className="admin-empty">✓ {th ? 'ไม่มีรายการค้าง' : 'All clear'}</div> }

type Pay = { id: number; booking_id: number | null; package_id: number | null; amount: number; slip_path: string | null; created_at: string; auto_checked?: boolean; check_note?: string | null }
type Payout = { payout_id: number; booking_id: number; nickname: string; amount: number; bank_name: string | null; bank_account: string | null; work_date: string }
type Refund = { id: number; booking_id: number; amount: number; points_returned: number; reason?: string | null }
type Claim = { id: number; booking_id: number; item: string; description: string | null; purchase_price: number | null; purchase_year: number | null; photo_paths: string[]; created_at: string }

function useAdminData() {
  const [d, setD] = useState<{ pays: Pay[]; payouts: Payout[]; refunds: Refund[]; claims: Claim[]; unmatched: Booking[]; month: Booking[]; maidsPending: number; maidsTotal: number } | null>(null)
  const load = async () => {
    const m0 = new Date(bkkToday().slice(0, 7) + '-01T00:00:00+07:00') // ต้นเดือนตามเวลาไทย
    const [pays, payouts, refunds, claims, unmatched, month, mp, mt] = await Promise.all([
      sb.from('payments').select('*').eq('status', 'pending').order('created_at'),
      sb.rpc('admin_pending_payouts'),
      sb.from('refunds').select('*').eq('status', 'pending'),
      sb.from('claims').select('*').eq('status', 'pending'),
      sb.from('bookings').select('*').is('maid_id', null).eq('status', 'awaiting_maid').order('start_at'),
      sb.from('bookings').select('*').eq('status', 'completed').gte('completed_at', m0.toISOString()),
      sb.from('maids').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      sb.from('maids').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
    ])
    setD({ pays: pays.data || [], payouts: (payouts.data as Payout[]) || [], refunds: refunds.data || [], claims: claims.data || [], unmatched: (unmatched.data as Booking[]) || [], month: (month.data as Booking[]) || [], maidsPending: mp.count || 0, maidsTotal: mt.count || 0 })
  }
  useEffect(() => { load() }, [])
  return { d, reload: load }
}

type Low = { side: 'customer' | 'maid'; id: number; booking_id: number; rating: number; tags: string[]; comment: string | null; created_at: string; admin_seen: boolean; maid_name: string; customer_name: string | null }
function useLowRatings() {
  const [rows, setRows] = useState<Low[]>([])
  const load = () => { sb.rpc('admin_low_ratings').then(({ data }) => setRows((data as Low[]) || [])) }
  useEffect(load, [])
  return { rows, load }
}
function LowRatings({ rows, reload }: { rows: Low[]; reload: () => void }) {
  const { t, lang } = useI18n(); const toast = useToast()
  if (!rows.length) return null
  const ack = async (r: Low) => { const { error } = await sb.rpc('admin_ack_low_rating', { p_side: r.side, p_id: r.id }); if (error) toast.show(friendly(error, lang)); reload() }
  return <><div id="low-ratings" className="sec-title">{t('a_low')}</div>
    <div className="stack">{rows.map(r => <div key={r.side + r.id} className="card stack" style={{ opacity: r.admin_seen ? .6 : 1 }}>
      <div className="between"><b className="disp">#{r.booking_id} · <span className="star">{'★'.repeat(r.rating)}</span></b><span className="small muted">{fmtDate(r.created_at, lang)}</span></div>
      <div className="small">{r.side === 'customer' ? t('a_low_c2m') : t('a_low_m2c')}: {r.side === 'customer' ? (r.customer_name || '–') + ' → ' + r.maid_name : r.maid_name + ' → ' + (r.customer_name || '–')}</div>
      {r.tags.length > 0 && <div className="chips">{r.tags.map(x => <span key={x} className="chip">{t(x as Key)}</span>)}</div>}
      {r.comment && <div className="small">“{r.comment}”</div>}
      {!r.admin_seen ? <button className="btn sm b-ocean" onClick={() => ack(r)}>{t('a_seen')}</button> : <span className="small muted">{t('a_seen')}</span>}
    </div>)}</div>{toast.node}</>
}

export function AdminHome() {
  const { t, lang } = useI18n(); const { d, reload } = useAdminData(); const toast = useToast(); const low = useLowRatings()
  const { hash, key } = useLocation()
  useEffect(() => { if (d && hash) document.getElementById(hash.slice(1))?.scrollIntoView() }, [hash, key, d, low.rows.length])
  if (useAdminGuard()) return <Navigate to="/" />
  if (!d) return <Loading />
  const income = d.month.reduce((a, b) => a + b.total_price - b.maid_payout, 0)
  const th = lang === 'th'
  // [จำนวน, ชื่อ, รายละเอียด, สีพื้น, สีตัวเลข, ลิงก์ปลายทาง]
  const todo: [number, string, string, string, string, string][] = [
    [d.unmatched.length, t('a_unmatched'), t('a_unmatched_d'), 'var(--brick-l)', 'var(--brick)', '#unmatched'],
    [d.pays.length, t('a_slips'), '', 'var(--sun-l)', '#8A6200', '/admin/money#slips'],
    [d.payouts.length, t('a_payouts'), money(d.payouts.reduce((a, p) => a + p.amount, 0)) + ' ' + t('baht'), '#E1EEF8', 'var(--ocean-d)', '/admin/money#payouts'],
    [d.refunds.length, t('a_refunds'), money(d.refunds.reduce((a, p) => a + p.amount, 0)) + ' ' + t('baht'), 'var(--brick-l)', 'var(--brick)', '/admin/money#refunds'],
    [d.claims.length, t('a_claims'), '', 'var(--brick-l)', 'var(--brick)', '/admin/money#claims'],
    [d.maidsPending, t('a_newmaids'), '', 'var(--leaf-l)', 'var(--leaf)', '/admin/maids'],
    [low.rows.filter(r => !r.admin_seen).length, t('a_low'), t('a_low_d'), 'var(--brick-l)', 'var(--brick)', '#low-ratings'],
  ].sort((a, b) => Number(Number(b[0]) > 0) - Number(Number(a[0]) > 0)) as [number, string, string, string, string, string][]
  const open = todo.reduce((a, q) => a + q[0], 0)
  const refundAll = async (b: Booking) => { const { error } = await sb.rpc('admin_refund_unmatched', { p_booking_id: b.id }); toast.show(error ? friendly(error, lang) : t('saved')); reload() }
  return <div className="page admin-overview">
    <div className="hero tall"><div className="between"><span className="sub">{fmtDate(new Date().toISOString(), lang, { weekday: 'long', day: 'numeric', month: 'short' })}</span><LangToggle /></div><h1>{t('a_title')}</h1></div>
    <div className="pad" style={{ marginTop: -54, position: 'relative', zIndex: 2 }}><div className="kpi"><div className="small">{t('a_income')}</div><div className="v">{money(income)} ฿</div>
      <div className="row small mt8"><span><b>{d.month.length}</b> {t('a_jobs')}</span><span><b>{d.maidsTotal}</b> {t('a_maids')}</span></div></div></div>
    <div className="pad"><div className="sec-title">{t('a_todo')} <span className={'admin-count' + (open ? ' on' : '')}>{open}</span></div>
      <div className="admin-queues">{todo.map(([n, a, b, bg, c, target]) =>
        <Link key={a} to={target} className={'admin-queue' + (n ? '' : ' zero')}><span className="between"><b>{a}</b><span className="n" style={n ? { background: bg, color: c } : undefined}>{n || '✓'}</span></span>{n > 0 && b ? <small>{b}</small> : !n && <small>{th ? 'ไม่มีรายการค้าง' : 'All clear'}</small>}</Link>
      )}</div><FunnelReport /><div id="unmatched" />
      {d.unmatched.length > 0 && <><div className="sec-title">{t('a_unmatched')}</div>{d.unmatched.map(b => <div key={b.id} className="card between mt8">
        <span><b className="disp">#{b.id} {fmtDate(b.start_at, lang)} {fmtTime(b.start_at)}</b><span className="small muted" style={{ display: 'block' }}>{money(b.total_price)} ฿</span></span>
        <button className="btn sm b-red" onClick={() => refundAll(b)}>{t('a_refund_full')}</button></div>)}</>}
      <LowRatings rows={low.rows} reload={low.load} />
    </div>
    <AdminTabs />{toast.node}
  </div>
}

export function AdminMoney() {
  const { t, lang } = useI18n(); const { d, reload } = useAdminData(); const toast = useToast(); const [sel, setSel] = useState<number[]>([]); const [slipUrl, setSlipUrl] = useState<string | null>(null)
  const {hash} = useLocation(); const th = lang === 'th'
  useEffect(() => { if (d && hash) document.getElementById(hash.slice(1))?.scrollIntoView() }, [hash,d])
  const [claimAmt, setClaimAmt] = useState<Record<number, string>>({})
  const services = useServices(); const prices = usePrices()
  if (useAdminGuard()) return <Navigate to="/" />
  if (!d) return <Loading />
  const run = async (fn: string, args: object) => { const { error } = await sb.rpc(fn, args); toast.show(error ? friendly(error, lang) : t('saved')); reload() }
  const showSlip = async (bucket: string, p: string) => { const { data } = await sb.storage.from(bucket).createSignedUrl(p, 300); setSlipUrl(data?.signedUrl ?? null) }
  // ตัวอย่างการแบ่งเงิน จากราคาทำความสะอาดทั่วไปจริง (จำนวนตั้งต้น × ราคาต่อหน่วย) และค่าเลือกแม่บ้าน
  const gc = services?.find(x => x.code === 'general_cleaning')
  const job = gc ? (Number(gc.default_qty ?? gc.min_qty) || 0) * (Number(gc.price_per_unit) || 0) : null
  const helperShare = job !== null && gc ? Math.round(job * (Number(gc.payout_pct) || 0) / 100) : null
  const shopShare = job !== null && helperShare !== null ? job - helperShare : null
  const fmt = (n: number | null) => (n !== null ? money(n) : '…')
  return <div className="page">
    <div className="hero"><h1>{t('tab_money')}</h1>
      <div className="small mt8" style={{ color: '#CFE3F2' }}>{t('a_split').replace('{job}', fmt(job))}</div>
      <div className="split"><div style={{ flex: helperShare ?? 1, background: 'var(--sun)' }} /><div style={{ flex: shopShare ?? 1, background: '#fff' }} /></div>
      <div className="between small"><b style={{ color: 'var(--sun)' }}>{t('tab_maids')} {fmt(helperShare)}</b><b>CleenDee {fmt(shopShare)}{prices.chooseFee ? ` (+${money(prices.chooseFee)})` : ''}</b></div></div>
    <div className="pad">
      <Section id="slips" title={t('a_slips')} count={d.pays.length}>
      {d.pays.length === 0 ? <Nothing /> : <div className="admin-grid">{d.pays.map(p => <div key={p.id} className="card">
        <div className="between"><b className="disp">{p.booking_id ? '#' + p.booking_id : 'Package ' + p.package_id}</b><b className="disp" style={{ fontSize: 19 }}>{money(p.amount)}</b></div>
        <div className="small muted">{fmtDate(p.created_at, lang)} {fmtTime(p.created_at)}</div>
        {p.auto_checked && p.check_note && p.check_note !== 'not_configured' && <div className="small" style={{ color: 'var(--brick)' }}>{t('a_slip_auto')}: {CHECK_NOTE[p.check_note] ? t(CHECK_NOTE[p.check_note]) : p.check_note}</div>}
        <div className="row mt8"><button className="btn sm b-line" onClick={() => p.slip_path && showSlip('slips', p.slip_path)}>{t('view_slip')}</button>
          <button className="btn sm b-ocean" style={{ flex: 1 }} onClick={() => run('admin_review_payment', { p_payment_id: p.id, p_approve: true })}>{t('approve')}</button>
          <button className="btn sm b-red" onClick={() => run('admin_review_payment', { p_payment_id: p.id, p_approve: false })}>{t('reject')}</button></div></div>)}</div>}
      </Section>

      <Section id="payouts" title={t('a_payouts')} count={d.payouts.length} hint={d.payouts.length ? (th ? 'แตะที่รายการเพื่อเลือก แล้วกดปุ่มโอนแล้วด้านล่าง' : 'Tap rows to select, then mark them as paid below') : undefined}
        action={d.payouts.length > 0 ? <button className="link" onClick={() => setSel(sel.length === d.payouts.length ? [] : d.payouts.map(p => p.payout_id))}>{sel.length === d.payouts.length ? (th ? 'ล้างที่เลือก' : 'Clear') : (th ? '✓ เลือกทั้งหมด' : '✓ Select all')}</button> : undefined}>
      {d.payouts.length === 0 ? <Nothing /> : <div className="card admin-list">{d.payouts.map(p => <button key={p.payout_id} className="listrow" onClick={() => setSel(sel.includes(p.payout_id) ? sel.filter(x => x !== p.payout_id) : [...sel, p.payout_id])}>
        <span className={'chk' + (sel.includes(p.payout_id) ? ' on' : '')}>{sel.includes(p.payout_id) && <Icon n="check" size={14} />}</span><Avatar name={p.nickname} size={40} seed={p.nickname} />
        <span style={{ flex: 1 }}><b>{p.nickname}</b><span className="small muted">#{p.booking_id} · {p.bank_name} {p.bank_account}</span></span><b className="disp">{money(p.amount)}</b></button>)}</div>}
      {sel.length > 0 && <div className="admin-sticky"><button className="btn b-sun" onClick={async () => { await run('admin_mark_payouts_done', { p_ids: sel }); setSel([]) }}>{t('a_mark_paid')} {sel.length} ({money(d.payouts.filter(p => sel.includes(p.payout_id)).reduce((a, p) => a + p.amount, 0))} ฿)</button></div>}
      </Section>

      <Section id="refunds" title={t('a_refunds')} count={d.refunds.length}>
      {d.refunds.length === 0 ? <Nothing /> : <div className="admin-grid">{d.refunds.map(r => <div key={r.id} className="card between"><span><b className="disp">#{r.booking_id}</b> <span className="small muted">{money(r.amount)} ฿{r.points_returned ? ` + ${r.points_returned} pts` : ''}{r.reason === 'choose_fee' ? ' · ' + t('a_refund_choose_fee') : ''}</span></span>
        <button className="btn sm b-line" onClick={() => run('admin_mark_refund_done', { p_id: r.id })}>{t('a_mark_refunded')}</button></div>)}</div>}
      </Section>

      <Section id="claims" title={t('a_claims')} count={d.claims.length}>
      {d.claims.length === 0 ? <Nothing /> : <div className="admin-grid">{d.claims.map(c => <div key={c.id} className="card stack">
        <div className="between"><b className="disp">#{c.booking_id}: {c.item}</b><span className="pill p-sun">{fmtDate(c.created_at, lang)}</span></div>
        {c.description && <div className="small">{c.description}</div>}
        <div className="small muted">{c.purchase_price ? money(c.purchase_price) + ' ฿' : ''} {c.purchase_year ? '(' + c.purchase_year + ')' : ''} · {t('a_cap')}</div>
        <div className="row">{c.photo_paths.map((p, i) => <button key={p} className="btn sm b-ghost" onClick={() => showSlip('claims', p)}>📷 {i + 1}</button>)}</div>
        <div className="row admin-claim-actions"><input className="input" placeholder={t('amount')} inputMode="numeric" value={claimAmt[c.id] ?? ''} onChange={e => setClaimAmt({ ...claimAmt, [c.id]: e.target.value.replace(/\D/g, '') })} />
          <button className="btn sm b-ocean" onClick={() => run('admin_decide_claim', { p_claim_id: c.id, p_approve: true, p_amount: Number(claimAmt[c.id] || 0) })}>{t('approve')}</button>
          <button className="btn sm b-red" onClick={() => run('admin_decide_claim', { p_claim_id: c.id, p_approve: false })}>{t('reject')}</button></div></div>)}</div>}
      </Section>
    </div>
    {slipUrl && <div role="dialog" aria-label={th ? 'รูปหลักฐาน' : 'Photo'} onClick={() => setSlipUrl(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}><img src={slipUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12 }} /><button className="btn sm b-glass" style={{ position: 'absolute', top: 16, right: 16 }} onClick={() => setSlipUrl(null)}>{th ? 'ปิด ✕' : 'Close ✕'}</button></div>}
    <AdminTabs />{toast.node}
  </div>
}

type MaidRow = { id: string; nickname: string; bio: string | null; status: string; id_verified: boolean; background_checked: boolean; created_at: string; services: string[] }
type Application = { id: string; full_name: string; phone: string; line_id: string | null; birth_date: string; experience_years: number | null; experience_note: string | null; applied_services: string[]; available_days: string[]; available_times: string[]; service_districts: number[]; referee_name: string | null; referee_phone: string | null; id_card_path: string; selfie_path: string; conduct_cert_path: string | null; consent_at: string }
const DAY_TH: Record<string, string> = { mon: 'จ.', tue: 'อ.', wed: 'พ.', thu: 'พฤ.', fri: 'ศ.', sat: 'ส.', sun: 'อา.' }
const TIME_TH: Record<string, string> = { morning: 'เช้า', afternoon: 'บ่าย', evening: 'เย็น' }
const EXP_TH: Record<number, string> = { 0: 'ยังไม่มีประสบการณ์', 1: 'น้อยกว่า 1 ปี', 2: '1-3 ปี', 5: 'มากกว่า 3 ปี' }
const age = (b: string) => { const d = new Date(b), n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a }

// รายละเอียดใบสมัครแม่บ้าน (เห็นเฉพาะแอดมิน) — กดดูเอกสารเปิดเป็นรูปชั่วคราว
function ApplicationInfo({ a, onDoc }: { a: Application; onDoc: (path: string) => void }) {
  const { lang } = useI18n(); const th = lang === 'th'; const services = useServices(); const districts = useDistricts()
  const row = (k: string, v: ReactNode) => <div className="admin-kv"><span>{k}</span><b>{v || '–'}</b></div>
  const dn = (id: number) => { const d = districts.find(x => x.id === id); return d ? (th ? d.name_th : d.name_en) : id }
  const sn = (c: string) => { const sv = services?.find(x => x.code === c); return sv ? svcName(sv, lang) : c }
  return <div className="admin-app">
    {row(th ? 'ชื่อจริง' : 'Full name', a.full_name)}{row(th ? 'อายุ' : 'Age', age(a.birth_date) + (th ? ' ปี' : ' yrs'))}
    {row(th ? 'โทร' : 'Phone', <a href={'tel:' + a.phone}>{a.phone}</a>)}{row('LINE', a.line_id)}
    {row(th ? 'ประสบการณ์' : 'Experience', (a.experience_years != null ? EXP_TH[a.experience_years] : '') + (a.experience_note ? ' · ' + a.experience_note : ''))}
    {row(th ? 'บริการที่ขอทำ' : 'Services', a.applied_services.map(sn).join(', '))}
    {row(th ? 'วันที่ว่าง' : 'Days', a.available_days.map(d => DAY_TH[d] ?? d).join(' '))}{row(th ? 'ช่วงเวลา' : 'Times', a.available_times.map(x => TIME_TH[x] ?? x).join(', '))}
    {row(th ? 'พื้นที่รับงาน' : 'Areas', a.service_districts.map(dn).join(', '))}
    {row(th ? 'ผู้แนะนำ' : 'Reference', a.referee_name ? a.referee_name + (a.referee_phone ? ' · ' + a.referee_phone : '') : '')}
    <div className="chips">
      <button className="chip" onClick={() => onDoc(a.id_card_path)}>{th ? '📄 บัตรประชาชน' : '📄 ID card'}</button>
      <button className="chip" onClick={() => onDoc(a.selfie_path)}>{th ? '🤳 เซลฟี่คู่บัตร' : '🤳 Selfie with ID'}</button>
      {a.conduct_cert_path && <button className="chip" onClick={() => onDoc(a.conduct_cert_path!)}>{th ? '📑 ใบรับรองความประพฤติ' : '📑 Good conduct'}</button>}</div>
    <small className="muted">{th ? 'ยินยอมตรวจประวัติเมื่อ ' : 'Consent given '}{fmtDate(a.consent_at, lang)}</small></div>
}

const MAID_STATUS: Record<string, [string, string]> = { pending: ['รออนุมัติ', 'Pending'], approved: ['อนุมัติแล้ว', 'Approved'], suspended: ['ถูกระงับ', 'Suspended'] }
export function AdminMaids() {
  const { t, lang } = useI18n(); const toast = useToast(); const services = useServices(); const [rows, setRows] = useState<MaidRow[] | null>(null); const [filter, setFilter] = useState<string | null>(null); const th = lang === 'th'; const [apps, setApps] = useState<Record<string, Application>>({}); const [openApp, setOpenApp] = useState<string | null>(null); const [docUrl, setDocUrl] = useState<{ url: string; pdf: boolean } | null>(null); const [avg, setAvg] = useState<Record<string, { avg_rating: number; review_count: number }>>({})
  useEffect(() => { sb.rpc('admin_maid_ratings').then(({ data }) => setAvg(Object.fromEntries(((data as { maid_id: string; avg_rating: number; review_count: number }[]) || []).map(x => [x.maid_id, x])))) }, [])
  const load = () => sb.from('maids').select('id,nickname,bio,status,id_verified,background_checked,created_at,services').order('created_at', { ascending: false }).then(({ data }) => setRows(data || []))
  useEffect(() => { load() }, [])
  useEffect(() => { sb.rpc('admin_maid_applications').then(({ data }) => setApps(Object.fromEntries(((data as Application[]) || []).map(x => [x.id, x])))) }, [])
  if (useAdminGuard()) return <Navigate to="/" />
  const showDoc = async (path: string) => { const { data } = await sb.storage.from('maid-docs').createSignedUrl(path, 300); if (data?.signedUrl) setDocUrl({ url: data.signedUrl, pdf: path.endsWith('.pdf') }) }
  const set = async (m: MaidRow, patch: Partial<MaidRow>) => { const n = { ...m, ...patch }; const { error } = await sb.rpc('admin_set_maid', { p_maid: m.id, p_status: n.status, p_id_verified: n.id_verified, p_background_checked: n.background_checked }); toast.show(error ? friendly(error, lang) : t('saved')); load() }
  const count = (st: string) => (rows || []).filter(m => m.status === st).length
  const cur = filter ?? (count('pending') ? 'pending' : 'all')
  const shown = (rows || []).filter(m => cur === 'all' || m.status === cur)
  return <div className="page"><div className="hero"><h1>{t('tab_maids')}</h1></div>
    {rows && <div className="pad mt12"><div className="chips">{([['pending', count('pending')], ['approved', count('approved')], ['suspended', count('suspended')], ['all', rows.length]] as [string, number][]).map(([k, n]) =>
      <button key={k} className={'chip' + (cur === k ? ' on' : '')} onClick={() => setFilter(k)}>{k === 'all' ? (th ? 'ทั้งหมด' : 'All') : MAID_STATUS[k][th ? 0 : 1]} ({n})</button>)}</div></div>}
    <div className="pad mt12 stack cols">{!rows ? <Loading /> : shown.length === 0 ? <div className="empty">{t('nothing')}</div> : shown.map(m => <div key={m.id} className="card stack">
      <div className="row"><Avatar name={m.nickname} seed={m.id} size={44} /><span style={{ flex: 1 }}><b className="disp">{m.nickname}</b><span className="small muted" style={{ display: 'block' }}>{m.bio}</span>{avg[m.id] && <span className="small" style={{ display: 'block', color: avg[m.id].avg_rating < 4.5 ? 'var(--brick)' : undefined, fontWeight: avg[m.id].avg_rating < 4.5 ? 700 : undefined }}>★ {avg[m.id].avg_rating} ({avg[m.id].review_count} {t('reviews')}){avg[m.id].avg_rating < 4.5 && ' · ' + t('a_low_avg')}</span>}</span>
        <span className={'pill ' + (m.status === 'approved' ? 'p-leaf' : m.status === 'pending' ? 'p-sun' : 'p-brick')}>{MAID_STATUS[m.status]?.[th ? 0 : 1] ?? m.status}</span></div>
      {apps[m.id] ? <><button className="link" style={{ textAlign: 'start' }} onClick={() => setOpenApp(openApp === m.id ? null : m.id)}>{openApp === m.id ? (th ? '▾ ซ่อนใบสมัคร' : '▾ Hide application') : (th ? '▸ ดูใบสมัครและเอกสาร' : '▸ View application and documents')}</button>
        {openApp === m.id && <ApplicationInfo a={apps[m.id]} onDoc={showDoc} />}</> : <small className="muted">{th ? 'สมัครด้วยแบบฟอร์มเดิม (ไม่มีรายละเอียดเพิ่ม)' : 'Applied with the old form (no extra details)'}</small>}
      <div className="chips"><button className={'chip' + (m.id_verified ? ' on' : '')} onClick={() => set(m, { id_verified: !m.id_verified })}>{t('id_ok')}</button>
        <button className={'chip' + (m.background_checked ? ' on' : '')} onClick={() => set(m, { background_checked: !m.background_checked })}>{t('bg_ok')}</button></div>
      <div className="small muted">{t('a_skills')}</div>
      <div className="chips">{(services || []).map(sv => { const on = (m.services || []).includes(sv.code)
        return <button key={sv.code} className={'chip' + (on ? ' on' : '')} onClick={async () => { const { error } = await sb.rpc('admin_set_maid_services', { p_maid: m.id, p_services: on ? m.services.filter(x => x !== sv.code) : [...(m.services || []), sv.code] }); toast.show(error ? friendly(error, lang) : t('saved')); load() }}>{svcName(sv, lang)}</button> })}</div>
      <div className="row">{m.status !== 'approved' && <button className="btn sm b-ocean" disabled={!m.id_verified || !m.background_checked} onClick={() => set(m, { status: 'approved' })}>{t('approve')}</button>}
        {m.status !== 'suspended' && <button className="btn sm b-red" onClick={() => set(m, { status: 'suspended' })}>{th ? 'ระงับ' : 'Suspend'}</button>}</div>
      {m.status !== 'approved' && (!m.id_verified || !m.background_checked) && <div className="admin-hint">{th ? 'ติ๊กตรวจบัตรและตรวจประวัติให้ครบก่อน จึงจะอนุมัติได้' : 'Tick both ID and background checks before approving'}</div>}</div>)}</div>
    {docUrl && <div role="dialog" onClick={() => setDocUrl(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      {docUrl.pdf ? <iframe src={docUrl.url} title="document" style={{ width: 'min(900px,100%)', height: '90%', border: 0, borderRadius: 12, background: '#fff' }} /> : <img src={docUrl.url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12 }} />}
      <button className="btn sm b-glass" style={{ position: 'absolute', top: 16, right: 16 }} onClick={() => setDocUrl(null)}>{th ? 'ปิด ✕' : 'Close ✕'}</button></div>}
    <AdminTabs />{toast.node}</div>
}

export function AdminSettings() {
  const { t, lang } = useI18n(); const toast = useToast(); const [id, setId] = useState(''); const [name, setName] = useState('')
  useEffect(() => { sb.from('payment_settings').select('*').maybeSingle().then(({ data }) => { setId(data?.promptpay_id || ''); setName(data?.promptpay_name || '') }) }, [])
  if (useAdminGuard()) return <Navigate to="/" />
  const th = lang === 'th'
  const jump = (k: string) => document.getElementById(k)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const save = async () => { const { error } = await sb.rpc('admin_set_promptpay', { p_id: id.replace(/\D/g, ''), p_name: name }); toast.show(error ? friendly(error, lang) : t('saved')) }
  return <div className="page"><div className="hero"><div className="between"><h1>{t('tab_settings')}</h1><LangToggle /></div></div>
    <div className="pad mt16 stack">
      <Link to="/admin/settings/pages" className="btn b-line"><Icon n="grid" size={18} />{lang === 'th' ? 'จัดการการันตีและนโยบายความเป็นส่วนตัว' : 'Manage guarantee and privacy pages'}</Link>
      <div className="chips admin-jump">{([['s-pay', th ? 'รับเงิน' : 'Payment'], ['s-shop', t('a_shop')], ['s-prices', t('a_prices')], ['s-addons', t('addons')], ['s-promo', t('promo_code')]] as [string, string][]).map(([k, label]) => <button key={k} className="chip" onClick={() => jump(k)}>{label}</button>)}</div>
      <section id="s-pay" className="admin-sec card stack"><div className="sec-title" style={{ margin: 0 }}>{th ? 'บัญชีรับเงิน (พร้อมเพย์)' : 'Payment account (PromptPay)'}</div>
      <div className="field"><label>{t('a_pp')}</label><input className="input" inputMode="numeric" value={id} onChange={e => setId(e.target.value)} placeholder="08xxxxxxxx / 13 หลัก" /></div>
      <div className="field"><label>{t('a_pp_name')}</label><input className="input" value={name} onChange={e => setName(e.target.value)} /></div>
      <button className="btn b-sun" onClick={save}>{t('save')}</button></section>
      <section id="s-shop" className="admin-sec card stack"><ShopSettings toast={toast.show} /></section>
      <section id="s-prices" className="admin-sec"><ServicePrices toast={toast.show} /></section>
      <section id="s-addons" className="admin-sec"><AddonEditor toast={toast.show} /></section>
      <section id="s-promo" className="admin-sec"><PromoEditor toast={toast.show} /></section>
      <Link to="/account" className="btn b-line mt16">{t('account')}</Link>
    </div><AdminTabs />{toast.node}</div>
}

export function AdminPublicPages() {
  const { lang, t } = useI18n()
  const { ready } = useAuth()
  const denied = useAdminGuard()
  if (!ready) return <Loading />
  if (denied) return <Navigate to="/" replace />
  return <div className="page">
    <div className="hero"><div className="between"><h1>{lang === 'th' ? 'จัดการเนื้อหาหน้าสาธารณะ' : 'Manage public pages'}</h1><LangToggle /></div></div>
    <div className="pad mt16 stack">
      <Link to="/admin/settings" className="link">{t('booking_back')} · {t('tab_settings')}</Link>
      <PublicPageEditor />
    </div>
    <AdminTabs />
  </div>
}

// ช่องตัวเลขสั้นๆ ใช้ซ้ำในหน้าตั้งค่า
function Num({ label, v, on }: { label: string; v: number | string | null | undefined; on: (n: string) => void }) {
  return <div className="field" style={{ flex: 1, minWidth: 110 }}><label>{label}</label><input className="input" inputMode="decimal" value={v ?? ''} onChange={e => on(e.target.value.replace(/[^\d.]/g, ''))} /></div>
}

// ช่องกรอกตัวเลขของการ์ดราคาบริการ (มีหน่วยอยู่ในช่อง)
function SvcField({ label, v, on, unit }: { label: string; v: number | string | null | undefined; on: (n: string) => void; unit?: string }) {
  return <label className="apc-f"><span>{label}</span><div className="apc-in"><input className="input" inputMode="decimal" value={v ?? ''} onChange={e => on(e.target.value.replace(/[^\d.]/g, ''))} />{unit && <i>{unit}</i>}</div></label>
}

// ตั้งค่าร้าน: ค่าเรียกด่วน เลื่อนนัด ส่วนลด และข้อมูลบนใบเสร็จ
function ShopSettings({ toast }: { toast: (m: string) => void }) {
  const { t, lang } = useI18n(); const [f, setF] = useState<Record<string, string> | null>(null)
  const keys = ['urgent_fee', 'urgent_maid_bonus', 'urgent_min_lead_minutes', 'reschedule_min_hours', 'first_booking_discount', 'choose_maid_fee', 'business_name', 'business_address', 'tax_id']
  useEffect(() => { sb.from('settings').select(keys.join(',')).maybeSingle().then(({ data }) => setF(Object.fromEntries(keys.map(k => [k, String((data as Record<string, unknown> | null)?.[k] ?? '')])))) }, [])
  if (!f) return <Loading />
  const save = async () => {
    const p: Record<string, unknown> = { ...f }; for (const k of keys.slice(0, 6)) p[k] = Number(f[k])
    const { error } = await sb.rpc('admin_update_settings', { p }); toast(error ? friendly(error, lang) : t('saved'))
  }
  const set = (k: string) => (v: string) => setF({ ...f, [k]: v })
  return <><div className="sec-title">{t('a_shop')}</div>
    <div className="row" style={{ flexWrap: 'wrap' }}><Num label={t('a_urgent_fee')} v={f.urgent_fee} on={set('urgent_fee')} /><Num label={t('a_urgent_bonus')} v={f.urgent_maid_bonus} on={set('urgent_maid_bonus')} />
      <Num label={t('a_urgent_lead')} v={f.urgent_min_lead_minutes} on={set('urgent_min_lead_minutes')} /><Num label={t('a_resched_h')} v={f.reschedule_min_hours} on={set('reschedule_min_hours')} />
      <Num label={t('first_promo')} v={f.first_booking_discount} on={set('first_booking_discount')} /><Num label={t('pick_fee')} v={f.choose_maid_fee} on={set('choose_maid_fee')} /></div>
    <div className="field"><label>{t('a_biz_name')}</label><input className="input" value={f.business_name} onChange={e => set('business_name')(e.target.value)} /></div>
    <div className="field"><label>{t('a_biz_addr')}</label><input className="input" value={f.business_address} onChange={e => set('business_address')(e.target.value)} /></div>
    <div className="field"><label>{t('tax_id')}</label><input className="input" value={f.tax_id} onChange={e => set('tax_id')(e.target.value)} /></div>
    <button className="btn b-ocean" onClick={save}>{t('save')}</button></>
}

// ราคาแต่ละบริการ และเปิด/ปิดบริการ
function ServicePrices({ toast }: { toast: (m: string) => void }) {
  const { t, lang } = useI18n(); const [rows, setRows] = useState<Service[] | null>(null)
  const load = () => sb.from('service_types').select('*').order('sort').then(({ data }) => setRows((data as Service[]) || []))
  useEffect(() => { load() }, [])
  if (!rows) return <Loading />
  const upd = (i: number, patch: Partial<Service>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const save = async (r: Service) => {
    const { error } = await sb.rpc('admin_update_service', { p_code: r.code, p_price_per_unit: Number(r.price_per_unit), p_payout_pct: Number(r.payout_pct), p_min: Number(r.min_qty), p_max: Number(r.max_qty), p_default: Number(r.default_qty), p_minutes: Number(r.minutes_per_unit), p_active: r.active, p_coming_soon: r.coming_soon })
    toast(error ? friendly(error, lang) : t('saved')); load()
  }
  return <><div className="sec-title">{t('a_prices')}</div><div className="stack cols apc-cols">{rows.map((r, i) => {
    const u = svcUnit(r, lang), price = Number(r.price_per_unit) || 0, pct = Number(r.payout_pct) || 0
    const maid = Math.round(price * pct / 100), shop = price - maid // ปัดเป็นบาทเต็มแบบเดียวกับเซิร์ฟเวอร์ (round)
    const num = (k: keyof Service) => (v: string) => upd(i, { [k]: v as unknown as number })
    return <div key={r.code} className="card apc">
      <div className="between"><b className="disp">{svcName(r, lang)}</b><span className={'pill ' + (r.active ? 'p-leaf' : 'p-grey')}>{r.active ? t('a_open') : r.coming_soon ? t('soon') : t('a_closed')}</span></div>
      <div className="apc-g2"><SvcField label={t('a_price_cust')} unit={`${t('a_baht')} / ${u}`} v={r.price_per_unit} on={num('price_per_unit')} /><SvcField label={t('a_payout_pct')} unit="%" v={r.payout_pct} on={num('payout_pct')} /></div>
      <div className="apc-sum"><div><span>{t('a_cust_pays')}</span><b>{money(price)}</b></div><div><span>{t('a_maid_gets')}</span><b>{money(maid)}</b></div><div><span>{t('a_shop_gets')}</span><b>{money(shop)}</b></div></div>
      <div className="apc-sub">{t('a_sec_qty')} ({u})</div>
      <div className="apc-g3"><SvcField label={t('a_min_qty')} v={r.min_qty} on={num('min_qty')} /><SvcField label={t('a_max_qty')} v={r.max_qty} on={num('max_qty')} /><SvcField label={t('a_default')} v={r.default_qty} on={num('default_qty')} /></div>
      {r.pricing === 'unit' && <SvcField label={t('a_min_per_unit')} unit={t('a_minutes')} v={r.minutes_per_unit} on={num('minutes_per_unit')} />}
      <div className="tiny muted">{t('a_qty_note')}</div>
      <div className="apc-foot"><div className="chips"><button className={'chip' + (r.active ? ' on' : '')} onClick={() => upd(i, { active: !r.active })}>{t('a_open_h')}</button>
        <button className={'chip' + (r.coming_soon ? ' on' : '')} onClick={() => upd(i, { coming_soon: !r.coming_soon })}>{t('a_soon_h')}</button></div>
        <button className="btn sm b-ocean" onClick={() => save(r)}>{t('save')}</button></div></div>
  })}</div></>
}

// งานเสริม: แก้ราคา/ส่วนแม่บ้าน/เวลา เปิดปิด และเพิ่มใหม่
function AddonEditor({ toast }: { toast: (m: string) => void }) {
  const { t, lang } = useI18n(); const services = useServices(); const [rows, setRows] = useState<Addon[] | null>(null)
  const blank: Addon = { code: '', name_th: '', name_en: '', price: 100, maid_payout: 70, minutes: 30, service_codes: ['general_cleaning', 'deep_cleaning'], active: true, sort: 99 }
  const load = () => sb.from('service_addons').select('*').order('sort').then(({ data }) => setRows([...((data as Addon[]) || []), blank]))
  useEffect(() => { load() }, [])
  if (!rows) return <Loading />
  const upd = (i: number, patch: Partial<Addon>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const save = async (r: Addon) => {
    const { error } = await sb.rpc('admin_upsert_addon', { p_code: r.code, p_name_th: r.name_th, p_name_en: r.name_en, p_price: Number(r.price), p_maid_payout: Number(r.maid_payout), p_minutes: Number(r.minutes), p_service_codes: r.service_codes, p_active: r.active })
    toast(error ? friendly(error, lang) : t('saved')); load()
  }
  return <><div className="sec-title">{t('addons')}</div><div className="stack cols">{rows.map((r, i) => { const isNew = i === rows.length - 1
    return <div key={isNew ? '_new' : r.code} className="card stack">{isNew && <b className="disp">+ {t('a_new_addon')}</b>}
      {isNew && <div className="field"><label>{t('a_code')}</label><input className="input" value={r.code} onChange={e => upd(i, { code: e.target.value.replace(/[^a-z0-9_]/gi, '').toLowerCase() })} placeholder="balcony" /></div>}
      <div className="field"><label>{t('a_name_th')}</label><input className="input" value={r.name_th} onChange={e => upd(i, { name_th: e.target.value })} /></div>
      <div className="field"><label>{t('a_name_en')}</label><input className="input" value={r.name_en} onChange={e => upd(i, { name_en: e.target.value })} /></div>
      <div className="row" style={{ flexWrap: 'wrap' }}><Num label={t('amount')} v={r.price} on={v => upd(i, { price: v as unknown as number })} /><Num label={t('a_to_maid')} v={r.maid_payout} on={v => upd(i, { maid_payout: v as unknown as number })} />
        <Num label={t('minutes')} v={r.minutes} on={v => upd(i, { minutes: v as unknown as number })} /></div>
      <div className="chips">{(services || []).map(sv => { const on = r.service_codes.includes(sv.code)
        return <button key={sv.code} className={'chip' + (on ? ' on' : '')} onClick={() => upd(i, { service_codes: on ? r.service_codes.filter(x => x !== sv.code) : [...r.service_codes, sv.code] })}>{svcName(sv, lang)}</button> })}</div>
      <div className="row"><button className={'chip' + (r.active ? ' on' : '')} onClick={() => upd(i, { active: !r.active })}>{t('a_open')}</button>
        <button className="btn sm b-ocean" style={{ marginLeft: 'auto' }} disabled={!r.code || !r.name_th} onClick={() => save(r)}>{t('save')}</button></div></div> })}</div></>
}

// โค้ดส่วนลด
type Promo = { code: string; kind: 'amount' | 'percent'; value: number; max_discount: number | null; min_total: number; max_uses: number | null; used_count: number; once_per_user: boolean; ends_at: string | null; active: boolean }
function PromoEditor({ toast }: { toast: (m: string) => void }) {
  const { t, lang } = useI18n(); const [rows, setRows] = useState<Promo[] | null>(null)
  const [f, setF] = useState({ code: '', kind: 'amount' as 'amount' | 'percent', value: '100', max_discount: '', min_total: '0', max_uses: '', ends: '' })
  const load = () => sb.from('promo_codes').select('*').order('created_at', { ascending: false }).then(({ data }) => setRows((data as Promo[]) || []))
  useEffect(() => { load() }, [])
  const put = async (p: { code: string; kind: string; value: number; max_discount: number | null; min_total: number; max_uses: number | null; once: boolean; ends: string | null; active: boolean }) => {
    const { error } = await sb.rpc('admin_upsert_promo', { p_code: p.code, p_kind: p.kind, p_value: p.value, p_max_discount: p.max_discount, p_min_total: p.min_total, p_max_uses: p.max_uses, p_once_per_user: p.once, p_ends_at: p.ends, p_active: p.active })
    toast(error ? friendly(error, lang) : t('saved')); load(); return !error
  }
  const n = (v: string) => (v === '' ? null : Number(v))
  return <><div className="sec-title">{t('promo_code')}</div>
    <div className="card stack">
      <div className="row"><div className="field" style={{ flex: 2 }}><label>{t('promo_code')}</label><input className="input" value={f.code} onChange={e => setF({ ...f, code: e.target.value.toUpperCase().replace(/\s/g, '') })} placeholder="CLEAN50" /></div>
        <div className="field" style={{ flex: 1 }}><label>{t('a_kind')}</label><select className="input" value={f.kind} onChange={e => setF({ ...f, kind: e.target.value as 'amount' | 'percent' })}><option value="amount">{t('baht')}</option><option value="percent">%</option></select></div></div>
      <div className="row" style={{ flexWrap: 'wrap' }}><Num label={t('a_value')} v={f.value} on={v => setF({ ...f, value: v })} />{f.kind === 'percent' && <Num label={t('a_max_disc')} v={f.max_discount} on={v => setF({ ...f, max_discount: v })} />}
        <Num label={t('a_min_total')} v={f.min_total} on={v => setF({ ...f, min_total: v })} /><Num label={t('a_max_uses')} v={f.max_uses} on={v => setF({ ...f, max_uses: v })} /></div>
      <div className="field"><label>{t('a_ends')}</label><input className="input" type="date" value={f.ends} onChange={e => setF({ ...f, ends: e.target.value })} /></div>
      <button className="btn b-ocean" disabled={!f.code || !Number(f.value)} onClick={async () => { if (await put({ code: f.code, kind: f.kind, value: Number(f.value), max_discount: n(f.max_discount), min_total: Number(f.min_total || 0), max_uses: n(f.max_uses), once: true, ends: f.ends ? f.ends + 'T23:59:59+07:00' : null, active: true })) setF({ ...f, code: '' }) }}>{t('a_add_promo')}</button>
    </div>
    {!rows ? <Loading /> : rows.map(r => <div key={r.code} className="card between mt8"><span><b className="disp">{r.code}</b> <span className="small muted">{r.kind === 'amount' ? `−${money(r.value)} ${t('baht')}` : `−${r.value}%`} · {t('a_used')} {r.used_count}{r.max_uses ? '/' + r.max_uses : ''}{r.ends_at ? ' · ' + t('a_until') + ' ' + fmtDate(r.ends_at, lang) : ''}</span></span>
      <button className={'chip' + (r.active ? ' on' : '')} onClick={() => put({ code: r.code, kind: r.kind, value: r.value, max_discount: r.max_discount, min_total: r.min_total, max_uses: r.max_uses, once: r.once_per_user, ends: r.ends_at, active: !r.active })}>{r.active ? t('a_open') : t('a_closed')}</button></div>)}</>
}
export { StatusPill }
