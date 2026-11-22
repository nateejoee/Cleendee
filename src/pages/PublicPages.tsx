import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon, LangToggle, Loading, Logo } from '../components/ui'
import { fmtDate, money, useI18n } from '../lib/i18n'
import { defaultPhones, defaultPolicyCopy, formatPolicyPhones, policyImageUrl, policyPhoneHref, readPolicy, renderPolicyText, resolvePolicyCopy, type PolicyKey, type PolicyRecord } from '../lib/publicPages'
import { sb } from '../lib/supabase'
import guaranteeImage from '../assets/ill/safety.webp'
import privacyImage from '../assets/ill/chumphon.webp'
import faqImage from '../assets/ill/faq.webp'
import termsImage from '../assets/ill/schedule.webp'
import { LINE_OA, LINE_URL, useContactPhones } from '../lib/contact'
import { openProvinceNames, useProvinces } from '../lib/areas'
import './PublicPages.css'

const originals = { guarantee: guaranteeImage, privacy: privacyImage }
type GuaranteeSettings = { claim_cap: number; claim_report_days: number; reschedule_min_hours: number }

function PublicPolicy({ page }: { page: PolicyKey }) {
  const { lang, t } = useI18n()
  const navigate = useNavigate()
  const th = lang === 'th'
  const guarantee = page === 'guarantee'
  const [record, setRecord] = useState<PolicyRecord | null>(null)
  const [settings, setSettings] = useState<GuaranteeSettings | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [brokenImage, setBrokenImage] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    readPolicy(page).then(({ data }) => { if (active) setRecord(data) })
    if (guarantee) {
      sb.from('settings').select('claim_cap,claim_report_days,reschedule_min_hours').maybeSingle<GuaranteeSettings>().then(({ data, error }) => {
        if (!active) return
        setSettings(data)
        setFailed(Boolean(error || !data))
      })
    }
    return () => { active = false }
  }, [page, guarantee, attempt])

  const defaults = defaultPolicyCopy(page, lang)
  const copy = resolvePolicyCopy(lang === 'th' ? record?.content_th : record?.content_en, defaults)
  const path = record?.image_path
  const customImage = path && brokenImage !== path ? policyImageUrl(path) : null
  const phones = record?.contact_phones.length ? record.contact_phones : defaultPhones
  const variables: Record<string, string> = guarantee
    ? { cap: settings ? money(settings.claim_cap) : '…', days: settings ? String(settings.claim_report_days) : '…', h: settings ? String(settings.reschedule_min_hours) : '…' }
    : { phones: formatPolicyPhones(phones, lang) }
  const replace = (value: string) => renderPolicyText(value, variables)
  const published = record?.published_on || (guarantee ? null : '2026-11-20')
  const dateText = published ? fmtDate(published + 'T12:00:00+07:00', lang, { day: 'numeric', month: 'long', year: 'numeric' }) : null

  return <main className="page public-policy">
    <header className="policy-top">
      <button type="button" className="policy-back" aria-label={t('booking_back')} onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate('/')}>
        <Icon n="back" size={18} />
      </button>
      <Link to="/" className="policy-brand"><Logo h={33} /><Logo white h={33} /></Link>
      <LangToggle />
    </header>
    <header className="policy-hero">
      <div className="policy-hero-text">
        <h1>{copy.title}</h1>
        <p>{replace(copy.intro)}</p>
        {published && <time dateTime={published}>{th ? 'ปรับปรุงล่าสุด' : 'Last updated'} {dateText}</time>}
      </div>
      <div className="policy-cover">
        <img className={'policy-cover-image policy-cover-' + page} src={customImage || originals[page]}
          alt={path && brokenImage === path ? defaults.imageAlt : copy.imageAlt}
          onError={customImage && path ? () => setBrokenImage(path) : undefined} fetchPriority="high" />
      </div>
    </header>
    <article className="policy-document" aria-label={copy.title}>
      {guarantee && failed ? <div className="stack" role="status">
        <p>{th ? 'โหลดเงื่อนไขการันตีไม่สำเร็จ' : 'The guarantee terms could not be loaded.'}</p>
        <button className="btn b-line" type="button" onClick={() => { setFailed(false); setAttempt(n => n + 1) }}>{th ? 'ลองอีกครั้ง' : 'Try again'}</button>
      </div> : guarantee && !settings ? <Loading /> :
        <ol className="policy-clauses" role="list">
          {copy.sections.map((section, index) => (
            <li className="policy-clause" id={'policy-section-' + index} key={index}>
              <h2 className="policy-clause-heading">
                <span aria-hidden="true" className="policy-clause-number">{String(index + 1).padStart(2, '0')}</span>
                <span>{section.title}</span>
              </h2>
              <div className="policy-clause-body">
                {replace(section.body).split(/\n[ \t]*\n+/).map((paragraph, line) => <p key={line}>{paragraph}</p>)}
              </div>
            </li>
          ))}
        </ol>}
      {copy.note && <aside className="policy-note">
        <Icon n="shield" size={19} />
        <div><h2>{th ? 'หมายเหตุ' : 'Note'}</h2><p>{replace(copy.note)}</p></div>
      </aside>}
      {!guarantee && <footer className="policy-contact">
        <h2>{th ? 'ติดต่อ CleenDee' : 'Contact CleenDee'}</h2>
        <div>{phones.map(phone => <a className="btn b-line" key={phone} href={policyPhoneHref(phone)}>{formatPolicyPhones([phone], lang)}</a>)}</div>
      </footer>}
    </article>
  </main>
}

