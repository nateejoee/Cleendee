import { bookingStep } from '../lib/bookingMetrics'
import { SlotAlternatives } from '../components/SlotAlternatives'
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { addressForPin } from '../lib/pinAddress'
import { LocationPin, type MapPin } from '../components/LocationPin'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import generatePayload from 'promptpay-qr'
import { sb, friendly, type Maid, type Rating, type Quote2, type Service } from '../lib/supabase'
import { useServices, useAddons, svcName, svcUnit, jobHours } from '../lib/services'
import { useI18n, money, fmtDate, type Key } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { getDraft, setDraft, clearDraft, startIso, bkkToday, getAutoPicked, setAutoPicked, type Draft } from '../lib/draft'
import { Avatar, DistrictOptions, Icon, Loading, useToast } from '../components/ui'
import { BookingLayout } from './BookingLayout'
import { useServiceAreas } from '../lib/areas'
import { confetti } from '../lib/fx'

export function useMaidsLoad() {
  const [maids, setMaids] = useState<(Maid & Partial<Rating>)[] | null>(null)
  const [failed, setFailed] = useState(false); const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    Promise.all([sb.from('maids').select('id,nickname,bio,photo_url,status,district_id,id_verified,background_checked,services').eq('status', 'approved'), sb.rpc('maid_ratings')]).then(([m, r]) => {
      const rr = new Map(((r.data as Rating[]) || []).map(x => [x.maid_id, x]))
      setFailed(!!m.error)
      setMaids(((m.data as Maid[]) || []).map(x => ({ ...x, ...rr.get(x.id) })).sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0)))
    })
  }, [attempt])
  return { maids, failed, retry: () => { setFailed(false); setMaids(null); setAttempt(n => n + 1) } }
}
export function useMaids() { return useMaidsLoad().maids }

// ค่าเลือกแม่บ้านเอง และราคาแพ็กเกจ จากฐานข้อมูล (null = ยังโหลดไม่เสร็จ)
type Prices = { chooseFee: number | null; pkg: Partial<Record<'weekly' | 'biweekly', number>> | null }
let pricesCache: Prices | null = null
export function usePrices() {
  const [p, setP] = useState<Prices>(pricesCache ?? { chooseFee: null, pkg: null })
  useEffect(() => {
    Promise.all([sb.from('settings').select('choose_maid_fee').maybeSingle(), sb.from('package_plans').select('code,price')]).then(([st, pk]) => {
      const next: Prices = {
        chooseFee: st.error || !st.data ? null : Number(st.data.choose_maid_fee),
        pkg: pk.error ? null : Object.fromEntries(((pk.data as { code: string; price: number }[]) || []).map(x => [x.code, Number(x.price)])),
      }
      if (next.chooseFee !== null && next.pkg) pricesCache = next
      setP(next)
    })
  }, [])
  return p
}

// helpers this customer must not be matched with again (1-2 star rating either way)
export function useBlockedMaids() {
  const { session } = useAuth(); const [ids, setIds] = useState<string[]>([])
  useEffect(() => { if (session) sb.rpc('my_blocked_maids').then(({ data }) => setIds(((data as unknown as string[]) || []))); else setIds([]) }, [session])
  return ids
}

function bookingQuantity(draft: Draft, service: Service | undefined) {
  // แพ็กเกจรายเดือนใช้ได้กับทำความสะอาดทั่วไป 6 ชม. เท่านั้น
  const start = service ? Math.min(service.max_qty, Math.max(service.min_qty, service.default_qty ?? service.min_qty)) : 0
  return draft.plan === 'once' ? (draft.qty ?? start) : 6
}

function HelperAvatar({ maid, size = 44 }: { maid: Maid; size?: number }) {
  return maid.photo_url
    ? <Avatar name={maid.nickname} url={maid.photo_url} seed={maid.id} size={size} />
    : <span className="booking-avatar-fallback" aria-hidden="true">{maid.nickname.slice(0, 1)}</span>
}

const SelectedAddress = createContext<{ address: string; change: () => void }>({ address: '', change: () => {} })

