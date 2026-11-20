-- Bug fixes from the 21 Nov 2026 review.

-- #1 + #2  Customer cancel:
--   * while the slip is still being checked: no refund is created yet (the money is not confirmed).
--     If the payment is approved later, a full refund is created automatically (see #1b below).
--   * paid but no helper has accepted yet: always a full refund (same rule as "no helper found").
create or replace function public.customer_cancel(p_booking_id bigint)
returns json language plpgsql security definer set search_path = public as $$
declare b bookings; r cancellation_rules; rst service_types; hrs numeric; refund int := 0; maid_amt int := 0; pts int := 0; v_st int;
begin
 select * into b from bookings where id=p_booking_id and customer_id=auth.uid() for update;
 if b.id is null or b.status not in ('pending_payment','payment_review','awaiting_maid','confirmed','payment_rejected') then raise exception 'invalid_state'; end if;
 if b.status in ('pending_payment','payment_rejected','payment_review') then
  pts := _return_points(b);
 elsif b.status = 'awaiting_maid' then
  -- paid, nobody has taken the job: full refund
  pts := _return_points(b);
  refund := b.total_price;
  insert into refunds(booking_id,amount,points_returned) values(b.id,refund,pts);
 else
  v_st := case when exists(select 1 from cancellation_rules where service_type_id=b.service_type_id) then b.service_type_id
               else (select id from service_types where code='general_cleaning') end;
  select * into rst from service_types where id=v_st;
  hrs := extract(epoch from (b.start_at - now()))/3600;
  select * into r from cancellation_rules where service_type_id=v_st and min_hours_before <= greatest(hrs,0) order by min_hours_before desc limit 1;
  refund := least(b.total_price, round(b.total_price::numeric * r.refund_amount / rst.customer_price)::int);
  if r.refund_amount >= rst.customer_price then pts := _return_points(b); end if;
  if b.maid_id is not null and b.status='confirmed' then maid_amt := least(b.maid_payout, round(b.maid_payout::numeric * r.maid_amount / rst.maid_payout)::int); end if;
  if refund > 0 or pts > 0 then insert into refunds(booking_id,amount,points_returned) values(b.id,refund,pts); end if;
  if maid_amt > 0 then insert into payouts(booking_id,maid_id,amount) values(b.id,b.maid_id,maid_amt); end if;
 end if;
 update bookings set status='cancelled_by_customer', cancelled_at=now() where id=b.id;
 return json_build_object('refund',refund,'maid_amount',maid_amt,'points_returned',pts,'refund_after_check', b.status='payment_review');
end $$;

-- #1b  A slip approved after the customer already cancelled -> full refund of that payment
create or replace function public._refund_if_cancelled(p payments) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p.booking_id is not null and exists(select 1 from bookings where id=p.booking_id and status='cancelled_by_customer') then
    insert into refunds(booking_id,amount,points_returned) values(p.booking_id,p.amount,0);
  end if;
end $$;
revoke all on function public._refund_if_cancelled(payments) from public, anon, authenticated;

create or replace function public.admin_review_payment(p_payment_id bigint, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare p payments; b bookings; begin
 if not is_admin() then raise exception 'forbidden'; end if;
 select * into p from payments where id=p_payment_id and status='pending' for update;
 if p.id is null then raise exception 'invalid_state'; end if;
 update payments set status=case when p_approve then 'approved'::review_status else 'rejected' end, reviewed_at=now() where id=p.id;
 for b in select * from bookings where (id=p.booking_id or package_id=p.package_id) and status='payment_review' loop
  if p_approve then update bookings set status='awaiting_maid', needs_replacement=(maid_id is null) where id=b.id;
  else update bookings set status='payment_rejected' where id=b.id; end if;
 end loop;
 if p.package_id is not null then update packages set status=case when p_approve then 'active' else 'payment_rejected' end where id=p.package_id; end if;
 if p_approve then perform _refund_if_cancelled(p); end if;
end $$;

-- #3  Slip check: a missing transaction reference is not a duplicate -> leave for the admin
create or replace function public.record_slip_check(p_payment_id bigint, p_result text, p_trans_ref text, p_note text)
returns text language plpgsql security definer set search_path = public as $$
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
      for b in select * from bookings where (id = p.booking_id or package_id = p.package_id) and status = 'payment_review' loop
        update bookings set status = 'awaiting_maid', needs_replacement = (maid_id is null) where id = b.id;
      end loop;
      if p.package_id is not null then update packages set status = 'active' where id = p.package_id; end if;
      perform _refund_if_cancelled(p);
      return 'approved';
    end if;
  end if;

  if p_result = 'reject' then
    update payments set status = 'rejected', reviewed_at = now(), auto_checked = true, check_note = p_note where id = p.id;
    update bookings set status = 'payment_rejected' where (id = p.booking_id or package_id = p.package_id) and status = 'payment_review';
    if p.package_id is not null then update packages set status = 'payment_rejected' where id = p.package_id; end if;
    return 'rejected:' || p_note;
  end if;

  update payments set auto_checked = true, check_note = p_note where id = p.id;
  return 'pending';
end $$;
revoke all on function public.record_slip_check(bigint, text, text, text) from public, anon, authenticated;
grant execute on function public.record_slip_check(bigint, text, text, text) to service_role;

-- #4  Old booking/quote functions (fixed 1,500 price, no skill check) are no longer used by the site
revoke execute on function public.create_booking(text, uuid, timestamptz, bigint, text, text[], boolean) from public, anon, authenticated;
revoke execute on function public.quote_booking(text, boolean, boolean) from public, anon, authenticated;
revoke execute on function public.available_slots(date, uuid, text) from public, anon, authenticated;

-- #15  Helper name/photo for the customer's own bookings, even if the helper is no longer approved
create or replace function public.my_booking_helpers()
returns table(id uuid, nickname text, photo_url text)
language sql stable security definer set search_path = public as $$
  select distinct m.id, m.nickname, m.photo_url from maids m
  join bookings b on b.maid_id = m.id where b.customer_id = auth.uid() $$;
revoke all on function public.my_booking_helpers() from public, anon;
grant execute on function public.my_booking_helpers() to authenticated;

-- #16  Two bookings for the same helper can never overlap, even if made at the same moment
create extension if not exists btree_gist with schema extensions;
alter table public.bookings add constraint maid_busy_overlap
  exclude using gist (maid_id with =, tstzrange(start_at, end_at) with &&)
  where (maid_id is not null and status in ('pending_payment','payment_review','awaiting_maid','confirmed','on_the_way','working'));

-- #17  Thai digits (๐-๙) in chat are treated like 0-9 so phone numbers are hidden
create or replace function public.mask_text(t text)
returns text language sql immutable set search_path = public as $$
 select regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(translate(coalesce(t,''), '๐๑๒๓๔๕๖๗๘๙', '0123456789'),
  '(\+?66|0)[\s\-\.]*[0-9]([\s\-\.]*[0-9]){7,9}', '[ซ่อนข้อมูลติดต่อ]', 'g'),
  '[0-9]([\s\-\.]*[0-9]){8,}', '[ซ่อนข้อมูลติดต่อ]', 'g'),
  '(line|ไลน์|ไอดี|id)\s*[:：]?\s*@?[A-Za-z0-9_\.\-]{3,}', '[ซ่อนข้อมูลติดต่อ]', 'gi'),
  '@[A-Za-z0-9_\.\-]{3,}', '[ซ่อนข้อมูลติดต่อ]', 'g'),
  '(https?://|www\.|line\.me|fb\.com|facebook\.com)\S*', '[ซ่อนข้อมูลติดต่อ]', 'gi') $$;
