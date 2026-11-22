import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../lib/i18n'
import { Icon } from './ui'

// ช่องเลือกวันที่แบบปฏิทิน (ใช้แทน <input type="date"> ทั้งเว็บ)
// - กดช่องแล้วเปิดปฏิทิน: คอม/ไอแพดเป็นกล่องลอยใต้ช่อง, มือถือเป็นแผ่นเลื่อนขึ้นจากด้านล่าง
// - เลือกเดือน/ปีได้จากดรอปดาวน์ (ปีภาษาไทยเป็น พ.ศ.) เหมาะกับวันเกิดที่ต้องย้อนหลายสิบปี
// - ค่าที่ส่งออกยังเป็นรูปแบบ YYYY-MM-DD เหมือน input เดิม
const pad = (n: number) => String(n).padStart(2, '0')
const todayTH = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10) // วันนี้ตามเวลาไทย

type Props = {
  value: string; onChange: (v: string) => void
  min?: string; max?: string; id?: string; invalid?: boolean
  placeholder?: string; clearable?: boolean
  openAt?: string // เดือนที่จะเปิดเมื่อยังไม่มีค่า (เช่นวันเกิดให้เปิดย้อนไปหลายปี)
}

export function DateField({ value, onChange, min = '1900-01-01', max = '2100-12-31', id, invalid, placeholder, clearable, openAt }: Props) {
  const { lang } = useI18n(); const th = lang === 'th'; const loc = th ? 'th-TH' : 'en-GB'
  const [open, setOpen] = useState(false); const [up, setUp] = useState(false)
  const today = todayTH()
  const clamp = (d: string) => d < min ? min : d > max ? max : d
  const start = () => (value || clamp(openAt || today)).slice(0, 7)
  const [ym, setYm] = useState(start)
  const box = useRef<HTMLDivElement>(null); const btn = useRef<HTMLButtonElement>(null)

  // ปิดเมื่อกดนอกกล่องหรือกด Esc
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent | TouchEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus() } }
    document.addEventListener('mousedown', down); document.addEventListener('touchstart', down); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('touchstart', down); document.removeEventListener('keydown', key) }
  }, [open])

  const toggle = () => {
    if (!open) {
      setYm(start())
      // ถ้าด้านล่างที่ว่างไม่พอ ให้กล่องเปิดขึ้นด้านบนแทน
      const r = btn.current?.getBoundingClientRect()
      setUp(!!r && window.innerHeight - r.bottom < 420 && r.top > 420)
    }
    setOpen(!open)
  }
  const pick = (d: string) => { onChange(d); setOpen(false); btn.current?.focus() }

  const [y, m] = ym.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1, 1))
  const lead = (first.getUTCDay() + 6) % 7 // ช่องว่างก่อนวันที่ 1 (เริ่มสัปดาห์วันจันทร์)
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const go = (yy: number, mm: number) => { const d = new Date(Date.UTC(yy, mm - 1, 1)); setYm(d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1)) }
  const months = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2024, i, 1)).toLocaleDateString(loc, { month: 'long', timeZone: 'UTC' }))
  const wk = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(loc, { weekday: 'narrow', timeZone: 'UTC' }))
  const y0 = Number(min.slice(0, 4)), y1 = Number(max.slice(0, 4))
  const years = Array.from({ length: y1 - y0 + 1 }, (_, i) => y1 - i) // ปีล่าสุดอยู่บน
  const label = value ? new Date(value + 'T12:00:00Z').toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : ''
  const canToday = today >= min && today <= max

  return <div className={'dfield' + (open ? ' open' : '')} ref={box}>
    <button ref={btn} id={id} type="button" className={'input dfield-btn' + (value ? '' : ' empty')} aria-invalid={invalid || undefined}
      aria-haspopup="dialog" aria-expanded={open} onClick={toggle}>
      <span>{label || placeholder || (th ? 'เลือกวันที่' : 'Pick a date')}</span>
      <span className="dfield-ic"><Icon n="cal" size={18} /></span>
    </button>
    {open && <>
      <div className="dfield-scrim" onClick={() => setOpen(false)} />
      <div className={'dpick' + (up ? ' up' : '')} role="dialog" aria-label={th ? 'เลือกวันที่' : 'Pick a date'}>
        <div className="dpick-grab" />
        <div className="dpick-head">
          <button type="button" className="dpick-nav" disabled={ym <= min.slice(0, 7)} onClick={() => go(y, m - 1)} aria-label={th ? 'เดือนก่อน' : 'Previous month'}><Icon n="back" size={18} /></button>
          <div className="dpick-sel">
            <label className="dpick-pill"><select value={m} onChange={e => go(y, Number(e.target.value))} aria-label={th ? 'เดือน' : 'Month'}>
              {months.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}</select></label>
            <label className="dpick-pill"><select value={y} onChange={e => go(Number(e.target.value), m)} aria-label={th ? 'ปี' : 'Year'}>
              {years.map(v => <option key={v} value={v}>{th ? v + 543 : v}</option>)}</select></label>
          </div>
          <button type="button" className="dpick-nav" disabled={ym >= max.slice(0, 7)} onClick={() => go(y, m + 1)} aria-label={th ? 'เดือนถัดไป' : 'Next month'}><Icon n="next" size={18} /></button>
        </div>
        <div className="dpick-grid">
          {wk.map((w, i) => <span key={i} className={'dpick-wd' + (i > 4 ? ' we' : '')}>{w}</span>)}
          {Array.from({ length: lead }, (_, i) => <span key={'e' + i} />)}
          {Array.from({ length: dim }, (_, i) => {
            const d = ym + '-' + pad(i + 1); const off = d < min || d > max
            return <button type="button" key={d} disabled={off} aria-pressed={d === value}
              className={'dpick-d' + (d === value ? ' on' : '') + (d === today ? ' today' : '')}
              aria-label={new Date(d + 'T12:00:00Z').toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
              onClick={() => pick(d)}>{i + 1}</button>
          })}
        </div>
        <div className="dpick-foot">
          {canToday ? <button type="button" className="dpick-link" onClick={() => pick(today)}>{th ? 'วันนี้' : 'Today'}</button> : <span />}
          {clearable && value ? <button type="button" className="dpick-link muted" onClick={() => pick('')}>{th ? 'ล้างวันที่' : 'Clear'}</button>
            : <button type="button" className="dpick-link muted" onClick={() => setOpen(false)}>{th ? 'ปิด' : 'Close'}</button>}
        </div>
      </div>
    </>}
  </div>
}
