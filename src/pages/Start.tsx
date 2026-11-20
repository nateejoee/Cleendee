import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { sb, friendly, type District, type Service as ServiceType } from '../lib/supabase'
import { useI18n, localStorageSet, money } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { Avatar, Icon, LangToggle, Logo, CustomerTabs, TopBar, Loading, SiteFooter } from '../components/ui'
import { setDraft, emptyDraft } from '../lib/draft'
import { useServices, svcName, svcUnit } from '../lib/services'
import { CountUp, greetKey } from '../lib/fx'
import { useMaids } from './Book'
import imgHero from '../assets/ill/hero.webp'
import imgClean from '../assets/ill/cleaning.webp'
import imgSched from '../assets/ill/schedule.webp'
import imgSafe from '../assets/ill/safety.webp'
import imgHome from '../assets/ill/chumphon.webp'

export function useDistricts() {
  const [d, setD] = useState<District[]>([])
  useEffect(() => { sb.from('districts').select('*').order('id').then(({ data }) => setD((data as District[]) || [])) }, [])
  return d
}

export function Onboarding() {
  const { t, lang } = useI18n(); const nav = useNavigate(); const districts = useDistricts()
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
    <div className="pad" style={{ paddingTop: 30, textAlign: 'center' }}><h2 style={{ fontSize: 26, color: 'var(--ocean)' }}>{t('choose_area')}</h2><p className="muted mt8">{t('choose_area_sub')}</p></div>
    <div className="dist pad mt20">{districts.map(d => <button key={d.id} className={'di' + (dist === d.id ? ' on' : '')} onClick={() => setDist(d.id)}>{lang === 'th' ? d.name_th : d.name_en}</button>)}</div>
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
  const { t, lang } = useI18n(); const nav = useNavigate(); const { refresh } = useAuth()
  const [showEmail, setShowEmail] = useState(false); const [email, setEmail] = useState(''); const [pw, setPw] = useState('')
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const social = async (provider: string) => {
    setErr('')
    const { error } = await sb.auth.signInWithOAuth({ provider: provider as 'google', options: { redirectTo: window.location.origin + '/' } })
    if (error) setErr(friendly(error, lang))
  }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try { const { error } = await sb.auth.signInWithPassword({ email, password: pw }); if (error) throw error; await refresh(); nav('/') }
    catch (e2) { setErr(friendly(e2, lang)) } finally { setBusy(false) }
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
      <button className="link mt16" onClick={() => setShowEmail(!showEmail)}>{t('staff_login')}</button>
      {showEmail && <form className="stack" onSubmit={submit}>
        <div className="field"><label>{t('email')}</label><input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></div>
        <div className="field"><label>{t('password')}</label><input className="input" type="password" value={pw} onChange={e => setPw(e.target.value)} required autoComplete="current-password" /></div>
        <button className="btn b-ocean" disabled={busy}>{t('login')}</button></form>}
    </div>
  </div>
}

function ServiceMinimum({ service }: { service: ServiceType }) {
  const { t, lang } = useI18n()
  const minimumPrice = service.min_qty * service.price_per_unit
  return <>
    <span className="min-qty">{t('min_qty')} {service.min_qty}{'\u00a0'}{svcUnit(service, lang)}</span>
    <span className="min-separator"> · </span>
    <span>{money(minimumPrice)}{'\u00a0'}{t('baht')}</span>
  </>
}

