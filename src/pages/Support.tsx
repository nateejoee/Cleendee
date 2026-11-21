import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { sb, friendly } from '../lib/supabase'
import { useI18n } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { relTime } from '../lib/fx'
import { Icon, Loading, TopBar, useToast } from '../components/ui'

type Status = 'ai' | 'waiting_staff' | 'answered' | 'closed'
type Msg = { id: number; sender: 'customer' | 'ai' | 'staff' | 'system'; body: string; created_at: string }
type Thread = { id: number; status: Status }

// ข้อความระบบเก็บเป็นรหัส แปลงเป็นข้อความตามภาษาตอนแสดง
function systemText(code: string, th: boolean) {
  if (code === 'busy') return th ? 'ตอนนี้ผู้ช่วยอัตโนมัติตอบไม่ได้ ส่งเรื่องให้เจ้าหน้าที่แล้ว จะตอบกลับที่นี่' : 'The automatic helper cannot answer right now. We passed this to our staff and they will reply here.'
  return th ? 'ส่งเรื่องให้เจ้าหน้าที่แล้ว จะตอบกลับที่นี่' : 'Passed to our staff. They will reply here.'
}

// ลูกค้าคุยกับผู้ช่วย AI และขอคุยกับเจ้าหน้าที่ได้
export function Support() {
  const { lang, t } = useI18n(); const { session, profile, ready } = useAuth(); const toast = useToast()
  const th = lang === 'th'
  const [thread, setThread] = useState<Thread | null>(null); const [msgs, setMsgs] = useState<Msg[] | null>(null)
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [thinking, setThinking] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    if (!session) return
    const { data: t } = await sb.from('support_threads').select('id,status').eq('customer_id', session.user.id).maybeSingle()
    setThread((t as Thread | null) ?? null)
    if (!t) { setMsgs([]); return }
    const { data: m } = await sb.from('support_messages').select('id,sender,body,created_at').eq('thread_id', t.id).order('id')
    setMsgs((m as Msg[]) || [])
  }, [session])
  useEffect(() => { load() }, [load])
  // ถามหาข้อความใหม่จากเจ้าหน้าที่ทุก 8 วินาที ขณะเปิดหน้านี้
  useEffect(() => { const iv = setInterval(load, 8000); return () => clearInterval(iv) }, [load])
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [msgs?.length, thinking])

  if (ready && !session) return <Navigate to="/login" replace />
  if (profile && profile.role !== 'customer') return <Navigate to="/account" replace />
  if (!msgs) return <div className="page nobar"><TopBar title={th ? 'แชทช่วยเหลือ' : 'Help chat'} back="/account" /><Loading /></div>

  const send = async () => {
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    const { data, error } = await sb.rpc('support_post', { p_body: body })
    if (error) { toast.show(friendly(error, lang)); setBusy(false); return }
    setText(''); await load()
    if ((data as { status: Status }).status === 'ai') {
      setThinking(true)
      await sb.functions.invoke('support-chat').catch(() => null)
      setThinking(false); await load()
    }
    setBusy(false)
  }
  const askStaff = async () => {
    const { error } = await sb.rpc('support_handoff')
    if (error) toast.show(friendly(error, lang)); else await load()
  }
  const withStaff = thread?.status === 'waiting_staff' || thread?.status === 'answered'

  return <div className="page nobar support-page"><TopBar title={th ? 'แชทช่วยเหลือ' : 'Help chat'} back="/account" />
    <div className="pad mt16 stack">
      <div className="card stack support-box">
        <div className="chatbox">
          <div className="bub support-ai"><small className="support-who">{th ? 'ผู้ช่วยอัตโนมัติ (AI)' : 'Automatic helper (AI)'}</small>
            {th ? 'สวัสดีค่ะ ถามเรื่องราคา บริการ ขั้นตอนจอง การยกเลิก หรือการชดเชยได้เลย ถ้าอยากคุยกับเจ้าหน้าที่ กดปุ่มด้านล่างได้ค่ะ' : 'Hi! Ask about prices, services, booking steps, cancellation or compensation. Tap the button below if you would like to talk to our staff.'}</div>
          {msgs.map(m => m.sender === 'system'
            ? <div key={m.id} className="support-sys">{systemText(m.body, th)}</div>
            : <div key={m.id} className={'bub' + (m.sender === 'customer' ? ' me' : m.sender === 'staff' ? ' support-staff' : ' support-ai')}>
              {m.sender !== 'customer' && <small className="support-who">{m.sender === 'staff' ? (th ? 'เจ้าหน้าที่' : 'Staff') : (th ? 'ผู้ช่วยอัตโนมัติ (AI)' : 'Automatic helper (AI)')}</small>}
              {m.body}<small className="bt">{relTime(m.created_at, t)}</small></div>)}
          {thinking && <div className="bub support-ai support-typing" role="status" aria-label={th ? 'กำลังพิมพ์' : 'Typing'}><i /><i /><i /></div>}
          <div ref={end} />
        </div>
        {withStaff && <div className="infonote"><Icon n="clock" />{thread?.status === 'answered'
          ? (th ? 'เจ้าหน้าที่ตอบแล้ว พิมพ์ต่อได้เลย' : 'Staff has replied. You can keep typing.')
          : (th ? 'รอเจ้าหน้าที่ตอบ ปกติภายในเวลาทำการ' : 'Waiting for our staff to reply.')}</div>}
        <div className="row"><textarea className="input" rows={2} maxLength={1000} value={text} onChange={e => setText(e.target.value)}
          placeholder={th ? 'พิมพ์ข้อความ…' : 'Type a message…'}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
          <button className="btn b-ocean sm" disabled={busy || !text.trim()} onClick={send}>{th ? 'ส่ง' : 'Send'}</button></div>
        {!withStaff && <button className="btn b-line" onClick={askStaff}><Icon n="user" size={17} />{th ? 'คุยกับเจ้าหน้าที่' : 'Talk to staff'}</button>}
        <div className="tiny muted" style={{ textAlign: 'center' }}>{th ? 'AI อาจตอบผิดได้ ผู้ช่วยมองไม่เห็นข้อมูลการจองหรือบัญชีของคุณ ถ้าเกี่ยวกับการจองของคุณ ให้คุยกับเจ้าหน้าที่' : 'The AI can be wrong and cannot see your bookings or account. For anything about your booking, talk to our staff.'}</div>
      </div>
      <Link to="/guarantee" className="link" style={{ textAlign: 'center' }}>{th ? 'ดูการรับประกันของ CleenDee' : 'See the CleenDee guarantee'}</Link>
    </div>{toast.node}</div>
}

