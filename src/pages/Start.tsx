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

export function Login() {
  const { t, lang } = useI18n(); const nav = useNavigate(); const { refresh } = useAuth()
  const [mode, setMode] = useState<'in' | 'up'>('in'); const [email, setEmail] = useState(''); const [pw, setPw] = useState('')
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [err, setErr] = useState(''); const [info, setInfo] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setInfo(''); setBusy(true)
    try {
      if (mode === 'in') {
        const { error } = await sb.auth.signInWithPassword({ email, password: pw }); if (error) throw error
        await refresh(); nav(-1)
      } else {
        const { data, error } = await sb.auth.signUp({ email, password: pw, options: { data: { full_name: name } } }); if (error) throw error
        if (data.session) { await sb.from('profiles').update({ full_name: name, phone, lang }).eq('id', data.session.user.id); await refresh(); nav('/') }
        else setInfo(t('check_email'))
      }
    } catch (e2) { setErr(friendly(e2, lang)) } finally { setBusy(false) }
  }
  return <div className="page nobar">
    <TopBar title={mode === 'in' ? t('login') : t('signup')} />
    <form className="pad stack mt20" onSubmit={submit}>
      <div style={{ textAlign: 'center', margin: '10px 0 16px' }}><img src="/brand/CleenDee_logo_stacked.svg" alt="CleenDee" style={{ height: 120 }} /></div>
      {mode === 'up' && <div className="field"><label>{t('full_name')}</label><input className="input" value={name} onChange={e => setName(e.target.value)} required autoComplete="name" /></div>}
      {mode === 'up' && <div className="field"><label>{t('phone')}</label><input className="input" value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" /></div>}
      <div className="field"><label>{t('email')}</label><input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></div>
      <div className="field"><label>{t('password')}</label><input className="input" type="password" value={pw} onChange={e => setPw(e.target.value)} required minLength={8} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /></div>
      {err && <div className="err">{err}</div>}{info && <div className="ok-note">{info}</div>}
      <button className="btn b-sun mt8" disabled={busy}>{mode === 'in' ? t('login') : t('signup')}</button>
      <button type="button" className="link" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>{mode === 'in' ? t('no_account') : t('have_account')}</button>
    </form>
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
