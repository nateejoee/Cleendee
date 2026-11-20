import { sb } from './supabase'

const key = 'cd_booking_attempt'
type Event = 'view' | 'full' | 'alternative' | 'booked'
export async function bookingStep(service: string, event: Event, result?: number, isPackage = false) {
  try {
    let attempt = JSON.parse(sessionStorage.getItem(key) || 'null')
    if (!attempt || attempt.service !== service || Date.now() - attempt.created > 86400000) {
      attempt = { service, token: crypto.randomUUID(), created: Date.now() }
      sessionStorage.setItem(key, JSON.stringify(attempt))
    }
    if (event === 'booked') sessionStorage.removeItem(key)
    await sb.rpc('record_booking_step', { p_token: attempt.token, p_service: service, p_event: event,
      p_result: result ?? null, p_package: isPackage })
  } catch { /* Metrics must never interrupt booking. */ }
}
