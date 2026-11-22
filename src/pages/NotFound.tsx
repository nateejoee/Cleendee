import { Link, useNavigate } from 'react-router-dom'
import { EmptyArt } from '../components/EmptyArt'
import { Icon, Logo, SiteFooter } from '../components/ui'
import { useI18n } from '../lib/i18n'

// หน้า 404: ลิงก์ผิดหรือหน้าที่ไม่มีแล้ว แทนการเด้งกลับหน้าแรกเงียบๆ
export function NotFound() {
  const { lang } = useI18n(); const th = lang === 'th'; const nav = useNavigate()
  return <main className="page nobar nf-page">
    <div className="nf-top"><Link to="/" aria-label="CleenDee"><Logo h={34} /></Link></div>
    <div className="nf-body">
      <EmptyArt art="search" />
      <p className="nf-code">404</p>
      <h1>{th ? 'ไม่พบหน้านี้' : 'Page not found'}</h1>
      <p className="muted">{th ? 'ลิงก์อาจพิมพ์ผิด หรือหน้านี้ถูกย้ายไปแล้ว ลองกลับหน้าแรกหรือจองแม่บ้านได้เลย' : 'The link may be mistyped or the page has moved. Head home or book a helper.'}</p>
      <div className="nf-actions">
        <Link to="/" className="btn b-ocean"><Icon n="home" size={18} />{th ? 'กลับหน้าแรก' : 'Go home'}</Link>
        <Link to="/book" className="btn b-ghost"><Icon n="broom" size={18} />{th ? 'จองแม่บ้าน' : 'Book a helper'}</Link>
      </div>
      <div className="nf-links">
        <button type="button" className="link" onClick={() => window.history.state?.idx > 0 ? nav(-1) : nav('/')}>{th ? 'ย้อนกลับ' : 'Go back'}</button>
        <Link to="/faq" className="link">{th ? 'คำถามที่พบบ่อย' : 'FAQ'}</Link>
        <Link to="/support" className="link">{th ? 'ติดต่อทีมงาน' : 'Contact us'}</Link>
      </div>
    </div>
    <SiteFooter />
  </main>
}
