import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loading, Icon } from '../components/ui'
import { defaultPolicyCopy, policyColumns, policyImageBucket, policyImageLimit, policyImageTypes, policyImageUrl, policyKeys, readPolicy, resolvePolicyCopy, type PolicyCopy, type PolicyKey, type PolicyRecord } from '../lib/publicPages'
import { useI18n, type Lang } from '../lib/i18n'
import { friendly, sb } from '../lib/supabase'
import guaranteeImage from '../assets/ill/safety.webp'
import privacyImage from '../assets/ill/chumphon.webp'
import './PublicPages.css'

type PolicyDraft = {
  th: PolicyCopy
  en: PolicyCopy
  imagePath: string | null
  file: File | null
  date: string
  phones: string[]
  revision: number
}
type Drafts = Record<PolicyKey, PolicyDraft>
const fallbackImage = { guarantee: guaranteeImage, privacy: privacyImage }

export function PublicPageEditor() {
  const { lang, t } = useI18n()
  const th = lang === 'th'
  const [page, setPage] = useState<PolicyKey>('guarantee')
  const [language, setLanguage] = useState<Lang>(lang)
  const [drafts, setDrafts] = useState<Drafts | null>(null)
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [preview, setPreview] = useState<string | null>(null)
  const draft = drafts?.[page]
  const selectedFile = draft?.file

  useEffect(() => {
    let active = true
    sb.from('public_page_content').select(policyColumns).returns<PolicyRecord[]>().then(({ data, error }) => {
      if (!active) return
      setLoading(false)
      const guarantee = data?.find(row => row.page === 'guarantee')
      const privacy = data?.find(row => row.page === 'privacy')
      if (error || !guarantee || !privacy) {
        return
      }
      const toDraft = (record: PolicyRecord): PolicyDraft => ({
        th: resolvePolicyCopy(record.content_th, defaultPolicyCopy(record.page, 'th')),
        en: resolvePolicyCopy(record.content_en, defaultPolicyCopy(record.page, 'en')),
        imagePath: record.image_path,
        file: null,
        date: record.published_on ?? '',
        phones: record.page === 'privacy' ? [record.contact_phones[0] ?? '', record.contact_phones[1] ?? ''] : [],
        revision: record.revision,
      })
      setDrafts({ guarantee: toDraft(guarantee), privacy: toDraft(privacy) })
    })
    return () => { active = false }
  }, [attempt])

  useEffect(() => {
    if (!selectedFile) { setPreview(null); return }
    const url = URL.createObjectURL(selectedFile)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [selectedFile])

  if (loading) return <Loading />
  if (!draft) return <div className="stack">
    <p className="err" role="alert">{th ? 'โหลดเนื้อหาไม่สำเร็จ กรุณาลองอีกครั้ง' : 'Could not load page content. Please try again.'}</p>
    <button type="button" className="btn b-line" onClick={() => { setLoading(true); setAttempt(n => n + 1) }}>{th ? 'ลองอีกครั้ง' : 'Try again'}</button>
  </div>

  const copy = draft[language]
  const update = (patch: Partial<PolicyDraft>) => setDrafts(current => current && ({ ...current, [page]: { ...current[page], ...patch } }))
  const updateCopy = (patch: Partial<PolicyCopy>) => update({ [language]: { ...copy, ...patch } })
  const updateSection = (index: number, field: 'title' | 'body', text: string) => {
    updateCopy({ sections: copy.sections.map((section, i) => i === index ? { ...section, [field]: text } : section) })
  }
  const showError = (thai: string, english: string) => setNotice({ text: th ? thai : english, error: true })

  const pickImage = (file: File | undefined) => {
    if (!file) return
    if (!policyImageTypes.has(file.type) || file.size < 1 || file.size > policyImageLimit) {
      showError('เลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB', 'Choose a JPG, PNG or WebP image up to 5 MB.')
      return
    }
    setNotice(null)
    update({ file })
  }

  async function publish() {
    if (!draft || busy) return
    const languages = [draft.th, draft.en]
    const complete = languages.every(value => value.title.trim() && value.intro.trim() && value.imageAlt.trim()
      && value.sections.every(section => section.title.trim() && section.body.trim()))
    if (!complete) {
      showError('กรอกชื่อหน้า คำเกริ่น คำอธิบายรูป และเนื้อหาให้ครบทั้งสองภาษา', 'Fill in the heading, introduction, image description and sections in both languages.')
      return
    }
    if (page === 'guarantee' && !languages.every(value => value.sections[1].body.includes('{cap}')
      && value.sections[1].body.includes('{days}') && value.sections[3].body.includes('{h}'))) {
      showError('ใส่ {cap} และ {days} ในหัวข้อการชดเชย และ {h} ในหัวข้อเลื่อนนัดทั้งสองภาษา', 'Keep {cap} and {days} in the compensation section and {h} in rescheduling in both languages.')
      return
    }
    const phones = [...new Set(draft.phones.map(value => value.trim()).filter(Boolean))]
    if (page === 'privacy' && (!draft.date || phones.length === 0 || phones.some(phone => !/^\+?[0-9]{7,15}$/.test(phone.replace(/[ -]/g, ''))))) {
      showError('ระบุวันที่ปรับปรุงและหมายเลขติดต่ออย่างน้อยหนึ่งหมายเลข', 'Enter the effective date and at least one valid contact number.')
      return
    }

    setBusy(true)
    setNotice(null)
    let uploaded: string | null = null
    try {
      if (draft.file) {
        const filePath = page + '/' + crypto.randomUUID() + '.' + policyImageTypes.get(draft.file.type)
        const { error } = await sb.storage.from(policyImageBucket).upload(filePath, draft.file, {
          cacheControl: '31536000', contentType: draft.file.type, upsert: false,
        })
        if (error) throw error
        uploaded = filePath
      }
      const imagePath = uploaded ?? draft.imagePath
      const { data, error } = await sb.from('public_page_content').update({
        content_th: draft.th, content_en: draft.en, image_path: imagePath,
        published_on: draft.date || null, contact_phones: phones, revision: draft.revision + 1,
      }).eq('page', page).eq('revision', draft.revision).select('revision').maybeSingle<{ revision: number }>()
      if (error) throw error
      if (!data) throw new Error(th ? 'มีเนื้อหาเวอร์ชันใหม่กว่า เปิดหน้านี้อีกครั้งเพื่อตรวจสอบก่อนเผยแพร่' : 'A newer version was published. Reopen this editor to review it before publishing.')
      update({ file: null, imagePath, revision: data.revision, phones: page === 'privacy' ? [phones[0] ?? '', phones[1] ?? ''] : [] })
      setNotice({ text: th ? 'เผยแพร่บนเว็บไซต์แล้ว' : 'Published to the website.', error: false })
    } catch (error) {
      if (uploaded) {
        const latest = await readPolicy(page)
        if (latest.data && latest.data.image_path !== uploaded) await sb.storage.from(policyImageBucket).remove([uploaded])
      }
      setNotice({ text: friendly(error, lang), error: true })
    } finally {
      setBusy(false)
    }
  }

  return <div className="policy-editor">
    <div className="policy-editor-toolbar">
      <select className="input" value={page} aria-label={th ? 'หน้าที่แก้ไข' : 'Page to edit'} disabled={busy} onChange={e => { setPage(e.target.value as PolicyKey); setNotice(null) }}>
        {policyKeys.map(key => <option value={key} key={key}>{defaultPolicyCopy(key, lang).title}</option>)}
      </select>
      <Link className="btn b-line sm" to={'/' + page}><Icon n="next" size={15} />{th ? 'ดูหน้าที่เผยแพร่' : 'View public page'}</Link>
    </div>
    <fieldset className="policy-editor-card" disabled={busy}>
      <h2>{th ? 'รูปภาพและข้อมูลการเผยแพร่' : 'Image and publication details'}</h2>
      <img className="policy-editor-preview" src={selectedFile && preview ? preview : draft.imagePath ? policyImageUrl(draft.imagePath) : fallbackImage[page]} alt={copy.imageAlt} />
      <label>{th ? 'อัปโหลดภาพหน้าปก' : 'Upload cover image'}
        <input className="policy-editor-file" key={page + draft.revision + (draft.imagePath ?? '')} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => pickImage(e.target.files?.[0])} />
      </label>
      <p className="policy-editor-hint">{th ? 'JPG, PNG หรือ WebP · ไม่เกิน 5 MB · จะแสดงในหน้าสาธารณะหลังเผยแพร่' : 'JPG, PNG or WebP · up to 5 MB · visible on the public page after publishing.'}</p>
      {(draft.file || draft.imagePath) && <div className="policy-editor-actions"><button className="btn b-line sm" type="button" onClick={() => update({ file: null, imagePath: null })}>{th ? 'ใช้ภาพเริ่มต้น' : 'Use default image'}</button></div>}
      <label>{th ? 'วันที่ปรับปรุงล่าสุด' : 'Last updated date'}<input className="input" type="date" value={draft.date} onChange={e => update({ date: e.target.value })} /></label>
      {page === 'privacy' && draft.phones.map((phone, index) => <label key={index}>{th ? 'เบอร์ติดต่อ ' : 'Contact number '}{index + 1}
        <input className="input" type="tel" maxLength={22} value={phone} onChange={e => update({ phones: draft.phones.map((value, i) => i === index ? e.target.value : value) })} />
      </label>)}
    </fieldset>
    <fieldset className="policy-editor-card" disabled={busy}>
      <h2>{th ? 'ข้อความบนหน้า' : 'Page copy'}</h2>
      <div className="policy-editor-actions">
        <button type="button" className={'btn sm ' + (language === 'th' ? 'b-ocean' : 'b-line')} aria-pressed={language === 'th'} onClick={() => setLanguage('th')}>ภาษาไทย</button>
        <button type="button" className={'btn sm ' + (language === 'en' ? 'b-ocean' : 'b-line')} aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button>
      </div>
      <label>{th ? 'ชื่อหน้า' : 'Page title'}<input className="input" maxLength={110} value={copy.title} onChange={e => updateCopy({ title: e.target.value })} /></label>
      <label>{th ? 'คำเกริ่น' : 'Introduction'}<textarea className="input" maxLength={350} value={copy.intro} onChange={e => updateCopy({ intro: e.target.value })} /></label>
      <label>{th ? 'คำอธิบายรูปภาพ' : 'Image description'}<input className="input" maxLength={150} value={copy.imageAlt} onChange={e => updateCopy({ imageAlt: e.target.value })} /></label>
      <p className="policy-editor-hint">{page === 'guarantee'
        ? th ? '{cap} วงเงินชดเชย · {days} วันสำหรับแจ้งเคลม · {h} ชั่วโมงสำหรับเลื่อนนัด ดึงจากค่าตั้งร้าน' : '{cap} compensation cap · {days} claim deadline · {h} rescheduling hours come from shop settings.'
        : th ? '{phones} จะแสดงหมายเลขติดต่อที่กำหนดไว้ด้านบน' : '{phones} displays the contact numbers entered above.'}</p>
      {copy.sections.map((section, index) => <details key={page + '-' + language + '-' + index}>
        <summary>{section.title || (th ? 'หัวข้อ ' : 'Section ') + (index + 1)}</summary>
        <label>{th ? 'ชื่อหัวข้อ' : 'Section title'}<input className="input" maxLength={100} value={section.title} onChange={e => updateSection(index, 'title', e.target.value)} /></label>
        <label>{th ? 'รายละเอียด' : 'Section text'}<textarea className="input" maxLength={4000} value={section.body} onChange={e => updateSection(index, 'body', e.target.value)} /></label>
      </details>)}
      <label>{th ? 'หมายเหตุท้ายหน้า' : 'Closing note'}<textarea className="input" maxLength={1200} value={copy.note} onChange={e => updateCopy({ note: e.target.value })} /></label>
    </fieldset>
    {notice && <p className={notice.error ? 'err' : 'ok-note'} role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    <button type="button" className="btn b-sun" disabled={busy} onClick={publish}>{busy ? t('loading') : th ? 'เผยแพร่การเปลี่ยนแปลง' : 'Publish changes'}</button>
  </div>
}
