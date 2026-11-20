import { useI18n } from '../lib/i18n'
import { TopBar } from '../components/ui'

// หน้านโยบายความเป็นส่วนตัว (ใช้เป็นลิงก์ใน Google / LINE Login) — เขียนตามข้อมูลที่แอปเก็บจริงในฐานข้อมูล
const TEXT: Record<'th' | 'en', { title: string; updated: string; sections: [string, string][] }> = {
  th: {
    title: 'นโยบายความเป็นส่วนตัว',
    updated: 'ปรับปรุงล่าสุด 20 พฤศจิกายน 2569',
    sections: [
      ['ผู้ให้บริการ', 'CleenDee (คลีนดี) บริการจ้างแม่บ้านทำความสะอาดในจังหวัดชุมพร ติดต่อ โทร. 093-651-9324, 082-939-0077'],
      ['ข้อมูลที่เราเก็บ', 'ชื่อ อีเมล และรูปโปรไฟล์จาก Google หรือ LINE เมื่อคุณเข้าสู่ระบบ, เบอร์โทร, ที่อยู่และตำแหน่งบนแผนที่สำหรับเข้าทำงาน, ข้อมูลการจอง การชำระเงินและสลิปโอนเงิน, ข้อความที่คุยกับแม่บ้าน, รีวิว, และรูปถ่ายที่แนบตอนแจ้งเคลมความเสียหาย สำหรับแม่บ้าน เราเก็บข้อมูลการยืนยันตัวตน ตารางวันว่าง ตำแหน่งระหว่างเดินทางไปงาน และบัญชีธนาคารสำหรับโอนค่าจ้าง'],
      ['เราใช้ข้อมูลเพื่อ', 'ยืนยันตัวตนเมื่อเข้าสู่ระบบ, จัดหาแม่บ้านและนัดหมายงาน, ตรวจสอบการชำระเงินและคืนเงิน, ติดต่อเรื่องงานที่จอง, พิจารณาเคลมความเสียหาย และดูแลความปลอดภัยของลูกค้าและแม่บ้าน'],
      ['การเปิดเผยข้อมูล', 'แม่บ้านที่รับงานจะเห็นชื่อ ที่อยู่ และรายละเอียดงานที่จำเป็นต่อการเข้าทำงานเท่านั้น เราไม่ขายข้อมูลของคุณ เมื่อคุณกดอ่าน GPS เพื่อเติมที่อยู่ เบราว์เซอร์จะส่งพิกัดให้ Photon เพื่อค้นที่อยู่ และโหลดแผนที่จาก OpenStreetMap ข้อมูลถูกเก็บบนบริการคลาวด์ (Supabase) ที่เราใช้ดำเนินงาน'],
      ['สิทธิ์ของคุณ', 'คุณขอดู แก้ไข หรือลบข้อมูลของคุณ และขอยกเลิกบัญชีได้ โดยติดต่อ โทร. 093-651-9324, 082-939-0077'],
    ],
  },
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated 20 November 2026',
    sections: [
      ['Who we are', 'CleenDee is a home cleaning service in Chumphon, Thailand. Contact: +66 93 651 9324, +66 82 939 0077'],
      ['What we collect', 'Your name, email and profile picture from Google or LINE when you log in; phone number; service address and map location; bookings, payments and transfer slips; messages with your helper; reviews; and photos you attach to damage claims. For helpers we also keep identity checks, availability, location while travelling to a job, and bank account for payouts.'],
      ['How we use it', 'To log you in, match and schedule helpers, check payments and refunds, contact you about bookings, handle damage claims, and keep customers and helpers safe.'],
      ['Sharing', 'The helper who takes your job sees only the name, address and job details needed to do the work. We do not sell your data. When you tap Locate and fill address, your browser sends the pin to Photon for address lookup and loads map tiles from OpenStreetMap. Data is stored on the cloud service we use to run the app (Supabase).'],
      ['Your rights', 'You can ask to see, correct or delete your data, or close your account, by calling +66 93 651 9324, +66 82 939 0077.'],
    ],
  },
}

export function Privacy() {
  const { lang } = useI18n(); const p = TEXT[lang]
  return <div className="page nobar">
    <TopBar title={p.title} back="/" />
    <article className="privacy-sheet">
      <header><span className="privacy-brand">CleenDee</span><h1>{p.title}</h1><p className="muted">{p.updated}</p></header>
      {p.sections.map(([h,b]) => <section key={h}><h2>{h}</h2><p>{b}</p></section>)}
      <div className="chips"><a className="btn b-line" href="tel:+66936519324">093-651-9324</a><a className="btn b-line" href="tel:+66829390077">082-939-0077</a></div>
    </article>
  </div>
}
