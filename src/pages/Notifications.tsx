import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { sb, friendly } from '../lib/supabase'
import { useI18n } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { relTime } from '../lib/fx'
import { disablePush, enablePush, pushState, refreshUnread, type Notice, type PushState } from '../lib/notify'
import { Icon, Loading, TopBar, useToast } from '../components/ui'

const ICON: Record<string, string> = { booking: 'cal', job: 'broom', payment: 'wallet', refund: 'wallet', payout: 'wallet', claim: 'shield', maid: 'team', support: 'chat' }

// ภาพตอนยังไม่มีการแจ้งเตือน: กระดิ่งสีทองหลับตา มีหยดน้ำคลีนดีบนตัว และฟองสบู่ลอยรอบ ๆ (วาดเอง ไม่ใช้รูป)
export function SleepyBell() {
  return <svg className="zbell" viewBox="0 0 220 190" role="img" aria-hidden="true">
    <defs>
      <linearGradient id="zb-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F3E3B8" /><stop offset=".55" stopColor="#D9B871" /><stop offset="1" stopColor="#B8914A" /></linearGradient>
      <radialGradient id="zb-bg" cx=".5" cy=".45" r=".55"><stop offset="0" stopColor="var(--card)" /><stop offset="1" stopColor="var(--foam)" /></radialGradient>
      <radialGradient id="zb-bub" cx=".35" cy=".3" r=".7"><stop offset="0" stopColor="#fff" stopOpacity=".95" /><stop offset="1" stopColor="var(--ocean)" stopOpacity=".12" /></radialGradient>
    </defs>
    <circle cx="105" cy="102" r="74" fill="url(#zb-bg)" />
    <ellipse cx="105" cy="170" rx="46" ry="6" fill="var(--ink)" opacity=".08" />
    <g className="zbell-body">
      <circle cx="105" cy="44" r="7" fill="url(#zb-g)" />
      <path d="M105 48c-27 0-41 20-41 46v26l-11 16h104l-11-16V94c0-26-14-46-41-46z" fill="url(#zb-g)" />
      <path d="M78 64c6-8 15-11 22-11" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".55" fill="none" />
      <path d="M93 145a12 12 0 0 0 24 0z" fill="#B8914A" />
      <path d="M88 98q6 6 12 0M110 98q6 6 12 0" stroke="#13294B" strokeWidth="3.2" strokeLinecap="round" fill="none" />
      <path d="M105 108c-4 6-6 9-6 12a6 6 0 0 0 12 0c0-3-2-6-6-12z" fill="#13294B" opacity=".85" />
      <circle cx="84" cy="110" r="5" fill="#E8A9A0" opacity=".5" /><circle cx="126" cy="110" r="5" fill="#E8A9A0" opacity=".5" />
    </g>
    <g className="zbell-z" fill="var(--ink2)" fontFamily="Nunito, sans-serif" fontWeight="800">
      <text x="150" y="62" fontSize="30" opacity=".75">z</text><text x="172" y="40" fontSize="20" opacity=".5">z</text><text x="186" y="24" fontSize="13" opacity=".3">z</text>
    </g>
    <circle className="zbell-bub" cx="42" cy="78" r="9" fill="url(#zb-bub)" stroke="var(--line)" />
    <circle className="zbell-bub b" cx="168" cy="130" r="6" fill="url(#zb-bub)" stroke="var(--line)" />
    <circle className="zbell-bub c" cx="34" cy="132" r="4.5" fill="url(#zb-bub)" stroke="var(--line)" />
    <path d="M58 46l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#D9B871" />
  </svg>
}

// ภาพตอนยังไม่มีแชทกับแม่บ้าน: กล่องแชทสีทองยิ้มหลับตารอ จุดสามจุดกำลังพิมพ์ กล่องแชทกรมท่าเล็กมีหยดน้ำคลีนดี และฟองสบู่ (วาดเอง ชุดเดียวกับกระดิ่ง)
export function QuietChat() {
  return <svg className="zbell zchat" viewBox="0 0 220 190" role="img" aria-hidden="true">
    <defs>
      <linearGradient id="zc-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F3E3B8" /><stop offset=".55" stopColor="#D9B871" /><stop offset="1" stopColor="#B8914A" /></linearGradient>
      <linearGradient id="zc-n" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2A4A7A" /><stop offset="1" stopColor="#13294B" /></linearGradient>
      <radialGradient id="zc-bg" cx=".5" cy=".45" r=".55"><stop offset="0" stopColor="var(--card)" /><stop offset="1" stopColor="var(--foam)" /></radialGradient>
      <radialGradient id="zc-bub" cx=".35" cy=".3" r=".7"><stop offset="0" stopColor="#fff" stopOpacity=".95" /><stop offset="1" stopColor="var(--ocean)" stopOpacity=".12" /></radialGradient>
    </defs>
    <circle cx="105" cy="100" r="74" fill="url(#zc-bg)" />
    <ellipse cx="100" cy="170" rx="50" ry="6" fill="var(--ink)" opacity=".08" />
    <g className="zchat-back">
      <path d="M128 40h46a14 14 0 0 1 14 14v26a14 14 0 0 1-14 14h-8l-10 11-2-11h-26a14 14 0 0 1-14-14V54a14 14 0 0 1 14-14z" fill="url(#zc-n)" />
      <path d="M168 52c-5 7-8 11-8 15a8 8 0 0 0 16 0c0-4-3-8-8-15z" fill="#D9B871" />
    </g>
    <g className="zchat-front">
      <path d="M48 70h86a18 18 0 0 1 18 18v40a18 18 0 0 1-18 18H76l-18 18 2-18h-12a18 18 0 0 1-18-18V88a18 18 0 0 1 18-18z" fill="url(#zc-g)" />
      <path d="M44 84c4-5 10-7 16-7" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".55" fill="none" />
      <path d="M70 100q6 6 12 0M100 100q6 6 12 0" stroke="#13294B" strokeWidth="3.2" strokeLinecap="round" fill="none" />
      <path d="M84 112q7 6 14 0" stroke="#13294B" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="64" cy="112" r="5" fill="#E8A9A0" opacity=".5" /><circle cx="118" cy="112" r="5" fill="#E8A9A0" opacity=".5" />
      <g className="zchat-dots" fill="#13294B"><circle cx="78" cy="132" r="3.6" /><circle cx="91" cy="132" r="3.6" /><circle cx="104" cy="132" r="3.6" /></g>
    </g>
    <circle className="zbell-bub" cx="30" cy="62" r="8" fill="url(#zc-bub)" stroke="var(--line)" />
    <circle className="zbell-bub b" cx="184" cy="134" r="6" fill="url(#zc-bub)" stroke="var(--line)" />
    <circle className="zbell-bub c" cx="166" cy="158" r="4" fill="url(#zc-bub)" stroke="var(--line)" />
    <path d="M96 34l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#D9B871" />
  </svg>
}

