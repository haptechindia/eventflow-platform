-- Respect both event-level WhatsApp setting and participant opt-in before queuing messages.
begin;

create or replace function public.confirm_cashfree_payment(
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
  v_order public.payment_orders%rowtype;
  v_reg public.registrations%rowtype;
  v_bib integer;
begin
  select * into v_order
  from public.payment_orders
  where provider_order_id = p_provider_order_id
  for update;
  if not found then raise exception 'Cashfree order not found.'; end if;
  if v_order.status = 'paid' then
    return jsonb_build_object('already_processed',true,'registration_id',v_order.registration_id);
  end if;
  if round(p_paid_amount,2) <> round(v_order.total_amount,2) then
    update public.payment_orders
    set status='amount_mismatch', provider_payment_id=p_provider_payment_id, updated_at=now()
    where id=v_order.id;
    return jsonb_build_object('amount_mismatch',true,'registration_id',v_order.registration_id);
  end if;
  select * into v_reg
  from public.registrations
  where id=v_order.registration_id
  for update;
  if v_reg.payment_status = 'rejected' then
    raise exception 'Rejected registration cannot be auto-confirmed.';
  end if;
  if v_reg.bib_number is null then
    update public.events
    set next_bib_number=next_bib_number+1, updated_at=now()
    where id=v_order.event_id
    returning next_bib_number-1 into v_bib;
  else
    v_bib := v_reg.bib_number;
  end if;
  update public.payment_orders
  set status='paid', provider_payment_id=p_provider_payment_id, paid_at=now(), updated_at=now()
  where id=v_order.id;
  update public.registrations
  set payment_status='verified', status='confirmed', bib_number=v_bib,
      cashfree_order_id=p_provider_order_id, cashfree_payment_id=p_provider_payment_id,
      platform_fee_amount=v_order.platform_fee_amount, total_paid=v_order.total_amount,
      paid_at=now(), updated_at=now()
  where id=v_reg.id;

  if v_reg.whatsapp_opt_in and exists (
    select 1 from public.events e
    where e.id=v_order.event_id and e.whatsapp_updates_enabled
  ) then
    insert into public.notification_outbox(
      event_id,registration_id,recipient,template_name,language_code,template_parameters,dedupe_key
    )
    select v_order.event_id, v_reg.id, v_reg.phone, 'eventflow_payment_confirmed', 'en',
      jsonb_build_array(v_reg.full_name, e.name, v_bib::text, e.starts_on::text, coalesce(e.venue,'')),
      'bib-confirmed:' || v_reg.id::text
    from public.events e where e.id=v_order.event_id
    on conflict (dedupe_key) do nothing;
  end if;
  return jsonb_build_object('already_processed',false,'registration_id',v_reg.id,'bib_number',v_bib);
end;
$$;

create or replace function public.queue_event_change_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.whatsapp_updates_enabled and (
    old.starts_on is distinct from new.starts_on
    or old.starts_at is distinct from new.starts_at
    or old.venue is distinct from new.venue
    or old.city is distinct from new.city
  ) then
    insert into public.notification_outbox(
      event_id,registration_id,recipient,template_name,language_code,template_parameters,dedupe_key
    )
    select new.id, r.id, r.phone, 'eventflow_event_update', 'en',
      jsonb_build_array(r.full_name,new.name,coalesce(new.starts_on::text,''),
        coalesce(new.starts_at::text,''),coalesce(new.venue,''),coalesce(new.city,'')),
      'event-change:' || new.id::text || ':' || r.id::text || ':' ||
        extract(epoch from new.updated_at)::bigint::text
    from public.registrations r
    where r.event_id=new.id
      and r.whatsapp_opt_in
      and r.payment_status <> 'rejected'
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.confirm_cashfree_payment(text,text,numeric)
  from public, anon, authenticated, service_role;
grant execute on function public.confirm_cashfree_payment(text,text,numeric) to service_role;
revoke all on function public.queue_event_change_notifications()
  from public, anon, authenticated;

commit;
