// ภาพตอน "ยังไม่มีข้อมูล" ทั้งเว็บ วาดเองชุดเดียวกัน: ตัวการ์ตูนสีทองหลับตายิ้ม บนวงกลมพื้นอ่อน มีฟองสบู่และประกายดาว
// art แต่ละแบบเปลี่ยนแค่รูปร่างตัวการ์ตูน (ปฏิทิน ประวัติ หมุด หัวใจ ถังน้ำ กระเป๋าเงิน แว่นขยาย พระจันทร์ เมฆ)
// กระดิ่ง (แจ้งเตือน) และกล่องแชท อยู่ใน pages/Notifications.tsx ใช้กรอบเดียวกัน
import type { ReactNode } from 'react'

export type Art = 'cal' | 'history' | 'pin' | 'heart' | 'jobs' | 'wallet' | 'search' | 'closed' | 'error'

const GOLD = 'url(#ea-g)', NAVY = '#13294B'

// หน้าหลับตายิ้ม (sad = ปากตรง สำหรับโหลดไม่สำเร็จ)
function Face({ x, y, sad = false }: { x: number; y: number; sad?: boolean }) {
  return <g>
    <path d={`M${x - 17} ${y}q6 6 12 0M${x + 5} ${y}q6 6 12 0`} stroke={NAVY} strokeWidth="3.2" strokeLinecap="round" fill="none" />
    {sad ? <path d={`M${x - 6} ${y + 15}h12`} stroke={NAVY} strokeWidth="3" strokeLinecap="round" />
      : <path d={`M${x - 7} ${y + 12}q7 6 14 0`} stroke={NAVY} strokeWidth="3" strokeLinecap="round" fill="none" />}
    <circle cx={x - 21} cy={y + 11} r="5" fill="#E8A9A0" opacity=".5" /><circle cx={x + 21} cy={y + 11} r="5" fill="#E8A9A0" opacity=".5" />
  </g>
}
const Shine = ({ d }: { d: string }) => <path d={d} stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".55" fill="none" />

// ตัวการ์ตูนแต่ละแบบ (กึ่งกลางประมาณ x=105)
const BODY: Record<Art, ReactNode> = {
  cal: <>
    <rect x="58" y="56" width="94" height="92" rx="16" fill={GOLD} />
    <path d="M58 72a16 16 0 0 1 16-16h62a16 16 0 0 1 16 16v10H58z" fill={NAVY} />
    <rect x="80" y="46" width="8" height="20" rx="4" fill="#B8914A" /><rect x="122" y="46" width="8" height="20" rx="4" fill="#B8914A" />
    <Face x={105} y={104} />
  </>,
  history: <>
    <rect x="62" y="52" width="86" height="104" rx="14" fill={GOLD} />
    <rect x="86" y="44" width="38" height="16" rx="6" fill={NAVY} />
    <Shine d="M74 70v14" />
    <Face x={105} y={98} />
    <path d="M84 136h42M92 145h26" stroke="#B8914A" strokeWidth="4" strokeLinecap="round" />
  </>,
  pin: <>
    <path d="M105 160s-46-40-46-78a46 46 0 0 1 92 0c0 38-46 78-46 78z" fill={GOLD} />
    <Shine d="M74 64c5-9 13-14 22-15" />
    <Face x={105} y={86} />
  </>,
  heart: <>
    <path d="M105 158s-54-32-54-74a28 28 0 0 1 54-12 28 28 0 0 1 54 12c0 42-54 74-54 74z" fill={GOLD} />
    <Shine d="M66 74c2-8 8-13 15-14" />
    <Face x={105} y={96} />
  </>,
  jobs: <>
    <path d="M62 74h86l-10 80a8 8 0 0 1-8 7H80a8 8 0 0 1-8-7z" fill={GOLD} />
    <path d="M66 74c0-24 78-24 78 0" stroke={NAVY} strokeWidth="5" fill="none" />
    <rect x="58" y="68" width="94" height="12" rx="6" fill="#B8914A" />
    <Face x={105} y={108} />
  </>,
  wallet: <>
    <rect x="54" y="66" width="104" height="80" rx="16" fill={GOLD} />
    <path d="M62 66l58-22a6 6 0 0 1 8 4l6 18z" fill={NAVY} />
    <rect x="128" y="92" width="32" height="26" rx="8" fill="#B8914A" /><circle cx="141" cy="105" r="4" fill={NAVY} />
    <Face x={92} y={102} />
  </>,
  search: <>
    <path d="M132 128l26 26" stroke={NAVY} strokeWidth="14" strokeLinecap="round" />
    <circle cx="100" cy="94" r="46" fill={GOLD} />
    <circle cx="100" cy="94" r="46" fill="none" stroke="#B8914A" strokeWidth="6" />
    <Shine d="M72 80c4-10 12-16 22-18" />
    <Face x={100} y={94} />
  </>,
  closed: <>
    <path d="M128 50a52 52 0 1 0 22 80 44 44 0 0 1-22-80z" fill={GOLD} />
    <Shine d="M70 82c3-10 10-18 20-22" />
    <Face x={92} y={102} />
  </>,
  error: <>
    <path d="M70 146a28 28 0 0 1-2-56 36 36 0 0 1 68-10 30 30 0 0 1 8 66z" fill={GOLD} />
    <Shine d="M80 96c3-8 9-12 16-13" />
    <Face x={105} y={112} sad />
  </>,
}

