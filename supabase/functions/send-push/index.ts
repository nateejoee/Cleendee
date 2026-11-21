// Sends a phone pop-up (Web Push) for one notification row.
// Called by the database (trigger on notifications) with the hook secret; no user token.
// Keys and the hook secret are kept in Supabase Vault and read through public.push_job().
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Job = { title: string; body: string | null; link: string | null; tag: string; subs: { endpoint: string; p256dh: string; auth: string }[]; vapid_public: string; vapid_private: string }

Deno.serve(async req => {
  if (req.method !== 'POST') return reply({ error: 'method' }, 405)
  const secret = req.headers.get('x-push-secret') || ''
  let id: number
  try { id = Number((await req.json()).id) } catch { return reply({ error: 'bad_request' }, 400) }
  if (!secret || !Number.isFinite(id)) return reply({ error: 'bad_request' }, 400)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const { data, error } = await admin.rpc('push_job', { p_id: id, p_secret: secret })
  if (error) return reply({ error: 'forbidden' }, 403)
  const job = data as Job | null
  if (!job || !job.subs.length || !job.vapid_private) return reply({ sent: 0 })

  webpush.setVapidDetails('https://cleendee.pages.dev', job.vapid_public, job.vapid_private)
  const payload = JSON.stringify({ title: job.title, body: job.body || '', link: job.link || '/', tag: job.tag })
  let sent = 0
  await Promise.all(job.subs.map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 })
      sent++
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) await admin.rpc('push_drop_endpoint', { p_endpoint: s.endpoint }) // phone unsubscribed
    }
  }))
  return reply({ sent })
})
