// เอฟเฟกต์เนื้อหาค่อยๆ ลอยขึ้นตอนเลื่อนถึง (ทั้งเว็บ) — เฉพาะส่วนที่ยังไม่อยู่ในจอตอนโหลด จึงไม่กระพริบตอนเปิดหน้า
// ปิดเองเมื่อเครื่องตั้งค่า "ลดการเคลื่อนไหว" หรือเบราว์เซอร์ไม่รองรับ IntersectionObserver
const SEL = '[data-reveal], .dkh-head, .dkh-maids, .dkh-steps, .dkh-g, .dkh-more, .home .gx-grid, .home .maid-rail, .home .trust-card, .home .home-booking-steps, .rw-tabs-card, .rw-how'
export function startReveal() {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('rv-in'); io.unobserve(e.target) }
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })
  const seen = new WeakSet<Element>()
  const scan = () => document.querySelectorAll(SEL).forEach(el => {
    if (seen.has(el)) return; seen.add(el)
    const r = el.getBoundingClientRect()
    if (r.top < window.innerHeight * 0.92) return // อยู่ในจอแล้ว แสดงทันที
    el.classList.add('rv'); io.observe(el)
  })
  let t = 0
  new MutationObserver(() => { cancelAnimationFrame(t); t = requestAnimationFrame(scan) }).observe(document.body, { childList: true, subtree: true })
  scan()
}
