-- EventFlow Freemium Pricing & Pay-Per-Event Billing System
-- Business Model:
--   - First 3 events per organisation: Free (₹0 platform fee)
--   - 4th event onwards: ₹999 one-time platform fee per event
-- Quota is tracked strictly at the organisation level.
begin;

-- 1. Extend organizations with billing quota fields
alter table public.organizations
  add column if not exists free_event_limit integer not null default 3,
  add column if not exists billing_notes text;

-- 2. Extend events with billing fields
alter table public.events
  add column if not exists billing_type text not null default 'free' check (billing_type in ('free', 'paid', 'complimentary')),
  add column if not exists platform_fee_amount numeric(10,2) not null default 0.00,
  add column if not exists platform_fee_currency text not null default 'INR',
  add column if not exists billing_status text not null default 'free' check (billing_status in ('free', 'pending', 'paid', 'failed')),
  add column if not exists platform_fee_order_id text,
  add column if not exists platform_fee_paid_at timestamptz,
  add column if not exists complimentary_reason text,
  add column if not exists complimentary_granted_by uuid references auth.users(id);

-- Backfill existing events to ensure clean status
update public.events
set billing_type = 'free',
    billing_status = 'free',
    platform_fee_amount = 0.00
where billing_type is null or billing_status is null;

-- Enforce publishing check: event cannot be published unless billing is free or paid
alter table public.events
  drop constraint if exists events_publishing_billing_check;
alter table public.events
  add constraint events_publishing_billing_check
  check (status != 'published' or billing_status in ('free', 'paid'));

-- 3. Create dedicated table for platform event fee orders
create table if not exists public.platform_fee_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  provider text not null default 'cashfree',
  provider_order_id text unique not null,
  payment_session_id text,
  amount numeric(10,2) not null default 999.00,
  currency text not null default 'INR',
  status text not null default 'pending' check (status in ('created', 'pending', 'paid', 'failed', 'cancelled', 'amount_mismatch')),
  provider_payment_id text,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  created_by uuid references auth.users(id)
);

create index if not exists idx_platform_fee_orders_org on public.platform_fee_orders(organization_id);
create index if not exists idx_platform_fee_orders_event on public.platform_fee_orders(event_id);
create index if not exists idx_platform_fee_orders_provider_order on public.platform_fee_orders(provider_order_id);

-- Enable RLS on platform_fee_orders
alter table public.platform_fee_orders enable row level security;