export function BookMaid() {
  const location = useContext(SelectedAddress)
  const [params] = useSearchParams()
  const suggested = params.get('helper')
  const { t, lang } = useI18n(); const nav = useNavigate(); const { maids, failed, retry } = useMaidsLoad(); const services = useServices(); const blocked = useBlockedMaids(); const prices = usePrices()
  const [d, setD] = useState<Draft>(getDraft())
  const s = services?.find(x => x.code === d.service)
  const team = d.people === 2 && d.plan === 'once'
  // งาน 2 คน: เลือกได้สูงสุด 2 คน กดคนที่เลือกแล้วซ้ำเพื่อเอาออก ที่เหลือให้ระบบหาให้
  const pick = (id: string | null) => {
    if (!team || id === null) { setD(setDraft({ maidId: id, maid2Id: null, hour: null })); return }
    const cur = [d.maidId, d.maid2Id].filter(Boolean) as string[]
    const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id].slice(-2)
    setD(setDraft({ maidId: next[0] ?? null, maid2Id: next[1] ?? null, hour: null }))
  }
  const setPeople = (n: 1 | 2) => setD(setDraft(n === 2 ? { people: 2, plan: 'once', hour: null } : { people: 1, maid2Id: null, hour: null }))
  const chosenCount = (d.maidId ? 1 : 0) + (team && d.maid2Id ? 1 : 0)
  const list = maids?.filter(m => (m.services || []).includes(d.service) && !blocked.includes(m.id))
  if (suggested) list?.sort((a, b) => Number(b.id === suggested) - Number(a.id === suggested))
  const listReady = !!list
  const suggestedOk = !!suggested && !!list?.some(m => m.id === suggested)
  // มาจาก "เลือกแม่บ้านคนนี้": เลือกให้เลย (ครั้งเดียว) ถ้าคนนี้รับบริการนี้และไม่ถูกบล็อก
  useEffect(() => {
    if (!listReady || !suggested) return
    // จำไว้ใน sessionStorage ว่าเลือกคนนี้ให้แล้ว: กดย้อนกลับมาจะไม่เลือกทับสิ่งที่ลูกค้าเปลี่ยนเอง
    const autoPicked = getAutoPicked() === suggested
    if (suggestedOk && !autoPicked) { setAutoPicked(suggested); if (getDraft().maidId !== suggested) setD(setDraft({ maidId: suggested, hour: null })) }
    else if (!suggestedOk && autoPicked && getDraft().maidId === suggested) setD(setDraft({ maidId: null, hour: null }))
  }, [listReady, suggested, suggestedOk])
  const qty = bookingQuantity(d, s)
  const pkgPrice = d.plan === 'weekly' || d.plan === 'biweekly' ? prices.pkg?.[d.plan] : undefined
  // ราคาครั้งเดียวใช้ราคาจากเซิร์ฟเวอร์ (รวมส่วนลดจองครั้งแรก) ระหว่างโหลด/ผิดพลาดใช้ราคาประมาณในเครื่อง
  const [q, setQ] = useState<{ key: string; total: number } | null>(null)
  const quoteKey = JSON.stringify([s?.code, qty, d.addons, chosenCount, team])
  useEffect(() => {
    if (!s || d.plan !== 'once') return
    let active = true
    sb.rpc('quote_booking_v2', { p_service_code: s.code, p_qty: qty, p_addons: d.addons, p_chose_maid: chosenCount > 0, p_start_at: null, p_use_points: false, p_promo: null, p_people: team ? 2 : 1, p_chosen: chosenCount })
      .then(({ data, error }) => { if (active && !error && data) setQ({ key: quoteKey, total: Number((data as Quote2).total) }) })
    return () => { active = false }
  }, [quoteKey, d.plan])
  const serverTotal = q && q.key === quoteKey && Number.isFinite(q.total) ? q.total : null
  const amount = d.plan === 'weekly' || d.plan === 'biweekly'
    ? (pkgPrice !== undefined ? money(pkgPrice) : '…') // แพ็กเกจไม่มีค่าเลือกแม่บ้าน
    : serverTotal !== null ? money(serverTotal)
    : s && (!chosenCount || prices.chooseFee !== null) ? money(qty * s.price_per_unit * (team ? 2 : 1) + chosenCount * (prices.chooseFee ?? 0)) : '…'
  const quantityLabel = s ? qty + ' ' + svcUnit(s, lang) + (team ? (lang === 'th' ? ' × 2 คน' : ' × 2 helpers') : '') : ''
  const picked = [d.maidId, team ? d.maid2Id : null].filter(Boolean).map(id => list?.find(m => m.id === id)?.nickname).filter(Boolean) as string[]
  const th = lang === 'th'

  return <BookingLayout title={t('who_cleans')} service={s ? svcName(s, lang) : undefined} step={0}
    action={{ label: t('next'), onClick: () => nav('/book/time') }}
    price={amount + ' ' + t('baht')} priceLabel={t('booking_estimate')}
    meta={[quantityLabel, picked.length ? picked.join(', ') : null].filter(Boolean).join(' · ')}>
    <div className="booking-stack">
      <button type="button" className="booking-address" onClick={location.change}>
        <Icon n="pin" size={18} /><span>{location.address}</span><b>{t('change')}</b>
      </button>
      {s?.allow_team && d.plan === 'once' && <section className="booking-panel team-picker" aria-labelledby="team-title">
        <h2 id="team-title">{th ? 'จำนวนแม่บ้าน' : 'Number of helpers'}</h2>
        <div className="seg-cards">{([1, 2] as const).map(n => <button key={n} type="button" aria-pressed={(team ? 2 : 1) === n} className={'seg-card' + ((team ? 2 : 1) === n ? ' on' : '')} onClick={() => setPeople(n)}>
          <span className="seg-ic">{n === 1 ? <Icon n="user" size={20} /> : <Icon n="team" size={20} />}</span>
          <b>{n === 1 ? (th ? '1 คน' : '1 helper') : (th ? '2 คน' : '2 helpers')}</b>
          <small>{n === 1 ? (th ? 'งานทั่วไป' : 'Regular job') : (th ? 'เสร็จไวขึ้นเกือบครึ่ง' : 'Done in about half the time')}</small></button>)}</div>
        {team && <p className="small muted">{th ? 'คิดราคาตามจำนวนคน × ชั่วโมง เลือกแม่บ้านเองได้สูงสุด 2 คน คนที่ไม่ได้เลือกระบบจะหาให้' : 'Price is helpers × hours. Pick up to 2 helpers; we find the rest.'}</p>}
      </section>}
      <div className={'booking-option' + (chosenCount === 0 ? ' is-selected' : '')}>
        <button type="button" className="booking-option-select" aria-pressed={chosenCount === 0} onClick={() => pick(null)}>
          <span className="booking-option-icon"><Icon n="team" size={21} /></span>
          <span className="booking-option-info">
            <strong>{team ? (th ? 'ให้เราหาให้ทั้ง 2 คน' : 'Find both helpers for me') : t('auto_pick')}</strong>
            <span className="booking-option-meta">{t('auto_pick_d')}</span>
          </span>
          <span className="booking-option-tail"><span className="booking-option-radio" aria-hidden="true" />{t('free')}</span>
        </button>
      </div>

      <section aria-labelledby="manual-helper-title">
        <div className="booking-section-heading">
          <h2 id="manual-helper-title">{t('or_pick')}</h2>
          {d.plan === 'once' && <span>+{prices.chooseFee ?? '…'} {t('baht')}{team ? (th ? ' / คน' : ' each') : ''}</span>}
        </div>
        {failed ? <div className="empty stack" role="status"><p className="muted">{t('load_failed')}</p>
          <button className="btn b-line" type="button" onClick={retry}>{t('try_again')}</button></div>
          : !list ? <Loading /> : list.length === 0 ? <div className="empty muted">{t('no_maid_for_service')}</div> :
          <div className="booking-option-list">{list.map(m => {
            const selected = d.maidId === m.id || (team && d.maid2Id === m.id)
            const order = team && selected ? (d.maidId === m.id ? 1 : 2) : null
            return <article key={m.id} className={'booking-option' + (selected ? ' is-selected' : '')}>
              <button type="button" className="booking-option-select" aria-pressed={selected} onClick={() => pick(m.id)}>
                <HelperAvatar maid={m} />
                <span className="booking-option-info">
                  <strong>{m.nickname}</strong>
                  <span className="booking-option-meta">
                    {m.review_count ? <><span className="star" aria-hidden="true">★</span> {m.avg_rating ?? '–'} ({m.review_count} {t('reviews')})</> : t('no_reviews')}
                    {' · '}{m.jobs_done ?? 0} {t('homes_done')}
                  </span>
                </span>
                {order ? <span className="team-badge" aria-label={th ? 'คนที่ ' + order : 'Helper ' + order}>{order}</span> : <span className={'booking-option-radio' + (team ? ' sq' : '')} aria-hidden="true" />}
              </button>
              <Link to={'/maid-profile/' + m.id} className="booking-profile-link" aria-label={t('view_profile') + ' · ' + m.nickname}>
                {t('view_profile')}<Icon n="next" size={14} />
              </Link>
            </article>
          })}</div>}
      </section>
    </div>
  </BookingLayout>
}

