import { Arrival } from '../components/Arrival'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { sb, friendly, type Booking, type Maid, type Service } from '../lib/supabase'
import { useI18n, money, fmtDate, fmtTime, type Key } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { clearDraft, setDraft, emptyDraft, bkkToday, startIso } from '../lib/draft'
import { useServices, useAddons, svcName, svcUnit } from '../lib/services'
import { AdminTabs, Avatar, CustomerTabs, Icon, Loading, MaidTabs, StatusPill, TopBar, useToast } from '../components/ui'
import { useMaids, useBlockedMaids, AddressForm, useAddresses } from './Book'
import { CountUp, confetti, relTime, useMinuteTick } from '../lib/fx'
import { useTheme } from '../lib/theme'
import { RatingForm } from '../components/Rating'

function ThemePicker() {
  const { lang } = useI18n()
  const { mode, setMode } = useTheme()
  const labels = lang === 'th' ? ['ตามอุปกรณ์', 'สว่าง', 'มืด'] : ['Device', 'Light', 'Dark']
  return <div className="listrow"><div><b>{lang === 'th' ? 'รูปแบบการแสดงผล' : 'Appearance'}</b>
    <div className="chips mt8">{(['system','light','dark'] as const).map((option,i) =>
      <button key={option} aria-pressed={mode === option} className={'chip' + (mode === option ? ' on' : '')} onClick={() => setMode(option)}>{labels[i]}</button>)}</div></div></div>
}

const ACTIVE = ['pending_payment', 'payment_review', 'awaiting_maid', 'confirmed', 'on_the_way', 'working', 'payment_rejected']

export function useMyBookings() {
  const { session } = useAuth(); const [b, setB] = useState<Booking[] | null>(null)
  const load = () => { if (session) sb.from('bookings').select('*').eq('customer_id', session.user.id).order('start_at').then(({ data }) => setB((data as Booking[]) || [])) }
  useEffect(load, [session])
  return { list: b, reload: load }
}

// แม่บ้านของการจองของฉันทุกคน (รวมคนที่ถูกระงับแล้ว) ใช้แสดงชื่อ/รูปในงานเดิม
type Helper = Pick<Maid, 'id' | 'nickname' | 'photo_url'>
function useBookingHelpers() {
  const { session } = useAuth(); const [h, setH] = useState<Helper[]>([])
  useEffect(() => { if (session) sb.rpc('my_booking_helpers').then(({ data }) => setH((data as Helper[]) || [])) }, [session])
  return h
}

export function Bookings() {
  const { t, lang } = useI18n(); const nav = useNavigate(); const { session } = useAuth(); const { list } = useMyBookings(); const maids = useMaids(); const helpers = useBookingHelpers(); const services = useServices()
  const [tab, setTab] = useState<'up' | 'hist'>('up')
  if (!session) return <div className="page"><div className="hero"><h1>{t('my_bookings')}</h1></div><div className="pad mt20"><Link className="btn b-ocean" to="/login">{t('login')}</Link></div><CustomerTabs /></div>
  const rows = (list || []).filter(b => (tab === 'up') === ACTIVE.includes(b.status))
  if (tab === 'hist') rows.reverse()
  return <div className="page">
    <div className="hero"><h1>{t('my_bookings')}</h1>
      <div className="seg mt12"><button className={tab === 'up' ? 'on' : ''} onClick={() => setTab('up')}>{t('upcoming')}</button><button className={tab === 'hist' ? 'on' : ''} onClick={() => setTab('hist')}>{t('history')}</button></div></div>
    <div className="pad mt16 stack cols">
      {!list ? <Loading /> : rows.length === 0 ? <div className="empty"><div className="muted">{t('no_bookings')}</div><button className="btn b-sun mt12" onClick={() => nav('/book')}>{t('book_now')}</button></div> :
        rows.map((b, i) => { const m: Helper | undefined = helpers.find(x => x.id === b.maid_id) ?? maids?.find(x => x.id === b.maid_id); const svc = services?.find(x => x.id === b.service_type_id)
          const big = tab === 'up' && i === 0
          return <Link key={b.id} to={'/bookings/' + b.id} className={big ? 'ticket' : 'card'} style={{ color: 'var(--ink)', display: 'block' }}>
            <div className="between"><span className="disp" style={{ fontWeight: 700 }}>{fmtDate(b.start_at, lang)} {fmtTime(b.start_at)}</span><StatusPill s={b.status} /></div>
            <div className="small mt8">{m ? m.nickname : t('auto_pick')} · {svcName(svc, lang)} {b.qty ?? ''} {svcUnit(svc, lang)} · {money(b.total_price)} {t('baht')}{b.package_id ? ' · ' + t('monthly_pkg') : ''}</div>
          </Link> })}
    </div>
    <CustomerTabs />
  </div>
}

