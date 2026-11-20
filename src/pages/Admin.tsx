import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { sb, friendly, type Booking } from '../lib/supabase'
import { useI18n, money, fmtDate, fmtTime } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { AdminTabs, Avatar, Icon, LangToggle, Loading, StatusPill, useToast } from '../components/ui'

function useAdminGuard() { const { profile, ready } = useAuth(); return ready && profile?.role !== 'admin' }

type Pay = { id: number; booking_id: number | null; package_id: number | null; amount: number; slip_path: string | null; created_at: string }
type Payout = { payout_id: number; booking_id: number; nickname: string; amount: number; bank_name: string | null; bank_account: string | null; work_date: string }
type Refund = { id: number; booking_id: number; amount: number; points_returned: number }
type Claim = { id: number; booking_id: number; item: string; description: string | null; purchase_price: number | null; purchase_year: number | null; photo_paths: string[]; created_at: string }

function useAdminData() {
  const [d, setD] = useState<{ pays: Pay[]; payouts: Payout[]; refunds: Refund[]; claims: Claim[]; unmatched: Booking[]; month: Booking[]; maidsPending: number; maidsTotal: number } | null>(null)
  const load = async () => {
    const m0 = new Date(); m0.setDate(1); m0.setHours(0, 0, 0, 0)
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

export function AdminHome() {
  const { t, lang } = useI18n(); const { d, reload } = useAdminData(); const toast = useToast()
  if (useAdminGuard()) return <Navigate to="/" />
  if (!d) return <Loading />
  const income = d.month.reduce((a, b) => a + b.total_price - b.maid_payout, 0)
  const todo: [number, string, string, string, string][] = [
    [d.unmatched.length, t('a_unmatched'), t('a_unmatched_d'), 'var(--brick-l)', 'var(--brick)'],
    [d.pays.length, t('a_slips'), '', 'var(--sun-l)', '#8A6200'],
    [d.payouts.length, t('a_payouts'), money(d.payouts.reduce((a, p) => a + p.amount, 0)) + ' ' + t('baht'), '#E1EEF8', 'var(--ocean-d)'],
    [d.refunds.length, t('a_refunds'), money(d.refunds.reduce((a, p) => a + p.amount, 0)) + ' ' + t('baht'), 'var(--brick-l)', 'var(--brick)'],
    [d.claims.length, t('a_claims'), '', 'var(--brick-l)', 'var(--brick)'],
    [d.maidsPending, t('a_newmaids'), '', 'var(--leaf-l)', 'var(--leaf)'],
  ]
  const refundAll = async (b: Booking) => { const { error } = await sb.rpc('admin_refund_unmatched', { p_booking_id: b.id }); toast.show(error ? friendly(error, lang) : t('saved')); reload() }
  return <div className="page">
    <div className="hero tall"><div className="between"><span className="sub">{fmtDate(new Date().toISOString(), lang, { weekday: 'long', day: 'numeric', month: 'short' })}</span><LangToggle /></div><h1>{t('a_title')}</h1></div>
    <div className="pad" style={{ marginTop: -54, position: 'relative', zIndex: 2 }}><div className="kpi"><div className="small">{t('a_income')}</div><div className="v">{money(income)} ฿</div>
      <div className="row small mt8"><span><b>{d.month.length}</b> {t('a_jobs')}</span><span><b>{d.maidsTotal}</b> {t('a_maids')}</span></div></div></div>
    <div className="pad"><div className="sec-title">{t('a_todo')}</div>
      {todo.map(([n, a, b, bg, c]) => <Link key={a} to={a === t('a_newmaids') ? '/admin/maids' : '/admin/money'} className="row" style={{ padding: '11px 0', borderBottom: '1px solid #EDF2F6', color: 'var(--ink)' }}>
        <span className="n" style={{ background: bg, color: c }}>{n}</span><span style={{ flex: 1 }}><b className="disp">{a}</b>{b && <span className="small muted" style={{ display: 'block' }}>{b}</span>}</span><Icon n="next" /></Link>)}
      {d.unmatched.length > 0 && <><div className="sec-title">{t('a_unmatched')}</div>{d.unmatched.map(b => <div key={b.id} className="card between mt8">
        <span><b className="disp">#{b.id} {fmtDate(b.start_at, lang)} {fmtTime(b.start_at)}</b><span className="small muted" style={{ display: 'block' }}>{money(b.total_price)} ฿</span></span>
        <button className="btn sm b-red" onClick={() => refundAll(b)}>{t('a_refund_full')}</button></div>)}</>}
    </div>
    <AdminTabs />{toast.node}
  </div>
}

export function AdminMoney() {
  const { t, lang } = useI18n(); const { d, reload } = useAdminData(); const toast = useToast(); const [sel, setSel] = useState<number[]>([]); const [slipUrl, setSlipUrl] = useState<string | null>(null)
  const [claimAmt, setClaimAmt] = useState<Record<number, string>>({})
  if (useAdminGuard()) return <Navigate to="/" />
  if (!d) return <Loading />
  const run = async (fn: string, args: object) => { const { error } = await sb.rpc(fn, args); toast.show(error ? friendly(error, lang) : t('saved')); reload() }
  const showSlip = async (bucket: string, p: string) => { const { data } = await sb.storage.from(bucket).createSignedUrl(p, 300); setSlipUrl(data?.signedUrl ?? null) }
  return <div className="page">
    <div className="hero"><h1>{t('tab_money')}</h1>
      <div className="small mt8" style={{ color: '#CFE3F2' }}>{t('a_split')}</div>
      <div className="split"><div style={{ flex: 800, background: 'var(--sun)' }} /><div style={{ flex: 700, background: '#fff' }} /></div>
      <div className="between small"><b style={{ color: 'var(--sun)' }}>{t('tab_maids')} 800</b><b>CleenDee 700 (+20)</b></div></div>
    <div className="pad">
      <div className="sec-title">{t('a_slips')}</div>
      {d.pays.length === 0 ? <div className="muted">{t('nothing')}</div> : d.pays.map(p => <div key={p.id} className="card mt8">
        <div className="between"><b className="disp">{p.booking_id ? '#' + p.booking_id : 'Package ' + p.package_id}</b><b className="disp" style={{ fontSize: 19 }}>{money(p.amount)}</b></div>
        <div className="small muted">{fmtDate(p.created_at, lang)} {fmtTime(p.created_at)}</div>
        <div className="row mt8"><button className="btn sm b-line" onClick={() => p.slip_path && showSlip('slips', p.slip_path)}>{t('view_slip')}</button>
          <button className="btn sm b-ocean" style={{ flex: 1 }} onClick={() => run('admin_review_payment', { p_payment_id: p.id, p_approve: true })}>{t('approve')}</button>
          <button className="btn sm b-red" onClick={() => run('admin_review_payment', { p_payment_id: p.id, p_approve: false })}>{t('reject')}</button></div></div>)}

      <div className="between"><div className="sec-title">{t('a_payouts')}</div><button className="link" onClick={() => setSel(d.payouts.map(p => p.payout_id))}>✓ All</button></div>
      {d.payouts.length === 0 ? <div className="muted">{t('nothing')}</div> : d.payouts.map(p => <button key={p.payout_id} className="listrow" style={{ padding: '12px 0' }} onClick={() => setSel(sel.includes(p.payout_id) ? sel.filter(x => x !== p.payout_id) : [...sel, p.payout_id])}>
        <span className={'chk' + (sel.includes(p.payout_id) ? ' on' : '')}>{sel.includes(p.payout_id) && <Icon n="check" size={14} />}</span><Avatar name={p.nickname} size={40} seed={p.nickname} />
        <span style={{ flex: 1 }}><b>{p.nickname}</b><span className="small muted">#{p.booking_id} · {p.bank_name} {p.bank_account}</span></span><b className="disp">{money(p.amount)}</b></button>)}
      {sel.length > 0 && <button className="btn b-sun mt12" onClick={async () => { await run('admin_mark_payouts_done', { p_ids: sel }); setSel([]) }}>{t('a_mark_paid')} {sel.length} ({money(d.payouts.filter(p => sel.includes(p.payout_id)).reduce((a, p) => a + p.amount, 0))} ฿)</button>}

      <div className="sec-title">{t('a_refunds')}</div>
      {d.refunds.length === 0 ? <div className="muted">{t('nothing')}</div> : d.refunds.map(r => <div key={r.id} className="card between mt8"><span><b className="disp">#{r.booking_id}</b> <span className="small muted">{money(r.amount)} ฿{r.points_returned ? ` + ${r.points_returned} pts` : ''}</span></span>
        <button className="btn sm b-line" onClick={() => run('admin_mark_refund_done', { p_id: r.id })}>{t('a_mark_refunded')}</button></div>)}

      <div className="sec-title">{t('a_claims')}</div>
      {d.claims.length === 0 ? <div className="muted">{t('nothing')}</div> : d.claims.map(c => <div key={c.id} className="card mt8 stack">
        <div className="between"><b className="disp">#{c.booking_id}: {c.item}</b><span className="pill p-sun">{fmtDate(c.created_at, lang)}</span></div>
        {c.description && <div className="small">{c.description}</div>}
        <div className="small muted">{c.purchase_price ? money(c.purchase_price) + ' ฿' : ''} {c.purchase_year ? '(' + c.purchase_year + ')' : ''} · {t('a_cap')}</div>
        <div className="row">{c.photo_paths.map((p, i) => <button key={p} className="btn sm b-ghost" onClick={() => showSlip('claims', p)}>📷 {i + 1}</button>)}</div>
        <div className="row"><input className="input" placeholder={t('amount')} inputMode="numeric" value={claimAmt[c.id] ?? ''} onChange={e => setClaimAmt({ ...claimAmt, [c.id]: e.target.value.replace(/\D/g, '') })} />
          <button className="btn sm b-ocean" onClick={() => run('admin_decide_claim', { p_claim_id: c.id, p_approve: true, p_amount: Number(claimAmt[c.id] || 0) })}>{t('approve')}</button>
          <button className="btn sm b-red" onClick={() => run('admin_decide_claim', { p_claim_id: c.id, p_approve: false })}>{t('reject')}</button></div></div>)}
    </div>
    {slipUrl && <div onClick={() => setSlipUrl(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}><img src={slipUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12 }} /></div>}
    <AdminTabs />{toast.node}
  </div>
}

type MaidRow = { id: string; nickname: string; bio: string | null; status: string; id_verified: boolean; background_checked: boolean; created_at: string }
export function AdminMaids() {
  const { t, lang } = useI18n(); const toast = useToast(); const [rows, setRows] = useState<MaidRow[] | null>(null)
  const load = () => sb.from('maids').select('id,nickname,bio,status,id_verified,background_checked,created_at').order('created_at', { ascending: false }).then(({ data }) => setRows(data || []))
  useEffect(() => { load() }, [])
  if (useAdminGuard()) return <Navigate to="/" />
  const set = async (m: MaidRow, patch: Partial<MaidRow>) => { const n = { ...m, ...patch }; const { error } = await sb.rpc('admin_set_maid', { p_maid: m.id, p_status: n.status, p_id_verified: n.id_verified, p_background_checked: n.background_checked }); toast.show(error ? friendly(error, lang) : t('saved')); load() }
  return <div className="page"><div className="hero"><h1>{t('tab_maids')}</h1></div>
    <div className="pad mt12 stack cols">{!rows ? <Loading /> : rows.map(m => <div key={m.id} className="card stack">
      <div className="row"><Avatar name={m.nickname} seed={m.id} size={44} /><span style={{ flex: 1 }}><b className="disp">{m.nickname}</b><span className="small muted" style={{ display: 'block' }}>{m.bio}</span></span>
        <span className={'pill ' + (m.status === 'approved' ? 'p-leaf' : m.status === 'pending' ? 'p-sun' : 'p-brick')}>{m.status}</span></div>
      <div className="chips"><button className={'chip' + (m.id_verified ? ' on' : '')} onClick={() => set(m, { id_verified: !m.id_verified })}>{t('id_ok')}</button>
        <button className={'chip' + (m.background_checked ? ' on' : '')} onClick={() => set(m, { background_checked: !m.background_checked })}>{t('bg_ok')}</button></div>
      <div className="row">{m.status !== 'approved' && <button className="btn sm b-ocean" disabled={!m.id_verified || !m.background_checked} onClick={() => set(m, { status: 'approved' })}>{t('approve')}</button>}
        {m.status !== 'suspended' && <button className="btn sm b-red" onClick={() => set(m, { status: 'suspended' })}>Suspend</button>}</div></div>)}</div>
    <AdminTabs />{toast.node}</div>
}

export function AdminSettings() {
  const { t, lang } = useI18n(); const toast = useToast(); const [id, setId] = useState(''); const [name, setName] = useState('')
  useEffect(() => { sb.from('payment_settings').select('*').maybeSingle().then(({ data }) => { setId(data?.promptpay_id || ''); setName(data?.promptpay_name || '') }) }, [])
  if (useAdminGuard()) return <Navigate to="/" />
  const save = async () => { const { error } = await sb.rpc('admin_set_promptpay', { p_id: id.replace(/\D/g, ''), p_name: name }); toast.show(error ? friendly(error, lang) : t('saved')) }
  return <div className="page"><div className="hero"><div className="between"><h1>{t('tab_settings')}</h1><LangToggle /></div></div>
    <div className="pad mt16 stack">
      <div className="field"><label>{t('a_pp')}</label><input className="input" inputMode="numeric" value={id} onChange={e => setId(e.target.value)} placeholder="08xxxxxxxx / 13 หลัก" /></div>
      <div className="field"><label>{t('a_pp_name')}</label><input className="input" value={name} onChange={e => setName(e.target.value)} /></div>
      <button className="btn b-sun" onClick={save}>{t('save')}</button>
      <Link to="/account" className="btn b-line">{t('account')}</Link>
    </div><AdminTabs />{toast.node}</div>
}
export { StatusPill }