export function MaidProfile() {
  const { id } = useParams(); const { t } = useI18n(); const nav = useNavigate(); const { maids, failed, retry } = useMaidsLoad(); const blocked = useBlockedMaids()
  const [revs, setRevs] = useState<{ rating: number; comment: string | null; tags: string[]; created_at: string }[]>([])
  useEffect(() => { sb.from('reviews').select('rating,comment,tags,created_at').eq('maid_id', id!).order('created_at', { ascending: false }).limit(10).then(({ data }) => setRevs(data || [])) }, [id])
  const m = maids?.find(x => x.id === id)
  if (failed) return <BookingLayout title={t('reviews_title')}><section className="booking-panel stack" role="status"><p className="muted">{t('load_failed')}</p>
    <button className="btn b-line" type="button" onClick={retry}>{t('try_again')}</button></section></BookingLayout>
  if (maids && (!m || blocked.includes(m.id))) return <BookingLayout title={t('reviews_title')}><section className="booking-panel"><p className="muted">{t('not_available')}</p></section></BookingLayout>
  if (!m) return <Loading />
  return <BookingLayout title={m.nickname}
    action={{ label: t('choose') + ' ' + m.nickname, onClick: () => { setDraft({ maidId: null, hour: null }); setAutoPicked(null); nav('/book?helper=' + encodeURIComponent(m.id)) } }}>
    <div className="booking-stack">
      <section className="booking-panel">
        <div className="booking-profile-intro">
          <HelperAvatar maid={m} size={70} />
          <div>
            {m.bio && <p>{m.bio}</p>}
            <div className="booking-profile-stats small muted">
              {m.review_count ? <span><span className="star" aria-hidden="true">★</span> {m.avg_rating ?? '–'} · {m.review_count} {t('reviews')}</span> : <span>{t('no_reviews')}</span>}
              <span>{m.jobs_done ?? 0} {t('homes_done')}</span>
            </div>
          </div>
        </div>
        {(m.id_verified || m.background_checked) && <div className="booking-profile-checks">
          {m.id_verified && <span><Icon n="check" size={16} />{t('id_ok')}</span>}
          {m.background_checked && <span><Icon n="check" size={16} />{t('bg_ok')}</span>}
        </div>}
      </section>
      <section className="booking-panel"><FreeDays maidId={m.id} /></section>
      <section className="booking-panel">
        <h2>{t('reviews_title')}</h2>
        {revs.length === 0 ? <p className="muted">{t('no_reviews')}</p> : <div className="stack">
          {revs.map((r, i) => <div key={i} className="booking-review">
            <span className="star" aria-label={r.rating + ' / 5'}>{'★'.repeat(r.rating)}</span>
            {r.tags?.length > 0 && <div className="chips" style={{ marginTop: 4 }}>{r.tags.map(x => <span key={x} className="chip">{t(x as Key)}</span>)}</div>}
            {r.comment && <p>{r.comment}</p>}
          </div>)}
        </div>}
      </section>
    </div>
  </BookingLayout>
}

// วันที่แม่บ้านคนนี้ว่าง (14 วันข้างหน้า) กดแล้วไปเลือกเวลาได้เลย
function FreeDays({ maidId }: { maidId: string }) {
  const { t, lang } = useI18n(); const nav = useNavigate(); const d = getDraft(); const services = useServices()
  const s = services?.find(x => x.code === d.service)
  const hours = jobHours(s, bookingQuantity(d, s), [])
  const [days, setDays] = useState<string[] | null>(null)
  useEffect(() => { if (s) sb.rpc('maid_free_days', { p_maid: maidId, p_service_code: s.code, p_hours: hours }).then(({ data }) => setDays((data as string[]) || [])) }, [maidId, s?.code, hours])
  return <><h2>{t('free_days')}</h2>
    {!days ? <Loading /> : days.length === 0 ? <div className="muted">{t('no_free_days')}</div> :
      <div className="cal">{days.map(x => <button key={x} className="cd" onClick={() => { setDraft({ maidId: null, date: x, hour: null }); setAutoPicked(null); nav('/book?helper=' + encodeURIComponent(maidId)) }}>
        <small>{fmtDate(x + 'T12:00:00+07:00', lang, { weekday: 'short' })}</small><b>{Number(x.slice(8))}</b></button>)}</div>}</>
}

