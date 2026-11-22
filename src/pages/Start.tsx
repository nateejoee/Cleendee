import { useLiveArea, type LiveArea } from '../lib/liveArea'
import { useDistricts, useProvinces, useServiceAreas, openProvinceNames, type Province } from '../lib/areas'
import { ServiceFAQ, HoursGuide } from '../components/ServiceGuide'
import { bookingStep } from '../lib/bookingMetrics'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { sb, friendly, type District, type Service as Svc } from '../lib/supabase'
import { useI18n, localStorageSet, money, type Key } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { Avatar, Icon, Bell, LangToggle, Logo, CustomerTabs, TopBar, Loading, SiteFooter } from '../components/ui'
import { Empty } from '../components/EmptyArt'
import { setDraft, emptyDraft } from '../lib/draft'
import { useServices, useServicesLoad, svcName, svcUnit } from '../lib/services'
import { greetKey } from '../lib/fx'
import { useMaidsLoad, useBlockedMaids } from './Book'
import imgHero from '../assets/ill/hero.webp'
import { PromoArt } from '../components/BrandArt'
import { RewardsCard } from '../components/Rewards'
import { ServiceArt } from '../components/ServiceArt'
import { ART_TINT } from '../lib/serviceTint'
import { serviceImage } from '../lib/serviceImages'
import imgClean from '../assets/ill/cleaning.webp'
import imgSched from '../assets/ill/schedule.webp'
import imgSafe from '../assets/ill/safety.webp'
import imgHome from '../assets/ill/chumphon.webp'
import { useIsDesktop } from '../lib/useDesktop'
import { HomeDesktop } from './HomeDesktop'

// Text for the location pill on the home page
function placeText(live: LiveArea, provinces: Province[] | null, districts: District[], saved: District | undefined, lang: 'th' | 'en', t: (k: Key) => string) {
  const th = lang === 'th'
  const notOpen = (place: string) => t('loc_not_open').replace('{place}', place)
  if (live?.state === 'outside') return t('loc_outside')
  if (live?.state === 'in' && provinces) {
    const p = live.province, prov = provinces.find(x => x.dopa_code === p.code)
    if (!prov?.active) return notOpen(th ? 'จ.' + p.name_th : p.name_en)
    const sub = live.sub
    if (sub) {
      const dist = districts.find(x => x.province_code === prov.code && x.name_th === sub.district)
      if (districts.length && !dist?.active) return notOpen(th ? 'อ.' + sub.district : sub.district_en)
      return th ? 'ต.' + sub.subdistrict + ' อ.' + (sub.district === 'เมือง' + p.name_th ? 'เมือง' : sub.district) : sub.district_en + ', ' + p.name_en
    }
    return th ? 'จ.' + p.name_th : p.name_en
  }
  const sp = saved && provinces?.find(x => x.code === saved.province_code)
  if (saved) return th ? 'อ.' + saved.name_th + (sp ? ' ' + sp.name_th : '') : saved.name_en + (sp ? ', ' + sp.name_en : '')
  return openProvinceNames(provinces, lang)
}

