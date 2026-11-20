import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { useI18n } from '../lib/i18n'

type Totals = { views: number; view_booked: number; full_dates: number; recovered: number }
export function FunnelReport() {
  const th = useI18n().lang === 'th'
  const [totals, setTotals] = useState<Totals | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => { sb.rpc('booking_funnel_report').then(({ data, error }) => { setFailed(!!error); setTotals(data as Totals | null) }) }, [])
  const ratio = (n: number, d: number) => d ? Math.round(100*n/d)+'% ('+n+'/'+d+')' : '— (0/0)'
  return <section className="card cd-help">
    <h2>{th ? 'ผลการจองใน 30 วันที่ผ่านมา' : 'Booking conversion · last 30 days'}</h2>
    {totals ? <>
      <div>{th ? 'เปิดหน้าบริการแล้วสร้างรายการจอง' : 'Service visits resulting in a booking'} · <b>{ratio(totals.view_booked, totals.views)}</b></div>
      <div>{th ? 'พบวันเต็มแล้วใช้คิวแนะนำจนจองได้' : 'Fully booked dates recovered via a suggestion'} · <b>{ratio(totals.recovered, totals.full_dates)}</b></div>
      <small className="muted">{th ? 'วัดต่อรอบการจอง นับเมื่อสร้างรายการสำเร็จก่อนชำระเงิน' : 'Per booking attempt. Conversion means a booking was created, before payment.'}</small>
    </> : <p>{failed ? (th ? 'โหลดสถิติไม่ได้' : 'Statistics unavailable') : (th ? 'กำลังโหลด…' : 'Loading…')}</p>}
  </section>
}