export function BookTime() {
  const { t, lang } = useI18n(); const nav = useNavigate(); const [sp] = useSearchParams(); const services = useServices(); const allAddons = useAddons(); const prices = usePrices()
  const urgentMode = sp.get('urgent') === '1'
  const [d, setD] = useState<Draft>(() => {
    const p = sp.get('plan'); const cur = p === 'weekly' || p === 'biweekly' ? setDraft({ plan:p, service:'general_cleaning' }) : getDraft()
    // วันที่ในร่างเก่าอาจผ่านไปแล้ว (เปิดแท็บค้างข้ามคืน) ให้เป็นวันนี้และล้างเวลา
    return cur.date && cur.date < bkkToday() ? setDraft({ date: bkkToday(), hour: null }) : cur
  })
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => bkkToday(i)), [])
  const date = d.date ?? (urgentMode ? days[0] : days[1])
  const s = services?.find(x => x.code === d.service)
  const isPkg = d.plan !== 'once'
  const team = !isPkg && d.people === 2 && !!s?.allow_team
  const maid2 = team ? d.maid2Id : null
  const chosenCount = (d.maidId ? 1 : 0) + (maid2 ? 1 : 0)
  const qty = bookingQuantity(d, s)
  const addons = (allAddons || []).filter(a => a.active && a.service_codes.includes(d.service))
  const chosen = isPkg ? [] : addons.filter(a => d.addons.includes(a.code))
  const hours = jobHours(s, qty, chosen)
  const [slots, setSlots] = useState<{ h: number; urgent: boolean }[] | null>(null)
  const [q, setQ] = useState<Quote2 | null>(null)
  const [slotError, setSlotError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [loadedKey, setLoadedKey] = useState('')
  const slotKey = JSON.stringify([date, d.maidId, maid2, team, s?.code, hours, d.plan])
  useEffect(() => {
    if (!s) return
    let active = true
    setSlots(null); setSlotError(false)
    sb.rpc('booking_times', { p_date: date, p_maid: d.maidId, p_service_code: s.code, p_hours: hours, p_plan: d.plan, p_maid2: maid2, p_people: team ? 2 : 1 })
      .then(({ data, error }) => {
        if (!active) return
        setSlotError(!!error); setLoadedKey(slotKey)
        const rows = (data ?? []) as { start_time: string; urgent: boolean }[]
        setSlots(rows.map(x => ({ h: Number(x.start_time.slice(0, 2)), urgent: x.urgent })))
        if (!error && !rows.length && (!isPkg || d.maidId)) void bookingStep(s.code, 'full')
      })
    return () => { active = false }
  }, [slotKey, retry])
  const picked = loadedKey === slotKey && d.hour !== null && d.date === date ? slots?.find(x => x.h === d.hour) : undefined
  useEffect(() => {
    if (!s || isPkg) return
    sb.rpc('quote_booking_v2', { p_service_code: s.code, p_qty: qty, p_addons: d.addons, p_chose_maid: chosenCount > 0, p_start_at: picked ? startIso(date, picked.h) : null, p_people: team ? 2 : 1, p_chosen: chosenCount })
      .then(({ data }) => setQ(data as Quote2))
  }, [s?.code, qty, d.addons.join(), d.maidId, maid2, team, picked?.h, date, isPkg])
  if (!services) return <Loading />
  if (!s) return <BookingLayout title={t('pick_date')} step={1}><div className="empty muted">{t('service_closed')}</div></BookingLayout>
  const pkgBlocked = isPkg && !d.maidId
  const ok = !!picked && !pkgBlocked
  const price = d.plan === 'weekly' || d.plan === 'biweekly' ? (prices.pkg?.[d.plan] ?? null) : (q?.total ?? null)
  const discounted = !(d.plan === 'weekly' || d.plan === 'biweekly') && !!q && q.promo_discount > 0
  const unit = svcUnit(s, lang)
  const selectedDate = fmtDate(date + 'T12:00:00+07:00', lang, { weekday: 'long', month: 'long', day: 'numeric' })
  const quantityLabel = isPkg ? t(d.plan) : qty + ' ' + unit + (team ? (lang === 'th' ? ' × 2 คน' : ' × 2 helpers') : '')
  const timeLabel = picked ? String(picked.h).padStart(2, '0') + ':00' : ''

  return <BookingLayout title={t('pick_date')} service={svcName(s, lang)} step={1}
    action={{ label: t('next'), disabled: !ok, onClick: () => { setDraft({ qty }); nav('/book/details') } }}
    price={(price !== null ? money(price) : '…') + ' ' + t('baht')} priceLabel={t('booking_estimate')}
    was={discounted && q ? money(q.total + q.promo_discount) + ' ' + t('baht') : undefined}
    saving={discounted && q ? (q.promo_code ? t('promo_code') + ' ' + q.promo_code : t('first_promo')) + ' −' + money(q.promo_discount) + ' ' + t('baht') : undefined}
    meta={[quantityLabel, chosen.length ? chosen.length + ' ' + t('addons') : null, timeLabel].filter(Boolean).join(' · ')}>
    <div className="booking-stack">
      {(s.code === 'general_cleaning' || !isPkg) && <section className="booking-panel">
        {s.code === 'general_cleaning' && !team && <>
          <h2>{t('booking_frequency')}</h2>
          <div className="plan-grid">{(['once', 'biweekly', 'weekly'] as const).map(p =>
            <button key={p} aria-pressed={d.plan === p} className={'plan-card' + (d.plan === p ? ' chosen' : '')} onClick={() => setD(setDraft({ plan: p, hour: null }))}>
              <span className="between"><b>{t(p)}</b><span className="radio" aria-hidden="true" /></span>
              <strong>{p === 'once' ? money(s.min_qty * s.price_per_unit) : prices.pkg?.[p] !== undefined ? money(prices.pkg[p]) : '…'} ฿</strong>
              <small>{p === 'once' ? t('min_qty') + ' ' + s.min_qty + ' ' + unit : (p === 'weekly' ? '4' : '2') + (lang === 'th' ? ' ครั้ง · ครั้งละ 6 ชม.' : ' visits · 6 h each')}</small>
            </button>)}</div>
          <p className="small muted">{t('pkg_note')}</p>
        </>}
        {pkgBlocked && <div className="infonote">{t('pkg_need_maid')} <button className="link" onClick={() => nav('/book')}>{t('choose')}</button></div>}
        {!isPkg && <>
          <h2>{s.pricing === 'hourly' ? t('how_long') : t('how_many')}{team && <span className="small muted"> {lang === 'th' ? '(ต่อคน · แม่บ้าน 2 คนทำพร้อมกัน)' : '(each · 2 helpers work together)'}</span>}</h2>
          <div className="chips">{Array.from({ length: s.max_qty - s.min_qty + 1 }, (_, i) => s.min_qty + i).map(n =>
            <button key={n} aria-pressed={n === qty} className={'chip' + (n === qty ? ' on' : '')} onClick={() => setD(setDraft({ qty: n, hour: null }))}>{n} {unit}</button>)}</div>
          {s.pricing === 'hourly' && <p className="small muted">{t('qty_hint')}</p>}
        </>}
      </section>}
      {isPkg && pkgBlocked && s.code !== 'general_cleaning' && <div className="infonote">{t('pkg_need_maid')} <button className="link" onClick={() => nav('/book')}>{t('choose')}</button></div>}
      {!isPkg && addons.length > 0 && <section className="booking-panel">
        <h2>{t('addons')}</h2>
        <div className="stack">{addons.map(a => {
          const on = d.addons.includes(a.code)
          return <button key={a.code} className={'choice' + (on ? ' on' : '')} aria-pressed={on} onClick={() => setD(setDraft({ addons: on ? d.addons.filter(x => x !== a.code) : [...d.addons, a.code], hour: null }))}>
            <span className={'chk' + (on ? ' on' : '')}>{on && <Icon n="check" size={14} />}</span>
            <span className="booking-grow"><b>{lang === 'th' ? a.name_th : a.name_en}</b><span className="small muted">+{a.minutes} {t('minutes')}</span></span>
            <b>+{money(a.price)}</b>
          </button>
        })}</div>
      </section>}
      <section className="booking-panel">
        <div className="booking-date-heading"><h2>{t('date')}</h2><span className="small muted">{selectedDate}</span></div>
        <div className="cal">{days.map(x => <button key={x} className={'cd' + (x === date ? ' on' : '')}
          aria-label={fmtDate(x + 'T12:00:00+07:00', lang, { weekday: 'long', month: 'long', day: 'numeric' })} aria-pressed={x === date}
          onClick={() => setD(setDraft({ date: x, hour: null }))}>
          <small>{fmtDate(x + 'T12:00:00+07:00', lang, { weekday: 'short' })}</small><b>{Number(x.slice(8))}</b>
        </button>)}</div>
        <h2>{t('start_time')}</h2>
        {loadedKey !== slotKey || !slots ? <Loading /> : slotError ? <button className="btn b-line" onClick={() => setRetry(n => n+1)}>{lang === 'th' ? 'โหลดคิวไม่สำเร็จ · ลองอีกครั้ง' : 'Could not load times · Retry'}</button> :
          slots.length === 0 ? (pkgBlocked ? <p>{t('pkg_need_maid')}</p> : team ? <p className="muted">{lang === 'th' ? 'วันนี้ไม่มีเวลาที่แม่บ้านว่างพร้อมกัน 2 คน ลองเลือกวันอื่น' : 'No time with 2 free helpers on this day. Try another day.'}</p> : <SlotAlternatives key={slotKey} date={date} maid={d.maidId} service={s.code} hours={hours} plan={d.plan} choose={row => {
            void bookingStep(s.code, 'alternative')
            setD(setDraft({ date: row.visit_date, hour: Number(row.slot_time.slice(0, 2)), maidId: row.helper_id }))
          }} />) :
          <div className="tgrid">{slots.map(x => <button key={x.h} aria-pressed={picked?.h === x.h} className={'tc' + (picked?.h === x.h ? ' on' : '')} onClick={() => setD(setDraft({ date, hour: x.h }))}>
            {String(x.h).padStart(2, '0')}:00{x.urgent && <span className="tiny booking-urgent">{t('urgent_tag')}</span>}
          </button>)}</div>}
        {picked && <div className="ok-note"><Icon n="clock" />{t('work_hours').replace('{h}', String(hours))} <b>{String(picked.h + hours).padStart(2, '0')}:00</b></div>}
        {picked?.urgent && q && q.urgent_fee > 0 && <div className="infonote"><Icon n="clock" />{t('urgent_fee_note').replace('{fee}', money(q.urgent_fee))}</div>}
      </section>
    </div>
  </BookingLayout>
}

