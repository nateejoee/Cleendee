-- Two-way ratings like Grab / LINE MAN / Bolt:
-- tags depend on the stars, helpers rate customers, 1-2 stars alert the admin and stop the pair being matched again.

-- 1) Helper -> customer ratings
create table public.customer_reviews (
  id bigint generated always as identity primary key,
  booking_id bigint not null unique references public.bookings(id),
  maid_id uuid not null references public.maids(id),
  customer_id uuid not null references public.profiles(id),
  rating int not null check (rating between 1 and 5),
  tags text[] not null default '{}',
  comment text,
  admin_seen boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.customer_reviews enable row level security;
revoke all on public.customer_reviews from anon, authenticated;
grant select on public.customer_reviews to authenticated;
create policy cr_read on public.customer_reviews for select to authenticated using (maid_id = auth.uid() or public.is_admin());
create index on public.customer_reviews (customer_id);

alter table public.reviews add column admin_seen boolean not null default false;

-- 2) Pairs that must not be matched again
create table public.pair_blocks (
  customer_id uuid not null references public.profiles(id) on delete cascade,
  maid_id uuid not null references public.maids(id) on delete cascade,
  by_side text not null check (by_side in ('customer','maid')),
  booking_id bigint references public.bookings(id),
  created_at timestamptz not null default now(),
  primary key (customer_id, maid_id)
);
alter table public.pair_blocks enable row level security;
revoke all on public.pair_blocks from anon, authenticated;

create function public.pair_blocked(p_customer uuid, p_maid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from pair_blocks where customer_id = p_customer and maid_id = p_maid) $$;
revoke all on function public.pair_blocked(uuid, uuid) from public, anon;
grant execute on function public.pair_blocked(uuid, uuid) to authenticated;

-- customer: helpers hidden from me
create function public.my_blocked_maids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select maid_id from pair_blocks where customer_id = auth.uid() $$;
revoke all on function public.my_blocked_maids() from public, anon;
grant execute on function public.my_blocked_maids() to authenticated;

-- every path that puts a helper on a booking (choose, package, take urgent job, admin) respects the block
create function public.guard_pair_block() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.maid_id is not null and (tg_op = 'INSERT' or new.maid_id is distinct from old.maid_id)
     and pair_blocked(new.customer_id, new.maid_id) then
    raise exception 'maid_not_available';
  end if;
  return new;
end $$;
create trigger guard_pair_block before insert or update of maid_id on public.bookings
for each row execute function public.guard_pair_block();

-- urgent / open jobs are not shown to a blocked helper
drop policy bk_read on public.bookings;
create policy bk_read on public.bookings for select using (
  customer_id = auth.uid() or maid_id = auth.uid() or is_admin()
  or (needs_replacement and status = 'awaiting_maid' and maid_id is null
      and exists(select 1 from maids m where m.id = auth.uid() and m.status = 'approved')
      and not pair_blocked(customer_id, auth.uid())));

-- 3) Tags allowed for each side and star level
create function public.rating_tags(p_side text, p_rating int, p_tags text[]) returns text[]
language sql immutable set search_path = public as $$
  select coalesce(array_agg(distinct t), '{}') from unnest(coalesce(p_tags, '{}')) t
  where t = any(case
    when p_side = 'customer' and p_rating >= 4 then array['r_ontime','r_clean','r_polite','r_detail','r_fast','r_value']
    when p_side = 'customer' then array['rb_late','rb_notclean','rb_missed','rb_rude','rb_damage','rb_early']
    when p_rating >= 4 then array['rc_access','rc_kind','rc_clear','rc_asdesc']
    else array['rcb_noshow','rcb_morework','rcb_rude','rcb_pet','rcb_unsafe'] end) $$;

