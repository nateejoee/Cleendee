-- Customer phone: required before booking (no OTP), and shown to the assigned helper only while the
-- paid job is active (confirmed -> on the way -> working). Hidden again once the job is done or cancelled.

create or replace function public.set_my_phone(p_phone text) returns void
language plpgsql security definer set search_path = public as $$
declare ph text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if ph !~ '^0[0-9]{8,9}$' then raise exception 'phone_invalid'; end if;
  update public.profiles set phone = ph where id = auth.uid();
end $$;
revoke all on function public.set_my_phone(text) from public, anon;
grant execute on function public.set_my_phone(text) to authenticated;

-- every new booking needs a contact number on the customer's profile
create or replace function public._booking_needs_phone() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce((select phone from public.profiles where id = new.customer_id), '') = '' then raise exception 'phone_required'; end if;
  return new;
end $$;
revoke all on function public._booking_needs_phone() from public, anon, authenticated;
drop trigger if exists booking_needs_phone on public.bookings;
create trigger booking_needs_phone before insert on public.bookings for each row execute function public._booking_needs_phone();

-- job info for the helper: adds the customer's phone only for their own active, paid job
create or replace function public.maid_job_info(p_booking_id bigint)
 returns json language plpgsql stable security definer set search_path to 'public' as $function$
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
  'rating_count', (select count(*) from customer_reviews where customer_id=b.customer_id),
  'phone', case when b.maid_id = auth.uid() and b.status in ('confirmed','on_the_way','working') then p.phone end);
end $function$;