type Addr = { gps_accuracy_m: number | null; id: number; label: string; address: string; district_id: number; lat: number | null; lng: number | null }
export function useAddresses() {
  const { session } = useAuth(); const [a, setA] = useState<Addr[] | null>(null)
  const load = () => { if (session) sb.from('customer_addresses').select('*').eq('customer_id',session.user.id).order('id').then(({ data }) => setA((data as Addr[]) || [])) }
  useEffect(load, [session])
  return { list: a, reload: load }
}

function hasPrecisePin(address: Addr) {
  return address.lat != null && address.lng != null
}
export function AddressForm({ onSaved, existing, onDeleted }: { onSaved: (id: number) => void; existing?: Addr; onDeleted?: () => void }) {
  const { t, lang } = useI18n(); const { session } = useAuth(); const { districts, provinces, groups, open } = useServiceAreas()
  const th = lang === 'th'
  const [label, setLabel] = useState(existing?.label ?? (th ? 'บ้าน' : 'Home'))
  const [addr, setAddr] = useState(existing?.address ?? '')
  const [dist, setDist] = useState(existing?.district_id ?? Number(localStorage.getItem('cd_district') || 1))
  const startPoint: [number, number] | null = existing?.lat != null && existing?.lng != null ? [existing.lat, existing.lng] : null
  const [fix, setFix] = useState<MapPin | null>(startPoint ? { point: startPoint, accuracy: existing?.gps_accuracy_m ?? null } : null)
  const [lookup, setLookup] = useState<'idle' | 'loading' | 'done' | 'missing'>(startPoint ? 'done' : 'idle')
  const [found,setFound] = useState<{district?: string; province?: string}>({})
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [confirmDelete, setConfirmDelete] = useState(false)
  const typed = useRef(!!existing?.address) // the customer wrote the address; don't overwrite it from the map
  const place = (next: MapPin | null) => { setFix(next); setErr('') }
  useEffect(() => {
    if (!fix || typed.current) return
    let current = true
    setLookup('loading')
    const controller = new AbortController()
    const wait = setTimeout(() => {
      const timer = setTimeout(() => controller.abort(), 6000)
      addressForPin(fix.point, controller.signal).then(result => {
        if (!current || typed.current) return
        setAddr(result.text); setFound({district: result.district, province: result.province}); setLookup(result.text ? 'done' : 'missing')
      }).catch(() => { if (current) setLookup('missing') }).finally(() => clearTimeout(timer))
    }, 500)
    return () => { current = false; clearTimeout(wait); controller.abort() }
  }, [fix])
  useEffect(() => {
    // the pin's province (DOPA code) -> provinces.code, then the district by its Thai name
    const prov = provinces?.find(p => p.dopa_code === found.province)
    const match = prov && districts.find(d => d.province_code === prov.code && d.name_th === found.district)
    if (match) setDist(match.id)
  }, [districts,provinces,found])
  const current = districts.find(d => d.id === dist)
  const currentProv = current && provinces?.find(p => p.code === current.province_code)
  const closed = !!current && !!provinces && !open.some(d => d.id === dist)
  const save = async () => {
    if (!session || !fix || busy || lookup === 'loading' || !addr.trim()) return
    setBusy(true); setErr('')
    const values = {label:label.trim(),address:addr.trim(),district_id:dist,lat:fix.point[0],lng:fix.point[1],gps_accuracy_m:fix.accuracy}
    const query = existing ? sb.from('customer_addresses').update(values).eq('id', existing.id).eq('customer_id',session.user.id)
      : sb.from('customer_addresses').insert({...values,customer_id:session.user.id})
    const { data,error } = await query.select('id').single()
    setBusy(false)
    if (error) setErr(friendly(error,lang)); else onSaved(data.id)
  }
  const remove = async () => {
    if (!session || !existing || busy) return
    setBusy(true); setErr('')
    const { error } = await sb.from('customer_addresses').delete().eq('id', existing.id).eq('customer_id',session.user.id)
    setBusy(false)
    if (error) setErr(friendly(error,lang)); else onDeleted?.()
  }
  return <div className="card stack">
    <label className="field">{t('label')}<input className="input" value={label} onChange={e => setLabel(e.target.value)} /></label>
    <LocationPin start={startPoint} onPin={place} disabled={busy} />
    {fix && <small role="status">{lookup === 'loading' ? (th ? 'กำลังเติมที่อยู่จากหมุด…' : 'Looking up the address…') : lookup === 'missing' ? (th ? 'ค้นที่อยู่ไม่พบ กรุณากรอกที่อยู่สำหรับหมุดนี้' : 'No address found. Enter the address for this pin.') : (th ? 'ตรวจที่อยู่และเติมบ้านเลขที่หรือซอย หากแผนที่หาไม่พบ' : 'Review the address and add a missing house number or lane.')}</small>}
    <label className="field">{t('address')}<textarea disabled={!fix || lookup === 'loading' || busy} className="input" value={addr} onChange={e => { typed.current = true; setLookup('done'); setAddr(e.target.value) }} placeholder={t('addr_ph')} /></label>
    <label className="field">{t('district')}<select className="input" value={dist} onChange={e => setDist(Number(e.target.value))}><DistrictOptions groups={groups} keep={current} /></select></label>
    {closed && <div className="infonote small" role="status"><Icon n="pin" />{t('loc_not_open').replace('{place}', currentProv && !currentProv.active ? (th ? 'จ.' + currentProv.name_th : currentProv.name_en) : (th ? 'อ.' + current.name_th : current.name_en))}</div>}
    <small><a href="/geo/NOTICE.txt" target="_blank" rel="noreferrer">GeoThai · OCHA COD-AB · Royal Thai Survey Department</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a></small>
    {err && <div className="err" role="alert">{err}</div>}
    <button className="btn b-ocean" disabled={busy || lookup === 'loading' || !fix || !label.trim() || addr.trim().length < 5} onClick={save}>{t('save')}</button>
    {existing && onDeleted && (confirmDelete
      ? <div className="row"><button className="btn b-ghost" disabled={busy} onClick={() => setConfirmDelete(false)}>{th ? 'ยกเลิก' : 'Cancel'}</button><button className="btn b-red" disabled={busy} onClick={remove}>{th ? 'ยืนยันลบที่อยู่' : 'Confirm delete'}</button></div>
      : <button className="btn b-ghost" disabled={busy} onClick={() => setConfirmDelete(true)}>{th ? 'ลบที่อยู่นี้' : 'Delete this address'}</button>)}
  </div>
}

