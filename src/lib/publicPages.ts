import { sb } from './supabase'
import { translate, type Key, type Lang } from './i18n'

export type PolicyKey = 'guarantee' | 'privacy'
export type PolicySection = { title: string; body: string }
export type PolicyCopy = { title: string; intro: string; note: string; imageAlt: string; sections: PolicySection[] }
export type PolicyRecord = {
  page: PolicyKey
  content_th: PolicyCopy | null
  content_en: PolicyCopy | null
  image_path: string | null
  published_on: string | null
  contact_phones: string[]
  revision: number
}

export const policyKeys: PolicyKey[] = ['guarantee', 'privacy']
export const defaultPhones = ['093-651-9324', '082-939-0077']
export const policyImageBucket = 'public-page-images'
export const policyImageLimit = 5 * 1024 * 1024
export const policyImageTypes = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']])
export const policyColumns = 'page,content_th,content_en,image_path,published_on,contact_phones,revision'

const privacyCopy: Record<Lang, { title: string; sections: [string, string][] }> = {
  th: {
    title: 'นโยบายความเป็นส่วนตัว',
    sections: [
      ['ผู้ให้บริการและช่องทางติดต่อ', 'CleenDee (คลีนดี) บริการจ้างแม่บ้านทำความสะอาดในจังหวัดชุมพร ติดต่อ โทร. {phones}'],
      ['ประเภทข้อมูลที่เก็บรวบรวม', 'ชื่อ อีเมล และรูปโปรไฟล์จาก Google หรือ LINE เมื่อคุณเข้าสู่ระบบ, เบอร์โทร, ที่อยู่และตำแหน่งบนแผนที่สำหรับเข้าทำงาน, ข้อมูลการจอง การชำระเงินและสลิปโอนเงิน, ข้อความที่คุยกับแม่บ้าน, รีวิว, และรูปถ่ายที่แนบตอนแจ้งเคลมความเสียหาย สำหรับแม่บ้าน เราเก็บข้อมูลการยืนยันตัวตน ตารางวันว่าง ตำแหน่งระหว่างเดินทางไปงาน และบัญชีธนาคารสำหรับโอนค่าจ้าง'],
      ['วัตถุประสงค์ในการใช้ข้อมูล', 'ยืนยันตัวตนเมื่อเข้าสู่ระบบ, จัดหาแม่บ้านและนัดหมายงาน, ตรวจสอบการชำระเงินและคืนเงิน, ติดต่อเรื่องงานที่จอง, พิจารณาเคลมความเสียหาย และดูแลความปลอดภัยของลูกค้าและแม่บ้าน'],
      ['การเปิดเผยและจัดเก็บข้อมูล', 'แม่บ้านที่รับงานจะเห็นชื่อ ที่อยู่ และรายละเอียดงานที่จำเป็นต่อการเข้าทำงานเท่านั้น เราไม่ขายข้อมูลของคุณ เมื่อคุณกดอ่าน GPS เพื่อเติมที่อยู่ เบราว์เซอร์จะส่งพิกัดให้ Photon เพื่อค้นที่อยู่ และโหลดแผนที่จาก OpenStreetMap ข้อมูลถูกเก็บบนบริการคลาวด์ (Supabase) ที่เราใช้ดำเนินงาน'],
      ['สิทธิของเจ้าของข้อมูล', 'คุณขอดู แก้ไข หรือลบข้อมูลของคุณ และขอยกเลิกบัญชีได้ โดยติดต่อ โทร. {phones}'],
    ],
  },
  en: {
    title: 'Privacy Policy',
    sections: [
      ['Provider and contact information', 'CleenDee is a home cleaning service in Chumphon, Thailand. Contact: {phones}'],
      ['Information we collect', 'Your name, email and profile picture from Google or LINE when you log in; phone number; service address and map location; bookings, payments and transfer slips; messages with your helper; reviews; and photos you attach to damage claims. For helpers we also keep identity checks, availability, location while travelling to a job, and bank account for payouts.'],
      ['How we use your information', 'To log you in, match and schedule helpers, check payments and refunds, contact you about bookings, handle damage claims, and keep customers and helpers safe.'],
      ['Data sharing and storage', 'The helper who takes your job sees only the name, address and job details needed to do the work. We do not sell your data. When you tap Locate and fill address, your browser sends the pin to Photon for address lookup and loads map tiles from OpenStreetMap. Data is stored on the cloud service we use to run the app (Supabase).'],
      ['Your rights', 'You can ask to see, correct or delete your data, or close your account, by calling {phones}.'],
    ],
  },
}