drop policy if exists "Organisation members can view platform fee orders" on public.platform_fee_orders;
create policy "Organisation members can view platform fee orders"
  on public.platform_fee_orders
  for select
  to authenticated
  using (
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

drop policy if exists "Service role has full access to platform fee orders" on public.platform_fee_orders;
create policy "Service role has full access to platform fee orders"
  on public.platform_fee_orders
  for all
  to service_role
  using (true)
  with check (true);

-- 4. Trigger to automatically assign billing type and status on event creation
create or replace function public.trg_assign_event_billing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := 3;
  v_free_count integer := 0;
begin
  select coalesce(free_event_limit, 3) into v_limit
  from public.organizations
  where id = new.organization_id;

  select count(*) into v_free_count
  from public.events
  where organization_id = new.organization_id
    and billing_type = 'free'
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- If not explicitly set or caller tries to insert as free after quota is full
  if new.billing_type is null or (new.billing_type = 'free' and v_free_count >= v_limit) then
    if v_free_count < v_limit then
      new.billing_type := 'free';
      new.billing_status := 'free';
      new.platform_fee_amount := 0.00;
    else
      new.billing_type := 'paid';
      new.billing_status := 'pending';
      new.platform_fee_amount := 999.00;
    end if;
  end if;

  -- Ensure newly created paid events cannot start as published
  if new.billing_type = 'paid' and new.billing_status != 'paid' and new.status = 'published' then
    new.status := 'draft';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_event_billing_assignment on public.events;
create trigger trg_event_billing_assignment
  before insert on public.events
  for each row
  execute function public.trg_assign_event_billing();

-- 5. RPC to get organization event quota & billing summary
create or replace function public.get_organization_event_quota(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := 3;
  v_free_used integer := 0;
  v_paid_count integer := 0;
  v_pending_count integer := 0;
  v_total_paid numeric(10,2) := 0.00;
begin
  select coalesce(free_event_limit, 3) into v_limit
  from public.organizations
  where id = p_organization_id;

  if not found then
    v_limit := 3;
  end if;

  select count(*) into v_free_used
  from public.events
  where organization_id = p_organization_id
    and billing_type = 'free';

  select count(*) into v_paid_count
  from public.events
  where organization_id = p_organization_id
    and billing_type in ('paid', 'complimentary')
    and billing_status = 'paid';

  select count(*) into v_pending_count
  from public.events
  where organization_id = p_organization_id
    and billing_status = 'pending';

  select coalesce(sum(amount), 0.00) into v_total_paid
  from public.platform_fee_orders
  where organization_id = p_organization_id
    and status = 'paid';

  return jsonb_build_object(
    'free_limit', v_limit,
    'free_used', v_free_used,
    'free_remaining', greatest(0, v_limit - v_free_used),
    'is_exhausted', (v_free_used >= v_limit),
    'paid_events_count', v_paid_count,
    'pending_events_count', v_pending_count,
    'total_platform_fees_paid', v_total_paid,
    'per_event_fee', 999.00
  );
end;
$$;

revoke all on function public.get_organization_event_quota(uuid) from public;
grant execute on function public.get_organization_event_quota(uuid) to authenticated, anon;

-- 6. RPC to confirm platform fee payment (called by webhook or server verification)
create or replace function public.confirm_platform_fee_payment(
  p_provider_order_id text,
  p_provider_payment_id text,
  p_paid_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.platform_fee_orders%rowtype;
begin
  select * into v_order
  from public.platform_fee_orders
  where provider_order_id = p_provider_order_id
  for update;

  if not found then
    raise exception 'Platform fee order % not found.', p_provider_order_id;
  end if;

  if v_order.status = 'paid' then
    return jsonb_build_object('already_processed', true, 'event_id', v_order.event_id, 'order_id', v_order.provider_order_id);
  end if;

  if round(p_paid_amount, 2) <> round(v_order.amount, 2) then
    update public.platform_fee_orders
    set status = 'amount_mismatch',
        provider_payment_id = p_provider_payment_id,
        updated_at = now()
    where id = v_order.id;
    return jsonb_build_object('amount_mismatch', true, 'event_id', v_order.event_id);
  end if;

  update public.platform_fee_orders
  set status = 'paid',
      provider_payment_id = p_provider_payment_id,
      paid_at = now(),
      updated_at = now()
  where id = v_order.id;

  update public.events
  set billing_status = 'paid',
      platform_fee_order_id = p_provider_order_id,
      platform_fee_paid_at = now(),
      updated_at = now()
  where id = v_order.event_id;

  return jsonb_build_object('success', true, 'event_id', v_order.event_id, 'status', 'paid');
end;
$$;

revoke all on function public.confirm_platform_fee_payment(text, text, numeric) from public, anon;
grant execute on function public.confirm_platform_fee_payment(text, text, numeric) to authenticated, service_role;

-- 7. RPC to grant complimentary event (authorized organisation admin/owner)
create or replace function public.grant_complimentary_event(
  p_event_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_caller uuid := auth.uid();
  v_is_admin boolean := false;
begin
  if v_caller is null then
    raise exception 'Authentication required.';
  end if;

  select * into v_event
  from public.events
  where id = p_event_id;

  if not found then
    raise exception 'Event not found.';
  end if;

  select exists (
    select 1 from public.organization_members
    where organization_id = v_event.organization_id
      and user_id = v_caller
      and role in ('owner', 'admin')
  ) into v_is_admin;

  if not v_is_admin then
    raise exception 'Only an organisation admin can grant complimentary waivers.';
  end if;

  update public.events
  set billing_type = 'complimentary',
      billing_status = 'paid',
      complimentary_reason = coalesce(p_reason, 'Admin complimentary waiver'),
      complimentary_granted_by = v_caller,
      updated_at = now()
  where id = p_event_id;

  return jsonb_build_object('success', true, 'event_id', p_event_id);
end;
$$;

revoke all on function public.grant_complimentary_event(uuid, text) from public;
grant execute on function public.grant_complimentary_event(uuid, text) to authenticated;

-- 8. Platform overview for administrators
create or replace function public.get_platform_billing_overview()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total_orgs integer := 0;
  v_total_events integer := 0;
  v_free_events integer := 0;
  v_paid_events integer := 0;
  v_pending_events integer := 0;
  v_revenue numeric(10,2) := 0.00;
  v_recent_tx jsonb;
begin
  select count(*) into v_total_orgs from public.organizations;
  select count(*) into v_total_events from public.events;
  select count(*) into v_free_events from public.events where billing_type = 'free';
  select count(*) into v_paid_events from public.events where billing_type in ('paid', 'complimentary') and billing_status = 'paid';
  select count(*) into v_pending_events from public.events where billing_status = 'pending';
  select coalesce(sum(amount), 0.00) into v_revenue from public.platform_fee_orders where status = 'paid';

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_recent_tx
  from (
    select p.id, p.provider_order_id, p.amount, p.currency, p.status, p.created_at, p.paid_at,
           e.name as event_name, o.name as org_name
    from public.platform_fee_orders p
    join public.events e on e.id = p.event_id
    join public.organizations o on o.id = p.organization_id
    order by p.created_at desc
    limit 20
  ) t;

  return jsonb_build_object(
    'total_organizations', v_total_orgs,
    'total_events', v_total_events,
    'free_events', v_free_events,
    'paid_events', v_paid_events,
    'pending_events', v_pending_events,
    'total_revenue', v_revenue,
    'recent_transactions', v_recent_tx
  );
end;
$$;

grant execute on function public.get_platform_billing_overview() to authenticated;

commit;
