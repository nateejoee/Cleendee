-- Profile editing like Grab / LINE MAN / bTaskee.
-- Customers edit name, photo, phone, contact email, birthday and gender themselves.
-- Helpers edit nickname, bio, phone and district themselves; a new face photo or bank account
-- waits for admin approval. Anyone can delete their account when nothing is in progress.

-- 1) Customer profile fields
alter table public.profiles
  add column avatar_url text,
  add column contact_email text,
  add column birth_date date,
  add column gender text check (gender in ('female', 'male', 'other', 'unspecified')),
  add column deleted_at timestamptz;
alter table public.profiles add constraint profiles_contact_email_format
  check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
alter table public.profiles add constraint profiles_birth_date_range
  check (birth_date is null or (birth_date > date '1900-01-01' and birth_date <= current_date - interval '13 years'));
alter table public.profiles add constraint profiles_full_name_length
  check (full_name is null or char_length(trim(full_name)) between 1 and 80) not valid;
grant update (avatar_url, contact_email, birth_date, gender) on public.profiles to authenticated;

-- 2) Helpers: photo and bank account go through admin approval; phone becomes self-editable
revoke update (photo_url, bank_name, bank_account) on public.maids from authenticated;
grant update (phone) on public.maids to authenticated;

create table public.maid_change_requests (
  id bigint generated always as identity primary key,
  maid_id uuid not null references public.maids(id) on delete cascade,
  kind text not null check (kind in ('photo', 'bank')),
  photo_url text,
  bank_name text,
  bank_account text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  admin_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check ((kind = 'photo' and photo_url is not null) or (kind = 'bank' and bank_name is not null and bank_account is not null))
);
create unique index maid_change_one_pending on public.maid_change_requests (maid_id, kind) where status = 'pending';
alter table public.maid_change_requests enable row level security;
revoke all on public.maid_change_requests from anon, authenticated;
grant select on public.maid_change_requests to authenticated;
create policy mcr_read on public.maid_change_requests for select to authenticated using (maid_id = auth.uid() or public.is_admin());

-- helper asks for a change (replaces their earlier pending request of the same kind)
create or replace function public.maid_request_change(p_kind text, p_photo_url text default null, p_bank_name text default null, p_bank_account text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v bigint; acct text := regexp_replace(coalesce(p_bank_account, ''), '[^0-9]', '', 'g');
begin
  if not exists(select 1 from maids where id = auth.uid()) then raise exception 'forbidden'; end if;
  if p_kind = 'photo' then
    if p_photo_url is null or p_photo_url !~ '^https://' then raise exception 'invalid_input'; end if;
  elsif p_kind = 'bank' then
    if nullif(trim(p_bank_name), '') is null or length(acct) not between 10 and 15 then raise exception 'invalid_input'; end if;
  else raise exception 'invalid_input'; end if;
  update maid_change_requests set status = 'cancelled', decided_at = now() where maid_id = auth.uid() and kind = p_kind and status = 'pending';
  insert into maid_change_requests(maid_id, kind, photo_url, bank_name, bank_account)
  values (auth.uid(), p_kind, case when p_kind = 'photo' then p_photo_url end,
          case when p_kind = 'bank' then trim(p_bank_name) end, case when p_kind = 'bank' then acct end)
  returning id into v;
  return v;
end $$;
revoke all on function public.maid_request_change(text, text, text, text) from public, anon;
grant execute on function public.maid_request_change(text, text, text, text) to authenticated;

-- admin approves / rejects
create or replace function public.admin_decide_maid_change(p_id bigint, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r maid_change_requests;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into r from maid_change_requests where id = p_id and status = 'pending' for update;
  if r.id is null then raise exception 'invalid_state'; end if;
  if p_approve then
    if r.kind = 'photo' then update maids set photo_url = r.photo_url where id = r.maid_id;
    else update maids set bank_name = r.bank_name, bank_account = r.bank_account where id = r.maid_id; end if;
  end if;
  update maid_change_requests set status = case when p_approve then 'approved' else 'rejected' end,
    admin_note = nullif(trim(p_note), ''), decided_at = now() where id = r.id;
end $$;
revoke all on function public.admin_decide_maid_change(bigint, boolean, text) from public, anon;
grant execute on function public.admin_decide_maid_change(bigint, boolean, text) to authenticated;

-- admin sees current and requested values side by side
create or replace function public.admin_maid_change_requests()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return (select coalesce(json_agg(x order by x.created_at), '[]') from (
    select r.id, r.kind, r.photo_url, r.bank_name, r.bank_account, r.created_at,
      m.id as maid_id, m.nickname, m.full_name, m.photo_url as current_photo, m.bank_name as current_bank_name, m.bank_account as current_bank_account
    from maid_change_requests r join maids m on m.id = r.maid_id where r.status = 'pending') x);
end $$;
revoke all on function public.admin_maid_change_requests() from public, anon;
grant execute on function public.admin_maid_change_requests() to authenticated;

-- 3) Delete my account: only when nothing is in progress; personal data is removed,
--    booking and payment records stay (anonymised) for accounting.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if exists(select 1 from profiles where id = me and role = 'admin') then raise exception 'admin_cannot_delete'; end if;
  if exists(select 1 from bookings where (customer_id = me or maid_id = me)
            and status in ('pending_payment', 'payment_review', 'awaiting_maid', 'confirmed', 'on_the_way', 'working')) then
    raise exception 'account_has_active_jobs'; end if;
  if exists(select 1 from refunds r join bookings b on b.id = r.booking_id where b.customer_id = me and r.status = 'pending')
     or exists(select 1 from payouts where maid_id = me and status = 'pending')
     or exists(select 1 from claims where customer_id = me and status = 'pending') then
    raise exception 'account_has_pending_money'; end if;

  delete from customer_addresses where customer_id = me;
  delete from favorites where customer_id = me;
  delete from push_subscriptions where user_id = me;
  update packages set status = 'cancelled' where customer_id = me and status = 'active';
  update profiles set full_name = 'ผู้ใช้ที่ลบบัญชีแล้ว', phone = null, avatar_url = null, contact_email = null,
    birth_date = null, gender = null, district_id = null, points = 0, deleted_at = now() where id = me;
  update maids set status = 'suspended', nickname = 'อดีตแม่บ้าน', bio = null, photo_url = null, phone = null, line_id = null,
    bank_name = null, bank_account = null, full_name = null, birth_date = null, referee_name = null, referee_phone = null,
    id_card_path = null, selfie_path = null, conduct_cert_path = null where id = me;
  update maid_change_requests set status = 'cancelled', decided_at = now() where maid_id = me and status = 'pending';

  -- sign-in can no longer reach this account; signing in again with Google/LINE creates a new, empty one
  delete from auth.identities where user_id = me;
  delete from auth.sessions where user_id = me;
  update auth.users set email = 'deleted+' || me || '@deleted.invalid', phone = null,
    raw_user_meta_data = '{}'::jsonb, banned_until = 'infinity' where id = me;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
