import { useCallback, useEffect, useState } from 'react'
import { sb } from './supabase'
import { useAuth } from './auth'

// Public half of the Web Push key pair (the private half is in Supabase Vault)
const VAPID_PUBLIC = 'BKpr1xOFxnGcMSWRsMJNB4dWPC7rsf6AagEcEzhD2BJouBUiyhKbu9cksYjKNey68BY9nCKcp5L0NaQ289dhasY'

export type Notice = { id: number; kind: string; title_th: string; title_en: string; body_th: string | null; body_en: string | null; link: string | null; created_at: string; read_at: string | null }

// unread count for the bell, refreshed every 30 seconds and when the tab comes back
const listeners = new Set<() => void>()
export const refreshUnread = () => listeners.forEach(f => f())
export function useUnread() {
  const { session } = useAuth(); const [n, setN] = useState(0)
  const load = useCallback(() => {
    if (!session) { setN(0); return }
    sb.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', session.user.id).is('read_at', null)
      .then(({ count }) => setN(count || 0))
  }, [session])
  useEffect(() => {
    load(); listeners.add(load)
    const iv = setInterval(load, 30000); const vis = () => { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', vis)
    return () => { listeners.delete(load); clearInterval(iv); document.removeEventListener('visibilitychange', vis) }
  }, [load])
  return n
}

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
}

export type PushState = 'unsupported' | 'ios_needs_install' | 'denied' | 'off' | 'on'
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

export async function pushState(): Promise<PushState> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return isIOS() && !standalone() ? 'ios_needs_install' : 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

const b64 = (s: string) => { const p = '='.repeat((4 - s.length % 4) % 4); const raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, c => c.charCodeAt(0)) }

// asks permission (must come from a tap), subscribes this device and saves it
export async function enablePush(): Promise<PushState> {
  const st = await pushState(); if (st === 'unsupported' || st === 'ios_needs_install' || st === 'denied') return st
  if (await Notification.requestPermission() !== 'granted') return Notification.permission === 'denied' ? 'denied' : 'off'
  const reg = await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID_PUBLIC) })
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  const { error } = await sb.rpc('save_push_subscription', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth })
  if (error) throw error
  return 'on'
}
export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js'); const sub = await reg?.pushManager.getSubscription()
  if (sub) { await sb.rpc('remove_push_subscription', { p_endpoint: sub.endpoint }); await sub.unsubscribe() }
  return 'off'
}
