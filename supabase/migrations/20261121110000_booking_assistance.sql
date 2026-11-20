create schema if not exists cleendee_private;
revoke all on schema cleendee_private from public, anon, authenticated;

create table cleendee_private.arrivals (
  booking_id bigint primary key references public.bookings on delete cascade,
  key_allowed boolean not null default false,
  challenge text,
  expires_at timestamptz,
  confirmed_at timestamptz
);
revoke all on cleendee_private.arrivals from public, anon, authenticated;

-- A new assignee, reschedule or cancellation invalidates both consent and credential.
create function cleendee_private.guard_arrival() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.maid_id is distinct from old.maid_id or new.start_at is distinct from old.start_at
     or new.customer_id is distinct from old.customer_id
     or (old.status in ('confirmed','on_the_way') and new.status not in ('confirmed','on_the_way','working'))
     or (old.status='on_the_way' and new.status='confirmed') then
    delete from cleendee_private.arrivals where booking_id=old.id;
  end if;
  if new.status='working' and old.status is distinct from new.status then
    if old.status <> 'on_the_way' or not exists (
      select from cleendee_private.arrivals a where a.booking_id=old.id and
        ((a.key_allowed and auth.uid()=new.maid_id) or (a.confirmed_at is not null and auth.uid()=new.customer_id))
    ) then raise exception 'arrival_confirmation_required'; end if;
  end if;
  return new;
end $$;
create trigger guard_arrival before update of status, start_at, maid_id, customer_id on public.bookings
for each row execute function cleendee_private.guard_arrival();

