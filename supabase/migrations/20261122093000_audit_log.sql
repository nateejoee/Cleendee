-- Audit log: every change to important data (who, when, before -> after), plus admin sign-ins.
-- Kept for 1 year. Only admins can read it; nobody can edit it, and rows can only be removed once older than a year.

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_name text,
  actor_role text, -- admin / customer / maid / system (server jobs, slip checker)
  action text not null, -- insert / update / delete / login
  table_name text not null,
  row_id text,
  changes jsonb not null default '{}'::jsonb -- update: {column: [before, after]}; insert/delete: the row
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);
create index if not exists audit_log_row_idx on public.audit_log (table_name, row_id, at desc);
create index if not exists audit_log_actor_idx on public.audit_log (actor_id, at desc);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;
create policy audit_log_admin_read on public.audit_log for select to authenticated using (public.is_admin());

-- the log cannot be edited, and only entries older than a year can be removed
create or replace function public._audit_log_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then raise exception 'audit_log_read_only'; end if;
  if old.at > now() - interval '365 days' then raise exception 'audit_log_read_only'; end if;
  return old;
end $$;
drop trigger if exists audit_log_guard on public.audit_log;
create trigger audit_log_guard before update or delete on public.audit_log for each row execute function public._audit_log_guard();

-- long text (page content, notes) is shortened so the log stays small
create or replace function public._audit_trim(v jsonb) returns jsonb language sql immutable as $$
  select case when jsonb_typeof(v) = 'string' and length(v #>> '{}') > 300 then to_jsonb(left(v #>> '{}', 300) || '…') else v end
$$;

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare o jsonb; n jsonb; ch jsonb := '{}'::jsonb; k text; uid uuid := auth.uid(); nm text; rl text; r jsonb;
begin
  if tg_op <> 'INSERT' then o := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then n := to_jsonb(new); end if;
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(n) loop
      if (n -> k) is distinct from (o -> k) then
        ch := ch || jsonb_build_object(k, jsonb_build_array(public._audit_trim(o -> k), public._audit_trim(n -> k)));
      end if;
    end loop;
    if ch = '{}'::jsonb then return null; end if;
  else
    select coalesce(jsonb_object_agg(key, public._audit_trim(value)), '{}'::jsonb) into ch
      from jsonb_each(coalesce(n, o)) where value <> 'null'::jsonb;
  end if;
  r := coalesce(n, o);
  if uid is not null then select full_name, role::text into nm, rl from public.profiles where id = uid; end if;
  insert into public.audit_log (actor_id, actor_name, actor_role, action, table_name, row_id, changes)
  values (uid, nm, case when uid is null then 'system' else coalesce(rl, 'unknown') end, lower(tg_op), tg_table_name,
    coalesce(r ->> 'id', r ->> 'code', r ->> 'booking_id', r ->> 'page'), ch);
  return null;
end $$;
revoke all on function public.audit_row() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['bookings','payments','refunds','payouts','claims','maids','packages','profiles','settings',
    'payment_settings','service_types','service_addons','promo_codes','cancellation_rules','package_plans','districts',
    'provinces','public_page_content'] loop
    execute format('drop trigger if exists zz_audit on public.%I', t);
    execute format('create trigger zz_audit after insert or update or delete on public.%I for each row execute function public.audit_row()', t);
  end loop;
end $$;

-- called by the app right after someone signs in; only admins are recorded
create or replace function public.log_admin_login() returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); nm text;
begin
  if uid is null or not public.is_admin() then return; end if;
  -- the same admin signing in again within 10 minutes is one entry
  if exists (select 1 from public.audit_log where actor_id = uid and action = 'login' and at > now() - interval '10 minutes') then return; end if;
  select full_name into nm from public.profiles where id = uid;
  insert into public.audit_log (actor_id, actor_name, actor_role, action, table_name, row_id, changes)
  values (uid, nm, 'admin', 'login', 'auth', uid::text, '{}'::jsonb);
  -- keep one year
  delete from public.audit_log where at < now() - interval '365 days';
end $$;
revoke all on function public.log_admin_login() from public, anon;
grant execute on function public.log_admin_login() to authenticated;