-- 4) Customer rates the helper (replaces the old version: tag filtering + block on 1-2 stars)
create or replace function public.submit_review(p_booking_id bigint, p_rating integer, p_tags text[] default '{}', p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare b bookings; begin
  select * into b from bookings where id = p_booking_id and customer_id = auth.uid() and status = 'completed';
  if b.id is null or b.maid_id is null then raise exception 'invalid_state'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'invalid_state'; end if;
  insert into reviews(booking_id, maid_id, customer_id, rating, tags, comment)
  values (b.id, b.maid_id, b.customer_id, p_rating, rating_tags('customer', p_rating, p_tags), nullif(mask_text(p_comment), ''));
  if p_rating <= 2 then
    insert into pair_blocks(customer_id, maid_id, by_side, booking_id) values (b.customer_id, b.maid_id, 'customer', b.id) on conflict do nothing;
  end if;
end $$;

-- 5) Helper rates the customer
create function public.submit_customer_review(p_booking_id bigint, p_rating integer, p_tags text[] default '{}', p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare b bookings; begin
  select * into b from bookings where id = p_booking_id and maid_id = auth.uid() and status = 'completed';
  if b.id is null then raise exception 'invalid_state'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'invalid_state'; end if;
  insert into customer_reviews(booking_id, maid_id, customer_id, rating, tags, comment)
  values (b.id, b.maid_id, b.customer_id, p_rating, rating_tags('maid', p_rating, p_tags), nullif(mask_text(p_comment), ''));
  if p_rating <= 2 then
    insert into pair_blocks(customer_id, maid_id, by_side, booking_id) values (b.customer_id, b.maid_id, 'maid', b.id) on conflict do nothing;
  end if;
end $$;
revoke all on function public.submit_customer_review(bigint, integer, text[], text) from public, anon;
grant execute on function public.submit_customer_review(bigint, integer, text[], text) to authenticated;

-- 6) Jobs waiting for my rating (last 7 days) - drives the pop-up after a job ends
create function public.my_rating_prompts() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(x order by x.completed_at desc), '[]') from (
    select b.id, 'customer' as side, b.completed_at, b.start_at, st.code as service_code, m.nickname as other_name
    from bookings b join maids m on m.id = b.maid_id join service_types st on st.id = b.service_type_id
    where b.customer_id = auth.uid() and b.status = 'completed' and b.completed_at > now() - interval '7 days'
      and not exists(select 1 from reviews r where r.booking_id = b.id)
    union all
    select b.id, 'maid', b.completed_at, b.start_at, st.code,
      coalesce(nullif(split_part(trim(coalesce(p.full_name, '')), ' ', 1), ''), 'ลูกค้า')
    from bookings b join profiles p on p.id = b.customer_id join service_types st on st.id = b.service_type_id
    where b.maid_id = auth.uid() and b.status = 'completed' and b.completed_at > now() - interval '7 days'
      and not exists(select 1 from customer_reviews r where r.booking_id = b.id)
  ) x $$;
revoke all on function public.my_rating_prompts() from public, anon;
grant execute on function public.my_rating_prompts() to authenticated;

-- 7) Helper sees the customer's rating before taking a job
create or replace function public.maid_job_info(p_booking_id bigint)
returns json language plpgsql stable security definer set search_path = public as $$
declare b bookings; p profiles;
begin
 select * into b from bookings where id=p_booking_id;
 if b.id is null then raise exception 'forbidden'; end if;
 if not (b.maid_id=auth.uid() or is_admin() or (b.maid_id is null and b.needs_replacement and b.status='awaiting_maid'
     and not pair_blocked(b.customer_id, auth.uid())
     and exists(select 1 from maids m join service_types st on st.id=b.service_type_id where m.id=auth.uid() and m.status='approved' and st.code=any(m.services)))) then
  raise exception 'forbidden'; end if;
 select * into p from profiles where id=b.customer_id;
 return json_build_object('first_name', coalesce(nullif(split_part(trim(coalesce(p.full_name,'')),' ',1),''),'ลูกค้า'),
  'jobs_done', (select count(*) from bookings x where x.customer_id=b.customer_id and x.status='completed'),
  'member_since', p.created_at,
  'service_code', (select code from service_types where id=b.service_type_id),
  'rating', (select round(avg(rating)::numeric,1) from customer_reviews where customer_id=b.customer_id),
  'rating_count', (select count(*) from customer_reviews where customer_id=b.customer_id));
end $$;

-- 8) Admin: low ratings queue (both directions) and acknowledging them
create function public.admin_low_ratings() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return (select coalesce(json_agg(x order by x.created_at desc), '[]') from (
    select 'customer' as side, r.id, r.booking_id, r.rating, r.tags, r.comment, r.created_at, r.admin_seen,
      m.nickname as maid_name, p.full_name as customer_name
    from reviews r join maids m on m.id = r.maid_id join profiles p on p.id = r.customer_id where r.rating <= 2
    union all
    select 'maid', r.id, r.booking_id, r.rating, r.tags, r.comment, r.created_at, r.admin_seen, m.nickname, p.full_name
    from customer_reviews r join maids m on m.id = r.maid_id join profiles p on p.id = r.customer_id where r.rating <= 2
  ) x where not x.admin_seen or x.created_at > now() - interval '30 days');
end $$;
revoke all on function public.admin_low_ratings() from public, anon;
grant execute on function public.admin_low_ratings() to authenticated;

create function public.admin_ack_low_rating(p_side text, p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if p_side = 'customer' then update reviews set admin_seen = true where id = p_id;
  else update customer_reviews set admin_seen = true where id = p_id; end if;
end $$;
revoke all on function public.admin_ack_low_rating(text, bigint) from public, anon;
grant execute on function public.admin_ack_low_rating(text, bigint) to authenticated;

-- admin needs every helper's average, not only approved ones
create function public.admin_maid_ratings() returns table(maid_id uuid, avg_rating numeric, review_count int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return query select r.maid_id, round(avg(r.rating)::numeric, 1), count(*)::int from reviews r group by r.maid_id;
end $$;
revoke all on function public.admin_maid_ratings() from public, anon;
grant execute on function public.admin_maid_ratings() to authenticated;