create function public.arrival_details(p_booking bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.bookings; a cleendee_private.arrivals;
begin
  select * into b from public.bookings where id=p_booking and
    auth.uid() in (customer_id,maid_id) for update;
  if b.id is null then raise exception 'forbidden'; end if;
  if b.status not in ('confirmed','on_the_way') or b.maid_id is null then
    return jsonb_build_object('status',b.status);
  end if;
  insert into cleendee_private.arrivals(booking_id) values (b.id) on conflict do nothing;
  select * into a from cleendee_private.arrivals where booking_id=b.id;
  if auth.uid()=b.maid_id and b.status='on_the_way' and not a.key_allowed
    and (a.challenge is null or a.expires_at<=now()) then
    update cleendee_private.arrivals set challenge=upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
      expires_at=now()+interval '10 minutes' where booking_id=b.id returning * into a;
  end if;
  return jsonb_build_object('status',b.status,'key_allowed',a.key_allowed,
    'challenge',case when auth.uid()=b.maid_id and b.status='on_the_way' and not a.key_allowed then a.challenge end,
    'expires_at',a.expires_at);
end $$;

create function public.arrival_key_access(p_booking bigint,p_allow boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform from public.bookings where id=p_booking and customer_id=auth.uid()
    and maid_id is not null and status in ('confirmed','on_the_way') for update;
  if not found or p_allow is null then raise exception 'invalid_state'; end if;
  insert into cleendee_private.arrivals(booking_id,key_allowed) values(p_booking,p_allow)
    on conflict (booking_id) do update set key_allowed=excluded.key_allowed,challenge=null,expires_at=null;
end $$;

create function public.arrival_confirm(p_booking bigint,p_code text) returns void
language plpgsql security definer set search_path='' as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id=p_booking and customer_id=auth.uid() for update;
  if b.id is null then raise exception 'forbidden'; end if;
  if b.status <> 'on_the_way' then raise exception 'invalid_state'; end if;
  update cleendee_private.arrivals set confirmed_at=now(),challenge=null,expires_at=null
   where booking_id=p_booking and not key_allowed and expires_at>now() and challenge=upper(trim(p_code));
  if not found then raise exception 'arrival_code_invalid'; end if;
  update public.bookings set status='working' where id=p_booking;
end $$;

-- Reuse the booking engine's one-time slots; for a package require every visit to fit.
create function public.booking_times(p_date date,p_maid uuid,p_service_code text,p_hours integer,p_plan text)
returns table(start_time time,urgent boolean)
language sql stable security definer set search_path='' as $$
  select s.start_time,s.urgent from public.available_slots_v2(p_date,p_maid,p_service_code,p_hours) s
  where p_date between (now() at time zone 'Asia/Bangkok')::date and (now() at time zone 'Asia/Bangkok')::date+13
    and (p_plan='once' or exists (
      select from public.package_plans p join public.service_types st on st.code=p_service_code and st.active
      where p.code=p_plan and p_maid is not null and st.code='general_cleaning'
        and ((p_date+s.start_time) at time zone 'Asia/Bangkok')>=now()+interval '2 hours'
        and not exists (select from generate_series(0,p.visits_per_month-1) i
          cross join lateral (select ((p_date+i*p.interval_days+s.start_time) at time zone 'Asia/Bangkok') as at) v
          where not public.maid_is_free(p_maid,v.at,v.at+make_interval(hours=>st.duration_hours)))
    ))
  order by s.start_time
$$;

create function public.booking_alternatives(p_date date,p_maid uuid,p_service_code text,p_hours integer,p_plan text)
returns table(visit_date date,slot_time time,helper_id uuid,helper_name text)
language plpgsql stable security definer set search_path='' as $$
declare d date; last_day date := (now() at time zone 'Asia/Bangkok')::date+13;
begin
  if p_date is null or p_date not between last_day-13 and last_day or p_hours not between 1 and 12 then return; end if;
  if p_plan<>'once' and p_maid is null then return; end if;
  if p_maid is not null then
    return query select p_date, t.start_time,m.id,m.nickname::text from public.maids m
      cross join lateral (select x.start_time from public.booking_times(p_date,m.id,p_service_code,p_hours,p_plan) x limit 1) t
      where m.status='approved' and m.id<>p_maid and p_service_code=any(m.services)
      order by t.start_time,m.nickname,m.id limit 5;
  end if;
  for d in select generate_series(p_date+1,last_day,interval '1 day')::date loop
    return query select d,x.start_time,p_maid,null::text from public.booking_times(d,p_maid,p_service_code,p_hours,p_plan) x limit 1;
    if found then return; end if;
  end loop;
end $$;

revoke all on function public.arrival_details(bigint),public.arrival_key_access(bigint,boolean),
 public.arrival_confirm(bigint,text),public.booking_times(date,uuid,text,int,text),public.booking_alternatives(date,uuid,text,int,text)
 from public,anon,authenticated;
grant execute on function public.arrival_details(bigint),public.arrival_key_access(bigint,boolean),
 public.arrival_confirm(bigint,text),public.booking_times(date,uuid,text,int,text),public.booking_alternatives(date,uuid,text,int,text)
 to authenticated;

-- Each anonymous visit token represents one booking attempt, including retries.
create table cleendee_private.booking_funnels (
  token uuid primary key, service text not null, first_seen timestamptz not null default now(),
  viewed boolean not null default false, full_date boolean not null default false,
  alternative boolean not null default false, booked boolean not null default false
);
create index booking_funnels_seen on cleendee_private.booking_funnels(first_seen);
revoke all on cleendee_private.booking_funnels from public,anon,authenticated;
create function public.record_booking_step(p_token uuid,p_service text,p_event text,p_result bigint default null,p_package boolean default false)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_token is null or p_event not in ('view','full','alternative','booked') or p_event is null
    or not exists(select from public.service_types where code=p_service and active) then return; end if;
  if p_event<>'view' and auth.uid() is null then return; end if;
  if p_event='booked' and not exists (
    select from public.bookings b join public.service_types s on s.id=b.service_type_id
    where b.customer_id=auth.uid() and s.code=p_service
    and ((p_package and b.package_id=p_result) or (not p_package and b.id=p_result and b.package_id is null))
  ) then return; end if;
  insert into cleendee_private.booking_funnels(token,service,viewed,full_date,alternative,booked)
  values(p_token,p_service,p_event='view',p_event='full',p_event='alternative',p_event='booked')
  on conflict(token) do update set viewed=booking_funnels.viewed or excluded.viewed,
    full_date=booking_funnels.full_date or excluded.full_date,
    alternative=booking_funnels.alternative or excluded.alternative,
    booked=booking_funnels.booked or excluded.booked
    where booking_funnels.service=excluded.service;
end $$;
create function public.booking_funnel_report() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return (select jsonb_build_object('views',count(*) filter(where viewed),
    'view_booked',count(*) filter(where viewed and booked),
    'full_dates',count(*) filter(where full_date),
    'recovered',count(*) filter(where full_date and alternative and booked))
    from cleendee_private.booking_funnels where first_seen>=now()-interval '30 days');
end $$;
revoke all on function public.record_booking_step(uuid,text,text,bigint,boolean), public.booking_funnel_report() from public,anon,authenticated;
grant execute on function public.record_booking_step(uuid,text,text,bigint,boolean) to anon,authenticated;
grant execute on function public.booking_funnel_report() to authenticated;
