-- EventFlow: multi-organisation event registration and operations platform
-- Run this entire file once in Supabase Dashboard -> SQL Editor.
-- Uses the Supabase publishable/anon key in the browser. Never put service_role in VITE_* variables.

create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'admin' check (role in ('owner','admin','staff')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 140),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  venue text,
  city text,
  starts_on date,
  base_fee numeric(10,2) not null default 0 check (base_fee >= 0),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  categories jsonb not null default '[{"name":"General","fee":0}]'::jsonb check (jsonb_typeof(categories) = 'array'),
  upi_id text,
  payment_instructions text,
  status text not null default 'draft' check (status in ('draft','published','closed')),
  registration_open boolean not null default true,
  next_bib_number integer not null default 1 check (next_bib_number > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  registration_code text not null unique default ('EF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (char_length(email) <= 180),
  phone text not null check (char_length(phone) between 6 and 20),
  category text not null,
  date_of_birth date,
  emergency_contact text,
  amount_due numeric(10,2) not null default 0 check (amount_due >= 0),
  transaction_reference text,
  proof_path text,
  payment_status text not null default 'pending' check (payment_status in ('pending','verified','rejected')),
  status text not null default 'submitted' check (status in ('submitted','confirmed','cancelled')),
  bib_number integer,
  checked_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists registrations_one_participant_per_event
  on public.registrations (event_id, lower(email), lower(full_name));
create unique index if not exists registrations_unique_bib_per_event
  on public.registrations (event_id, bib_number) where bib_number is not null;
create index if not exists events_org_created_idx on public.events (organization_id, created_at desc);
create index if not exists registrations_event_created_idx on public.registrations (event_id, created_at desc);
create index if not exists registrations_event_status_idx on public.registrations (event_id, payment_status, status);

-- SECURITY DEFINER membership helpers prevent RLS recursion when policies check membership.
create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(p_org_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  );
$$;

create or replace function public.create_organization(p_name text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_email text;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if p_name is null or char_length(trim(p_name)) < 2 or char_length(trim(p_name)) > 100 then
    raise exception 'Enter an organisation name between 2 and 100 characters.';
  end if;
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then raise exception 'This workspace requires an email-based account.'; end if;
  insert into public.organizations(name) values (trim(p_name)) returning id into v_org_id;
  insert into public.organization_members(organization_id, user_id, email, role)
    values (v_org_id, auth.uid(), lower(v_email), 'owner');
  return v_org_id;
end;
$$;

create or replace function public.add_organization_member(p_email text, p_role text default 'staff')
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_user_id uuid;
  v_member_id uuid;
  v_email text := lower(trim(coalesce(p_email,'')));
begin
  select organization_id into v_org_id
  from public.organization_members
  where user_id = auth.uid() and role in ('owner','admin')
  order by created_at asc limit 1;
  if v_org_id is null then raise exception 'Only a workspace owner or admin can manage the team.'; end if;
  if v_email = '' or position('@' in v_email) < 2 then raise exception 'Enter a valid account email address.'; end if;
  if p_role not in ('admin','staff') then raise exception 'Role must be admin or staff.'; end if;
  select id into v_user_id from auth.users where lower(email) = v_email limit 1;
  if v_user_id is null then raise exception 'This person must create and confirm an EventFlow account before you can add them.'; end if;
  if exists (select 1 from public.organization_members where organization_id = v_org_id and user_id = v_user_id and role = 'owner') then
    raise exception 'The workspace owner role cannot be changed here.';
  end if;
  insert into public.organization_members(organization_id, user_id, email, role)
  values (v_org_id, v_user_id, v_email, p_role)
  on conflict (organization_id, user_id) do update set email = excluded.email, role = excluded.role
  returning id into v_member_id;
  return v_member_id;
end;
$$;

-- Public registration is performed through this function, not direct table inserts.
create or replace function public.register_participant(
  p_event_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_category text,
  p_date_of_birth date default null,
  p_emergency_contact text default null,
  p_transaction_reference text default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_category jsonb;
  v_fee numeric(10,2);
  v_registration public.registrations%rowtype;
  v_age integer;
begin
  select * into v_event from public.events where id = p_event_id and status = 'published' for share;
  if not found then raise exception 'This event is not available for registration.'; end if;
  if not v_event.registration_open then raise exception 'Registration for this event is closed.'; end if;
  if p_full_name is null or char_length(trim(p_full_name)) < 2 or char_length(trim(p_full_name)) > 120 then
    raise exception 'Enter a valid participant name.';
  end if;
  if p_email is null or position('@' in p_email) < 2 or char_length(p_email) > 180 then
    raise exception 'Enter a valid email address.';
  end if;
  if p_phone is null or char_length(trim(p_phone)) < 6 or char_length(trim(p_phone)) > 20 then
    raise exception 'Enter a valid mobile number.';
  end if;
  select item into v_category
  from jsonb_array_elements(v_event.categories) as category_rows(item)
  where item->>'name' = p_category
  limit 1;
  if v_category is null then raise exception 'Choose a valid event category.'; end if;
  if p_date_of_birth is not null then
    if p_date_of_birth > current_date then raise exception 'Date of birth cannot be in the future.'; end if;
    v_age := floor(date_part('year', age(current_date, p_date_of_birth)))::integer;
    if nullif(v_category->>'minAge','') is not null and v_age < (v_category->>'minAge')::integer then
      raise exception 'Participant does not meet the minimum age for this category.';
    end if;
    if nullif(v_category->>'maxAge','') is not null and v_age > (v_category->>'maxAge')::integer then
      raise exception 'Participant does not meet the maximum age for this category.';
    end if;
  elsif nullif(v_category->>'minAge','') is not null or nullif(v_category->>'maxAge','') is not null then
    raise exception 'Date of birth is required for this age-restricted category.';
  end if;
  v_fee := coalesce(nullif(v_category->>'fee','')::numeric, v_event.base_fee);
  insert into public.registrations(
    event_id, full_name, email, phone, category, date_of_birth,
    emergency_contact, amount_due, transaction_reference
  ) values (
    p_event_id, trim(p_full_name), lower(trim(p_email)), trim(p_phone), trim(p_category), p_date_of_birth,
    nullif(trim(coalesce(p_emergency_contact,'')), ''), v_fee,
    nullif(trim(coalesce(p_transaction_reference,'')), '')
  ) returning * into v_registration;
  return jsonb_build_object(
    'registration_id', v_registration.id,
    'registration_code', v_registration.registration_code,
    'amount_due', v_registration.amount_due,
    'payment_status', v_registration.payment_status
  );
exception
  when unique_violation then
    raise exception 'This participant name and email are already registered for this event.';
end;
$$;

-- Allow anonymous upload only into the matching pending registration's folder.
create or replace function public.can_upload_payment_proof(p_event_id text, p_registration_id text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.registrations r
    join public.events e on e.id = r.event_id
    where r.id::text = p_registration_id
      and e.id::text = p_event_id
      and e.status = 'published'
      and r.payment_status = 'pending'
  );
$$;

create or replace function public.attach_payment_proof(p_registration_id uuid, p_object_path text)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
begin
  select event_id into v_event_id from public.registrations
  where id = p_registration_id and payment_status = 'pending';
  if not found then raise exception 'Registration not found or payment is already processed.'; end if;
  if split_part(coalesce(p_object_path,''), '/', 1) <> v_event_id::text
     or split_part(coalesce(p_object_path,''), '/', 2) <> p_registration_id::text
     or (select count(*) from storage.objects where bucket_id = 'payment-proofs' and name = p_object_path) = 0 then
    raise exception 'Payment proof file could not be verified.';
  end if;
  update public.registrations set proof_path = p_object_path, updated_at = now()
  where id = p_registration_id;
  return true;
end;
$$;

create or replace function public.approve_registration(p_registration_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_org_id uuid;
  v_bib integer;
  v_row public.registrations%rowtype;
begin
  select r.event_id, e.organization_id into v_event_id, v_org_id
  from public.registrations r join public.events e on e.id = r.event_id
  where r.id = p_registration_id for update of r;
  if not found then raise exception 'Registration not found.'; end if;
  if not public.is_org_admin(v_org_id) then raise exception 'You do not have permission to verify payments.'; end if;
  select * into v_row from public.registrations where id = p_registration_id;
  if v_row.payment_status = 'rejected' then raise exception 'A rejected registration cannot be confirmed.'; end if;
  if v_row.bib_number is null then
    update public.events set next_bib_number = next_bib_number + 1, updated_at = now()
      where id = v_event_id returning next_bib_number - 1 into v_bib;
  else
    v_bib := v_row.bib_number;
  end if;
  update public.registrations set payment_status = 'verified', status = 'confirmed', bib_number = v_bib, updated_at = now()
    where id = p_registration_id returning * into v_row;
  return jsonb_build_object('registration_code', v_row.registration_code, 'bib_number', v_row.bib_number, 'full_name', v_row.full_name);
end;
$$;

create or replace function public.reject_registration(p_registration_id uuid)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare v_org_id uuid;
begin
  select e.organization_id into v_org_id
  from public.registrations r join public.events e on e.id = r.event_id
  where r.id = p_registration_id;
  if not found then raise exception 'Registration not found.'; end if;
  if not public.is_org_admin(v_org_id) then raise exception 'You do not have permission to reject registrations.'; end if;
  update public.registrations set payment_status = 'rejected', status = 'cancelled', updated_at = now()
  where id = p_registration_id;
  return true;
end;
$$;

create or replace function public.check_in_registration(p_registration_code text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row public.registrations%rowtype;
  v_org_id uuid;
begin
  select r.* into v_row from public.registrations r
  where upper(r.registration_code) = upper(trim(p_registration_code)) for update;
  if not found then raise exception 'Registration code not found.'; end if;
  select organization_id into v_org_id from public.events where id = v_row.event_id;
  if not public.is_org_member(v_org_id) then raise exception 'You do not have access to this event.'; end if;
  if v_row.payment_status <> 'verified' or v_row.status <> 'confirmed' then
    raise exception 'This participant is not confirmed. Verify payment before check-in.';
  end if;
  if v_row.checked_in_at is not null then raise exception 'This participant was already checked in.'; end if;
  update public.registrations set checked_in_at = now(), updated_at = now()
    where id = v_row.id returning * into v_row;
  return jsonb_build_object('full_name', v_row.full_name, 'bib_number', v_row.bib_number, 'registration_code', v_row.registration_code);
end;
$$;

-- Timestamp triggers
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at before update on public.events for each row execute function public.set_updated_at();
drop trigger if exists registrations_set_updated_at on public.registrations;
create trigger registrations_set_updated_at before update on public.registrations for each row execute function public.set_updated_at();

-- Enable RLS everywhere. Organisers can only see/manage their own tenant records.
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.events enable row level security;
alter table public.registrations enable row level security;

drop policy if exists "Members can read their organisations" on public.organizations;
create policy "Members can read their organisations" on public.organizations
  for select to authenticated using (public.is_org_member(id));

drop policy if exists "Members can read workspace membership" on public.organization_members;
create policy "Members can read workspace membership" on public.organization_members
  for select to authenticated using (user_id = auth.uid() or public.is_org_member(organization_id));

drop policy if exists "Public can view published events and members can view all their events" on public.events;
create policy "Public can view published events and members can view all their events" on public.events
  for select to anon, authenticated using (status = 'published' or public.is_org_member(organization_id));
drop policy if exists "Admins can create events in their organisation" on public.events;
create policy "Admins can create events in their organisation" on public.events
  for insert to authenticated with check (public.is_org_admin(organization_id));
drop policy if exists "Admins can update events in their organisation" on public.events;
create policy "Admins can update events in their organisation" on public.events
  for update to authenticated using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
drop policy if exists "Admins can delete events in their organisation" on public.events;
create policy "Admins can delete events in their organisation" on public.events
  for delete to authenticated using (public.is_org_admin(organization_id));

drop policy if exists "Organisation members can read registrations" on public.registrations;
create policy "Organisation members can read registrations" on public.registrations
  for select to authenticated using (
    exists (select 1 from public.events e where e.id = event_id and public.is_org_member(e.organization_id))
  );

-- Minimum required grants; all sensitive access is still gated by RLS.
grant usage on schema public to anon, authenticated;
grant select on public.events to anon, authenticated;
grant select on public.organizations, public.organization_members, public.registrations to authenticated;
grant insert, update, delete on public.events to authenticated;

revoke all on function public.create_organization(text) from public;
revoke all on function public.add_organization_member(text,text) from public;
revoke all on function public.register_participant(uuid,text,text,text,text,date,text,text) from public;
revoke all on function public.attach_payment_proof(uuid,text) from public;
revoke all on function public.approve_registration(uuid) from public;
revoke all on function public.reject_registration(uuid) from public;
revoke all on function public.check_in_registration(text) from public;
revoke all on function public.can_upload_payment_proof(text,text) from public;
revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.is_org_admin(uuid) from public;

grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.add_organization_member(text,text) to authenticated;
grant execute on function public.register_participant(uuid,text,text,text,text,date,text,text) to anon, authenticated;
grant execute on function public.attach_payment_proof(uuid,text) to anon, authenticated;
grant execute on function public.approve_registration(uuid) to authenticated;
grant execute on function public.reject_registration(uuid) to authenticated;
grant execute on function public.check_in_registration(text) to authenticated;
grant execute on function public.can_upload_payment_proof(text,text) to anon, authenticated;
grant execute on function public.is_org_member(uuid) to anon, authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;

-- Private payment-proof bucket. A participant can upload only to their own registration folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'];

drop policy if exists "Participants can upload proof to their pending registration" on storage.objects;
create policy "Participants can upload proof to their pending registration" on storage.objects
  for insert to anon, authenticated with check (
    bucket_id = 'payment-proofs'
    and public.can_upload_payment_proof((storage.foldername(name))[1], (storage.foldername(name))[2])
  );

drop policy if exists "Organisation members can view payment proofs" on storage.objects;
create policy "Organisation members can view payment proofs" on storage.objects
  for select to authenticated using (
    bucket_id = 'payment-proofs'
    and exists (
      select 1 from public.registrations r
      join public.events e on e.id = r.event_id
      where r.id::text = (storage.foldername(name))[2]
        and e.id::text = (storage.foldername(name))[1]
        and public.is_org_admin(e.organization_id)
    )
  );

drop policy if exists "Organisation admins can remove payment proofs" on storage.objects;
create policy "Organisation admins can remove payment proofs" on storage.objects
  for delete to authenticated using (
    bucket_id = 'payment-proofs'
    and exists (
      select 1 from public.registrations r
      join public.events e on e.id = r.event_id
      where r.id::text = (storage.foldername(name))[2]
        and e.id::text = (storage.foldername(name))[1]
        and public.is_org_admin(e.organization_id)
    )
  );

-- Optional starter settings for a new Supabase project:
-- Authentication -> URL Configuration:
--   Site URL: https://YOUR-VERCEL-DOMAIN.vercel.app
--   Redirect URLs: https://YOUR-VERCEL-DOMAIN.vercel.app/** and http://localhost:5173/**
-- Authentication -> Providers -> Email: keep email confirmation enabled for production.
