-- 1) Automatic job offers: a job without a helper is offered to the best free helper first
--    (same area, past the trial, best rating, most jobs). If they do not answer in time or decline,
--    it goes to the next one. When nobody is left, the job is open to every helper as before.
-- 2) Helper applications: a short quiz must be passed; new helpers start on trial until their first
--    good review (4 stars or more).
-- 3) Customer tiers (Member / Silver / Gold / Platinum) by money spent on completed jobs;
--    higher tiers earn more points per job.

create extension if not exists pg_cron;

alter table public.settings
  add column if not exists offer_minutes int not null default 15,
  add column if not exists tier_silver int not null default 2000,
  add column if not exists tier_gold int not null default 6000,
  add column if not exists tier_platinum int not null default 20000,
  add column if not exists mult_silver numeric not null default 1.1,
  add column if not exists mult_gold numeric not null default 1.25,
  add column if not exists mult_platinum numeric not null default 1.5;

alter table public.bookings
  add column if not exists offer_maid_id uuid references public.maids(id),
  add column if not exists offer_expires_at timestamptz,
  add column if not exists offered_maids uuid[] not null default '{}';

alter table public.maids
  add column if not exists trial boolean not null default false,
  add column if not exists quiz_answers int[],
  add column if not exists quiz_score int;
grant insert (quiz_answers) on public.maids to authenticated;

-- ---------- 1) offers ----------
create or replace function public._pick_next_maid(b public.bookings) returns uuid
language sql stable security definer set search_path = public as $$
  select m.id from public.maids m
  where m.status = 'approved'
    and (select code from public.service_types where id = b.service_type_id) = any(m.services)
    and not (m.id = any(coalesce(b.offered_maids, '{}')))
    and not public.pair_blocked(b.customer_id, m.id)
    and public.maid_is_free(m.id, b.start_at, b.end_at, b.id)
    and not exists (select 1 from public.bookings x where b.team_id is not null and x.team_id = b.team_id and x.id <> b.id
                    and (x.maid_id = m.id or x.offer_maid_id = m.id))
  order by (m.district_id = b.district_id or b.district_id = any(coalesce(m.service_districts, '{}'))) desc,
    m.trial asc,
    (select avg(r.rating) from public.reviews r where r.maid_id = m.id) desc nulls last,
    (select count(*) from public.bookings x where x.maid_id = m.id and x.status = 'completed') desc,
    m.created_at
  limit 1
$$;

create or replace function public._dispatch_before() returns trigger
language plpgsql security definer set search_path = public as $$
declare mins int;
begin
  if new.status = 'awaiting_maid' and new.maid_id is null and new.needs_replacement then
    if new.offer_maid_id is not null and new.offer_expires_at > now() then return new; end if; -- offer still running
    if new.offer_maid_id is not null then
      new.offered_maids := array_append(new.offered_maids, new.offer_maid_id);
      new.offer_maid_id := null; new.offer_expires_at := null;
    end if;
    new.offer_maid_id := public._pick_next_maid(new);
    if new.offer_maid_id is not null then
      select offer_minutes into mins from public.settings;
      new.offer_expires_at := now() + make_interval(mins => coalesce(mins, 15));
    end if;
  elsif new.offer_maid_id is not null or new.offer_expires_at is not null then
    new.offer_maid_id := null; new.offer_expires_at := null;
  end if;
  return new;
exception when others then
  raise warning 'dispatch_failed: %', sqlerrm; -- never block the booking itself
  return new;
end $$;
revoke all on function public._dispatch_before() from public, anon, authenticated;
drop trigger if exists aa_dispatch on public.bookings;
create trigger aa_dispatch before update of status, maid_id, needs_replacement, offer_maid_id, start_at on public.bookings
  for each row execute function public._dispatch_before();