function Chat({ bookingId }: { bookingId: number }) {
  const { t, lang } = useI18n(); const { session } = useAuth(); const [msgs, setMsgs] = useState<{ id: number; sender_id: string; body: string; created_at: string }[]>([]); const [txt, setTxt] = useState('')
  const [sending, setSending] = useState(false); const [err, setErr] = useState('')
  useMinuteTick()
  const load = () => sb.from('messages').select('id,sender_id,body,created_at').eq('booking_id', bookingId).order('created_at').then(({ data }) => setMsgs(data || []))
  useEffect(() => {
    load()
    const ch = sb.channel('m' + bookingId).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `booking_id=eq.${bookingId}` }, load).subscribe()
    const iv = setInterval(load, 8000)
    return () => { sb.removeChannel(ch); clearInterval(iv) }
  }, [bookingId])
  const send = async () => {
    if (!txt.trim() || sending) return; const body = txt; setSending(true); setErr('')
    const { error } = await sb.from('messages').insert({ booking_id: bookingId, body }); setSending(false)
    if (error) { setErr(friendly(error, lang)); return }
    setTxt(cur => (cur === body ? '' : cur)); load()
  }
  return <div className="card stack">
    <div className="chatbox">{msgs.map(m => <div key={m.id} className={'bub' + (m.sender_id === session?.user.id ? ' me' : '')}>{m.body}<small className="bt">{relTime(m.created_at, t)}</small></div>)}</div>
    <div className="tiny muted" style={{ textAlign: 'center' }}>{t('masked_note')}</div>
    <div className="row"><input className="input" value={txt} onChange={e => setTxt(e.target.value)} placeholder={t('type_msg')} onKeyDown={e => e.key === 'Enter' && send()} />
      <button className="btn b-ocean sm" disabled={sending} onClick={send}>{t('send')}</button></div>
    {err && <div className="err" role="alert">{err}</div>}
  </div>
}
export { Chat }

