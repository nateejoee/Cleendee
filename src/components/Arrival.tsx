import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Avatar } from './ui'
import { useI18n } from '../lib/i18n'
import { sb, type Booking, type Maid } from '../lib/supabase'
import './BookingHelp.css'

type Details = { status: string; key_allowed?: boolean; challenge?: string; expires_at?: string }
type Props = { booking: Booking; helper?: Pick<Maid, 'id' | 'nickname' | 'photo_url'>; side: 'helper' | 'customer'; reload: () => void }

export function Arrival({ booking, helper, side, reload }: Props) {
  const th = useI18n().lang === 'th'
  const customer = side === 'customer'
  const [info, setInfo] = useState<Details | null>(null)
  const [code, setCode] = useState(() => new URLSearchParams(location.hash.slice(1)).get('arrival') ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [revision, setRevision] = useState(0)
  const onChange = useRef(reload)
  onChange.current = reload
  const onWay = booking.status === 'on_the_way'
  useEffect(() => {
    if (customer && location.hash.startsWith('#arrival=')) {
      history.replaceState(history.state, '', location.pathname + location.search)
    }
  }, [customer])
  useEffect(() => {
    let active = true
    let timeout: ReturnType<typeof setTimeout>
    const read = async () => {
      const {data, error} = await sb.rpc('arrival_details', {p_booking: booking.id})
      if (!active) return
      if (error) setInfo(null)
      else {
        const result = data as Details
        setInfo(result)
        if (result.status !== booking.status) onChange.current()
      }
      timeout = setTimeout(read, 10000)
    }
    void read()
    return () => { active = false; clearTimeout(timeout) }
  }, [booking.id, booking.status, revision])
  const perform = async (action: 'key' | 'confirm' | 'start') => {
    if (busy || !info) return
    setBusy(true); setErr('')
    try {
      const result = action === 'key'
        ? await sb.rpc('arrival_key_access', {p_booking: booking.id, p_allow: !info.key_allowed})
        : action === 'confirm'
          ? await sb.rpc('arrival_confirm', {p_booking: booking.id, p_code: code.trim()})
          : await sb.rpc('maid_update_progress', {p_booking_id: booking.id, p_step: 'working'})
      if (result.error) {
        setErr(result.error.message.includes('arrival_code_invalid')
          ? (th ? 'รหัสไม่ตรงหรือหมดอายุ กรุณาดูรหัสล่าสุดจากเครื่องแม่บ้าน' : 'Invalid or expired code. Check the latest code on the helper’s phone.')
          : (th ? 'ดำเนินการไม่สำเร็จ กรุณาตรวจสถานะนัดแล้วลองอีกครั้ง' : 'Could not update this visit. Check its status and try again.'))
      } else {
        if (action === 'key') setInfo(null)
        onChange.current()
      }
    } finally { setBusy(false); setRevision(n => n+1) }
  }
  return <section className="cd-help card">
    <h2>{customer ? (th ? 'ยืนยันแม่บ้านที่มาถึง' : 'Verify your arriving helper') : (th ? 'ยืนยันก่อนเริ่มงาน' : 'Arrival check-in')}</h2>
    {customer && helper && <div className="row"><Avatar name={helper.nickname} seed={helper.id} url={helper.photo_url} size={54} kind="helper" gender={(helper as { gender?: string | null }).gender} /><b>{helper.nickname}</b></div>}
    {!info ? <div role="status">{th ? 'กำลังตรวจสถานะนัด' : 'Checking appointment status'} · <button className="link" onClick={() => setRevision(n => n+1)}>{th ? 'โหลดใหม่' : 'Reload'}</button></div>
      : customer ? <>
        {info.key_allowed ? <p>{th ? 'คุณอนุญาตให้แม่บ้านที่ระบุเริ่มงานด้วยกุญแจสำหรับนัดนี้แล้ว' : 'You have authorised this helper to start this visit using the key.'}</p>
          : onWay ? <>
            <p>{th ? 'เทียบรูปและชื่อกับแม่บ้านที่มาถึง แล้วสแกน QR ด้วยกล้องมือถือหรือกรอกรหัสจากเครื่องแม่บ้าน' : 'Check the arriving helper’s name and photo. Scan their QR with your phone camera or enter the code they show you.'}</p>
            <label className="field">{th ? 'รหัสประจำนัด' : 'Visit code'}<input className="input" value={code} maxLength={12} autoCapitalize="characters" autoComplete="off" spellCheck={false}
              onChange={e => setCode(e.target.value.toUpperCase().replace(/[^0-9A-F]/g, ''))} /></label>
            <button className="btn b-ocean" disabled={busy || !/^[0-9A-F]{12}$/i.test(code)} onClick={() => perform('confirm')}>{th ? 'ยืนยันตัวแม่บ้านและเริ่มงาน' : 'Confirm helper and start visit'}</button>
          </> : <p>{th ? 'เมื่อแม่บ้านมาถึง ให้เทียบรูปและยืนยันรหัสจากเครื่องแม่บ้านก่อนเริ่มงาน' : 'When your helper arrives, check their photo and confirm the code on their phone.'}</p>}
        <details><summary>{th ? 'กรณีฝากกุญแจ / ไม่อยู่รับ' : 'Key handover / away from home'}</summary>
          <p className="small muted">{th ? 'อนุญาตเฉพาะแม่บ้านและนัดนี้ ถอนสิทธิ์ได้ก่อนเริ่มงาน กรุณาตกลงวิธีรับกุญแจกับแม่บ้านผ่านแชต' : 'Consent applies only to this helper and visit. Revoke it before work starts. Arrange the handover in booking chat.'}</p>
          <button className="btn b-line mt8" disabled={busy} onClick={() => perform('key')}>{info.key_allowed ? (th ? 'ถอนสิทธิ์ใช้กุญแจ' : 'Revoke key access') : (th ? 'อนุญาตให้เริ่มงานด้วยกุญแจในนัดนี้' : 'Allow key access for this visit')}</button>
        </details>
      </> : info.key_allowed ? <>
        <p>{th ? 'ลูกค้าอนุญาตให้ใช้กุญแจเฉพาะนัดนี้ กดเริ่มงานเมื่อมาถึง' : 'The customer authorised key access for this visit. Start once you arrive.'}</p>
        <button className="btn b-ocean" disabled={busy} onClick={() => perform('start')}>{th ? 'มาถึงแล้ว · เริ่มงานด้วยกุญแจ' : 'Arrived · Start with key'}</button>
      </> : info.challenge && <>
        <p>{th ? 'เมื่อมาถึง ให้ลูกค้าสแกน QR หรือกรอกรหัสนี้ในหน้านัดของลูกค้า รหัสมีอายุ 10 นาที' : 'On arrival, show this QR or code to the customer. They confirm in their booking. Each code lasts 10 minutes.'}</p>
        <div className="cd-arrival-qr"><QRCodeSVG value={location.origin+'/bookings/'+booking.id+'#arrival='+info.challenge} size={172} /></div>
        <strong className="cd-arrival-code">{info.challenge}</strong>
      </>}
    {err && <div className="err" role="alert">{err}</div>}
  </section>
}
