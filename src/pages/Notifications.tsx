import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { sb, friendly } from '../lib/supabase'
import { useI18n } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { relTime } from '../lib/fx'
import { disablePush, enablePush, pushState, refreshUnread, type Notice, type PushState } from '../lib/notify'
import { Icon, Loading, TopBar, useToast } from '../components/ui'

const ICON: Record<string, string> = { booking: 'cal', job: 'broom', payment: 'wallet', refund: 'wallet', payout: 'wallet', claim: 'shield', maid: 'team', support: 'chat' }

// รายการแจ้งเตือน + ปุ่มเปิดการเด้งบนมือถือ
export function Notifications() {
  const { lang, t } = useI18n(); const { session, ready } = useAuth(); const nav = useNavigate(); const toast = useToast(); const th = lang === 'th'
  const [rows, setRows] = useState<Notice[] | null>(null); const [push, setPush] = useState<PushState | null>(null); const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!session) return
    sb.from('notifications').select('*').eq('user_id', session.user.id).order('id', { ascending: false }).limit(60)
      .then(async ({ data }) => {
        setRows((data as Notice[]) || [])
        // เปิดหน้านี้ = อ่านแล้ว (ยังแสดงจุดของรายการใหม่ไว้จนออกจากหน้า)
        if ((data as Notice[] | null)?.some(n => !n.read_at)) { await sb.rpc('notifications_mark_read'); refreshUnread() }
      })
    pushState().then(setPush)
  }, [session])
  if (ready && !session) return <Navigate to="/login" replace />

  const toggle = async () => {
    setBusy(true)
    try { setPush(push === 'on' ? await disablePush() : await enablePush()) } catch (e) { toast.show(friendly(e, lang)) }
    setBusy(false)
  }
  const pushText: Record<PushState, string> = {
    on: th ? 'เปิดอยู่ จะเด้งแจ้งเตือนบนเครื่องนี้' : 'On for this device',
    off: th ? 'รับแจ้งเตือนแบบเด้งบนเครื่องนี้ แม้ปิดเว็บอยู่' : 'Get pop-ups on this device, even when the site is closed',
    denied: th ? 'เครื่องนี้บล็อกการแจ้งเตือนไว้ เปิดได้ที่การตั้งค่าเบราว์เซอร์ > การแจ้งเตือน' : 'Notifications are blocked. Allow them in your browser settings',
    ios_needs_install: th ? 'บน iPhone: กดปุ่มแชร์ > "เพิ่มไปยังหน้าจอโฮม" แล้วเปิด CleenDee จากไอคอน จึงเปิดการแจ้งเตือนได้' : 'On iPhone: tap Share > "Add to Home Screen", open CleenDee from the icon, then turn this on',
    unsupported: th ? 'เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือนแบบเด้ง' : 'This browser does not support pop-up notifications',
  }

  return <div className="page nobar"><TopBar title={th ? 'การแจ้งเตือน' : 'Notifications'} right={<span />} />
    <div className="pad mt16 stack">
      {push && <div className={'ntf-push' + (push === 'on' ? ' on' : '')}>
        <span className="ntf-push-ic"><Icon n="bell" size={20} /></span>
        <span className="ntf-push-t"><b>{th ? 'แจ้งเตือนบนมือถือ' : 'Phone notifications'}</b><small>{pushText[push]}</small></span>
        {(push === 'on' || push === 'off') && <button className={'btn sm ' + (push === 'on' ? 'b-line' : 'b-sun')} disabled={busy} onClick={toggle}>{push === 'on' ? (th ? 'ปิด' : 'Turn off') : (th ? 'เปิด' : 'Turn on')}</button>}
      </div>}
      {!rows ? <Loading /> : rows.length === 0
        ? <div className="msx-empty"><span className="msx-empty-ic"><Icon n="bell" size={22} /></span><b>{th ? 'ยังไม่มีการแจ้งเตือน' : 'No notifications yet'}</b><small>{th ? 'เรื่องสำคัญของการจองและงานจะแจ้งที่นี่' : 'Important booking and job updates appear here'}</small></div>
        : <div className="ntf-list">{rows.map(n => <button key={n.id} className={'ntf-item' + (n.read_at ? '' : ' new')} onClick={() => n.link && nav(n.link)}>
          <span className="ntf-ic"><Icon n={ICON[n.kind] || 'bell'} size={17} /></span>
          <span className="ntf-main"><b>{th ? n.title_th : n.title_en}</b>{(th ? n.body_th : n.body_en) && <small>{th ? n.body_th : n.body_en}</small>}<time>{relTime(n.created_at, t)}</time></span>
          {!n.read_at && <span className="ntf-dot" aria-label={th ? 'ใหม่' : 'New'} />}
        </button>)}</div>}
    </div>{toast.node}</div>
}
