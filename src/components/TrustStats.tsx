import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { useI18n, money } from '../lib/i18n'
import { Icon } from './ui'

// ตัวเลขความน่าเชื่อถือจากฐานข้อมูลจริง (งานที่ทำเสร็จ · คะแนนเฉลี่ย · แม่บ้านในระบบ)
// แสดงเมื่องานที่เสร็จแล้วถึงเกณฑ์ settings.stats_min_jobs (ค่าเริ่มต้น 50 แก้ได้ในแอดมิน) ไม่ถึงเกณฑ์ = ไม่แสดงอะไรเลย
type S = { jobs_done: number; avg_rating: number | null; review_count: number; maids: number; min_jobs: number }
export function TrustStats({ desk = false }: { desk?: boolean }) {
  const { lang } = useI18n(); const th = lang === 'th'
  const [s, setS] = useState<S | null>(null)
  useEffect(() => { sb.rpc('public_stats').then(({ data }) => setS(data as S)) }, [])
  if (!s || s.jobs_done < s.min_jobs || s.jobs_done === 0) return null
  const items: [string, string, string][] = [
    ['home', money(s.jobs_done) + '+', th ? 'บ้านที่ทำความสะอาดแล้ว' : 'homes cleaned'],
    ...(s.avg_rating && s.review_count ? [['star', String(s.avg_rating), th ? `คะแนนเฉลี่ยจาก ${money(s.review_count)} รีวิว` : `average from ${money(s.review_count)} reviews`] as [string, string, string]] : []),
    ['team', money(s.maids), th ? 'แม่บ้านตรวจประวัติแล้ว' : 'verified helpers'],
  ]
  return <section className={'tstats' + (desk ? ' desk' : '')} aria-label={th ? 'ตัวเลขของคลีนดี' : 'CleenDee in numbers'}>
    {items.map(([i, n, l]) => <div key={l} className="tstat"><Icon n={i} size={desk ? 22 : 18} /><b>{n}</b><span>{l}</span></div>)}
  </section>
}
