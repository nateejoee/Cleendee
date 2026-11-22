// รูปสำรองของแม่บ้านที่ยังไม่มีรูปจริง: ภาพเงาคนใส่เสื้อโปโลคลีนดี (ใช้แทนตัวอักษรย่อ)
// พื้นหลังสีอ่อนเปลี่ยนตาม id แม่บ้าน เพื่อให้การ์ดแต่ละใบไม่ซ้ำกันหมด
const BG = [['#E8EFF8', '#D3DFEF'], ['#F7F0E1', '#ECDDBC'], ['#E4F2EB', '#CBE4D7'], ['#EEE8F6', '#DDD2EC'], ['#F8EAE4', '#EED4C9']]

export function MaidSilhouette({ seed, round = false }: { seed: string; round?: boolean }) {
  const [a, b] = BG[[...seed].reduce((s, c) => s + c.charCodeAt(0), 0) % BG.length]
  const g = 'msg' + seed.replace(/\W/g, '').slice(0, 8)
  return <svg className={'maid-sil' + (round ? ' round' : '')} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id={g} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient></defs>
    <rect width="100" height="100" fill={`url(#${g})`} />
    {/* ผมมวย + ศีรษะ + คอ */}
    <circle cx="50" cy="17" r="7" fill="#8E9BB0" />
    <circle cx="50" cy="33" r="13.5" fill="#A7B3C6" />
    <path d="M36.6 31.5c0-8.4 6-14 13.4-14s13.4 5.6 13.4 14c-3.3-4.6-8-6.9-13.4-6.9s-10.1 2.3-13.4 6.9z" fill="#8E9BB0" />
    <path d="M44.5 44h11v8h-11z" fill="#A7B3C6" />
    {/* เสื้อโปโลสีกรมท่า ปกขาว และโลโก้บ้านสีทองที่หน้าอก */}
    <path d="M16 100c0-24 12-41 25-45l9 6 9-6c13 4 25 21 25 45z" fill="#2B4170" />
    <path d="M41 55l9 9.5 9-9.5-3.2-2.4L50 58.6l-5.8-6z" fill="#fff" />
    <path d="M50 64.5v12" stroke="#22355E" strokeWidth="1.3" />
    <path d="M60.5 69.5l4.5-3.6 4.5 3.6M61.8 68.6v4.4h6.4v-4.4" fill="none" stroke="#E2B65A" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}
