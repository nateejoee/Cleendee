// ลูกเล่นทั้งเว็บ (ยกแนวมาจาก Seafresh Loader: motion.js / quick-tools.js) — ไม่ใช้ไลบรารีเพิ่ม
//  - การ์ด/รายการค่อย ๆ จางขึ้นแบบไล่ทีละอันเมื่อเปลี่ยนหน้าหรือเลื่อนถึง
//  - ตัวเลขใหญ่นับขึ้น (CountUp) · พลุกระดาษ (confetti) · เวลาแบบสั้น (relTime) · คำทักทายตามเวลา
//  - แถบความคืบหน้าบางที่ขอบบนระหว่างโหลดข้อมูล · ปุ่มกลับขึ้นบนสุด · แถบแจ้งออฟไลน์
// การเคลื่อนไหวทั้งหมดปิดเองเมื่อเครื่องตั้งค่า "ลดการเคลื่อนไหว"
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useI18n, type Key } from './i18n'
import { Icon } from '../components/ui'

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/* ---------- การ์ดจางขึ้นแบบไล่กัน ---------- */
const SEL = '.page .card, .page .choice, .page .sv, .page .ticket, .page .listrow, .page .promo, .page .kpi, .page .feat, .page .mcard, .page .hstep, .page .empty, .page .lwall'
const WIN = 2500 // เล่นเฉพาะช่วงสั้น ๆ หลังเปลี่ยนหน้า (ข้อมูลที่อัปเดตทีหลังจะไม่กระพริบซ้ำ)

export function Motion() {
  const loc = useLocation()
  useEffect(() => {
    if (reduced()) return
    window.scrollTo({ top: 0 })
    const until = Date.now() + WIN
    let n = 0
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return
      io.unobserve(e.target); play(e.target as HTMLElement, 0)
    }), { rootMargin: '0px 0px -30px 0px' })
    const play = (el: HTMLElement, delay: number) => el.animate(
      [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
      { duration: 480, delay, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' })
    const scan = () => {
      document.querySelectorAll<HTMLElement>(SEL).forEach(el => {
        if (el.dataset.fx) return; el.dataset.fx = '1'
        const r = el.getBoundingClientRect()
        if (r.top < innerHeight) play(el, Math.min(n++, 12) * 45) // อยู่ในจอแล้ว: ไล่ทีละอัน
        else io.observe(el) // อยู่ใต้จอ: รอเลื่อนถึง
      })
    }
    scan()
    const mo = new MutationObserver(() => { if (Date.now() < until) scan() })
    mo.observe(document.querySelector('.app') || document.body, { childList: true, subtree: true })
    const stop = setTimeout(() => mo.disconnect(), WIN)
    return () => { mo.disconnect(); io.disconnect(); clearTimeout(stop) }
  }, [loc.pathname])
  return null
}

/* ---------- ตัวเลขนับขึ้นจาก 0 ---------- */
export function CountUp({ value, fmt = (n: number) => n.toLocaleString('en-US') }: { value: number; fmt?: (n: number) => string }) {
  const [v, setV] = useState(reduced() ? value : 0); const from = useRef(0)
  useEffect(() => {
    if (reduced()) { setV(value); return }
    let raf = 0; const t0 = performance.now(), a = from.current, D = 850
    const step = (now: number) => { const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3); setV(Math.round(a + (value - a) * e)); if (k < 1) raf = requestAnimationFrame(step); else from.current = value }
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{fmt(v)}</>
}

/* ---------- พลุกระดาษ (ตอนส่งสลิป / ส่งรีวิวสำเร็จ) ---------- */
export function confetti() {
  if (reduced()) return
  const c = document.createElement('canvas'); c.className = 'confetti'; document.body.appendChild(c)
  const W = c.width = innerWidth, H = c.height = innerHeight, x = c.getContext('2d')!
  const cs = getComputedStyle(document.documentElement)
  const col = [cs.getPropertyValue('--ocean'), cs.getPropertyValue('--sun'), cs.getPropertyValue('--leaf'), '#F28AA5', '#fff'].map(s => s.trim() || '#F4BF3A')
  const P = Array.from({ length: 140 }, () => ({ x: W / 2, y: H * .55, vx: (Math.random() - .5) * 16, vy: -Math.random() * 15 - 6, r: Math.random() * 6 + 4, a: Math.random() * 6, va: (Math.random() - .5) * .4, c: col[Math.floor(Math.random() * col.length)] }))
  const t0 = performance.now()
  const f = (now: number) => {
    x.clearRect(0, 0, W, H)
    P.forEach(p => { p.vy += .42; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); x.restore() })
    if (now - t0 < 2600) requestAnimationFrame(f); else c.remove()
  }
  requestAnimationFrame(f)
}

