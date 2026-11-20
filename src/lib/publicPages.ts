import { sb } from './supabase'
import type { Lang } from './i18n'

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

const defaultCopies: Record<PolicyKey, Record<Lang, PolicyCopy>> = {
  privacy: {
    th: {
      title: "นโยบายความเป็นส่วนตัว",
      intro: "นโยบายฉบับนี้อธิบายการเก็บรวบรวม การใช้ และการเปิดเผยข้อมูลส่วนบุคคล ตลอดจนช่องทางที่เจ้าของข้อมูลสามารถใช้สิทธิได้",
      note: "",
      imageAlt: "บ้านริมทะเลในชุมพร",
      sections: [
        { title: "ผู้ให้บริการและช่องทางติดต่อ", body: "CleenDee (คลีนดี) ให้บริการจองแม่บ้านทำความสะอาดในจังหวัดชุมพร สามารถติดต่อเกี่ยวกับนโยบายฉบับนี้ได้ที่หมายเลข {phones}" },
        { title: "ข้อมูลส่วนบุคคลที่เก็บรวบรวม", body: "ข้อมูลลูกค้า ได้แก่ ชื่อ อีเมล และรูปโปรไฟล์จาก Google หรือ LINE ที่ใช้เข้าสู่ระบบ เบอร์โทรศัพท์ ที่อยู่และตำแหน่งบนแผนที่ ข้อมูลการจอง การชำระเงิน และสลิปโอนเงิน รวมถึงข้อความที่ติดต่อกับแม่บ้าน รีวิว และภาพที่แนบเพื่อแจ้งความเสียหาย\n\nข้อมูลแม่บ้าน ได้แก่ ข้อมูลการยืนยันตัวตน ตารางวันว่าง ตำแหน่งระหว่างการเดินทางไปปฏิบัติงาน และข้อมูลบัญชีธนาคารสำหรับโอนค่าจ้าง" },
        { title: "วัตถุประสงค์ในการใช้ข้อมูล", body: "CleenDee ใช้ข้อมูลเพื่อยืนยันตัวตนเมื่อเข้าสู่ระบบ จัดหาแม่บ้าน นัดหมายและติดต่อเกี่ยวกับงาน ตรวจสอบการชำระเงินและการคืนเงิน พิจารณาคำร้องเกี่ยวกับความเสียหาย และดูแลความปลอดภัยของลูกค้าและแม่บ้าน" },
        { title: "การเปิดเผยและจัดเก็บข้อมูล", body: "แม่บ้านที่รับงานจะเห็นเฉพาะชื่อ ที่อยู่ และรายละเอียดงานที่จำเป็นต่อการให้บริการ CleenDee ไม่ขายข้อมูลส่วนบุคคล และจัดเก็บข้อมูลบนบริการคลาวด์ Supabase ที่ใช้ดำเนินระบบ\n\nเมื่อผู้ใช้กดอ่านตำแหน่ง GPS เพื่อกรอกที่อยู่ เบราว์เซอร์จะส่งพิกัดไปยัง Photon เพื่อค้นหาที่อยู่ และโหลดแผนที่จาก OpenStreetMap" },
        { title: "สิทธิของเจ้าของข้อมูล", body: "เจ้าของข้อมูลสามารถขอเข้าถึง แก้ไข หรือลบข้อมูลส่วนบุคคลของตน รวมถึงขอปิดบัญชีได้ โดยติดต่อ CleenDee ที่หมายเลข {phones}" },
      ],
    },
    en: {
      title: "Privacy Policy",
      intro: "This policy explains how CleenDee collects, uses and shares personal data and how you can exercise your rights.",
      note: "",
      imageAlt: "A coastal home in Chumphon",
      sections: [
        { title: "Service provider and contact", body: "CleenDee operates a home cleaning booking service in Chumphon, Thailand. For questions about this policy, call {phones}." },
        { title: "Personal data we collect", body: "Customer data includes your name, email and profile image from Google or LINE when you sign in, phone number, service address and map location, booking and payment details, transfer slips, messages with your helper, reviews and photos submitted with damage claims.\n\nHelper data includes identity verification information, availability, location while travelling to a job and bank account details for payouts." },
        { title: "Purposes of use", body: "CleenDee uses this information to verify sign-ins, find and schedule helpers, communicate about bookings, verify payments and refunds, assess damage claims and support the safety of customers and helpers." },
        { title: "Data sharing and storage", body: "The helper assigned to your booking sees only the name, address and job details needed to provide the service. CleenDee does not sell personal data. Information is stored on Supabase, the cloud service we use to run the app.\n\nWhen you request a GPS fix to fill in your address, your browser sends the coordinates to Photon for address lookup and loads map tiles from OpenStreetMap." },
        { title: "Your rights", body: "You can request access to, correction of or deletion of your personal data, or ask us to close your account, by calling CleenDee at {phones}." },
      ],
    },
  },
  guarantee: {
    th: {
      title: "การรับประกันบริการ CleenDee",
      intro: "หลักเกณฑ์การดูแลลูกค้า การชดเชยความเสียหาย การเลื่อนนัด และการยกเลิกบริการ",
      note: "การชดเชยเป็นความรับผิดชอบโดยตรงของ CleenDee และไม่ใช่การประกันภัย เจ้าหน้าที่พิจารณาจากภาพถ่ายและมูลค่าทรัพย์สิน",
      imageAlt: "แม่บ้านคลีนดีในชุดทำงาน",
      sections: [
        { title: "กรณีแม่บ้านไม่เข้าปฏิบัติงาน", body: "หากแม่บ้านไม่เข้าปฏิบัติงานตามนัด CleenDee จะจัดหาแม่บ้านทดแทน หากไม่สามารถจัดหาได้ ลูกค้าจะได้รับเงินคืนเต็มจำนวน" },
        { title: "ความเสียหายระหว่างให้บริการ", body: "CleenDee พิจารณาชดเชยความเสียหายสูงสุด {cap} บาทต่อการให้บริการหนึ่งครั้ง\n\nโปรดแจ้งภายใน {days} วันหลังเสร็จสิ้นบริการ และแนบภาพถ่ายความเสียหายประกอบการพิจารณา" },
        { title: "การตรวจสอบแม่บ้าน", body: "CleenDee ยืนยันตัวตนด้วยบัตรประชาชนและตรวจสอบประวัติของแม่บ้านทุกคนก่อนให้รับงานผ่านระบบ" },
        { title: "การเลื่อนนัด", body: "ลูกค้าสามารถเปลี่ยนวันหรือเวลานัดผ่านแอปโดยไม่มีค่าใช้จ่าย หากเหลือเวลามากกว่า {h} ชั่วโมงก่อนเวลาเริ่มบริการ" },
        { title: "เงื่อนไขการยกเลิก", body: "ก่อนเวลาเริ่มบริการตั้งแต่ 24 ชั่วโมงขึ้นไป คืนเงินเต็มจำนวน\nก่อนเวลาเริ่มบริการตั้งแต่ 6 ชั่วโมงแต่ไม่ถึง 24 ชั่วโมง คืนเงินครึ่งหนึ่ง\nก่อนเวลาเริ่มบริการน้อยกว่า 6 ชั่วโมง ไม่มีการคืนเงิน" },
      ],
    },
    en: {
      title: "CleenDee Service Guarantee",
      intro: "How CleenDee handles missed visits, damage claims, rescheduling and cancellations.",
      note: "CleenDee provides compensation directly. This is not an insurance policy. We assess claims using photographs and the value of the item.",
      imageAlt: "CleenDee housekeeper in uniform",
      sections: [
        { title: "Helper no-show", body: "If your helper does not arrive as scheduled, CleenDee will arrange a replacement. If a replacement cannot be arranged, you will receive a full refund." },
        { title: "Damage during service", body: "CleenDee considers compensation of up to {cap} THB per booking.\n\nPlease report damage within {days} days after the service and include photographs for review." },
        { title: "Helper verification", body: "CleenDee verifies each helper’s identity and checks their background before they accept jobs through the app." },
        { title: "Rescheduling", body: "You can change your appointment date or time in the app at no charge when more than {h} hours remain before the scheduled start." },
        { title: "Cancellation terms", body: "At least 24 hours before the appointment: full refund.\nAt least 6 hours and less than 24 hours before the appointment: half refund.\nLess than 6 hours before the appointment: no refund." },
      ],
    },
  },
}

export function defaultPolicyCopy(page: PolicyKey, lang: Lang): PolicyCopy {
  return defaultCopies[page][lang]
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
