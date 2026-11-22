import { useCallback, useEffect, useState } from 'react'
import { DateField } from '../components/DateField'
import { useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { sb, friendly, type Gender, type MaidChangeRequest, type Profile } from '../lib/supabase'
import { useI18n, type Key } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { clearDraft } from '../lib/draft'
import { useServiceAreas } from '../lib/areas'
import { Avatar, DistrictOptions, Icon, Loading, TopBar, useToast } from '../components/ui'
import { Empty } from '../components/EmptyArt'
import { BANKS, BIRTH_MIN, digits, emailOk, phoneOk, photoFileOk, uploadAvatar, yearsAgo } from '../lib/profile'

const PROVIDERS: Record<string, string> = { email: 'Email', google: 'Google', apple: 'Apple', facebook: 'Facebook', line: 'LINE', phone: 'Phone' }
const providerName = (p?: string) => { if (!p) return ''; const k = p.replace(/^custom:/, '').toLowerCase(); return PROVIDERS[k] ?? (k.includes('line') ? 'LINE' : k.charAt(0).toUpperCase() + k.slice(1)) }

function FieldErr({ msg }: { msg?: string }) { return msg ? <small role="alert" style={{ color: 'var(--brick)' }}>{msg}</small> : null }

// ---------- /account/profile : แก้ไขโปรไฟล์ (ทุกบทบาท) ----------
export function EditProfile() {
  const { session, profile } = useAuth()
  if (!session || !profile) return <Loading />
  return <ProfileForm key={profile.id} profile={profile} session={session} />
}

function ProfileForm({ profile, session }: { profile: Profile; session: Session }) {
  const { t, lang } = useI18n(); const { refresh } = useAuth(); const toast = useToast(); const nav = useNavigate()
  const [f, setF] = useState({ full_name: profile.full_name ?? '', phone: profile.phone ?? '', contact_email: profile.contact_email ?? '', birth_date: profile.birth_date ?? '', gender: (profile.gender ?? '') as Gender | '' })
  const [avatar, setAvatar] = useState<string | null>(profile.avatar_url ?? null)
  const [busy, setBusy] = useState(false); const [photoBusy, setPhotoBusy] = useState(false)
  const [photoMsg, setPhotoMsg] = useState(''); const [err, setErr] = useState(''); const [tried, setTried] = useState(false)
  const [del, setDel] = useState(false)
  const uid = session.user.id
  const birthMax = yearsAgo(13)
  const name = f.full_name.trim(); const email = f.contact_email.trim()
  const phoneChanged = digits(f.phone) !== digits(profile.phone ?? '')
  const errs: Partial<Record<keyof typeof f, string>> = {}
  if (!name || name.length > 80) errs.full_name = t('pf_err_name')
  if (phoneChanged && !phoneOk(f.phone)) errs.phone = t('pf_err_phone')
  if (email && !emailOk(email)) errs.contact_email = t('pf_err_email')
  if (f.birth_date && (f.birth_date < BIRTH_MIN || f.birth_date > birthMax)) errs.birth_date = t('pf_err_birth')
  const invalid = Object.keys(errs).length > 0
  const dirty = name !== (profile.full_name ?? '') || phoneChanged || email !== (profile.contact_email ?? '') || f.birth_date !== (profile.birth_date ?? '')
    || f.gender !== (profile.gender ?? '') || avatar !== (profile.avatar_url ?? null)
  const show = (k: keyof typeof f) => (tried || (k !== 'full_name' && f[k] !== '') ? errs[k] : undefined)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  const pick = async (file?: File) => {
    if (!file || photoBusy) return
    if (!photoFileOk(file)) { setPhotoMsg(t('pf_photo_err')); return }
    setPhotoBusy(true); setPhotoMsg('')
    try { setAvatar(await uploadAvatar(uid, file)) }
    catch (e) { setPhotoMsg((e as Error)?.message === 'bad_image' || e instanceof Event ? t('pf_photo_fail') : friendly(e, lang)) }
    finally { setPhotoBusy(false) }
  }
  const save = async () => {
    setTried(true); setErr('')
    if (invalid) { setErr(t('pf_fix')); return }
    if (busy || !dirty) return
    setBusy(true)
    try {
      // เบอร์โทรใช้ RPC เดิม (เซิร์ฟเวอร์ตรวจและจัดรูปแบบให้) ส่วนที่เหลืออัปเดตแถวของตัวเอง
      if (phoneChanged) { const { error } = await sb.rpc('set_my_phone', { p_phone: f.phone }); if (error) throw error }
      const { error } = await sb.from('profiles').update({
        full_name: name, contact_email: email || null, birth_date: f.birth_date || null, gender: f.gender || null, avatar_url: avatar,
      }).eq('id', uid).select('id').single()
      if (error) throw error
      await refresh(); setTried(false); toast.show(t('saved'))
    } catch (e) { setErr(friendly(e, lang)) } finally { setBusy(false) }
  }
  const provider = providerName(session.user.app_metadata?.provider as string | undefined)
  const genders: [Gender, Key][] = [['female', 'gd_female'], ['male', 'gd_male'], ['other', 'gd_other'], ['unspecified', 'gd_unspecified']]
  const opt = <span className="muted" style={{ fontWeight: 400 }}> ({t('pf_optional')})</span>
  return <div className="page nobar dp-sub dp-profile"><TopBar title={t('edit_profile')} back="/account" />
    <div className="pad mt16 stack pf">
      <div className="pf-photo-wrap">
        <label className="pf-photo" aria-label={t('pf_change_photo')}>
          <Avatar name={name || 'C'} url={avatar} seed={uid} size={104} />
          <span className="pf-cam">{photoBusy ? <span className="lp-spin" /> : <Icon n="camera" size={18} />}</span>
          <input type="file" accept="image/*" disabled={photoBusy} onChange={e => { void pick(e.target.files?.[0]); e.target.value = '' }} />
        </label>
        <small className="muted">{t('pf_change_photo')}</small>
        {photoMsg && <small role="alert" style={{ color: 'var(--brick)' }}>{photoMsg}</small>}
      </div>
      <div className="card stack">
        <div className="field"><label htmlFor="pf-name">{t('pf_name')}</label>
          <input id="pf-name" className="input" maxLength={80} autoComplete="name" value={f.full_name} onChange={set('full_name')} aria-invalid={!!show('full_name')} /><FieldErr msg={show('full_name')} /></div>
        <div className="field"><label htmlFor="pf-phone">{t('pf_phone')}</label>
          <input id="pf-phone" className="input" type="tel" inputMode="tel" autoComplete="tel" maxLength={12} placeholder="08xxxxxxxx" value={f.phone} onChange={set('phone')} aria-invalid={!!show('phone')} />
          {show('phone') ? <FieldErr msg={show('phone')} /> : <small className="muted">{profile.role === 'customer' && !profile.phone ? (lang === 'th' ? 'ยังไม่ได้ใส่ (ต้องใส่ก่อนจอง)' : 'Not added yet (needed to book)') : t('pf_phone_d')}</small>}</div>
        <div className="field"><label htmlFor="pf-email">{t('pf_contact_email')}{opt}</label>
          <input id="pf-email" className="input" type="email" inputMode="email" autoComplete="email" maxLength={254} placeholder={session.user.email ?? 'name@example.com'} value={f.contact_email} onChange={set('contact_email')} aria-invalid={!!show('contact_email')} />
          {show('contact_email') ? <FieldErr msg={show('contact_email')} /> : <small className="muted">{t('pf_contact_email_d')}</small>}</div>
        <div className="field"><label htmlFor="pf-birth">{t('pf_birthday')}{opt}</label>
          <DateField id="pf-birth" min={BIRTH_MIN} max={birthMax} openAt="1995-01-01" clearable value={f.birth_date} onChange={v => set('birth_date')({ target: { value: v } })} invalid={!!show('birth_date')} /><FieldErr msg={show('birth_date')} /></div>
        <div className="field"><label>{t('pf_gender')}{opt}</label>
          <div className="chips" role="radiogroup" aria-label={t('pf_gender')}>{genders.map(([g, k]) =>
            <button key={g} type="button" role="radio" aria-checked={f.gender === g} className={'chip' + (f.gender === g ? ' on' : '')} onClick={() => setF({ ...f, gender: f.gender === g ? '' : g })}>{t(k)}</button>)}</div></div>
      </div>
      <div className="card stack" style={{ gap: 4 }}>
        <div className="small muted">{t('pf_signin')}</div>
        <div className="row" style={{ gap: 8 }}><Icon n="lock" size={16} /><b style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{session.user.email || session.user.phone || '–'}</b>{provider && <span className="pill p-grey">{provider}</span>}</div>
        <small className="muted">{provider ? t('pf_via') + ' ' + provider + ' · ' : ''}{t('pf_signin_d')}</small>
      </div>
      {err && <div className="err" role="alert">{err}</div>}
      <button className="btn b-ocean" disabled={busy || photoBusy || !dirty} onClick={save}>{busy ? t('loading') : t('save')}</button>
      {profile.role !== 'admin' && <button className="link pf-danger" onClick={() => setDel(true)}>{t('del_account')}</button>}
    </div>
    {del && <DeleteAccount onClose={() => setDel(false)} onDone={() => nav('/welcome', { replace: true })} />}
    {toast.node}
  </div>
}

// ---------- ลบบัญชี: อธิบายสิ่งที่ลบ/เก็บ และให้พิมพ์คำยืนยันก่อน ----------
function DeleteAccount({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t, lang } = useI18n(); const [v, setV] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const word = t('del_word')
  const ok = lang === 'en' ? v.trim().toUpperCase() === word : v.trim() === word
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose() }; addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [busy, onClose])
  const go = async () => {
    if (!ok || busy) return; setBusy(true); setErr('')
    const { error } = await sb.rpc('delete_my_account')
    if (error) { setErr(friendly(error, lang)); setBusy(false); return }
    try { await sb.auth.signOut() } catch { /* บัญชีถูกลบแล้ว ออกจากระบบในเครื่องก็พอ */ }
    clearDraft(); onDone()
  }
  return <div className="rate-sheet-wrap" role="dialog" aria-modal="true" aria-labelledby="del-title" onClick={e => { if (e.target === e.currentTarget && !busy) onClose() }}>
    <div className="rate-sheet stack">
      <h2 id="del-title" className="disp" style={{ fontSize: 20, color: 'var(--brick)' }}>{t('del_title')}</h2>
      <div><b>{t('del_will')}</b><div className="small">{t('del_will_d')}</div></div>
      <div><b>{t('del_keep')}</b><div className="small">{t('del_keep_d')}</div></div>
      <div className="infonote"><Icon n="shield" />{t('del_undo')}</div>
      <div className="field"><label htmlFor="del-word">{t('del_type').replace('{w}', word)}</label>
        <input id="del-word" className="input" autoComplete="off" autoCapitalize="characters" value={v} onChange={e => setV(e.target.value)} onKeyDown={e => e.key === 'Enter' && go()} /></div>
      {err && <div className="err" role="alert">{err}</div>}
      <button className="btn b-red" disabled={!ok || busy} onClick={go}>{busy ? t('loading') : t('del_go')}</button>
      <button className="btn b-line" disabled={busy} onClick={onClose}>{lang === 'th' ? 'ยกเลิก' : 'Cancel'}</button>
    </div>
  </div>
}