function Track({ bookingId, home }: { bookingId: number; home: [number, number] | null }) {
  const { t } = useI18n(); const [loc, setLoc] = useState<[number, number] | null>(null)
  useEffect(() => {
    const load = () => sb.from('maid_locations').select('lat,lng').eq('booking_id', bookingId).maybeSingle().then(({ data }) => data && setLoc([data.lat, data.lng]))
    load(); const iv = setInterval(load, 10000); return () => clearInterval(iv)
  }, [bookingId])
  const km = loc && home ? haversine(loc, home) : null
  return <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
    {loc ? <MapContainer center={loc} zoom={14} className="map" scrollWheelZoom={false}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
      <CircleMarker center={loc} radius={10} pathOptions={{ color: '#fff', fillColor: '#1D6FA5', fillOpacity: 1, weight: 3 }} />
      {home && <CircleMarker center={home} radius={10} pathOptions={{ color: '#14304A', fillColor: '#F4BF3A', fillOpacity: 1, weight: 3 }} />}
    </MapContainer> : <div className="loading">{t('arrive_in')}…</div>}
    <div style={{ padding: 14 }}><span className="pill p-ocean">{t('s_on_the_way')}</span>
      <div className="disp mt8" style={{ fontWeight: 700, fontSize: 20 }}>{t('arrive_in')}</div>{km !== null && <div className="small muted">{km.toFixed(1)} {t('km_away')}</div>}</div>
  </div>
}
function haversine(a: [number, number], b: [number, number]) {
  const R = 6371, r = (x: number) => x * Math.PI / 180, dLat = r(b[0] - a[0]), dLng = r(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function BookingDetail() {
  const { id } = useParams(); const { t, lang } = useI18n(); const nav = useNavigate(); const toast = useToast(); const maids = useMaids(); const helpers = useBookingHelpers(); const services = useServices(); const addons = useAddons()
  const [b, setB] = useState<Booking | null>(null); const [addr, setAddr] = useState<{ address: string; lat: number | null; lng: number | null } | null>(null)
  const [reviewed, setReviewed] = useState(false); const [err, setErr] = useState('')
  const load = () => {
    sb.from('bookings').select('*').eq('id', id!).single().then(({ data }) => setB(data as Booking))
    sb.from('booking_addresses').select('address,lat,lng').eq('booking_id', id!).maybeSingle().then(({ data }) => setAddr(data))
    sb.from('reviews').select('id').eq('booking_id', id!).maybeSingle().then(({ data }) => setReviewed(!!data))
  }
  useEffect(() => { load(); const iv = setInterval(load, 15000); return () => clearInterval(iv) }, [id])
  if (!b) return <Loading />
  const m: Helper | undefined = helpers.find(x => x.id === b.maid_id) ?? maids?.find(x => x.id === b.maid_id)
  const svc = services?.find(x => x.id === b.service_type_id)
  // จองอีกครั้ง: ใช้บริการ แม่บ้าน ที่อยู่ งานเสริม และโน้ตเดิม แล้วไปเลือกวันเวลาใหม่
  const rebook = async () => {
    const { data } = await sb.from('customer_addresses').select('id').order('id')
    setDraft({ ...emptyDraft, service: svc?.code ?? 'general_cleaning', qty: b.qty, addons: b.addons || [], maidId: null, tags: b.tags, note: b.note ?? '', addressId: (data || [])[0]?.id ?? null })
    nav(b.maid_id ? '/book?helper=' + encodeURIComponent(b.maid_id) : '/book')
  }
  const step = ['confirmed', 'on_the_way', 'working', 'completed'].indexOf(b.status)
  const cancel = async () => {
    if (!window.confirm(t('cancel_confirm'))) return
    const { data, error } = await sb.rpc('customer_cancel', { p_booking_id: b.id })
    if (error) setErr(friendly(error, lang)); else { toast.show(`${t('cancelled_res')} ${money(data.refund)} ${t('baht')}`); load() }
  }
  return <div className="page nobar">
    <TopBar title={t('details')} back="/bookings" />
    <div className="pad mt16 stack">
      {b.maid_id && ['confirmed','on_the_way'].includes(b.status) && <Arrival key={b.id} booking={b} helper={m} side="customer" reload={load} />}
      {b.status === 'on_the_way' && <Track bookingId={b.id} home={addr?.lat && addr?.lng ? [addr.lat, addr.lng] : null} />}
      <div className="ticket">
        <div className="between"><StatusPill s={b.status} />{m && <Avatar name={m.nickname} seed={m.id} url={m.photo_url} size={40} />}</div>
        <div className="when mt8">{fmtDate(b.start_at, lang)} {fmtTime(b.start_at)}–{fmtTime(b.end_at)}</div>
        <div>{m ? m.nickname : t('s_awaiting_maid')} · {svcName(svc, lang)} {b.qty ?? ''} {svcUnit(svc, lang)}</div>
        {step >= 0 && <><div className="prog mt12">{[0, 1, 2, 3].map(i => <span key={i} style={{ display: 'contents' }}>{i > 0 && <span className={'ln' + (i <= step ? '' : ' off')} />}<span className={'dot' + (i <= step ? '' : ' off')}>{i <= step && <Icon n="check" size={13} />}</span></span>)}</div>
          <div className="proglab"><span>{t('s_confirmed')}</span><span>{t('s_on_the_way')}</span><span>{t('s_working')}</span><span>{t('s_completed')}</span></div></>}
      </div>
      {(b.status === 'pending_payment' || b.status === 'payment_rejected') && <button className="btn b-sun" onClick={() => nav(b.package_id ? '/pay/package/' + b.package_id : '/pay/booking/' + b.id)}>{t('pay_title')} {money(b.total_price)} {t('baht')}</button>}
      <div className="card recv">
        <div><span className="muted">{svcName(svc, lang)} {b.qty ?? ''} {svcUnit(svc, lang)}</span><span>{money(b.base_price)}</span></div>
        {b.addons_price > 0 && <div><span className="muted">{t('addons')}: {(b.addons || []).map(c => { const a = addons?.find(x => x.code === c); return a ? (lang === 'th' ? a.name_th : a.name_en) : c }).join(', ')}</span><span>{money(b.addons_price)}</span></div>}
        {b.choose_maid_fee > 0 && <div><span className="muted">{t('pick_fee')}</span><span>{b.choose_maid_fee}</span></div>}
        {b.urgent_fee > 0 && <div><span className="muted">{t('urgent_tag')}</span><span>{money(b.urgent_fee)}</span></div>}
        {b.promo_discount > 0 && <div><span className="muted">{b.promo_code ? t('promo_code') + ' ' + b.promo_code : t('first_promo')}</span><span>−{money(b.promo_discount)}</span></div>}
        {b.points_discount > 0 && <div><span className="muted">{t('use_points')} {b.points_used}</span><span>−{b.points_discount}</span></div>}
        <div className="tot"><span>{t('total')}</span><span>{money(b.total_price)} {t('baht')}</span></div>
        {addr && <div className="small muted mt8" style={{ display: 'block' }}><Icon n="pin" size={14} /> {addr.address}</div>}
        {b.tags.length > 0 && <div className="chips mt8">{b.tags.map(x => <span key={x} className="pill p-ocean">{t(x as Key)}</span>)}</div>}
        {b.note && <div className="small mt8" style={{ display: 'block' }}>{b.note}</div>}
      </div>
      {ACTIVE.includes(b.status) && <AddToCalendar b={b} title={svcName(svc, lang)} address={addr?.address ?? ''} />}
      {['pending_payment', 'payment_review', 'awaiting_maid', 'confirmed'].includes(b.status) && <Reschedule b={b} svc={svc?.code ?? 'general_cleaning'} onDone={() => { toast.show(t('saved')); load() }} />}
      {(b.checklist?.length > 0 || ['working', 'completed'].includes(b.status)) && <JobProof b={b} />}
      {b.maid_id && ['confirmed', 'on_the_way', 'working', 'completed'].includes(b.status) && <><div className="sec-title" style={{ margin: '6px 0 0' }}>{t('chat')}</div><Chat bookingId={b.id} /></>}
      {['completed', 'cancelled_by_customer'].includes(b.status) && !b.package_id && <button className="btn b-sun" onClick={rebook}><Icon n="redo" />{t('book_again')}</button>}
      {!['pending_payment', 'payment_review', 'payment_rejected'].includes(b.status) && <Link to={'/receipt/' + b.id} className="btn b-line"><Icon n="print" />{t('receipt')}</Link>}
      {b.status === 'completed' && !reviewed && b.maid_id && <div className="card"><RatingForm bookingId={b.id} side="customer" name={m?.nickname ?? ''} onDone={() => { setReviewed(true); confetti(); toast.show(t('thanks_review')) }} /></div>}
      {b.status === 'completed' && <Link to={'/claim/' + b.id} className="btn b-line">{t('claim')}</Link>}
      {['pending_payment', 'payment_review', 'awaiting_maid', 'confirmed', 'payment_rejected'].includes(b.status) && <><div className="small muted">{t('cancel_rules')}</div><button className="btn b-red" onClick={cancel}>{t('cancel_booking')}</button></>}
      {err && <div className="err">{err}</div>}
    </div>{toast.node}
  </div>
}

// เพิ่มลงปฏิทิน: ไฟล์ .ics (ใช้ได้กับ iPhone/Android/Outlook) + ลิงก์ Google Calendar พร้อมเตือนก่อน 1 ชม.
function AddToCalendar({ b, title, address }: { b: Booking; title: string; address: string }) {
  const { t } = useI18n()
  const z = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const name = 'CleenDee: ' + title
  const ics = () => {
    const txt = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CleenDee//TH', 'BEGIN:VEVENT', `UID:cleendee-${b.id}@cleendee.pages.dev`, `DTSTAMP:${z(new Date().toISOString())}`,
      `DTSTART:${z(b.start_at)}`, `DTEND:${z(b.end_at)}`, `SUMMARY:${name}`, `LOCATION:${address.replace(/[,;\n]/g, ' ')}`, `URL:${location.origin}/bookings/${b.id}`,
      'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', `DESCRIPTION:${name}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/calendar' })); a.download = `cleendee-${b.id}.ics`; a.click()
  }
  const g = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(name)}&dates=${z(b.start_at)}/${z(b.end_at)}&location=${encodeURIComponent(address)}&details=${encodeURIComponent(location.origin + '/bookings/' + b.id)}`
  return <div className="row"><button className="btn b-line" style={{ flex: 1 }} onClick={ics}><Icon n="cal" />{t('add_calendar')}</button>
    <a className="btn b-line" style={{ flex: 1 }} href={g} target="_blank" rel="noreferrer">Google Calendar</a></div>
}

// เลื่อนนัดเอง: เลือกวัน-เวลาใหม่ (ระบบเช็กว่าแม่บ้านคนเดิมว่าง)
function Reschedule({ b, svc, onDone }: { b: Booking; svc: string; onDone: () => void }) {
  const { t, lang } = useI18n(); const [open, setOpen] = useState(false); const [err, setErr] = useState('')
  const hours = Math.round((new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 3600e3)
  const days = Array.from({ length: 14 }, (_, i) => bkkToday(i + 1))
  const [date, setDate] = useState(days[0]); const [slots, setSlots] = useState<number[] | null>(null)
  useEffect(() => {
    if (!open) return; setSlots(null)
    sb.rpc('available_slots_v2', { p_date: date, p_maid: b.maid_id, p_service_code: svc, p_hours: hours })
      .then(({ data }) => setSlots(((data as { start_time: string; urgent: boolean }[]) || []).filter(x => !x.urgent).map(x => Number(x.start_time.slice(0, 2)))))
  }, [open, date])
  const go = async (h: number) => {
    setErr(''); const { error } = await sb.rpc('customer_reschedule', { p_booking_id: b.id, p_start_at: startIso(date, h) })
    if (error) setErr(friendly(error, lang)); else { setOpen(false); onDone() }
  }
  if (!open) return <button className="btn b-ghost" onClick={() => setOpen(true)}><Icon n="clock" />{t('reschedule')}</button>
  return <div className="card stack"><b className="disp">{t('reschedule')}</b><div className="small muted">{t('reschedule_d')}</div>
    <div className="cal">{days.map(x => <button key={x} className={'cd' + (x === date ? ' on' : '')} onClick={() => setDate(x)}><small>{fmtDate(x + 'T12:00:00+07:00', lang, { weekday: 'short' })}</small><b>{Number(x.slice(8))}</b></button>)}</div>
    {!slots ? <Loading /> : slots.length === 0 ? <div className="muted small">{t('no_slots')}</div> :
      <div className="tgrid">{slots.map(h => <button key={h} className="tc" onClick={() => go(h)}>{String(h).padStart(2, '0')}:00</button>)}</div>}
    {err && <div className="err">{err}</div>}<button className="link" onClick={() => setOpen(false)}>{t('close')}</button></div>
}

// รูปก่อน/หลัง และเช็กลิสต์ที่แม่บ้านติ๊ก (ลูกค้าดูอย่างเดียว)
export function JobProof({ b, photosOnly = false, refreshKey = 0 }: { b: Booking; photosOnly?: boolean; refreshKey?: number }) {
  const { t } = useI18n(); const [photos, setPhotos] = useState<{ kind: string; url: string }[]>([]); const [big, setBig] = useState<string | null>(null)
  useEffect(() => {
    sb.from('booking_photos').select('kind,path').eq('booking_id', b.id).order('created_at').then(async ({ data }) => {
      const rows = data || []; if (!rows.length) return setPhotos([])
      const { data: urls } = await sb.storage.from('job-photos').createSignedUrls(rows.map(r => r.path), 3600)
      setPhotos(rows.map((r, i) => ({ kind: r.kind, url: urls?.[i]?.signedUrl ?? '' })).filter(x => x.url))
    })
  }, [b.id, b.status, refreshKey])
  const list = photosOnly ? [] : b.checklist || []
  if (photosOnly && photos.length === 0) return null
  return <div className="card stack"><b className="disp">{t('job_proof')}</b>
    {list.length > 0 && <div className="stack" style={{ gap: 6 }}>{list.map((c, i) => <div key={i} className="row small"><span className={'chk' + (c.done ? ' on' : '')}>{c.done && <Icon n="check" size={14} />}</span>{c.t}</div>)}</div>}
    {(['before', 'after'] as const).map(k => { const ps = photos.filter(p => p.kind === k); return ps.length > 0 && <div key={k}><div className="small muted">{t(k === 'before' ? 'photo_before' : 'photo_after')}</div>
      <div className="row mt8" style={{ flexWrap: 'wrap', gap: 8 }}>{ps.map(p => <button key={p.url} onClick={() => setBig(p.url)}><img src={p.url} alt="" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 12 }} /></button>)}</div></div> })}
    {photos.length === 0 && list.length === 0 && <div className="small muted">{t('no_proof_yet')}</div>}
    {big && <div onClick={() => setBig(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}><img src={big} alt="" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12 }} /></div>}
  </div>
}

// ใบเสร็จรับเงิน (พิมพ์หรือบันทึกเป็น PDF จากเบราว์เซอร์)
export function Receipt() {
  const { id } = useParams(); const { t, lang } = useI18n(); const services = useServices(); const addons = useAddons()
  const [b, setB] = useState<Booking | null>(null); const [biz, setBiz] = useState<{ business_name: string; business_address: string; tax_id: string | null } | null>(null)
  const [paidAt, setPaidAt] = useState<string | null>(null); const { profile } = useAuth()
  useEffect(() => {
    sb.from('bookings').select('*').eq('id', id!).single().then(({ data }) => setB(data as Booking))
    sb.from('settings').select('business_name,business_address,tax_id').maybeSingle().then(({ data }) => setBiz(data))
    sb.from('payments').select('reviewed_at,status').eq('booking_id', id!).eq('status', 'approved').maybeSingle().then(({ data }) => setPaidAt(data?.reviewed_at ?? null))
  }, [id])
  if (!b || !biz) return <Loading />
  const svc: Service | undefined = services?.find(x => x.id === b.service_type_id)
  const rows: [string, number][] = [[`${svcName(svc, lang)} ${b.qty ?? ''} ${svcUnit(svc, lang)}`, b.base_price],
    ...(b.addons || []).map(c => { const a = addons?.find(x => x.code === c); return [a ? (lang === 'th' ? a.name_th : a.name_en) : c, a?.price ?? 0] as [string, number] }),
    ...(b.choose_maid_fee ? [[t('pick_fee'), b.choose_maid_fee] as [string, number]] : []), ...(b.urgent_fee ? [[t('urgent_tag'), b.urgent_fee] as [string, number]] : []),
    ...(b.promo_discount ? [[b.promo_code ? t('promo_code') + ' ' + b.promo_code : t('first_promo'), -b.promo_discount] as [string, number]] : []),
    ...(b.points_discount ? [[t('use_points') + ' ' + b.points_used, -b.points_discount] as [string, number]] : [])]
  return <div className="page nobar"><div className="noprint"><TopBar title={t('receipt')} /></div>
    <div className="pad mt16"><div className="card receipt">
      <div className="between"><img src="/brand/CleenDee_logo_horizontal.svg" alt="CleenDee" style={{ height: 30 }} /><b className="disp">{t('receipt')}</b></div>
      <div className="small mt12"><b>{biz.business_name}</b><div className="muted">{biz.business_address}{biz.tax_id ? ` · ${t('tax_id')} ${biz.tax_id}` : ''}</div></div>
      <div className="small mt12 recv"><div><span className="muted">{t('receipt_no')}</span><span>CD-{String(b.id).padStart(6, '0')}</span></div>
        <div><span className="muted">{t('customer')}</span><span>{profile?.full_name ?? ''}</span></div>
        <div><span className="muted">{t('service_date')}</span><span>{fmtDate(b.start_at, lang, { day: 'numeric', month: 'short', year: 'numeric' })} {fmtTime(b.start_at)}</span></div>
        {paidAt && <div><span className="muted">{t('paid_on')}</span><span>{fmtDate(paidAt, lang, { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>}</div>
      <div className="recv mt12">{rows.map(([k, v], i) => <div key={i}><span>{k}</span><span>{v < 0 ? '−' : ''}{money(Math.abs(v))}</span></div>)}
        <div className="tot"><span>{t('total')}</span><span>{money(b.total_price)} {t('baht')}</span></div></div>
      {b.status === 'cancelled_by_customer' && <div className="err mt12">{t('s_cancelled_by_customer')}</div>}
      <div className="tiny muted mt12">{t('receipt_note')}</div>
    </div>
    <button className="btn b-ocean mt16 noprint" onClick={() => window.print()}><Icon n="print" />{t('print')}</button></div>
  </div>
}

export function Claim() {
  const { id } = useParams(); const { t, lang } = useI18n(); const nav = useNavigate(); const { session } = useAuth(); const toast = useToast()
  const [item, setItem] = useState(''); const [desc, setDesc] = useState(''); const [price, setPrice] = useState(''); const [year, setYear] = useState(''); const [files, setFiles] = useState<File[]>([]); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const send = async () => {
    setBusy(true); setErr('')
    try {
      const paths: string[] = []
      for (const f of files) { const p = `${session!.user.id}/claim-${id}-${Date.now()}-${paths.length}.${f.name.split('.').pop() || 'jpg'}`; const up = await sb.storage.from('claims').upload(p, f); if (up.error) throw up.error; paths.push(p) }
      const { error } = await sb.rpc('submit_claim', { p_booking_id: Number(id), p_item: item, p_description: desc, p_purchase_price: Number(price) || null, p_purchase_year: Number(year) || null, p_photo_paths: paths })
      if (error) throw error; toast.show(t('claim_sent')); setTimeout(() => nav('/bookings/' + id), 1200)
    } catch (e) { setErr(friendly(e, lang)) } finally { setBusy(false) }
  }
  return <div className="page nobar"><TopBar title={t('claim')} />
    <div className="pad mt16 stack">
      <div className="infonote"><Icon n="shield" />{t('claim_d')} · {t('a_cap')}</div>
      <div className="field"><label>{t('claim_item')}</label><input className="input" value={item} onChange={e => setItem(e.target.value)} /></div>
      <div className="field"><label>{t('details')}</label><textarea className="input" value={desc} onChange={e => setDesc(e.target.value)} /></div>
      <div className="row"><div className="field" style={{ flex: 1 }}><label>{t('claim_price')}</label><input className="input" inputMode="numeric" value={price} onChange={e => setPrice(e.target.value.replace(/\D/g, ''))} /></div>
        <div className="field" style={{ flex: 1 }}><label>{t('claim_year')}</label><input className="input" inputMode="numeric" value={year} onChange={e => setYear(e.target.value.replace(/\D/g, ''))} /></div></div>
      <label className="btn b-line" style={{ cursor: 'pointer' }}><Icon n="camera" />{t('claim_photos')} ({files.length})<input type="file" accept="image/*" multiple hidden onChange={e => setFiles([...(e.target.files || [])].slice(0, 6))} /></label>
      {err && <div className="err">{err}</div>}
    </div>
    <div className="bottom-bar"><button className="btn b-sun" disabled={!item || files.length === 0 || busy} onClick={send}>{t('send')}</button></div>{toast.node}
  </div>
}

export function Messages() {
  const { t, lang } = useI18n(); const { list } = useMyBookings(); const maids = useMaids(); const helpers = useBookingHelpers()
  const rows = (list || []).filter(b => b.maid_id && ['confirmed', 'on_the_way', 'working', 'completed'].includes(b.status)).reverse()
  return <div className="page"><div className="hero"><h1>{t('tab_msgs')}</h1></div>
    <div className="mt12">{rows.length === 0 ? <div className="pad"><div className="empty muted">{t('nothing')}</div></div> : rows.map(b => { const m = helpers.find(x => x.id === b.maid_id) ?? maids?.find(x => x.id === b.maid_id)
      return <Link key={b.id} to={'/bookings/' + b.id} className="listrow" style={{ color: 'var(--ink)' }}>{m && <Avatar name={m.nickname} seed={m.id} size={44} />}
        <span style={{ flex: 1 }}><b>{m?.nickname}</b><span className="small muted">{fmtDate(b.start_at, lang)} {fmtTime(b.start_at)}</span></span><StatusPill s={b.status} /></Link> })}</div>
    <CustomerTabs /></div>
}

export function Account() {
  const { t, lang, setLang } = useI18n(); const { profile, session } = useAuth(); const nav = useNavigate()
  const [maidApp, setMaidApp] = useState<{ status: string } | null>(null)
  useEffect(() => { if (session) sb.from('maids').select('status').eq('id', session.user.id).maybeSingle().then(({ data }) => setMaidApp(data)) }, [session])
  // ยังไม่เข้าสู่ระบบ (แบบแอป bTaskee): ปุ่มสมัครสมาชิก / เข้าสู่ระบบ ด้านบน + การตั้งค่าและช่วยเหลือด้านล่าง
  if (!session) return <div className="page"><div className="hero tall"><h1>{t('account')}</h1><p>{t('lw_book')}</p></div>
    <div className="pad" style={{ marginTop: -54, position: 'relative', zIndex: 2 }}><div className="card guestcard"><Link to="/login" className="btn b-ghost">{t('signup')}</Link><Link to="/login" className="btn b-ocean">{t('login')}</Link></div></div>
    <div className="pad"><div className="sec-title">{t('settings')}</div></div>
    <button className="listrow" onClick={() => setLang(lang === 'th' ? 'en' : 'th')}><span className="rico"><Icon n="chat" /></span><b style={{ flex: 1 }}>{t('language')}: {lang === 'th' ? 'ไทย' : 'English'}</b></button>
    <ThemePicker />
    <div className="pad"><div className="sec-title">{t('help')}</div></div>
    <Link to="/service" className="listrow" style={{ color: 'var(--ink)' }}><span className="rico"><Icon n="broom" /></span><b style={{ flex: 1 }}>{t('svc_title')}</b><Icon n="next" /></Link>
    <Link to="/privacy" className="listrow" style={{ color: 'var(--ink)' }}><span className="rico"><Icon n="shield" /></span><b style={{ flex: 1 }}>Privacy</b><Icon n="next" /></Link>
    <CustomerTabs /></div>
  return <div className="page">
    <div className="hero tall"><div className="row"><Avatar name={profile?.full_name || 'C'} size={54} seed={session.user.id} /><div><h1 style={{ fontSize: 21 }}>{profile?.full_name}</h1><div className="sub">{session.user.email}</div></div></div></div>
    <div className="pad" style={{ marginTop: -54, position: 'relative', zIndex: 2 }}><div className="kpi"><div className="small">{t('my_points')}</div><div className="v"><CountUp value={profile?.points ?? 0} /> {t('points')}</div><div className="small mt8">{t('points_rule')}</div></div></div>
    <div className="mt16">
      {profile?.role === 'admin' && <Link to="/admin" className="listrow" style={{ color: 'var(--ink)' }}><span className="rico" style={{ background: 'var(--sun-l)' }}><Icon n="grid" /></span><b style={{ flex: 1 }}>Admin</b><Icon n="next" /></Link>}
      {profile?.role === 'maid' && <Link to="/maid" className="listrow" style={{ color: 'var(--ink)' }}><span className="rico" style={{ background: 'var(--sun-l)' }}><Icon n="grid" /></span><b style={{ flex: 1 }}>{t('tab_jobs')}</b><Icon n="next" /></Link>}
      <Link to="/account/addresses" className="listrow" style={{ color: 'var(--ink)' }}><span className="rico"><Icon n="pin" /></span><b style={{ flex: 1 }}>{t('my_addresses')}</b><Icon n="next" /></Link>
      <Link to="/account/favorites" className="listrow" style={{ color: 'var(--ink)' }}><span className="rico" style={{ background: 'var(--sun-l)' }}><Icon n="heart" /></span><b style={{ flex: 1 }}>{t('favorites')}</b><Icon n="next" /></Link>
      <Link to="/book/time?plan=weekly" className="listrow" style={{ color: 'var(--ink)' }}><span className="rico" style={{ background: 'var(--leaf-l)' }}><Icon n="cal" /></span><span style={{ flex: 1 }}><b>{t('monthly_pkg')}</b><span className="small muted">{t('pkg_none')}</span></span><Icon n="next" /></Link>
      {profile?.role === 'customer' && <Link to="/maid/apply" className="listrow" style={{ color: 'var(--ink)' }}><span className="rico"><Icon n="team" /></span><span style={{ flex: 1 }}><b>{t('become_maid')}</b>{maidApp?.status === 'pending' && <span className="small muted">{t('m_wait')}</span>}</span><Icon n="next" /></Link>}
      <button className="listrow" onClick={() => setLang(lang === 'th' ? 'en' : 'th')}><span className="rico"><Icon n="chat" /></span><b style={{ flex: 1 }}>{t('language')}: {lang === 'th' ? 'ไทย' : 'English'}</b></button>
      <ThemePicker />
      <button className="listrow" onClick={async () => { await sb.auth.signOut(); clearDraft(); nav('/') }}><span className="rico"><Icon n="logout" /></span><b style={{ flex: 1 }}>{t('logout')}</b></button>
    </div>
    {profile?.role === 'maid' ? <MaidTabs /> : profile?.role === 'admin' ? <AdminTabs /> : <CustomerTabs />}
  </div>
}

export function Addresses() {
  const { t,lang } = useI18n(); const { list, reload } = useAddresses(); const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const address = list?.find(a => a.id === editing)
  return <div className="page nobar"><TopBar title={t('my_addresses')} />
    <div className="pad mt16 stack">
      {list?.length === 0 && !adding && <div className="empty"><Icon n="pin" size={40} style={{ color: '#C9DDEC' }} /><div className="disp mt8" style={{ fontWeight: 600 }}>{t('no_address')}</div></div>}
      {list?.map(a => <div key={a.id} className="choice"><Icon n="pin" style={{ color: 'var(--ocean)' }} /><span><b>{a.label}</b><span className="small muted">{a.address}</span></span><button className="link" onClick={() => { setEditing(a.id); setAdding(false) }}>{lang === 'th' ? 'ปรับหมุด' : 'Adjust pin'}</button></div>)}
      {adding || address ? <AddressForm key={address?.id ?? 'new'} existing={address} onSaved={() => { setAdding(false); setEditing(null); reload() }} onDeleted={() => { setEditing(null); reload() }} /> : <button className="btn b-ocean" onClick={() => setAdding(true)}>{t('add_address')}</button>}
      <div className="infonote"><Icon n="lock" />{t('addr_private')}</div>
    </div></div>
}

export function Favorites() {
  const { t } = useI18n(); const nav = useNavigate(); const { list } = useMyBookings(); const maids = useMaids()
  const blocked = useBlockedMaids()
  const ids = [...new Set((list || []).filter(b => b.status === 'completed' && b.maid_id && !blocked.includes(b.maid_id)).map(b => b.maid_id!))]
  return <div className="page nobar"><TopBar title={t('favorites')} />
    <div className="mt12">{ids.length === 0 ? <div className="pad"><div className="empty muted">{t('nothing')}</div></div> : ids.map(id => { const m = maids?.find(x => x.id === id); if (!m) return null
      return <div key={id} className="listrow"><Avatar name={m.nickname} seed={m.id} size={44} /><b style={{ flex: 1 }}>{m.nickname}</b>
        <button className="btn b-ghost sm" onClick={() => { setDraft({ maidId:null, plan:'once', hour:null }); nav('/book?helper=' + encodeURIComponent(id)) }}>{t('s_rebook').replace('\n', '')}</button></div> })}</div></div>
}