export function BookingLocation({children}: {children: ReactNode}) {
  const {list,reload} = useAddresses()
  const {lang,t} = useI18n()
  const th = lang === 'th'
  const [id,setId] = useState(getDraft().addressId)
  const [edit,setEdit] = useState<Addr | 'new' | null>(null)
  const address = list?.find(a => a.id === id)
  const choose = (next: number) => {
    const old = getDraft()
    setDraft({addressId:next, ...(old.addressId && old.addressId !== next ? {maidId:null,hour:null} : {})})
    setId(next); setEdit(null)
  }
  if (!list) return <Loading />
  if (address && hasPrecisePin(address) && !edit) return <SelectedAddress.Provider value={{address: address.address, change: () => setId(null)}}>{children}</SelectedAddress.Provider>
  return <BookingLayout title={th ? 'สถานที่รับบริการ' : 'Service location'}>
    <section className="booking-panel booking-location-panel">
      <h2>{th ? 'ให้แม่บ้านไปที่ไหน?' : 'Where do you need cleaning?'}</h2>
      {list.map(a => <div key={a.id} className="stack"><button className="choice" onClick={() => hasPrecisePin(a) ? choose(a.id) : setEdit(a)}>
        <Icon n="pin" /><span className="booking-grow"><b>{a.label}</b><span className="small muted">{a.address}</span></span><Icon n="next" size={16} />
      </button>
        {hasPrecisePin(a) && <button className="link" onClick={() => setEdit(a)}>{th ? 'ปรับหมุดของ ' : 'Adjust pin for '}{a.label}</button>}
      </div>)}
      {edit || !list.length ? <AddressForm key={typeof edit === 'object' ? edit?.id : 'new'} existing={edit && edit !== 'new' ? edit : undefined} onSaved={next => { reload(); choose(next) }} onDeleted={() => { const gone = typeof edit === 'object' && edit ? edit.id : null; if (gone && getDraft().addressId === gone) { setDraft({addressId:null,maidId:null,hour:null}); setId(null) } setEdit(null); reload() }} /> :
        <button className="btn b-line" onClick={() => setEdit('new')}><Icon n="plus" size={17} />{t('add_address')}</button>}
    </section>
  </BookingLayout>
}

const TAGS: Key[] = ['tag_pets', 'tag_bath', 'tag_kitchen', 'tag_kids', 'tag_noparking']
export function BookDetails() {
  const { t } = useI18n()
  const nav = useNavigate()
  const [d, setD] = useState<Draft>(getDraft())
  return <BookingLayout title={t('tell_maid')} step={2} action={{ label: t('next'), disabled: !d.addressId, onClick: () => nav('/book/confirm') }}>
    <section className="booking-panel">
      <h2>{t('anything')}</h2>
      <div className="chips">{TAGS.map(k => <button key={k} aria-pressed={d.tags.includes(k)} className={'chip' + (d.tags.includes(k) ? ' on' : '')} onClick={() => setD(setDraft({ tags: d.tags.includes(k) ? d.tags.filter(x => x !== k) : [...d.tags, k] }))}>{t(k)}</button>)}</div>
      <textarea className="input" aria-label={t('booking_note')} value={d.note} placeholder={t('note_ph')} onChange={e => setD(setDraft({ note: e.target.value }))} maxLength={500} />
      <div className="infonote"><Icon n="lock" />{t('no_contact')}</div>
    </section>
  </BookingLayout>
}

