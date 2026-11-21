import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useI18n, money, type Key } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import type { Service as Svc } from '../lib/supabase'
import { svcName, svcUnit } from '../lib/services'
import { Avatar, Icon, Loading, CustomerTabs } from '../components/ui'
import { Empty } from '../components/EmptyArt'
import { ServiceArt } from '../components/ServiceArt'
import { ART_TINT } from '../lib/serviceTint'
import type { useMaidsLoad } from './Book'
import imgHero from '../assets/ill/hero.webp'
import imgClean from '../assets/ill/cleaning.webp'
import imgSafe from '../assets/ill/safety.webp'
import imgChat from '../assets/ill/chat.webp'
import imgHome from '../assets/ill/chumphon.webp'
import imgSched from '../assets/ill/schedule.webp'
import imgWai from '../assets/ill/login.webp'

/* หน้าแรกแบบเว็บไซต์ สำหรับจอคอม (≥1024px) เท่านั้น — Home ใน Start.tsx เรียกใช้เมื่อ useIsDesktop() เป็นจริง
   ใช้ข้อมูลและการ์ดเริ่มจอง (QuickBook) ชุดเดียวกับหน้าแรกมือถือ ไม่มีตรรกะการจองซ้ำ */

type Maids = ReturnType<typeof useMaidsLoad>['maids']
type Extra = { to: string; art: string; label: string; svc: string }

// ภาพประกอบของแต่ละบริการ (บริการที่ไม่มีภาพเฉพาะใช้ภาพวนตามลำดับ)
const SVC_IMG: Record<string, string> = { general_cleaning: imgClean }
const ROTATE = [imgChat, imgSched, imgHome, imgSafe]

