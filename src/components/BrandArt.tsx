// ภาพวาดแบรนด์คลีนดี (กรมท่า-ทอง + หยดน้ำทองมีประกาย) ใช้ในแบนเนอร์ส่วนลด
const GOLD = 'url(#cd-gold)'

function Defs() {
  return <defs>
    <linearGradient id="cd-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F6DFA8" /><stop offset=".55" stopColor="#C9A96E" /><stop offset="1" stopColor="#9C7A3C" /></linearGradient>
    <linearGradient id="cd-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#24406B" /><stop offset="1" stopColor="#172B4D" /></linearGradient>
    <radialGradient id="cd-glow"><stop offset="0" stopColor="#C9A96E" stopOpacity=".45" /><stop offset="1" stopColor="#C9A96E" stopOpacity="0" /></radialGradient>
  </defs>
}

function Spark({ x, y, s = 1, className = '' }: { x: number; y: number; s?: number; className?: string }) {
  return <path className={className} transform={`translate(${x} ${y}) scale(${s})`} d="M0-10C1-3 3-1 10 0C3 1 1 3 0 10C-1 3-3 1-10 0C-3-1-1-3 0-10Z" fill="#F6DFA8" />
}

// แบนเนอร์ส่วนลด: หยดน้ำทองใหญ่ ใส่ตัวเลขส่วนลด
export function PromoArt({ amount }: { amount: number }) {
  return <svg className="cd-promo-art" viewBox="0 0 160 160" aria-hidden="true">
    <Defs />
    <circle cx="86" cy="86" r="74" fill="url(#cd-glow)" />
    <path d="M84 20c30 35 48 60 48 84a48 48 0 0 1-96 0c0-24 18-49 48-84z" fill={GOLD} />
    <path d="M62 78a40 40 0 0 1 10-18" stroke="#fff" strokeOpacity=".65" strokeWidth="5" strokeLinecap="round" fill="none" />
    <text x="84" y="112" textAnchor="middle" fontSize={amount >= 1000 ? 22 : 30} fontWeight="800" fill="#13294B">{amount}</text>
    <text x="84" y="132" textAnchor="middle" fontSize="13" fontWeight="700" fill="#13294B" opacity=".75">บาท</text>
    <Spark x={128} y={34} s={.9} className="cd-twinkle a" />
    <Spark x={30} y={58} s={.55} className="cd-twinkle c" />
    <circle cx="140" cy="118" r="7" fill="none" stroke="#F6DFA8" strokeOpacity=".6" strokeWidth="1.6" />
  </svg>
}
