import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { sb, friendly, type District } from '../lib/supabase'
import { useI18n, localStorageSet, money } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { Icon, LangToggle, Logo, CustomerTabs, TopBar } from '../components/ui'
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
    <div className="pad" style={{ paddingBottom: 34 }}><button className="btn b-sun" onClick={() => setStep(1)}>{t('start')}</button></div>
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
  { id: 'facebook', label: 'Facebook', bg: '#1877F2', fg: '#fff', icon: <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><path fill="#fff" d="M14 8h3V4h-3c-2.8 0-4 1.8-4 4.3V10H7v4h3v8h4v-8h3l1-4h-4V8.6c0-.4.3-.6.6-.6z"/></svg> },
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
      <button className="link mt16" onClick={() => setShowEmail(!showEmail)}>{t('staff_login')}</button>
      {showEmail && <form className="stack" onSubmit={submit}>
        <div className="field"><label>{t('email')}</label><input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></div>
        <div className="field"><label>{t('password')}</label><input className="input" type="password" value={pw} onChange={e => setPw(e.target.value)} required autoComplete="current-password" /></div>
        <button className="btn b-ocean" disabled={busy}>{t('login')}</button></form>}
    </div>
  </div>
}

export function Home() {
  const { t, lang } = useI18n(); const { profile } = useAuth(); const nav = useNavigate(); const districts = useDistricts()
  const distId = profile?.district_id ?? Number(localStorage.getItem('cd_district') || 1)
  const d = districts.find(x => x.id === distId)
  const svc = [
    { to: '/service', icon: 'broom', label: t('s_once'), bg: '#EAF3FA', c: 'var(--ocean)' },
    { to: '/book/time?plan=weekly', icon: 'cal', label: t('s_monthly'), bg: 'var(--leaf-l)', c: 'var(--leaf)' },
    { to: '/book', icon: 'team', label: t('s_pick'), bg: 'var(--sun-l)', c: '#8A6200' },
    { to: '/account/favorites', icon: 'redo', label: t('s_rebook'), bg: '#F3EAF9', c: '#7B4BA3' },
  ]
  return <div className="page">
    <div className="hero tall">
      <div className="between"><Logo white h={30} /><LangToggle /></div>
      <div className="mt16 sub">{d ? (lang === 'th' ? 'อ.' + d.name_th : d.name_en) : ''}</div>
      <h1>{t('hello')} {profile?.full_name ?? t('guest')}</h1>
    </div>
    <div className="promo"><h3>{t('promo_t')}</h3><div className="small mt8">{t('promo_d')}</div><img src={imgHome} alt="" /></div>
    <div className="pad"><div className="sec-title">{t('services')}</div></div>
    <div className="svc pad">
      {svc.map(s => <Link key={s.to} to={s.to} className="sv" style={{ color: 'var(--ink)' }}><span className="ic" style={{ background: s.bg, color: s.c }}><Icon n={s.icon} size={30} /></span><span style={{ whiteSpace: 'pre-line' }}>{s.label}</span></Link>)}
      {[['ac', t('s_ac')], ['iron', t('s_iron')]].map(([i, l]) => <div key={i} className="sv dim"><span className="soon">{t('soon')}</span><span className="ic"><Icon n={i} size={30} /></span><span>{l}</span></div>)}
    </div>
    {profile && <><div className="pad"><div className="sec-title">{t('my_points')}</div></div>
      <div className="pad"><button className="choice" onClick={() => nav('/account')}><span className="rico" style={{ background: 'var(--sun)' }}><Icon n="star" /></span>
        <span style={{ flex: 1 }}><b>{money(profile.points)} {t('points')}</b><span className="small muted">{t('points_rule')}</span></span></button></div></>}
    {!profile && <div className="pad mt20"><Link to="/login" className="btn b-ocean">{t('login')} / {t('signup')}</Link></div>}
    <CustomerTabs />
  </div>
}

export function Service() {
  const { t } = useI18n(); const nav = useNavigate()
  const ben = [['clock', t('ben1'), t('ben1d')], ['wallet', t('ben2'), t('ben2d')], ['check', t('ben3'), t('ben3d')], ['lock', t('ben4'), t('ben4d')]]
  return <div className="page nobar">
    <div style={{ position: 'relative', background: 'var(--ocean)' }}>
      <img src={imgClean} alt="" style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />
      <button className="back" onClick={() => nav(-1)} style={{ position: 'absolute', top: 14, left: 14, background: '#fff' }} aria-label="Back"><Icon n="back" /></button>
    </div>
    <div className="pad mt16"><h2 style={{ fontSize: 24, color: 'var(--ocean)' }}>{t('svc_title')}</h2><p className="muted">{t('svc_sub')}</p>
      <div className="stack mt12">{ben.map(([i, b, d]) => <div key={b} className="row" style={{ alignItems: 'flex-start' }}>
        <span className="rico" style={{ background: 'var(--sun-l)', color: '#8A6200' }}><Icon n={i} /></span><div><b className="disp">{b}</b><div className="small muted">{d}</div></div></div>)}</div>
      <div className="infonote mt16"><Icon n="clock" />{t('cancel_rules')}</div>
    </div>
    <div className="bottom-bar"><button className="btn b-sun" onClick={() => nav('/book')}>{t('book_now')}</button></div>
  </div>
}
