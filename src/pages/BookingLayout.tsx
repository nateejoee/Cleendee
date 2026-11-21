import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, LangToggle, Logo } from '../components/ui'
import { useI18n, type Key } from '../lib/i18n'
import './Booking.css'

const steps: Key[] = ['st_maid', 'st_time', 'st_detail', 'st_pay']

type BookingLayoutProps = {
  title: string
  step?: number
  service?: string
  back?: string
  children: ReactNode
  action?: { label: string; onClick: () => void; disabled?: boolean }
  price?: string
  priceLabel?: string
  meta?: string
  was?: string
  saving?: string
}

export function BookingLayout({ title, step, service, back, children, action, price, priceLabel, meta, was, saving }: BookingLayoutProps) {
  const { t } = useI18n()
  const navigate = useNavigate()

  // หัวหน้าการจองแบบพรีเมียม: แถบกรมท่าเต็มความกว้าง รวมหัวเว็บ ขั้นตอน และหัวข้อ แล้วเนื้อหาการ์ดลอยทับขอบล่าง
  return <main className="page booking-journey">
    <div className="booking-hero">
    <span className="booking-hero-glow" aria-hidden="true" />
    <header className="booking-header">
      <button type="button" className="booking-back" onClick={() => back ? navigate(back) : navigate(-1)} aria-label={t('booking_back')}>
        <Icon n="back" size={18} />
      </button>
      <span className="booking-brand"><Logo h={29} /><Logo white h={29} /></span>
      <LangToggle />
    </header>
    {step !== undefined && <ol className="booking-progress" role="list" aria-label={t('booking_progress')} style={{ ['--bk-p' as string]: String(step / (steps.length - 1)) }}>
      {steps.map((label, index) => <li key={label} className={index < step ? 'is-complete' : ''} aria-current={index === step ? 'step' : undefined}>
        <span className="booking-progress-mark" aria-hidden="true">{index < step ? <Icon n="check" size={14} /> : index + 1}</span>
        <span>{t(label)}</span>
      </li>)}
    </ol>}
    <div className="booking-heading">
      {service && <p>{service}</p>}
      <h1 id="booking-title">{title}</h1>
    </div>
    </div>
    <div className={action ? 'booking-workspace has-action' : 'booking-workspace'}>
      <section className="booking-content" aria-labelledby="booking-title">
        {children}
      </section>
      {action && <aside className="booking-action">
        <div className="booking-action-cover" aria-hidden="true" />
        <div className="booking-action-body">
          {price !== undefined && <div className="booking-amount" aria-live="polite">
            {priceLabel && <small>{priceLabel}</small>}
            <strong>{price}</strong>
            {was && saving && <span className="booking-saving"><s>{was}</s><em>{saving}</em></span>}
            {meta && <span className="booking-amount-meta">{meta}</span>}
          </div>}
          <button type="button" className="btn booking-primary" onClick={action.onClick} disabled={action.disabled}>
            <span className="booking-shine" aria-hidden="true" />
            <span>{action.label}</span><Icon n="next" size={17} />
          </button>
        </div>
      </aside>}
    </div>
  </main>
}
