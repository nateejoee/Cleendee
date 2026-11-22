import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { sb, friendly, type Booking } from '../lib/supabase'
import { useI18n, fmtDate, fmtTime } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { bkkToday } from '../lib/draft'
import { DateField } from './DateField'
import { Icon } from './ui'

// ===== รับประกันความพอใจ: ขอแก้งานฟรี (ใช้ระบบหลังบ้านเดิม reclean_requests) =====
// กติกา (บังคับในฐานข้อมูล): แจ้งภายใน 24 ชม. หลังจบงาน · แนบรูป 1–6 รูป · ขอได้ครั้งเดียวต่องาน
// แอดมินอนุมัติแล้วนัดแม่บ้านคนเดิมมาแก้ 1–4 ชม. · แม่บ้านกดเสร็จได้ตั้งแต่ 30 นาทีก่อนเวลานัด
export type Reclean = { id: number; booking_id: number; customer_id: string; maid_id: string; description: string; photo_paths: string[]; preferred_at: string | null
  status: 'pending' | 'approved' | 'rejected' | 'done' | 'cancelled'; admin_note: string | null; start_at: string | null; end_at: string | null; created_at: string; done_at: string | null; done_note: string | null }

const RECLEAN_HOURS = 24
const HOURS = Array.from({ length: 12 }, (_, i) => i + 7) // 07:00–18:00
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: string, h: number) => `${d}T${pad(h)}:00:00+07:00`

// สถานะเป็นข้อความ + สีป้าย
function statusLabel(s: Reclean['status'], th: boolean): [string, string] {
  return ({
    pending: [th ? 'รอทีมงานตรวจสอบ' : 'Under review', 'p-sun'], approved: [th ? 'นัดแก้งานแล้ว' : 'Re-clean scheduled', 'p-ocean'],
    done: [th ? 'แก้งานเรียบร้อย' : 'Re-clean done', 'p-leaf'], rejected: [th ? 'ไม่อนุมัติ' : 'Not approved', 'p-brick'], cancelled: [th ? 'ยกเลิกนัดแล้ว' : 'Cancelled', 'p-brick'],
  } as Record<string, [string, string]>)[s]
}