// ---------- /maid/profile : โปรไฟล์แม่บ้าน ----------
type MaidMe = { nickname: string; bio: string | null; district_id: number | null; phone: string | null; photo_url: string | null; status: string }
export function MaidEditProfile() {
  const { t, lang } = useI18n(); const { session } = useAuth(); const toast = useToast(); const nav = useNavigate(); const th = lang === 'th'
  const { groups, districts } = useServiceAreas()
  const [me, setMe] = useState<MaidMe | null | undefined>(undefined)
  const [bank, setBank] = useState<{ bank_name: string; bank_account: string } | null>(null)
  const [pending, setPending] = useState<MaidChangeRequest[]>([])
  const [f, setF] = useState({ nickname: '', bio: '', phone: '', district_id: 0 })
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const uid = session?.user.id
  const loadReq = useCallback(() => { if (uid) sb.from('maid_change_requests').select('*').eq('maid_id', uid).eq('status', 'pending').order('created_at', { ascending: false }).then(({ data }) => setPending((data as MaidChangeRequest[]) || [])) }, [uid])
  const loadBank = () => { sb.rpc('my_bank').then(({ data }) => setBank((data as { bank_name: string; bank_account: string }[])?.[0] ?? null)) }
  useEffect(() => {
    if (!uid) return
    sb.from('maids').select('nickname,bio,district_id,phone,photo_url,status').eq('id', uid).maybeSingle().then(({ data }) => {
      const m = data as MaidMe | null; setMe(m)
      if (m) setF({ nickname: m.nickname ?? '', bio: m.bio ?? '', phone: m.phone ?? '', district_id: m.district_id ?? 0 })
    })
    loadBank(); loadReq()
  }, [uid, loadReq])
  if (!uid || me === undefined) return <Loading />
  if (me === null) return <div className="page nobar"><TopBar title={t('mp_title')} /><div className="pad mt20 stack"><Empty art="search" title={t('nothing')} /><button className="btn b-sun" onClick={() => nav('/maid/apply')}>{t('become_maid')}</button></div></div>
  const nick = f.nickname.trim()
  const errs: Partial<Record<'nickname' | 'phone', string>> = {}
  if (!nick || nick.length > 40) errs.nickname = t('mp_err_nick')
  if (f.phone && !phoneOk(f.phone)) errs.phone = t('pf_err_phone')
  const dirty = nick !== me.nickname || f.bio.trim() !== (me.bio ?? '') || digits(f.phone) !== digits(me.phone ?? '') || f.district_id !== (me.district_id ?? 0)
  const current = districts.find(d => d.id === f.district_id)
  const save = async () => {
    setErr('')
    if (Object.keys(errs).length) { setErr(t('pf_fix')); return }
    if (busy || !dirty) return; setBusy(true)
    const patch = { nickname: nick, bio: f.bio.trim() || null, phone: digits(f.phone) || null, ...(f.district_id ? { district_id: f.district_id } : {}) }
    const { error } = await sb.from('maids').update(patch).eq('id', uid).select('id').single()
    setBusy(false)
    if (error) { setErr(friendly(error, lang)); return }
    setMe({ ...me, ...patch, district_id: patch.district_id ?? me.district_id }); toast.show(t('saved'))
  }
  const pPhoto = pending.find(r => r.kind === 'photo'); const pBank = pending.find(r => r.kind === 'bank')
  const sent = () => { toast.show(t('mp_sent')); loadReq() }
  return <div className="page nobar"><TopBar title={t('mp_title')} back="/maid" />
    <div className="pad mt16 stack pf">
      <div className="sec-title" style={{ margin: '4px 0 0' }}>{t('mp_public')}</div>
      <div className="card stack">
        <div className="field"><label htmlFor="mp-nick">{t('m_nick')}</label><input id="mp-nick" className="input" maxLength={40} value={f.nickname} onChange={e => setF({ ...f, nickname: e.target.value })} /><FieldErr msg={errs.nickname} /></div>
        <div className="field"><label htmlFor="mp-bio">{t('m_bio')}</label><textarea id="mp-bio" className="input" maxLength={500} value={f.bio} onChange={e => setF({ ...f, bio: e.target.value })} /></div>
        <div className="field"><label htmlFor="mp-phone">{th ? 'เบอร์โทรศัพท์' : 'Phone number'}</label><input id="mp-phone" className="input" type="tel" inputMode="tel" autoComplete="tel" maxLength={12} placeholder="08xxxxxxxx" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
          {f.phone && <FieldErr msg={errs.phone} />}</div>
        <div className="field"><label htmlFor="mp-dist">{th ? 'อำเภอหลักที่รับงาน' : 'Main district'}</label>
          <select id="mp-dist" className="input" value={f.district_id || ''} onChange={e => setF({ ...f, district_id: Number(e.target.value) })}>{!f.district_id && <option value="">{th ? 'เลือก' : 'Select'}</option>}<DistrictOptions groups={groups} keep={current} /></select></div>
        {err && <div className="err" role="alert">{err}</div>}
        <button className="btn b-ocean" disabled={busy || !dirty} onClick={save}>{busy ? t('loading') : t('save')}</button>
      </div>

      <div className="sec-title" style={{ marginBottom: 0 }}>{t('mp_review')}</div>
      <div className="small muted">{t('mp_review_d')}</div>
      <PhotoRequest uid={uid} name={nick || 'C'} current={me.photo_url} pending={pPhoto} onSent={sent} />
      <BankRequest current={bank} pending={pBank} onSent={sent} />
    </div>{toast.node}
  </div>
}

