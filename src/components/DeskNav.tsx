import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useI18n, type Key } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { sb } from '../lib/supabase'
import { clearDraft } from '../lib/draft'
import { openProvinceNames, useProvinces } from '../lib/areas'
import { useIsDesktop, useCustomerShellWanted } from '../lib/useDesktop'
import { Avatar, Bell, Icon, LangToggle, Logo } from './ui'

/* โครงหน้าจอคอม (≥1024px) สำหรับลูกค้าและผู้เยี่ยมชม: เมนูด้านบน + ท้ายหน้าสีกรมท่า
   หน้าที่มีแถบเมนูลูกค้า (CustomerTabs) จะ "ลงทะเบียน" ไว้ที่นี่แทนการแสดงเมนูข้าง
   แม่บ้านและแอดมินยังใช้เมนูข้างเหมือนเดิม */

const NAV_ROUTES = ['/guarantee', '/privacy'] // หน้าที่ไม่มีแถบเมนู แต่ควรมีเมนูด้านบนบนจอคอม
const FOOT_ROUTES = ['/', '/home', '/bookings', '/account', '/guarantee', '/privacy', '/messages']
const SERVICES_ID = 'home-services'
const YEAR = new Date().getFullYear()

function useShellOn() {
  const desk = useIsDesktop(); const want = useCustomerShellWanted(); const { profile } = useAuth(); const { pathname } = useLocation()
  if (!desk || profile?.role === 'maid' || profile?.role === 'admin') return false
  return want || NAV_ROUTES.includes(pathname)
}

function scrollToId(id: string) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth', block: 'start' })
}

type Item = { to: string; label: Key; on: (path: string, hash: string) => boolean }
const ITEMS: Item[] = [
  { to: '/', label: 'tab_home', on: (p, h) => (p === '/' || p === '/home') && h !== '#' + SERVICES_ID },
  { to: '/bookings', label: 'tab_bookings', on: p => p === '/bookings' || p.startsWith('/bookings/') },
  { to: '/#' + SERVICES_ID, label: 'dk_services', on: (p, h) => (p === '/' || p === '/home') && h === '#' + SERVICES_ID },
  { to: '/guarantee', label: 'dk_guarantee', on: p => p === '/guarantee' },
  { to: '/messages', label: 'tab_msgs', on: p => p === '/messages' },
]

function UserMenu() {
  const { t } = useI18n(); const { profile } = useAuth(); const nav = useNavigate(); const loc = useLocation()
  // เก็บหน้าที่เปิดเมนูไว้: เปลี่ยนหน้าแล้วเมนูปิดเอง
  const [openAt, setOpenAt] = useState<string | null>(null)
  const open = openAt === loc.pathname
  const setOpen = (v: boolean) => setOpenAt(v ? loc.pathname : null)
  const wrap = useRef<HTMLDivElement>(null); const btn = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpenAt(null) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpenAt(null); btn.current?.focus() } }
    document.addEventListener('pointerdown', down); document.addEventListener('keydown', key)
    wrap.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus()
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key) }
  }, [open])
  const name = (profile?.full_name || '').trim()
  const first = name.split(/\s+/)[0] || t('tab_account')
  const logout = async () => { setOpen(false); await sb.auth.signOut(); clearDraft(); nav('/') }
  // ปุ่มลูกศรขึ้น/ลงเลื่อนระหว่างรายการในเมนู
  const arrows = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...(wrap.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLElement)
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
  }
  return <div className="dk-user" ref={wrap}>
    <button ref={btn} className="dk-user-btn" aria-haspopup="menu" aria-expanded={open} aria-label={t('dk_menu')} onClick={() => setOpen(!open)}>
      <Avatar name={name || '?'} url={profile?.avatar_url} seed={profile?.id} size={34} />
      <span className="dk-user-name">{first}</span>
      <svg className="dk-caret" viewBox="0 0 24 24" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
    </button>
    {open && <div className="dk-menu" role="menu" aria-label={t('dk_menu')} onKeyDown={arrows}>
      <Link role="menuitem" to="/account" onClick={() => setOpen(false)}><Icon n="user" size={18} />{t('tab_account')}</Link>
      <Link role="menuitem" to="/account/profile" onClick={() => setOpen(false)}><Icon n="cog" size={18} />{t('edit_profile')}</Link>
      <hr />
      <button role="menuitem" onClick={logout}><Icon n="logout" size={18} />{t('logout')}</button>
    </div>}
  </div>
}

