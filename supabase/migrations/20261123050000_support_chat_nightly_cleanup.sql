-- ล้างแชท AI/เจ้าหน้าที่อัตโนมัติทุกคืนเที่ยงคืน (เวลาไทย)
-- ลบข้อความที่ส่งก่อนเที่ยงคืนวันนี้ ยกเว้นห้องที่ลูกค้ายังรอเจ้าหน้าที่ตอบ (status = waiting_staff) ให้เก็บไว้จนกว่าจะตอบ
create or replace function public.cleanup_support_chat()
returns int language plpgsql security definer set search_path to 'public' as $$
declare cut timestamptz := date_trunc('day', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok'; n int;
begin
  delete from support_messages m using support_threads t
   where m.thread_id = t.id and t.status <> 'waiting_staff' and m.created_at < cut;
  get diagnostics n = row_count;
  -- ห้องที่ไม่เหลือข้อความแล้ว กลับไปเริ่มคุยกับ AI ใหม่
  update support_threads t set status = 'ai'
   where t.status in ('answered', 'closed') and not exists (select 1 from support_messages m where m.thread_id = t.id);
  return n;
end $$;
revoke all on function public.cleanup_support_chat() from public, anon, authenticated;

-- 17:00 UTC = 00:00 เวลาไทย
select cron.schedule('cleendee-chat-cleanup', '0 17 * * *', $$select public.cleanup_support_chat()$$);
