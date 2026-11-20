import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { sb, friendly } from '../lib/supabase'
import { useI18n, fmtDate, type Key } from '../lib/i18n'
import { useAuth } from '../lib/auth'

// Two-way ratings in the style of Grab / LINE MAN / Bolt.
// side 'customer' = the customer rates the helper; side 'maid' = the helper rates the customer.
export type RateSide = 'customer' | 'maid'
const TAGS: Record<RateSide, { good: Key[]; bad: Key[] }> = {
  customer: { good: ['r_ontime', 'r_clean', 'r_polite', 'r_detail', 'r_fast', 'r_value'], bad: ['rb_late', 'rb_notclean', 'rb_missed', 'rb_rude', 'rb_damage', 'rb_early'] },
  maid: { good: ['rc_access', 'rc_kind', 'rc_clear', 'rc_asdesc'], bad: ['rcb_noshow', 'rcb_morework', 'rcb_rude', 'rcb_pet', 'rcb_unsafe'] },
}
const STAR_WORD: Key[] = ['rt_s1', 'rt_s2', 'rt_s3', 'rt_s4', 'rt_s5']

export function RatingForm({ bookingId, side, name, onDone, onSkip }: { bookingId: number; side: RateSide; name: string; onDone: () => void; onSkip?: () => void }) {
  const { t, lang } = useI18n()
  const [r, setR] = useState(0); const [tags, setTags] = useState<string[]>([]); const [c, setC] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const opts = r === 0 ? [] : r >= 4 ? TAGS[side].good : TAGS[side].bad
  const pickStar = (i: number) => { if ((i >= 4) !== (r >= 4)) setTags([]); setR(i) }
  const send = async () => {
    if (busy || !r) return
    setBusy(true); setErr('')
    const { error } = await sb.rpc(side === 'customer' ? 'submit_review' : 'submit_customer_review', { p_booking_id: bookingId, p_rating: r, p_tags: tags, p_comment: c })
    setBusy(false)
    if (error) setErr(friendly(error, lang)); else onDone()
  }
  return <div className="rate stack">
    <b className="disp rate-q">{t(side === 'customer' ? 'rt_q_maid' : 'rt_q_cust').replace('{n}', name)}</b>
    <div className="stars">{[1, 2, 3, 4, 5].map(i => <button key={i} type="button" className={i <= r ? 'on' : ''} onClick={() => pickStar(i)} aria-label={lang === 'th' ? i + ' ดาว' : i + ' stars'} aria-pressed={i === r}>★</button>)}</div>
    <div className="rate-word" aria-live="polite">{r ? t(STAR_WORD[r - 1]) : t('rt_tap')}</div>
    {r > 0 && <>
      <div className="small muted">{t(r >= 4 ? 'rt_good_q' : 'rt_bad_q')}</div>
      <div className="chips" style={{ justifyContent: 'center' }}>{opts.map(o => <button key={o} type="button" className={'chip' + (tags.includes(o) ? ' on' : '')} aria-pressed={tags.includes(o)} onClick={() => setTags(tags.includes(o) ? tags.filter(x => x !== o) : [...tags, o])}>{t(o)}</button>)}</div>
      <textarea className="input" placeholder={t(r >= 4 ? 'review_ph' : 'rt_bad_ph')} value={c} onChange={e => setC(e.target.value)} maxLength={500} />
      {r <= 2 && <div className="infonote small">{t(side === 'customer' ? 'rt_low_cust' : 'rt_low_maid').replace('{n}', name)}</div>}
    </>}
    {err && <div className="err" role="alert">{err}</div>}
    <button type="button" className="btn b-sun" disabled={!r || busy} onClick={send}>{t('send_review')}</button>
    {onSkip && <button type="button" className="link" onClick={onSkip}>{t('rt_later')}</button>}
  </div>
}

// Pops up after a job is finished (customer and helper), like ride-hailing apps.
type Prompt = { id: number; side: RateSide; start_at: string; other_name: string }
const SKIP = 'cd_rate_skip'
const skipped = (): number[] => { try { return JSON.parse(localStorage.getItem(SKIP) || '[]') } catch { return [] } }
const skip = (id: number) => { try { localStorage.setItem(SKIP, JSON.stringify([...skipped(), id].slice(-50))) } catch { /* private mode */ } }

export function RatePrompt() {
  const { t, lang } = useI18n(); const { session } = useAuth(); const loc = useLocation()
  const [p, setP] = useState<Prompt | null>(null); const [thanks, setThanks] = useState(false)
  const check = () => {
    if (!session) { setP(null); return }
    sb.rpc('my_rating_prompts').then(({ data }) => {
      const list = (data as Prompt[] | null) || []
      setP(list.find(x => !skipped().includes(x.id)) || null)
    })
  }
  useEffect(check, [session, loc.pathname])
  useEffect(() => { if (!session) return; const iv = setInterval(check, 60000); return () => clearInterval(iv) }, [session])
  if (thanks) return <div className="rate-sheet-wrap" onClick={() => setThanks(false)}><div className="rate-sheet" role="status"><div className="rate-thanks">★</div><b className="disp">{t('thanks_review')}</b></div></div>
  if (!p || loc.pathname === '/bookings/' + p.id || loc.pathname === '/maid/job/' + p.id) return null
  return <div className="rate-sheet-wrap" role="dialog" aria-modal="true" aria-label={t('send_review')}>
    <div className="rate-sheet">
      <div className="small muted" style={{ textAlign: 'center' }}>{t('rt_done_on').replace('{d}', fmtDate(p.start_at, lang))}</div>
      <RatingForm key={p.id} bookingId={p.id} side={p.side} name={p.other_name}
        onDone={() => { setP(null); setThanks(true); setTimeout(() => { setThanks(false); check() }, 1600) }}
        onSkip={() => { skip(p.id); setP(null); check() }} />
    </div>
  </div>
}
