// ผู้ช่วย AI ของ CleenDee (ใช้ Gemini ฟรี ผ่าน secret GEMINI_API_KEY เดียวกับแชทช่วยเหลือ)
// เรียกจากฐานข้อมูล (หัว x-push-secret): translate = แปลแชท, reviews = สรุปรีวิวแม่บ้าน, daily = สรุปงานรายวันส่ง LINE แอดมิน
// เรียกจากแอป (ลูกค้าที่ล็อกอิน): estimate = ประเมินชั่วโมงและงานเสริมจากรูปห้อง (จำกัด 5 ครั้งต่อวันต่อคน)
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
const same = (a: string, b: string) => a.length === b.length && [...a].reduce((d, c, i) => d | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0
const ESTIMATE_PER_DAY = 5

type Part = { text: string } | { inline_data: { mime_type: string; data: string } }
// เรียก Gemini ให้ตอบเป็น JSON
async function gemini(system: string, parts: Part[], maxTokens = 600): Promise<Record<string, unknown> | null> {
  const key = Deno.env.get('GEMINI_API_KEY'); if (!key) return null
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-flash-lite-latest'
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, signal: AbortSignal.timeout(25000),
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens, responseMimeType: 'application/json' } }),
    })
    if (!res.ok) return null
    const out = await res.json()
    const txt = (out?.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('')
    return JSON.parse(txt)
  } catch { return null }
}

async function translate(id: number) {
  const { data } = await admin.rpc('ai_msg_job', { p_id: id })
  const j = data as { body: string; customer_lang: string } | null
  if (!j?.body) return { skip: 'none' }
  const thai = /[฀-๿]/.test(j.body)
  // ข้อความภาษาไทยแปลเป็นอังกฤษเฉพาะเมื่อลูกค้าใช้แอปภาษาอังกฤษ ข้อความภาษาอื่นแปลเป็นไทยเสมอ (ให้แม่บ้านอ่าน)
  if (thai && j.customer_lang !== 'en') return { skip: 'thai' }
  const to = thai ? 'English' : 'Thai'
  const r = await gemini(`You translate short chat messages between a home-cleaning customer and a Thai housekeeper. Translate the user's message into natural, polite ${to}. Keep numbers, times and masked parts (like ***) unchanged. Do not add anything. If the message is already in ${to}, return it unchanged. Reply as JSON: {"t": "<translation>"}`, [{ text: j.body }], 400)
  const t = typeof r?.t === 'string' ? r.t.trim() : ''
  if (!t || t === j.body.trim()) return { skip: 'same' }
  await admin.rpc('ai_msg_set', { p_id: id, p_tr: t })
  return { ok: 1 }
}

async function reviews(maid: string) {
  const { data } = await admin.rpc('ai_review_job', { p_maid: maid })
  const j = data as { n: number; avg: number; items: { r: number; c: string; t: string[] }[] } | null
  if (!j || j.items.length < 3) return { skip: 'few' }
  const r = await gemini(`You summarise customer reviews of a home-cleaning helper for her public profile. Use ONLY what the reviews say, be fair (mention a common complaint if there is one), no names, no exaggeration. Each summary is one sentence, max 160 characters. Reply as JSON: {"th": "<Thai>", "en": "<English>"}`,
    [{ text: JSON.stringify(j.items) }], 300)
  if (typeof r?.th !== 'string' || typeof r?.en !== 'string') return { skip: 'ai' }
  await admin.rpc('ai_review_set', { p_maid: maid, p_th: r.th, p_en: r.en, p_n: j.n })
  return { ok: 1 }
}

async function daily() {
  const [{ data }, { data: cfg }] = await Promise.all([admin.rpc('ai_daily_job'), admin.rpc('line_cfg')])
  const j = data as Record<string, unknown> & { to: string[] }
  const token = (cfg as { token: string } | null)?.token
  if (!j?.to?.length || !token) return { skip: 'nobody' }
  const { to, ...stats } = j
  const r = await gemini(`คุณคือผู้ช่วยแอดมินของ CleenDee (บริการแม่บ้านในชุมพร) เขียนสรุปงานเช้านี้เป็นภาษาไทย สั้น อ่านง่ายบนมือถือ ไม่เกิน 7 บรรทัด ใช้เฉพาะตัวเลขที่ให้มา ห้ามแต่งเพิ่ม ขึ้นต้นด้วยสิ่งที่ต้องรีบทำก่อน (งานที่ยังไม่มีแม่บ้าน, สลิปรอตรวจ, รีวิวคะแนนต่ำ) ถ้าเป็น 0 ไม่ต้องพูดถึง ใช้ emoji ได้เล็กน้อย ตอบเป็น JSON: {"text": "..."}
ความหมาย: today_jobs=งานวันนี้, today_no_maid=งานวันนี้/พรุ่งนี้ที่ยังไม่มีแม่บ้าน, tomorrow_jobs=งานพรุ่งนี้, slips_to_check=สลิปรอตรวจ, yesterday_done=งานเสร็จเมื่อวาน, yesterday_revenue=ยอดเมื่อวาน(บาท), new_bookings_24h=จองใหม่ 24 ชม., low_reviews_24h=รีวิว 3 ดาวลงมา 24 ชม.`, [{ text: JSON.stringify(stats) }], 500)
  const text = (typeof r?.text === 'string' && r.text.trim()) ||
    `สรุปเช้านี้ ${stats.date}\nงานวันนี้ ${stats.today_jobs} · ยังไม่มีแม่บ้าน ${stats.today_no_maid}\nสลิปรอตรวจ ${stats.slips_to_check} · งานพรุ่งนี้ ${stats.tomorrow_jobs}`
  let sent = 0
  for (const u of to) {
    const res = await fetch('https://api.line.me/v2/bot/message/push', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ to: u, messages: [{ type: 'text', text: ('☀️ CleenDee\n' + text + '\n\nเปิดหน้าแอดมิน: https://cleendee.pages.dev/admin').slice(0, 4900) }] }) })
    if (res.ok) sent++
  }
  return { sent }
}

