-- Team bookings: one job done by 2 helpers at the same time.
-- Price = people x hours (each helper works the chosen hours). The customer may pick 0, 1 or 2 helpers;
-- the rest are found by the system. Each helper has their own booking row (so arrival, chat, payout and
-- reviews work as before). The first row is the lead (team_id = its own id) and carries add-ons,
-- discounts and points; the second row (team_id = lead id) carries that helper's share of the price.
-- If no one takes the second place, the admin refunds that row's share and the first helper still works.

alter table public.service_types add column if not exists allow_team boolean not null default false;
update public.service_types set allow_team = true where code in ('general_cleaning', 'deep_cleaning', 'office_cleaning');

alter table public.bookings add column if not exists team_id bigint references public.bookings(id);
create index if not exists bookings_team_idx on public.bookings (team_id) where team_id is not null;

-- quote: p_people helpers, p_chosen of them picked by the customer (null = 1 if p_chose_maid)
drop function if exists public.quote_booking_v2(text, integer, text[], boolean, timestamptz, boolean, text);
create function public.quote_booking_v2(p_service_code text, p_qty integer, p_addons text[], p_chose_maid boolean, p_start_at timestamptz,
  p_use_points boolean default false, p_promo text default null, p_people integer default 1, p_chosen integer default null)
returns json language plpgsql stable security definer set search_path = public as $$
declare s settings; st service_types; pts int := 0; base int; base_each int; mins int; hrs int; add_price int := 0; add_pay int := 0; add_min int := 0;
  fee int; chosen int; urgent int := 0; urgent_each int := 0; bonus int := 0; first boolean := false; first_disc int := 0; promo_disc int := 0; promo_err text; pc promo_codes;
  sub int; disc int; applied text; n int := 0; pay_each int; ppl int := coalesce(p_people, 1);
begin
 select * into s from settings; select * into st from service_types where code=p_service_code and active;
 if st.id is null then raise exception 'service_unavailable'; end if;
 if p_qty is null or p_qty < st.min_qty or p_qty > st.max_qty then raise exception 'qty_out_of_range'; end if;
 if ppl not in (1, 2) or (ppl = 2 and not st.allow_team) then raise exception 'team_not_available'; end if;
 chosen := least(ppl, greatest(0, coalesce(p_chosen, case when p_chose_maid then 1 else 0 end)));
 base_each := p_qty * st.price_per_unit;
 base := base_each * ppl;
 mins := case when st.pricing='hourly' then p_qty*60 else p_qty*st.minutes_per_unit end;
 select coalesce(sum(a.price),0), coalesce(sum(a.maid_payout),0), coalesce(sum(a.minutes),0) into add_price, add_pay, add_min
   from service_addons a where a.code = any(coalesce(p_addons,'{}')) and a.active and p_service_code = any(a.service_codes);
 hrs := ceil((mins + add_min)/60.0);
 fee := s.choose_maid_fee * chosen;
 if p_start_at is not null and p_start_at < now() + make_interval(mins => s.normal_lead_minutes) then
   urgent_each := s.urgent_fee; urgent := s.urgent_fee * ppl; bonus := s.urgent_maid_bonus; end if;
 sub := base + add_price + fee + urgent;
 if auth.uid() is not null then
  select points into pts from profiles where id=auth.uid();
  select not exists(select 1 from bookings where customer_id=auth.uid() and status not in ('cancelled_by_customer','payment_rejected','refunded_no_maid')) into first;
  if first then first_disc := s.first_booking_discount; end if;
 end if;
 if nullif(trim(p_promo),'') is not null then
  select * into pc from promo_codes where code=upper(trim(p_promo));
  if pc.code is null or not pc.active then promo_err := 'promo_invalid';
  elsif (pc.starts_at is not null and pc.starts_at > now()) or (pc.ends_at is not null and pc.ends_at < now()) then promo_err := 'promo_expired';
  elsif pc.max_uses is not null and pc.used_count >= pc.max_uses then promo_err := 'promo_used_up';
  elsif auth.uid() is not null and pc.once_per_user and exists(select 1 from promo_redemptions r where r.code=pc.code and r.customer_id=auth.uid()) then promo_err := 'promo_already_used';
  elsif sub < pc.min_total then promo_err := 'promo_min_total';
  else
   promo_disc := case when pc.kind='amount' then pc.value else round(sub * pc.value / 100.0)::int end;
   if pc.max_discount is not null then promo_disc := least(promo_disc, pc.max_discount); end if;
  end if;
 end if;
 -- ส่วนลดจองครั้งแรกกับโค้ดส่วนลด ใช้อันที่มากกว่า (ไม่บวกกัน)
 if promo_disc >= first_disc and promo_disc > 0 then disc := promo_disc; applied := pc.code; else disc := first_disc; end if;
 disc := least(disc, sub);
 if p_use_points and auth.uid() is not null then n := least(coalesce(pts,0)/s.redeem_points, (sub-disc)/s.redeem_value); end if;
 pay_each := round(base_each * st.payout_pct / 100.0)::int + bonus;
 return json_build_object('qty',p_qty,'hours',hrs,'people',ppl,'chosen',chosen,'base',base,'base_each',base_each,'addons_price',add_price,
  'choose_maid_fee',fee,'choose_fee_each',s.choose_maid_fee,'urgent_fee',urgent,'urgent_each',urgent_each,
  'promo_discount',disc,'promo_code',applied,'promo_error',promo_err,'first_discount',(applied is null and disc>0),
  'points_used',n*s.redeem_points,'points_discount',n*s.redeem_value,'total',sub-disc-n*s.redeem_value,
  'maid_payout',pay_each + add_pay,'maid_payout_each',pay_each,'points_available',coalesce(pts,0));
