-- แจ้งเตือนแม่บ้านผ่าน LINE OA CleenDee (@716smhqr)
-- รหัสลับ LINE (line_token, line_secret) เก็บใน Supabase Vault ไม่อยู่ในไฟล์นี้
-- รหัส LINE ของแม่บ้าน: ไม่ให้สิทธิ์อ่านกับผู้ใช้ทั่วไป (ตาราง maids ใช้สิทธิ์รายคอลัมน์อยู่แล้ว)
alter table public.maids add column if not exists line_user_id text unique, add column if not exists line_linked_at timestamptz;

-- รหัสเชื่อม LINE ใช้ครั้งเดียว อายุ 30 นาที
create table if not exists public.line_link_codes(code text primary key, maid_id uuid not null references public.maids(id) on delete cascade, expires_at timestamptz not null);
alter table public.line_link_codes enable row level security;
revoke all on public.line_link_codes from anon, authenticated;

-- แม่บ้านขอรหัสเชื่อม LINE
create or replace function public.maid_line_code() returns json language plpgsql security definer set search_path to 'public' as $$
declare c text;
begin
  if not exists (select 1 from maids where id = auth.uid()) then raise exception 'not_maid'; end if;
  delete from line_link_codes where maid_id = auth.uid() or expires_at < now();
  loop
    c := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from line_link_codes where code = c);
  end loop;
  insert into line_link_codes values (c, auth.uid(), now() + interval '30 minutes');
  return json_build_object('code', c, 'expires_at', now() + interval '30 minutes');
end $$;

-- สถานะการเชื่อม (ไม่ส่งรหัส LINE กลับไป)
create or replace function public.maid_line_status() returns json language sql stable security definer set search_path to 'public' as $$
  select json_build_object('linked', line_user_id is not null, 'linked_at', line_linked_at) from maids where id = auth.uid()
$$;

create or replace function public.maid_line_unlink() returns void language sql security definer set search_path to 'public' as $$
  update maids set line_user_id = null, line_linked_at = null where id = auth.uid()
$$;

-- เรียกจาก Edge Function (service role) เท่านั้น: เชื่อมด้วยรหัส หรือเชื่อมอัตโนมัติถ้าแม่บ้านล็อกอินด้วย LINE
create or replace function public.line_link(p_uid text, p_code text) returns text language plpgsql security definer set search_path to 'public' as $$
declare m uuid;
begin
  if p_code is not null then
    select maid_id into m from line_link_codes where code = p_code and expires_at > now();
    if m is null then return 'bad_code'; end if;
    delete from line_link_codes where code = p_code;
  else
    select i.user_id into m from auth.identities i join maids x on x.id = i.user_id where i.provider = 'custom:line' and i.provider_id = p_uid limit 1;
    if m is null then return 'unknown'; end if;
  end if;
  update maids set line_user_id = null, line_linked_at = null where line_user_id = p_uid and id <> m;
  update maids set line_user_id = p_uid, line_linked_at = now() where id = m;
  return 'linked';
end $$;

-- ข้อมูลสำหรับส่ง LINE ของแจ้งเตือน 1 รายการ (เรียกจาก Edge Function ด้วย service role)
create or replace function public.line_job(p_id bigint) returns json language sql stable security definer set search_path to 'public' as $$
  select json_build_object('to', m.line_user_id, 'title', n.title_th, 'body', n.body_th, 'link', n.link)
  from notifications n join maids m on m.id = n.user_id
  where n.id = p_id and m.line_user_id is not null and n.kind in ('job', 'remind')
$$;

create or replace function public.line_cfg() returns json language sql stable security definer set search_path to 'public' as $$
  select json_build_object('token', (select decrypted_secret from vault.decrypted_secrets where name = 'line_token'),
                           'secret', (select decrypted_secret from vault.decrypted_secrets where name = 'line_secret'),
                           'hook', (select decrypted_secret from vault.decrypted_secrets where name = 'push_hook_secret'))
$$;

revoke all on function public.line_link(text, text), public.line_job(bigint), public.line_cfg() from public, anon, authenticated;
grant execute on function public.line_link(text, text), public.line_job(bigint), public.line_cfg() to service_role;
revoke all on function public.maid_line_code(), public.maid_line_status(), public.maid_line_unlink() from public, anon;
grant execute on function public.maid_line_code(), public.maid_line_status(), public.maid_line_unlink() to authenticated;

-- แจ้งเตือนใหม่ของแม่บ้านที่เชื่อม LINE แล้ว → ส่งต่อไป Edge Function line-bot
create or replace function public._line_notification() returns trigger language plpgsql security definer set search_path to 'public' as $$
declare secret text;
begin
  if new.kind not in ('job', 'remind') then return null; end if;
  if not exists (select 1 from maids where id = new.user_id and line_user_id is not null) then return null; end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'push_hook_secret';
  if secret is null then return null; end if;
  perform net.http_post(url := 'https://ybjwioqjgjjxwqgrcoou.supabase.co/functions/v1/line-bot',
    body := jsonb_build_object('id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', secret), timeout_milliseconds := 5000);
  return null;
exception when others then return null;
end $$;
drop trigger if exists line_after_insert on public.notifications;
create trigger line_after_insert after insert on public.notifications for each row execute function public._line_notification();

-- เตือนงานพรุ่งนี้: ทุกวัน 18:00 น. (เวลาไทย) ส่งให้แม่บ้านที่มีงานยืนยันแล้ววันพรุ่งนี้
create or replace function public.remind_tomorrow_jobs() returns int language plpgsql security definer set search_path to 'public' as $$
declare b record; n int := 0;
begin
  for b in select id, maid_id, start_at from bookings
    where status = 'confirmed' and maid_id is not null
      and (start_at at time zone 'Asia/Bangkok')::date = (now() at time zone 'Asia/Bangkok')::date + 1
      and not exists (select 1 from notifications x where x.ref = 'remind:' || bookings.id)
  loop
    perform _notify(b.maid_id, 'remind', 'พรุ่งนี้มีงาน ' || _bkk(b.start_at), 'Job tomorrow ' || _bkk(b.start_at),
      'อย่าลืมเตรียมอุปกรณ์ให้พร้อม แตะเพื่อดูรายละเอียดงาน', 'Get your supplies ready. Tap to see the job',
      '/maid/job/' || b.id, 'remind:' || b.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.remind_tomorrow_jobs() from public, anon, authenticated;
select cron.schedule('cleendee-remind-tomorrow', '0 11 * * *', 'select public.remind_tomorrow_jobs()');