export function Home() {
  const { t, lang } = useI18n(); const { profile } = useAuth(); const nav = useNavigate(); const districts = useDistricts(); const services = useServices(); const maids = useMaids()
  const distId = profile?.district_id ?? Number(localStorage.getItem('cd_district') || 1)
  const d = districts.find(x => x.id === distId)
  // ปุ่มลัดเดิม (แพ็กเกจ / จองคนเดิม) ต่อท้ายรายการบริการจากฐานข้อมูล
  const extra = [
    { to: '/book/time?plan=weekly', icon: 'cal', label: t('s_monthly'), svc: 'general_cleaning' },
    { to: '/account/favorites', icon: 'heart', label: t('s_rebook'), svc: '' },
  ]
  const open = (code: string, to: string) => { if (code) setDraft({ ...emptyDraft, service: code }); nav(to) }
  // จุดเด่น 3 ข้อ และขั้นตอนการจอง 4 ขั้น (ใช้ข้อความเดิมของหน้าบริการ/แถบขั้นตอน)
  const why = [['clock', t('ben1'), t('ben1d')], ['wallet', t('ben2'), t('ben2d')], ['shield', t('ben3'), t('ben3d')]]
  const steps: [string, string][] = [['team', t('st_maid')], ['cal', t('st_time')], ['pin', t('st_detail')], ['wallet', t('st_pay')]]
  return <div className="page home">
    {/* ภาพใหญ่หัวหน้า: ภาพถ่ายวิลล่า + ไล่สีกรมท่า ทับด้วยคำทักทายและปุ่มจอง */}
    <div className="lux-hero" style={{ backgroundImage: `url(${imgHero})` }}>
      <div className="between"><span className="mob-only"><Logo white h={30} /></span><span className="lh-loc"><Icon n="pin" size={15} />{d ? (lang === 'th' ? 'อ.' + d.name_th + ' ชุมพร' : d.name_en + ', Chumphon') : 'Chumphon'}</span><LangToggle /></div>
      <div className="lh-body">
        <div className="lh-greet">{t(greetKey())}{profile?.full_name ? ', ' + profile.full_name : ''}</div>
        <h1>{t('tagline')}</h1>
        <p>{t('hero_d')}</p>
        <div className="lh-cta"><Link to="/book" className="btn b-sun">{t('book_now')}</Link><Link to="/guarantee" className="btn b-glass">{t('g_title')}</Link></div>
      </div>
    </div>
    <div className="home-grid">
      <div className="hg-main">
        <div className="promo lux"><div><span className="eyebrow">CleenDee</span><h3>{t('promo_t')}</h3><div className="small mt8">{t('promo_d')}</div></div><img src={imgHome} alt="" /></div>
        <div className="pad mt16"><button className="urgent" style={{ width: '100%', textAlign: 'left' }} onClick={() => open('general_cleaning', '/book/time?urgent=1')}>
          <span className="rico" style={{ background: 'var(--card)', color: 'var(--brick)' }}><Icon n="clock" /></span>
          <span style={{ flex: 1 }}><b className="disp">{t('urgent_t')}</b><span className="small" style={{ display: 'block', color: 'var(--brick)' }}>{t('urgent_d')}</span></span><Icon n="next" /></button></div>
        <div className="pad"><div className="sec-title">{t('services')}</div></div>
        <div className="svc pad">
          {!services ? <Loading /> : services.filter(s => s.active || s.coming_soon).map(s => s.active
            ? <button key={s.code} className="sv" onClick={() => open(s.code, '/service/' + s.code)}>
                <span className="ic"><Icon n={s.icon} size={28} /></span>
                <span className="sv-name">{svcName(s, lang)}</span>
                <span className="sv-price"><ServiceMinimum service={s} /></span>
              </button>
            : <div key={s.code} className="sv dim"><span className="soon">{t('soon')}</span><span className="ic"><Icon n={s.icon} size={28} /></span><span className="sv-name">{svcName(s, lang)}</span></div>)}
          {extra.map(s => <button key={s.to} className="sv" onClick={() => open(s.svc, s.to)}><span className="ic"><Icon n={s.icon} size={28} /></span><span className="sv-name" style={{ whiteSpace: 'pre-line' }}>{s.label}</span></button>)}
        </div>
        <div className="pad mt12"><Link to="/guarantee" className="choice" style={{ color: 'var(--ink)' }}><span className="rico" style={{ background: 'var(--leaf-l)', color: 'var(--leaf)' }}><Icon n="shield" /></span>
          <span style={{ flex: 1 }}><b>{t('g_title')}</b><span className="small muted">{t('g_short')}</span></span><Icon n="next" /></Link></div>
        <div className="pad"><div className="sec-title">{t('why_us')}</div></div>
        <div className="pad feats">{why.map(([i, b, x]) => <div key={b} className="feat"><span className="rico"><Icon n={i} /></span><b className="disp">{b}</b><span className="small muted">{x}</span></div>)}</div>
      </div>
      <aside className="hg-side">
        {profile ? <div className="pad"><div className="sec-title">{t('my_points')}</div>
          <button className="kpi lux-kpi" onClick={() => nav('/account')}><div className="small">{t('my_points')}</div><div className="v"><CountUp value={profile.points} /> {t('points')}</div><div className="small mt8">{t('points_rule')}</div></button></div>
          : <div className="pad mt20"><div className="card guestcard col"><b className="disp">{t('lw_book')}</b><Link to="/login" className="btn b-ocean">{t('login')} / {t('signup')}</Link></div></div>}
        <div className="pad"><div className="between"><div className="sec-title">{t('top_maids')}</div><Link to="/book" className="link">{t('see_all')}</Link></div>
          <div className="stack">{(maids || []).slice(0, 3).map(m => <Link key={m.id} to={'/maid-profile/' + m.id} className="mcard" style={{ color: 'var(--ink)' }}>
            <Avatar name={m.nickname} url={m.photo_url} seed={m.id} size={52} />
            <span style={{ flex: 1 }}><b className="disp">{m.nickname}</b><span className="small muted" style={{ display: 'block' }}><span className="star">★</span> {m.avg_rating ?? '–'} · {m.jobs_done ?? 0} {t('homes_done')}</span></span><Icon n="next" /></Link>)}
            {maids && maids.length === 0 && <div className="empty muted">{t('nothing')}</div>}</div></div>
        <div className="pad"><div className="sec-title">{t('how_it_works')}</div>
          <div className="hsteps">{steps.map(([i, l], k) => <div key={l} className="hstep"><span className="n">{k + 1}</span><Icon n={i} /><b className="disp">{l}</b></div>)}</div></div>
      </aside>
    </div>
    <SiteFooter />
    <CustomerTabs />
  </div>
}

