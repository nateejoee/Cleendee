import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { sb, friendly } from '../lib/supabase'
import { useI18n, fmtDate } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { Icon, Loading, MaidTabs, TopBar } from '../components/ui'
import { confetti } from '../lib/fx'

// อบรมแม่บ้าน CleenDee (ไม่บังคับ): อ่านบทเรียนสั้นๆ แล้วทำแบบทดสอบ 6 ข้อ ถูก 5 ข้อขึ้นไป = ได้ป้าย "ผ่านการอบรม CleenDee"
// สำคัญ: ลำดับข้อและลำดับตัวเลือกต้องตรงกับเฉลยในฟังก์ชัน maid_submit_training (ตรวจฝั่งเซิร์ฟเวอร์)
type L = { ic: string; th: [string, string[]]; en: [string, string[]] }
const LESSONS: L[] = [
  { ic: 'clock', th: ['ตรงเวลาและเริ่มงานให้ถูกขั้นตอน', ['ออกเดินทางให้ถึงก่อนเวลานัด ถ้าจะสายให้แจ้งลูกค้าในแชททันที', 'ถึงบ้านแล้วยืนยันการมาถึงในแอป (รหัสมาถึง) และทักทายลูกค้าอย่างสุภาพ', 'ถามลูกค้าสั้นๆ ว่าอยากให้เน้นจุดไหนก่อนเริ่มงาน']],
    en: ['Be on time and start properly', ['Arrive before the start time; if you will be late, message the customer right away', 'Confirm arrival in the app (arrival code) and greet the customer politely', 'Ask which areas they want you to focus on']] },
  { ic: 'broom', th: ['ลำดับการทำความสะอาด', ['ทำจากบนลงล่าง: ปัดฝุ่นที่สูง → เช็ดโต๊ะ/ชั้น → กวาด → ถูพื้นเป็นอย่างสุดท้าย', 'ทำจากด้านในห้องออกมาทางประตู จะได้ไม่เหยียบพื้นที่ถูแล้ว', 'ใช้ผ้าแยกสำหรับห้องน้ำกับห้องครัว']],
    en: ['Cleaning order', ['Top to bottom: high dusting → wipe surfaces → sweep → mop last', 'Work from the back of the room towards the door', 'Use separate cloths for bathroom and kitchen']] },
  { ic: 'shield', th: ['ความปลอดภัยเรื่องน้ำยา', ['ห้ามผสมน้ำยาฟอกขาว (คลอรีน) กับน้ำยาล้างห้องน้ำที่เป็นกรดหรือแอมโมเนีย จะเกิดก๊าซพิษ', 'เปิดหน้าต่างระบายอากาศ และใส่ถุงมือทุกครั้ง', 'ลองน้ำยากับจุดเล็กๆ ที่มองไม่เห็นก่อน ถ้าไม่แน่ใจวัสดุ']],
    en: ['Chemical safety', ['Never mix bleach with acidic or ammonia cleaners — it makes toxic gas', 'Ventilate the room and always wear gloves', 'Test on a small hidden spot first if unsure about a surface']] },
  { ic: 'heart', th: ['เคารพบ้านและของลูกค้า', ['ไม่เปิดตู้หรือลิ้นชักส่วนตัวถ้าลูกค้าไม่ได้ขอ', 'ถ้าทำของเสียหาย แจ้งลูกค้าตามจริงทันที ถ่ายรูป และแจ้งทีมงาน', 'เก็บของกลับที่เดิมหลังทำความสะอาด']],
    en: ['Respect the home', ["Don't open private drawers or cupboards unless asked", 'If something breaks, tell the customer honestly, take a photo and tell our team', 'Put things back where they were']] },
  { ic: 'camera', th: ['ใช้แอปให้ครบ', ['ถ่ายรูปก่อนและหลังทำงานในแอป', 'ติ๊กเช็กลิสต์งานให้ครบก่อนกดจบงาน', 'คุยกับลูกค้าผ่านแชทในแอป งานที่จ่ายผ่านแอปจึงได้การรับประกันและคุ้มครองทั้งสองฝ่าย']],
    en: ['Use the app fully', ['Take before and after photos in the app', 'Tick the checklist before finishing', 'Chat in the app — only jobs paid through the app are guaranteed and protect both sides']] },
]
type Q = { th: [string, string[]]; en: [string, string[]] }
const QUIZ: Q[] = [
  { th: ['ถึงบ้านลูกค้าแล้ว ต้องทำอะไรก่อนเริ่มงาน', ['เริ่มทำความสะอาดทันที', 'ยืนยันการมาถึงในแอป และทักทายลูกค้า', 'โทรหาทีมงาน']],
    en: ['You arrive at the home. What first?', ['Start cleaning straight away', 'Confirm arrival in the app and greet the customer', 'Call our team']] },
  { th: ['ลำดับการทำความสะอาดที่ถูกต้องคือข้อใด', ['จากบนลงล่าง: ปัดฝุ่นที่สูง → เช็ด → กวาด → ถู', 'ถูพื้นก่อน แล้วค่อยปัดฝุ่นที่สูง', 'ทำตรงไหนก่อนก็ได้']],
    en: ['Which cleaning order is right?', ['Top to bottom: dust high → wipe → sweep → mop', 'Mop first, then dust high places', 'Any order is fine']] },
  { th: ['น้ำยาคู่ใดห้ามผสมกันเด็ดขาด', ['น้ำเปล่ากับสบู่', 'น้ำยาฟอกขาว (คลอรีน) กับน้ำยาที่เป็นกรด/แอมโมเนีย', 'น้ำยาเช็ดกระจกกับน้ำเปล่า']],
    en: ['Which must never be mixed?', ['Water and soap', 'Bleach with acidic/ammonia cleaners', 'Glass cleaner and water']] },
  { th: ['ทำของลูกค้าเสียหายระหว่างทำงาน ควรทำอย่างไร', ['เก็บซ่อนไว้', 'รอให้ลูกค้าเห็นเอง', 'แจ้งลูกค้าตามจริงทันที ถ่ายรูป และแจ้งทีมงาน']],
    en: ['You damage something. What do you do?', ['Hide it', 'Wait for the customer to notice', 'Tell the customer honestly, take a photo and tell our team']] },
  { th: ['ก่อนและหลังทำงาน ควรทำอะไรในแอป', ['ถ่ายรูปก่อน-หลัง และติ๊กเช็กลิสต์ให้ครบ', 'ไม่ต้องทำอะไร', 'ส่งรูปให้ลูกค้าทาง LINE ส่วนตัว']],
    en: ['What should you do in the app before and after?', ['Take before/after photos and tick the checklist', 'Nothing', 'Send photos to the customer on personal LINE']] },
  { th: ['ลูกค้าชวนจ่ายเงินกันเองนอกแอปเพื่อลดราคา ควรทำอย่างไร', ['ตกลงเลย', 'ขอเบอร์ไว้ก่อน', 'ปฏิเสธอย่างสุภาพ เพราะงานผ่านแอปมีการรับประกันและคุ้มครองทั้งสองฝ่าย']],
    en: ['A customer offers to pay you outside the app for a discount', ['Agree', 'Take their number for later', 'Politely decline — app jobs are guaranteed and protect both sides']] },
]

