// Checks a PromptPay slip with SlipOK right after the customer uploads it.
// Needs two secrets set in Supabase: SLIPOK_API_KEY and SLIPOK_BRANCH_ID.
// Without them (or if SlipOK is down) the payment simply stays pending for the admin, as before.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// SlipOK codes that mean "this slip is wrong" -> reject so the customer can upload the right one
const REJECT: Record<number, string> = { 1005: 'not_image', 1006: 'bad_image', 1007: 'no_qr', 1008: 'not_payment_qr', 1012: 'duplicate_slip', 1013: 'amount_mismatch', 1014: 'wrong_receiver' }
// codes that are about the bank or our SlipOK account -> leave for the admin
const PENDING: Record<number, string> = { 1001: 'slipok_branch', 1002: 'slipok_key', 1003: 'slipok_expired', 1004: 'slipok_quota', 1009: 'bank_down', 1010: 'bank_delay', 1011: 'not_found_yet', 1015: 'slipok_package' }

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply({ error: 'method' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  // who is calling
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  const { data: u } = await admin.auth.getUser(jwt)
  if (!u?.user) return reply({ error: 'not_signed_in' }, 401)

  let body: { kind?: string; id?: number }
  try { body = await req.json() } catch { return reply({ error: 'bad_request' }, 400) }
  const id = Number(body.id)
  if (!['booking', 'package'].includes(String(body.kind)) || !Number.isFinite(id)) return reply({ error: 'bad_request' }, 400)

  // the caller's latest pending slip for that booking / package
  const owner = body.kind === 'booking'
    ? await admin.from('bookings').select('customer_id,created_at').eq('id', id).maybeSingle()
    : await admin.from('packages').select('customer_id,created_at').eq('id', id).maybeSingle()
  if (!owner.data || owner.data.customer_id !== u.user.id) return reply({ error: 'forbidden' }, 403)
  const { data: pay } = await admin.from('payments').select('id,amount,slip_path,status')
    .eq(body.kind === 'booking' ? 'booking_id' : 'package_id', id).eq('status', 'pending')
    .order('id', { ascending: false }).limit(1).maybeSingle()
  if (!pay) return reply({ status: 'not_pending' })

  const record = async (result: 'approve' | 'reject' | 'pending', ref: string | null, note: string) => {
    const { data, error } = await admin.rpc('record_slip_check', { p_payment_id: pay.id, p_result: result, p_trans_ref: ref, p_note: note })
    return reply({ status: error ? 'pending' : data, reason: note })
  }

  const key = Deno.env.get('SLIPOK_API_KEY'), branch = Deno.env.get('SLIPOK_BRANCH_ID')
  if (!key || !branch) return reply({ status: 'pending', reason: 'not_configured' })

  const file = await admin.storage.from('slips').download(pay.slip_path)
  if (file.error || !file.data) return record('pending', null, 'slip_missing')

  const form = new FormData()
  form.append('files', file.data, 'slip.jpg')
  form.append('log', 'true')
  form.append('amount', String(pay.amount))

  let res: Response, out: { success?: boolean; code?: number; data?: Record<string, unknown> }
  try {
    res = await fetch(`https://api.slipok.com/api/line/apikey/${encodeURIComponent(branch)}`, { method: 'POST', headers: { 'x-authorization': key }, body: form, signal: AbortSignal.timeout(20000) })
    out = await res.json()
  } catch { return record('pending', null, 'slipok_unreachable') }

  if (res.ok && out.success && out.data?.success) {
    const d = out.data as { transRef?: string; amount?: number; transDate?: string; transTime?: string; transTimestamp?: string }
    if (Number(d.amount) !== Number(pay.amount)) return record('reject', null, 'amount_mismatch')
    // a slip from before the booking was made is suspicious -> admin decides
    const when = d.transTimestamp ? new Date(d.transTimestamp)
      : d.transDate && d.transTime ? new Date(`${d.transDate.slice(0, 4)}-${d.transDate.slice(4, 6)}-${d.transDate.slice(6, 8)}T${d.transTime}+07:00`) : null
    if (when && !isNaN(+when) && +when < +new Date(owner.data.created_at) - 10 * 60 * 1000) return record('pending', null, 'old_slip')
    return record('approve', d.transRef || null, 'slipok_ok')
  }
  const code = Number(out.code)
  if (REJECT[code]) return record('reject', null, REJECT[code])
  return record('pending', null, PENDING[code] || 'slipok_' + (code || res.status))
})