export function Guarantee() { return <PublicPolicy page="guarantee" /> }
export function Privacy() { return <PublicPolicy page="privacy" /> }

// ---------- หน้าคำถามที่พบบ่อย (FAQ) ----------
// ตัวเลขทุกตัว (ค่าเลือกแม่บ้าน ค่าด่วน วงเงินชดเชย แต้ม ฯลฯ) อ่านจากตาราง settings ให้ตรงกับระบบเสมอ
type FaqSettings = { choose_maid_fee: number; urgent_fee: number; urgent_min_lead_minutes: number; claim_cap: number; claim_report_days: number; reschedule_min_hours: number; baht_per_point: number; redeem_points: number; redeem_value: number; first_booking_discount: number }
const FAQ_COLS = 'choose_maid_fee,urgent_fee,urgent_min_lead_minutes,claim_cap,claim_report_days,reschedule_min_hours,baht_per_point,redeem_points,redeem_value,first_booking_discount'

export function Faq() {
  const { lang, t } = useI18n()
  const th = lang === 'th'
  const navigate = useNavigate()
  const phones = useContactPhones()
  const area = openProvinceNames(useProvinces(), lang)
  const [v, setV] = useState<FaqSettings | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    sb.from('settings').select(FAQ_COLS).maybeSingle<FaqSettings>().then(({ data, error }) => { setV(data); setFailed(Boolean(error || !data)) })
  }, [])
  const m = (n: number) => money(n)
  const groups: { title: string; items: [string, string][] }[] = v ? [
    { title: th ? 'การจองและราคา' : 'Booking and prices', items: [
      [th ? 'จองแม่บ้านอย่างไร' : 'How do I book?', th ? 'เลือกบริการ วันและเวลาเริ่ม จำนวนชั่วโมง และที่อยู่ จากนั้นเลือกแม่บ้านเองหรือให้ระบบหาให้ ตรวจสรุปแล้วกดยืนยันและไปจ่ายเงิน ใช้เวลาประมาณ 1 นาที' : 'Choose the service, start date and time, hours and address, then pick a helper or let us find one. Check the summary, confirm and pay. It takes about a minute.'],
      [th ? 'ราคาเท่าไร มีค่าใช้จ่ายแอบแฝงไหม' : 'How much does it cost? Any hidden fees?', th ? 'ระบบแสดงราคารวมทุกรายการก่อนจ่ายเสมอ ไม่มีค่าใช้จ่ายแอบแฝง ราคาเริ่มต้นของแต่ละบริการดูได้ที่หน้าบริการ' : 'You always see the full total before paying, with no hidden fees. Starting prices for each service are on the services page.'],
      [th ? 'เลือกแม่บ้านเองได้ไหม' : 'Can I choose my helper?', th ? `ได้ ค่าเลือกแม่บ้านเอง ${m(v.choose_maid_fee)} บาท หรือให้ระบบหาแม่บ้านที่ว่างให้โดยไม่มีค่าใช้จ่ายเพิ่ม ถ้าแม่บ้านที่เลือกไม่รับงาน ระบบคืนค่าเลือกให้` : `Yes, for ${m(v.choose_maid_fee)} THB, or let us find an available helper at no extra cost. If your chosen helper declines, the fee is refunded.`],
      [th ? 'จองครั้งแรกมีส่วนลดไหม' : 'Is there a first-booking discount?', th ? `มี จองครั้งแรกลด ${m(v.first_booking_discount)} บาท ระบบหักให้อัตโนมัติในหน้ายืนยันการจอง` : `Yes, ${m(v.first_booking_discount)} THB off your first booking, applied automatically on the confirmation page.`],
      [th ? 'ต้องการแม่บ้านด่วนได้ไหม' : 'Can I book urgently?', th ? `ได้ เริ่มงานได้เร็วสุดใน ${v.urgent_min_lead_minutes} นาที มีค่าเรียกด่วน ${m(v.urgent_fee)} บาท ระบบแจ้งก่อนจ่ายทุกครั้ง` : `Yes, starting in as little as ${v.urgent_min_lead_minutes} minutes, with an urgent fee of ${m(v.urgent_fee)} THB shown before you pay.`],
      [th ? 'มีแพ็กเกจรายเดือนไหม' : 'Is there a monthly plan?', t('pkg_note')],
    ] },
    { title: th ? 'การชำระเงิน' : 'Payment', items: [
      [th ? 'จ่ายเงินช่องทางไหน' : 'How do I pay?', th ? 'สแกน QR พร้อมเพย์ในหน้าชำระเงิน แล้วแนบรูปสลิป ระบบตรวจสลิปให้อัตโนมัติ ถ้าตรวจไม่ได้ทีมงานจะตรวจให้' : 'Scan the PromptPay QR on the payment page and attach your slip. We check it automatically; if it can’t be read, our team checks it for you.'],
      [th ? 'ยกเลิกแล้วได้เงินคืนไหม' : 'Can I cancel and get a refund?', t('cancel_rules')],
      [th ? 'เลื่อนนัดได้ไหม' : 'Can I reschedule?', th ? `เลื่อนได้ฟรี ก่อนเวลางานอย่างน้อย ${v.reschedule_min_hours} ชั่วโมง โดยแม่บ้านคนเดิมต้องว่างในเวลาใหม่` : `Yes, free of charge at least ${v.reschedule_min_hours} hours before the job, as long as the same helper is free at the new time.`],
    ] },
    { title: th ? 'ความปลอดภัยและการรับประกัน' : 'Safety and guarantee', items: [
      [th ? 'แม่บ้านไว้ใจได้ไหม' : 'Can I trust the helpers?', th ? 'แม่บ้านทุกคนเป็นคนในพื้นที่ ยืนยันตัวตนและตรวจประวัติอาชญากรรมก่อนรับงาน และลูกค้าให้คะแนนรีวิวได้หลังจบงานทุกครั้ง' : 'Every helper is local, ID-verified and background-checked before taking jobs, and you can rate them after every job.'],
      [th ? 'ถ้าแม่บ้านไม่มาทำอย่างไร' : 'What if the helper doesn’t show up?', th ? 'เราหาแม่บ้านคนแทนให้ หรือคืนเงินเต็มจำนวน' : 'We find a replacement or refund you in full.'],
      [th ? 'ถ้าของเสียหายระหว่างทำงาน' : 'What if something gets damaged?', th ? `แจ้งเคลมในแอปภายใน ${v.claim_report_days} วันหลังจบงาน พร้อมรูปถ่าย CleenDee ชดเชยสูงสุด ${m(v.claim_cap)} บาทต่องาน ดูเงื่อนไขทั้งหมดได้ที่หน้าการรับประกัน` : `File a claim in the app within ${v.claim_report_days} days after the job, with photos. CleenDee covers up to ${m(v.claim_cap)} THB per job. See the guarantee page for full terms.`],
    ] },
    { title: th ? 'แต้มสะสมและอื่น ๆ' : 'Points and more', items: [
      [th ? 'สะสมแต้มอย่างไร' : 'How do points work?', th ? `ทุก ${m(v.baht_per_point)} บาทที่จ่าย ได้ 1 แต้ม (สมาชิกระดับสูงได้แต้มมากขึ้น) ใช้ ${v.redeem_points} แต้มแลกส่วนลด ${m(v.redeem_value)} บาทในหน้ายืนยันการจอง` : `Earn 1 point for every ${m(v.baht_per_point)} THB (higher tiers earn more). Redeem ${v.redeem_points} points for ${m(v.redeem_value)} THB off on the confirmation page.`],
      [th ? 'ให้บริการพื้นที่ไหนบ้าง' : 'Where do you operate?', area ? (th ? `ตอนนี้ให้บริการใน${area} ระบบจะแสดงเฉพาะพื้นที่ที่จองได้ตอนเลือกที่อยู่` : `We currently serve ${area}. Only bookable areas appear when you choose your address.`) : (th ? 'ระบบจะแสดงพื้นที่ที่จองได้ตอนเลือกที่อยู่' : 'Bookable areas appear when you choose your address.')],
      [th ? 'อยากสมัครเป็นแม่บ้านทำอย่างไร' : 'How can I work as a helper?', th ? 'กดสมัครเป็นแม่บ้านจากเมนูบัญชี กรอกข้อมูลและส่งเอกสาร ทีมงานจะตรวจสอบและติดต่อกลับ' : 'Tap “Become a helper” in your account menu, fill in the form and documents, and our team will review and contact you.'],
    ] },
  ] : []

  return <main className="page public-policy faq-page">
    <header className="policy-top">
      <button type="button" className="policy-back" aria-label={t('booking_back')} onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate('/')}>
        <Icon n="back" size={18} />
      </button>
      <Link to="/" className="policy-brand"><Logo h={33} /><Logo white h={33} /></Link>
      <LangToggle />
    </header>
    <header className="policy-hero">
      <div className="policy-hero-text">
        <h1>{th ? 'คำถามที่พบบ่อย' : 'Frequently asked questions'}</h1>
        <p>{th ? 'รวมคำตอบเรื่องการจอง ราคา การชำระเงิน และการรับประกัน ถ้ายังไม่พบคำตอบ ทักทีมงานได้ทาง LINE หรือโทรหาเรา' : 'Answers about booking, prices, payment and our guarantee. Can’t find yours? Message us on LINE or give us a call.'}</p>
      </div>
      <div className="policy-cover"><img className="policy-cover-image policy-cover-faq" src={faqImage} alt={th ? 'แม่บ้าน CleenDee อธิบายรายละเอียดงานให้เจ้าของบ้าน' : 'A CleenDee helper explaining the job to a homeowner'} fetchPriority="high" /></div>
    </header>
    <article className="policy-document" aria-label={th ? 'คำถามที่พบบ่อย' : 'FAQ'}>
      {failed ? <div className="stack" role="status"><p>{th ? 'โหลดคำตอบไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง' : 'Could not load the answers. Please refresh.'}</p></div>
        : !v ? <Loading /> : groups.map(g => <section className="faq-group" key={g.title}>
          <h2>{g.title}</h2>
          {g.items.map(([q, a]) => <details className="faq-item" key={q}>
            <summary><span>{q}</span><Icon n="plus" size={18} /></summary>
            <p>{a}</p>
          </details>)}
        </section>)}
      <footer className="policy-contact faq-contact">
        <h2>{th ? 'ยังมีคำถาม? ติดต่อทีมงาน' : 'Still have questions? Contact us'}</h2>
        <div>
          <a className="btn faq-line" href={LINE_URL} target="_blank" rel="noopener noreferrer"><Icon n="chat" size={18} />LINE {LINE_OA}</a>
          {phones.map(phone => <a className="btn faq-tel" key={phone} href={policyPhoneHref(phone)}><Icon n="phone" size={18} />{formatPolicyPhones([phone], lang)}</a>)}
        </div>
      </footer>
    </article>
  </main>
}

