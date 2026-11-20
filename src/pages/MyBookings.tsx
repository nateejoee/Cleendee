import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { sb, friendly, type Booking } from '../lib/supabase'
import { useI18n, money, fmtDate, fmtTime, type Key } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { setDraft } from '../lib/draft'
import { Avatar, CustomerTabs, Icon, Loading, StatusPill, TopBar, useToast } from '../components/ui'
import { useMaids, AddressForm, useAddresses } from './Book'

const ACTIVE = ['pending_payment', 'payment_review', 'awaiting_maid', 'confirmed', 'on_the_way', 'working', 'payment_rejected']

export function useMyBookings() {
  const { session } = useAuth(); const [b, setB] = useState<Booking[] | null>(null)
  const load = () => { if (session) sb.from('bookings').select('*').eq('customer_id', session.user.id).order('start_at').then(({ data }) => setB((data as Booking[]) || [])) }
  useEffect(load, [session])
  return { list: b, reload: load }
}

export function Bookings() {
  const { t, lang } = useI18n(); const nav = useNavigate(); const { session } = useAuth(); const { list } = useMyBookings(); const maids = useMaids()
  const [tab, setTab] = useState<'up' | 'hist'>('up')
  if (!session) return <div className="page"><div className="hero"><h1>{t('my_bookings')}</h1></div><div className="pad mt20"><Link className="btn b-ocean" to="/login">{t('login')}</Link></div><CustomerTabs /></div>
  const rows = (list || []).filter(b => (tab === 'up') === ACTIVE.includes(b.status))
  if (tab === 'hist') rows.reverse()
  return <div className="page">
    <div className="hero"><h1>{t('my_bookings')}</h1>
      <div className="seg mt12"><button className={tab === 'up' ? 'on' : ''} onClick={() => setTab('up')}>{t('upcoming')}</button><button className={tab === 'hist' ? 'on' : ''} onClick={() => setTab('hist')}>{t('history')}</button></div></div>
    <div className="pad mt16 stack">
      {!list ? <Loading /> : rows.length === 0 ? <div className="empty"><div className="muted">{t('no_bookings')}</div><button className="btn b-sun mt12" onClick={() => nav('/book')}>{t('book_now')}</button></div> :
        rows.map((b, i) => { const m = maids?.find(x => x.id === b.maid_id)
          const big = tab === 'up' && i === 0
          return <Link key={b.id} to={'/bookings/' + b.id} className={big ? 'ticket' : 'card'} style={{ color: 'var(--ink)', display: 'block' }}>
            <div className="between"><span className="disp" style={{ fontWeight: 700 }}>{fmtDate(b.start_at, lang)} {fmtTime(b.start_at)}</span><StatusPill s={b.status} /></div>
            <div className="small mt8">{m ? m.nickname : t('auto_pick')} · {t('clean_6h')} · {money(b.total_price)} {t('baht')}{b.package_id ? ' · ' + t('monthly_pkg') : ''}</div>
          </Link> })}
    </div>
    <CustomerTabs />
  </div>
}