export function Onboarding() {
  const { t, lang } = useI18n(); const nav = useNavigate(); const { groups, provinces } = useServiceAreas()
  const [step, setStep] = useState(0); const [dist, setDist] = useState<number | null>(1)
  const slides = [{ img: imgSched, t: t('onb1_t'), d: t('onb1_d') }, { img: imgClean, t: t('onb2_t'), d: t('onb2_d') }, { img: imgSafe, t: t('onb3_t'), d: t('onb3_d') }]
  const finish = () => { localStorageSet('cd_onboarded', '1'); if (dist) localStorageSet('cd_district', String(dist)); nav('/', { replace: true }) }
  if (step === 0) return <div className="page nobar" style={{ background: 'var(--ocean)', color: '#fff' }}>
    <div className="between pad" style={{ paddingTop: 16 }}><span /><LangToggle /></div>
    <div className="onb"><Logo white h={64} /><p style={{ color: '#CFE3F2', marginTop: 12 }}>{t('tagline')}</p>
      <img src={imgHome} alt="" style={{ marginTop: 28 }} /></div>
    <div className="pad" style={{ paddingBottom: 10 }}><button className="btn b-sun" onClick={() => setStep(1)}>{t('start')}</button></div>
    <SiteFooter dark />
  </div>
  if (step === 1) return <div className="page nobar">
    <div className="pad" style={{ paddingTop: 30, textAlign: 'center' }}><h2 style={{ fontSize: 26, color: 'var(--ocean)' }}>{t('choose_area')}</h2>{openProvinceNames(provinces, lang) && <p className="muted mt8">{t('choose_area_sub').replace('{provinces}', openProvinceNames(provinces, lang))}</p>}</div>
    {groups.map(g => <div key={g.province.code}>{groups.length > 1 && <div className="pad sec-title">{lang === 'th' ? 'จ.' + g.province.name_th : g.province.name_en}</div>}
      <div className={'dist pad' + (groups.length > 1 ? '' : ' mt20')}>{g.districts.map(d => <button key={d.id} className={'di' + (dist === d.id ? ' on' : '')} onClick={() => setDist(d.id)}>{lang === 'th' ? d.name_th : d.name_en}</button>)}</div></div>)}
    <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><button className="next" onClick={() => setStep(2)} aria-label={t('next')}><Icon n="next" size={28} /></button></div>
  </div>
  const s = slides[step - 2]
  return <div className="page nobar">
    <div className="onb"><img src={s.img} alt="" /><h2>{s.t}</h2><p>{s.d}</p>
      <div className="dots">{slides.map((_, i) => <i key={i} className={i === step - 2 ? 'on' : ''} />)}</div></div>
    <div className="between" style={{ padding: '16px 26px 34px' }}>
      <button className="muted disp" onClick={finish}>{t('skip')}</button>
      <button className="next" onClick={() => (step < 4 ? setStep(step + 1) : finish())} aria-label={t('next')}><Icon n="next" size={28} /></button><span style={{ width: 30 }} /></div>
  </div>
}

const SOCIAL: { id: string; label: string; bg: string; fg: string; icon: React.ReactNode }[] = [
  { id: 'google', label: 'Google', bg: '#fff', fg: '#1F1F1F', icon: <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg> },
  { id: 'custom:line', label: 'LINE', bg: '#06C755', fg: '#fff', icon: <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden><path fill="#fff" d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9.3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.5s6-3.5 8.2-6C21.4 14.3 22 12.7 22 11c0-4.4-4.5-8-10-8z"/></svg> },
]

export function Login() {
  const { t, lang } = useI18n()
  const [err, setErr] = useState('')
  const social = async (provider: string) => {
    setErr('')
    const { error } = await sb.auth.signInWithOAuth({ provider: provider as 'google', options: { redirectTo: window.location.origin + '/' } })
    if (error) setErr(friendly(error, lang))
  }
  return <div className="page nobar">
    <TopBar title={t('login')} />
    <div className="pad stack mt20">
      <div style={{ textAlign: 'center', margin: '10px 0 8px' }}><img src="/brand/CleenDee_logo_stacked.svg" alt="CleenDee" style={{ height: 120 }} /></div>
      <p className="muted" style={{ textAlign: 'center', marginBottom: 8 }}>{t('login_with')}</p>
      {SOCIAL.map(s => <button key={s.id} className="btn" style={{ background: s.bg, color: s.fg, border: s.bg === '#fff' ? '1.5px solid var(--line)' : 0 }} onClick={() => social(s.id)}>{s.icon}{t('continue_with')} {s.label}</button>)}
      {err && <div className="err">{err}</div>}
      <p className="tiny muted" style={{ textAlign: 'center' }}>{t('login_terms')}</p>
      <SiteFooter />
    </div>
  </div>
}

// เข้าสู่ระบบของแอดมิน (ลิงก์แยก /admin/login) ใช้ไอดีและรหัสผ่าน บัญชีที่ไม่ใช่แอดมินจะถูกออกจากระบบทันที
// ไอดี (เช่น Admintee) จับคู่กับอีเมลภายใน <ไอดีตัวพิมพ์เล็ก>@cleendee.test ที่ใช้ในระบบเข้าสู่ระบบ
const ADMIN_DOMAIN = '@cleendee.test'
export function AdminLogin() {
  const { t, lang } = useI18n(); const nav = useNavigate(); const { refresh } = useAuth(); const th = lang === 'th'
  const [id, setId] = useState(''); const [pw, setPw] = useState('')
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('')
    const user = id.trim().toLowerCase()
    if (!/^[a-z0-9._-]+$/.test(user)) { setErr(th ? 'ไอดีหรือรหัสผ่านไม่ถูกต้อง' : 'Wrong ID or password'); return }
    setBusy(true)
    try {
      const { data, error } = await sb.auth.signInWithPassword({ email: user + ADMIN_DOMAIN, password: pw })
      if (error) { setErr(th ? 'ไอดีหรือรหัสผ่านไม่ถูกต้อง' : 'Wrong ID or password'); return }
      const { data: p } = await sb.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
      if (p?.role !== 'admin') { await sb.auth.signOut(); setErr(th ? 'บัญชีนี้ไม่ใช่บัญชีแอดมิน' : 'This is not an admin account'); return }
      await refresh(); nav('/admin', { replace: true })
    } catch (e2) { setErr(friendly(e2, lang)) } finally { setBusy(false) }
  }
  return <div className="page nobar">
    <TopBar title={th ? 'เข้าสู่ระบบแอดมิน' : 'Admin sign-in'} back="/" />
    <div className="pad stack mt20">
      <div style={{ textAlign: 'center', margin: '10px 0 8px' }}><img src="/brand/CleenDee_logo_stacked.svg" alt="CleenDee" style={{ height: 96 }} /></div>
      <p className="muted" style={{ textAlign: 'center' }}>{th ? 'สำหรับผู้ดูแลระบบเท่านั้น' : 'For administrators only'}</p>
      <form className="stack" onSubmit={submit}>
        <div className="field"><label>{th ? 'ไอดี' : 'ID'}</label><input className="input" type="text" value={id} onChange={e => setId(e.target.value)} required autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} /></div>
        <div className="field"><label>{t('password')}</label><input className="input" type="password" value={pw} onChange={e => setPw(e.target.value)} required autoComplete="current-password" /></div>
        {err && <div className="err" role="alert">{err}</div>}
        <button className="btn b-ocean" disabled={busy}>{t('login')}</button></form>
    </div>
  </div>
}