end $$;
grant execute on function public.quote_booking_v2(text, integer, text[], boolean, timestamptz, boolean, text, integer, integer) to anon, authenticated;

drop function if exists public.create_booking_v2(text, integer, text[], uuid, timestamptz, bigint, text, text[], boolean, text);
create function public.create_booking_v2(p_service_code text, p_qty integer, p_addons text[], p_maid_id uuid, p_start_at timestamptz,
  p_address_id bigint, p_note text, p_tags text[], p_use_points boolean, p_promo text, p_people integer default 1, p_maid2 uuid default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare q json; s settings; st service_types; a customer_addresses; v_end timestamptz; v_id bigint; v_id2 bigint; v_pts int; v_code text;
  ppl int := coalesce(p_people, 1); m1 uuid := p_maid_id; m2 uuid := p_maid2; chosen int; p_total int; p_gross int; m uuid;
begin
 if auth.uid() is null then raise exception 'not_signed_in'; end if;
 if ppl not in (1, 2) then raise exception 'team_not_available'; end if;
 if ppl = 1 then m2 := null; end if;
 if m1 is null and m2 is not null then m1 := m2; m2 := null; end if;          -- the first picked helper leads
 if m2 is not null and m2 = m1 then raise exception 'same_helper_twice'; end if;
 chosen := (m1 is not null)::int + (m2 is not null)::int;
 select * into s from settings; select * into st from service_types where code=p_service_code and active;
 if st.id is null then raise exception 'service_unavailable'; end if;
 if p_start_at < now() + make_interval(mins => s.urgent_min_lead_minutes) then raise exception 'start_too_soon'; end if;
 select * into a from customer_addresses where id=p_address_id and customer_id=auth.uid();
 if a.id is null then raise exception 'address_not_found'; end if;
 if not exists(select 1 from districts d join provinces p on p.code=d.province_code where d.id=a.district_id and d.active and p.active) then raise exception 'area_not_served'; end if;
 q := quote_booking_v2(p_service_code, p_qty, p_addons, chosen > 0, p_start_at, p_use_points, p_promo, ppl, chosen);
 if q->>'promo_error' is not null then raise exception '%', q->>'promo_error'; end if;
 v_end := p_start_at + make_interval(hours => (q->>'hours')::int);
 foreach m in array array_remove(array[m1, m2], null) loop
  if not exists(select 1 from maids where id=m and status='approved' and p_service_code = any(services)) then raise exception 'maid_not_available'; end if;
  if not maid_is_free(m, p_start_at, v_end) then raise exception 'maid_busy'; end if;
 end loop;
 -- second helper's share of the price (their hours + their pick fee + their urgent fee), never more than the total
 p_gross := case when ppl = 2 then (q->>'base_each')::int + case when m2 is not null then (q->>'choose_fee_each')::int else 0 end + (q->>'urgent_each')::int else 0 end;
 p_total := least(p_gross, (q->>'total')::int);
 v_pts := (q->>'points_used')::int; v_code := q->>'promo_code';
 insert into bookings(customer_id,maid_id,chose_maid,service_type_id,district_id,start_at,end_at,note,tags,qty,addons,addons_price,urgent_fee,promo_code,
   base_price,choose_maid_fee,points_used,points_discount,promo_discount,total_price,maid_payout,needs_replacement)
 values(auth.uid(),m1,m1 is not null,st.id,a.district_id,p_start_at,v_end,nullif(mask_text(p_note),''),coalesce(p_tags,'{}'),p_qty,
   coalesce((select array_agg(x.code order by x.sort) from service_addons x where x.code=any(coalesce(p_addons,'{}')) and x.active and p_service_code=any(x.service_codes)),'{}'),
   (q->>'addons_price')::int,(q->>'urgent_fee')::int - case when ppl = 2 then (q->>'urgent_each')::int else 0 end,v_code,
   (q->>'base')::int - case when ppl = 2 then (q->>'base_each')::int else 0 end,
   case when m1 is not null then (q->>'choose_fee_each')::int else 0 end,
   v_pts,(q->>'points_discount')::int,(q->>'promo_discount')::int,(q->>'total')::int - p_total,
   (q->>'maid_payout')::int, m1 is null)
 returning id into v_id;
 insert into booking_addresses values(v_id,a.address,a.lat,a.lng);
 if ppl = 2 then
  update bookings set team_id = v_id where id = v_id;
  insert into bookings(customer_id,maid_id,chose_maid,service_type_id,district_id,start_at,end_at,note,tags,qty,addons,addons_price,urgent_fee,
    base_price,choose_maid_fee,points_used,points_discount,promo_discount,total_price,maid_payout,needs_replacement,team_id)
  values(auth.uid(),m2,m2 is not null,st.id,a.district_id,p_start_at,v_end,nullif(mask_text(p_note),''),coalesce(p_tags,'{}'),p_qty,'{}',0,(q->>'urgent_each')::int,
    (q->>'base_each')::int, case when m2 is not null then (q->>'choose_fee_each')::int else 0 end, 0, 0, 0, p_total,
    (q->>'maid_payout_each')::int, m2 is null, v_id)
  returning id into v_id2;
  insert into booking_addresses values(v_id2,a.address,a.lat,a.lng);
 end if;
 if v_pts > 0 then
  update profiles set points=points-v_pts where id=auth.uid();
  insert into points_ledger(customer_id,delta,reason,booking_id) values(auth.uid(),-v_pts,'redeem',v_id);
 end if;
 if v_code is not null then
  update promo_codes set used_count=used_count+1 where code=v_code;
  insert into promo_redemptions(code,customer_id,booking_id) values(v_code,auth.uid(),v_id);
 end if;
 return v_id;
end $$;
revoke all on function public.create_booking_v2(text, integer, text[], uuid, timestamptz, bigint, text, text[], boolean, text, integer, uuid) from public, anon;
grant execute on function public.create_booking_v2(text, integer, text[], uuid, timestamptz, bigint, text, text[], boolean, text, integer, uuid) to authenticated;

-- times: for a team, every picked helper must be free and enough other helpers must be free for the empty places
drop function if exists public.booking_times(date, uuid, text, integer, text);
create function public.booking_times(p_date date, p_maid uuid, p_service_code text, p_hours integer, p_plan text, p_maid2 uuid default null, p_people integer default 1)
returns table(start_time time, urgent boolean) language sql stable security definer set search_path = public as $$
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
    and (coalesce(p_people,1) < 2 or (
      p_plan = 'once'
      and exists(select 1 from public.service_types t where t.code=p_service_code and t.allow_team)
      and (p_maid2 is null or (p_maid2 is distinct from p_maid and exists(select 1 from public.maids m where m.id=p_maid2 and m.status='approved' and p_service_code=any(m.services))
           and public.maid_is_free(p_maid2, (p_date+s.start_time) at time zone 'Asia/Bangkok', ((p_date+s.start_time) at time zone 'Asia/Bangkok') + make_interval(hours=>p_hours))))
      and (select count(*) from public.maids m where m.status='approved' and p_service_code=any(m.services)
             and m.id is distinct from p_maid and m.id is distinct from p_maid2
             and public.maid_is_free(m.id, (p_date+s.start_time) at time zone 'Asia/Bangkok', ((p_date+s.start_time) at time zone 'Asia/Bangkok') + make_interval(hours=>p_hours)))
          >= 2 - (p_maid is not null)::int - (p_maid2 is not null)::int
    ))
  order by s.start_time
$$;
revoke all on function public.booking_times(date, uuid, text, integer, text, uuid, integer) from public, anon;
grant execute on function public.booking_times(date, uuid, text, integer, text, uuid, integer) to authenticated;

-- one slip pays the whole team
create or replace function public.submit_payment_slip(p_booking_id bigint, p_slip_path text) returns void
language plpgsql security definer set search_path = public as $$
declare b bookings; amt int; begin
 select * into b from bookings where id=p_booking_id and customer_id=auth.uid() and package_id is null for update;
 if b.id is null or b.status not in ('pending_payment','payment_rejected') then raise exception 'invalid_state'; end if;
 if b.team_id is not null and b.team_id <> b.id then raise exception 'invalid_state'; end if; -- pay on the lead booking
 select sum(total_price) into amt from bookings where id = b.id or team_id = b.id;
 insert into payments(booking_id,amount,slip_path) values(b.id,amt,p_slip_path);
 update bookings set status='payment_review' where (id=b.id or team_id=b.id) and status in ('pending_payment','payment_rejected');
end $$;

create or replace function public.admin_review_payment(p_payment_id bigint, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare p payments; b bookings; begin
 if not is_admin() then raise exception 'forbidden'; end if;
 select * into p from payments where id=p_payment_id and status='pending' for update;
 if p.id is null then raise exception 'invalid_state'; end if;
 update payments set status=case when p_approve then 'approved'::review_status else 'rejected' end, reviewed_at=now() where id=p.id;
 for b in select * from bookings where (id=p.booking_id or team_id=p.booking_id or package_id=p.package_id) and status='payment_review' loop
  if p_approve then update bookings set status='awaiting_maid', needs_replacement=(maid_id is null) where id=b.id;
  else update bookings set status='payment_rejected' where id=b.id; end if;
 end loop;
 if p.package_id is not null then update packages set status=case when p_approve then 'active' else 'payment_rejected' end where id=p.package_id; end if;
 if p_approve then perform _refund_if_cancelled(p); end if;
end $$;

create or replace function public.record_slip_check(p_payment_id bigint, p_result text, p_trans_ref text, p_note text) returns text
language plpgsql security definer set search_path = public as $$
declare p payments; b bookings;
begin
  select * into p from payments where id = p_payment_id and status = 'pending' for update;
  if p.id is null then return 'not_pending'; end if;
  if p_result = 'approve' then
    if p_trans_ref is null then
      p_result := 'pending'; p_note := 'no_trans_ref';
    elsif exists(select 1 from payments where trans_ref = p_trans_ref) then
      p_result := 'reject'; p_note := 'duplicate_slip';
    else
      update payments set status = 'approved', reviewed_at = now(), trans_ref = p_trans_ref, auto_checked = true, check_note = p_note where id = p.id;
      for b in select * from bookings where (id = p.booking_id or team_id = p.booking_id or package_id = p.package_id) and status = 'payment_review' loop
        update bookings set status = 'awaiting_maid', needs_replacement = (maid_id is null) where id = b.id;
      end loop;
      if p.package_id is not null then update packages set status = 'active' where id = p.package_id; end if;
      perform _refund_if_cancelled(p);
      return 'approved';
    end if;
  end if;
  if p_result = 'reject' then
    update payments set status = 'rejected', reviewed_at = now(), auto_checked = true, check_note = p_note where id = p.id;
    update bookings set status = 'payment_rejected' where (id = p.booking_id or team_id = p.booking_id or package_id = p.package_id) and status = 'payment_review';
    if p.package_id is not null then update packages set status = 'payment_rejected' where id = p.package_id; end if;
    return 'rejected:' || p_note;
  end if;
  update payments set auto_checked = true, check_note = p_note where id = p.id;
  return 'pending';
end $$;

-- cancelling a team booking cancels both places; each place is refunded by the usual rules
alter function public.customer_cancel(bigint) rename to _customer_cancel_row;
revoke all on function public._customer_cancel_row(bigint) from public, anon, authenticated;
create function public.customer_cancel(p_booking_id bigint) returns json
language plpgsql security definer set search_path = public as $$
declare lead bigint; r record; j json; refund int := 0; maid_amt int := 0; pts int := 0; after_check boolean := false; n int := 0;
begin
 select coalesce(team_id, id) into lead from bookings where id = p_booking_id and customer_id = auth.uid();
 if lead is null then raise exception 'invalid_state'; end if;
 for r in select id from bookings where (id = lead or team_id = lead)
     and status in ('pending_payment','payment_review','awaiting_maid','confirmed','payment_rejected') order by id loop
  j := public._customer_cancel_row(r.id); n := n + 1;
  refund := refund + (j->>'refund')::int; maid_amt := maid_amt + (j->>'maid_amount')::int; pts := pts + (j->>'points_returned')::int;
  after_check := after_check or (j->>'refund_after_check')::boolean;
 end loop;
 if n = 0 then raise exception 'invalid_state'; end if;
 return json_build_object('refund',refund,'maid_amount',maid_amt,'points_returned',pts,'refund_after_check',after_check);
end $$;
revoke all on function public.customer_cancel(bigint) from public, anon;
grant execute on function public.customer_cancel(bigint) to authenticated;

create or replace function public.customer_reschedule(p_booking_id bigint, p_start_at timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare b bookings; s settings; dur interval; lead bigint;
begin
 select * into s from settings;
 select coalesce(team_id, id) into lead from bookings where id=p_booking_id and customer_id=auth.uid();
 if lead is null then raise exception 'invalid_state'; end if;
 for b in select * from bookings where (id = lead or team_id = lead) and customer_id = auth.uid()
     and status not in ('cancelled_by_customer','refunded_no_maid') order by id for update loop
  if b.status not in ('pending_payment','payment_review','awaiting_maid','confirmed') then raise exception 'invalid_state'; end if;
  if b.start_at < now() + make_interval(hours => s.reschedule_min_hours) then raise exception 'reschedule_too_late'; end if;
  if p_start_at < now() + make_interval(mins => s.normal_lead_minutes) then raise exception 'start_too_soon'; end if;
  dur := b.end_at - b.start_at;
  if b.maid_id is not null and not maid_is_free(b.maid_id, p_start_at, p_start_at + dur, b.id) then raise exception 'maid_busy'; end if;
  update bookings set start_at=p_start_at, end_at=p_start_at+dur, rescheduled_at=now() where id=b.id;
 end loop;
end $$;

-- notifications: the second place of a team sends only what matters (helper found, on the way, no helper -> partial refund)
create or replace function public._ntf_bookings() returns trigger language plpgsql security definer set search_path = public as $$
declare w text := public._bkk(new.start_at); nick text; lead bigint := coalesce(new.team_id, new.id); second boolean := new.team_id is not null and new.team_id <> new.id;
  link text := '/bookings/' || coalesce(new.team_id, new.id); mlink text := '/maid/job/' || new.id;
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    case new.status
      when 'awaiting_maid' then
        if not second then
          perform public._notify(new.customer_id, 'booking', 'ชำระเงินสำเร็จ กำลังหาแม่บ้าน', 'Payment received, finding a helper', 'งาน #' || lead || ' วันที่ ' || w, 'Booking #' || lead || ' on ' || w, link);
        end if;
        perform public._notify_admins('admin_unmatched', case when second then 'หาแม่บ้านคนที่ 2 งาน #' || lead else 'งานรอแม่บ้าน #' || new.id end,
          case when second then 'Second helper needed for #' || lead else 'Booking #' || new.id || ' needs a helper' end, 'วันที่ ' || w, 'On ' || w, '/admin#unmatched', 'unmatched:' || new.id);
      when 'confirmed' then
        select nickname into nick from public.maids where id = new.maid_id;
        perform public._notify(new.customer_id, 'booking', case when second then 'ได้แม่บ้านคนที่ 2 แล้ว' else 'ยืนยันการจองแล้ว' end,
          case when second then 'Second helper confirmed' else 'Booking confirmed' end, coalesce('แม่บ้าน ' || nick || ' · ', '') || w, coalesce(nick || ' · ', '') || w, link);
        perform public._notify(new.maid_id, 'job', 'คุณได้งานใหม่ #' || new.id, 'New job #' || new.id, 'วันที่ ' || w, 'On ' || w, mlink);
        perform public._resolve_admin_alert('unmatched:' || new.id);
      when 'on_the_way' then
        select nickname into nick from public.maids where id = new.maid_id;
        perform public._notify(new.customer_id, 'booking', 'แม่บ้าน' || coalesce(' ' || nick, '') || ' กำลังเดินทางไปหาคุณ', 'Your helper' || coalesce(' ' || nick, '') || ' is on the way', 'งาน #' || lead, 'Booking #' || lead, '/bookings/' || new.id);
      when 'completed' then
        if not second then
          perform public._notify(new.customer_id, 'booking', 'งานเสร็จแล้ว ให้คะแนนแม่บ้านได้เลย', 'Job done. Please rate your helper', 'งาน #' || new.id, 'Booking #' || new.id, link);
        end if;
      when 'cancelled_by_customer' then
        perform public._notify(new.maid_id, 'job', 'ลูกค้ายกเลิกงาน #' || new.id, 'Customer cancelled job #' || new.id, 'วันที่ ' || w, 'On ' || w, '/maid');
      when 'refunded_no_maid' then
        perform public._notify(new.customer_id, 'booking',
          case when second then 'ไม่มีแม่บ้านคนที่ 2 คืนเงินส่วนนี้ ' || new.total_price || ' บาท' else 'ไม่มีแม่บ้านรับงาน คืนเงินเต็มจำนวน' end,
          case when second then 'No second helper, refunding ' || new.total_price || ' THB' else 'No helper available, full refund' end, 'งาน #' || lead, 'Booking #' || lead, link);
        perform public._resolve_admin_alert('unmatched:' || new.id);
      when 'payment_rejected' then
        if not second then
          perform public._notify(new.customer_id, 'payment', 'สลิปไม่ผ่าน กรุณาแนบใหม่', 'Slip not accepted, please upload again', 'งาน #' || new.id, 'Booking #' || new.id, link);
        end if;
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
exception when others then
  raise warning 'notify_failed %: %', tg_table_name, sqlerrm;
  return null;
end $$;

-- admin switch: which services can be booked with 2 helpers
create or replace function public.admin_set_service_team(p_code text, p_allow boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  update service_types set allow_team = coalesce(p_allow, false) where code = p_code;
  if not found then raise exception 'service_unavailable'; end if;
end $$;
revoke all on function public.admin_set_service_team(text, boolean) from public, anon;
grant execute on function public.admin_set_service_team(text, boolean) to authenticated;