function Chat({ bookingId }: { bookingId: number }) {
  const { t } = useI18n(); const { session } = useAuth(); const [msgs, setMsgs] = useState<{ id: number; sender_id: string; body: string }[]>([]); const [txt, setTxt] = useState('')
  const load = () => sb.from('messages').select('id,sender_id,body').eq('booking_id', bookingId).order('created_at').then(({ data }) => setMsgs(data || []))
  useEffect(() => {
    load()
    const ch = sb.channel('m' + bookingId).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `booking_id=eq.${bookingId}` }, load).subscribe()
    const iv = setInterval(load, 8000)
    return () => { sb.removeChannel(ch); clearInterval(iv) }
  }, [bookingId])
  const send = async () => { if (!txt.trim()) return; const body = txt; setTxt(''); await sb.from('messages').insert({ booking_id: bookingId, body }); load() }
  return <div className="card stack">
    <div className="chatbox">{msgs.map(m => <div key={m.id} className={'bub' + (m.sender_id === session?.user.id ? ' me' : '')}>{m.body}</div>)}</div>
    <div className="tiny muted" style={{ textAlign: 'center' }}>{t('masked_note')}</div>
    <div className="row"><input className="input" value={txt} onChange={e => setTxt(e.target.value)} placeholder={t('type_msg')} onKeyDown={e => e.key === 'Enter' && send()} />
      <button className="btn b-ocean sm" onClick={send}>{t('send')}</button></div>
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
  const { id } = useParams(); const { t, lang } = useI18n(); const nav = useNavigate(); const toast = useToast(); const maids = useMaids()
  const [b, setB] = useState<Booking | null>(null); const [addr, setAddr] = useState<{ address: string; lat: number | null; lng: number | null } | null>(null)
  const [reviewed, setReviewed] = useState(false); const [err, setErr] = useState('')
  const load = () => {
    sb.from('bookings').select('*').eq('id', id!).single().then(({ data }) => setB(data as Booking))
    sb.from('booking_addresses').select('address,lat,lng').eq('booking_id', id!).maybeSingle().then(({ data }) => setAddr(data))
    sb.from('reviews').select('id').eq('booking_id', id!).maybeSingle().then(({ data }) => setReviewed(!!data))
  }
  useEffect(() => { load(); const iv = setInterval(load, 15000); return () => clearInterval(iv) }, [id])
  if (!b) return <Loading />
  const m = maids?.find(x => x.id === b.maid_id)
  const step = ['confirmed', 'on_the_way', 'working', 'completed'].indexOf(b.status)
  const cancel = async () => {
    if (!window.confirm(t('cancel_confirm'))) return
    const { data, error } = await sb.rpc('customer_cancel', { p_booking_id: b.id })
    if (error) setErr(friendly(error, lang)); else { toast.show(`${t('cancelled_res')} ${money(data.refund)} ${t('baht')}`); load() }
  }
  return <div className="page nobar">
    <TopBar title={t('details')} back="/bookings" />
    <div className="pad mt16 stack">
      {b.status === 'on_the_way' && <Track bookingId={b.id} home={addr?.lat && addr?.lng ? [addr.lat, addr.lng] : null} />}
      <div className="ticket">
        <div className="between"><StatusPill s={b.status} />{m && <Avatar name={m.nickname} seed={m.id} url={m.photo_url} size={40} />}</div>
        <div className="when mt8">{fmtDate(b.start_at, lang)} {fmtTime(b.start_at)}–{fmtTime(b.end_at)}</div>
        <div>{m ? m.nickname : t('s_awaiting_maid')} · {t('clean_6h')}</div>
        {step >= 0 && <><div className="prog mt12">{[0, 1, 2, 3].map(i => <span key={i} style={{ display: 'contents' }}>{i > 0 && <span className={'ln' + (i <= step ? '' : ' off')} />}<span className={'dot' + (i <= step ? '' : ' off')}>{i <= step && <Icon n="check" size={13} />}</span></span>)}</div>
          <div className="proglab"><span>{t('s_confirmed')}</span><span>{t('s_on_the_way')}</span><span>{t('s_working')}</span><span>{t('s_completed')}</span></div></>}
      </div>
      {(b.status === 'pending_payment' || b.status === 'payment_rejected') && <button className="btn b-sun" onClick={() => nav(b.package_id ? '/pay/package/' + b.package_id : '/pay/booking/' + b.id)}>{t('pay_title')} {money(b.total_price)} {t('baht')}</button>}
      <div className="card recv">
        <div><span className="muted">{t('clean_6h')}</span><span>{money(b.base_price)}</span></div>
        {b.choose_maid_fee > 0 && <div><span className="muted">{t('pick_fee')}</span><span>{b.choose_maid_fee}</span></div>}
        {b.promo_discount > 0 && <div><span className="muted">{t('first_promo')}</span><span>−{b.promo_discount}</span></div>}
        {b.points_discount > 0 && <div><span className="muted">{t('use_points')} {b.points_used}</span><span>−{b.points_discount}</span></div>}
        <div className="tot"><span>{t('total')}</span><span>{money(b.total_price)} {t('baht')}</span></div>
        {addr && <div className="small muted mt8" style={{ display: 'block' }}><Icon n="pin" size={14} /> {addr.address}</div>}
        {b.tags.length > 0 && <div className="chips mt8">{b.tags.map(x => <span key={x} className="pill p-ocean">{t(x as Key)}</span>)}</div>}
        {b.note && <div className="small mt8" style={{ display: 'block' }}>{b.note}</div>}
      </div>
      {b.maid_id && ['confirmed', 'on_the_way', 'working', 'completed'].includes(b.status) && <><div className="sec-title" style={{ margin: '6px 0 0' }}>{t('chat')}</div><Chat bookingId={b.id} /></>}
      {b.status === 'completed' && !reviewed && <Review b={b} onDone={() => { setReviewed(true); toast.show(t('thanks_review')) }} />}
      {b.status === 'completed' && <Link to={'/claim/' + b.id} className="btn b-line">{t('claim')}</Link>}
      {['pending_payment', 'payment_review', 'awaiting_maid', 'confirmed', 'payment_rejected'].includes(b.status) && <><div className="small muted">{t('cancel_rules')}</div><button className="btn b-red" onClick={cancel}>{t('cancel_booking')}</button></>}
      {err && <div className="err">{err}</div>}
    </div>{toast.node}
  </div>
}