export function BookConfirm() {
  const location = useContext(SelectedAddress)
  const { t, lang } = useI18n(); const nav = useNavigate(); const { refresh, profile } = useAuth(); const maids = useMaids(); const services = useServices(); const allAddons = useAddons(); const prices = usePrices()
  const needPhone = !profile?.phone; const [phone, setPhone] = useState('')
  const d = getDraft(); const [usePts, setUsePts] = useState(d.usePoints); const [q, setQ] = useState<Quote2 | null>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const [code, setCode] = useState(d.promo); const [promo, setPromo] = useState(d.promo)
  const s = services?.find(x => x.code === d.service)
  const team = d.plan === 'once' && d.people === 2 && !!s?.allow_team
  const maid2 = team ? d.maid2Id : null
  const chosenCount = (d.maidId ? 1 : 0) + (maid2 ? 1 : 0)
  const start = d.date && d.hour !== null ? startIso(d.date, d.hour) : null
  useEffect(() => {
    if (d.plan !== 'once' || !start) return
    sb.rpc('quote_booking_v2', { p_service_code: d.service, p_qty: d.qty, p_addons: d.addons, p_chose_maid: chosenCount > 0, p_start_at: start, p_use_points: usePts, p_promo: promo || null, p_people: team ? 2 : 1, p_chosen: chosenCount })
      .then(({ data, error }) => { if (error) setErr(friendly(error, lang)); else setQ(data as Quote2) })
  }, [usePts, promo, team, chosenCount])
  const m = maids?.find(x => x.id === d.maidId)
  const m2 = maid2 ? maids?.find(x => x.id === maid2) : undefined
  if (!start || !d.addressId) return <BookingLayout title={t('confirm_booking')} step={3}
    action={{ label: t('book_now'), onClick: () => nav('/book') }}><p className="muted">{t('booking_missing_details')}</p></BookingLayout>
  const pkgPrice = d.plan === 'weekly' || d.plan === 'biweekly' ? prices.pkg?.[d.plan] : undefined
  const hours = q?.hours ?? 6
  const addonRows = (allAddons || []).filter(a => d.addons.includes(a.code) && a.service_codes.includes(d.service))
  const go = async () => {
    setBusy(true); setErr('')
    try {
      // ต้องมีเบอร์ติดต่อก่อนจอง (บันทึกลงบัญชี ใช้ครั้งต่อไปได้เลย)
      if (needPhone) { const { error } = await sb.rpc('set_my_phone', { p_phone: phone }); if (error) throw error; await refresh() }
      if (d.plan === 'once') {
        const { data, error } = await sb.rpc('create_booking_v2', { p_service_code: d.service, p_qty: d.qty, p_addons: d.addons, p_maid_id: d.maidId, p_start_at: start, p_address_id: d.addressId, p_note: d.note, p_tags: d.tags, p_use_points: usePts, p_promo: promo || null, p_people: team ? 2 : 1, p_maid2: maid2 })
        if (error) throw error; void bookingStep(d.service, 'booked', Number(data)); clearDraft(); await refresh(); nav('/pay/booking/' + data, { replace: true })
      } else {
        const { data, error } = await sb.rpc('create_package', { p_plan: d.plan, p_maid_id: d.maidId, p_first_start: start, p_address_id: d.addressId, p_note: d.note, p_tags: d.tags })
        if (error) throw error; void bookingStep(d.service, 'booked', Number(data), true); clearDraft(); nav('/pay/package/' + data, { replace: true })
      }
    } catch (e) { setErr(friendly(e, lang)) } finally { setBusy(false) }
  }
  const total = d.plan === 'once' ? q?.total : pkgPrice
  const time = String(d.hour).padStart(2, '0') + ':00–' + String(d.hour! + hours).padStart(2, '0') + ':00'
  const invalidQuote = d.plan === 'once' && (!q || (!!promo && !!q.promo_error))

  return <BookingLayout title={t('confirm_booking')} service={svcName(s, lang)} step={3}
    action={{ label: busy ? t('loading') : t('create_and_pay'), disabled: busy || invalidQuote || (needPhone && !/^0\d{8,9}$/.test(phone.replace(/\D/g, ''))), onClick: go }}
    price={(total === undefined ? '…' : money(total)) + ' ' + t('baht')} priceLabel={t('total')}>
    <div className="booking-stack">
      {needPhone && <section className="booking-panel">
        <h2><label htmlFor="booking-phone">{lang === 'th' ? 'เบอร์โทรติดต่อ' : 'Contact number'}</label></h2>
        <input id="booking-phone" className="input" type="tel" inputMode="tel" autoComplete="tel" maxLength={12} placeholder="08xxxxxxxx" value={phone} onChange={e => setPhone(e.target.value)} />
        <p className="small muted">{lang === 'th' ? 'แม่บ้านที่รับงานจะเห็นเบอร์นี้หลังชำระเงิน จนงานเสร็จ' : 'Your helper can see this number after payment, until the job is done'}</p>
      </section>}
      <section className="booking-panel">
        <h2>{t('booking_summary')}</h2>
        {team ? <>{[m, m2].map((x, i) => <div key={i} className="row">
          {x ? <HelperAvatar maid={x} /> : <span className="booking-option-icon"><Icon n="team" /></span>}
          <div className="booking-grow"><b>{(lang === 'th' ? 'แม่บ้านคนที่ ' : 'Helper ') + (i + 1)}: {x ? x.nickname : t('auto_pick')}</b><div className="small muted">{t(d.plan)} · {lang === 'th' ? 'ทำพร้อมกัน 2 คน' : '2 helpers together'}</div></div>
        </div>)}</> : <div className="row">
          {m ? <HelperAvatar maid={m} /> : <span className="booking-option-icon"><Icon n="team" /></span>}
          <div className="booking-grow"><b>{m ? m.nickname : t('auto_pick')}</b><div className="small muted">{t(d.plan)}</div></div>
        </div>}
        <div className="booking-appointment"><Icon n="cal" size={18} /><span>{fmtDate(start, lang)} · {time}</span></div>
        {location.address && <div className="booking-appointment"><Icon n="pin" size={18} /><span>{location.address}</span></div>}
      </section>
      {d.plan === 'once' && <>
        <section className="booking-panel">
          <h2>{t('booking_breakdown')}</h2>
          {q ? <div className="recv">
            <div><span className="muted">{svcName(s, lang)} {q.qty} {svcUnit(s, lang)}{team ? (lang === 'th' ? ' × 2 คน' : ' × 2 helpers') : ''}</span><span>{money(q.base)} {t('baht')}</span></div>
            {addonRows.map(a => <div key={a.code}><span className="muted">+ {lang === 'th' ? a.name_th : a.name_en}</span><span>{money(a.price)} {t('baht')}</span></div>)}
            {q.choose_maid_fee > 0 && <div><span className="muted">{t('pick_fee')}{chosenCount > 1 ? ' × ' + chosenCount : ''}</span><span>{money(q.choose_maid_fee)} {t('baht')}</span></div>}
            {q.urgent_fee > 0 && <div><span className="muted">{t('urgent_tag')}</span><span>{money(q.urgent_fee)} {t('baht')}</span></div>}
            {q.promo_discount > 0 && <div><span>{q.promo_code ? t('promo_code') + ' ' + q.promo_code : t('first_promo')}</span><span>−{money(q.promo_discount)} {t('baht')}</span></div>}
            {q.points_discount > 0 && <div><span>{t('use_points')} {q.points_used}</span><span>−{money(q.points_discount)} {t('baht')}</span></div>}
          </div> : <Loading />}
        </section>
        <section className="booking-panel">
          <h2><label htmlFor="booking-promo">{t('promo_code')}</label></h2>
          <form className="row booking-promo-form" onSubmit={e => { e.preventDefault(); setPromo(code.trim()); setDraft({ promo: code.trim() }) }}>
            <input id="booking-promo" className="input" value={code} onChange={e => setCode(e.target.value.toUpperCase())} />
            <button type="submit" className="btn sm b-ocean">{t('apply')}</button>
          </form>
          {q?.promo_error && promo && <div className="err" role="alert">{friendly(q.promo_error, lang)}</div>}
          {q?.promo_code && <div className="ok-note"><Icon n="ticket" />{t('promo_ok')}</div>}
          {q && !q.promo_code && q.first_discount && promo && !q.promo_error && <p className="small muted">{t('promo_first_better')}</p>}
          {q && q.points_available >= 50 && <button className={'choice' + (usePts ? ' on' : '')} aria-pressed={usePts} onClick={() => { setUsePts(!usePts); setDraft({ usePoints: !usePts }) }}>
            <span className={'chk' + (usePts ? ' on' : '')}>{usePts && <Icon n="check" size={14} />}</span>
            <span><b>{t('use_points')}</b><span className="small muted">{q.points_available} {t('points')}</span></span>
          </button>}
        </section>
      </>}
      <section className="booking-panel">
        <Link to="/guarantee" className="booking-guarantee"><Icon n="shield" size={23} /><div><b>{t('ins_t')}</b><p className="small muted">{t('ins_d')}</p></div><Icon n="next" size={14} /></Link>
        <p className="small muted">{t('cancel_rules')}</p>
      </section>
      {err && <div className="err" role="alert">{err}</div>}
    </div>
  </BookingLayout>
}

