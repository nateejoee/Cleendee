-- 1) Public reviews no longer expose who wrote them (customer_id) or the admin flag.
revoke select on public.reviews from anon, authenticated;
grant select (id, booking_id, maid_id, rating, tags, comment, created_at) on public.reviews to anon, authenticated;

-- 2) When a pair is blocked (1-2 stars either way), upcoming visits of that pair that are not
--    under way yet are handed to other helpers (same as when a helper drops a job).
create or replace function public._release_blocked_pair() returns trigger
language plpgsql security definer set search_path = public as $$
declare x bigint;
begin
  for x in with u as (
      update bookings set maid_id = null, status = 'awaiting_maid', needs_replacement = true, confirmed_at = null
      where customer_id = new.customer_id and maid_id = new.maid_id
        and status in ('awaiting_maid', 'confirmed') and start_at > now()
      returning id) select id from u
  loop
    perform _refund_choose_fee(x);  -- the chosen helper will not come: refund the choose fee
  end loop;
  update bookings set maid_id = null
  where customer_id = new.customer_id and maid_id = new.maid_id
    and status in ('pending_payment', 'payment_review', 'payment_rejected') and start_at > now();
  return new;
end $$;
revoke all on function public._release_blocked_pair() from public, anon, authenticated;
create trigger release_blocked_pair after insert on public.pair_blocks
for each row execute function public._release_blocked_pair();
