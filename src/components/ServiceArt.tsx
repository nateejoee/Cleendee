import { useId, type ReactNode } from 'react'

// ภาพประกอบบริการแบบมีมิติ (แนว Grab): สีสด มีไล่เฉด มีเงาใต้ชิ้น วาดเองทั้งหมด ไม่ใช้รูปจากที่อื่น
type Art = (g: (n: string) => string) => ReactNode

const shadow = <ellipse cx="32" cy="56" rx="18" ry="3.2" fill="#0B1F3A" opacity=".14" />

const ART: Record<string, Art> = {
  // สเปรย์ + ฟองน้ำ + ประกาย
  general_cleaning: g => <>
    <defs>
      <linearGradient id={g('b')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5EC8F2" /><stop offset="1" stopColor="#1C7FC4" /></linearGradient>
      <linearGradient id={g('s')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFE07A" /><stop offset="1" stopColor="#F2B02E" /></linearGradient>
    </defs>
    {shadow}
    <path d="M22 14h10l2 6H20z" fill="#fff" stroke="#CFE3F2" />
    <path d="M32 15h7l-1 3h-6z" fill="#E9F3FA" />
    <rect x="18" y="20" width="18" height="34" rx="6" fill={`url(#${g('b')})`} />
    <rect x="21" y="27" width="4" height="20" rx="2" fill="#fff" opacity=".45" />
    <rect x="33" y="40" width="20" height="13" rx="4" fill={`url(#${g('s')})`} />
    <rect x="33" y="40" width="20" height="5" rx="2.5" fill="#3BB37A" />
    <path d="M47 14l1.6 3.6L52 19l-3.4 1.4L47 24l-1.6-3.6L42 19l3.4-1.4z" fill="#FFD25A" />
    <circle cx="52" cy="30" r="2" fill="#9ADCF8" />
  </>,
  // บ้านเงาวับ + ฟอง
  deep_cleaning: g => <>
    <defs>
      <linearGradient id={g('w')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#E3ECF5" /></linearGradient>
      <linearGradient id={g('r')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FF8A6B" /><stop offset="1" stopColor="#E0533A" /></linearGradient>
    </defs>
    {shadow}
    <rect x="15" y="29" width="32" height="25" rx="3" fill={`url(#${g('w')})`} stroke="#CBD8E4" />
    <path d="M11 31 31 14l20 17" fill="none" stroke={`url(#${g('r')})`} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="26" y="40" width="10" height="14" rx="2" fill="#2B5D8F" />
    <rect x="18" y="35" width="6" height="6" rx="1.5" fill="#8ED3F5" />
    <rect x="38" y="35" width="6" height="6" rx="1.5" fill="#8ED3F5" />
    <circle cx="50" cy="44" r="5" fill="#BDE9FB" opacity=".9" /><circle cx="48.5" cy="42.5" r="1.4" fill="#fff" />
    <circle cx="55" cy="35" r="3" fill="#BDE9FB" opacity=".9" />
    <path d="M51 10l1.4 3.2 3.2 1.4-3.2 1.4L51 19.2l-1.4-3.2-3.2-1.4 3.2-1.4z" fill="#FFD25A" />
  </>,
  // อาคารสำนักงาน
  office_cleaning: g => <>
    <defs><linearGradient id={g('o')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8B7CF6" /><stop offset="1" stopColor="#5A45C9" /></linearGradient></defs>
    {shadow}
    <rect x="16" y="12" width="22" height="42" rx="3" fill={`url(#${g('o')})`} />
    <rect x="38" y="26" width="12" height="28" rx="2" fill="#C9C1FB" />
    {[18, 26, 34, 42].map(y => <g key={y}><rect x="20" y={y} width="5" height="4" rx="1" fill="#E7E3FF" /><rect x="29" y={y} width="5" height="4" rx="1" fill="#E7E3FF" /></g>)}
    <rect x="41" y="31" width="6" height="3" rx="1" fill="#fff" opacity=".8" /><rect x="41" y="38" width="6" height="3" rx="1" fill="#fff" opacity=".8" />
    <rect x="24" y="48" width="6" height="6" rx="1" fill="#3B2C99" />
  </>,
  // เตารีด + ไอน้ำ
  ironing: g => <>
    <defs><linearGradient id={g('i')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFA26B" /><stop offset="1" stopColor="#E86A2C" /></linearGradient></defs>
    {shadow}
    <path d="M12 50c0-12 9-20 22-20h16v20z" fill={`url(#${g('i')})`} />
    <rect x="10" y="49" width="42" height="5" rx="2.5" fill="#C9D3DD" />
    <path d="M33 31v-3c0-5 4-8 9-8h4a4 4 0 0 1 4 4v7" fill="none" stroke="#5A6B7B" strokeWidth="4" strokeLinecap="round" />
    <circle cx="40" cy="40" r="3" fill="#fff" opacity=".85" />
    <path d="M18 22c-2-3 2-5 0-8M24 20c-2-3 2-5 0-8" fill="none" stroke="#9FC9E6" strokeWidth="2.2" strokeLinecap="round" />
  </>,
  // ปฏิทินพร้อมเครื่องหมายถูก
  monthly: g => <>
    <defs><linearGradient id={g('c')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F0C86A" /><stop offset="1" stopColor="#C9973A" /></linearGradient></defs>
    {shadow}
    <rect x="12" y="16" width="40" height="38" rx="6" fill="#fff" stroke="#E5DCC8" />
    <path d="M12 22a6 6 0 0 1 6-6h28a6 6 0 0 1 6 6v6H12z" fill={`url(#${g('c')})`} />
    <rect x="20" y="11" width="4" height="10" rx="2" fill="#13294B" /><rect x="40" y="11" width="4" height="10" rx="2" fill="#13294B" />
    {[34, 43].map(y => [18, 27, 36].map(x => <rect key={x + '-' + y} x={x} y={y} width="6" height="5" rx="1.5" fill="#EFE8D8" />))}
    <circle cx="46" cy="46" r="9" fill="#2FAE72" /><path d="m42 46 3 3 5-6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </>,
  // หัวใจ + ลูกศรวน (จองคนเดิม)
  rebook: g => <>
    <defs><linearGradient id={g('h')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FF7EA6" /><stop offset="1" stopColor="#E23D6E" /></linearGradient></defs>
    {shadow}
    <path d="M32 52S12 40 12 26a10 10 0 0 1 20-3 10 10 0 0 1 20 3c0 14-20 26-20 26z" fill={`url(#${g('h')})`} />
    <path d="M20 24a5 5 0 0 1 5-5" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".7" />
    <circle cx="47" cy="45" r="9" fill="#fff" stroke="#F6C8D6" />
    <path d="M43 45a4 4 0 1 0 1.3-3M43 40v3h3" fill="none" stroke="#E23D6E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </>,
  // แอร์ + ลมเย็น
  ac_cleaning: () => <>
    {shadow}
    <rect x="8" y="14" width="48" height="20" rx="6" fill="#fff" stroke="#CFDCE8" />
    <rect x="12" y="27" width="40" height="3" rx="1.5" fill="#B8CADB" />
    <circle cx="48" cy="20" r="2" fill="#38C172" />
    <path d="M20 40c-2 4 2 6 0 10M32 40c-2 4 2 6 0 10M44 40c-2 4 2 6 0 10" fill="none" stroke="#6CC3F0" strokeWidth="2.6" strokeLinecap="round" />
  </>,
  // โซฟา
  sofa_cleaning: g => <>
    <defs><linearGradient id={g('f')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4FB6A8" /><stop offset="1" stopColor="#24877A" /></linearGradient></defs>
    {shadow}
    <rect x="14" y="20" width="36" height="18" rx="6" fill="#6FCDBF" />
    <rect x="8" y="30" width="48" height="18" rx="7" fill={`url(#${g('f')})`} />
    <rect x="16" y="32" width="32" height="8" rx="4" fill="#8EDACE" />
    <rect x="12" y="47" width="4" height="7" rx="2" fill="#7A5A3A" /><rect x="48" y="47" width="4" height="7" rx="2" fill="#7A5A3A" />
  </>,
  // ที่นอน
  mattress_cleaning: g => <>
    <defs><linearGradient id={g('m')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#B89CF5" /><stop offset="1" stopColor="#8366D9" /></linearGradient></defs>
    {shadow}
    <rect x="8" y="18" width="8" height="34" rx="3" fill="#7A5A3A" />
    <rect x="12" y="32" width="44" height="14" rx="5" fill={`url(#${g('m')})`} />
    <rect x="16" y="25" width="14" height="9" rx="4" fill="#fff" stroke="#E1D8F7" />
    <rect x="12" y="44" width="44" height="4" rx="2" fill="#6B4FC0" />
    <rect x="52" y="44" width="4" height="10" rx="2" fill="#7A5A3A" />
  </>,
}

// สีพื้นของช่องไอคอน — อ่อนแบบพาสเทล
export const ART_TINT: Record<string, string> = {
  general_cleaning: '#E3F4FB', deep_cleaning: '#FDECE6', office_cleaning: '#EEEBFE', ironing: '#FFF0E5',
  monthly: '#FBF3DE', rebook: '#FDE9EF', ac_cleaning: '#E6F4FC', sofa_cleaning: '#E2F5F1', mattress_cleaning: '#F1ECFD',
}

export function ServiceArt({ code, size = 56 }: { code: string; size?: number }) {
  const id = useId().replace(/:/g, '')
  const draw = ART[code] ?? ART.general_cleaning
  return <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">{draw(n => id + n)}</svg>
}
