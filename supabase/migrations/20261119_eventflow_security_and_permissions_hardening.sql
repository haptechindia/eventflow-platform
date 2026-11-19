-- EventFlow follow-up hardening: preserve data, narrow public execution, and complete admin grants.
begin;

-- Anonymous users only need to read published events; membership checks are for signed-in users.
drop policy if exists "Public can view published events and members can view all their" on public.events;
drop policy if exists "Public can view published events and members can view all their events" on public.events;
drop policy if exists "Public can view published events" on public.events;
drop policy if exists "Members can view published and workspace events" on public.events;
create policy "Public can view published events" on public.events
for select to anon using (status = 'published');
create policy "Members can view published and workspace events" on public.events
for select to authenticated using (status = 'published' or public.is_org_member(organization_id));
revoke execute on function public.is_org_member(uuid) from anon;

-- Organisation branding updates are restricted to workspace owners/admins.
drop policy if exists "Admins can update their organisations" on public.organizations;
create policy "Admins can update their organisations" on public.organizations
for update to authenticated
using (public.is_org_admin(id))
with check (public.is_org_admin(id));
grant update on public.organizations to authenticated;

-- Event assignment management must be explicit; a FOR ALL policy would overlap SELECT.
drop policy if exists "Admins manage event assignments" on public.event_assignments;
drop policy if exists "Admins insert event assignments" on public.event_assignments;
drop policy if exists "Admins update event assignments" on public.event_assignments;
drop policy if exists "Admins delete event assignments" on public.event_assignments;
create policy "Admins insert event assignments" on public.event_assignments
for insert to authenticated
with check (exists (
  select 1 from public.events e
  where e.id = event_id and public.is_org_admin(e.organization_id)
));
create policy "Admins update event assignments" on public.event_assignments
for update to authenticated
using (exists (
  select 1 from public.events e
  where e.id = event_id and public.is_org_admin(e.organization_id)
))
with check (exists (
  select 1 from public.events e
  where e.id = event_id and public.is_org_admin(e.organization_id)
));
create policy "Admins delete event assignments" on public.event_assignments
for delete to authenticated
using (exists (
  select 1 from public.events e
  where e.id = event_id and public.is_org_admin(e.organization_id)
));
grant insert, update, delete on public.event_assignments to authenticated;

-- Avoid per-row re-evaluation of auth.uid() in RLS.
drop policy if exists "Members can read workspace membership" on public.organization_members;
create policy "Members can read workspace membership" on public.organization_members
for select to authenticated
using (user_id = (select auth.uid()) or public.is_org_member(organization_id));

drop policy if exists "Members can view event assignments" on public.event_assignments;
create policy "Members can view event assignments" on public.event_assignments
for select to authenticated using (
  user_id = (select auth.uid()) or exists (
    select 1 from public.events e
    where e.id = event_id and public.is_org_member(e.organization_id)
  )
);

-- Keep public payment-proof submission, but re-check that the registration is still eligible.
create or replace function public.attach_payment_proof(p_registration_id uuid, p_object_path text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event_id uuid;
begin
  select event_id into v_event_id
  from public.registrations
  where id = p_registration_id and payment_status = 'pending';

  if not found then
    raise exception 'Registration not found or payment is already processed.';
  end if;

  if not public.can_upload_payment_proof(v_event_id::text, p_registration_id::text) then
    raise exception 'This event is not accepting payment proofs.';
  end if;

  if split_part(coalesce(p_object_path,''), '/', 1) <> v_event_id::text
     or split_part(coalesce(p_object_path,''), '/', 2) <> p_registration_id::text
     or (select count(*) from storage.objects where bucket_id = 'payment-proofs' and name = p_object_path) = 0 then
    raise exception 'Payment proof file could not be verified.';
  end if;

  update public.registrations
  set proof_path = p_object_path, updated_at = now()
  where id = p_registration_id;
  return true;
end;
$function$;

-- Supporting indexes for the newly introduced foreign keys.
create index if not exists event_assignments_assigned_by_idx on public.event_assignments(assigned_by);
create index if not exists notification_outbox_event_id_idx on public.notification_outbox(event_id);
create index if not exists notification_outbox_registration_id_idx on public.notification_outbox(registration_id);
create index if not exists organization_members_user_id_idx on public.organization_members(user_id);
create index if not exists payment_orders_event_id_idx on public.payment_orders(event_id);

commit;
