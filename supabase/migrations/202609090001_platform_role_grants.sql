begin;

-- App administrators are designated out of band through trusted SQL only.
create table public.app_administrators (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.app_administrators enable row level security;
revoke all on public.app_administrators from anon, authenticated;

create function public.is_app_administrator() returns boolean
language sql stable security definer set search_path = public, auth, pg_temp as $$
  select exists(select 1 from public.app_administrators where user_id = auth.uid());
$$;
revoke all on function public.is_app_administrator() from public;
grant execute on function public.is_app_administrator() to authenticated;

-- Old automatic grants are not appointments by the application owner.
-- Preserve the rows for audit; appointed users can be reactivated explicitly.
insert into public.workspace_memberships(workspace_id,user_id,role,status,created_by)
select wm.workspace_id,wm.user_id,
  case when p.profile_data->>'role' = 'neighbor' then 'neighbor' else 'sprayer' end,
  'active',wm.user_id
from public.workspace_memberships wm left join public.profiles p on p.id=wm.user_id
where wm.role='admin' and wm.status='active'
on conflict do nothing;
update public.workspace_memberships set status = 'suspended' where role = 'admin';
update public.workspace_invites set revoked_at = now() where role = 'admin' and revoked_at is null;
revoke execute on function public.create_workspace_with_admin(text,text,text,text) from public, anon, authenticated;

create function public.guard_admin_membership() returns trigger
language plpgsql security definer set search_path = public, auth, pg_temp as $$
begin
  if ((tg_op <> 'DELETE' and new.role = 'admin') or (tg_op <> 'INSERT' and old.role = 'admin'))
     and not public.is_app_administrator() then
    raise exception 'application administrator required' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger guard_admin_membership before insert or update or delete on public.workspace_memberships
for each row execute function public.guard_admin_membership();

-- Even regional administrators cannot issue an administrator invitation.
create function public.guard_admin_invite() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.role = 'admin' then
    raise exception 'administrator role must be assigned directly by app owner' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_admin_invite before insert or update on public.workspace_invites
for each row execute function public.guard_admin_invite();

create function public.create_workspace_for_user(
  p_name text, p_prefecture text default '', p_municipality text default '',
  p_district text default '', p_role text default 'sprayer'
) returns uuid language plpgsql security definer
set search_path = public, auth, extensions, pg_temp as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_role not in ('sprayer','neighbor') or p_role is null or nullif(btrim(p_name),'') is null then
    raise exception 'invalid name or role' using errcode = '22023';
  end if;
  insert into public.workspaces(slug,name,prefecture,municipality,district,created_by)
  values ('workspace-' || replace(extensions.gen_random_uuid()::text,'-',''), btrim(p_name),
    coalesce(p_prefecture,''),coalesce(p_municipality,''),coalesce(p_district,''),auth.uid()) returning id into v_id;
  insert into public.workspace_memberships(workspace_id,user_id,role,created_by)
  values(v_id,auth.uid(),p_role,auth.uid());
  return v_id;
end;
$$;

create function public.add_my_workspace_role(p_workspace_id uuid,p_role text)
returns void language plpgsql security definer set search_path = public, auth, pg_temp as $$
begin
  if p_role is null or p_role not in ('sprayer','neighbor') then
    raise exception 'invalid self-selected role' using errcode = '42501';
  end if;
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'active membership required' using errcode = '42501';
  end if;
  if exists(select 1 from public.workspace_memberships where workspace_id=p_workspace_id
    and user_id=auth.uid() and role=p_role and status='suspended') then
    raise exception 'membership suspended' using errcode = '42501';
  end if;
  insert into public.workspace_memberships(workspace_id,user_id,role,created_by)
  values(p_workspace_id,auth.uid(),p_role,auth.uid()) on conflict do nothing;
end;
$$;

create function public.assign_regional_administrator(p_workspace_id uuid,p_user_id uuid,p_enabled boolean default true)
returns void language plpgsql security definer set search_path = public, auth, pg_temp as $$
begin
  if not public.is_app_administrator() then raise exception 'app owner required' using errcode='42501'; end if;
  if not exists(select 1 from public.workspace_memberships where workspace_id=p_workspace_id and user_id=p_user_id) then
    raise exception 'user must join the workspace first' using errcode='22023';
  end if;
  insert into public.workspace_memberships(workspace_id,user_id,role,status,created_by)
  values(p_workspace_id,p_user_id,'admin',case when p_enabled then 'active' else 'suspended' end,auth.uid())
  on conflict on constraint workspace_memberships_pkey do update
    set status=excluded.status,created_by=excluded.created_by,updated_at=now();
end;
$$;

create function public.set_my_workspace_roles(p_workspace_id uuid,p_roles text[])
returns void language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_role text;
begin
  if p_roles is null or cardinality(p_roles) < 1 or cardinality(p_roles) > 2
    or array_position(p_roles,null) is not null or not (p_roles <@ array['sprayer','neighbor']::text[]) then
    raise exception 'invalid self-selected roles' using errcode='42501';
  end if;
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'active membership required' using errcode='42501';
  end if;
  foreach v_role in array p_roles loop
    perform public.add_my_workspace_role(p_workspace_id,v_role);
  end loop;
  delete from public.workspace_memberships where workspace_id=p_workspace_id and user_id=auth.uid()
    and role in ('sprayer','neighbor') and status='active' and not (role=any(p_roles));
end;
$$;

create policy workspaces_select_app_owner on public.workspaces for select to authenticated
using (public.is_app_administrator());
create policy memberships_select_app_owner on public.workspace_memberships for select to authenticated
using (public.is_app_administrator());

revoke all on function public.set_my_workspace_roles(uuid,text[]) from public;
grant execute on function public.set_my_workspace_roles(uuid,text[]) to authenticated;
revoke all on function public.create_workspace_for_user(text,text,text,text,text),
  public.add_my_workspace_role(uuid,text), public.assign_regional_administrator(uuid,uuid,boolean),
  public.guard_admin_membership(), public.guard_admin_invite() from public;
grant execute on function public.create_workspace_for_user(text,text,text,text,text),
  public.add_my_workspace_role(uuid,text), public.assign_regional_administrator(uuid,uuid,boolean) to authenticated;
commit;
