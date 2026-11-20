import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { sb, friendly, type Booking } from '../lib/supabase'
import { useI18n, money, fmtDate, fmtTime, type Key } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { bkkToday } from '../lib/draft'
import { Icon, LangToggle, Loading, MaidTabs, StatusPill, TopBar, useToast } from '../components/ui'
import { Chat, JobProof } from './MyBookings'
import { useServices, useAddons, svcName, svcUnit } from '../lib/services'
import { useDistricts } from './Start'

function useMaidData() {
  const { session } = useAuth(); const [mine, setMine] = useState<Booking[] | null>(null); const [open, setOpen] = useState<Booking[]>([])
  const [payouts, setPayouts] = useState<{ amount: number; status: string; transferred_at: string | null; booking_id: number }[]>([])
  const load = async () => {
    if (!session) return
    sb.from('bookings').select('*').eq('maid_id', session.user.id).order('start_at').then(({ data }) => setMine((data as Booking[]) || []))
    const [{ data: me }, { data: st }] = await Promise.all([sb.from('maids').select('services').eq('id', session.user.id).maybeSingle(), sb.from('service_types').select('id,code')])
    const ok = new Set((st || []).filter(x => (me?.services || []).includes(x.code)).map(x => x.id))
    sb.from('bookings').select('*').is('maid_id', null).eq('needs_replacement', true).eq('status', 'awaiting_maid').order('start_at').then(({ data }) => setOpen(((data as Booking[]) || []).filter(b => ok.has(b.service_type_id))))
    sb.from('payouts').select('amount,status,transferred_at,booking_id').eq('maid_id', session.user.id).then(({ data }) => setPayouts(data || []))
  }
  useEffect(() => { load(); const iv = setInterval(load, 20000); return () => clearInterval(iv) }, [session])
  return { mine, open, payouts, reload: load }
}

export function MaidHome() {
  const { t, lang } = useI18n(); const { profile } = useAuth(); const { mine, open, payouts, reload } = useMaidData(); const toast = useToast(); const districts = useDistricts()
  const [nick, setNick] = useState('')
  useEffect(() => { if (profile) sb.from('maids').select('nickname').eq('id', profile.id).maybeSingle().then(({ data }) => setNick(data?.nickname || '')) }, [profile])
  const month = new Date().toISOString().slice(0, 7)
  const earned = payouts.filter(p => p.status === 'done' && (p.transferred_at || '').startsWith(month)).reduce((a, p) => a + p.amount, 0)
  const pending = payouts.filter(p => p.status === 'pending').reduce((a, p) => a + p.amount, 0)
  const req = (mine || []).filter(b => b.status === 'awaiting_maid')
  const jobs = (mine || []).filter(b => ['confirmed', 'on_the_way', 'working'].includes(b.status))
  const dn = (id: number) => { const d = districts.find(x => x.id === id); return d ? (lang === 'th' ? 'อ.' + d.name_th : d.name_en) : '' }
  const act = async (fn: string, args: object) => { const { error } = await sb.rpc(fn, args); if (error) toast.show(friendly(error, lang)); reload() }
  return <div className="page">
    <div className="hero tall"><div className="between"><span className="sub">{t('hello')}</span><LangToggle /></div><h1>{nick || profile?.full_name}</h1></div>
    <div className="pad" style={{ marginTop: -50, position: 'relative', zIndex: 2 }}><div className="earn"><div><span>{t('m_month')}</span><b>{money(earned)} ฿</b></div><div style={{ background: 'var(--sun)' }}><span style={{ color: 'var(--ink)' }}>{t('m_pending')}</span><b>{money(pending)} ฿</b></div></div></div>
    <div className="pad mt16 stack">
      {open.map(b => <div key={b.id} className="urgent"><span className="rico" style={{ background: '#fff', color: 'var(--brick)' }}><Icon n="clock" /></span>
        <span style={{ flex: 1 }}><b className="disp">{t('m_urgent')} {fmtDate(b.start_at, lang)} {fmtTime(b.start_at)}</b><span className="small" style={{ display: 'block', color: '#8A3324' }}>{dn(b.district_id)} · {money(b.maid_payout)} ฿</span><JobInfo b={b} dark={false} /></span>
        <button className="btn sm b-red" onClick={() => act('maid_take_job', { p_booking_id: b.id })}>{t('m_take')}</button></div>)}
      {req.map(b => <div key={b.id} className="newjob">
        <span className="pill" style={{ background: 'var(--sun)', color: 'var(--ink)' }}>{t('m_new')}</span>
        <div className="mt8" style={{ color: '#AFC3D3' }}>{t('m_youget')}</div><div className="big">{money(b.maid_payout)} {t('baht')}</div>
        <div className="r mt8"><Icon n="clock" style={{ color: '#8FB0CA' }} />{fmtDate(b.start_at, lang)} {fmtTime(b.start_at)}–{fmtTime(b.end_at)}</div>
        <div className="r"><Icon n="pin" style={{ color: '#8FB0CA' }} />{dn(b.district_id)} {b.tags.map(x => t(x as Key)).join(' · ')}</div>
        <JobInfo b={b} dark />
        <div className="row mt12"><button className="btn b-sun" style={{ flex: 2 }} onClick={() => act('maid_respond', { p_booking_id: b.id, p_accept: true })}>{t('m_accept')}</button>
          <button className="btn b-dark2" style={{ flex: 1 }} onClick={() => act('maid_respond', { p_booking_id: b.id, p_accept: false })}>{t('m_reject')}</button></div></div>)}
      {open.length === 0 && req.length === 0 && <div className="empty muted">{t('m_no_jobs')}</div>}
      <div className="sec-title">{t('m_my_jobs')}</div>
      {!mine ? <Loading /> : jobs.length === 0 ? <div className="muted">{t('nothing')}</div> : jobs.map(b => <Link key={b.id} to={'/maid/job/' + b.id} className="card row" style={{ color: 'var(--ink)' }}>
        <div style={{ width: 56, textAlign: 'center', background: 'var(--foam)', borderRadius: 14, padding: '6px 0' }}><div className="tiny muted">{fmtDate(b.start_at, lang, { weekday: 'short' })}</div><b className="disp" style={{ fontSize: 21 }}>{fmtDate(b.start_at, lang, { day: 'numeric' })}</b></div>
        <span style={{ flex: 1 }}><b className="disp">{fmtTime(b.start_at)}–{fmtTime(b.end_at)}</b><span className="small muted" style={{ display: 'block' }}>{dn(b.district_id)}</span></span><StatusPill s={b.status} /></Link>)}
    </div>
    <MaidTabs />{toast.node}
  </div>
}

