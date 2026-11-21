import { Arrival } from '../components/Arrival'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { sb, friendly, type Booking } from '../lib/supabase'
import { useI18n, money, fmtDate, fmtTime, type Key } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { bkkToday } from '../lib/draft'
import maidPortrait from '../assets/ill/safety.webp'
import { Avatar, DistrictOptions, Icon, Bell, LangToggle, Loading, MaidTabs, StatusPill, TopBar, useToast } from '../components/ui'
import { Chat, JobProof } from './MyBookings'
import { useServices, useAddons, svcName, svcUnit } from '../lib/services'
import { useDistricts, useServiceAreas } from '../lib/areas'
import { RatingForm } from '../components/Rating'

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

function MaidPhoto({id, name}: {id:string; name:string}) {
  const {lang} = useI18n(); const th = lang === 'th'
  const [url,setUrl] = useState<string | null>(null)
  const [busy,setBusy] = useState(false); const [message,setMessage] = useState('')
  useEffect(() => { sb.from('maids').select('photo_url').eq('id',id).maybeSingle().then(({data}) => setUrl(data?.photo_url ?? null)) },[id])
  const upload = async (file?:File) => {
    if (!file || busy) return
    const formats: Record<string,string> = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}
    if (!formats[file.type] || file.size > 5*1024*1024) {setMessage(th ? 'เลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB' : 'Choose a JPG, PNG or WebP up to 5 MB');return}
    setBusy(true); setMessage('')
    try {
      const bucket = sb.storage.from('avatars')
      const path = id+'/'+crypto.randomUUID()+'.'+formats[file.type]
      const result = await bucket.upload(path,file,{contentType:file.type})
      if (result.error) throw result.error
      const photo = bucket.getPublicUrl(path).data.publicUrl
      const saved = await sb.from('maids').update({photo_url:photo}).eq('id',id).select('id').single()
      if (saved.error) throw saved.error
      setUrl(photo); setMessage(th ? 'บันทึกรูปแล้ว' : 'Photo saved')
    } catch (e) { setMessage(friendly(e,lang)) } finally { setBusy(false) }
  }
  return <div><label className="photo-control"><Avatar name={name} url={url} seed={id} size={54} />
    <span>{busy ? '…' : th ? 'เปลี่ยนรูปโปรไฟล์' : 'Change profile photo'}</span>
    <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => {void upload(e.target.files?.[0]);e.target.value=''}} /></label>
    <small role="status">{message}</small></div>
}