// ---------- ฝั่งลูกค้า: ในหน้ารายละเอียดการจองที่จบงานแล้ว ----------
export function RecleanCustomer({ b }: { b: Booking }) {
  const { lang } = useI18n(); const th = lang === 'th'; const { session } = useAuth()
  const [r, setR] = useState<Reclean | null | undefined>(undefined)
  const [open, setOpen] = useState(false); const [desc, setDesc] = useState(''); const [files, setFiles] = useState<File[]>([])
  const [pd, setPd] = useState(''); const [ph, setPh] = useState(10); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const load = () => { sb.from('reclean_requests').select('*').eq('booking_id', b.id).maybeSingle().then(({ data }) => setR((data as Reclean) ?? null)) }
  useEffect(load, [b.id])
  if (b.status !== 'completed' || !b.maid_id || !b.completed_at || r === undefined) return null
  const deadline = new Date(b.completed_at).getTime() + RECLEAN_HOURS * 3600e3
  const left = deadline - Date.now()

  if (r) {
    const [lab, cls] = statusLabel(r.status, th)
    return <div className="card rc-card">
      <div className="between"><b className="rc-title"><Icon n="redo" size={18} />{th ? 'ขอแก้งานฟรี' : 'Free re-clean'}</b><span className={'pill ' + cls}>{lab}</span></div>
      {r.status === 'approved' && r.start_at && <div className="rc-when"><Icon n="cal" size={16} />{fmtDate(r.start_at, lang)} · {fmtTime(r.start_at)}–{r.end_at ? fmtTime(r.end_at) : ''}</div>}
      {r.status === 'pending' && <p className="small muted">{th ? 'ทีมงานจะตรวจสอบและนัดแม่บ้านคนเดิมมาแก้งานให้ แจ้งผลผ่านการแจ้งเตือน' : "We'll review it and book your helper to come back. You'll get a notification."}</p>}
      {r.status === 'done' && <p className="small muted">{th ? 'แม่บ้านแก้งานเรียบร้อยแล้ว' : 'Your helper has finished the re-clean.'}{r.done_note ? ' · ' + r.done_note : ''}</p>}
      {r.admin_note && <p className="small rc-note">{th ? 'หมายเหตุจากทีมงาน: ' : 'Note from our team: '}{r.admin_note}</p>}
      <p className="small rc-desc">“{r.description}”</p>
    </div>
  }
  if (left <= 0) return null
  const hrs = Math.max(1, Math.ceil(left / 3600e3))
  const send = async () => {
    if (busy) return; setBusy(true); setErr('')
    try {
      const paths: string[] = []
      for (const f of files.slice(0, 6)) {
        const p = `${session!.user.id}/reclean-${b.id}-${Date.now()}-${paths.length}.${f.name.split('.').pop() || 'jpg'}`
        const up = await sb.storage.from('claims').upload(p, f); if (up.error) throw up.error; paths.push(p)
      }
      const { error } = await sb.rpc('submit_reclean', { p_booking_id: b.id, p_description: desc, p_photo_paths: paths, p_preferred_at: pd ? iso(pd, ph) : null })
      if (error) throw error
      setOpen(false); load()
    } catch (e) { setErr(friendly(e, lang)) } finally { setBusy(false) }
  }
  return <div className="card rc-card rc-offer">
    <div className="rc-head"><span className="rc-ic"><Icon n="shield" size={20} /></span>
      <div><b>{th ? 'ไม่พอใจตรงไหน แก้งานให้ฟรี' : 'Not happy? Free re-clean'}</b>
        <div className="small muted">{th ? `รับประกันความพอใจ · แจ้งได้อีก ${hrs} ชม.` : `Satisfaction guarantee · ${hrs}h left to ask`}</div></div></div>
    {!open ? <button className="btn b-ghost mt8" onClick={() => setOpen(true)}><Icon n="redo" size={18} />{th ? 'ขอแก้งานฟรี' : 'Request a free re-clean'}</button> : <div className="stack mt8">
      <div className="field"><label>{th ? 'จุดที่ยังไม่เรียบร้อย' : "What wasn't right?"}</label>
        <textarea className="input" maxLength={1000} value={desc} onChange={e => setDesc(e.target.value)} placeholder={th ? 'เช่น ห้องน้ำชั้น 2 ยังมีคราบที่กระจก' : 'e.g. upstairs bathroom mirror still has marks'} /></div>
      <label className="btn b-ghost" style={{ cursor: 'pointer' }}><Icon n="camera" size={18} />{th ? 'แนบรูปจุดที่ต้องแก้' : 'Add photos'} ({files.length}/6)
        <input type="file" accept="image/*" multiple hidden onChange={e => setFiles([...(e.target.files || [])].slice(0, 6))} /></label>
      <div className="field"><label>{th ? 'วันที่สะดวกให้มาแก้ (ไม่บังคับ)' : 'Preferred day (optional)'}</label>
        <div className="row" style={{ gap: 8 }}><div style={{ flex: 2 }}><DateField clearable value={pd} onChange={setPd} min={bkkToday()} max={bkkToday(14)} placeholder={th ? 'ไม่ระบุ' : 'Any day'} /></div>
          {pd && <select className="input" style={{ flex: 1 }} value={ph} onChange={e => setPh(Number(e.target.value))} aria-label={th ? 'เวลา' : 'Time'}>{HOURS.map(h => <option key={h} value={h}>{pad(h)}:00</option>)}</select>}</div></div>
      {err && <div className="err">{err}</div>}
      <div className="row"><button className="btn b-ghost" style={{ flex: 1 }} onClick={() => setOpen(false)}>{th ? 'ยกเลิก' : 'Cancel'}</button>
        <button className="btn b-sun" style={{ flex: 2 }} disabled={busy || desc.trim().length < 5 || files.length === 0} onClick={send}>{busy ? '…' : th ? 'ส่งคำขอแก้งาน' : 'Send request'}</button></div>
      <small className="muted">{th ? 'ต้องมีรายละเอียดและรูปอย่างน้อย 1 รูป · ขอได้ 1 ครั้งต่องาน' : 'A description and at least 1 photo are required · once per job'}</small>
    </div>}
  </div>
}

