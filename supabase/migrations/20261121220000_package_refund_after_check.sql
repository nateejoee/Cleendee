-- A package visit cancelled while the package slip was still being checked is refunded
-- (its visit price) once the payment is approved. Single bookings work as before.
create or replace function public._refund_if_cancelled(p payments) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p.booking_id is not null then
    if exists(select 1 from bookings where id = p.booking_id and status = 'cancelled_by_customer') then
      insert into refunds(booking_id, amount, points_returned) values (p.booking_id, p.amount, 0);
    end if;
  elsif p.package_id is not null then
    insert into refunds(booking_id, amount, points_returned)
    select b.id, b.total_price, 0 from bookings b
    where b.package_id = p.package_id and b.status = 'cancelled_by_customer'
      and not exists(select 1 from refunds r where r.booking_id = b.id);
  end if;
end $$;
revoke all on function public._refund_if_cancelled(payments) from public, anon, authenticated;
