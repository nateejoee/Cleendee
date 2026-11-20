import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import generatePayload from 'promptpay-qr'
import { sb, friendly, type Maid, type Rating, type Quote } from '../lib/supabase'
import { useI18n, money, fmtDate, type Key } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { getDraft, setDraft, clearDraft, startIso, bkkToday, type Draft } from '../lib/draft'
import { Avatar, Icon, Steps, TopBar, Loading, useToast } from '../components/ui'
import { useDistricts } from './Start'

export function useMaids() {
  const [maids, setMaids] = useState<(Maid & Partial<Rating>)[] | null>(null)
  useEffect(() => {
    Promise.all([sb.from('maids').select('id,nickname,bio,photo_url,status,district_id,id_verified,background_checked').eq('status', 'approved'), sb.rpc('maid_ratings')]).then(([m, r]) => {
      const rr = new Map(((r.data as Rating[]) || []).map(x => [x.maid_id, x]))
      setMaids(((m.data as Maid[]) || []).map(x => ({ ...x, ...rr.get(x.id) })).sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0)))
    })
  }, [])
  return maids
}

export function BookMaid() {
  const { t } = useI18n(); const nav = useNavigate(); const maids = useMaids()
  const [d, setD] = useState<Draft>(getDraft())
  const pick = (id: string | null) => setD(setDraft({ maidId: id }))
  return <div className="page nobar">
    <TopBar title={t('who_cleans')} /><Steps at={0} />
    <div className="pad mt16">
      <button className={'choice' + (d.maidId === null ? ' on' : '')} onClick={() => pick(null)}><span className="radio" />
        <span style={{ flex: 1 }}><b>{t('auto_pick')}</b><span className="small muted">{t('auto_pick_d')}</span></span><b className="disp">{t('free')}</b></button>
      <div className="between" style={{ margin: '18px 0 8px' }}><b className="disp">{t('or_pick')} <span className="muted small">+20 {t('baht')}</span></b><span className="small muted">{t('sorted_reviews')}</span></div>
      {!maids ? <Loading /> : <div className="stack cols">{maids.map(m => <div key={m.id} className={'card' + (d.maidId === m.id ? ' sel' : '')}>
        <button className="row" style={{ width: '100%', textAlign: 'left' }} onClick={() => pick(m.id)}>
          <Avatar name={m.nickname} url={m.photo_url} seed={m.id} size={54} />
          <span style={{ flex: 1 }}><b className="disp" style={{ fontSize: 16.5 }}>{m.nickname}</b>
            <span className="small muted" style={{ display: 'block' }}><span className="star">★</span> {m.avg_rating ?? '–'} ({m.review_count ?? 0} {t('reviews')}) · {m.jobs_done ?? 0} {t('homes_done')}</span></span>
          <span className={'radio' + (d.maidId === m.id ? ' on' : '')} /></button>
        <button className="link mt8" onClick={() => nav('/maid-profile/' + m.id)}>{t('view_profile')}</button>
      </div>)}</div>}
    </div>
    <div className="bottom-bar"><div style={{ flex: 1 }}><div className="small muted">6 ชม.{d.maidId ? ' + ' + t('pick_fee') : ''}</div><div className="price">{money(1500 + (d.maidId ? 20 : 0))} {t('baht')}</div></div>
      <button className="btn b-sun" style={{ width: 'auto', flex: 1 }} onClick={() => nav('/book/time')}>{t('next')}</button></div>
  </div>
}