// ---------- ฝั่งแอดมิน: คำขอที่รออนุมัติ + นัดที่อนุมัติแล้ว (หน้าการเงิน) ----------
export function RecleanAdmin({ showPhoto, toast }: { showPhoto: (bucket: string, path: string) => void; toast: (m: string) => void }) {
  const { lang } = useI18n(); const th = lang === 'th'
  const [rows, setRows] = useState<Reclean[] | null>(null); const [names, setNames] = useState<Record<string, string>>({})
  const [f, setF] = useState<Record<number, { d: string; h: number; len: number; note: string }>>({})
  const load = async () => {
    const { data } = await sb.from('reclean_requests').select('*').in('status', ['pending', 'approved']).order('created_at')
    const list = (data as Reclean[]) || []; setRows(list)
    const ids = [...new Set(list.map(x => x.maid_id))]
    if (ids.length) sb.from('maids').select('id,nickname').in('id', ids).then(({ data: m }) => setNames(Object.fromEntries((m || []).map(x => [x.id, x.nickname]))))
  }
  useEffect(() => { void load() }, [])
  const run = async (fn: string, args: object) => { const { error } = await sb.rpc(fn, args); toast(error ? friendly(error, lang) : (th ? 'บันทึกแล้ว' : 'Saved')); void load() }
  const get = (r: Reclean) => f[r.id] ?? { d: r.preferred_at ? new Date(new Date(r.preferred_at).getTime() + 7 * 3600e3).toISOString().slice(0, 10) : '', h: r.preferred_at ? new Date(new Date(r.preferred_at).getTime() + 7 * 3600e3).getUTCHours() : 10, len: 2, note: '' }
  const set = (r: Reclean, p: Partial<{ d: string; h: number; len: number; note: string }>) => setF({ ...f, [r.id]: { ...get(r), ...p } })
  if (!rows) return null
  if (rows.length === 0) return <div className="admin-empty">✓ {th ? 'ไม่มีคำขอแก้งาน' : 'No re-clean requests'}</div>
  return <div className="admin-grid">{rows.map(r => { const v = get(r); const [lab, cls] = statusLabel(r.status, th)
    return <div key={r.id} className="card stack">
      <div className="between"><b className="disp">#{r.booking_id} · {names[r.maid_id] ?? '…'}</b><span className={'pill ' + cls}>{lab}</span></div>
      <div className="small">{r.description}</div>
      <div className="small muted">{th ? 'ส่งเมื่อ ' : 'Sent '}{fmtDate(r.created_at, lang)} {fmtTime(r.created_at)}{r.preferred_at ? ` · ${th ? 'ลูกค้าสะดวก' : 'Prefers'} ${fmtDate(r.preferred_at, lang)} ${fmtTime(r.preferred_at)}` : ''}</div>
      <div className="row">{r.photo_paths.map((p, i) => <button key={p} className="btn sm b-ghost" onClick={() => showPhoto('claims', p)}>📷 {i + 1}</button>)}</div>
      {r.status === 'pending' ? <>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 100%' }}><DateField value={v.d} onChange={d => set(r, { d })} min={bkkToday()} max={bkkToday(30)} placeholder={th ? 'วันนัดแก้งาน' : 'Re-clean day'} /></div>
          <select className="input" style={{ flex: '1 1 90px' }} value={v.h} onChange={e => set(r, { h: Number(e.target.value) })}>{HOURS.map(h => <option key={h} value={h}>{pad(h)}:00</option>)}</select>
          <select className="input" style={{ flex: '1 1 90px' }} value={v.len} onChange={e => set(r, { len: Number(e.target.value) })}>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} {th ? 'ชม.' : 'h'}</option>)}</select>
        </div>
        <input className="input" maxLength={500} placeholder={th ? 'หมายเหตุถึงลูกค้า (ไม่บังคับ)' : 'Note to customer (optional)'} value={v.note} onChange={e => set(r, { note: e.target.value })} />
        <div className="row"><button className="btn sm b-ocean" disabled={!v.d} onClick={() => run('admin_decide_reclean', { p_id: r.id, p_approve: true, p_start_at: iso(v.d, v.h), p_hours: v.len, p_note: v.note || null })}>{th ? 'อนุมัติและนัด' : 'Approve & schedule'}</button>
          <button className="btn sm b-red" onClick={() => run('admin_decide_reclean', { p_id: r.id, p_approve: false, p_note: v.note || null })}>{th ? 'ไม่อนุมัติ' : 'Reject'}</button></div>
      </> : <div className="between"><span className="small"><Icon n="cal" size={14} /> {r.start_at && `${fmtDate(r.start_at, lang)} ${fmtTime(r.start_at)}–${r.end_at ? fmtTime(r.end_at) : ''}`}</span>
        <button className="btn sm b-ghost" onClick={() => run('admin_cancel_reclean', { p_id: r.id })}>{th ? 'ยกเลิกนัด' : 'Cancel'}</button></div>}
    </div> })}</div>
}