// ข้อมูลที่แม่บ้านเห็นก่อนรับงาน: ชื่อลูกค้า ประวัติการจอง บริการ งานเสริม โน้ต (ไม่มีเบอร์และที่อยู่เต็ม)
function JobInfo({ b, dark }: { b: Booking; dark: boolean }) {
  const { t, lang } = useI18n(); const services = useServices(); const addons = useAddons()
  const [info, setInfo] = useState<{ first_name: string; jobs_done: number } | null>(null)
  useEffect(() => { sb.rpc('maid_job_info', { p_booking_id: b.id }).then(({ data }) => setInfo(data)) }, [b.id])
  const svc = services?.find(x => x.id === b.service_type_id)
  const c = dark ? '#D2DEE8' : '#8A3324'
  return <div className="small mt8" style={{ color: c, display: 'block' }}>
    <div><b>{svcName(svc, lang)} {b.qty ?? ''} {svcUnit(svc, lang)}</b>{b.addons?.length ? ' + ' + b.addons.map(x => { const a = addons?.find(y => y.code === x); return a ? (lang === 'th' ? a.name_th : a.name_en) : x }).join(', ') : ''}</div>
    {info && <div>{t('m_customer')}: {info.first_name} · {info.jobs_done > 0 ? t('m_cust_jobs').replace('{n}', String(info.jobs_done)) : t('m_cust_new')}</div>}
    {b.note && <div>“{b.note}”</div>}
  </div>
}

// เช็กลิสต์งาน: เริ่มจากรายการที่บริการรวมไว้ + งานเสริม + สิ่งที่ลูกค้าเลือก
function Checklist({ b, onSaved }: { b: Booking; onSaved: () => void }) {
  const { t, lang } = useI18n(); const services = useServices(); const addons = useAddons()
  const svc = services?.find(x => x.id === b.service_type_id)
  const base = useMemo(() => {
    if (b.checklist?.length) return b.checklist
    const items = [...(lang === 'th' ? svc?.included_th ?? [] : svc?.included_en ?? []),
      ...(b.addons || []).map(x => { const a = addons?.find(y => y.code === x); return a ? (lang === 'th' ? a.name_th : a.name_en) : x }),
      ...b.tags.filter(x => x === 'tag_bath' || x === 'tag_kitchen').map(x => t(x as Key))]
    return items.map(x => ({ t: x, done: false }))
  }, [b.checklist, svc, addons, lang])
  const [list, setList] = useState(base); useEffect(() => setList(base), [base])
  const editable = ['confirmed', 'on_the_way', 'working'].includes(b.status)
  const toggle = async (i: number) => {
    if (!editable) return
    const n = list.map((x, j) => (j === i ? { ...x, done: !x.done } : x)); setList(n)
    await sb.rpc('maid_set_checklist', { p_booking_id: b.id, p_checklist: n }); onSaved()
  }
  if (!list.length) return null
  return <><div className="sec-title">{t('checklist')} ({list.filter(x => x.done).length}/{list.length})</div>
    <div className="stack" style={{ gap: 6 }}>{list.map((c, i) => <button key={i} className={'choice' + (c.done ? ' on' : '')} style={{ padding: '10px 12px' }} onClick={() => toggle(i)} disabled={!editable}>
      <span className={'chk' + (c.done ? ' on' : '')}>{c.done && <Icon n="check" size={14} />}</span><span style={{ flex: 1 }}>{c.t}</span></button>)}</div></>
}

