-- Public event and organisation branding assets (logos, banners, posters)
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-assets', 'event-assets', true, 5242880, array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/svg+xml'];

drop policy if exists "Public view event assets" on storage.objects;
create policy "Public view event assets" on storage.objects
for select using (bucket_id = 'event-assets');

drop policy if exists "Authenticated users upload event assets" on storage.objects;
create policy "Authenticated users upload event assets" on storage.objects
for insert to authenticated with check (bucket_id = 'event-assets');

drop policy if exists "Authenticated users update event assets" on storage.objects;
create policy "Authenticated users update event assets" on storage.objects
for update to authenticated using (bucket_id = 'event-assets');

drop policy if exists "Authenticated users delete event assets" on storage.objects;
create policy "Authenticated users delete event assets" on storage.objects
for delete to authenticated using (bucket_id = 'event-assets');

commit;