/** เมนูด้านบน (แสดงเฉพาะจอคอม ลูกค้า/ผู้เยี่ยมชม) */
export function DeskNav() {
  const on = useShellOn(); const { t } = useI18n(); const { session } = useAuth(); const loc = useLocation()
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    if (!on) return
    const f = () => setScrolled(window.scrollY > 4)
    f(); window.addEventListener('scroll', f, { passive: true })
    return () => window.removeEventListener('scroll', f)
  }, [on])
  // เปิดลิงก์ที่มี #… (เช่น บริการ) ให้เลื่อนไปที่หัวข้อนั้นเมื่อหน้าโหลดเสร็จ
  useEffect(() => {
    if (!on || !loc.hash) return
    const id = decodeURIComponent(loc.hash.slice(1))
    const timer = setTimeout(() => scrollToId(id), 60)
    return () => clearTimeout(timer)
  }, [on, loc.pathname, loc.hash])
  if (!on) return null
  return <header className={'dk-nav' + (scrolled ? ' scrolled' : '')}>
    <div className="dk-container dk-nav-in">
      <Link to="/" className="dk-logo" aria-label="CleenDee — หน้าหลัก / Home"><Logo h={36} /></Link>
      <nav className="dk-links" aria-label={t('dk_nav')}>
        {ITEMS.map(it => {
          const active = it.on(loc.pathname, loc.hash)
          return <Link key={it.to} to={it.to} className={'dk-link' + (active ? ' on' : '')} aria-current={active ? 'page' : undefined}
            onClick={() => { if (it.to.includes('#') && loc.hash === '#' + SERVICES_ID) scrollToId(SERVICES_ID) }}>{t(it.label)}</Link>
        })}
      </nav>
      <div className="dk-tools">
        <LangToggle />
        <Bell />
        <Link to="/book" className="dk-cta">{t('dk_book')}</Link>
        {session ? <UserMenu /> : <Link to="/login" className="dk-login">{t('login')}</Link>}
      </div>
    </div>
  </header>
}

/** ท้ายหน้าเต็ม (จอคอม) — เฉพาะหน้าที่ไม่มีแถบปุ่มค้างด้านล่าง */
export function DeskFooter() {
  const on = useShellOn(); const { t, lang } = useI18n(); const { pathname } = useLocation()
  const provinces = useProvinces()
  if (!on || !FOOT_ROUTES.includes(pathname)) return null
  const area = openProvinceNames(provinces, lang)
  const cols: { title: Key; links: [string, Key][] }[] = [
    { title: 'dk_col_svc', links: [['/book', 'dk_book'], ['/#' + SERVICES_ID, 'dk_services'], ['/bookings', 'tab_bookings']] },
    { title: 'dk_col_about', links: [['/guarantee', 'dk_guarantee'], ['/maid/apply', 'dk_become'], ['/privacy', 'dk_privacy']] },
    { title: 'dk_col_help', links: [['/support', 'dk_support'], ['/messages', 'tab_msgs'], ['/account', 'tab_account']] },
  ]
  return <footer className="dk-foot">
    <div className="dk-container">
      <div className="dk-foot-grid">
        <div className="dk-foot-brand">
          <Link to="/" aria-label="CleenDee"><Logo white h={40} /></Link>
          <p>{t('dk_tagline')}</p>
          {area && <p className="dk-foot-area"><Icon n="pin" size={16} /><span><b>{t('dk_area')}</b> · {area}</span></p>}
        </div>
        {cols.map(c => <div key={c.title} className="dk-foot-col">
          <h2>{t(c.title)}</h2>
          <ul>{c.links.map(([to, k]) => <li key={to}><Link to={to} onClick={() => { if (to.includes('#')) setTimeout(() => scrollToId(SERVICES_ID), 60) }}>{t(k)}</Link></li>)}</ul>
        </div>)}
      </div>
      <div className="dk-foot-base">
        <span>© {YEAR} CleenDee คลีนดี · {t('dk_rights')}</span>
        <Link to="/privacy">{t('dk_privacy')}</Link>
      </div>
    </div>
  </footer>
}