// แนบรูปก่อน/หลังทำงาน
function JobPhotos({ b }: { b: Booking }) {
  const { t, lang } = useI18n(); const toast = useToast(); const [busy, setBusy] = useState(false); const [k, setK] = useState(0)
  const up = async (kind: 'before' | 'after', files: FileList | null) => {
    if (!files?.length) return; setBusy(true)
    try {
      for (const f of [...files].slice(0, 6)) {
        const path = `${b.id}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${f.name.split('.').pop() || 'jpg'}`
        const r = await sb.storage.from('job-photos').upload(path, f); if (r.error) throw r.error
        const { error } = await sb.rpc('maid_add_photo', { p_booking_id: b.id, p_kind: kind, p_path: path }); if (error) throw error
      }
      toast.show(t('saved')); setK(k + 1)
    } catch (e) { toast.show(friendly(e, lang)) } finally { setBusy(false) }
  }
  if (!['on_the_way', 'working', 'completed'].includes(b.status)) return null
  return <><div className="sec-title">{t('job_photos')}</div><div className="small muted">{t('job_photos_d')}</div>
    <div className="row mt8">{(['before', 'after'] as const).map(kind => <label key={kind} className="btn b-line" style={{ flex: 1, cursor: 'pointer', opacity: busy ? .5 : 1 }}><Icon n="camera" />{t(kind === 'before' ? 'photo_before' : 'photo_after')}
      <input type="file" accept="image/*" capture="environment" multiple hidden disabled={busy} onChange={e => up(kind, e.target.files)} /></label>)}</div>
    <div className="mt8"><JobProof b={b} photosOnly refreshKey={k} /></div>{toast.node}</>
}