// ---------- หน้าข้อกำหนดการใช้บริการ ----------
// เนื้อหาเขียนตามกติกาที่ระบบใช้จริง: ตัวเลข (ค่าเลือกแม่บ้าน ค่าด่วน เลื่อนนัด เคลม) อ่านจาก settings ชุดเดียวกับหน้า FAQ
// กติกายกเลิก/คืนเงินตรงกับฟังก์ชัน _customer_cancel_row และตาราง cancellation_rules (24 ชม. คืนเต็ม · 6–24 ชม. คืนครึ่ง · <6 ชม. ไม่คืน)
const TERMS_UPDATED = '2026-11-23'
export function Terms() {
  const { lang, t } = useI18n()
  const th = lang === 'th'
  const navigate = useNavigate()
  const phones = useContactPhones()
  const area = openProvinceNames(useProvinces(), lang)
  const [v, setV] = useState<FaqSettings | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    sb.from('settings').select(FAQ_COLS).maybeSingle<FaqSettings>().then(({ data, error }) => { setV(data); setFailed(Boolean(error || !data)) })
  }, [])
  const m = (n: number) => money(n)
  const sections: { h: string; p: (string | false)[] }[] = v ? [
    { h: th ? '1. เกี่ยวกับบริการ' : '1. About the service', p: [
      th ? `CleenDee คลีนดี เป็นบริการจองแม่บ้านทำความสะอาดออนไลน์ โดยแม่บ้านคนในพื้นที่ที่ผ่านการยืนยันตัวตนและตรวจประวัติแล้ว${area ? ` ปัจจุบันให้บริการใน ${area}` : ''}`
        : `CleenDee is an online booking service for local, ID-verified and background-checked home cleaners.${area ? ` We currently serve ${area}.` : ''}`,
      th ? 'เมื่อใช้งานเว็บไซต์หรือจองบริการ ถือว่าคุณได้อ่านและยอมรับข้อกำหนดนี้แล้ว' : 'By using the website or booking a service, you agree to these terms.',
    ] },
    { h: th ? '2. บัญชีผู้ใช้' : '2. Your account', p: [
      th ? 'เข้าสู่ระบบด้วย Google หรือ LINE ครั้งแรกระบบจะสร้างบัญชีให้อัตโนมัติ เราไม่เห็นและไม่เก็บรหัสผ่านของคุณ' : 'Log in with Google or LINE. Your account is created automatically the first time; we never see or store your password.',
      th ? 'ต้องใส่เบอร์โทรที่ติดต่อได้จริงก่อนจอง และกรอกที่อยู่และหมุดตำแหน่งให้ถูกต้อง เพื่อให้แม่บ้านเดินทางไปถึง' : 'A reachable phone number is required before booking, and your address and map pin must be accurate so the helper can find you.',
    ] },
    { h: th ? '3. การจองและราคา' : '3. Booking and prices', p: [
      th ? 'ระบบแสดงราคารวมทุกรายการก่อนจ่ายเสมอ ไม่มีค่าใช้จ่ายแอบแฝง' : 'You always see the full total before paying, with no hidden fees.',
      th ? `เลือกแม่บ้านเองมีค่าบริการ ${m(v.choose_maid_fee)} บาท หรือให้ระบบหาแม่บ้านที่ว่างให้โดยไม่มีค่าใช้จ่ายเพิ่ม ถ้าแม่บ้านที่เลือกไม่รับงาน ระบบคืนค่าเลือกให้` : `Choosing your helper costs ${m(v.choose_maid_fee)} THB, or we find one at no extra cost. If your chosen helper declines, this fee is refunded.`,
      th ? `งานด่วน (เริ่มเร็วสุดใน ${v.urgent_min_lead_minutes} นาที) มีค่าเรียกด่วน ${m(v.urgent_fee)} บาท ระบบแจ้งก่อนจ่ายทุกครั้ง` : `Urgent jobs (from ${v.urgent_min_lead_minutes} minutes ahead) carry a ${m(v.urgent_fee)} THB urgent fee, shown before you pay.`,
    ] },
    { h: th ? '4. การชำระเงิน' : '4. Payment', p: [
      th ? 'ชำระด้วยการสแกน QR พร้อมเพย์และแนบสลิปในหน้าชำระเงิน การจองจะยืนยันเมื่อตรวจสลิปผ่านแล้ว ถ้าตรวจอัตโนมัติไม่ได้ ทีมงานจะตรวจให้' : 'Pay by PromptPay QR and upload your slip. The booking is confirmed once the slip is verified; if automatic checking fails, our team checks it.',
    ] },
    { h: th ? '5. การยกเลิกและการคืนเงิน' : '5. Cancellations and refunds', p: [
      th ? 'ยกเลิกก่อนชำระเงิน หรือระหว่างรอตรวจสลิป: ยกเลิกได้ฟรี' : 'Before paying or while your slip is being checked: free cancellation.',
      th ? 'ยกเลิกหลังชำระเงินแต่ยังไม่มีแม่บ้านรับงาน: คืนเงินเต็มจำนวน' : 'After paying but before a helper accepts: full refund.',
      th ? `หลังมีแม่บ้านรับงานแล้ว: ${t('cancel_rules')} (นับจากเวลาเริ่มงาน)` : `After a helper accepts: ${t('cancel_rules')} (counted from the start time).`,
      th ? 'กรณีได้เงินคืนเต็มจำนวน แต้มที่ใช้ไปจะคืนเข้าบัญชีด้วย ยอดคืนเงินจะแสดงในรายละเอียดการจอง และทีมงานจะดำเนินการโอนคืน' : 'With a full refund, points you used are returned too. The refund amount appears in the booking details and our team processes the transfer.',
    ] },
    { h: th ? '6. การเลื่อนนัด' : '6. Rescheduling', p: [
      th ? `เลื่อนได้ฟรี ก่อนเวลางานอย่างน้อย ${v.reschedule_min_hours} ชั่วโมง โดยแม่บ้านคนเดิมต้องว่างในเวลาใหม่` : `Free of charge at least ${v.reschedule_min_hours} hours before the job, if the same helper is free at the new time.`,
    ] },
    { h: th ? '7. ถ้าแม่บ้านไม่มา' : '7. If the helper does not show up', p: [
      th ? 'เราหาแม่บ้านคนแทนให้ หรือคืนเงินเต็มจำนวน' : 'We find a replacement or refund you in full.',
    ] },
    { h: th ? '8. ความเสียหายและการรับประกันงาน' : '8. Damage and work guarantee', p: [
      th ? `ถ้าของเสียหายระหว่างทำงาน แจ้งเคลมในแอปภายใน ${v.claim_report_days} วันหลังจบงาน พร้อมรูปถ่าย CleenDee ชดเชยสูงสุด ${m(v.claim_cap)} บาทต่องาน` : `If something is damaged during the job, file a claim in the app within ${v.claim_report_days} days with photos. CleenDee covers up to ${m(v.claim_cap)} THB per job.`,
      th ? 'รายละเอียดการรับประกันงานทั้งหมดอยู่ที่หน้า "การรับประกันงาน"' : 'Full details are on the Guarantee page.',
    ] },
    { h: th ? '9. ความเป็นส่วนตัว' : '9. Privacy', p: [
      th ? 'การเก็บและใช้ข้อมูลส่วนบุคคลเป็นไปตามนโยบายความเป็นส่วนตัว' : 'Personal data is handled as described in our Privacy Policy.',
    ] },
    { h: th ? '10. การแก้ไขข้อกำหนด' : '10. Changes to these terms', p: [
      th ? 'เราอาจปรับปรุงข้อกำหนดนี้เป็นครั้งคราว โดยแสดงวันที่ปรับปรุงล่าสุดไว้ด้านบนของหน้านี้ การจองที่ยืนยันแล้วใช้เงื่อนไข ณ วันที่จอง' : 'We may update these terms from time to time; the last-updated date is shown at the top. Confirmed bookings follow the terms in effect when booked.',
    ] },
  ] : []
  const links: Record<string, [string, string]> = { 8: ['/guarantee', th ? 'ดูการรับประกันงาน' : 'View guarantee'], 9: ['/privacy', th ? 'อ่านนโยบายความเป็นส่วนตัว' : 'Read privacy policy'] }

  return <main className="page public-policy faq-page terms-page">
    <header className="policy-top">
      <button type="button" className="policy-back" aria-label={t('booking_back')} onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate('/')}>
        <Icon n="back" size={18} />
      </button>
      <Link to="/" className="policy-brand"><Logo h={33} /><Logo white h={33} /></Link>
      <LangToggle />
    </header>
    <header className="policy-hero">
      <div className="policy-hero-text">
        <h1>{th ? 'ข้อกำหนดการใช้บริการ' : 'Terms of service'}</h1>
        <p>{th ? 'กติกาการจอง การชำระเงิน การยกเลิก คืนเงิน และการรับประกันงาน เขียนให้อ่านง่ายและตรงกับที่ระบบใช้จริง' : 'Plain-language rules for booking, payment, cancellations, refunds and our guarantee, matching how the system actually works.'}</p>
        <p className="terms-date">{th ? 'ปรับปรุงล่าสุด ' : 'Last updated '}{fmtDate(TERMS_UPDATED + 'T12:00:00+07:00', lang, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>
      <div className="policy-cover"><img className="policy-cover-image" src={termsImage} alt={th ? 'ภาพประกอบการนัดหมายแม่บ้าน' : 'Booking illustration'} fetchPriority="high" /></div>
    </header>
    <article className="policy-document" aria-label={th ? 'ข้อกำหนดการใช้บริการ' : 'Terms of service'}>
      {failed ? <div className="stack" role="status"><p>{th ? 'โหลดข้อกำหนดไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง' : 'Could not load the terms. Please refresh.'}</p></div>
        : !v ? <Loading /> : sections.map((x, i) => <section className="terms-sec" key={x.h}>
          <h2>{x.h}</h2>
          {x.p.length > 1 ? <ul>{x.p.filter(Boolean).map(line => <li key={String(line)}>{line}</li>)}</ul> : <p>{x.p[0]}</p>}
          {links[i + 1] && <Link className="terms-link" to={links[i + 1][0]}>{links[i + 1][1]} <Icon n="next" size={14} /></Link>}
        </section>)}
      <footer className="policy-contact faq-contact">
        <h2>{th ? 'สอบถามเรื่องข้อกำหนด ติดต่อทีมงาน' : 'Questions about these terms? Contact us'}</h2>
        <div>
          <a className="btn faq-line" href={LINE_URL} target="_blank" rel="noopener noreferrer"><Icon n="chat" size={18} />LINE {LINE_OA}</a>
          {phones.map(phone => <a className="btn faq-tel" key={phone} href={policyPhoneHref(phone)}><Icon n="phone" size={18} />{formatPolicyPhones([phone], lang)}</a>)}
        </div>
      </footer>
    </article>
  </main>
}