export function HomeDesktop({ quickBook, services, bookable, maids, maidsFailed, extra, short, open, place, greeting }: {
  quickBook: ReactNode; services: Svc[] | null; bookable: Svc[]; maids: Maids | undefined; maidsFailed: boolean
  extra: Extra[]; short: (code: string, full: string) => string; open: (code: string, to: string) => void; place: string; greeting: string
}) {
  const { t, lang } = useI18n(); const { profile } = useAuth()
  const steps: [Key, Key][] = [['home_step_maid', 'home_step_maid_d'], ['home_step_time', 'home_step_time_d'], ['home_step_details', 'home_step_details_d'], ['home_step_payment', 'home_step_payment_d']]
  const trust: [string, Key, Key][] = [['clock', 'ben1', 'ben1d'], ['wallet', 'ben2', 'ben2d'], ['check', 'ben3', 'ben3d'], ['shield', 'ben4', 'ben4d']]
  const promises = t('g_short').split('·').map(x => x.trim()).filter(Boolean)
  const soon = (services || []).filter(s => !s.active && s.coming_soon)
  const imgs = bookable.reduce<{ list: string[]; n: number }>((a, s) => {
    const own = SVC_IMG[s.code]
    return own ? { list: [...a.list, own], n: a.n } : { list: [...a.list, ROTATE[a.n % ROTATE.length]], n: a.n + 1 }
  }, { list: [], n: 0 }).list

  return <div className="dkh">
    {/* 1) หัวหน้า: พาดหัว + การ์ดเริ่มจอง | ภาพใหญ่ */}
    <section className="dkh-hero">
      <div className="dk-container dkh-hero-in">
        <div className="dkh-hero-text">
          <span className="dkh-loc"><Icon n="pin" size={15} />{place}</span>
          <p className="dkh-greet">{greeting}</p>
          <h1>{t('tagline')}</h1>
          <p className="dkh-lead">{t('hero_d')}</p>
          <div className="dkh-qb">{quickBook}</div>
          <div className="dkh-hero-links">
            <button type="button" className="dkh-urgent" onClick={() => open('general_cleaning', '/book/time?urgent=1')}>
              <Icon n="clock" size={18} /><span><b>{t('urgent_t')}</b> {t('urgent_d')}</span>
            </button>
            {profile?.role === 'customer' && <Link to="/account" className="dkh-points"><Icon n="star" size={18} /><span>{t('my_points')} <b>{money(profile.points)}</b> {t('points')}</span></Link>}
          </div>
        </div>
        <div className="dkh-hero-media">
          <img src={imgHero} alt="" />
          <div className="dkh-promo"><b>{t('promo_t')}</b><span>{t('promo_d')}</span></div>
        </div>
      </div>
    </section>

    {/* 2) จุดเด่นแบบแถบ */}
    <section className="dkh-trust" aria-label={t('why_us')}>
      <ul className="dk-container dkh-trust-in">
        {trust.map(([i, b, d]) => <li key={b}><span className="dkh-trust-ic"><Icon n={i} size={22} /></span><span><b>{t(b)}</b><small>{t(d)}</small></span></li>)}
      </ul>
    </section>

    {/* 3) บริการ: ภาพสลับซ้ายขวา */}
    <section className="dkh-sec" aria-labelledby="home-services">
      <div className="dk-container">
        <header className="dkh-head">
          <h2 id="home-services">{t('dkh_svc_title')}</h2>
          <p>{t('dkh_svc_sub')}</p>
        </header>
        {!services ? <Loading /> : <div className="dkh-zz">
          {bookable.map((s, i) => {
            const desc = (lang === 'th' ? s.desc_th : s.desc_en) || t('dkh_svc_fallback')
            return <article key={s.code} className={'dkh-zz-row' + (i % 2 ? ' flip' : '')}>
              <div className="dkh-zz-media" style={{ '--tint': ART_TINT[s.code] ?? ART_TINT.general_cleaning } as React.CSSProperties}>
                <img src={imgs[i]} alt="" loading="lazy" />
                <span className="dkh-zz-badge"><ServiceArt code={s.code} size={56} /></span>
              </div>
              <div className="dkh-zz-text">
                <h3>{svcName(s, lang)}</h3>
                <p>{desc}</p>
                <dl className="dkh-zz-meta">
                  <div><dt>{t('dkh_from')}</dt><dd>{money(s.min_qty * s.price_per_unit)} {t('baht')}</dd></div>
                  <div><dt>{t('min_qty')}</dt><dd>{s.min_qty}{' '}{svcUnit(s, lang)}</dd></div>
                </dl>
                <div className="dkh-zz-btns">
                  <button type="button" className="dkh-btn line" onClick={() => open(s.code, '/service/' + s.code)}>{t('details')}</button>
                  <button type="button" className="dkh-btn sun" onClick={() => open(s.code, '/book')}>{t('book_now')}</button>
                </div>
              </div>
            </article>
          })}
        </div>}
        {services && <div className="dkh-more">
          {extra.map(s => <button key={s.to} type="button" className="dkh-more-item" onClick={() => open(s.svc, s.to)}>
            <span className="dkh-more-ic" style={{ '--tint': ART_TINT[s.art] } as React.CSSProperties}><ServiceArt code={s.art} size={40} /></span>
            <b>{s.label.replace('\n', ' ')}</b><Icon n="next" size={18} />
          </button>)}
          {soon.map(s => <div key={s.code} className="dkh-more-item soon">
            <span className="dkh-more-ic" style={{ '--tint': ART_TINT[s.code] } as React.CSSProperties}><ServiceArt code={s.code} size={40} /></span>
            <b>{short(s.code, svcName(s, lang))}</b><span className="dkh-soon">{t('soon')}</span>
          </div>)}
        </div>}
      </div>
    </section>

    {/* 4) แม่บ้านแนะนำ */}
    <section className="dkh-sec alt" aria-labelledby="home-maids">
      <div className="dk-container">
        <header className="dkh-head row">
          <div><h2 id="home-maids">{t('top_maids')}</h2><p>{t('dkh_maids_sub')}</p></div>
          <Link to="/book" className="dkh-btn line">{t('see_all')}</Link>
        </header>
        {maids && maids.length === 0 ? <Empty small art={maidsFailed ? 'error' : 'search'} title={maidsFailed ? t('load_failed') : t('nothing')} />
          : !maids ? <Loading /> : <div className="dkh-maids">{maids.slice(0, 4).map(m => <Link key={m.id} to={'/maid-profile/' + m.id} className="dkh-maid">
            <Avatar name={m.nickname} url={m.photo_url} seed={m.id} size={72} />
            <b>{m.nickname}</b>
            <small>{m.review_count ? <><span className="star">★</span> {m.avg_rating ?? '–'} · {m.review_count} {t('reviews')}</> : t('no_reviews')}</small>
            {(m.id_verified || m.background_checked) && <span className="dkh-maid-ok"><Icon n="shield" size={14} />{m.background_checked ? t('bg_ok') : t('id_ok')}</span>}
          </Link>)}</div>}
      </div>
    </section>

    {/* 5) จองง่าย 4 ขั้นตอน */}
    <section className="dkh-sec" aria-labelledby="home-booking-heading">
      <div className="dk-container">
        <header className="dkh-head">
          <h2 id="home-booking-heading">{t('how_it_works')}</h2>
          <p>{t('dkh_steps_sub')}</p>
        </header>
        <ol className="dkh-steps">
          {steps.map(([title, d], i) => <li key={title}>
            <span className="dkh-step-n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
            <h3>{t(title)}</h3><p>{t(d)}</p>
          </li>)}
        </ol>
        <div className="dkh-steps-cta"><Link to="/book" className="dkh-btn sun lg">{t('book_now')}</Link></div>
      </div>
    </section>

    {/* 6) การรับประกัน */}
    <section className="dkh-sec dkh-g-wrap" aria-labelledby="home-why">
      <div className="dk-container">
        <div className="dkh-g">
          <div className="dkh-g-text">
            <h2 id="home-why">{t('g_title')}</h2>
            <p>{t('dkh_g_lead')}</p>
            <ul>{promises.map(x => <li key={x}><Icon n="check" size={18} />{x}</li>)}</ul>
            <Link to="/guarantee" className="dkh-btn sun">{t('dkh_g_more')}</Link>
          </div>
          <div className="dkh-g-media"><img src={imgWai} alt="" loading="lazy" /></div>
        </div>
      </div>
    </section>
    <CustomerTabs />
  </div>
}