export function MaidJob() {
  const { id } = useParams(); const { t, lang } = useI18n(); const nav = useNavigate(); const toast = useToast()
  const [b, setB] = useState<Booking | null>(null); const [addr, setAddr] = useState<{ address: string } | null>(null)
  const load = () => { sb.from('bookings').select('*').eq('id', id!).single().then(({ data }) => setB(data as Booking)); sb.from('booking_addresses').select('address').eq('booking_id', id!).maybeSingle().then(({ data }) => setAddr(data)) }
  useEffect(load, [id])
  useEffect(() => {
    if (b?.status !== 'on_the_way' || !navigator.geolocation) return
    const w = navigator.geolocation.watchPosition(p => { sb.rpc('maid_update_progress', { p_booking_id: b.id, p_step: 'location', p_lat: p.coords.latitude, p_lng: p.coords.longitude }) }, () => {}, { enableHighAccuracy: true, maximumAge: 20000 })
    return () => navigator.geolocation.clearWatch(w)
  }, [b?.status, b?.id])
  if (!b) return <Loading />
  const step = async (s: string) => {
    const go = (lat?: number, lng?: number) => sb.rpc('maid_update_progress', { p_booking_id: b.id, p_step: s, p_lat: lat ?? null, p_lng: lng ?? null }).then(({ error }) => { if (error) toast.show(friendly(error, lang)); load() })
    if (s === 'on_the_way' && navigator.geolocation) navigator.geolocation.getCurrentPosition(p => go(p.coords.latitude, p.coords.longitude), () => go(), { timeout: 8000 })
    else go()
  }
  const idx = ['confirmed', 'on_the_way', 'working', 'completed'].indexOf(b.status)
  const steps: [Key, Key | null][] = [['m_step1', null], ['m_step2', 'm_step2d'], ['m_step3', null], ['m_step4', null]]
  const next = b.status === 'confirmed' ? ['on_the_way', t('m_start_trip')] : b.status === 'on_the_way' ? ['working', t('m_arrived')] : b.status === 'working' ? ['completed', t('m_done')] : null
  return <div className="page nobar">
    <div className="hero"><div className="between"><button className="back" onClick={() => nav('/maid')} aria-label="Back"><Icon n="back" /></button><LangToggle /></div>
      <div className="sub mt12">{fmtDate(b.start_at, lang)} {fmtTime(b.start_at)}–{fmtTime(b.end_at)}</div><h1>{money(b.maid_payout)} {t('baht')}</h1>
      {addr && <div className="sub" style={{ display: 'flex', gap: 6 }}><Icon n="pin" size={16} />{addr.address}</div>}</div>
    <div className="pad mt20">
      {steps.map(([k, d], i) => <div key={k} className="sv-step"><div className="rail"><div className={'c' + (i < idx + 1 ? '' : i === idx + 1 ? ' now' : ' off')}>{i <= idx && <Icon n="check" size={15} />}</div>{i < 3 && <div className={'l' + (i < idx + 1 ? '' : ' off')} />}</div>
        <div className="txt"><b style={{ color: i <= idx + 1 ? 'var(--ink)' : 'var(--ink3)' }}>{t(k)}</b>{d && i === idx + 1 && <span className="small muted">{t(d)}</span>}</div></div>)}
      <Checklist b={b} onSaved={load} />
      <JobPhotos b={b} />
      {(b.note || b.tags.length > 0) && <div className="infonote mt16"><Icon n="chat" /><div><b className="disp">{t('m_customer_note')}</b><div>{b.tags.map(x => t(x as Key)).join(' · ')}</div><div>{b.note}</div></div></div>}
      <div className="sec-title">{t('chat')}</div><Chat bookingId={b.id} />
      {b.status === 'confirmed' && <button className="btn b-red mt16" onClick={async () => { if (!window.confirm(t('m_cancel_job') + '?')) return; const { error } = await sb.rpc('maid_cancel_job', { p_booking_id: b.id }); if (error) toast.show(friendly(error, lang)); else nav('/maid') }}>{t('m_cancel_job')}</button>}
    </div>
    {next && <div className="bottom-bar"><button className="btn b-sun" style={{ minHeight: 60, fontSize: 19 }} onClick={() => step(next[0])}>{next[1]}</button></div>}
    {toast.node}
  </div>
}