export function MaidProfile() {
  const { id } = useParams(); const { t } = useI18n(); const nav = useNavigate(); const maids = useMaids()
  const [revs, setRevs] = useState<{ rating: number; comment: string | null; tags: string[]; created_at: string }[]>([])
  useEffect(() => { sb.from('reviews').select('rating,comment,tags,created_at').eq('maid_id', id!).order('created_at', { ascending: false }).limit(10).then(({ data }) => setRevs(data || [])) }, [id])
  const m = maids?.find(x => x.id === id)
  if (!m) return <Loading />
  return <div className="page nobar">
    <div className="hero" style={{ textAlign: 'center', position: 'relative' }}>
      <button className="back" onClick={() => nav(-1)} style={{ position: 'absolute', left: 14, top: 14 }} aria-label="Back"><Icon n="back" /></button>
      <div style={{ display: 'flex', justifyContent: 'center' }}><Avatar name={m.nickname} url={m.photo_url} seed={m.id} size={88} /></div>
      <h1 className="mt8">{m.nickname}</h1><p>{m.bio}</p>
      <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
        {[[`★ ${m.avg_rating ?? '–'}`, `${m.review_count ?? 0} ${t('reviews')}`], [String(m.jobs_done ?? 0), t('homes_done')]].map(([a, b]) =>
          <div key={b} style={{ background: 'rgba(255,255,255,.14)', borderRadius: 14, padding: '6px 14px' }}><b className="disp" style={{ fontSize: 17 }}>{a}</b><div className="tiny" style={{ color: '#CFE3F2' }}>{b}</div></div>)}
      </div>
    </div>
    <div className="pad"><div className="sec-title">{t('verified')}</div>
      {m.id_verified && <div className="row mt8"><span className="rico" style={{ background: 'var(--leaf-l)', color: 'var(--leaf)' }}><Icon n="check" /></span><b className="disp">{t('id_ok')}</b></div>}
      {m.background_checked && <div className="row mt8"><span className="rico" style={{ background: 'var(--leaf-l)', color: 'var(--leaf)' }}><Icon n="check" /></span><b className="disp">{t('bg_ok')}</b></div>}
      <div className="sec-title">{t('reviews')}</div>
      {revs.length === 0 ? <div className="muted">{t('no_reviews')}</div> : <div className="stack">{revs.map((r, i) => <div key={i} className="card" style={{ background: 'var(--foam)', border: 0 }}>
        <span className="star">{'★'.repeat(r.rating)}</span><div className="muted">{r.comment}</div></div>)}</div>}
    </div>
    <div className="bottom-bar"><button className="btn b-sun" onClick={() => { setDraft({ maidId: m.id }); nav('/book/time') }}>{t('choose')} {m.nickname}</button></div>
  </div>
}

export function BookTime() {
  const { t, lang } = useI18n(); const nav = useNavigate(); const [sp] = useSearchParams()
  const [d, setD] = useState<Draft>(() => { const p = sp.get('plan'); return p ? setDraft({ plan: p as Draft['plan'] }) : getDraft() })
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => bkkToday(i)), [])
  const date = d.date ?? days[1]
  const [slots, setSlots] = useState<number[] | null>(null)
  useEffect(() => {
    setSlots(null)
    sb.rpc('available_slots', { p_date: date, p_maid: d.maidId }).then(({ data }) => setSlots(((data as { start_time: string }[]) || []).map(s => Number(s.start_time.slice(0, 2)))))
  }, [date, d.maidId])
  const pkgBlocked = d.plan !== 'once' && !d.maidId
  const ok = d.hour !== null && slots?.includes(d.hour) && !pkgBlocked && d.date
  const price = d.plan === 'weekly' ? 5600 : d.plan === 'biweekly' ? 2900 : 1500 + (d.maidId ? 20 : 0)
  return <div className="page nobar">
    <TopBar title={t('pick_date')} /><Steps at={1} />
    <div className="pad mt16">
      <div className="seg">{(['once', 'biweekly', 'weekly'] as const).map(p => <button key={p} className={d.plan === p ? 'on' : ''} onClick={() => setD(setDraft({ plan: p }))}>{t(p)}</button>)}</div>
      <p className="small muted mt8">{t('pkg_note')}</p>
      {pkgBlocked && <div className="infonote mt8">{t('pkg_need_maid')} <button className="link" onClick={() => nav('/book')}>{t('choose')}</button></div>}
      <div className="sec-title">{t('date')}</div>
      <div className="cal">{days.map(x => <button key={x} className={'cd' + (x === date ? ' on' : '')} onClick={() => setD(setDraft({ date: x, hour: null }))}>
        <small>{fmtDate(x + 'T12:00:00+07:00', lang, { weekday: 'short' })}</small><b>{Number(x.slice(8))}</b></button>)}</div>
      <div className="sec-title">{t('start_time')}</div>
      {!slots ? <Loading /> : slots.length === 0 ? <div className="empty muted">{t('no_slots')}</div> :
        <div className="tgrid">{slots.map(h => <button key={h} className={'tc' + (d.hour === h && d.date === date ? ' on' : '')} onClick={() => setD(setDraft({ date, hour: h }))}>{String(h).padStart(2, '0')}:00</button>)}</div>}
      {d.hour !== null && d.date === date && <div className="ok-note mt12"><Icon n="clock" />{t('ends_at')} <b className="disp">{String(d.hour + 6).padStart(2, '0')}:00</b></div>}
    </div>
    <div className="bottom-bar"><div style={{ flex: 1 }}><div className="small muted">{t(d.plan)}</div><div className="price">{money(price)} {t('baht')}</div></div>
      <button className="btn b-sun" style={{ width: 'auto', flex: 1 }} disabled={!ok} onClick={() => nav('/book/details')}>{t('next')}</button></div>
  </div>
}