/* ---------- เวลาแบบสั้น '2 ชม.ที่แล้ว' ---------- */
export function relTime(iso: string, t: (k: Key) => string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return t('just_now')
  if (m < 60) return `${m} ${t('min_ago')}`
  const h = Math.round(m / 60); if (h < 24) return `${h} ${t('hr_ago')}`
  return `${Math.round(h / 24)} ${t('day_ago')}`
}
// อัปเดตข้อความเวลาแบบสั้นทุกนาที
export function useMinuteTick() { const [, s] = useState(0); useEffect(() => { const i = setInterval(() => s(x => x + 1), 60000); return () => clearInterval(i) }, []) }

/* ---------- คำทักทายตามเวลา (เวลาไทย) ---------- */
export function greetKey(): Key {
  const h = new Date(Date.now() + 7 * 3600e3).getUTCHours()
  return h >= 5 && h < 12 ? 'greet_morning' : h >= 12 && h < 17 ? 'greet_afternoon' : 'greet_evening'
}

/* ---------- แถบความคืบหน้าขอบบน: นับคำขอที่กำลังวิ่งอยู่ ---------- */
let busy = 0; const subs = new Set<(n: number) => void>()
if (typeof window !== 'undefined' && !(window as unknown as { __cdFetch?: 1 }).__cdFetch) {
  (window as unknown as { __cdFetch?: 1 }).__cdFetch = 1
  const of = window.fetch.bind(window)
  window.fetch = async (...a: Parameters<typeof fetch>) => {
    // ไม่นับคำขอเรียลไทม์/รีเฟรชเบื้องหลังที่วิ่งตลอด (ให้แถบขึ้นเฉพาะตอนผู้ใช้รอจริง ๆ)
    const bg = document.hidden
    if (!bg) { busy++; subs.forEach(f => f(busy)) }
    try { return await of(...a) } finally { if (!bg) { busy--; subs.forEach(f => f(busy)) } }
  }
}
export function TopProgress() {
  const [n, setN] = useState(0); const [show, setShow] = useState(false)
  useEffect(() => { subs.add(setN); return () => { subs.delete(setN) } }, [])
  useEffect(() => { if (n > 0) { const i = setTimeout(() => setShow(true), 150); return () => clearTimeout(i) } const i = setTimeout(() => setShow(false), 250); return () => clearTimeout(i) }, [n])
  return <div className={'topprog' + (show ? ' on' : '') + (n === 0 ? ' done' : '')} aria-hidden />
}

/* ---------- ปุ่มกลับขึ้นบนสุด ---------- */
export function BackToTop() {
  const { t } = useI18n(); const [on, setOn] = useState(false)
  useEffect(() => { const f = () => setOn(scrollY > 700); addEventListener('scroll', f, { passive: true }); return () => removeEventListener('scroll', f) }, [])
  return <button className={'totop' + (on ? ' on' : '')} onClick={() => scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' })} aria-label={t('back_top')} title={t('back_top')}>
    <Icon n="back" style={{ transform: 'rotate(90deg)' }} /></button>
}

/* ---------- แถบแจ้งออฟไลน์ ---------- */
export function OfflineBar() {
  const { t } = useI18n(); const [off, setOff] = useState(!navigator.onLine)
  useEffect(() => { const a = () => setOff(false), b = () => setOff(true); addEventListener('online', a); addEventListener('offline', b); return () => { removeEventListener('online', a); removeEventListener('offline', b) } }, [])
  return off ? <div className="offline" role="status">{t('offline')}</div> : null
}
