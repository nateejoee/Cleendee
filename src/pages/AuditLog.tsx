import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { sb } from '../lib/supabase'
import { useI18n, fmtDate, fmtTime } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { AdminTabs, Icon, Loading, TopBar } from '../components/ui'

type Entry = { id: number; at: string; actor_id: string | null; actor_name: string | null; actor_role: string | null; action: string; table_name: string; row_id: string | null; changes: Record<string, unknown> }

// ชื่อตารางเป็นภาษาคน
const TABLES: Record<string, [string, string]> = {
  bookings: ['การจอง', 'Booking'], payments: ['การชำระเงิน', 'Payment'], refunds: ['การคืนเงิน', 'Refund'], payouts: ['จ่ายเงินแม่บ้าน', 'Payout'],
  claims: ['เคลมความเสียหาย', 'Claim'], maids: ['แม่บ้าน', 'Helper'], packages: ['แพ็กเกจ', 'Package'], profiles: ['ผู้ใช้', 'User'],
  settings: ['ตั้งค่าร้าน', 'Shop settings'], payment_settings: ['บัญชีรับเงิน', 'Payment account'], service_types: ['บริการและราคา', 'Service & price'],
  service_addons: ['งานเสริม', 'Add-on'], promo_codes: ['โค้ดส่วนลด', 'Promo code'], cancellation_rules: ['กติกายกเลิก', 'Cancellation rule'],
  package_plans: ['แผนแพ็กเกจ', 'Package plan'], districts: ['พื้นที่ (อำเภอ)', 'District'], provinces: ['พื้นที่ (จังหวัด)', 'Province'],
  public_page_content: ['หน้าการันตี/นโยบาย', 'Public page'], auth: ['เข้าสู่ระบบ', 'Sign-in'],
}
const FILTERS: [string, string, string, string[] | null][] = [
  ['all', 'ทั้งหมด', 'All', null],
  ['money', 'การเงิน', 'Money', ['payments', 'refunds', 'payouts', 'claims', 'payment_settings']],
  ['bookings', 'การจอง', 'Bookings', ['bookings', 'packages']],
  ['people', 'ผู้ใช้/แม่บ้าน', 'People', ['profiles', 'maids']],
  ['settings', 'ตั้งค่า/ราคา', 'Settings', ['settings', 'service_types', 'service_addons', 'promo_codes', 'cancellation_rules', 'package_plans', 'districts', 'provinces', 'public_page_content']],
  ['login', 'แอดมินเข้าระบบ', 'Admin sign-ins', ['auth']],
]
const ROLES: Record<string, [string, string, string]> = {
  admin: ['แอดมิน', 'Admin', 'p-sun'], customer: ['ลูกค้า', 'Customer', 'p-leaf'], maid: ['แม่บ้าน', 'Helper', 'p-leaf'], system: ['ระบบ', 'System', 'p-grey'], unknown: ['ไม่ทราบ', 'Unknown', 'p-grey'],
}
const PAGE = 50

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
const show = (v: unknown, lang: 'th' | 'en' = 'th') => v === null || v === undefined ? '—'
  : typeof v === 'string' && ISO.test(v) ? fmtDate(v, lang, { day: 'numeric', month: 'short' }) + ' ' + fmtTime(v)
  : typeof v === 'object' ? JSON.stringify(v) : String(v)