export function Home() {
  const { t, lang } = useI18n(); const { profile } = useAuth(); const nav = useNavigate(); const districts = useDistricts(); const provinces = useProvinces(); const services = useServices(); const { maids: allMaids, failed: maidsFailed } = useMaidsLoad(); const blocked = useBlockedMaids(); const maids = allMaids?.filter(m => !blocked.includes(m.id))
  const distId = profile?.district_id ?? Number(localStorage.getItem('cd_district') || 1)
  const d = districts.find(x => x.id === distId)
  const live = useLiveArea() // ตำแหน่งปัจจุบันของผู้ใช้ อัปเดตเมื่อเคลื่อนที่
  const desk = useIsDesktop()
  const extra = [
    { to: '/book/time?plan=weekly', art: 'monthly', label: t('s_monthly'), svc: 'general_cleaning' },
    { to: '/account/favorites', art: 'rebook', label: t('s_rebook'), svc: '' },
  ]
  // ชื่อสั้นสำหรับช่องบริการ (ชื่อเต็มยังอยู่ในหน้ารายละเอียด)
  const SHORT: Record<string, [string, string]> = { general_cleaning: ['ทำความสะอาดบ้าน', 'Home cleaning'], deep_cleaning: ['ทำความสะอาดใหญ่', 'Deep clean'], office_cleaning: ['ออฟฟิศ / ร้านค้า', 'Office / shop'], ac_cleaning: ['ล้างแอร์', 'Air-con'], sofa_cleaning: ['ซักโซฟา', 'Sofa'], mattress_cleaning: ['ที่นอน', 'Mattress'] }
  const short = (code: string, full: string) => SHORT[code]?.[lang === 'th' ? 0 : 1] ?? full
  const open = (code: string, to: string) => { if (code) setDraft({ ...emptyDraft, service: code }); nav(to) }
  const why = [['clock', t('ben1'), t('ben1d')], ['wallet', t('ben2'), t('ben2d')], ['shield', t('ben3'), t('ben3d')]]
  const steps: [Key, Key][] = [
    ['home_step_maid', 'home_step_maid_d'],
    ['home_step_time', 'home_step_time_d'],
    ['home_step_details', 'home_step_details_d'],
    ['home_step_payment', 'home_step_payment_d'],
  ]
  const bookable = (services || []).filter(s => s.active)
  // จอคอม (≥1024px): หน้าแรกแบบเว็บไซต์ (ข้อมูลและการ์ดเริ่มจองชุดเดียวกัน) — มือถือ/แท็บเล็ตใช้ด้านล่างเหมือนเดิม
  if (desk) return <HomeDesktop quickBook={<QuickBook services={bookable} onPick={code => open(code, '/book')} />} services={services} bookable={bookable}
    maids={maids} maidsFailed={maidsFailed} extra={extra} short={short} open={open} place={placeText(live, provinces, districts, d, lang, t)}
    greeting={t(greetKey()) + (profile?.full_name ? ', ' + profile.full_name : '')} />
  return <div className="page home">
    {/* หัวหน้า: ภาพจริง + คำทักทาย + พาดหัวตัวใหญ่ แล้วการ์ด "เริ่มจอง" ซ้อนขึ้นมาจากด้านล่าง */}
    <div className="lux-hero" style={{ backgroundImage: `url(${imgHero})` }}>
      <div className="between"><span className="mob-only"><Logo white h={30} /></span><span className="lh-loc"><Icon n="pin" size={15} /><span className="lh-loc-t">{placeText(live, provinces, districts, d, lang, t)}</span></span><span className="hdr-tools"><Bell /><LangToggle /></span></div>
      <div className="lh-body">
        <div className="lh-greet">{t(greetKey())}{profile?.full_name ? ', ' + profile.full_name : ''}</div>
        <h1>{t('tagline')}</h1>
        <p>{t('hero_d')}</p>
      </div>
    </div>
    <div className="home-grid">
      <div className="hg-main">
        <QuickBook services={bookable} onPick={code => open(code, '/book')} />
        <div className="promo lux art"><div><h3>{t('promo_t')}</h3><div className="small mt8">{t('promo_d')}</div></div><PromoArt amount={100} /></div>
        <div className="pad mt16"><button className="urgent" style={{ width: '100%', textAlign: 'left' }} onClick={() => open('general_cleaning', '/book/time?urgent=1')}>
          <span className="rico" style={{ background: 'var(--card)', color: 'var(--brick)' }}><Icon n="clock" /></span>
          <span style={{ flex: 1 }}><b className="disp">{t('urgent_t')}</b><span className="small" style={{ display: 'block', color: 'var(--brick)' }}>{t('urgent_d')}</span></span><Icon n="next" /></button></div>
        <section className="pad" aria-labelledby="home-services">
          <h2 id="home-services" className="sec-title">{t('services')}</h2>
          {!services ? <Loading /> : <>
            <div className="gx-big">{bookable.slice(0, 2).map(s =>
              <button key={s.code} className="gx-hero" style={{ '--tint': ART_TINT[s.code] ?? ART_TINT.general_cleaning } as React.CSSProperties} onClick={() => open(s.code, '/service/' + s.code)}>
                <b>{short(s.code, svcName(s, lang))}</b>
                <span className="gx-art"><ServiceArt code={s.code} size={78} /></span>
              </button>)}
            </div>
            <div className="gx-grid">
              {bookable.slice(2).map(s => <button key={s.code} className="gx-tile" onClick={() => open(s.code, '/service/' + s.code)}>
                <span className="gx-ic" style={{ '--tint': ART_TINT[s.code] } as React.CSSProperties}><ServiceArt code={s.code} size={44} /></span>
                <span className="gx-name">{short(s.code, svcName(s, lang))}</span></button>)}
              {extra.map(s => <button key={s.to} className="gx-tile" onClick={() => open(s.svc, s.to)}>
                <span className="gx-ic" style={{ '--tint': ART_TINT[s.art] } as React.CSSProperties}><ServiceArt code={s.art} size={44} /></span>
                <span className="gx-name">{s.label}</span></button>)}
              {services.filter(s => !s.active && s.coming_soon).map(s => <div key={s.code} className="gx-tile soon">
                <span className="gx-ic" style={{ '--tint': ART_TINT[s.code] } as React.CSSProperties}><ServiceArt code={s.code} size={44} /><span className="gx-badge">{t('soon')}</span></span>
                <span className="gx-name">{short(s.code, svcName(s, lang))}</span></div>)}
            </div>
          </>}
        </section>
        <section className="pad" aria-labelledby="home-maids">
          <div className="between"><h2 id="home-maids" className="sec-title">{t('top_maids')}</h2><Link to="/book" className="link">{t('see_all')}</Link></div>
          {maids && maids.length === 0 ? <Empty small art={maidsFailed ? 'error' : 'search'} title={maidsFailed ? t('load_failed') : t('nothing')} /> :
            <div className="maid-rail">{(maids || []).slice(0, 8).map(m => <Link key={m.id} to={'/maid-profile/' + m.id} className="maid-tile">
              <Avatar name={m.nickname} url={m.photo_url} seed={m.id} size={64} />
              <b>{m.nickname}</b>
              <small>{m.review_count ? <><span className="star">★</span> {m.avg_rating ?? '–'} · {m.review_count} {t('reviews')}</> : t('no_reviews')}</small>
            </Link>)}</div>}
        </section>
        <section className="pad" aria-labelledby="home-why">
          <h2 id="home-why" className="sec-title">{t('why_us')}</h2>
          <Link to="/guarantee" className="trust-card">{why.map(([i, b, x]) => <span key={b} className="trust-row"><span className="trust-ic"><Icon n={i} size={20} /></span><span><b>{b}</b><small>{x}</small></span></span>)}
            <span className="trust-foot"><Icon n="shield" size={16} />{t('g_title')}: {t('g_short')}</span></Link>
        </section>
      </div>
      <aside className="hg-side">
        {profile?.role === 'customer' ? <div className="pad"><div className="sec-title">{t('my_points')}</div>
          <RewardsCard points={profile.points} onClick={() => nav('/account/rewards')} /></div>
          : <div className="pad mt20"><div className="card guestcard col"><b className="disp">{t('lw_book')}</b><Link to="/login" className="btn b-ocean">{t('login')} / {t('signup')}</Link></div></div>}
        <section className="pad" aria-labelledby="home-booking-heading">
          <h2 id="home-booking-heading" className="sec-title">{t('how_it_works')}</h2>
          <ol className="home-booking-steps" role="list">
            {steps.map(([title, description], index) => (
              <li key={title} className="home-booking-step">
                <span className="home-booking-number" aria-hidden="true">{index + 1}</span>
                <div>
                  <h3>{t(title)}</h3>
                  <p>{t(description)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
              </aside>
    </div>
    <SiteFooter />
    <CustomerTabs />
  </div>
}

// การ์ดเริ่มจอง: เลือกบริการ เห็นราคาเริ่มต้น แล้วกดเริ่มจองได้ทันที
function QuickBook({ services, onPick }: { services: Svc[]; onPick: (code: string) => void }) {
  const { t, lang } = useI18n(); const th = lang === 'th'
  const [code, setCode] = useState<string | null>(null)
  const s = services.find(x => x.code === code) ?? services[0]
  const [from, setFrom] = useState<{ code: string; total: number } | null>(null)
  useEffect(() => {
    if (!s) return
    let on = true
    sb.rpc('quote_booking_v2', { p_service_code: s.code, p_qty: s.min_qty, p_addons: [], p_chose_maid: false, p_start_at: null, p_use_points: false, p_promo: null })
      .then(({ data }) => { if (on && data) setFrom({ code: s.code, total: Number((data as { total: number }).total) }) })
    return () => { on = false }
  }, [s])
  if (!s) return null
  const price = from?.code === s.code ? from.total : s.min_qty * s.price_per_unit
  return <section className="quick-book" aria-labelledby="qb-title">
    <h2 id="qb-title">{th ? 'วันนี้ให้เราช่วยอะไรดี' : 'What can we help with?'}</h2>
    <div className="qb-services" role="radiogroup" aria-label={t('services')}>{services.map(x => <button key={x.code} type="button" role="radio" aria-checked={x.code === s.code}
      className={'qb-svc' + (x.code === s.code ? ' on' : '')} onClick={() => setCode(x.code)}><Icon n={x.icon} size={18} />{svcName(x, lang)}</button>)}</div>
    <div className="qb-foot">
      <span className="qb-price"><small>{th ? 'เริ่มต้นที่' : 'From'}</small><b>{money(price)} {t('baht')}</b><small>{s.min_qty} {svcUnit(s, lang)}{th ? ' ขึ้นไป' : ' minimum'}</small></span>
      <button type="button" className="btn b-sun qb-go" onClick={() => onPick(s.code)}>{t('book_now')}<Icon n="next" size={18} /></button>
    </div>
  </section>
}

// หน้ารายละเอียดบริการ: ราคา + รวมอะไร / ไม่รวมอะไร
export function Service() {
  const { t, lang } = useI18n(); const nav = useNavigate(); const { code = 'general_cleaning' } = useParams(); const { services, failed, retry } = useServicesLoad()
  const s = services?.find(x => x.code === code)
  useEffect(() => { if (s?.active) void bookingStep(s.code, 'view') }, [s?.active, s?.code])
  const [estimate, setEstimate] = useState<number | null>(null)
  const book = (qty: number | null = s?.code === 'general_cleaning' ? estimate : null) => { setDraft({ ...emptyDraft, service: code, qty }); nav('/book') }
  if (failed) return <div className="page nobar"><TopBar title={t('services')} /><div className="pad mt20 stack" role="status"><Empty art="error" title={t('load_failed')} />
    <button className="btn b-line" type="button" onClick={retry}>{t('try_again')}</button></div></div>
  if (!services) return <Loading />
  if (!s || !s.active) return <div className="page nobar"><TopBar title={t('services')} /><div className="pad mt20"><Empty art="closed" title={t('service_closed')} /></div></div>
  const inc = lang === 'th' ? s.included_th : s.included_en, exc = lang === 'th' ? s.excluded_th : s.excluded_en
  const ben = [['clock', t('ben1'), t('ben1d')], ['wallet', t('ben2'), t('ben2d')], ['check', t('ben3'), t('ben3d')], ['shield', t('ben4'), t('ben4d')]]
  return <div className="page nobar">
    {/* รูปบริการเต็มความกว้าง (ดู .svc-hero) */}
    <div className="svc-hero">
      <img src={serviceImage(s.code)} alt="" />
      <button className="back" onClick={() => nav(-1)} style={{ position: 'absolute', top: 14, left: 14, background: '#fff' }} aria-label="Back"><Icon n="back" /></button>
    </div>
    <div className="pad mt16"><h2 className="service-title">{svcName(s, lang)}</h2>
      <p className="service-description muted">{lang === 'th' ? s.desc_th : s.desc_en}</p>
      <div className="service-minimum mt12">
        {t('min_qty')} {s.min_qty}{'\u00a0'}{svcUnit(s, lang)} · {money(s.min_qty * s.price_per_unit)}{'\u00a0'}{t('baht')}
      </div>
      <div className="small muted">{money(s.price_per_unit)} {t('baht')} / {svcUnit(s, lang)}</div>
      {s.code === 'general_cleaning' && s.pricing === 'hourly' && <HoursGuide service={s} onBook={book} onEstimate={setEstimate} />}
      <div className="stack mt12">{ben.map(([i, b, d]) => <div key={b} className="row" style={{ alignItems: 'flex-start' }}>
        <span className="rico" style={{ background: 'var(--sun-l)', color: '#8A6200' }}><Icon n={i} /></span><div><b className="disp">{b}</b><div className="small muted">{d}</div></div></div>)}</div>
      {inc.length > 0 && <><div className="sec-title">{t('included')}</div><div className="stack">{inc.map(x => <div key={x} className="row small"><Icon n="check" size={18} style={{ color: 'var(--leaf)' }} />{x}</div>)}</div></>}
      {exc.length > 0 && <><div className="sec-title">{t('not_included')}</div><div className="stack">{exc.map(x => <div key={x} className="row small muted"><span style={{ width: 18, textAlign: 'center', color: 'var(--brick)' }}>✕</span>{x}</div>)}</div></>}
      <ServiceFAQ general={s.code === 'general_cleaning'} onBook={() => book()} />
      <div className="infonote mt16"><Icon n="clock" />{t('cancel_rules')}</div>
      <Link to="/guarantee" className="link mt12" style={{ display: 'inline-block' }}>{t('g_title')} →</Link>
    </div>
    <div className="bottom-bar"><button className="btn b-sun" onClick={() => book()}>{t('book_now')}</button></div>
  </div>
}
