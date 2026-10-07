begin;
create table public.mvp_municipalities (
  code text primary key check (code in ('08201','08216')),
  workspace_id uuid not null unique references public.workspaces(id)
);
alter table public.mvp_municipalities enable row level security;
grant select on public.mvp_municipalities to authenticated;
create policy municipality_catalog_read on public.mvp_municipalities for select to authenticated using (true);
revoke insert,update,delete on public.mvp_municipalities from anon,authenticated;
do $$
declare owner_id uuid; city record; workspace uuid;
begin
  select user_id into owner_id from public.app_administrators order by user_id limit 1;
  if owner_id is null then raise exception 'Register the app administrator first'; end if;
  for city in select * from (values ('08201','水戸市'),('08216','笠間市')) as cities(code,name) loop
    insert into public.workspaces(slug,name,prefecture,municipality,created_by)
      values ('mvp-'||city.code,city.name,'茨城県',city.name,owner_id) returning id into workspace;
    insert into public.mvp_municipalities values (city.code,workspace);
  end loop;
end $$;

create function public.join_municipality(p_code text,p_roles text[]) returns uuid
language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare workspace uuid; selected_role text;
begin
  if auth.uid() is null then raise exception 'login required' using errcode='42501'; end if;
  if p_roles is null or cardinality(p_roles)<1 or cardinality(p_roles)>2
    or array_position(p_roles,null) is not null or not (p_roles <@ array['sprayer','neighbor']::text[]) then
    raise exception 'invalid roles' using errcode='42501';
  end if;
  select workspace_id into workspace from public.mvp_municipalities where code=p_code;
  if workspace is null then raise exception 'unsupported municipality' using errcode='22023'; end if;
  if exists(select 1 from public.workspace_memberships where workspace_id=workspace and user_id=auth.uid()
    and role in ('sprayer','neighbor') and status='suspended') then
    raise exception 'membership suspended' using errcode='42501';
  end if;
  foreach selected_role in array p_roles loop
    insert into public.workspace_memberships(workspace_id,user_id,role,created_by)
      values(workspace,auth.uid(),selected_role,auth.uid()) on conflict do nothing;
  end loop;
  perform public.set_my_workspace_roles(workspace,p_roles);
  if public.is_app_administrator() then perform public.assign_regional_administrator(workspace,auth.uid(),true); end if;
  return workspace;
end $$;
revoke all on function public.join_municipality(text,text[]) from public;
grant execute on function public.join_municipality(text,text[]) to authenticated;

-- Explicit projection: never expose plan_data, owner IDs or contact details.
create function public.municipal_schedule(p_code text)
returns table(id uuid,planned_date date,time_window text,district text,status text,geometry jsonb)
language sql stable security definer set search_path=public,auth,extensions,pg_temp as $$
  select op.id,op.planned_date,op.time_window,op.district,op.status,
    case when f.visibility_level <> 'private' then extensions.st_asgeojson(f.geometry)::jsonb else null end
  from public.mvp_municipalities m
  join public.operation_plans op on op.workspace_id=m.workspace_id
  left join public.fields f on f.id=op.field_id and f.workspace_id=op.workspace_id and f.archived_at is null
  where m.code=p_code and public.is_workspace_member(m.workspace_id)
    and op.archived_at is null and op.visibility_level <> 'private'
    and op.plan_data->>'shareWithRegion'='true'
    and op.planned_date >= current_date - 7
  order by op.planned_date,op.time_window;
$$;
revoke all on function public.municipal_schedule(text) from public;
grant execute on function public.municipal_schedule(text) to authenticated;
create or replace function public.can_read_field(p_field_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.fields f
      where f.id = p_field_id
        and f.archived_at is null
        and (
          f.owner_user_id = auth.uid()
          or public.is_workspace_admin(f.workspace_id)
          or (
            f.visibility_level = 'workspace'
            and public.is_workspace_member(f.workspace_id)
            and not exists (select 1 from public.mvp_municipalities m where m.workspace_id=f.workspace_id)
          )
          or exists (
            select 1
            from public.field_access_grants fag
            where fag.field_id = f.id
              and fag.grantee_user_id = auth.uid()
              and (fag.expires_at is null or fag.expires_at > now())
          )
        )
    );
$$;
create or replace function public.can_read_plan(p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.operation_plans op
      where op.id = p_plan_id
        and op.archived_at is null
        and (
          op.created_by = auth.uid()
          or public.is_workspace_admin(op.workspace_id)
          or (
            op.visibility_level = 'workspace'
            and public.is_workspace_member(op.workspace_id)
            and not exists (select 1 from public.mvp_municipalities m where m.workspace_id=op.workspace_id)
          )
          or exists (
            select 1
            from public.notification_targets nt
            where nt.plan_id = op.id
              and (
                nt.recipient_user_id = auth.uid()
                or exists (
                  select 1
                  from public.fields target_field
                  where target_field.id = nt.field_id
                    and target_field.owner_user_id = auth.uid()
                )
              )
          )
        )
    );
$$;
commit;
