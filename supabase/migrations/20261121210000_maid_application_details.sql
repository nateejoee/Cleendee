-- Richer helper application: identity, experience, availability, referee, documents and PDPA consent.
-- New columns are NOT readable by anon/authenticated (only the column-level grants listed below are added),
-- so customers never see them. Admins read them through admin_maid_applications().

alter table public.maids
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists line_id text,
  add column if not exists birth_date date,
  add column if not exists experience_years smallint,
  add column if not exists experience_note text,
  add column if not exists applied_services text[] not null default '{}',
  add column if not exists available_days text[] not null default '{}',
  add column if not exists available_times text[] not null default '{}',
  add column if not exists service_districts integer[] not null default '{}',
  add column if not exists referee_name text,
  add column if not exists referee_phone text,
  add column if not exists id_card_path text,
  add column if not exists selfie_path text,
  add column if not exists conduct_cert_path text,
  add column if not exists consent_at timestamptz;

-- Applicants may write these columns when they create their own application (INSERT only).
grant insert (full_name, phone, line_id, birth_date, experience_years, experience_note, applied_services,
  available_days, available_times, service_districts, referee_name, referee_phone,
  id_card_path, selfie_path, conduct_cert_path, consent_at)
  on public.maids to authenticated;

-- Server-side checks for a new application (the form checks the same things).
create or replace function public.maid_application_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is null or auth.uid() <> new.id then return new; end if;
  if coalesce(btrim(new.full_name), '') = '' then raise exception 'full_name_required'; end if;
  if new.phone is null or new.phone !~ '^0[0-9]{8,9}$' then raise exception 'phone_invalid'; end if;
  if new.birth_date is null or new.birth_date > (current_date - interval '18 years')::date
     or new.birth_date < date '1930-01-01' then raise exception 'age_invalid'; end if;
  if new.consent_at is null then raise exception 'consent_required'; end if;
  if new.id_card_path is null or new.id_card_path not like (new.id::text || '/%')
     or new.selfie_path is null or new.selfie_path not like (new.id::text || '/%')
     or (new.conduct_cert_path is not null and new.conduct_cert_path not like (new.id::text || '/%'))
  then raise exception 'documents_required'; end if;
  return new;
end $$;

drop trigger if exists maid_application_guard on public.maids;
create trigger maid_application_guard before insert on public.maids
  for each row execute function public.maid_application_guard();

-- Private bucket for ID photos and certificates: owner and admins only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('maid-docs', 'maid-docs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists maid_docs_upload on storage.objects;
create policy maid_docs_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'maid-docs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists maid_docs_read on storage.objects;
create policy maid_docs_read on storage.objects for select to authenticated
  using (bucket_id = 'maid-docs' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));

-- Admin-only view of the application details.
create or replace function public.admin_maid_applications()
returns table(id uuid, full_name text, phone text, line_id text, birth_date date, experience_years smallint,
  experience_note text, applied_services text[], available_days text[], available_times text[],
  service_districts integer[], referee_name text, referee_phone text, id_card_path text, selfie_path text,
  conduct_cert_path text, consent_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return query select m.id, m.full_name, m.phone, m.line_id, m.birth_date, m.experience_years,
    m.experience_note, m.applied_services, m.available_days, m.available_times, m.service_districts,
    m.referee_name, m.referee_phone, m.id_card_path, m.selfie_path, m.conduct_cert_path, m.consent_at
  from maids m where m.full_name is not null;
end $$;

revoke all on function public.admin_maid_applications() from public, anon;
grant execute on function public.admin_maid_applications() to authenticated;
