-- When the helper the customer chose (and paid the choose fee for) declines or drops the job,
-- the choose fee is refunded. Later refunds of the same booking take that refund into account.

alter table public.bookings add column choose_fee_refunded boolean not null default false;
alter table public.refunds add column reason text;
-- a booking can now have more than one refund (choose fee first, the rest on cancel)
alter table public.refunds drop constraint refunds_booking_id_key;
create index if not exists refunds_booking_id_idx on public.refunds(booking_id);

-- what the customer has actually paid and not yet had back from the choose fee
create or replace function public._paid_net(b bookings) returns int
language sql immutable as $$
  select b.total_price - case when b.choose_fee_refunded then coalesce(b.choose_maid_fee, 0) else 0 end $$;

create or replace function public._refund_choose_fee(p_booking_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where id = p_booking_id for update;
  if b.id is null or not b.chose_maid or coalesce(b.choose_maid_fee, 0) <= 0 or b.choose_fee_refunded then return; end if;
  update bookings set choose_fee_refunded = true where id = b.id;
  insert into refunds(booking_id, amount, points_returned, reason) values (b.id, b.choose_maid_fee, 0, 'choose_fee');
end $$;
revoke all on function public._refund_choose_fee(bigint) from public, anon, authenticated;
revoke all on function public._paid_net(bookings) from public, anon, authenticated;

-- chosen helper declines
create or replace function public.maid_respond(p_booking_id bigint, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare b bookings; begin
 select * into b from bookings where id=p_booking_id and maid_id=auth.uid() and status='awaiting_maid' for update;
 if b.id is null then raise exception 'invalid_state'; end if;
 if p_accept then update bookings set status='confirmed', confirmed_at=now(), needs_replacement=false where id=b.id;
 else
  update bookings set maid_id=null, needs_replacement=true where id=b.id;
  perform _refund_choose_fee(b.id);
 end if;
end $$;

-- chosen helper drops a confirmed job
create or replace function public.maid_cancel_job(p_booking_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
 update bookings set maid_id=null, status='awaiting_maid', needs_replacement=true, confirmed_at=null
  where id=p_booking_id and maid_id=auth.uid() and status='confirmed';
 if not found then raise exception 'invalid_state'; end if;
 perform _refund_choose_fee(p_booking_id);
end $$;

-- customer cancel: all refund amounts are based on what is still paid (net of a refunded choose fee)
create or replace function public.customer_cancel(p_booking_id bigint)
returns json language plpgsql security definer set search_path = public as $$
declare b bookings; r cancellation_rules; rst service_types; hrs numeric; refund int := 0; maid_amt int := 0; pts int := 0; v_st int; paid int;
begin
 select * into b from bookings where id=p_booking_id and customer_id=auth.uid() for update;
 if b.id is null or b.status not in ('pending_payment','payment_review','awaiting_maid','confirmed','payment_rejected') then raise exception 'invalid_state'; end if;
 paid := _paid_net(b);
 if b.status in ('pending_payment','payment_rejected','payment_review') then
  pts := _return_points(b);
 elsif b.status = 'awaiting_maid' then
  pts := _return_points(b);
  refund := paid;
  insert into refunds(booking_id,amount,points_returned) values(b.id,refund,pts);
 else
  v_st := case when exists(select 1 from cancellation_rules where service_type_id=b.service_type_id) then b.service_type_id
               else (select id from service_types where code='general_cleaning') end;
  select * into rst from service_types where id=v_st;
  hrs := extract(epoch from (b.start_at - now()))/3600;
  select * into r from cancellation_rules where service_type_id=v_st and min_hours_before <= greatest(hrs,0) order by min_hours_before desc limit 1;
  refund := least(paid, round(paid::numeric * r.refund_amount / rst.customer_price)::int);
  if r.refund_amount >= rst.customer_price then pts := _return_points(b); end if;
  if b.maid_id is not null and b.status='confirmed' then maid_amt := least(b.maid_payout, round(b.maid_payout::numeric * r.maid_amount / rst.maid_payout)::int); end if;
  if refund > 0 or pts > 0 then insert into refunds(booking_id,amount,points_returned) values(b.id,refund,pts); end if;
  if maid_amt > 0 then insert into payouts(booking_id,maid_id,amount) values(b.id,b.maid_id,maid_amt); end if;
 end if;
 update bookings set status='cancelled_by_customer', cancelled_at=now() where id=b.id;
 return json_build_object('refund',refund,'maid_amount',maid_amt,'points_returned',pts,'refund_after_check', b.status='payment_review');
end $$;

-- admin refunds a job nobody took: refund what is still paid
create or replace function public.admin_refund_unmatched(p_booking_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare b bookings; pts int; begin
 if not is_admin() then raise exception 'forbidden'; end if;
 select * into b from bookings where id=p_booking_id and status='awaiting_maid' and maid_id is null for update;
 if b.id is null then raise exception 'invalid_state'; end if;
 update bookings set status='refunded_no_maid', cancelled_at=now() where id=b.id;
 pts := _return_points(b);
 insert into refunds(booking_id,amount,points_returned) values(b.id,_paid_net(b),pts);
end $$;