type Av = { id?: number; work_date: string; start_time: string; end_time: string }
export function MaidAvailability() {
  const { t, lang } = useI18n(); const { session } = useAuth(); const toast = useToast()
  const days = useMemo(() => Array.from({ length: 21 }, (_, i) => bkkToday(i)), [])
  const [rows, setRows] = useState<Record<string, Av>>({}); const [booked, setBooked] = useState<Booking[]>([])
  const load = () => {
    if (!session) return
    sb.from('maid_availability').select('*').eq('maid_id', session.user.id).gte('work_date', days[0]).then(({ data }) => setRows(Object.fromEntries((data as Av[] || []).map(r => [r.work_date, r]))))
    sb.from('bookings').select('*').eq('maid_id', session.user.id).in('status', ['awaiting_maid', 'confirmed', 'on_the_way', 'working', 'payment_review', 'pending_payment']).then(({ data }) => setBooked((data as Booking[]) || []))
  }
  useEffect(load, [session])
  const toggle = async (d: string) => {
    if (rows[d]) { const { error } = await sb.from('maid_availability').delete().eq('maid_id', session!.user.id).eq('work_date', d); if (error) toast.show(friendly(error, lang)) }
    else { const { error } = await sb.from('maid_availability').insert({ maid_id: session!.user.id, work_date: d, start_time: '07:00', end_time: '18:00' }); if (error) toast.show(friendly(error, lang)) }
    load()
  }
  const setTime = async (d: string, f: 'start_time' | 'end_time', v: string) => {
    const r = { ...rows[d], [f]: v }; if (Number(r.end_time.slice(0, 2)) - Number(r.start_time.slice(0, 2)) < 6) { toast.show('≥ 6 ชม. / 6h+'); return }
    const { error } = await sb.from('maid_availability').update({ [f]: v }).eq('maid_id', session!.user.id).eq('work_date', d); if (error) toast.show(friendly(error, lang)); load()
  }
  const hours = Array.from({ length: 16 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`)
  return <div className="page">
    <div className="hero"><h1>{t('m_avail')}</h1><p>{t('m_avail_d')}</p></div>
    <div className="pad">{days.map(d => { const r = rows[d]; const bk = booked.filter(b => new Date(b.start_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }) === d)
      return <div key={d} className="dayrow">
        <div style={{ width: 52 }} className="disp"><div className="tiny muted">{fmtDate(d + 'T12:00:00+07:00', lang, { weekday: 'short' })}</div><b style={{ fontSize: 20 }}>{Number(d.slice(8))}</b></div>
        <div style={{ flex: 1 }}>{r ? <div className="row" style={{ gap: 6 }}>
          <select className="timesel" value={r.start_time.slice(0, 5)} onChange={e => setTime(d, 'start_time', e.target.value)}>{hours.map(h => <option key={h}>{h}</option>)}</select>–
          <select className="timesel" value={r.end_time.slice(0, 5)} onChange={e => setTime(d, 'end_time', e.target.value)}>{hours.map(h => <option key={h}>{h}</option>)}</select></div>
          : <b className="disp" style={{ color: 'var(--ink3)' }}>{t('m_off')}</b>}
          {bk.map(b => <div key={b.id} className="tiny" style={{ color: '#8A6200' }}>{fmtTime(b.start_at)}–{fmtTime(b.end_at)} ✓</div>)}</div>
        <button className={'sw' + (r ? ' on' : '')} onClick={() => toggle(d)} aria-label={d} disabled={bk.length > 0 && !!r} /></div> })}</div>
    <MaidTabs />{toast.node}
  </div>
}

export function MaidIncome() {
  const { t, lang } = useI18n(); const { payouts } = useMaidData(); const [bank, setBank] = useState<{ bank_name: string; bank_account: string } | null>(null)
  useEffect(() => { sb.rpc('my_bank').then(({ data }) => setBank((data as { bank_name: string; bank_account: string }[])?.[0] ?? null)) }, [])
  return <div className="page"><div className="hero"><h1>{t('m_income')}</h1>{bank && <p>{t('m_bank')}: {bank.bank_name} {bank.bank_account}</p>}</div>
    <div className="mt12">{payouts.length === 0 ? <div className="pad"><div className="empty muted">{t('nothing')}</div></div> : [...payouts].reverse().map((p, i) => <div key={i} className="listrow">
      <span style={{ flex: 1 }}><b>#{p.booking_id}</b><span className="small muted">{p.transferred_at ? fmtDate(p.transferred_at, lang) : ''}</span></span>
      <b className="disp">{money(p.amount)} ฿</b><span className={'pill ' + (p.status === 'done' ? 'p-ocean' : 'p-sun')}>{p.status === 'done' ? t('paid_out') : t('waiting')}</span></div>)}</div>
    <MaidTabs /></div>
}

export function MaidApply() {
  const { t, lang } = useI18n(); const { session } = useAuth(); const nav = useNavigate(); const districts = useDistricts()
  const [f, setF] = useState({ nickname: '', bio: '', district_id: 1, bank_name: '', bank_account: '' }); const [err, setErr] = useState(''); const [done, setDone] = useState(false)
  useEffect(() => { if (session) sb.from('maids').select('status').eq('id', session.user.id).maybeSingle().then(({ data }) => data && setDone(true)) }, [session])
  if (!session) return <div className="page nobar"><TopBar title={t('m_apply_t')} /><div className="pad mt20"><Link className="btn b-ocean" to="/login">{t('login')}</Link></div></div>
  const submit = async () => { const { error } = await sb.from('maids').insert({ id: session.user.id, ...f }); if (error) setErr(friendly(error, lang)); else setDone(true) }
  return <div className="page nobar"><TopBar title={t('m_apply_t')} />
    {done ? <div className="pad mt20"><div className="ok-note"><Icon n="check" />{t('m_wait')}</div><button className="btn b-ghost mt16" onClick={() => nav('/')}>{t('tab_home')}</button></div> :
      <div className="pad mt16 stack"><div className="infonote">{t('m_apply_d')}</div>
        {([['nickname', 'm_nick'], ['bio', 'm_bio'], ['bank_name', 'm_bank_name'], ['bank_account', 'm_bank_acc']] as const).map(([k, l]) =>
          <div key={k} className="field"><label>{t(l)}</label><input className="input" value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} /></div>)}
        <div className="field"><label>{t('district')}</label><select className="input" value={f.district_id} onChange={e => setF({ ...f, district_id: Number(e.target.value) })}>{districts.map(d => <option key={d.id} value={d.id}>{lang === 'th' ? d.name_th : d.name_en}</option>)}</select></div>
        {err && <div className="err">{err}</div>}<button className="btn b-sun" disabled={!f.nickname || !f.bank_account} onClick={submit}>{t('m_submit')}</button></div>}
  </div>
}