const PendingBadge = () => { const { t } = useI18n(); return <span className="pill p-sun"><Icon n="clock" size={13} />{t('mp_pending')}</span> }

function PhotoRequest({ uid, name, current, pending, onSent }: { uid: string; name: string; current: string | null; pending?: MaidChangeRequest; onSent: () => void }) {
  const { t, lang } = useI18n(); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('')
  const pick = async (file?: File) => {
    if (!file || busy) return
    if (!photoFileOk(file)) { setMsg(t('pf_photo_err')); return }
    setBusy(true); setMsg('')
    try {
      const url = await uploadAvatar(uid, file)
      const { error } = await sb.rpc('maid_request_change', { p_kind: 'photo', p_photo_url: url }); if (error) throw error
      onSent()
    } catch (e) { setMsg((e as Error)?.message === 'bad_image' || e instanceof Event ? t('pf_photo_fail') : friendly(e, lang)) } finally { setBusy(false) }
  }
  return <div className="card stack">
    <div className="between"><b>{t('a_kind_photo')}</b>{pending && <PendingBadge />}</div>
    <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
      <div className="pf-cmp"><Avatar name={name} url={current} seed={uid} size={72} /><small className="muted">{t('mp_current')}</small></div>
      {pending && <><Icon n="next" style={{ marginTop: 26, color: 'var(--ink3)' }} /><div className="pf-cmp"><Avatar name={name} url={pending.photo_url} seed={uid} size={72} /><small className="muted">{t('mp_requested')}</small></div></>}
    </div>
    <label className="btn b-line photo-control" style={{ flexDirection: 'row' }}><Icon n="camera" size={18} /><span>{busy ? t('loading') : t('mp_new_photo')}</span>
      <input type="file" accept="image/*" disabled={busy} onChange={e => { void pick(e.target.files?.[0]); e.target.value = '' }} /></label>
    <small className="muted">{t('pf_photo_err')}</small>
    {msg && <small role="alert" style={{ color: 'var(--brick)' }}>{msg}</small>}
  </div>
}

