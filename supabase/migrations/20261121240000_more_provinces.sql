-- Prepare more provinces: Ranong and Surat Thani (closed until the admin opens them).
-- dopa_code links a province to its boundary file public/geo/<dopa_code>.json.
alter table public.provinces add column dopa_code text unique;
update public.provinces set dopa_code = '86' where code = 'CPN';
insert into public.provinces(code, name_th, name_en, active, dopa_code) values
  ('RNG', 'ระนอง', 'Ranong', false, '85'),
  ('SNI', 'สุราษฎร์ธานี', 'Surat Thani', false, '84')
on conflict (code) do nothing;
insert into public.districts(province_code, name_th, name_en, active) values
  ('SNI', 'เมืองสุราษฎร์ธานี', 'Mueang Surat Thani', false),
  ('SNI', 'กาญจนดิษฐ์', 'Kanchanadit', false),
  ('SNI', 'ดอนสัก', 'Don Sak', false),
  ('SNI', 'เกาะสมุย', 'Ko Samui', false),
  ('SNI', 'เกาะพะงัน', 'Ko Pha-ngan', false),
  ('SNI', 'ไชยา', 'Chaiya', false),
  ('SNI', 'ท่าชนะ', 'Tha Chana', false),
  ('SNI', 'คีรีรัฐนิคม', 'Khiri Rat Nikhom', false),
  ('SNI', 'บ้านตาขุน', 'Ban Ta Khun', false),
  ('SNI', 'พนม', 'Phanom', false),
  ('SNI', 'ท่าฉาง', 'Tha Chang', false),
  ('SNI', 'บ้านนาสาร', 'Ban Na San', false),
  ('SNI', 'บ้านนาเดิม', 'Ban Na Doem', false),
  ('SNI', 'เคียนซา', 'Khian Sa', false),
  ('SNI', 'เวียงสระ', 'Wiang Sa', false),
  ('SNI', 'พระแสง', 'Phrasaeng', false),
  ('SNI', 'พุนพิน', 'Phunphin', false),
  ('SNI', 'ชัยบุรี', 'Chai Buri', false),
  ('SNI', 'วิภาวดี', 'Vibhavadi', false),
  ('RNG', 'เมืองระนอง', 'Mueang Ranong', false),
  ('RNG', 'ละอุ่น', 'La-un', false),
  ('RNG', 'กะเปอร์', 'Kapoe', false),
  ('RNG', 'กระบุรี', 'Kra Buri', false),
  ('RNG', 'สุขสำราญ', 'Suk Samran', false);

-- Admin opens / closes a province or a district
create or replace function public.admin_set_area(p_province text, p_district int, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if p_district is not null then update districts set active = p_active where id = p_district;
  else update provinces set active = p_active where code = p_province; end if;
  if not found then raise exception 'invalid_state'; end if;
end $$;
revoke all on function public.admin_set_area(text, int, boolean) from public, anon;
grant execute on function public.admin_set_area(text, int, boolean) to authenticated;