export function MaidHome() {
  const { t, lang } = useI18n(); const { profile } = useAuth(); const { mine, open, payouts, reload } = useMaidData(); const toast = useToast(); const districts = useDistricts()
  const [nick, setNick] = useState('')
  useEffect(() => { if (profile) sb.from('maids').select('nickname').eq('id', profile.id).maybeSingle().then(({ data }) => setNick(data?.nickname || '')) }, [profile])
  // เดือนตามเวลาไทย (Asia/Bangkok, UTC+7)
  const month = bkkToday().slice(0, 7)
  const bkkMonth = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3600e3).toISOString().slice(0, 7)
  const earned = payouts.filter(p => p.status === 'done' && !!p.transferred_at && bkkMonth(p.transferred_at) === month).reduce((a, p) => a + p.amount, 0)
  const pending = payouts.filter(p => p.status === 'pending').reduce((a, p) => a + p.amount, 0)
  const req = (mine || []).filter(b => b.status === 'awaiting_maid')
  const jobs = (mine || []).filter(b => ['confirmed', 'on_the_way', 'working'].includes(b.status))
  const dn = (id: number) => { const d = districts.find(x => x.id === id); return d ? (lang === 'th' ? 'อ.' + d.name_th : d.name_en) : '' }
  const act = async (fn: string, args: object) => { const { error } = await sb.rpc(fn, args); if (error) toast.show(friendly(error, lang)); reload() }
  return <div className="page">
    <div className="hero tall"><div className="between"><span className="sub">{t('hello')}</span><span className="hdr-tools"><Bell /><LangToggle /></span></div><div className="between"><h1>{nick || profile?.full_name}</h1>{profile?.role === 'maid' && <MaidPhoto id={profile.id} name={nick || profile.full_name || 'C'} />}</div></div>
    <div className="pad" style={{ marginTop: -50, position: 'relative', zIndex: 2 }}><div className="earn"><div><span>{t('m_month')}</span><b>{money(earned)} ฿</b></div><div style={{ background: 'var(--sun)' }}><span style={{ color: 'var(--ink)' }}>{t('m_pending')}</span><b>{money(pending)} ฿</b></div></div></div>
    <div className="pad mt16 stack">
      <div className="desk-nav"><a href="#maid-offers">{lang === 'th' ? 'รอตอบรับ' : 'Offers'} <b>{req.length + open.length}</b></a><a href="#maid-active">{t('m_my_jobs')} <b>{jobs.length}</b></a></div>
      <h2 id="maid-offers" className="desk-heading">{lang === 'th' ? 'งานที่รอตอบรับ' : 'Job offers'}</h2>
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
      <h2 id="maid-active" className="desk-heading">{t('m_my_jobs')}</h2>
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
  const [info, setInfo] = useState<{ first_name: string; jobs_done: number; rating: number | null; rating_count: number } | null>(null)
  useEffect(() => { sb.rpc('maid_job_info', { p_booking_id: b.id }).then(({ data }) => setInfo(data)) }, [b.id])
  const svc = services?.find(x => x.id === b.service_type_id)
  const c = dark ? '#D2DEE8' : '#8A3324'
  return <div className="small mt8" style={{ color: c, display: 'block' }}>
    <div><b>{svcName(svc, lang)} {b.qty ?? ''} {svcUnit(svc, lang)}</b>{b.addons?.length ? ' + ' + b.addons.map(x => { const a = addons?.find(y => y.code === x); return a ? (lang === 'th' ? a.name_th : a.name_en) : x }).join(', ') : ''}</div>
    {info && <div>{t('m_customer')}: {info.first_name} · {info.jobs_done > 0 ? t('m_cust_jobs').replace('{n}', String(info.jobs_done)) : t('m_cust_new')}{info.rating_count > 0 && <> · <span aria-label={t('m_cust_rating')}>★ {info.rating} ({info.rating_count})</span></>}</div>}
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
  // ระหว่างกำลังบันทึก ไม่เอาค่าจากการโหลดซ้ำมาทับ และบันทึกตามลำดับโดยส่งรายการล่าสุดทุกครั้ง
  const [list, setList] = useState(base); const latest = useRef(base); const pending = useRef(0); const chain = useRef<Promise<unknown>>(Promise.resolve())
  useEffect(() => { if (!pending.current) { latest.current = base; setList(base) } }, [base])
  const editable = ['confirmed', 'on_the_way', 'working'].includes(b.status)
  const [err, setErr] = useState('')
  const toggle = (i: number) => {
    if (!editable) return
    const n = latest.current.map((x, j) => (j === i ? { ...x, done: !x.done } : x)); latest.current = n; setList(n); pending.current++
    chain.current = chain.current.then(async () => {
      try { const { error } = await sb.rpc('maid_set_checklist', { p_booking_id: b.id, p_checklist: latest.current }); setErr(error ? friendly(error, lang) : '') }
      finally { if (--pending.current === 0) onSaved() }
    }).catch(() => {})
  }
  if (!list.length) return null
  return <><div className="sec-title">{t('checklist')} ({list.filter(x => x.done).length}/{list.length})</div>
    <div className="stack" style={{ gap: 6 }}>{list.map((c, i) => <button key={i} className={'choice' + (c.done ? ' on' : '')} style={{ padding: '10px 12px' }} onClick={() => toggle(i)} disabled={!editable}>
      <span className={'chk' + (c.done ? ' on' : '')}>{c.done && <Icon n="check" size={14} />}</span><span style={{ flex: 1 }}>{c.t}</span></button>)}</div>
    {err && <div className="err mt8">{err}</div>}</>
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
  const [b, setB] = useState<Booking | null>(null); const [addr, setAddr] = useState<{ address: string; lat:number|null; lng:number|null } | null>(null)
  const [rated, setRated] = useState(true); const [custName, setCustName] = useState(''); const [busy, setBusy] = useState(false)
  const load = () => { sb.from('bookings').select('*').eq('id', id!).single().then(({ data }) => setB(data as Booking)); sb.from('customer_reviews').select('id').eq('booking_id', id!).maybeSingle().then(({ data }) => setRated(!!data)); sb.rpc('maid_job_info', { p_booking_id: Number(id) }).then(({ data }) => setCustName(data?.first_name ?? '')); sb.from('booking_addresses').select('address,lat,lng').eq('booking_id', id!).maybeSingle().then(({ data }) => setAddr(data)) }
  useEffect(load, [id])
  useEffect(() => {
    if (b?.status !== 'on_the_way' || !navigator.geolocation) return
    const w = navigator.geolocation.watchPosition(p => { sb.rpc('maid_update_progress', { p_booking_id: b.id, p_step: 'location', p_lat: p.coords.latitude, p_lng: p.coords.longitude }) }, () => {}, { enableHighAccuracy: true, maximumAge: 20000 })
    return () => navigator.geolocation.clearWatch(w)
  }, [b?.status, b?.id])
  if (!b) return <Loading />
  const step = async (s: string) => {
    if (busy) return; setBusy(true)
    try {
      const go = (lat?: number, lng?: number) => sb.rpc('maid_update_progress', { p_booking_id: b.id, p_step: s, p_lat: lat ?? null, p_lng: lng ?? null }).then(({ error }) => { if (error) toast.show(friendly(error, lang)); load() })
      const pos = s === 'on_the_way' && navigator.geolocation ? await new Promise<GeolocationPosition | null>(r => {
        const stop = setTimeout(() => r(null), 10000) // กันกรณีไม่มีคำตอบเรื่องสิทธิ์ตำแหน่ง
        navigator.geolocation.getCurrentPosition(p => { clearTimeout(stop); r(p) }, () => { clearTimeout(stop); r(null) }, { timeout: 8000 })
      }) : null
      await go(pos?.coords.latitude, pos?.coords.longitude)
    } catch (e) { toast.show(friendly(e, lang)) } finally { setBusy(false) }
  }
  const idx = ['confirmed', 'on_the_way', 'working', 'completed'].indexOf(b.status)
  const steps: [Key, Key | null][] = [['m_step1', null], ['m_step2', 'm_step2d'], ['m_step3', null], ['m_step4', null]]
  const next = b.status === 'confirmed' ? ['on_the_way', t('m_start_trip')] : b.status === 'working' ? ['completed', t('m_done')] : null
  return <div className="page nobar">
    <div className="hero"><div className="between"><button className="back" onClick={() => nav('/maid')} aria-label="Back"><Icon n="back" /></button><LangToggle /></div>
      <div className="sub mt12">{fmtDate(b.start_at, lang)} {fmtTime(b.start_at)}–{fmtTime(b.end_at)}</div><h1>{money(b.maid_payout)} {t('baht')}</h1>
      {addr && <div className="sub" style={{ display: 'flex', gap: 6 }}><Icon n="pin" size={16} />{addr.address}</div>}
      {addr?.lat != null && addr.lng != null && <a className="btn b-glass mt8" href={'https://www.google.com/maps/dir/?api=1&destination='+addr.lat+','+addr.lng} target="_blank" rel="noreferrer">{lang === 'th' ? 'เปิดเส้นทางไปบ้านลูกค้า' : 'Get directions'}</a>}</div>
    <div className="pad mt20">
      {steps.map(([k, d], i) => <div key={k} className="sv-step"><div className="rail"><div className={'c' + (i < idx + 1 ? '' : i === idx + 1 ? ' now' : ' off')}>{i <= idx && <Icon n="check" size={15} />}</div>{i < 3 && <div className={'l' + (i < idx + 1 ? '' : ' off')} />}</div>
        <div className="txt"><b style={{ color: i <= idx + 1 ? 'var(--ink)' : 'var(--ink3)' }}>{t(k)}</b>{d && i === idx + 1 && <span className="small muted">{t(d)}</span>}</div></div>)}
      {b.status === 'on_the_way' && <Arrival key={b.id} booking={b} side="helper" reload={load} />}
      <Checklist b={b} onSaved={load} />
      {b.status === 'completed' && !rated && <div className="card mt16"><RatingForm bookingId={b.id} side="maid" name={custName} onDone={() => { setRated(true); toast.show(t('thanks_review')) }} /></div>}
      <JobPhotos b={b} />
      {(b.note || b.tags.length > 0) && <div className="infonote mt16"><Icon n="chat" /><div><b className="disp">{t('m_customer_note')}</b><div>{b.tags.map(x => t(x as Key)).join(' · ')}</div><div>{b.note}</div></div></div>}
      <div className="sec-title">{t('chat')}</div><Chat bookingId={b.id} />
      {b.status === 'confirmed' && <button className="btn b-red mt16" onClick={async () => { if (!window.confirm(t('m_cancel_job') + '?')) return; const { error } = await sb.rpc('maid_cancel_job', { p_booking_id: b.id }); if (error) toast.show(friendly(error, lang)); else nav('/maid') }}>{t('m_cancel_job')}</button>}
    </div>
    {next && <div className="bottom-bar"><button className="btn b-sun" style={{ minHeight: 60, fontSize: 19 }} disabled={busy} onClick={() => step(next[0])}>{busy ? t('loading') : next[1]}</button></div>}
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