const PUSH: Record<PushState, [string, string]> = {
  on: ['เปิดอยู่ จะเด้งแจ้งเตือนบนเครื่องนี้', 'On for this device'],
  off: ['รับแจ้งเตือนแบบเด้งบนเครื่องนี้ แม้ปิดเว็บอยู่', 'Get pop-ups on this device, even when the site is closed'],
  denied: ['เครื่องนี้บล็อกการแจ้งเตือนไว้ เปิดได้ที่การตั้งค่าเบราว์เซอร์ > การแจ้งเตือน', 'Notifications are blocked. Allow them in your browser settings'],
  ios_needs_install: ['บน iPhone: กดปุ่มแชร์ > "เพิ่มไปยังหน้าจอโฮม" แล้วเปิด CleenDee จากไอคอน จึงเปิดการแจ้งเตือนได้', 'On iPhone: tap Share > "Add to Home Screen", open CleenDee from the icon, then turn this on'],
  unsupported: ['เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือนแบบเด้ง', 'This browser does not support pop-up notifications'],
}

// รายการแจ้งเตือน + ปุ่มเปิดการเด้งบนมือถือ (ใช้ทั้งหน้าการแจ้งเตือน และแท็บ "แจ้งเตือน" ในหน้าข้อความ)
export function NotificationFeed() {
  const { lang, t } = useI18n(); const { session } = useAuth(); const nav = useNavigate(); const toast = useToast(); const th = lang === 'th'
  const [rows, setRows] = useState<Notice[] | null>(null); const [push, setPush] = useState<PushState | null>(null); const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!session) return
    sb.from('notifications').select('*').eq('user_id', session.user.id).order('id', { ascending: false }).limit(60)
      .then(async ({ data }) => {
        setRows((data as Notice[]) || [])
        // เปิดดู = อ่านแล้ว (ยังแสดงจุดของรายการใหม่ไว้จนออกจากหน้า)
        if ((data as Notice[] | null)?.some(n => !n.read_at)) { await sb.rpc('notifications_mark_read'); refreshUnread() }
      })
    pushState().then(setPush)
  }, [session])
  const toggle = async () => {
    setBusy(true)
    try { setPush(push === 'on' ? await disablePush() : await enablePush()) } catch (e) { toast.show(friendly(e, lang)) }
    setBusy(false)
  }
  return <div className="stack">
    {push && <div className={'ntf-push' + (push === 'on' ? ' on' : '')}>
      <span className="ntf-push-ic"><Icon n="bell" size={20} /></span>
      <span className="ntf-push-t"><b>{th ? 'แจ้งเตือนบนมือถือ' : 'Phone notifications'}</b><small>{PUSH[push][th ? 0 : 1]}</small></span>
      {(push === 'on' || push === 'off') && <button className={'btn sm ' + (push === 'on' ? 'b-line' : 'b-sun')} disabled={busy} onClick={toggle}>{push === 'on' ? (th ? 'ปิด' : 'Turn off') : (th ? 'เปิด' : 'Turn on')}</button>}
    </div>}
    {!rows ? <Loading /> : rows.length === 0
      ? <div className="ntf-empty"><SleepyBell /><b>{th ? 'ยังไม่มีการแจ้งเตือน' : 'No notifications yet'}</b><small>{th ? 'เรื่องสำคัญของการจองและงานจะแจ้งที่นี่' : 'Important booking and job updates appear here'}</small></div>
      : <div className="ntf-list">{rows.map(n => <button key={n.id} className={'ntf-item' + (n.read_at ? '' : ' new')} onClick={() => n.link && nav(n.link)}>
        <span className="ntf-ic"><Icon n={ICON[n.kind] || 'bell'} size={17} /></span>
        <span className="ntf-main"><b>{th ? n.title_th : n.title_en}</b>{(th ? n.body_th : n.body_en) && <small>{th ? n.body_th : n.body_en}</small>}<time>{relTime(n.created_at, t)}</time></span>
        {!n.read_at && <span className="ntf-dot" aria-label={th ? 'ใหม่' : 'New'} />}
      </button>)}</div>}
    {toast.node}
  </div>
}

export function Notifications() {
  const { lang } = useI18n(); const { session, ready } = useAuth(); const th = lang === 'th'
  if (ready && !session) return <Navigate to="/login" replace />
  return <div className="page nobar"><TopBar title={th ? 'การแจ้งเตือน' : 'Notifications'} right={<span />} />
    <div className="pad mt16"><NotificationFeed /></div></div>
}