function BankRequest({ current, pending, onSent }: { current: { bank_name: string; bank_account: string } | null; pending?: MaidChangeRequest; onSent: () => void }) {
  const { t, lang } = useI18n(); const th = lang === 'th'
  const [open, setOpen] = useState(false); const [bank, setBank] = useState(''); const [other, setOther] = useState(''); const [acc, setAcc] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [tried, setTried] = useState(false)
  const name = bank === 'other' ? other.trim() : bank
  const accDigits = digits(acc)
  const accErr = accDigits.length < 10 || accDigits.length > 15 ? t('mp_err_acc') : ''
  const bankErr = !name ? t('mp_err_bank') : ''
  const send = async () => {
    setTried(true); setErr('')
    if (accErr || bankErr || busy) return
    setBusy(true)
    const { error } = await sb.rpc('maid_request_change', { p_kind: 'bank', p_bank_name: name, p_bank_account: accDigits })
    setBusy(false)
    if (error) { setErr(friendly(error, lang)); return }
    setOpen(false); setBank(''); setOther(''); setAcc(''); setTried(false); onSent()
  }
  return <div className="card stack">
    <div className="between"><b>{t('a_kind_bank')}</b>{pending && <PendingBadge />}</div>
    <div className="small"><span className="muted">{t('mp_current')}: </span>{current ? <b>{current.bank_name} {current.bank_account}</b> : <span className="muted">{t('mp_bank_none')}</span>}</div>
    {pending && <div className="small"><span className="muted">{t('mp_requested')}: </span><b>{pending.bank_name} {pending.bank_account}</b></div>}
    {!open ? <button className="btn b-line" onClick={() => setOpen(true)}>{t('mp_send')}</button> : <>
      <div className="field"><label htmlFor="mp-bank">{t('m_bank_name')}</label>
        <select id="mp-bank" className="input" value={bank} onChange={e => setBank(e.target.value)}><option value="">{th ? 'เลือกธนาคาร' : 'Choose a bank'}</option>
          {BANKS.map(([v, a, b]) => <option key={v} value={v}>{th ? a : b}</option>)}<option value="other">{t('mp_other_bank')}</option></select>
        {bank === 'other' && <input className="input" maxLength={60} placeholder={t('m_bank_name')} value={other} onChange={e => setOther(e.target.value)} aria-label={t('mp_other_bank')} />}
        {tried && <FieldErr msg={bankErr} />}</div>
      <div className="field"><label htmlFor="mp-acc">{t('m_bank_acc')}</label>
        <input id="mp-acc" className="input" inputMode="numeric" maxLength={20} placeholder="xxx-x-xxxxx-x" value={acc} onChange={e => setAcc(e.target.value.replace(/[^\d\- ]/g, ''))} />
        {(tried || accDigits.length > 15) && <FieldErr msg={accErr} />}</div>
      {err && <div className="err" role="alert">{err}</div>}
      <div className="row"><button className="btn b-ocean" style={{ flex: 2 }} disabled={busy} onClick={send}>{busy ? t('loading') : t('mp_send')}</button>
        <button className="btn b-line" style={{ flex: 1 }} disabled={busy} onClick={() => { setOpen(false); setTried(false); setErr('') }}>{th ? 'ยกเลิก' : 'Cancel'}</button></div>
    </>}
  </div>
}