const DAYS: [string, string, string][] = [['mon', 'จ.', 'Mon'], ['tue', 'อ.', 'Tue'], ['wed', 'พ.', 'Wed'], ['thu', 'พฤ.', 'Thu'], ['fri', 'ศ.', 'Fri'], ['sat', 'ส.', 'Sat'], ['sun', 'อา.', 'Sun']]
const TIMES: [string, string, string, string][] = [['morning', 'เช้า', 'Morning', '08.00-12.00 น.'], ['afternoon', 'บ่าย', 'Afternoon', '12.00-17.00 น.'], ['evening', 'เย็น', 'Evening', '17.00-20.00 น.']]
const DOC_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }
const toggle = (a: string[], v: string) => (a.includes(v) ? a.filter(x => x !== v) : [...a, v])

// ปุ่มเลือกไฟล์ + แสดงชื่อไฟล์ที่เลือก
function FileField({ label, hint, cta, file, onFile, accept, required }: { label: string; hint?: string; cta?: string; file: File | null; onFile: (f: File | null) => void; accept: string; required?: boolean }) {
  const th = useI18n().lang === 'th'
  const [msg, setMsg] = useState('')
  const pick = (f?: File) => {
    if (!f) return
    if (!DOC_TYPES[f.type] || !accept.includes(f.type) || f.size > 5 * 1024 * 1024) { setMsg(th ? 'ไฟล์ไม่ถูกต้อง หรือใหญ่เกิน 5 MB' : 'Invalid file, or larger than 5 MB'); return }
    setMsg(''); onFile(f)
  }
  return <div className="field"><label>{label}{required && <span style={{ color: 'var(--brick)' }}> *</span>}</label>
    {hint && <small className="muted">{hint}</small>}
    <label className="btn b-line photo-control" style={{ justifyContent: 'flex-start', position: 'relative' }}><Icon n={file ? 'check' : 'plus'} size={18} />
      <span>{file ? file.name : (cta ?? (th ? 'แนบไฟล์' : 'Attach file'))}</span>
      <input type="file" accept={accept} onChange={e => { pick(e.target.files?.[0]); e.target.value = '' }} /></label>
    {msg && <small role="alert" style={{ color: 'var(--brick)' }}>{msg}</small>}</div>
}