// หน้ารายละเอียดบริการ: ราคา + รวมอะไร / ไม่รวมอะไร
export function Service() {
  const { t, lang } = useI18n(); const nav = useNavigate(); const { code = 'general_cleaning' } = useParams(); const services = useServices()
  const s = services?.find(x => x.code === code)
  if (!services) return <Loading />
  if (!s || !s.active) return <div className="page nobar"><TopBar title={t('services')} /><div className="pad mt20"><div className="empty muted">{t('service_closed')}</div></div></div>
  const inc = lang === 'th' ? s.included_th : s.included_en, exc = lang === 'th' ? s.excluded_th : s.excluded_en
  const ben = [['clock', t('ben1'), t('ben1d')], ['wallet', t('ben2'), t('ben2d')], ['check', t('ben3'), t('ben3d')], ['shield', t('ben4'), t('ben4d')]]
  return <div className="page nobar">
    <div style={{ position: 'relative', background: 'var(--ocean)' }}>
      <img src={imgClean} alt="" style={{ width: '100%', aspectRatio: '4/3', maxHeight: 360, objectFit: 'cover', display: 'block' }} />
      <button className="back" onClick={() => nav(-1)} style={{ position: 'absolute', top: 14, left: 14, background: '#fff' }} aria-label="Back"><Icon n="back" /></button>
    </div>
    <div className="pad mt16"><h2 className="service-title">{svcName(s, lang)}</h2>
      <p className="service-description muted">{lang === 'th' ? s.desc_th : s.desc_en}</p>
      <div className="service-minimum mt12"><ServiceMinimum service={s} /></div>
      <div className="small muted">{money(s.price_per_unit)} {t('baht')} / {svcUnit(s, lang)}</div>
      <div className="stack mt12">{ben.map(([i, b, d]) => <div key={b} className="row" style={{ alignItems: 'flex-start' }}>
        <span className="rico" style={{ background: 'var(--sun-l)', color: '#8A6200' }}><Icon n={i} /></span><div><b className="disp">{b}</b><div className="small muted">{d}</div></div></div>)}</div>
      {inc.length > 0 && <><div className="sec-title">{t('included')}</div><div className="stack">{inc.map(x => <div key={x} className="row small"><Icon n="check" size={18} style={{ color: 'var(--leaf)' }} />{x}</div>)}</div></>}
      {exc.length > 0 && <><div className="sec-title">{t('not_included')}</div><div className="stack">{exc.map(x => <div key={x} className="row small muted"><span style={{ width: 18, textAlign: 'center', color: 'var(--brick)' }}>✕</span>{x}</div>)}</div></>}
      <div className="infonote mt16"><Icon n="clock" />{t('cancel_rules')}</div>
      <Link to="/guarantee" className="link mt12" style={{ display: 'inline-block' }}>{t('g_title')} →</Link>
    </div>
    <div className="bottom-bar"><button className="btn b-sun" onClick={() => { setDraft({ ...emptyDraft, service: s.code }); nav('/book') }}>{t('book_now')}</button></div>
  </div>
}

// หน้าการันตีงาน: เขียนเฉพาะเงื่อนไขที่ระบบทำจริง (ไม่ใช่ประกันภัย)
export function Guarantee() {
  const { t } = useI18n(); const [s, setS] = useState<{ claim_cap: number; claim_report_days: number; reschedule_min_hours: number } | null>(null)
  useEffect(() => { sb.from('settings').select('claim_cap,claim_report_days,reschedule_min_hours').maybeSingle().then(({ data }) => setS(data)) }, [])
  const items: [string, string, string][] = s ? [
    ['team', t('g1'), t('g1d')],
    ['shield', t('g2'), t('g2d').replace('{cap}', money(s.claim_cap)).replace('{days}', String(s.claim_report_days))],
    ['check', t('g3'), t('g3d')],
    ['cal', t('g4'), t('g4d').replace('{h}', String(s.reschedule_min_hours))],
    ['wallet', t('g5'), t('cancel_rules')],
  ] : []
  return <div className="page nobar"><TopBar title={t('g_title')} />
    <div className="pad mt16 stack">
      {!s ? <Loading /> : items.map(([i, b, d]) => <div key={b} className="card row" style={{ alignItems: 'flex-start' }}>
        <span className="rico" style={{ background: 'var(--leaf-l)', color: 'var(--leaf)' }}><Icon n={i} /></span><div><b className="disp">{b}</b><div className="small muted">{d}</div></div></div>)}
      <div className="small muted">{t('g_note')}</div>
    </div></div>
}