-- the offered helper declines -> next helper
create or replace function public.maid_decline_offer(p_booking_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.bookings set offered_maids = array_append(offered_maids, offer_maid_id), offer_maid_id = null, offer_expires_at = null
   where id = p_booking_id and offer_maid_id = auth.uid() and status = 'awaiting_maid' and maid_id is null;
  if not found then raise exception 'invalid_state'; end if;
end $$;
revoke all on function public.maid_decline_offer(bigint) from public, anon;
grant execute on function public.maid_decline_offer(bigint) to authenticated;

-- taking a job: while it is offered to someone else, only that helper can take it
create or replace function public.maid_take_job(p_booking_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare b bookings; begin
 select * into b from bookings where id=p_booking_id and maid_id is null and needs_replacement and status='awaiting_maid' for update;
 if b.id is null then raise exception 'job_taken'; end if;
 if b.offer_maid_id is not null and b.offer_expires_at > now() and b.offer_maid_id <> auth.uid() then raise exception 'job_offered_to_other'; end if;
 if not exists(select 1 from maids m join service_types st on st.id=b.service_type_id where m.id=auth.uid() and m.status='approved' and st.code=any(m.services)) then raise exception 'forbidden'; end if;
 if not maid_is_free(auth.uid(), b.start_at, b.end_at, b.id) then raise exception 'maid_busy'; end if;
 update bookings set maid_id=auth.uid(), status='confirmed', confirmed_at=now(), needs_replacement=false where id=b.id;
end $$;

-- every minute: expired offers move on to the next helper
create or replace function public.dispatch_expired_offers() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.bookings set offered_maids = array_append(offered_maids, offer_maid_id), offer_maid_id = null, offer_expires_at = null
   where offer_maid_id is not null and offer_expires_at <= now() and status = 'awaiting_maid' and maid_id is null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.dispatch_expired_offers() from public, anon, authenticated;
select cron.unschedule(jobid) from cron.job where jobname = 'cleendee-dispatch';
select cron.schedule('cleendee-dispatch', '* * * * *', 'select public.dispatch_expired_offers()');

-- tell the helper about a new offer
create or replace function public._ntf_offer() returns trigger language plpgsql security definer set search_path = public as $$
declare mins int := greatest(1, round(extract(epoch from (new.offer_expires_at - now())) / 60)::int);
begin
  if new.offer_maid_id is not null and new.offer_maid_id is distinct from old.offer_maid_id then
    perform public._notify(new.offer_maid_id, 'job', 'มีงานเสนอให้คุณ ' || public._bkk(new.start_at), 'Job offer for you: ' || public._bkk(new.start_at),
      'ค่าจ้าง ' || new.maid_payout || ' บาท · ตอบรับภายใน ' || mins || ' นาที', 'Pay ' || new.maid_payout || ' THB · answer within ' || mins || ' min', '/maid#maid-offers', 'offer:' || new.id);
  end if;
  if old.offer_maid_id is not null and new.offer_maid_id is distinct from old.offer_maid_id then
    perform public._resolve_admin_alert('offer:' || new.id);
  end if;
  return null;
exception when others then
  raise warning 'notify_failed %: %', tg_table_name, sqlerrm;
  return null;
end $$;
revoke all on function public._ntf_offer() from public, anon, authenticated;
drop trigger if exists zz_notify_offer on public.bookings;
-- no column list: the offer is usually set by the dispatch trigger, not by the statement itself
create trigger zz_notify_offer after update on public.bookings for each row
  when (new.offer_maid_id is distinct from old.offer_maid_id) execute function public._ntf_offer();

-- ---------- 2) quiz and trial ----------
create or replace function public._maid_quiz_check() returns trigger language plpgsql as $$
declare key int[] := array[1, 2, 0, 1, 2]; score int := 0; i int;
begin
  if new.status <> 'pending' or auth.uid() is null or auth.uid() <> new.id then return new; end if;
  if new.quiz_answers is null or array_length(new.quiz_answers, 1) <> array_length(key, 1) then raise exception 'quiz_required'; end if;
  for i in 1..array_length(key, 1) loop if new.quiz_answers[i] = key[i] then score := score + 1; end if; end loop;
  new.quiz_score := score;
  if score < 4 then raise exception 'quiz_failed'; end if;
  return new;
end $$;
drop trigger if exists maid_quiz_check on public.maids;
create trigger maid_quiz_check before insert on public.maids for each row execute function public._maid_quiz_check();

create or replace function public._maid_trial_start() returns trigger language plpgsql as $$
begin
  if old.status = 'pending' and new.status = 'approved' then new.trial := true; end if;
  return new;
end $$;
drop trigger if exists maid_trial_start on public.maids;
create trigger maid_trial_start before update of status on public.maids for each row execute function public._maid_trial_start();

-- first review of 4 stars or more ends the trial
create or replace function public._maid_trial_end() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.rating >= 4 and exists (select 1 from public.maids where id = new.maid_id and trial) then
    update public.maids set trial = false where id = new.maid_id;
    perform public._notify(new.maid_id, 'maid', 'ผ่านช่วงทดลองงานแล้ว', 'Trial passed', 'ลูกค้าให้คะแนน ' || new.rating || ' ดาว', 'Customer rated ' || new.rating || ' stars', '/maid');
  end if;
  return null;
exception when others then return null;
end $$;
revoke all on function public._maid_trial_end() from public, anon, authenticated;
drop trigger if exists maid_trial_end on public.reviews;
create trigger maid_trial_end after insert on public.reviews for each row execute function public._maid_trial_end();

create or replace function public.admin_set_maid_trial(p_maid uuid, p_trial boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  update maids set trial = coalesce(p_trial, false) where id = p_maid;
end $$;
revoke all on function public.admin_set_maid_trial(uuid, boolean) from public, anon;
grant execute on function public.admin_set_maid_trial(uuid, boolean) to authenticated;

-- ---------- 3) tiers ----------
create or replace function public._customer_tier(p_customer uuid) returns json
language sql stable security definer set search_path = public as $$
  with s as (select * from settings limit 1),
  spent as (select coalesce(sum(total_price), 0)::int v from bookings where customer_id = p_customer and status = 'completed')
  select json_build_object(
    'spent', spent.v,
    'tier', case when spent.v >= s.tier_platinum then 'platinum' when spent.v >= s.tier_gold then 'gold' when spent.v >= s.tier_silver then 'silver' else 'member' end,
    'mult', case when spent.v >= s.tier_platinum then s.mult_platinum when spent.v >= s.tier_gold then s.mult_gold when spent.v >= s.tier_silver then s.mult_silver else 1 end,
    'next', case when spent.v >= s.tier_platinum then null when spent.v >= s.tier_gold then 'platinum' when spent.v >= s.tier_silver then 'gold' else 'silver' end,
    'next_at', case when spent.v >= s.tier_platinum then null when spent.v >= s.tier_gold then s.tier_platinum when spent.v >= s.tier_silver then s.tier_gold else s.tier_silver end,
    'levels', json_build_object('silver', s.tier_silver, 'gold', s.tier_gold, 'platinum', s.tier_platinum),
    'mults', json_build_object('member', 1, 'silver', s.mult_silver, 'gold', s.mult_gold, 'platinum', s.mult_platinum))
  from s, spent
$$;
revoke all on function public._customer_tier(uuid) from public, anon, authenticated;
create or replace function public.my_tier() returns json language sql stable security definer set search_path = public as $$
  select public._customer_tier(auth.uid()) where auth.uid() is not null
$$;
revoke all on function public.my_tier() from public, anon;
grant execute on function public.my_tier() to authenticated;

create or replace function public.admin_update_tiers(p json) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  update settings set
    tier_silver = coalesce((p->>'tier_silver')::int, tier_silver), tier_gold = coalesce((p->>'tier_gold')::int, tier_gold),
    tier_platinum = coalesce((p->>'tier_platinum')::int, tier_platinum),
    mult_silver = coalesce((p->>'mult_silver')::numeric, mult_silver), mult_gold = coalesce((p->>'mult_gold')::numeric, mult_gold),
    mult_platinum = coalesce((p->>'mult_platinum')::numeric, mult_platinum),
    offer_minutes = coalesce((p->>'offer_minutes')::int, offer_minutes);
  if (select not (0 < tier_silver and tier_silver < tier_gold and tier_gold < tier_platinum and mult_silver >= 1 and mult_gold >= mult_silver
      and mult_platinum >= mult_gold and mult_platinum <= 5 and offer_minutes between 1 and 240) from settings) then raise exception 'invalid_input'; end if;
end $$;
revoke all on function public.admin_update_tiers(json) from public, anon;
grant execute on function public.admin_update_tiers(json) to authenticated;

-- points on completion use the customer's tier (based on what they spent before this job)
create or replace function public.maid_update_progress(p_booking_id bigint, p_step text, p_lat double precision default null, p_lng double precision default null) returns void
language plpgsql security definer set search_path = public as $$
declare b bookings; s settings; earn int; mult numeric; begin
 select * into b from bookings where id=p_booking_id and maid_id=auth.uid() for update;
 if b.id is null then raise exception 'forbidden'; end if;
 if p_lat is not null then
  insert into maid_locations values(b.id,p_lat,p_lng,now()) on conflict(booking_id) do update set lat=excluded.lat,lng=excluded.lng,updated_at=now();
 end if;
 if p_step='location' and b.status='on_the_way' then return;
 elsif p_step='on_the_way' and b.status='confirmed' then update bookings set status='on_the_way' where id=b.id;
 elsif p_step='working' and b.status='on_the_way' then update bookings set status='working' where id=b.id;
 elsif p_step='completed' and b.status='working' then
  mult := coalesce((public._customer_tier(b.customer_id)->>'mult')::numeric, 1);
  update bookings set status='completed', completed_at=now() where id=b.id;
  insert into payouts(booking_id,maid_id,amount) values(b.id,b.maid_id,b.maid_payout);
  select * into s from settings; earn := floor(b.total_price::numeric / s.baht_per_point * mult)::int;
  if earn > 0 then
   update profiles set points=points+earn where id=b.customer_id;
   insert into points_ledger(customer_id,delta,reason,booking_id) values(b.customer_id,earn,'earn',b.id);
  end if;
 else raise exception 'invalid_state'; end if;
end $$;
grant select (trial) on public.maids to anon, authenticated; -- 'new helper' badge in the app