export function MaidApply() {
  const { t, lang } = useI18n(); const { session } = useAuth(); const nav = useNavigate(); const { groups } = useServiceAreas(); const services = useServices(); const th = lang === 'th'
  const [f, setF] = useState({ nickname: '', full_name: '', phone: '', line_id: '', birth_date: '', bio: '', experience_years: '', experience_note: '', district_id: 1, bank_name: '', bank_account: '', referee_name: '', referee_phone: '' })
  const [svc, setSvc] = useState<string[]>([]); const [days, setDays] = useState<string[]>([]); const [times, setTimes] = useState<string[]>([]); const [areas, setAreas] = useState<number[]>([])
  const [photo, setPhoto] = useState<File | null>(null); const [idCard, setIdCard] = useState<File | null>(null); const [selfie, setSelfie] = useState<File | null>(null); const [cert, setCert] = useState<File | null>(null)
  const [consent, setConsent] = useState(false); const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(''); const [done, setDone] = useState(false)
  useEffect(() => { if (session) sb.from('maids').select('status').eq('id', session.user.id).maybeSingle().then(({ data }) => data && setDone(true)) }, [session])
  if (!session) return <div className="page nobar"><TopBar title={t('m_apply_t')} /><div className="pad mt20"><Link className="btn b-ocean" to="/login">{t('login')}</Link></div></div>
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const phone = f.phone.replace(/\D/g, ''); const refPhone = f.referee_phone.replace(/\D/g, '')
  const adultBefore = new Date(Date.now() + 7 * 3600e3); adultBefore.setUTCFullYear(adultBefore.getUTCFullYear() - 18)
  const adult = !!f.birth_date && f.birth_date <= adultBefore.toISOString().slice(0, 10) && f.birth_date >= '1930-01-01'
  const ok = !!f.nickname.trim() && !!f.full_name.trim() && /^0\d{8,9}$/.test(phone) && adult && svc.length > 0 && days.length > 0 && !!f.bank_name.trim() && f.bank_account.replace(/\D/g, '').length >= 8
    && !!idCard && !!selfie && consent && (!f.referee_phone || /^0\d{8,9}$/.test(refPhone))
  const up = async (bucket: string, uid: string, name: string, file: File) => {
    const path = `${uid}/${name}-${crypto.randomUUID()}.${DOC_TYPES[file.type]}`
    const r = await sb.storage.from(bucket).upload(path, file, { contentType: file.type }); if (r.error) throw r.error
    return path
  }
  const submit = async () => {
    if (!ok || busy || !idCard || !selfie) return
    setBusy(true); setErr('')
    try {
      const uid = session.user.id
      let photo_url: string | undefined
      if (photo) { const pth = await up('avatars', uid, 'profile', photo); photo_url = sb.storage.from('avatars').getPublicUrl(pth).data.publicUrl }
      const id_card_path = await up('maid-docs', uid, 'id-card', idCard); const selfie_path = await up('maid-docs', uid, 'selfie', selfie)
      const conduct_cert_path = cert ? await up('maid-docs', uid, 'conduct', cert) : null
      const { error } = await sb.from('maids').insert({
        id: uid, nickname: f.nickname.trim(), bio: f.bio.trim() || null, district_id: f.district_id, bank_name: f.bank_name.trim(), bank_account: f.bank_account.replace(/\D/g, ''),
        ...(photo_url ? { photo_url } : {}),
        full_name: f.full_name.trim(), phone, line_id: f.line_id.trim() || null, birth_date: f.birth_date,
        experience_years: f.experience_years === '' ? null : Number(f.experience_years), experience_note: f.experience_note.trim() || null,
        applied_services: svc, available_days: days, available_times: times, service_districts: [...new Set([f.district_id, ...areas])],
        referee_name: f.referee_name.trim() || null, referee_phone: refPhone || null, id_card_path, selfie_path, conduct_cert_path, consent_at: new Date().toISOString(),
      })
      if (error) throw error
      setDone(true)
    } catch (e) { setErr(friendly(e, lang)) } finally { setBusy(false) }
  }
  const star = <span style={{ color: 'var(--brick)' }}> *</span>
  const text = (k: keyof typeof f, label: string, o: { req?: boolean; type?: string; mode?: 'numeric' | 'tel'; ph?: string } = {}) =>
    <div className="field"><label>{label}{o.req && star}</label><input className="input" type={o.type} inputMode={o.mode} placeholder={o.ph} value={f[k] as string} onChange={set(k)} /></div>
  const chips = (items: [string, string, string][], sel: string[], on: (v: string) => void) => <div className="chips">{items.map(([k, a, b]) => <button type="button" key={k} className={'chip' + (sel.includes(k) ? ' on' : '')} onClick={() => on(k)}>{th ? a : b}</button>)}</div>
  const activeSvc = (services || []).filter(s => s.active)
  return <div className="page nobar"><TopBar title={t('m_apply_t')} />
    {done ? <div className="pad mt20"><div className="ok-note"><Icon n="check" />{t('m_wait')}</div><button className="btn b-ghost mt16" onClick={() => nav('/')}>{t('tab_home')}</button></div> :
      <div className="pad mt16 stack"><header className="join-banner"><div><h2>{th ? 'ร่วมงานกับ CleenDee' : 'Work with CleenDee'}</h2><p>{t('m_apply_d')}</p></div><img src={maidPortrait} alt="" /></header>
        <p className="admin-hint">{th ? 'ช่อง * จำเป็นต้องกรอก ใช้เวลาประมาณ 5 นาที เตรียมบัตรประชาชนและสมุดบัญชีไว้ได้เลย' : 'Fields marked * are required. About 5 minutes — have your ID card and bank details ready.'}</p>

        <section className="card apply-sec"><h3>{th ? '1. ข้อมูลส่วนตัว' : '1. About you'}</h3><div className="apply-grid">
          {text('full_name', th ? 'ชื่อ-นามสกุลจริง' : 'Full name', { req: true, ph: th ? 'ตามบัตรประชาชน' : 'As on ID card' })}
          {text('nickname', t('m_nick'), { req: true })}
          {text('phone', th ? 'เบอร์โทรศัพท์' : 'Phone number', { req: true, type: 'tel', mode: 'tel', ph: '08xxxxxxxx' })}
          {text('line_id', 'LINE ID')}
          <div className="field"><label>{th ? 'วันเกิด (อายุ 18 ปีขึ้นไป)' : 'Date of birth (18+)'}{star}</label>
            <input className="input" type="date" min="1930-01-01" max={adultBefore.toISOString().slice(0, 10)} value={f.birth_date} onChange={set('birth_date')} />
            {f.birth_date && !adult && <small role="alert" style={{ color: 'var(--brick)' }}>{th ? 'ผู้สมัครต้องมีอายุ 18 ปีขึ้นไป' : 'Applicants must be 18 or older'}</small>}</div>
          <FileField label={th ? 'รูปโปรไฟล์' : 'Profile photo'} cta={th ? 'แนบรูปหน้าตรง' : 'Add photo'} file={photo} onFile={setPhoto} accept="image/jpeg,image/png,image/webp" />
        </div></section>

        <section className="card apply-sec"><h3>{th ? '2. ประสบการณ์และงานที่ทำได้' : '2. Experience and services'}</h3><div className="apply-grid">
          <div className="field span2"><label>{th ? 'บริการที่ทำได้' : 'Services you can do'}{star}</label>
            <div className="chips eq">{activeSvc.map(s => <button type="button" key={s.code} className={'chip' + (svc.includes(s.code) ? ' on' : '')} onClick={() => setSvc(toggle(svc, s.code))}>{svcName(s, lang)}</button>)}</div></div>
          <div className="field"><label>{th ? 'ประสบการณ์' : 'Experience'}</label>
            <select className="input" value={f.experience_years} onChange={set('experience_years')}><option value="">{th ? 'เลือก' : 'Select'}</option><option value="0">{th ? 'ยังไม่มี' : 'None yet'}</option><option value="1">{th ? 'น้อยกว่า 1 ปี' : 'Under 1 year'}</option><option value="2">{th ? '1-3 ปี' : '1-3 years'}</option><option value="5">{th ? 'มากกว่า 3 ปี' : 'Over 3 years'}</option></select></div>
          {text('bio', t('m_bio'))}
          <div className="field span2"><label>{th ? 'เคยทำงานที่ไหนมาบ้าง' : 'Where have you worked'}</label><textarea className="input" value={f.experience_note} onChange={set('experience_note')} placeholder={th ? 'เช่น แม่บ้านโรงแรม รับจ้างทำความสะอาดบ้าน' : 'e.g. hotel housekeeping, home cleaning'} /></div>
        </div></section>

        <section className="card apply-sec"><h3>{th ? '3. วันเวลาและพื้นที่ที่รับงาน' : '3. When and where'}</h3><div className="apply-grid">
          <div className="span2 apply-pair">
            <div className="field"><label>{th ? 'วันที่ว่างทำงาน' : 'Days available'}{star}</label>
              <div className="chips days">{DAYS.map(([k, a, b]) => <button type="button" key={k} className={'chip' + (days.includes(k) ? ' on' : '')} onClick={() => setDays(toggle(days, k))}>{th ? a : b}</button>)}</div></div>
            <div className="field"><label>{th ? 'ช่วงเวลาที่สะดวก' : 'Times available'}</label>
              <div className="chips times">{TIMES.map(([k, a, b, r]) => <button type="button" key={k} className={'chip time' + (times.includes(k) ? ' on' : '')} onClick={() => setTimes(toggle(times, k))}><b>{th ? a : b}</b><small>{th ? r : r.replace(/\./g, ':').replace(' น:', '')}</small></button>)}</div></div></div>
          <div className="field span2"><label>{th ? 'อำเภอหลักที่รับงาน' : 'Main district'}{star}</label><select className="input" value={f.district_id} onChange={e => setF({ ...f, district_id: Number(e.target.value) })}><DistrictOptions groups={groups} /></select></div>
          <div className="field span2"><label>{th ? 'อำเภออื่นที่ไปทำงานได้ด้วย (ถ้ามี)' : 'Other districts you can travel to (optional)'}</label>
            {groups.map(g => <div key={g.province.code}>{groups.length > 1 && <div className="small muted mt8">{th ? 'จ.' + g.province.name_th : g.province.name_en}</div>}
              <div className="chips eq">{g.districts.filter(d => d.id !== f.district_id).map(d => <button type="button" key={d.id} className={'chip' + (areas.includes(d.id) ? ' on' : '')} onClick={() => setAreas(areas.includes(d.id) ? areas.filter(x => x !== d.id) : [...areas, d.id])}>{th ? d.name_th : d.name_en}</button>)}</div></div>)}</div>
        </div></section>

        <section className="card apply-sec"><h3>{th ? '4. เอกสารยืนยันตัวตน' : '4. Identity documents'}</h3>
          <p className="admin-hint">{th ? 'ใช้ตรวจสอบก่อนอนุมัติเท่านั้น เก็บเป็นความลับ เห็นได้เฉพาะแอดมิน' : 'Used only for verification. Kept private and visible to admins only.'}</p><div className="apply-grid">
          <FileField required label={th ? 'รูปบัตรประชาชน' : 'ID card photo'} cta={th ? 'แนบรูปบัตร' : 'Add ID photo'} file={idCard} onFile={setIdCard} accept="image/jpeg,image/png,image/webp" />
          <FileField required label={th ? 'เซลฟี่คู่บัตร' : 'Selfie with ID'} cta={th ? 'ถ่ายเซลฟี่' : 'Take selfie'} file={selfie} onFile={setSelfie} accept="image/jpeg,image/png,image/webp" />
          <div className="span2"><FileField label={th ? 'ใบรับรองความประพฤติ (ถ้ามี)' : 'Certificate of good conduct (optional)'} hint={th ? 'รูปหรือ PDF ไม่เกิน 5 MB' : 'Photo or PDF up to 5 MB'} cta={th ? 'แนบไฟล์ใบรับรอง' : 'Attach certificate'} file={cert} onFile={setCert} accept="image/jpeg,image/png,image/webp,application/pdf" /></div>
        </div></section>

        <section className="card apply-sec"><h3>{th ? '5. ผู้แนะนำ (ถ้ามี)' : '5. Reference (optional)'}</h3><div className="apply-grid">
          {text('referee_name', th ? 'ชื่อผู้แนะนำ' : 'Reference name')}
          {text('referee_phone', th ? 'เบอร์โทรผู้แนะนำ' : 'Reference phone', { type: 'tel', mode: 'tel' })}
        </div></section>

        <section className="card apply-sec"><h3>{th ? '6. บัญชีรับเงิน' : '6. Bank account'}</h3><div className="apply-grid">
          {text('bank_name', t('m_bank_name'), { req: true })}
          {text('bank_account', t('m_bank_acc'), { req: true, mode: 'numeric' })}
        </div></section>

        <label className="row" style={{ alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ width: 22, height: 22, marginTop: 3, flex: 'none' }} />
          <span className="small">{th ? 'ข้าพเจ้ายืนยันว่าข้อมูลเป็นความจริง ยินยอมให้ CleenDee เก็บและใช้ข้อมูลส่วนบุคคลและเอกสารนี้เพื่อตรวจสอบตัวตนและประวัติก่อนอนุมัติ และให้ติดต่อผู้แนะนำที่ระบุไว้' : 'I confirm the information is true and consent to CleenDee storing and using my personal data and documents to verify my identity and background, and to contacting the reference listed.'}{star}</span></label>
        {err && <div className="err" role="alert">{err}</div>}
        <button className="btn b-sun" disabled={!ok || busy} onClick={submit}>{busy ? (th ? 'กำลังส่งใบสมัคร…' : 'Submitting…') : t('m_submit')}</button>
        {!ok && <small className="muted" style={{ textAlign: 'center' }}>{th ? 'กรอกช่อง * ให้ครบ แนบรูปบัตรและเซลฟี่ และติ๊กยอมรับ จึงจะส่งได้' : 'Complete the * fields, attach ID and selfie, and accept to submit.'}</small>}
      </div>}
  </div>
}
