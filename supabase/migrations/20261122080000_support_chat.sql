-- Support chat: a customer talks to an AI helper first, and can hand over to the admin.
-- One thread per customer. Customers never write to the tables directly; they use the functions below.

create table if not exists public.support_threads (
  id bigint generated always as identity primary key,
  customer_id uuid not null unique references public.profiles(id) on delete cascade,
  status text not null default 'ai' check (status in ('ai', 'waiting_staff', 'answered', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.support_messages (
  id bigint generated always as identity primary key,
  thread_id bigint not null references public.support_threads(id) on delete cascade,
  sender text not null check (sender in ('customer', 'ai', 'staff', 'system')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists support_messages_thread_idx on public.support_messages (thread_id, id);

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;
revoke all on public.support_threads, public.support_messages from anon, authenticated;
grant select on public.support_threads, public.support_messages to authenticated;

create policy support_threads_read on public.support_threads for select to authenticated
  using (customer_id = auth.uid() or public.is_admin());
create policy support_messages_read on public.support_messages for select to authenticated
  using (exists (select 1 from public.support_threads t where t.id = thread_id and (t.customer_id = auth.uid() or public.is_admin())));

-- Customer sends a message. A thread that is with the staff stays with the staff; a closed one goes back to the AI.
create or replace function public.support_post(p_body text) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t public.support_threads; b text := btrim(coalesce(p_body, ''));
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if b = '' or char_length(b) > 1000 then raise exception 'invalid_message'; end if;
  insert into public.support_threads (customer_id) values (uid) on conflict (customer_id) do nothing;
  select * into t from public.support_threads where customer_id = uid for update;
  if (select count(*) from public.support_messages where thread_id = t.id and sender = 'customer' and created_at > now() - interval '1 day') >= 60
    then raise exception 'too_many_messages'; end if;
  insert into public.support_messages (thread_id, sender, body) values (t.id, 'customer', b);
  update public.support_threads
    set status = case when status in ('waiting_staff', 'answered') then 'waiting_staff' else 'ai' end, updated_at = now()
    where id = t.id returning * into t;
  return json_build_object('thread_id', t.id, 'status', t.status);
end $$;

-- Customer asks for a person.
create or replace function public.support_handoff() returns void
language plpgsql security definer set search_path = public as $$
declare tid bigint;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  update public.support_threads set status = 'waiting_staff', updated_at = now()
    where customer_id = auth.uid() and status <> 'waiting_staff' returning id into tid;
  if tid is not null then insert into public.support_messages (thread_id, sender, body) values (tid, 'system', 'handoff'); end if;
end $$;

create or replace function public.admin_support_threads()
returns table (id bigint, customer_id uuid, customer_name text, status text, updated_at timestamptz, last_body text, last_sender text)
language sql security definer set search_path = public as $$
  select t.id, t.customer_id, p.full_name, t.status, t.updated_at,
    (select m.body from public.support_messages m where m.thread_id = t.id order by m.id desc limit 1),
    (select m.sender from public.support_messages m where m.thread_id = t.id order by m.id desc limit 1)
  from public.support_threads t left join public.profiles p on p.id = t.customer_id
  where public.is_admin() and (t.status <> 'closed' or t.updated_at > now() - interval '7 days')
  order by (t.status = 'waiting_staff') desc, t.updated_at desc limit 100
$$;

create or replace function public.admin_support_reply(p_thread bigint, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare b text := btrim(coalesce(p_body, ''));
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if b = '' or char_length(b) > 1500 then raise exception 'invalid_message'; end if;
  insert into public.support_messages (thread_id, sender, body) values (p_thread, 'staff', b);
  update public.support_threads set status = 'answered', updated_at = now() where id = p_thread;
end $$;

create or replace function public.admin_support_close(p_thread bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.support_threads set status = 'closed', updated_at = now() where id = p_thread;
end $$;

revoke all on function public.support_post(text), public.support_handoff(), public.admin_support_threads(),
  public.admin_support_reply(bigint, text), public.admin_support_close(bigint) from public, anon;
grant execute on function public.support_post(text), public.support_handoff(), public.admin_support_threads(),
  public.admin_support_reply(bigint, text), public.admin_support_close(bigint) to authenticated;