function Review({ b, onDone }: { b: Booking; onDone: () => void }) {
  const { t, lang } = useI18n(); const [r, setR] = useState(5); const [tags, setTags] = useState<string[]>([]); const [c, setC] = useState(''); const [err, setErr] = useState('')
  const opts: Key[] = ['r_ontime', 'r_clean', 'r_polite', 'r_detail']
  const send = async () => { const { error } = await sb.rpc('submit_review', { p_booking_id: b.id, p_rating: r, p_tags: tags, p_comment: c }); if (error) setErr(friendly(error, lang)); else onDone() }
  return <div className="card stack" style={{ textAlign: 'center' }}>
    <b className="disp">{t('s_completed')} — {t('send_review')}</b>
    <div className="stars">{[1, 2, 3, 4, 5].map(i => <button key={i} className={i <= r ? 'on' : ''} onClick={() => setR(i)} aria-label={String(i)}>★</button>)}</div>
    <div className="chips" style={{ justifyContent: 'center' }}>{opts.map(o => <button key={o} className={'chip' + (tags.includes(o) ? ' on' : '')} onClick={() => setTags(tags.includes(o) ? tags.filter(x => x !== o) : [...tags, o])}>{t(o)}</button>)}</div>
    <textarea className="input" placeholder={t('review_ph')} value={c} onChange={e => setC(e.target.value)} />
    {err && <div className="err">{err}</div>}<button className="btn b-sun" onClick={send}>{t('send_review')}</button>
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
  const { t, lang } = useI18n(); const { list } = useMyBookings(); const maids = useMaids()
  const rows = (list || []).filter(b => b.maid_id && ['confirmed', 'on_the_way', 'working', 'completed'].includes(b.status)).reverse()
  return <div className="page"><div className="hero"><h1>{t('tab_msgs')}</h1></div>
    <div className="mt12">{rows.length === 0 ? <div className="pad"><div className="empty muted">{t('nothing')}</div></div> : rows.map(b => { const m = maids?.find(x => x.id === b.maid_id)
      return <Link key={b.id} to={'/bookings/' + b.id} className="listrow" style={{ color: 'var(--ink)' }}>{m && <Avatar name={m.nickname} seed={m.id} size={44} />}
        <span style={{ flex: 1 }}><b>{m?.nickname}</b><span className="small muted">{fmtDate(b.start_at, lang)} {fmtTime(b.start_at)}</span></span><StatusPill s={b.status} /></Link> })}</div>
    <CustomerTabs /></div>
}

