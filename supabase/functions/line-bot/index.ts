// LINE OA CleenDee (@716smhqr)
// 1) LINE webhook: แม่บ้านพิมพ์รหัส 6 หลักจากหน้าแอป เพื่อเชื่อมบัญชี LINE (ตรวจลายเซ็นด้วย channel secret)
// 2) ฐานข้อมูลเรียกพร้อม x-push-secret: ส่งแจ้งเตือน 1 รายการ (งานใหม่ / เตือนงานพรุ่งนี้) ไปที่ LINE ของแม่บ้าน
// รหัสลับทั้งหมดอยู่ใน Supabase Vault อ่านผ่าน public.line_cfg() ด้วย service role
import { createClient } from 'npm:@supabase/supabase-js@2'

const SITE = 'https://cleendee.pages.dev'
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
type Cfg = { token: string; secret: string; hook: string }

async function sign(secret: string, body: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return btoa(String.fromCharCode(...new Uint8Array(mac)))
}
const same = (a: string, b: string) => a.length === b.length && [...a].reduce((d, c, i) => d | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0

async function line(token: string, path: string, payload: unknown) {
  const r = await fetch('https://api.line.me/v2/bot/message/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(payload) })
  return r.ok
}
const text = (t: string) => ({ type: 'text', text: t })

// การ์ดแจ้งเตือนสีกรมท่า/ทอง พร้อมปุ่มเปิดงานในแอป
function card(title: string, body: string | null, link: string | null) {
  return {
    type: 'flex', altText: title + (body ? ' · ' + body : ''),
    contents: {
      type: 'bubble', size: 'kilo',
      header: { type: 'box', layout: 'vertical', backgroundColor: '#13294B', paddingAll: '16px', contents: [
        { type: 'text', text: 'CleenDee', color: '#E3C47E', size: 'xs', weight: 'bold' },
        { type: 'text', text: title, color: '#FFFFFF', size: 'md', weight: 'bold', wrap: true, margin: 'sm' }] },
      body: { type: 'box', layout: 'vertical', paddingAll: '16px', contents: [{ type: 'text', text: body || ' ', size: 'sm', color: '#3B4A5E', wrap: true }] },
      footer: { type: 'box', layout: 'vertical', paddingAll: '12px', contents: [
        { type: 'button', style: 'primary', color: '#13294B', height: 'sm', action: { type: 'uri', label: 'เปิดในแอป', uri: SITE + (link || '/maid') } }] },
    },
  }
}

Deno.serve(async req => {
  if (req.method !== 'POST') return reply({ error: 'method' }, 405)
  const raw = await req.text()
  const { data: cfg, error } = await admin.rpc('line_cfg')
  if (error || !cfg) return reply({ error: 'config' }, 500)
  const c = cfg as Cfg

  // ---- ส่งแจ้งเตือนจากฐานข้อมูล ----
  const hook = req.headers.get('x-push-secret')
  if (hook !== null) {
    if (!c.hook || !same(hook, c.hook)) return reply({ error: 'forbidden' }, 403)
    let id: number
    try { id = Number(JSON.parse(raw).id) } catch { return reply({ error: 'bad_request' }, 400) }
    const { data: job } = await admin.rpc('line_job', { p_id: id })
    const j = job as { to: string; title: string; body: string | null; link: string | null } | null
    if (!j?.to) return reply({ sent: 0 })
    const ok = await line(c.token, 'push', { to: j.to, messages: [card(j.title, j.body, j.link)] })
    return reply({ sent: ok ? 1 : 0 })
  }

  // ---- LINE webhook ----
  const sig = req.headers.get('x-line-signature') || ''
  if (!sig || !same(sig, await sign(c.secret, raw))) return reply({ error: 'bad_signature' }, 401)
  let events: { type: string; replyToken?: string; source?: { userId?: string }; message?: { type: string; text?: string } }[] = []
  try { events = JSON.parse(raw).events || [] } catch { return reply({ ok: true }) }
  for (const e of events) {
    const uid = e.source?.userId, rt = e.replyToken
    if (!uid || !rt) continue
    if (e.type === 'follow') {
      // แม่บ้านที่ล็อกอินแอปด้วย LINE เชื่อมให้อัตโนมัติ
      const { data: r } = await admin.rpc('line_link', { p_uid: uid, p_code: null })
      await line(c.token, 'reply', { replyToken: rt, messages: [text(r === 'linked'
        ? 'สวัสดีค่ะ ขอบคุณที่เพิ่มเพื่อน CleenDee\nเชื่อมบัญชีแม่บ้านของคุณแล้ว ต่อไปจะแจ้งงานใหม่และเตือนงานพรุ่งนี้ที่นี่ค่ะ'
        : 'สวัสดีค่ะ ขอบคุณที่เพิ่มเพื่อน CleenDee\nถ้าคุณเป็นแม่บ้าน CleenDee: เปิดแอป > หน้างาน > "แจ้งเตือนทาง LINE" แล้วพิมพ์รหัส 6 หลักส่งมาที่แชทนี้ได้เลยค่ะ')] })
    } else if (e.type === 'message' && e.message?.type === 'text') {
      const m = (e.message.text || '').trim().match(/^\d{6}$/)
      if (!m) continue // ข้อความอื่นปล่อยให้แอดมินตอบในแชท
      const { data: r } = await admin.rpc('line_link', { p_uid: uid, p_code: m[0] })
      await line(c.token, 'reply', { replyToken: rt, messages: [text(r === 'linked'
        ? 'เชื่อมบัญชีแม่บ้านเรียบร้อยแล้วค่ะ ✓\nต่อไป CleenDee จะแจ้งงานใหม่และเตือนงานพรุ่งนี้ที่แชทนี้'
        : 'รหัสไม่ถูกต้องหรือหมดอายุแล้วค่ะ กรุณาขอรหัสใหม่ในแอป (รหัสใช้ได้ 30 นาที)')] })
    }
  }
  return reply({ ok: true })
})
