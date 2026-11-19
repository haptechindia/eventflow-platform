-- Multi-organisation dashboard support: scope team management to an explicit organisation.
begin;

-- Remove the legacy overload that silently chose the user's oldest organisation.
drop function if exists public.add_organization_member(text, text);

create or replace function public.add_organization_member(
  p_organization_id uuid,
  p_email text,
  p_role text default 'staff'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_member_id uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if auth.uid() is null then
    raise exception 'Please sign in first.';
  end if;

  if not public.is_org_admin(p_organization_id) then
    raise exception 'Only an owner or admin of this organisation can manage its team.';
  end if;

  if v_email = '' or position('@' in v_email) < 2 then
    raise exception 'Enter a valid account email address.';
  end if;

  if p_role not in ('admin', 'staff') then
    raise exception 'Role must be admin or staff.';
  end if;

  select id into v_user_id
  from auth.users
  where lower(email) = v_email
  limit 1;

  if v_user_id is null then
    raise exception 'This person must create and confirm an EventFlow account before you can add them.';
  end if;

  if exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id
      and user_id = v_user_id
      and role = 'owner'
  ) then
    raise exception 'The workspace owner role cannot be changed here.';
  end if;

  insert into public.organization_members(organization_id, user_id, email, role)
  values (p_organization_id, v_user_id, v_email, p_role)
  on conflict (organization_id, user_id)
  do update set email = excluded.email, role = excluded.role
  returning id into v_member_id;

  return v_member_id;
end;
$function$;

revoke all on function public.add_organization_member(uuid, text, text) from public;
grant execute on function public.add_organization_member(uuid, text, text) to authenticated;

commit;
