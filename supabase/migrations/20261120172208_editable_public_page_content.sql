create table public.public_page_content (
  page text primary key check (page in ('guarantee', 'privacy')),
  content_th jsonb check (jsonb_typeof(content_th) = 'object' and octet_length(content_th::text) <= 131072),
  content_en jsonb check (jsonb_typeof(content_en) = 'object' and octet_length(content_en::text) <= 131072),
  image_path text check (image_path ~ ('^' || page || '/[0-9a-f-]{36}\.(jpg|png|webp)$')),
  published_on date,
  contact_phones text[] not null default '{}' check (array_position(contact_phones, null) is null),
  revision integer not null default 0 check (revision >= 0),
  check (
    (page = 'privacy' and published_on is not null and cardinality(contact_phones) between 1 and 2)
    or (page = 'guarantee' and cardinality(contact_phones) = 0)
  )
);

alter table public.public_page_content enable row level security;
revoke all on public.public_page_content from public, anon, authenticated;
grant select on public.public_page_content to anon, authenticated;
grant update (content_th, content_en, image_path, published_on, contact_phones, revision)
  on public.public_page_content to authenticated;

create policy "Read public page content" on public.public_page_content
  for select to anon, authenticated using (true);

create policy "Administrators update public page content" on public.public_page_content
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

insert into public.public_page_content (page, published_on, contact_phones) values
  ('guarantee', null, '{}'),
  ('privacy', '2026-11-20', array['093-651-9324','082-939-0077']);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('public-page-images', 'public-page-images', true, 5242880, array['image/jpeg','image/png','image/webp']);

create policy "Administrators upload policy images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'public-page-images'
    and name ~ '^(guarantee|privacy)/[0-9a-f-]{36}\.(jpg|png|webp)$'
    and (select public.is_admin())
  );

create policy "Administrators read policy image metadata" on storage.objects
  for select to authenticated
  using (bucket_id = 'public-page-images' and (select public.is_admin()));

create policy "Administrators remove staged policy images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'public-page-images' and (select public.is_admin()));
