// ภาพวาดแบรนด์คลีนดี (กรมท่า-ทอง + หยดน้ำทองมีประกาย) ใช้แทนรูปถ่ายวิลล่า
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

// หัวหน้าแรก: บ้านเส้นทอง หน้าต่างเป็นประกาย หยดน้ำทอง และฟองสบู่ลอย
export function HeroArt() {
  return <svg className="cd-hero-art" viewBox="0 0 420 320" aria-hidden="true">
    <Defs />
    <circle cx="250" cy="150" r="150" fill="url(#cd-glow)" />
    <g className="cd-float a"><circle cx="92" cy="96" r="16" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="2" /><circle cx="86" cy="90" r="4" fill="#fff" fillOpacity=".5" /></g>
    <g className="cd-float b"><circle cx="372" cy="70" r="11" fill="none" stroke="#fff" strokeOpacity=".3" strokeWidth="2" /></g>
    <g className="cd-float c"><circle cx="140" cy="40" r="7" fill="none" stroke="#F6DFA8" strokeOpacity=".55" strokeWidth="1.6" /></g>
    {/* บ้าน */}
    <path d="M150 168 L250 92 L350 168" fill="none" stroke={GOLD} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="170" y="160" width="160" height="118" rx="16" fill="url(#cd-wall)" stroke={GOLD} strokeWidth="3" />
    <rect x="236" y="214" width="34" height="64" rx="8" fill="#0E1C33" stroke={GOLD} strokeWidth="2.5" />
    <circle cx="263" cy="248" r="2.6" fill="#F6DFA8" />
    <rect x="190" y="182" width="34" height="30" rx="7" fill="#0E1C33" stroke={GOLD} strokeWidth="2.5" />
    <rect x="282" y="182" width="34" height="30" rx="7" fill="#0E1C33" stroke={GOLD} strokeWidth="2.5" />
    <Spark x={207} y={197} s={.85} className="cd-twinkle a" />
    <Spark x={299} y={197} s={.6} className="cd-twinkle b" />
    <path d="M120 282 H380" stroke="#C9A96E" strokeOpacity=".35" strokeWidth="2" strokeLinecap="round" />
    {/* หยดน้ำทอง */}
    <g className="cd-float d">
      <path d="M352 150c16 19 27 34 27 48a27 27 0 0 1-54 0c0-14 11-29 27-48z" fill={GOLD} />
      <path d="M340 186a20 20 0 0 1 5-11" stroke="#fff" strokeOpacity=".7" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <Spark x={378} y={146} s={.75} className="cd-twinkle c" />
    </g>
    <Spark x={128} y={150} s={.7} className="cd-twinkle b" />
  </svg>
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