type Addr = { id: number; label: string; address: string; district_id: number }
export function useAddresses() {
  const { session } = useAuth(); const [a, setA] = useState<Addr[] | null>(null)
  const load = () => { if (session) sb.from('customer_addresses').select('*').order('id').then(({ data }) => setA((data as Addr[]) || [])) }
  useEffect(load, [session])
  return { list: a, reload: load }
}

export function AddressForm({ onSaved }: { onSaved: (id: number) => void }) {
  const { t, lang } = useI18n(); const { session } = useAuth(); const districts = useDistricts()
  const [label, setLabel] = useState(lang === 'th' ? 'บ้าน' : 'Home'); const [addr, setAddr] = useState(''); const [dist, setDist] = useState(Number(localStorage.getItem('cd_district') || 1)); const [err, setErr] = useState('')
  const save = async () => {
    setErr('')
    const { data, error } = await sb.from('customer_addresses').insert({ customer_id: session!.user.id, label, address: addr, district_id: dist }).select('id').single()
    if (error) setErr(friendly(error, lang)); else onSaved(data.id)
  }
  return <div className="card stack">
    <div className="field"><label>{t('label')}</label><input className="input" value={label} onChange={e => setLabel(e.target.value)} /></div>
    <div className="field"><label>{t('address')}</label><textarea className="input" value={addr} onChange={e => setAddr(e.target.value)} placeholder={t('addr_ph')} /></div>
    <div className="field"><label>{t('district')}</label><select className="input" value={dist} onChange={e => setDist(Number(e.target.value))}>
      {districts.map(d => <option key={d.id} value={d.id}>{lang === 'th' ? d.name_th : d.name_en}</option>)}</select></div>
    {err && <div className="err">{err}</div>}
    <button className="btn b-ocean" disabled={addr.trim().length < 5} onClick={save}>{t('save')}</button>
  </div>
}

const TAGS: Key[] = ['tag_pets', 'tag_bath', 'tag_kitchen', 'tag_kids', 'tag_noparking']
export function BookDetails() {
  const { t } = useI18n(); const nav = useNavigate(); const { session } = useAuth(); const { list, reload } = useAddresses()
  const [d, setD] = useState<Draft>(getDraft()); const [adding, setAdding] = useState(false)
  useEffect(() => { if (list && list.length && !d.addressId) setD(setDraft({ addressId: list[0].id })) }, [list])
  if (!session) return <div className="page nobar"><TopBar title={t('tell_maid')} /><div className="pad mt20 stack"><div className="infonote">{t('need_login')}</div><button className="btn b-ocean" onClick={() => nav('/login')}>{t('login')}</button></div></div>
  return <div className="page nobar">
    <TopBar title={t('tell_maid')} /><Steps at={2} />
    <div className="pad mt16">
      <h3 style={{ fontSize: 16, marginBottom: 8 }}>{t('address')}</h3>
      {!list ? <Loading /> : <div className="stack">{list.map(a => <button key={a.id} className={'choice' + (d.addressId === a.id ? ' on' : '')} onClick={() => setD(setDraft({ addressId: a.id }))}>
        <Icon n="pin" style={{ color: 'var(--ocean)' }} /><span style={{ flex: 1 }}><b>{a.label}</b><span className="small muted">{a.address}</span></span></button>)}
        {adding || list.length === 0 ? <AddressForm onSaved={id => { setAdding(false); setD(setDraft({ addressId: id })); reload() }} /> :
          <button className="link" onClick={() => setAdding(true)}>+ {t('add_address')}</button>}</div>}
      <div className="sec-title">{t('anything')}</div>
      <div className="chips">{TAGS.map(k => <button key={k} className={'chip' + (d.tags.includes(k) ? ' on' : '')} onClick={() => setD(setDraft({ tags: d.tags.includes(k) ? d.tags.filter(x => x !== k) : [...d.tags, k] }))}>{t(k)}</button>)}</div>
      <textarea className="input mt12" value={d.note} placeholder={t('note_ph')} onChange={e => setD(setDraft({ note: e.target.value }))} maxLength={500} />
      <div className="infonote mt12"><Icon n="lock" />{t('no_contact')}</div>
    </div>
    <div className="bottom-bar"><button className="btn b-sun" disabled={!d.addressId} onClick={() => nav('/book/confirm')}>{t('next')}</button></div>
  </div>
}