// บันทึกการเปลี่ยนแปลงหลังบ้าน: ใครทำ เมื่อไหร่ ค่าก่อน/หลัง
export function AdminAuditLog() {
  const { lang } = useI18n(); const { profile, ready } = useAuth(); const th = lang === 'th'
  const [filter, setFilter] = useState('all'); const [who, setWho] = useState('all'); const [q, setQ] = useState('')
  const [rows, setRows] = useState<Entry[] | null>(null); const [more, setMore] = useState(false); const [open, setOpen] = useState<number | null>(null)

  const load = useCallback(async (append: Entry[] = []) => {
    let req = sb.from('audit_log').select('*').order('id', { ascending: false }).limit(PAGE)
    const tables = FILTERS.find(f => f[0] === filter)?.[3]
    if (tables) req = req.in('table_name', tables)
    if (who !== 'all') req = req.eq('actor_role', who)
    const id = q.replace(/[^\d]/g, '')
    if (id) req = req.eq('row_id', id)
    if (append.length) req = req.lt('id', append[append.length - 1].id)
    const { data } = await req
    const list = (data as Entry[]) || []
    setRows([...append, ...list]); setMore(list.length === PAGE)
  }, [filter, who, q])
  useEffect(() => { load() }, [load])

  if (ready && profile?.role !== 'admin') return <Navigate to="/" />

  const verb = (e: Entry) => e.action === 'login' ? (th ? 'เข้าสู่ระบบ' : 'Signed in') : e.action === 'insert' ? (th ? 'สร้าง' : 'Created') : e.action === 'delete' ? (th ? 'ลบ' : 'Deleted') : (th ? 'แก้ไข' : 'Changed')
  return <div className="page audit-page"><TopBar title={th ? 'บันทึกการทำงาน (Log)' : 'Activity log'} back="/admin/settings" />
    <div className="pad mt16 stack">
      <p className="admin-hint">{th ? 'บันทึกทุกการเปลี่ยนแปลงข้อมูลสำคัญ: ใครทำ, เวลา, ค่าก่อน → หลัง · เก็บ 1 ปี และแก้ไขหรือลบไม่ได้' : 'Every important change: who, when, before → after. Kept for 1 year and cannot be edited.'}</p>
      <div className="chips">{FILTERS.map(([k, a, b]) => <button key={k} className={'chip' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{th ? a : b}</button>)}</div>
      <div className="row audit-tools">
        <select className="input" value={who} onChange={e => setWho(e.target.value)} aria-label={th ? 'ผู้ทำ' : 'Who'}>
          <option value="all">{th ? 'ทุกคน' : 'Everyone'}</option>{['admin', 'customer', 'maid', 'system'].map(r => <option key={r} value={r}>{ROLES[r][th ? 0 : 1]}</option>)}
        </select>
        <input className="input" inputMode="numeric" value={q} onChange={e => setQ(e.target.value)} placeholder={th ? 'ค้นด้วยเลขที่ เช่น 12' : 'Search by number, e.g. 12'} />
      </div>
      {!rows ? <Loading /> : rows.length === 0 ? <div className="admin-empty">{th ? 'ยังไม่มีบันทึก' : 'Nothing logged yet'}</div> : <div className="audit-list">
        {rows.map((e, i) => {
          const dayOf = (x: Entry) => fmtDate(x.at, lang, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
          const day = dayOf(e), head = i === 0 || dayOf(rows[i - 1]) !== day
          const role = ROLES[e.actor_role || 'unknown'] || ROLES.unknown
          const keys = Object.keys(e.changes || {})
          return <div key={e.id}>{head && <div className="audit-day">{day}</div>}
            <button className={'audit-item a-' + e.action} onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
              <span className="audit-ic"><Icon n={e.action === 'login' ? 'lock' : e.action === 'delete' ? 'logout' : e.action === 'insert' ? 'plus' : 'redo'} size={15} /></span>
              <span className="audit-main">
                <span className="audit-line"><b>{e.action === 'login' ? (th ? 'แอดมินเข้าสู่ระบบ' : 'Admin signed in') : verb(e) + ' ' + (TABLES[e.table_name]?.[th ? 0 : 1] || e.table_name)}</b>{e.row_id && e.action !== 'login' && e.row_id !== 'true' && <span className="muted"> #{e.row_id}</span>}</span>
                <span className="audit-meta"><span className={'pill ' + role[2]}>{role[th ? 0 : 1]}</span>{e.actor_name && <span>{e.actor_name}</span>}<span className="muted">{fmtTime(e.at)}</span></span>
                {e.action === 'update' && open !== e.id && <span className="audit-sum">{keys.slice(0, 3).map(k => { const [a, b] = e.changes[k] as [unknown, unknown]; return <span key={k}><code>{k}</code> {show(a, lang)} → <b>{show(b, lang)}</b></span> })}{keys.length > 3 && <span className="muted">+{keys.length - 3}</span>}</span>}
              </span>
            </button>
            {open === e.id && keys.length > 0 && <div className="audit-detail">{keys.map(k => {
              const v = e.changes[k]
              return <div key={k} className="audit-kv"><code>{k}</code>{e.action === 'update' && Array.isArray(v) ? <span><s>{show(v[0], lang)}</s> → <b>{show(v[1], lang)}</b></span> : <span>{show(v, lang)}</span>}</div>
            })}</div>}
          </div>
        })}
        {more && <button className="btn b-line mt12" onClick={() => load(rows)}>{th ? 'โหลดเพิ่ม' : 'Load more'}</button>}
      </div>}
    </div><AdminTabs /></div>
}
