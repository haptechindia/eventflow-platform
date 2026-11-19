-- EventFlow platform upgrade (additive migration; preserves existing event/registration rows).
begin;

alter table public.organizations
  add column if not exists logo_url text,
  add column if not exists brand_primary_color text not null default '#176b4a',
  add column if not exists brand_secondary_color text not null default '#eaf6ed';

alter table public.events
  add column if not exists tagline text not null default '',
  add column if not exists event_logo_url text,
  add column if not exists banner_url text,
  add column if not exists brand_primary_color text not null default '#176b4a',
  add column if not exists brand_secondary_color text not null default '#eaf6ed',
  add column if not exists sponsor_logos jsonb not null default '[]'::jsonb,
  add column if not exists confirmation_message text not null default 'Thank you for registering. Your payment will be verified by the organiser.',
  add column if not exists starts_at timestamptz,
  add column if not exists platform_fee_enabled boolean not null default false,
  add column if not exists platform_fee_percent numeric(5,2) not null default 5.00,
  add column if not exists cashfree_enabled boolean not null default true,
  add column if not exists whatsapp_updates_enabled boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table public.events
  drop constraint if exists events_platform_fee_percent_check;
alter table public.events
  add constraint events_platform_fee_percent_check check (platform_fee_percent >= 0 and platform_fee_percent <= 5);
alter table public.events
  drop constraint if exists events_sponsor_logos_array_check;
alter table public.events
  add constraint events_sponsor_logos_array_check check (jsonb_typeof(sponsor_logos) = 'array');

alter table public.registrations
  add column if not exists cashfree_order_id text,
  add column if not exists cashfree_payment_id text,
  add column if not exists platform_fee_amount numeric(10,2) not null default 0,
  add column if not exists total_paid numeric(10,2),
  add column if not exists paid_at timestamptz,
  add column if not exists whatsapp_opt_in boolean not null default false;

create unique index if not exists registrations_cashfree_order_id_uidx
  on public.registrations(cashfree_order_id) where cashfree_order_id is not null;

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  provider text not null default 'cashfree' check (provider = 'cashfree'),
  provider_order_id text not null unique,
  provider_payment_id text,
  base_amount numeric(10,2) not null check (base_amount >= 0),
  platform_fee_amount numeric(10,2) not null default 0 check (platform_fee_amount >= 0),
  total_amount numeric(10,2) not null check (total_amount >= 0),
  currency text not null default 'INR',
  payment_session_id text,
  status text not null default 'created' check (status in ('created','pending','paid','failed','amount_mismatch','refunded')),
  provider_payload jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payment_orders_registration_idx on public.payment_orders(registration_id, created_at desc);

-- Event-level helper assignments: permissions are explicitly granted per event.
create table if not exists public.event_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  assignment_type text not null default 'volunteer' check (assignment_type in ('volunteer','helper')),
  permissions jsonb not null default '{"view_participants":true,"approve_payments":false,"send_messages":false,"check_in":true}'::jsonb,
  assigned_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(event_id,user_id),
  check (jsonb_typeof(permissions) = 'object')
);
create index if not exists event_assignments_user_idx on public.event_assignments(user_id,event_id);

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  registration_id uuid references public.registrations(id) on delete cascade,
  channel text not null default 'whatsapp' check (channel in ('whatsapp','email')),
  recipient text not null,
  template_name text not null,
  language_code text not null default 'en',
  template_parameters jsonb not null default '[]'::jsonb,
  dedupe_key text not null unique,
  status text not null default 'queued' check (status in ('queued','processing','sent','failed','skipped')),
  attempts integer not null default 0,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists notification_outbox_queue_idx on public.notification_outbox(status,created_at) where status in ('queued','failed');

-- Admins inherit all event permissions. Helpers/volunteers receive only explicit event permissions.
create or replace function public.has_event_permission(p_event_id uuid, p_permission text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id and public.is_org_admin(e.organization_id)
  ) or exists (
    select 1 from public.event_assignments a
    where a.event_id = p_event_id
      and a.user_id = auth.uid()
      and coalesce((a.permissions ->> p_permission)::boolean, false)
  );
$$;

alter table public.event_assignments enable row level security;
alter table public.payment_orders enable row level security;
alter table public.notification_outbox enable row level security;

drop policy if exists "Members can view event assignments" on public.event_assignments;
create policy "Members can view event assignments" on public.event_assignments
for select to authenticated using (
  user_id = auth.uid() or exists (
    select 1 from public.events e where e.id = event_id and public.is_org_member(e.organization_id)
  )
);
drop policy if exists "Admins manage event assignments" on public.event_assignments;
create policy "Admins manage event assignments" on public.event_assignments
for all to authenticated using (
  exists (select 1 from public.events e where e.id = event_id and public.is_org_admin(e.organization_id))
) with check (
  exists (select 1 from public.events e where e.id = event_id and public.is_org_admin(e.organization_id))
);
drop policy if exists "Admins view payment orders" on public.payment_orders;
create policy "Admins view payment orders" on public.payment_orders
for select to authenticated using (
  exists (select 1 from public.events e where e.id = event_id and public.is_org_admin(e.organization_id))
);
drop policy if exists "Admins view notification outbox" on public.notification_outbox;
create policy "Admins view notification outbox" on public.notification_outbox
for select to authenticated using (
  exists (select 1 from public.events e where e.id = event_id and public.is_org_admin(e.organization_id))
);