export function Account() {
  const { t, lang, setLang } = useI18n(); const { profile, session } = useAuth(); const nav = useNavigate()
  const [maidApp, setMaidApp] = useState<{ status: string } | null>(null)
  useEffect(() => { if (session) sb.from('maids').select('status').eq('id', session.user.id).maybeSingle().then(({ data }) => setMaidApp(data)) }, [session])
  if (!session) return <div className="page"><div className="hero"><h1>{t('account')}</h1></div><div className="pad mt20 stack"><Link to="/login" className="btn b-ocean">{t('login')} / {t('signup')}</Link>
    <button className="btn b-line" onClick={() => setLang(lang === 'th' ? 'en' : 'th')}>{t('language')}: {lang === 'th' ? 'ไทย' : 'English'}</button></div><CustomerTabs /></div>
  return <div className="page">
    <div className="hero tall"><div className="row"><Avatar name={profile?.full_name || 'C'} size={54} seed={session.user.id} /><div><h1 style={{ fontSize: 21 }}>{profile?.full_name}</h1><div className="sub">{session.user.email}</div></div></div></div>
    <div className="pad" style={{ marginTop: -54, position: 'relative', zIndex: 2 }}><div className="kpi"><div className="small">{t('my_points')}</div><div className="v">{money(profile?.points ?? 0)} {t('points')}</div><div className="small mt8">{t('points_rule')}</div></div></div>
    <div className="mt16">
      {profile?.role === 'admin' && <Link to="/admin" className="listrow" style={{ color: 'var(--ink)' }}><span className="rico" style={{ background: 'var(--sun-l)' }}><Icon n="grid" /></span><b style={{ flex: 1 }}>Admin</b><Icon n="next" /></Link>}
      {profile?.role === 'maid' && <Link to="/maid" className="listrow" style={{ color: 'var(--ink)' }}><span className="rico" style={{ background: 'var(--sun-l)' }}><Icon n="grid" /></span><b style={{ flex: 1 }}>{t('tab_jobs')}</b><Icon n="next" /></Link>}
      <Link to="/account/addresses" className="listrow" style={{ color: 'var(--ink)' }}><span className="rico"><Icon n="pin" /></span><b style={{ flex: 1 }}>{t('my_addresses')}</b><Icon n="next" /></Link>
      <Link to="/account/favorites" className="listrow" style={{ color: 'var(--ink)' }}><span className="rico" style={{ background: 'var(--sun-l)' }}><Icon n="heart" /></span><b style={{ flex: 1 }}>{t('favorites')}</b><Icon n="next" /></Link>
      <Link to="/book/time?plan=weekly" className="listrow" style={{ color: 'var(--ink)' }}><span className="rico" style={{ background: 'var(--leaf-l)' }}><Icon n="cal" /></span><span style={{ flex: 1 }}><b>{t('monthly_pkg')}</b><span className="small muted">{t('pkg_none')}</span></span><Icon n="next" /></Link>
      {profile?.role === 'customer' && <Link to="/maid/apply" className="listrow" style={{ color: 'var(--ink)' }}><span className="rico"><Icon n="team" /></span><span style={{ flex: 1 }}><b>{t('become_maid')}</b>{maidApp && <span className="small muted">{t('m_wait')}</span>}</span><Icon n="next" /></Link>}
      <button className="listrow" onClick={() => setLang(lang === 'th' ? 'en' : 'th')}><span className="rico"><Icon n="chat" /></span><b style={{ flex: 1 }}>{t('language')}: {lang === 'th' ? 'ไทย' : 'English'}</b></button>
      <button className="listrow" onClick={async () => { await sb.auth.signOut(); nav('/') }}><span className="rico"><Icon n="logout" /></span><b style={{ flex: 1 }}>{t('logout')}</b></button>
    </div>
    {profile?.role === 'maid' ? null : <CustomerTabs />}
  </div>
}

export function Addresses() {
  const { t } = useI18n(); const { list, reload } = useAddresses(); const [adding, setAdding] = useState(false)
  return <div className="page nobar"><TopBar title={t('my_addresses')} />
    <div className="pad mt16 stack">
      {list?.length === 0 && !adding && <div className="empty"><Icon n="pin" size={40} style={{ color: '#C9DDEC' }} /><div className="disp mt8" style={{ fontWeight: 600 }}>{t('no_address')}</div></div>}
      {list?.map(a => <div key={a.id} className="choice"><Icon n="pin" style={{ color: 'var(--ocean)' }} /><span><b>{a.label}</b><span className="small muted">{a.address}</span></span></div>)}
      {adding ? <AddressForm onSaved={() => { setAdding(false); reload() }} /> : <button className="btn b-ocean" onClick={() => setAdding(true)}>{t('add_address')}</button>}
      <div className="infonote"><Icon n="lock" />{t('addr_private')}</div>
    </div></div>
}

export function Favorites() {
  const { t } = useI18n(); const nav = useNavigate(); const { list } = useMyBookings(); const maids = useMaids()
  const ids = [...new Set((list || []).filter(b => b.status === 'completed' && b.maid_id).map(b => b.maid_id!))]
  return <div className="page nobar"><TopBar title={t('favorites')} />
    <div className="mt12">{ids.length === 0 ? <div className="pad"><div className="empty muted">{t('nothing')}</div></div> : ids.map(id => { const m = maids?.find(x => x.id === id); if (!m) return null
      return <div key={id} className="listrow"><Avatar name={m.nickname} seed={m.id} size={44} /><b style={{ flex: 1 }}>{m.nickname}</b>
        <button className="btn b-ghost sm" onClick={() => { setDraft({ maidId: id, plan: 'once' }); nav('/book/time') }}>{t('s_rebook').replace('\n', '')}</button></div> })}</div></div>
}