export function MaidTraining() {
  const { lang } = useI18n(); const th = lang === 'th'; const { session } = useAuth()
  const [trained, setTrained] = useState<string | null | undefined>(undefined)
  const [step, setStep] = useState<'learn' | 'quiz'>('learn')
  const [ans, setAns] = useState<(number | null)[]>(QUIZ.map(() => null))
  const [res, setRes] = useState<{ score: number; total: number; passed: boolean } | null>(null)
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  useEffect(() => { if (session) sb.from('maids').select('trained_at').eq('id', session.user.id).maybeSingle().then(({ data }) => setTrained(data?.trained_at ?? null)) }, [session])
  if (trained === undefined) return <Loading />
  const submit = async () => {
    setBusy(true); setErr('')
    const { data, error } = await sb.rpc('maid_submit_training', { p_answers: ans })
    setBusy(false)
    if (error) { setErr(friendly(error, lang)); return }
    setRes(data); if (data?.passed) { confetti(); setTrained(new Date().toISOString()) }
  }
  return <div className="page tr-page">
    <TopBar title={th ? 'อบรมแม่บ้าน CleenDee' : 'CleenDee training'} back="/maid" />
    <div className="pad mt16 stack">
      <div className={'card tr-hero' + (trained ? ' done' : '')}>
        <span className="tr-badge"><Icon n="star" size={26} /></span>
        <div><b>{trained ? (th ? 'คุณผ่านการอบรม CleenDee แล้ว' : "You're CleenDee trained") : (th ? 'รับป้าย "ผ่านการอบรม CleenDee"' : 'Earn the "CleenDee trained" badge')}</b>
          <p className="small muted">{trained ? (th ? `ป้ายแสดงบนการ์ดและโปรไฟล์ของคุณแล้ว · ผ่านเมื่อ ${fmtDate(trained, lang, { day: 'numeric', month: 'long', year: 'numeric' })}` : `The badge now shows on your card and profile · passed ${fmtDate(trained, lang)}`)
            : (th ? 'อ่าน 5 บทเรียนสั้นๆ แล้วตอบคำถาม 6 ข้อ ถูก 5 ข้อขึ้นไปได้ป้ายทันที ลูกค้าจะเห็นป้ายนี้บนการ์ดของคุณ' : 'Read 5 short lessons and answer 6 questions. Get 5 right to earn the badge customers see on your card.')}</p></div>
      </div>

      {step === 'learn' && <>
        {LESSONS.map((l, i) => { const [h, items] = th ? l.th : l.en
          return <section key={i} className="card tr-lesson"><div className="tr-lh"><span className="tr-num">{i + 1}</span><Icon n={l.ic} size={18} /><b>{h}</b></div>
            <ul>{items.map(x => <li key={x}>{x}</li>)}</ul></section> })}
        {!trained && <button className="btn b-sun" onClick={() => { setStep('quiz'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>{th ? 'อ่านครบแล้ว เริ่มทำแบบทดสอบ' : 'Start the quiz'} <Icon n="next" size={18} /></button>}
        {trained && <Link to="/maid" className="btn b-ocean">{th ? 'กลับหน้างาน' : 'Back to jobs'}</Link>}
      </>}

      {step === 'quiz' && <>
        {QUIZ.map((q, i) => { const [h, opts] = th ? q.th : q.en
          return <section key={i} className="card tr-q"><b>{i + 1}. {h}</b>
            <div className="tr-opts" role="radiogroup" aria-label={h}>{opts.map((o, j) => <button key={j} type="button" role="radio" aria-checked={ans[i] === j}
              className={'tr-opt' + (ans[i] === j ? ' on' : '')} disabled={!!res?.passed} onClick={() => { setRes(null); setAns(ans.map((x, k) => k === i ? j : x)) }}>{o}</button>)}</div></section> })}
        {res && <div className={'card tr-res' + (res.passed ? ' ok' : '')} role="status">
          <b>{res.passed ? (th ? `ผ่านแล้ว! ถูก ${res.score}/${res.total} ข้อ` : `Passed! ${res.score}/${res.total} correct`) : (th ? `ถูก ${res.score}/${res.total} ข้อ ต้องถูก 5 ข้อขึ้นไป` : `${res.score}/${res.total} correct — you need 5`)}</b>
          <p className="small muted">{res.passed ? (th ? 'ป้าย "ผ่านการอบรม CleenDee" แสดงบนการ์ดของคุณแล้ว' : 'Your badge is now live.') : (th ? 'ทบทวนบทเรียนแล้วลองใหม่ได้ไม่จำกัด' : 'Review the lessons and try again — no limit.')}</p></div>}
        {err && <div className="err">{err}</div>}
        {res?.passed ? <Link to="/maid" className="btn b-ocean">{th ? 'กลับหน้างาน' : 'Back to jobs'}</Link> : <div className="row">
          <button className="btn b-ghost" style={{ flex: 1 }} onClick={() => setStep('learn')}>{th ? 'ทบทวนบทเรียน' : 'Lessons'}</button>
          <button className="btn b-sun" style={{ flex: 2 }} disabled={busy || ans.some(x => x === null)} onClick={submit}>{busy ? '…' : th ? 'ส่งคำตอบ' : 'Submit'}</button></div>}
      </>}
    </div>
    <MaidTabs />
  </div>
}

// การ์ดชวนอบรมในหน้างานของแม่บ้าน (ซ่อนเมื่อผ่านแล้ว)
export function TrainingInvite() {
  const { lang } = useI18n(); const th = lang === 'th'; const { session } = useAuth()
  const [show, setShow] = useState(false)
  useEffect(() => { if (session) sb.from('maids').select('trained_at,status').eq('id', session.user.id).maybeSingle().then(({ data }) => setShow(!!data && !data.trained_at)) }, [session])
  if (!show) return null
  return <Link to="/maid/training" className="card tr-invite">
    <span className="tr-badge sm"><Icon n="star" size={20} /></span>
    <span style={{ flex: 1 }}><b>{th ? 'อบรม CleenDee 5 นาที รับป้ายบนการ์ด' : '5-minute CleenDee training'}</b>
      <span className="small muted" style={{ display: 'block' }}>{th ? 'ลูกค้าเห็นป้าย "ผ่านการอบรม" ช่วยให้ได้งานง่ายขึ้น' : 'Customers see the badge on your card'}</span></span>
    <Icon n="next" size={18} />
  </Link>
}
