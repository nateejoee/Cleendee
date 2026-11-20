import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useI18n, type Key } from '../lib/i18n'
import type { BookingStatus } from '../lib/supabase'

const P: Record<string, ReactNode> = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  cal: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6" /></>,
  pin: <><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></>,
  back: <path d="M15 5l-7 7 7 7" />,
  next: <path d="M9 5l7 7-7 7" />,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  check: <path d="M5 12l5 5 9-10" />,
  wallet: <><rect x="3" y="6" width="18" height="14" rx="3" /><path d="M16 13h2M3 10h18" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
  team: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.5-5 6.5-5s5.7 1.5 6.5 5" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14c2.3 0 4 1.3 4.5 4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  broom: <path d="M14 3l-4 10M7 13h8l2 8H5z" />,
  redo: <path d="M4 12a8 8 0 1 1 3 6.2M4 12V7M4 12h5" />,
  ac: <><rect x="3" y="6" width="18" height="7" rx="2" /><path d="M8 17v2M12 17v3M16 17v2" /></>,
  iron: <path d="M3 17h17l-1-5a5 5 0 0 0-5-4H8c-2 0-4 2-5 4z" />,
  star: <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z" />,
  shield: <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" />,
  camera: <><rect x="3" y="7" width="18" height="13" rx="3" /><circle cx="12" cy="13.5" r="3.5" /><path d="M8 7l2-3h4l2 3" /></>,
  cog: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></>,
  logout: <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />,
  ticket: <path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z" />,
  print: <><path d="M7 9V3h10v6M7 17H4v-7h16v7h-3" /><rect x="7" y="14" width="10" height="7" /></>,
  image: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-8 8" /></>,
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
}
export function Icon({ n, size = 20, style }: { n: keyof typeof P | string; size?: number; style?: React.CSSProperties }) {
  return <svg className="ico" viewBox="0 0 24 24" style={{ width: size, height: size, ...style }} aria-hidden>{P[n]}</svg>
}

export function Logo({ white = false, h = 34 }: { white?: boolean; h?: number }) {
  return <img src={white ? '/brand/CleenDee_logo_white.svg' : '/brand/CleenDee_logo_horizontal.svg'} alt="CleenDee คลีนดี" style={{ height: h }} />
}

const COLORS = ['#E9967A,#C9674A', '#7DB3D6,#3F7DAA', '#9FCB9B,#4C9A6A', '#E8C26A,#C08E1F', '#B79FD6,#7B5BAA']
export function Avatar({ name, url, size = 48, seed = '' }: { name: string; url?: string | null; size?: number; seed?: string }) {
  const i = [...(seed || name)].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length
  return <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.4, background: `linear-gradient(140deg,${COLORS[i]})` }}>
    {url ? <img src={url} alt="" /> : name.slice(0, 1)}</div>
}

export function LangToggle() {
  const { lang, setLang } = useI18n()
  return <button className="lang" onClick={() => setLang(lang === 'th' ? 'en' : 'th')} aria-label="Switch language">
    {lang === 'th' ? 'TH' : 'EN'} <span style={{ opacity: .6 }}>/ {lang === 'th' ? 'EN' : 'TH'}</span></button>
}

export function TopBar({ title, back = true, right }: { title: string; back?: boolean | string; right?: ReactNode }) {
  const nav = useNavigate()
  return <div className="topbar">
    {back && <button className="back" onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))} aria-label="Back"><Icon n="back" /></button>}
    <h2>{title}</h2>{right ?? <LangToggle />}
  </div>
}

export function Steps({ at }: { at: number }) {
  const { t } = useI18n()
  const labels: Key[] = ['st_maid', 'st_time', 'st_detail', 'st_pay']
  return <div className="steps">{labels.map((l, i) => <div key={l} className={'st' + (i <= at ? ' done' : '')}><i /><span>{t(l)}</span></div>)}</div>
}

type Tab = { to: string; icon: string; label: Key; center?: boolean }
export function TabBar({ tabs }: { tabs: Tab[] }) {
  const { t } = useI18n(); const loc = useLocation()
  return <nav className="tabbar">{tabs.map(tb => {
    const on = tb.to === loc.pathname || (tb.to !== '/' && loc.pathname.startsWith(tb.to + '/'))
    if (tb.center) return <Link key={tb.to} to={tb.to} className="tab center"><span className="mid"><Icon n="plus" size={28} /></span>{t(tb.label)}</Link>
    return <Link key={tb.to} to={tb.to} className={'tab' + (on ? ' on' : '')}><Icon n={tb.icon} />{t(tb.label)}</Link>
  })}</nav>
}
export const CustomerTabs = () => <TabBar tabs={[
  { to: '/', icon: 'home', label: 'tab_home' }, { to: '/bookings', icon: 'cal', label: 'tab_bookings' },
  { to: '/book', icon: 'plus', label: 'tab_book', center: true }, { to: '/messages', icon: 'chat', label: 'tab_msgs' }, { to: '/account', icon: 'user', label: 'tab_account' }]} />
export const MaidTabs = () => <TabBar tabs={[
  { to: '/maid', icon: 'grid', label: 'tab_jobs' }, { to: '/maid/availability', icon: 'cal', label: 'tab_avail' },
  { to: '/maid/income', icon: 'wallet', label: 'tab_income' }, { to: '/account', icon: 'user', label: 'tab_account' }]} />
export const AdminTabs = () => <TabBar tabs={[
  { to: '/admin', icon: 'grid', label: 'tab_overview' }, { to: '/admin/money', icon: 'wallet', label: 'tab_money' },
  { to: '/admin/maids', icon: 'team', label: 'tab_maids' }, { to: '/admin/settings', icon: 'cog', label: 'tab_settings' }]} />

export function StatusPill({ s }: { s: BookingStatus }) {
  const { t } = useI18n()
  const cls = s === 'completed' ? 'p-grey' : s === 'confirmed' || s === 'on_the_way' || s === 'working' ? 'p-leaf'
    : s === 'cancelled_by_customer' || s === 'payment_rejected' || s === 'refunded_no_maid' ? 'p-brick' : 'p-sun'
  return <span className={'pill ' + cls}>{t(('s_' + s) as Key)}</span>
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { if (msg) { const id = setTimeout(() => setMsg(null), 2600); return () => clearTimeout(id) } }, [msg])
  return { show: setMsg, node: msg ? <div className="toast" role="status">{msg}</div> : null }
}

export function Loading() { const { t } = useI18n(); return <div className="loading">{t('loading')}</div> }
