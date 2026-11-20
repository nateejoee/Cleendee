import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon, LangToggle, Loading, Logo } from '../components/ui'
import { fmtDate, money, useI18n } from '../lib/i18n'
import { defaultPhones, defaultPolicyCopy, formatPolicyPhones, policyImageUrl, policyPhoneHref, readPolicy, renderPolicyText, resolvePolicyCopy, type PolicyKey, type PolicyRecord } from '../lib/publicPages'
import { sb } from '../lib/supabase'
import guaranteeImage from '../assets/ill/safety.webp'
import privacyImage from '../assets/ill/chumphon.webp'
import './PublicPages.css'

const guaranteeIcons = ['team', 'shield', 'check', 'cal', 'wallet']
const privacyIcons = ['home', 'lock', 'grid', 'shield', 'user']
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
  const icons = guarantee ? guaranteeIcons : privacyIcons

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
        <span className="policy-hero-symbol"><Icon n={guarantee ? 'shield' : 'lock'} size={23} /></span>
        <h1>{copy.title}</h1>
        <p>{replace(copy.intro)}</p>
        {published && <time dateTime={published}>{th ? 'ปรับปรุงล่าสุด' : 'Last updated'} {dateText}</time>}
      </div>
      <img className={'policy-hero-image policy-hero-' + page} src={customImage || originals[page]}
        alt={path && brokenImage === path ? defaults.imageAlt : copy.imageAlt}
        onError={customImage && path ? () => setBrokenImage(path) : undefined} fetchPriority="high" />
    </header>
    <div className="policy-canvas">
      <nav className="policy-index" aria-label={th ? 'สารบัญ' : 'Contents'}>
        <p>{th ? 'สารบัญ' : 'On this page'}</p>
        <ul>{copy.sections.map((section, index) => <li key={index}><a href={'#policy-section-' + index}>{section.title}<Icon n="next" size={13} /></a></li>)}</ul>
      </nav>
      <article className="policy-document" aria-label={copy.title}>
        {guarantee && failed ? <div className="stack" role="status">
          <p>{th ? 'โหลดเงื่อนไขการันตีไม่สำเร็จ' : 'The guarantee terms could not be loaded.'}</p>
          <button className="btn b-line" type="button" onClick={() => { setFailed(false); setAttempt(n => n + 1) }}>{th ? 'ลองอีกครั้ง' : 'Try again'}</button>
        </div> : guarantee && !settings ? <Loading /> : copy.sections.map((section, index) => (
          <section className="policy-section" id={'policy-section-' + index} key={index}>
            <span className="policy-section-icon"><Icon n={icons[index]} size={18} /></span>
            <div><h2>{section.title}</h2><p>{replace(section.body)}</p></div>
          </section>
        ))}
        {copy.note && <aside className="policy-note">{replace(copy.note)}</aside>}
        {!guarantee && <footer className="policy-contact">
          <h2>{th ? 'ติดต่อ CleenDee' : 'Contact CleenDee'}</h2>
          <div>{phones.map(phone => <a className="btn b-line" key={phone} href={policyPhoneHref(phone)}>{phone}</a>)}</div>
        </footer>}
      </article>
    </div>
  </main>
}

export function Guarantee() { return <PublicPolicy page="guarantee" /> }
export function Privacy() { return <PublicPolicy page="privacy" /> }
