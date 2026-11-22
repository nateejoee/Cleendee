import { useRef, useState } from 'react'
import { sb } from '../lib/supabase'
import { useI18n } from '../lib/i18n'
import { Icon } from './ui'

// ประเมินชั่วโมงและงานเสริมจากรูปห้อง (Gemini ผ่าน Edge Function ai-assist) ลูกค้าเลือกใช้หรือไม่ก็ได้
type Res = { hours: number | null; addons: string[]; note: string; left?: number }

// ย่อรูปให้ด้านยาวไม่เกิน 1024px แล้วแปลงเป็น JPEG base64 (ไม่ส่งรูปเต็มขึ้นระบบ)
async function shrink(f: File): Promise<string> {
  const bmp = await createImageBitmap(f)
  const k = Math.min(1, 1024 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.78).split(',')[1]
}

export function AiEstimate({ service, unit, addonName, onApply }: { service: string; unit: string; addonName: (c: string) => string; onApply: (hours: number, addons: string[]) => void }) {
  const { lang } = useI18n(); const th = lang === 'th'
  const inp = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false); const [res, setRes] = useState<Res | null>(null); const [err, setErr] = useState('')
  const [thumbs, setThumbs] = useState<string[]>([])
  const pick = async (files: FileList | null) => {
    const list = [...(files || [])].filter(f => f.type.startsWith('image/')).slice(0, 3)
    if (!list.length) return
    setBusy(true); setErr(''); setRes(null)
    try {
      const imgs = await Promise.all(list.map(shrink))
      setThumbs(imgs.map(x => 'data:image/jpeg;base64,' + x))
      const { data, error } = await sb.functions.invoke('ai-assist', { body: { op: 'estimate', images: imgs, service, lang } })
      if (error) {
        const st = (error as { context?: { status?: number } }).context?.status
        setErr(st === 429 ? (th ? 'ใช้ครบ 5 ครั้งของวันนี้แล้ว ลองใหม่พรุ่งนี้' : 'You have used all 5 tries today. Try again tomorrow')
          : (th ? 'ตอนนี้ระบบประเมินไม่ว่าง ลองใหม่อีกครั้ง หรือเลือกชั่วโมงเองได้เลย' : 'The estimator is busy. Try again, or choose the hours yourself'))
      } else setRes(data as Res)
    } catch { setErr(th ? 'อ่านรูปไม่ได้ ลองรูปอื่น' : 'Could not read the photo. Try another one') }
    setBusy(false); if (inp.current) inp.current.value = ''
  }
  return <div className="ai-est">
    <input ref={inp} type="file" accept="image/*" multiple hidden onChange={e => pick(e.target.files)} />
    {!res && <button type="button" className="ai-est-btn" disabled={busy} onClick={() => inp.current?.click()}>
      <span className="ai-est-ic" aria-hidden="true">✦</span>
      <span><b>{busy ? (th ? 'กำลังดูรูปห้อง…' : 'Looking at your photos…') : (th ? 'ไม่แน่ใจกี่ชั่วโมง? ให้ AI ประเมินจากรูป' : 'Not sure how long? Let AI estimate from photos')}</b>
        <small>{th ? 'ถ่ายรูปห้อง 1–3 รูป ระบบแนะนำชั่วโมงและงานเสริมให้' : 'Upload 1–3 room photos for a suggested time and add-ons'}</small></span>
      <Icon n="next" size={18} />
    </button>}
    {err && <p className="small" style={{ color: 'var(--brick)' }} role="alert">{err}</p>}
    {res && <div className="ai-est-res" role="status">
      <div className="ai-est-thumbs">{thumbs.map((s, i) => <img key={i} src={s} alt="" />)}</div>
      {res.hours ? <>
        <div className="ai-est-h"><span>{th ? 'แนะนำ' : 'Suggested'}</span><b>{res.hours} {unit}</b></div>
        {res.addons.length > 0 && <div className="small">{th ? 'งานเสริมที่แนะนำ: ' : 'Suggested add-ons: '}{res.addons.map(addonName).join(', ')}</div>}
        {res.note && <p className="small muted">{res.note}</p>}
        <div className="row"><button type="button" className="btn b-ocean sm" onClick={() => onApply(res.hours!, res.addons)}>{th ? 'ใช้คำแนะนำนี้' : 'Use this'}</button>
          <button type="button" className="btn b-ghost sm" onClick={() => { setRes(null); setThumbs([]) }}>{th ? 'ลองรูปอื่น' : 'Try other photos'}</button></div>
      </> : <><p className="small">{th ? 'ประเมินจากรูปนี้ไม่ได้ ลองถ่ายให้เห็นทั้งห้อง' : 'Could not estimate from these photos. Try a wider shot of the room.'}</p>
        <button type="button" className="btn b-ghost sm" onClick={() => { setRes(null); setThumbs([]) }}>{th ? 'ลองใหม่' : 'Try again'}</button></>}
      <p className="tiny muted">{th ? 'เป็นการประเมินคร่าวๆ โดย AI เปลี่ยนจำนวนชั่วโมงเองได้เสมอ' : 'A rough AI estimate. You can always change the hours.'}</p>
    </div>}
  </div>
}