-- Public bib lookup requires the event slug, exact participant name and exact mobile number.
-- It returns only the participant name, category, bib and confirmation status.
create or replace function public.lookup_participant_bib(p_event_slug text, p_full_name text, p_phone text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_result jsonb;
begin
  if length(trim(coalesce(p_full_name,''))) < 2 or length(regexp_replace(coalesce(p_phone,''),'\\D','','g')) < 6 then
    raise exception 'Enter the participant name and registered mobile number.';
  end if;
  select jsonb_build_object(
    'found', true,
    'full_name', r.full_name,
    'category', r.category,
    'bib_number', r.bib_number,
    'payment_status', r.payment_status,
    'status', r.status
  ) into v_result
  from public.registrations r
  join public.events e on e.id = r.event_id
  where e.slug = p_event_slug
    and lower(trim(r.full_name)) = lower(trim(p_full_name))
    and regexp_replace(r.phone,'\\D','','g') = regexp_replace(p_phone,'\\D','','g')
  limit 1;
  return coalesce(v_result, jsonb_build_object('found',false));
end;
$$;

-- Called only by the Cashfree webhook using the Supabase service-role key.
-- Locks the order and allocates the bib exactly once (idempotent on webhook retries).
create or replace function public.confirm_cashfree_payment(
  p_provider_order_id text,
  p_provider_payment_id text,
  p_paid_amount numeric
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.payment_orders%rowtype;
  v_reg public.registrations%rowtype;
  v_bib integer;
begin
  select * into v_order from public.payment_orders
  where provider_order_id = p_provider_order_id for update;
  if not found then raise exception 'Cashfree order not found.'; end if;
  if v_order.status = 'paid' then
    return jsonb_build_object('already_processed',true,'registration_id',v_order.registration_id);
  end if;
  if round(p_paid_amount,2) <> round(v_order.total_amount,2) then
    update public.payment_orders set status='amount_mismatch', provider_payment_id=p_provider_payment_id,
      updated_at=now() where id=v_order.id;
    raise exception 'Cashfree paid amount does not match the stored order amount.';
  end if;
  select * into v_reg from public.registrations where id=v_order.registration_id for update;
  if v_reg.payment_status = 'rejected' then raise exception 'Rejected registration cannot be auto-confirmed.'; end if;
  if v_reg.bib_number is null then
    update public.events set next_bib_number=next_bib_number+1, updated_at=now()
      where id=v_order.event_id returning next_bib_number-1 into v_bib;
  else
    v_bib := v_reg.bib_number;
  end if;
  update public.payment_orders set status='paid', provider_payment_id=p_provider_payment_id,
    paid_at=now(), updated_at=now() where id=v_order.id;
  update public.registrations set payment_status='verified', status='confirmed',
    bib_number=v_bib, cashfree_order_id=p_provider_order_id,
    cashfree_payment_id=p_provider_payment_id, platform_fee_amount=v_order.platform_fee_amount,
    total_paid=v_order.total_amount, paid_at=now(), updated_at=now()
    where id=v_reg.id;
  if v_reg.whatsapp_opt_in then
    insert into public.notification_outbox(event_id,registration_id,recipient,template_name,language_code,template_parameters,dedupe_key)
    select v_order.event_id, v_reg.id, v_reg.phone, 'eventflow_payment_confirmed', 'en',
      jsonb_build_array(v_reg.full_name, e.name, v_bib::text, e.starts_on::text, coalesce(e.venue,'')),
      'bib-confirmed:' || v_reg.id::text
    from public.events e where e.id=v_order.event_id
    on conflict (dedupe_key) do nothing;
  end if;
  return jsonb_build_object('already_processed',false,'registration_id',v_reg.id,'bib_number',v_bib);
end;
$$;

-- Notify opted-in participants when the organiser changes the date/time or venue.
create or replace function public.queue_event_change_notifications()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (old.starts_on is distinct from new.starts_on)
    or (old.starts_at is distinct from new.starts_at)
    or (old.venue is distinct from new.venue)
    or (old.city is distinct from new.city) then
    insert into public.notification_outbox(event_id,registration_id,recipient,template_name,language_code,template_parameters,dedupe_key)
    select new.id, r.id, r.phone, 'eventflow_event_update', 'en',
      jsonb_build_array(r.full_name,new.name,coalesce(new.starts_on::text,''),coalesce(new.starts_at::text,''),coalesce(new.venue,''),coalesce(new.city,'')),
      'event-change:' || new.id::text || ':' || r.id::text || ':' || extract(epoch from new.updated_at)::bigint::text
    from public.registrations r
    where r.event_id=new.id and r.whatsapp_opt_in and r.payment_status <> 'rejected'
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists events_queue_change_notifications on public.events;
create trigger events_queue_change_notifications after update on public.events
for each row execute function public.queue_event_change_notifications();

-- Public lookup is intentionally narrow; service-role-only payment confirmation must not be exposed to clients.
revoke all on function public.lookup_participant_bib(text,text,text) from public;
grant execute on function public.lookup_participant_bib(text,text,text) to anon, authenticated;
revoke all on function public.confirm_cashfree_payment(text,text,numeric) from public, anon, authenticated;
grant execute on function public.confirm_cashfree_payment(text,text,numeric) to service_role;
revoke all on function public.has_event_permission(uuid,text) from public;
grant execute on function public.has_event_permission(uuid,text) to authenticated;

grant select on public.event_assignments to authenticated;
grant select on public.payment_orders, public.notification_outbox to authenticated;

commit;
