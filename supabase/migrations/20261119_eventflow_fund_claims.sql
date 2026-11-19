-- EventFlow organiser fund claims: 48-hour payment eligibility and 5% deduction.
begin;

create table if not exists public.fund_claims (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  gross_amount numeric(12,2) not null check (gross_amount > 0),
  fee_amount numeric(12,2) not null check (fee_amount >= 0),
  net_amount numeric(12,2) not null check (net_amount >= 0),
  currency text not null default 'INR',
  fee_percent numeric(5,2) not null default 5.00 check (fee_percent = 5.00),
  status text not null default 'pending' check (status in ('pending','processing','paid','rejected')),
  cashfree_transfer_id text,
  admin_note text,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists fund_claims_org_requested_idx on public.fund_claims(organization_id, requested_at desc);
create index if not exists fund_claims_event_idx on public.fund_claims(event_id, requested_at desc);
alter table public.fund_claims enable row level security;
drop policy if exists "Organisation admins can view fund claims" on public.fund_claims;
create policy "Organisation admins can view fund claims" on public.fund_claims
for select to authenticated using (public.is_org_admin(organization_id));
revoke all on public.fund_claims from anon, authenticated;
grant select on public.fund_claims to authenticated;

create or replace function public.get_fund_claim_summary(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_org_id uuid;
  v_currency text;
  v_gross numeric(12,2);
  v_reserved numeric(12,2);
  v_fee numeric(12,2);
  v_net numeric(12,2);
begin
  select organization_id, currency into v_org_id, v_currency
  from public.events where id=p_event_id;
  if not found then raise exception 'Event not found.'; end if;
  if not public.is_org_admin(v_org_id) then raise exception 'Only workspace owners/admins can view fund claims.'; end if;
  select coalesce(sum(po.total_amount),0)::numeric(12,2) into v_gross
  from public.payment_orders po
  where po.event_id=p_event_id and po.status='paid'
    and po.paid_at <= now() - interval '48 hours';
  select coalesce(sum(fc.gross_amount),0)::numeric(12,2) into v_reserved
  from public.fund_claims fc
  where fc.event_id=p_event_id and fc.status in ('pending','processing','paid');
  v_gross := greatest(v_gross - v_reserved, 0);
  v_fee := round(v_gross * 0.05, 2);
  v_net := v_gross - v_fee;
  return jsonb_build_object('event_id',p_event_id,'currency',coalesce(v_currency,'INR'),
    'eligible_gross',v_gross,'fee_amount',v_fee,'net_amount',v_net,'fee_percent',5,
    'claimable',v_gross > 0);
end;
$$;

create or replace function public.request_fund_claim(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_org_id uuid;
  v_currency text;
  v_gross numeric(12,2);
  v_reserved numeric(12,2);
  v_fee numeric(12,2);
  v_net numeric(12,2);
  v_claim public.fund_claims%rowtype;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  select organization_id, currency into v_org_id, v_currency
  from public.events where id=p_event_id for update;
  if not found then raise exception 'Event not found.'; end if;
  if not public.is_org_admin(v_org_id) then raise exception 'Only workspace owners/admins can claim funds.'; end if;
  select coalesce(sum(po.total_amount),0)::numeric(12,2) into v_gross
  from public.payment_orders po
  where po.event_id=p_event_id and po.status='paid'
    and po.paid_at <= now() - interval '48 hours';
  select coalesce(sum(fc.gross_amount),0)::numeric(12,2) into v_reserved
  from public.fund_claims fc
  where fc.event_id=p_event_id and fc.status in ('pending','processing','paid');
  v_gross := greatest(v_gross-v_reserved,0);
  if v_gross <= 0 then raise exception 'No funds are currently eligible to claim. Successful payments become claimable after 48 hours.'; end if;
  v_fee := round(v_gross * 0.05,2);
  v_net := v_gross-v_fee;
  insert into public.fund_claims(event_id,organization_id,requested_by,gross_amount,fee_amount,net_amount,currency)
  values(p_event_id,v_org_id,auth.uid(),v_gross,v_fee,v_net,coalesce(v_currency,'INR'))
  returning * into v_claim;
  return jsonb_build_object('claim_id',v_claim.id,'gross_amount',v_claim.gross_amount,
    'fee_amount',v_claim.fee_amount,'net_amount',v_claim.net_amount,'currency',v_claim.currency,
    'status',v_claim.status,'requested_at',v_claim.requested_at);
end;
$$;

create or replace function public.update_fund_claim(
  p_claim_id uuid,
  p_status text,
  p_cashfree_transfer_id text default null,
  p_admin_note text default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_claim public.fund_claims%rowtype;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  select * into v_claim from public.fund_claims where id=p_claim_id for update;
  if not found then raise exception 'Fund claim not found.'; end if;
  if not public.is_org_admin(v_claim.organization_id) then raise exception 'Only workspace owners/admins can update claims.'; end if;
  if p_status not in ('processing','paid','rejected') then raise exception 'Invalid claim status.'; end if;
  if v_claim.status not in ('pending','processing') then raise exception 'This claim has already been closed.'; end if;
  if p_status='paid' and nullif(trim(coalesce(p_cashfree_transfer_id,'')),'') is null then
    raise exception 'Enter the Cashfree transfer ID or payout reference before marking paid.';
  end if;
  update public.fund_claims set status=p_status,
    cashfree_transfer_id=nullif(trim(coalesce(p_cashfree_transfer_id,'')),''),
    admin_note=nullif(trim(coalesce(p_admin_note,'')),''),
    updated_at=now(), processed_at=case when p_status in ('paid','rejected') then now() else null end
  where id=p_claim_id returning * into v_claim;
  return jsonb_build_object('claim_id',v_claim.id,'status',v_claim.status,
    'cashfree_transfer_id',v_claim.cashfree_transfer_id,'processed_at',v_claim.processed_at);
end;
$$;

revoke all on function public.get_fund_claim_summary(uuid) from public, anon;
revoke all on function public.request_fund_claim(uuid) from public, anon;
revoke all on function public.update_fund_claim(uuid,text,text,text) from public, anon;
grant execute on function public.get_fund_claim_summary(uuid) to authenticated;
grant execute on function public.request_fund_claim(uuid) to authenticated;
grant execute on function public.update_fund_claim(uuid,text,text,text) to authenticated;

commit;
