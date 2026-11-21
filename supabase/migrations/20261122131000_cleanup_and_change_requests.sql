-- Cleanup: old booking functions replaced by the v2 versions (not used by the app any more).
drop function if exists public.create_booking(text, uuid, timestamptz, bigint, text, text[], boolean);
drop function if exists public.quote_booking(text, boolean, boolean);
drop function if exists public.available_slots(date, uuid, text);

-- Helper change requests (new photo / new bank account) now have screens; tell the admin and the helper.
create or replace function public._ntf_maid_change() returns trigger language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    select nickname into nm from public.maids where id = new.maid_id;
    perform public._notify_admins('admin_maid_change', case when new.kind = 'bank' then 'แม่บ้านขอเปลี่ยนบัญชีรับเงิน' else 'แม่บ้านขอเปลี่ยนรูปโปรไฟล์' end,
      case when new.kind = 'bank' then 'Helper wants to change bank account' else 'Helper wants to change profile photo' end, nm, nm, '/admin/maids#changes', 'change:' || new.id);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status <> 'pending' then
    perform public._resolve_admin_alert('change:' || new.id);
    if new.status in ('approved', 'rejected') then
      perform public._notify(new.maid_id, 'maid',
        case when new.status = 'approved' then (case when new.kind = 'bank' then 'เปลี่ยนบัญชีรับเงินแล้ว' else 'เปลี่ยนรูปโปรไฟล์แล้ว' end)
             else (case when new.kind = 'bank' then 'คำขอเปลี่ยนบัญชีไม่ผ่าน' else 'คำขอเปลี่ยนรูปไม่ผ่าน' end) end,
        case when new.status = 'approved' then 'Change approved' else 'Change not approved' end,
        new.admin_note, new.admin_note, case when new.kind = 'bank' then '/maid/income' else '/maid' end);
    end if;
  end if;
  return null;
exception when others then
  raise warning 'notify_failed %: %', tg_table_name, sqlerrm;
  return null;
end $$;
revoke all on function public._ntf_maid_change() from public, anon, authenticated;
drop trigger if exists zz_notify on public.maid_change_requests;
create trigger zz_notify after insert or update on public.maid_change_requests for each row execute function public._ntf_maid_change();

-- keep a record of these changes in the audit log too
drop trigger if exists zz_audit on public.maid_change_requests;
create trigger zz_audit after insert or update or delete on public.maid_change_requests for each row execute function public.audit_row();
