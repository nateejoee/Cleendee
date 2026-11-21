import { useEffect, useState } from 'react'
import { sb, friendly } from '../lib/supabase'
import { useI18n } from '../lib/i18n'

// แจ้งเตือนแม่บ้านทาง LINE OA CleenDee: เพิ่มเพื่อน แล้วส่งรหัส 6 หลักในแชท (แม่บ้านที่ล็อกอินด้วย LINE เชื่อมเองเมื่อเพิ่มเพื่อน)
const OA = '@716smhqr'
const ADD = 'https://line.me/R/ti/p/' + encodeURIComponent(OA)

export function LineLink() {
  const { lang } = useI18n(); const th = lang === 'th'
  const [st, setSt] = useState<{ linked: boolean } | null>(null)
  const [code, setCode] = useState<{ code: string; expires_at: string } | null>(null)
  const [err, setErr] = useState('')
  const load = () => sb.rpc('maid_line_status').then(({ data }) => setSt((data as { linked: boolean } | null) ?? { linked: false }))
  useEffect(() => { load() }, [])
  // ระหว่างรอให้แม่บ้านส่งรหัส เช็กสถานะทุก 5 วินาที
  useEffect(() => { if (!code || st?.linked) return; const t = setInterval(load, 5000); return () => clearInterval(t) }, [code, st?.linked])
  const getCode = async () => { setErr(''); const { data, error } = await sb.rpc('maid_line_code'); if (error) setErr(friendly(error, lang)); else setCode(data as { code: string; expires_at: string }) }
  const unlink = async () => { await sb.rpc('maid_line_unlink'); setCode(null); load() }
  if (!st) return null
  if (st.linked) return <div className="card ln-card on">
    <span className="ln-ico" aria-hidden="true">LINE</span>
    <span className="ln-txt"><b>{th ? 'แจ้งเตือนทาง LINE เปิดอยู่' : 'LINE alerts are on'}</b><small>{th ? 'งานใหม่ และเตือนงานพรุ่งนี้ (18:00 น.)' : 'New jobs and a reminder the evening before (6 pm)'}</small></span>
    <button className="btn sm b-ghost" onClick={unlink}>{th ? 'ยกเลิก' : 'Turn off'}</button></div>
  return <div className="card ln-card">
    <div className="ln-head"><span className="ln-ico" aria-hidden="true">LINE</span>
      <span className="ln-txt"><b>{th ? 'รับแจ้งเตือนงานทาง LINE' : 'Get job alerts on LINE'}</b><small>{th ? 'งานใหม่เด้งเข้า LINE ทันที และเตือนก่อนวันทำงาน' : 'New jobs straight to LINE, plus a reminder the day before'}</small></span></div>
    <ol className="ln-steps">
      <li><span>{th ? 'เพิ่มเพื่อน LINE CleenDee' : 'Add CleenDee on LINE'}</span><a className="btn sm b-line" href={ADD} target="_blank" rel="noopener">{th ? 'เพิ่มเพื่อน' : 'Add friend'}</a></li>
      <li><span>{th ? 'ขอรหัส แล้วพิมพ์ส่งในแชท LINE CleenDee' : 'Get a code and send it in the CleenDee LINE chat'}</span>
        {code ? <b className="ln-code">{code.code}</b> : <button className="btn sm b-ocean" onClick={getCode}>{th ? 'ขอรหัส' : 'Get code'}</button>}</li>
    </ol>
    {code && <small className="muted">{th ? 'รหัสใช้ได้ 30 นาที · ส่งแล้วหน้านี้จะเปลี่ยนเป็น "เปิดอยู่" เอง' : 'Code works for 30 minutes · this card updates once linked'}</small>}
    {err && <small style={{ color: 'var(--brick)' }}>{err}</small>}
  </div>
}