export function EmptyArt({ art, small = false }: { art: Art; small?: boolean }) {
  return <svg className={'zbell' + (small ? ' sm' : '')} viewBox="0 0 220 190" role="img" aria-hidden="true">
    <defs>
      <linearGradient id="ea-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F3E3B8" /><stop offset=".55" stopColor="#D9B871" /><stop offset="1" stopColor="#B8914A" /></linearGradient>
      <radialGradient id="ea-bg" cx=".5" cy=".45" r=".55"><stop offset="0" stopColor="var(--card)" /><stop offset="1" stopColor="var(--foam)" /></radialGradient>
      <radialGradient id="ea-bub" cx=".35" cy=".3" r=".7"><stop offset="0" stopColor="#fff" stopOpacity=".95" /><stop offset="1" stopColor="var(--ocean)" stopOpacity=".12" /></radialGradient>
    </defs>
    <circle cx="105" cy="100" r="74" fill="url(#ea-bg)" />
    <ellipse cx="105" cy="170" rx="46" ry="6" fill="var(--ink)" opacity=".08" />
    <g className="zart-body">{BODY[art]}</g>
    <g className="zbell-z" fill="var(--ink2)" fontFamily="Nunito, sans-serif" fontWeight="800">
      {art !== 'error' && <><text x="158" y="58" fontSize="26" opacity=".7">z</text><text x="178" y="38" fontSize="17" opacity=".45">z</text></>}
    </g>
    <circle className="zbell-bub" cx="34" cy="76" r="8" fill="url(#ea-bub)" stroke="var(--line)" />
    <circle className="zbell-bub b" cx="176" cy="134" r="6" fill="url(#ea-bub)" stroke="var(--line)" />
    <circle className="zbell-bub c" cx="38" cy="134" r="4.5" fill="url(#ea-bub)" stroke="var(--line)" />
    <path d="M52 40l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#D9B871" />
  </svg>
}

// กล่อง "ยังไม่มี…" ทั้งเว็บ: ภาพ + หัวข้อ + คำอธิบาย (ถ้ามี) + ปุ่ม (ถ้ามี)
export function Empty({ art, title, sub, small, children }: { art: Art; title: string; sub?: string; small?: boolean; children?: ReactNode }) {
  return <div className={'empty ntf-empty' + (small ? ' sm' : '')} role="status"><EmptyArt art={art} small={small} /><b>{title}</b>{sub && <small>{sub}</small>}{children}</div>
}