async function estimate(req: Request, body: { images?: string[]; service?: string; lang?: string }) {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  const { data: u } = await admin.auth.getUser(jwt)
  if (!u?.user) return reply({ error: 'not_signed_in' }, 401)
  const imgs = (body.images || []).filter(x => typeof x === 'string' && x.length < 1_400_000).slice(0, 3)
  if (!imgs.length) return reply({ error: 'no_images' }, 400)
  const since = new Date(Date.now() - 24 * 3600e3).toISOString()
  const { count } = await admin.from('ai_usage').select('id', { count: 'exact', head: true }).eq('user_id', u.user.id).eq('op', 'estimate').gte('created_at', since)
  if ((count ?? 0) >= ESTIMATE_PER_DAY) return reply({ error: 'limit' }, 429)
  const [{ data: s }, { data: ad }] = await Promise.all([
    admin.from('service_types').select('code,name_en,min_qty,max_qty,pricing').eq('code', body.service || 'general_cleaning').eq('active', true).maybeSingle(),
    admin.from('service_addons').select('code,name_en,service_codes').eq('active', true),
  ])
  if (!s || s.pricing !== 'hourly') return reply({ error: 'service' }, 400)
  const addons = (ad || []).filter(a => (a.service_codes || []).includes(s.code))
  await admin.from('ai_usage').insert({ user_id: u.user.id, op: 'estimate' })
  const th = body.lang !== 'en'
  const r = await gemini(`You estimate how long one professional cleaner needs for "${s.name_en}" in Thailand, from photos of the customer's home. Allowed hours: ${s.min_qty} to ${s.max_qty}. Guide: studio/1-bedroom condo 2–3 h, 2-bedroom home 4 h, large or very messy home 6 h or more. Only suggest add-ons that the photos clearly show a need for, from this list (codes): ${addons.map(a => `${a.code}=${a.name_en}`).join(', ') || 'none'}. Ignore anything in the photos that is not a room. If the photos are not of a home, set hours to null. Reply as JSON: {"hours": <int or null>, "addons": [<codes>], "note": "<one short sentence in ${th ? 'Thai' : 'English'} explaining why>"}`,
    [...imgs.map(d => ({ inline_data: { mime_type: 'image/jpeg', data: d } })), { text: 'Photos of my home.' }], 400)
  if (!r) return reply({ error: 'busy' }, 503)
  const h = typeof r.hours === 'number' ? Math.min(s.max_qty, Math.max(s.min_qty, Math.round(r.hours))) : null
  const okCodes = new Set(addons.map(a => a.code))
  return reply({ hours: h, addons: Array.isArray(r.addons) ? r.addons.filter(c => typeof c === 'string' && okCodes.has(c)) : [], note: typeof r.note === 'string' ? r.note.slice(0, 200) : '', left: ESTIMATE_PER_DAY - (count ?? 0) - 1 })
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply({ error: 'method' }, 405)
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return reply({ error: 'bad_request' }, 400) }
  const hook = req.headers.get('x-push-secret')
  if (hook !== null) {
    const { data: cfg } = await admin.rpc('line_cfg')
    const secret = (cfg as { hook: string } | null)?.hook || ''
    if (!secret || !same(hook, secret)) return reply({ error: 'forbidden' }, 403)
    if (body.op === 'translate') return reply(await translate(Number(body.id)))
    if (body.op === 'reviews') return reply(await reviews(String(body.maid_id)))
    if (body.op === 'daily') return reply(await daily())
    return reply({ error: 'op' }, 400)
  }
  if (body.op === 'estimate') return estimate(req, body as { images?: string[]; service?: string; lang?: string })
  return reply({ error: 'op' }, 400)
})