// ---------- ฝั่งแม่บ้าน: นัดแก้งานที่อนุมัติแล้ว (หน้างานของฉัน) ----------
export function RecleanMaid() {
  const { lang } = useI18n(); const th = lang === 'th'; const { session } = useAuth()
  const [rows, setRows] = useState<Reclean[]>([]); const [err, setErr] = useState('')
  const load = () => { if (session) sb.from('reclean_requests').select('*').eq('maid_id', session.user.id).eq('status', 'approved').order('start_at').then(({ data }) => setRows((data as Reclean[]) || [])) }
  useEffect(load, [session])
  if (!rows.length) return null
  const done = async (id: number) => { setErr(''); const { error } = await sb.rpc('maid_complete_reclean', { p_id: id }); if (error) setErr(friendly(error, lang)); load() }
  return <div className="stack">
    <h2 className="desk-heading">{th ? 'นัดแก้งาน (รับประกันความพอใจ)' : 'Re-clean visits'}</h2>
    {rows.map(r => <div key={r.id} className="card rc-card rc-maid">
      <div className="between"><b className="rc-title"><Icon n="redo" size={18} />{th ? 'กลับไปแก้งาน' : 'Re-clean'} #{r.booking_id}</b><span className="pill p-ocean">{th ? 'ไม่มีค่าใช้จ่ายลูกค้า' : 'Free for customer'}</span></div>
      {r.start_at && <div className="rc-when"><Icon n="cal" size={16} />{fmtDate(r.start_at, lang)} · {fmtTime(r.start_at)}–{r.end_at ? fmtTime(r.end_at) : ''}</div>}
      <p className="small rc-desc">“{r.description}”</p>
      {r.admin_note && <p className="small rc-note">{th ? 'ทีมงาน: ' : 'Team: '}{r.admin_note}</p>}
      <div className="row"><Link to={'/maid/job/' + r.booking_id} className="btn b-ghost" style={{ flex: 1 }}>{th ? 'ดูที่อยู่งานเดิม' : 'Original job'}</Link>
        <button className="btn b-sun" style={{ flex: 1 }} onClick={() => done(r.id)}>{th ? 'แก้งานเสร็จแล้ว' : 'Mark done'}</button></div>
    </div>)}
    {err && <div className="err">{err}</div>}
  </div>
}
