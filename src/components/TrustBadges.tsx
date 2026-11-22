import { useEffect, useState } from 'react'
import { money, useI18n, type Key } from '../lib/i18n'
import { sb } from '../lib/supabase'
import { Icon } from './ui'

// ตราความปลอดภัยใกล้ปุ่มจ่ายเงิน: PromptPay · ตรวจสลิปอัตโนมัติ · แม่บ้านตรวจประวัติ · วงเงินชดเชย (อ่านจาก settings)
let capCache: number | null = null
export function TrustBadges() {
  const { t, lang } = useI18n()
  const [cap, setCap] = useState<number | null>(capCache)
  useEffect(() => {
    if (capCache !== null) return
    sb.from('settings').select('claim_cap').maybeSingle<{ claim_cap: number }>().then(({ data }) => { if (data) { capCache = data.claim_cap; setCap(data.claim_cap) } })
  }, [])
  const items: [string, Key][] = [['qr', 'trust_pp'], ['check', 'trust_slip'], ['user', 'trust_maid'], ['shield', 'trust_cap']]
  return <ul className="trust-badges" aria-label={lang === 'th' ? 'ความปลอดภัยในการชำระเงิน' : 'Payment safety'}>
    {items.filter(([, k]) => k !== 'trust_cap' || cap !== null).map(([i, k]) => <li key={k}>
      <span className="trust-ic"><Icon n={i} size={17} /></span>
      <span>{k === 'trust_cap' ? t(k).replace('{cap}', money(cap!)) : t(k)}</span>
    </li>)}
  </ul>
}
