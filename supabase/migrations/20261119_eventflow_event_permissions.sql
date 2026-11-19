-- Apply event-scoped volunteer permissions to participant reads, payment review and check-in.
begin;

drop policy if exists "Organisation members can read registrations" on public.registrations;
create policy "Assigned event team can read permitted registrations" on public.registrations
for select to authenticated using (public.has_event_permission(event_id, 'view_participants'));

create or replace function public.approve_registration(p_registration_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_event_id uuid;
  v_bib integer;
  v_row public.registrations%rowtype;
begin
  select r.event_id into v_event_id from public.registrations r
  where r.id = p_registration_id for update;
  if not found then raise exception 'Registration not found.'; end if;
  if not public.has_event_permission(v_event_id, 'approve_payments') then
    raise exception 'You do not have permission to verify payments for this event.';
  end if;
  select * into v_row from public.registrations where id = p_registration_id;
  if v_row.payment_status = 'rejected' then raise exception 'A rejected registration cannot be confirmed.'; end if;
  if v_row.bib_number is null then
    update public.events set next_bib_number = next_bib_number + 1, updated_at = now()
      where id = v_event_id returning next_bib_number - 1 into v_bib;
  else v_bib := v_row.bib_number;
  end if;
  update public.registrations set payment_status='verified', status='confirmed',
    bib_number=v_bib, updated_at=now() where id=p_registration_id returning * into v_row;
  return jsonb_build_object('registration_code',v_row.registration_code,'bib_number',v_row.bib_number,'full_name',v_row.full_name);
end;
$$;

create or replace function public.reject_registration(p_registration_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_event_id uuid;
begin
  select event_id into v_event_id from public.registrations where id=p_registration_id;
  if not found then raise exception 'Registration not found.'; end if;
  if not public.has_event_permission(v_event_id, 'approve_payments') then
    raise exception 'You do not have permission to reject registrations for this event.';
  end if;
  update public.registrations set payment_status='rejected', status='cancelled', updated_at=now()
    where id=p_registration_id;
  return true;
end;
$$;

create or replace function public.check_in_registration(p_registration_code text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.registrations%rowtype;
begin
  select r.* into v_row from public.registrations r
  where upper(r.registration_code)=upper(trim(p_registration_code)) for update;
  if not found then raise exception 'Registration code not found.'; end if;
  if not public.has_event_permission(v_row.event_id, 'check_in') then
    raise exception 'You do not have check-in permission for this event.';
  end if;
  if v_row.payment_status <> 'verified' or v_row.status <> 'confirmed' then
    raise exception 'This participant is not confirmed. Verify payment before check-in.';
  end if;
  if v_row.checked_in_at is not null then raise exception 'This participant was already checked in.'; end if;
  update public.registrations set checked_in_at=now(), updated_at=now()
    where id=v_row.id returning * into v_row;
  return jsonb_build_object('full_name',v_row.full_name,'bib_number',v_row.bib_number,'registration_code',v_row.registration_code);
end;
$$;

revoke all on function public.approve_registration(uuid) from public;
revoke all on function public.reject_registration(uuid) from public;
revoke all on function public.check_in_registration(text) from public;
grant execute on function public.approve_registration(uuid) to authenticated;
grant execute on function public.reject_registration(uuid) to authenticated;
grant execute on function public.check_in_registration(text) to authenticated;

commit;
