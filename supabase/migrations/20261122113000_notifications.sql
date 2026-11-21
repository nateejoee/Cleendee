-- Notifications: a bell in the app for customers, helpers and admins, plus phone pop-ups (Web Push).
-- Rows are written by triggers on the business tables; a trigger on notifications asks the
-- send-push edge function to deliver a pop-up. The hook secret lives in Vault ('push_hook_secret').

create extension if not exists pg_net;

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title_th text not null, title_en text not null,
  body_th text, body_en text,
  link text,
  ref text, -- e.g. payment:12, lets a later event mark an outdated admin alert as read
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, id desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index if not exists notifications_ref_idx on public.notifications (ref) where read_at is null;

create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
revoke all on public.notifications, public.push_subscriptions from anon, authenticated;
grant select on public.notifications to authenticated;
create policy notifications_own on public.notifications for select to authenticated using (user_id = auth.uid());

create or replace function public.notifications_mark_read(p_ids bigint[] default null) returns void
language sql security definer set search_path = public as $$
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids))
$$;
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 then raise exception 'invalid_subscription'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
end $$;
create or replace function public.remove_push_subscription(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid()
$$;
revoke all on function public.notifications_mark_read(bigint[]), public.save_push_subscription(text, text, text), public.remove_push_subscription(text) from public, anon;
grant execute on function public.notifications_mark_read(bigint[]), public.save_push_subscription(text, text, text), public.remove_push_subscription(text) to authenticated;

-- helpers used by the triggers below
create or replace function public._notify(p_user uuid, p_kind text, p_th text, p_en text, p_body_th text, p_body_en text, p_link text, p_ref text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title_th, title_en, body_th, body_en, link, ref)
  select p_user, p_kind, p_th, p_en, p_body_th, p_body_en, p_link, p_ref where p_user is not null
$$;
create or replace function public._notify_admins(p_kind text, p_th text, p_en text, p_body_th text, p_body_en text, p_link text, p_ref text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title_th, title_en, body_th, body_en, link, ref)
  select id, p_kind, p_th, p_en, p_body_th, p_body_en, p_link, p_ref from public.profiles where role = 'admin'
$$;
create or replace function public._resolve_admin_alert(p_ref text) returns void language sql security definer set search_path = public as $$
  update public.notifications set read_at = now() where ref = p_ref and read_at is null
$$;
create or replace function public._bkk(t timestamptz) returns text language sql immutable as $$
  select to_char(t at time zone 'Asia/Bangkok', 'DD/MM HH24:MI')
$$;
revoke all on function public._notify(uuid, text, text, text, text, text, text, text), public._notify_admins(text, text, text, text, text, text, text), public._resolve_admin_alert(text) from public, anon, authenticated;

-- bookings
create or replace function public._ntf_bookings() returns trigger language plpgsql security definer set search_path = public as $$
declare w text := public._bkk(new.start_at); nick text; link text := '/bookings/' || new.id; mlink text := '/maid/job/' || new.id;
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    case new.status
      when 'awaiting_maid' then
        perform public._notify(new.customer_id, 'booking', 'ชำระเงินสำเร็จ กำลังหาแม่บ้าน', 'Payment received, finding a helper', 'งาน #' || new.id || ' วันที่ ' || w, 'Booking #' || new.id || ' on ' || w, link);
        perform public._notify_admins('admin_unmatched', 'งานรอแม่บ้าน #' || new.id, 'Booking #' || new.id || ' needs a helper', 'วันที่ ' || w, 'On ' || w, '/admin#unmatched', 'unmatched:' || new.id);
      when 'confirmed' then
        select nickname into nick from public.maids where id = new.maid_id;
        perform public._notify(new.customer_id, 'booking', 'ยืนยันการจองแล้ว', 'Booking confirmed', coalesce('แม่บ้าน ' || nick || ' · ', '') || w, coalesce(nick || ' · ', '') || w, link);
        perform public._notify(new.maid_id, 'job', 'คุณได้งานใหม่ #' || new.id, 'New job #' || new.id, 'วันที่ ' || w, 'On ' || w, mlink);
        perform public._resolve_admin_alert('unmatched:' || new.id);
      when 'on_the_way' then
        perform public._notify(new.customer_id, 'booking', 'แม่บ้านกำลังเดินทางไปหาคุณ', 'Your helper is on the way', 'งาน #' || new.id, 'Booking #' || new.id, link);
      when 'completed' then
        perform public._notify(new.customer_id, 'booking', 'งานเสร็จแล้ว ให้คะแนนแม่บ้านได้เลย', 'Job done. Please rate your helper', 'งาน #' || new.id, 'Booking #' || new.id, link);
      when 'cancelled_by_customer' then
        perform public._notify(new.maid_id, 'job', 'ลูกค้ายกเลิกงาน #' || new.id, 'Customer cancelled job #' || new.id, 'วันที่ ' || w, 'On ' || w, '/maid');
      when 'refunded_no_maid' then
        perform public._notify(new.customer_id, 'booking', 'ไม่มีแม่บ้านรับงาน คืนเงินเต็มจำนวน', 'No helper available, full refund', 'งาน #' || new.id, 'Booking #' || new.id, link);
        perform public._resolve_admin_alert('unmatched:' || new.id);
      when 'payment_rejected' then
        perform public._notify(new.customer_id, 'payment', 'สลิปไม่ผ่าน กรุณาแนบใหม่', 'Slip not accepted, please upload again', 'งาน #' || new.id, 'Booking #' || new.id, link);
      else null;
    end case;
  end if;
  if tg_op = 'UPDATE' and new.status = old.status and new.status in ('confirmed', 'awaiting_maid') then
    if new.start_at is distinct from old.start_at then
      perform public._notify(new.maid_id, 'job', 'งาน #' || new.id || ' ถูกเลื่อน', 'Job #' || new.id || ' rescheduled', 'เวลาใหม่ ' || w, 'New time ' || w, mlink);
    end if;
    if new.maid_id is distinct from old.maid_id and new.status = 'confirmed' then
      perform public._notify(new.maid_id, 'job', 'คุณได้งานใหม่ #' || new.id, 'New job #' || new.id, 'วันที่ ' || w, 'On ' || w, mlink);
      perform public._notify(old.maid_id, 'job', 'งาน #' || new.id || ' ถูกย้ายไปแม่บ้านคนอื่น', 'Job #' || new.id || ' moved to another helper', null, null, '/maid');
    end if;
  end if;
  return null;
end $$;

-- payments (slips)
create or replace function public._ntf_payments() returns trigger language plpgsql security definer set search_path = public as $$
declare cust uuid;
begin
  if tg_op = 'INSERT' and new.status = 'pending' and new.slip_path is not null then
    perform public._notify_admins('admin_slip', 'สลิปใหม่รอตรวจ ' || new.amount || ' บาท', 'New slip to check: ' || new.amount || ' THB',
      case when new.booking_id is not null then 'งาน #' || new.booking_id else 'แพ็กเกจ #' || new.package_id end,
      case when new.booking_id is not null then 'Booking #' || new.booking_id else 'Package #' || new.package_id end, '/admin/money#slips', 'payment:' || new.id);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status <> 'pending' then
    perform public._resolve_admin_alert('payment:' || new.id);
    if new.package_id is not null then -- booking payments are announced by the booking status change
      select customer_id into cust from public.packages where id = new.package_id;
      if new.status = 'approved' then perform public._notify(cust, 'payment', 'ชำระแพ็กเกจสำเร็จ', 'Package payment received', null, null, '/bookings');
      else perform public._notify(cust, 'payment', 'สลิปแพ็กเกจไม่ผ่าน กรุณาแนบใหม่', 'Package slip not accepted, please upload again', null, null, '/bookings'); end if;
    end if;
  end if;
  return null;
end $$;

-- refunds and helper payouts
create or replace function public._ntf_refunds() returns trigger language plpgsql security definer set search_path = public as $$
declare cust uuid;
begin
  select customer_id into cust from public.bookings where id = new.booking_id;
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public._notify_admins('admin_refund', 'คืนเงินรอดำเนินการ ' || new.amount || ' บาท', 'Refund to make: ' || new.amount || ' THB', 'งาน #' || new.booking_id, 'Booking #' || new.booking_id, '/admin/money#refunds', 'refund:' || new.id);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'done' then
    perform public._resolve_admin_alert('refund:' || new.id);
    perform public._notify(cust, 'refund', 'คืนเงินแล้ว ' || new.amount || ' บาท', 'Refunded ' || new.amount || ' THB', 'งาน #' || new.booking_id, 'Booking #' || new.booking_id, '/bookings/' || new.booking_id);
  end if;
  return null;
end $$;
create or replace function public._ntf_payouts() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public._notify_admins('admin_payout', 'ค่าจ้างรอโอน ' || new.amount || ' บาท', 'Helper pay to transfer: ' || new.amount || ' THB', 'งาน #' || new.booking_id, 'Job #' || new.booking_id, '/admin/money#payouts', 'payout:' || new.id);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'done' then
    perform public._resolve_admin_alert('payout:' || new.id);
    perform public._notify(new.maid_id, 'payout', 'โอนค่าจ้างแล้ว ' || new.amount || ' บาท', 'Paid ' || new.amount || ' THB', 'งาน #' || new.booking_id, 'Job #' || new.booking_id, '/maid/income');
  end if;
  return null;
end $$;

-- damage claims
create or replace function public._ntf_claims() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public._notify_admins('admin_claim', 'มีเคลมความเสียหายใหม่', 'New damage claim', 'งาน #' || new.booking_id || ' · ' || new.item, 'Booking #' || new.booking_id || ' · ' || new.item, '/admin/money#claims', 'claim:' || new.id);
  elsif old.status = 'pending' and new.status <> 'pending' then
    perform public._resolve_admin_alert('claim:' || new.id);
    if new.status = 'approved' then
      perform public._notify(new.customer_id, 'claim', 'เคลมได้รับการอนุมัติ', 'Claim approved', coalesce(new.approved_amount || ' บาท', null), coalesce(new.approved_amount || ' THB', null), '/bookings/' || new.booking_id);
    else
      perform public._notify(new.customer_id, 'claim', 'เคลมไม่ได้รับการอนุมัติ', 'Claim not approved', new.admin_note, new.admin_note, '/bookings/' || new.booking_id);
    end if;
  end if;
  return null;
end $$;

-- helper applications
create or replace function public._ntf_maids() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public._notify_admins('admin_maid', 'มีแม่บ้านสมัครใหม่', 'New helper application', coalesce(new.full_name, new.nickname), coalesce(new.full_name, new.nickname), '/admin/maids', 'maid:' || new.id);
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    perform public._resolve_admin_alert('maid:' || new.id);
    if new.status = 'approved' then
      perform public._notify(new.id, 'maid', 'ผ่านการอนุมัติแล้ว เริ่มรับงานได้', 'Approved! You can start taking jobs', null, null, '/maid');
    elsif new.status = 'suspended' then
      perform public._notify(new.id, 'maid', 'บัญชีแม่บ้านถูกระงับ ติดต่อแอดมิน', 'Helper account suspended. Please contact us', null, null, '/account');
    end if;
  end if;
  return null;
end $$;

-- support chat
create or replace function public._ntf_support_threads() returns trigger language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  if new.status = 'waiting_staff' and old.status is distinct from 'waiting_staff' then
    select full_name into nm from public.profiles where id = new.customer_id;
    perform public._notify_admins('admin_chat', 'ลูกค้าขอคุยกับเจ้าหน้าที่', 'A customer wants to talk to staff', nm, nm, '/admin/support', 'chat:' || new.id);
  elsif old.status = 'waiting_staff' and new.status <> 'waiting_staff' then
    perform public._resolve_admin_alert('chat:' || new.id);
  end if;
  return null;
end $$;
create or replace function public._ntf_support_messages() returns trigger language plpgsql security definer set search_path = public as $$
declare cust uuid;
begin
  if new.sender = 'staff' then
    select customer_id into cust from public.support_threads where id = new.thread_id;
    perform public._notify(cust, 'support', 'เจ้าหน้าที่ตอบแชทแล้ว', 'Our staff replied', left(new.body, 120), left(new.body, 120), '/support');
  end if;
  return null;
end $$;

-- low ratings (same rule as the admin page: 2 stars or less)
create or replace function public._ntf_low_rating() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.rating <= 2 then
    perform public._notify_admins('admin_rating', 'คะแนนต่ำ ' || new.rating || ' ดาว', 'Low rating: ' || new.rating || ' stars', 'งาน #' || new.booking_id, 'Booking #' || new.booking_id, '/admin#low-ratings');
  end if;
  return null;
end $$;

do $$
declare r record;
begin
  for r in select * from (values
    ('bookings', '_ntf_bookings', 'update'), ('payments', '_ntf_payments', 'insert or update'), ('refunds', '_ntf_refunds', 'insert or update'),
    ('payouts', '_ntf_payouts', 'insert or update'), ('claims', '_ntf_claims', 'insert or update'), ('maids', '_ntf_maids', 'insert or update'),
    ('support_threads', '_ntf_support_threads', 'update'), ('support_messages', '_ntf_support_messages', 'insert'),
    ('reviews', '_ntf_low_rating', 'insert'), ('customer_reviews', '_ntf_low_rating', 'insert')) v(tbl, fn, ev) loop
    execute format('drop trigger if exists zz_notify on public.%I', r.tbl);
    execute format('create trigger zz_notify after %s on public.%I for each row execute function public.%I()', r.ev, r.tbl, r.fn);
  end loop;
end $$;
revoke all on function public._ntf_bookings(), public._ntf_payments(), public._ntf_refunds(), public._ntf_payouts(), public._ntf_claims(),
  public._ntf_maids(), public._ntf_support_threads(), public._ntf_support_messages(), public._ntf_low_rating() from public, anon, authenticated;

-- deliver a phone pop-up for each new notification (only if the person turned pop-ups on)
create or replace function public._push_notification() returns trigger language plpgsql security definer set search_path = public as $$
declare secret text;
begin
  if not exists (select 1 from public.push_subscriptions where user_id = new.user_id) then return null; end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'push_hook_secret';
  if secret is null then return null; end if;
  perform net.http_post(
    url := 'https://ybjwioqjgjjxwqgrcoou.supabase.co/functions/v1/send-push',
    body := jsonb_build_object('id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', secret),
    timeout_milliseconds := 5000);
  return null;
exception when others then return null; -- a pop-up must never block the real change
end $$;
revoke all on function public._push_notification() from public, anon, authenticated;
drop trigger if exists push_after_insert on public.notifications;
create trigger push_after_insert after insert on public.notifications for each row execute function public._push_notification();

-- For the send-push edge function only (service role): checks the hook secret and returns what to send.
-- Keys live in Vault: push_hook_secret, vapid_private_key, vapid_public_key.
create or replace function public.push_job(p_id bigint, p_secret text) returns json
language plpgsql security definer set search_path = public as $$
declare ok boolean; n public.notifications; lang text;
begin
  select decrypted_secret = p_secret into ok from vault.decrypted_secrets where name = 'push_hook_secret';
  if not coalesce(ok, false) then raise exception 'forbidden'; end if;
  select * into n from public.notifications where id = p_id;
  if n.id is null then return null; end if;
  select p.lang into lang from public.profiles p where p.id = n.user_id;
  return json_build_object(
    'title', case when lang = 'en' then n.title_en else n.title_th end,
    'body', case when lang = 'en' then n.body_en else n.body_th end,
    'link', n.link, 'tag', coalesce(n.ref, 'n' || n.id),
    'subs', (select coalesce(json_agg(json_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)), '[]') from public.push_subscriptions s where s.user_id = n.user_id),
    'vapid_public', (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_public_key'),
    'vapid_private', (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_private_key'));
end $$;
create or replace function public.push_drop_endpoint(p_endpoint text) returns void language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint
$$;
revoke all on function public.push_job(bigint, text), public.push_drop_endpoint(text) from public, anon, authenticated;
grant execute on function public.push_job(bigint, text), public.push_drop_endpoint(text) to service_role;