export function BookConfirm() {
  const { t, lang } = useI18n(); const nav = useNavigate(); const { refresh } = useAuth(); const maids = useMaids()
  const d = getDraft(); const [usePts, setUsePts] = useState(d.usePoints); const [q, setQ] = useState<Quote | null>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  useEffect(() => { if (d.plan === 'once') sb.rpc('quote_booking', { p_service_code: 'general_cleaning', p_chose_maid: !!d.maidId, p_use_points: usePts }).then(({ data }) => setQ(data as Quote)) }, [usePts])
  const m = maids?.find(x => x.id === d.maidId)
  if (!d.date || d.hour === null || !d.addressId) return <div className="page"><TopBar title={t('confirm_booking')} /><div className="pad mt20"><button className="btn b-ocean" onClick={() => nav('/book')}>{t('book_now')}</button></div></div>
  const start = startIso(d.date, d.hour)
  const pkgPrice = d.plan === 'weekly' ? 5600 : 2900
  const go = async () => {
    setBusy(true); setErr('')
    try {
      if (d.plan === 'once') {
        const { data, error } = await sb.rpc('create_booking', { p_service_code: 'general_cleaning', p_maid_id: d.maidId, p_start_at: start, p_address_id: d.addressId, p_note: d.note, p_tags: d.tags, p_use_points: usePts })
        if (error) throw error; clearDraft(); await refresh(); nav('/pay/booking/' + data, { replace: true })
      } else {
        const { data, error } = await sb.rpc('create_package', { p_plan: d.plan, p_maid_id: d.maidId, p_first_start: start, p_address_id: d.addressId, p_note: d.note, p_tags: d.tags })
        if (error) throw error; clearDraft(); nav('/pay/package/' + data, { replace: true })
      }
    } catch (e) { setErr(friendly(e, lang)) } finally { setBusy(false) }
  }
  return <div className="page nobar">
    <TopBar title={t('confirm_booking')} /><Steps at={3} />
    <div className="pad mt16 stack">
      <div className="card">
        <div className="row">{m ? <Avatar name={m.nickname} seed={m.id} url={m.photo_url} size={44} /> : <span className="rico"><Icon n="team" /></span>}
          <div><b className="disp">{m ? m.nickname : t('auto_pick')}</b><div className="small muted">{fmtDate(start, lang)} {String(d.hour).padStart(2, '0')}:00–{String(d.hour + 6).padStart(2, '0')}:00 · {t(d.plan)}</div></div></div>
        {d.plan === 'once' ? (q ? <div className="recv mt12">
          <div><span className="muted">{t('clean_6h')}</span><span>{money(q.base)}</span></div>
          {q.choose_maid_fee > 0 && <div><span className="muted">{t('pick_fee')}</span><span>{q.choose_maid_fee}</span></div>}
          {q.promo_discount > 0 && <div style={{ color: 'var(--leaf)' }}><span>{t('first_promo')}</span><span>−{q.promo_discount}</span></div>}
          {q.points_discount > 0 && <div style={{ color: 'var(--leaf)' }}><span>{t('use_points')} {q.points_used}</span><span>−{q.points_discount}</span></div>}
          <div className="tot"><span>{t('total')}</span><span>{money(q.total)} {t('baht')}</span></div></div> : <Loading />)
          : <div className="recv mt12"><div className="tot"><span>{t('total')}</span><span>{money(pkgPrice)} {t('baht')}</span></div></div>}
      </div>
      {d.plan === 'once' && q && q.points_available >= 50 && <button className={'choice' + (usePts ? ' on' : '')} onClick={() => { setUsePts(!usePts); setDraft({ usePoints: !usePts }) }}>
        <span className={'chk' + (usePts ? ' on' : '')}>{usePts && <Icon n="check" size={14} />}</span><span style={{ flex: 1 }}><b>{t('use_points')}</b><span className="small muted">{q.points_available} {t('points')}</span></span></button>}
      <div className="ok-note"><Icon n="shield" size={26} /><div><b className="disp">{t('ins_t')}</b><div>{t('ins_d')}</div></div></div>
      <div className="small muted">{t('cancel_rules')}</div>
      {err && <div className="err">{err}</div>}
    </div>
    <div className="bottom-bar"><button className="btn b-sun" disabled={busy || (d.plan === 'once' && !q)} onClick={go}>{t('create_and_pay')}</button></div>
  </div>
}

