import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { sb, type Profile } from './supabase'

type Ctx = { session: Session | null; profile: Profile | null; ready: boolean; refresh: () => Promise<void> }
const AuthCtx = createContext<Ctx>({ session: null, profile: null, ready: false, refresh: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [ready, setReady] = useState(false)

  const load = useCallback(async (s: Session | null) => {
    setSession(s)
    if (s) {
      const { data } = await sb.from('profiles').select('*').eq('id', s.user.id).maybeSingle()
      setProfile(data as Profile | null)
    } else setProfile(null)
    setReady(true)
  }, [])

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => load(data.session))
    const { data: sub } = sb.auth.onAuthStateChange((e, s) => {
      load(s)
      // บันทึกการเข้าสู่ระบบของแอดมินลง log หลังบ้าน (เซิร์ฟเวอร์บันทึกเฉพาะแอดมิน)
      if (e === 'SIGNED_IN') setTimeout(() => { sb.rpc('log_admin_login').then(() => {}, () => {}) }, 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [load])

  const refresh = useCallback(async () => { const { data } = await sb.auth.getSession(); await load(data.session) }, [load])
  return <AuthCtx.Provider value={{ session, profile, ready, refresh }}>{children}</AuthCtx.Provider>
}
export const useAuth = () => useContext(AuthCtx)