const SLIP_REJECT: Record<string, Key> = { amount_mismatch: 'slip_rej_amount', duplicate_slip: 'slip_rej_dup', wrong_receiver: 'slip_rej_receiver' }
export function Pay() {
  const { kind, id } = useParams(); const { t, lang } = useI18n(); const nav = useNavigate(); const { session } = useAuth(); const toast = useToast()
  const [amount, setAmount] = useState<number | null>(null); const [pp, setPp] = useState<{ promptpay_id: string | null; promptpay_name: string | null } | null>(null)
  const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [checking, setChecking] = useState(false); const [done, setDone] = useState(false)
  useEffect(() => {
    sb.from('payment_settings').select('promptpay_id,promptpay_name').maybeSingle().then(({ data }) => setPp(data))
    // งาน 2 คน: จ่ายครั้งเดียวรวมทั้งทีม (แถวแรกและแถวของแม่บ้านคนที่ 2)
    if (kind === 'booking') sb.from('bookings').select('total_price').or(`id.eq.${Number(id)},team_id.eq.${Number(id)}`).then(({ data }) => setAmount(data ? data.reduce((a, r) => a + r.total_price, 0) : null))
    else sb.from('packages').select('price').eq('id', id!).single().then(({ data }) => setAmount(data?.price ?? null))
  }, [kind, id])
  const payload = pp?.promptpay_id && amount ? generatePayload(pp.promptpay_id, { amount }) : null
  const submit = async () => {
    if (!file || !session || busy || done) return; setBusy(true); setErr('')
    try {
      const path = `${session.user.id}/${kind}-${id}-${Date.now()}.${file.name.split('.').pop() || 'jpg'}`
      const up = await sb.storage.from('slips').upload(path, file); if (up.error) throw up.error
      const { error } = kind === 'booking' ? await sb.rpc('submit_payment_slip', { p_booking_id: Number(id), p_slip_path: path }) : await sb.rpc('submit_package_slip', { p_package_id: Number(id), p_slip_path: path })
      if (error) throw error
      // automatic slip check (SlipOK); anything other than a clear yes/no stays with the admin as before
      setChecking(true)
      const chk = await sb.functions.invoke('verify-slip', { body: { kind, id: Number(id) } }).catch(() => null)
      setChecking(false)
      const res = (chk?.data || {}) as { status?: string; reason?: string }
      if (res.status === 'approved') { setDone(true); confetti(); toast.show(t('slip_ok')); setTimeout(() => nav(kind === 'booking' ? '/bookings/' + id : '/bookings', { replace: true }), 1800); return }
      if (res.status === 'rejected') { setFile(null); setErr(t(SLIP_REJECT[res.reason || ''] || 'slip_rej_other')); return }
      setDone(true); confetti(); toast.show(t('slip_sent')); setTimeout(() => nav('/bookings', { replace: true }), 1800)
    } catch (e) { setErr(friendly(e, lang)) } finally { setBusy(false) }
  }
  return <BookingLayout title={t('pay_title')} back="/bookings" step={3}
    action={{ label: checking ? t('slip_checking') : busy ? t('loading') : t('booking_send_slip'), disabled: !file || busy || done, onClick: submit }}
    price={(amount === null ? '…' : money(amount)) + ' ' + t('baht')} priceLabel={t('total')}>
    <div className="booking-stack">
      <section className="booking-panel booking-pay-code">
        <h2>{t('scan_pp')}</h2>
        {payload ? <div className="qr"><QRCodeSVG value={payload} size={220} /></div> : <div className="infonote">{t('pp_missing')}</div>}
        {pp?.promptpay_name && <p className="small muted">{pp.promptpay_name}</p>}
      </section>
      <section className="booking-panel">
        <h2>{t('attach_slip')}</h2>
        <label className="btn b-line booking-upload"><Icon n="camera" /><span>{file ? file.name : t('booking_pick_slip')}</span>
          <input type="file" accept="image/*" aria-label={t('attach_slip')} onChange={e => setFile(e.target.files?.[0] ?? null)} />
        </label>
        {err && <div className="err" role="alert">{err}</div>}
      </section>
    </div>
    {toast.node}
  </BookingLayout>
}