export function Pay() {
  const { kind, id } = useParams(); const { t, lang } = useI18n(); const nav = useNavigate(); const { session } = useAuth(); const toast = useToast()
  const [amount, setAmount] = useState<number | null>(null); const [pp, setPp] = useState<{ promptpay_id: string | null; promptpay_name: string | null } | null>(null)
  const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  useEffect(() => {
    sb.from('payment_settings').select('promptpay_id,promptpay_name').maybeSingle().then(({ data }) => setPp(data))
    if (kind === 'booking') sb.from('bookings').select('total_price').eq('id', id!).single().then(({ data }) => setAmount(data?.total_price ?? null))
    else sb.from('packages').select('price').eq('id', id!).single().then(({ data }) => setAmount(data?.price ?? null))
  }, [kind, id])
  const payload = pp?.promptpay_id && amount ? generatePayload(pp.promptpay_id, { amount }) : null
  const submit = async () => {
    if (!file || !session) return; setBusy(true); setErr('')
    try {
      const path = `${session.user.id}/${kind}-${id}-${Date.now()}.${file.name.split('.').pop() || 'jpg'}`
      const up = await sb.storage.from('slips').upload(path, file); if (up.error) throw up.error
      const { error } = kind === 'booking' ? await sb.rpc('submit_payment_slip', { p_booking_id: Number(id), p_slip_path: path }) : await sb.rpc('submit_package_slip', { p_package_id: Number(id), p_slip_path: path })
      if (error) throw error
      toast.show(t('slip_sent')); setTimeout(() => nav('/bookings', { replace: true }), 1200)
    } catch (e) { setErr(friendly(e, lang)) } finally { setBusy(false) }
  }
  return <div className="page nobar">
    <TopBar title={t('pay_title')} back="/bookings" />
    <div className="pad mt20 stack" style={{ alignItems: 'center', textAlign: 'center' }}>
      <div className="muted">{t('scan_pp')}</div>
      {payload ? <div className="qr"><QRCodeSVG value={payload} size={220} /></div> : <div className="infonote">{t('pp_missing')}</div>}
      {pp?.promptpay_name && <div className="small muted">{pp.promptpay_name}</div>}
      <div className="disp" style={{ fontSize: 32, fontWeight: 700 }}>{amount !== null ? money(amount) : '…'} {t('baht')}</div>
      <label className="btn b-line" style={{ cursor: 'pointer' }}><Icon n="camera" />{file ? file.name : t('attach_slip')}
        <input type="file" accept="image/*" hidden onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
      {err && <div className="err">{err}</div>}
    </div>
    <div className="bottom-bar"><button className="btn b-sun" disabled={!file || busy} onClick={submit}>{t('attach_slip')}</button></div>
    {toast.node}
  </div>
}
