-- Automatic PromptPay slip check (SlipOK). The verify-slip edge function calls record_slip_check with the service role.
-- A slip that passes approves the payment at once; a clearly wrong slip is rejected so the customer can upload again;
-- anything uncertain stays pending for the admin, exactly as before.

alter table public.payments
  add column trans_ref text unique,
  add column auto_checked boolean not null default false,
  add column check_note text;

create function public.record_slip_check(p_payment_id bigint, p_result text, p_trans_ref text, p_note text)
returns text language plpgsql security definer set search_path = public as $$
declare p payments; b bookings;
begin
  select * into p from payments where id = p_payment_id and status = 'pending' for update;
  if p.id is null then return 'not_pending'; end if;

  if p_result = 'approve' then
    if p_trans_ref is null or exists(select 1 from payments where trans_ref = p_trans_ref) then
      update payments set auto_checked = true, check_note = 'duplicate_slip' where id = p.id;
      p_result := 'reject';
    else
      update payments set status = 'approved', reviewed_at = now(), trans_ref = p_trans_ref, auto_checked = true, check_note = p_note where id = p.id;
      for b in select * from bookings where (id = p.booking_id or package_id = p.package_id) and status = 'payment_review' loop
        update bookings set status = 'awaiting_maid', needs_replacement = (maid_id is null) where id = b.id;
      end loop;
      if p.package_id is not null then update packages set status = 'active' where id = p.package_id; end if;
      return 'approved';
    end if;
  end if;

  if p_result = 'reject' then
    update payments set status = 'rejected', reviewed_at = now(), auto_checked = true, check_note = coalesce(check_note, p_note) where id = p.id;
    update bookings set status = 'payment_rejected' where (id = p.booking_id or package_id = p.package_id) and status = 'payment_review';
    if p.package_id is not null then update packages set status = 'payment_rejected' where id = p.package_id; end if;
    return 'rejected';
  end if;

  -- leave for the admin
  update payments set auto_checked = true, check_note = p_note where id = p.id;
  return 'pending';
end $$;
revoke all on function public.record_slip_check(bigint, text, text, text) from public, anon, authenticated;
grant execute on function public.record_slip_check(bigint, text, text, text) to service_role;