export function defaultPolicyCopy(page: PolicyKey, lang: Lang): PolicyCopy {
  if (page === 'privacy') {
    const copy = privacyCopy[lang]
    return {
      title: copy.title,
      intro: lang === 'th' ? 'ข้อมูลที่ CleenDee เก็บ วิธีที่เราใช้ข้อมูล และช่องทางสำหรับใช้สิทธิของคุณ' : 'What CleenDee collects, how we use it, and how to exercise your rights.',
      note: '',
      imageAlt: lang === 'th' ? 'บ้านริมทะเลในชุมพร' : 'A coastal home in Chumphon',
      sections: copy.sections.map(([title, body]) => ({ title, body })),
    }
  }
  const t = (key: Key) => translate(lang, key)
  const headings = lang === 'th'
    ? ["กรณีแม่บ้านไม่เข้าปฏิบัติงาน","ความเสียหายระหว่างให้บริการ","การตรวจสอบแม่บ้าน","การเลื่อนนัด","เงื่อนไขการยกเลิก"]
    : ["Helper no-show","Damage during service","Helper verification","Rescheduling","Cancellation terms"]
  const descriptions: Key[] = ['g1d', 'g2d', 'g3d', 'g4d', 'cancel_rules']
  return {
    title: lang === 'th' ? 'การรับประกันบริการ CleenDee' : 'CleenDee Service Guarantee',
    intro: lang === 'th' ? 'หลักเกณฑ์การชดเชย การเลื่อนนัด และการยกเลิกบริการของ CleenDee' : 'CleenDee’s terms for compensation, rescheduling and cancellations.',
    note: t('g_note'),
    imageAlt: lang === 'th' ? 'แม่บ้านคลีนดีในชุดทำงาน' : 'CleenDee housekeeper in uniform',
    sections: headings.map((title, index) => ({ title, body: t(descriptions[index]) })),
  }
}

export function resolvePolicyCopy(value: unknown, defaults: PolicyCopy): PolicyCopy {
  if (typeof value !== 'object' || value === null) return defaults
  const copy = value as Partial<PolicyCopy>
  const entries = Array.isArray(copy.sections) ? copy.sections : []
  const required = (input: unknown, fallback: string) => typeof input === 'string' && input.trim() ? input : fallback
  return {
    title: required(copy.title, defaults.title),
    intro: required(copy.intro, defaults.intro),
    note: typeof copy.note === 'string' ? copy.note : defaults.note,
    imageAlt: required(copy.imageAlt, defaults.imageAlt),
    sections: defaults.sections.map((section, index) => ({
      title: required(entries[index]?.title, section.title),
      body: required(entries[index]?.body, section.body),
    })),
  }
}

export function readPolicy(page: PolicyKey) {
  return sb.from('public_page_content').select(policyColumns).eq('page', page).maybeSingle<PolicyRecord>()
}

export function policyImageUrl(path: string) {
  return sb.storage.from(policyImageBucket).getPublicUrl(path).data.publicUrl
}

export function policyPhoneHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, '')
  return 'tel:' + (/^0\d{9}$/.test(digits) ? '+66' + digits.slice(1) : digits)
}

export function formatPolicyPhones(phones: string[], lang: Lang) {
  return phones.map(phone => lang === 'en' && /^0\d{2}-\d{3}-\d{4}$/.test(phone)
    ? '+66 ' + phone.slice(1).replaceAll('-', ' ') : phone).join(', ')
}

export function renderPolicyText(value: string, variables: Record<string, string>) {
  return value.replace(/\{(cap|days|h|phones)\}/g, (token, key: string) => variables[key] ?? token)
}