type Row = { id: number; customer_id: string; customer_name: string | null; status: Status; updated_at: string; last_body: string | null; last_sender: Msg['sender'] | null }

// แอดมินตอบแชทลูกค้า (เรื่องที่รอเจ้าหน้าที่ขึ้นก่อน)
export function AdminSupport() {
  const { lang, t } = useI18n(); const { profile, ready } = useAuth(); const toast = useToast(); const th = lang === 'th'
  const [rows, setRows] = useState<Row[] | null>(null); const [open, setOpen] = useState<Row | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([]); const [text, setText] = useState(''); const [busy, setBusy] = useState(false)
  const loadRows = useCallback(async () => { const { data } = await sb.rpc('admin_support_threads'); setRows((data as Row[]) || []) }, [])
  const loadMsgs = useCallback(async (id: number) => { const { data } = await sb.from('support_messages').select('id,sender,body,created_at').eq('thread_id', id).order('id'); setMsgs((data as Msg[]) || []) }, [])
  useEffect(() => { loadRows() }, [loadRows])
  useEffect(() => { const iv = setInterval(() => { loadRows(); if (open) loadMsgs(open.id) }, 8000); return () => clearInterval(iv) }, [loadRows, loadMsgs, open])
  if (ready && profile?.role !== 'admin') return <Navigate to="/" />
  const pick = (r: Row) => { setOpen(r); setMsgs([]); loadMsgs(r.id) }
  const reply = async () => {
    if (!open || !text.trim() || busy) return
    setBusy(true)
    const { error } = await sb.rpc('admin_support_reply', { p_thread: open.id, p_body: text })
    if (error) toast.show(friendly(error, lang)); else { setText(''); await loadMsgs(open.id); await loadRows() }
    setBusy(false)
  }
  const close = async () => {
    if (!open) return
    const { error } = await sb.rpc('admin_support_close', { p_thread: open.id })
    if (error) toast.show(friendly(error, lang)); else { setOpen(null); await loadRows() }
  }
  const label: Record<Status, string> = { waiting_staff: th ? 'รอตอบ' : 'Waiting', answered: th ? 'ตอบแล้ว' : 'Answered', ai: th ? 'AI ตอบอยู่' : 'With AI', closed: th ? 'ปิดแล้ว' : 'Closed' }

  if (open) return <div className="page nobar support-page"><TopBar title={open.customer_name || (th ? 'ลูกค้า' : 'Customer')} back={false} right={<button className="link" onClick={() => { setOpen(null); loadRows() }}>{th ? 'กลับ' : 'Back'}</button>} />
    <div className="pad mt16 stack"><div className="card stack support-box">
      <div className="chatbox">{msgs.map(m => m.sender === 'system'
        ? <div key={m.id} className="support-sys">{systemText(m.body, th)}</div>
        : <div key={m.id} className={'bub' + (m.sender === 'staff' ? ' me' : m.sender === 'ai' ? ' support-ai' : '')}>
          {m.sender === 'ai' && <small className="support-who">AI</small>}{m.body}<small className="bt">{relTime(m.created_at, t)}</small></div>)}</div>
      <div className="row"><textarea className="input" rows={2} maxLength={1500} value={text} onChange={e => setText(e.target.value)} placeholder={th ? 'ตอบลูกค้า…' : 'Reply…'} />
        <button className="btn b-ocean sm" disabled={busy || !text.trim()} onClick={reply}>{th ? 'ส่ง' : 'Send'}</button></div>
      {open.status !== 'closed' && <button className="btn b-line" onClick={close}>{th ? 'ปิดเรื่องนี้' : 'Close this chat'}</button>}
    </div></div>{toast.node}</div>

  return <div className="page nobar"><TopBar title={th ? 'แชทลูกค้า' : 'Customer chats'} back="/admin" />
    <div className="pad mt16 stack">{!rows ? <Loading /> : rows.length === 0 ? <div className="admin-empty">✓ {th ? 'ยังไม่มีแชท' : 'No chats yet'}</div>
      : rows.map(r => <button key={r.id} className="card support-row" onClick={() => pick(r)}>
        <span className="between"><b>{r.customer_name || (th ? 'ลูกค้า' : 'Customer')}</b><span className={'pill ' + (r.status === 'waiting_staff' ? 'p-brick' : r.status === 'answered' ? 'p-leaf' : 'p-grey')}>{label[r.status]}</span></span>
        <small className="muted">{r.last_sender === 'system' ? systemText(r.last_body || '', th) : r.last_body}</small></button>)}</div>{toast.node}</div>
}
