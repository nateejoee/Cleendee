import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { fmtDate, useI18n } from '../lib/i18n'
import type { Draft } from '../lib/draft'

type Option = { visit_date: string; slot_time: string; helper_id: string | null; helper_name: string | null }
type Props = { date: string; maid: string | null; service: string; hours: number; plan: Draft['plan']; choose: (row: Option) => void }
export function SlotAlternatives({ date, maid, service, hours, plan, choose }: Props) {
  const th = useI18n().lang === 'th'
  const [options, setOptions] = useState<Option[] | null>(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setOptions(null); setError(false)
    sb.rpc('booking_alternatives', { p_date: date, p_maid: maid, p_service_code: service, p_hours: hours, p_plan: plan })
      .then(({data, error}) => { if (active) { setError(!!error); setOptions((data ?? []) as Option[]) } })
    return () => { active = false }
  }, [date, maid, service, hours, plan, retry])
  if (error) return <button className="btn b-line" onClick={() => setRetry(n => n+1)}>{th ? 'ค้นหาคิวอื่นอีกครั้ง' : 'Retry alternative times'}</button>
  if (!options) return <p role="status">{th ? 'กำลังหาคิวที่ว่าง…' : 'Finding available times…'}</p>
  const next = options.find(row => row.visit_date !== date)
  const others = options.filter(row => row.visit_date === date)
  const time = (row: Option) => row.slot_time.slice(0,5)
  return <section className="cd-help" aria-live="polite">
    <strong>{th ? 'วันที่เลือกไม่มีคิวว่าง' : 'No availability on this date'}</strong>
    {next && <button className="btn b-line" onClick={() => choose(next)}>
      {maid ? (th ? 'คิวถัดไปของแม่บ้านคนนี้' : 'Next time with this helper') : (th ? 'คิวว่างถัดไป' : 'Next available time')} · {fmtDate(next.visit_date+'T12:00:00+07:00', th ? 'th' : 'en')} {time(next)}
    </button>}
    {others.length > 0 && <><b>{th ? 'แม่บ้านที่ว่างในวันเดิม' : 'Other helpers on this date'}</b>
      {others.map(row => <button className="btn b-line" key={row.helper_id} onClick={() => choose(row)}>{row.helper_name} · {time(row)}</button>)}</>}
    {!options.length && <p className="muted">{th ? 'ไม่พบคิวถัดไปในช่วงที่เปิดจอง ลองเลือกวันอื่นหรือปรับรายละเอียดงาน' : 'No later times in the booking window. Try another date or adjust the job.'}</p>}
  </section>
}
