begin;

create or replace function public.is_workspace_member(
  p_workspace_id uuid,
  p_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.workspace_memberships wm
      where wm.workspace_id = p_workspace_id
        and wm.user_id = auth.uid()
        and wm.status = 'active'
        and (p_roles is null or wm.role = any (p_roles))
    );
$$;

create or replace function public.is_workspace_admin(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select public.is_workspace_member(p_workspace_id, array['admin']::text[]);
$$;

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

create or replace function public.can_manage_field(p_field_id uuid)
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
        and (
          f.owner_user_id = auth.uid()
          or public.is_workspace_admin(f.workspace_id)
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

create or replace function public.can_manage_plan(p_plan_id uuid)
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
        and (
          op.created_by = auth.uid()
          or public.is_workspace_admin(op.workspace_id)
        )
    );
$$;

revoke all on function public.is_workspace_member(uuid, text[]) from public;
revoke all on function public.is_workspace_admin(uuid) from public;
revoke all on function public.can_read_field(uuid) from public;
revoke all on function public.can_manage_field(uuid) from public;
revoke all on function public.can_read_plan(uuid) from public;
revoke all on function public.can_manage_plan(uuid) from public;
grant execute on function public.is_workspace_member(uuid, text[]) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;
grant execute on function public.can_read_field(uuid) to authenticated;
grant execute on function public.can_manage_field(uuid) to authenticated;
grant execute on function public.can_read_plan(uuid) to authenticated;
grant execute on function public.can_manage_plan(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.fields enable row level security;
alter table public.field_access_grants enable row level security;
alter table public.operation_plans enable row level security;
alter table public.weather_records enable row level security;
alter table public.plan_checks enable row level security;
alter table public.notification_targets enable row level security;
alter table public.work_records enable row level security;
alter table public.app_assets enable row level security;
alter table public.flight_logs enable row level security;
alter table public.audit_events enable row level security;

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, update on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_memberships to authenticated;
grant select, update, delete on public.workspace_invites to authenticated;
grant select, insert, update, delete on public.fields to authenticated;
grant select, insert, update, delete on public.field_access_grants to authenticated;
grant select, insert, update, delete on public.operation_plans to authenticated;
grant select, insert, update, delete on public.weather_records to authenticated;
grant select, insert, update, delete on public.plan_checks to authenticated;
grant select, insert, update, delete on public.notification_targets to authenticated;
grant select, insert, update, delete on public.work_records to authenticated;
grant select, insert, delete on public.app_assets to authenticated;
grant select, insert, update, delete on public.flight_logs to authenticated;
grant select on public.audit_events to authenticated;
grant usage, select on sequence public.audit_events_id_seq to authenticated;

create policy profiles_select_own
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy profiles_insert_own
on public.profiles for insert
to authenticated
with check (id = auth.uid());

create policy profiles_update_own
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy workspaces_select_member
on public.workspaces for select
to authenticated
using (public.is_workspace_member(id));

create policy workspaces_update_admin
on public.workspaces for update
to authenticated
using (public.is_workspace_admin(id))
with check (public.is_workspace_admin(id));

create policy memberships_select_self_or_admin
on public.workspace_memberships for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_workspace_admin(workspace_id)
);

create policy memberships_insert_admin
on public.workspace_memberships for insert
to authenticated
with check (
  public.is_workspace_admin(workspace_id)
  and created_by = auth.uid()
);

create policy memberships_update_admin
on public.workspace_memberships for update
to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

create policy memberships_delete_admin
on public.workspace_memberships for delete
to authenticated
using (
  public.is_workspace_admin(workspace_id)
  and not (user_id = auth.uid() and role = 'admin')
);

create policy invites_select_admin
on public.workspace_invites for select
to authenticated
using (public.is_workspace_admin(workspace_id));

create policy invites_update_admin
on public.workspace_invites for update
to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

create policy invites_delete_admin
on public.workspace_invites for delete
to authenticated
using (public.is_workspace_admin(workspace_id));

create policy fields_select_allowed
on public.fields for select
to authenticated
using (public.can_read_field(id));

create policy fields_insert_owner
on public.fields for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and public.is_workspace_member(
    workspace_id,
    array['sprayer', 'neighbor', 'admin']::text[]
  )
);

create policy fields_update_owner_or_admin
on public.fields for update
to authenticated
using (public.can_manage_field(id))
with check (
  owner_user_id = auth.uid()
  or public.is_workspace_admin(workspace_id)
);

create policy fields_delete_owner_or_admin
on public.fields for delete
to authenticated
using (public.can_manage_field(id));

create policy field_grants_select_related
on public.field_access_grants for select
to authenticated
using (
  grantee_user_id = auth.uid()
  or public.can_manage_field(field_id)
);

create policy field_grants_insert_owner_or_admin
on public.field_access_grants for insert
to authenticated
with check (
  public.can_manage_field(field_id)
  and granted_by = auth.uid()
);

create policy field_grants_update_owner_or_admin
on public.field_access_grants for update
to authenticated
using (public.can_manage_field(field_id))
with check (public.can_manage_field(field_id));

create policy field_grants_delete_owner_or_admin
on public.field_access_grants for delete
to authenticated
using (public.can_manage_field(field_id));

create policy plans_select_allowed
on public.operation_plans for select
to authenticated
using (public.can_read_plan(id));

create policy plans_insert_sprayer_or_admin
on public.operation_plans for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_workspace_member(
    workspace_id,
    array['sprayer', 'admin']::text[]
  )
  and (
    field_id is null
    or public.can_read_field(field_id)
  )
);

create policy plans_update_creator_or_admin
on public.operation_plans for update
to authenticated
using (public.can_manage_plan(id))
with check (
  created_by = auth.uid()
  or public.is_workspace_admin(workspace_id)
);

create policy plans_delete_creator_or_admin
on public.operation_plans for delete
to authenticated
using (public.can_manage_plan(id));

create policy weather_select_plan_reader
on public.weather_records for select
to authenticated
using (public.can_read_plan(plan_id));

create policy weather_insert_plan_manager
on public.weather_records for insert
to authenticated
with check (
  public.can_manage_plan(plan_id)
  and (recorded_by is null or recorded_by = auth.uid())
);

create policy weather_update_plan_manager
on public.weather_records for update
to authenticated
using (public.can_manage_plan(plan_id))
with check (public.can_manage_plan(plan_id));

create policy weather_delete_plan_manager
on public.weather_records for delete
to authenticated
using (public.can_manage_plan(plan_id));

create policy checks_select_plan_reader
on public.plan_checks for select
to authenticated
using (public.can_read_plan(plan_id));

create policy checks_insert_plan_manager
on public.plan_checks for insert
to authenticated
with check (
  public.can_manage_plan(plan_id)
  and (checked_by is null or checked_by = auth.uid())
);

create policy checks_update_plan_manager
on public.plan_checks for update
to authenticated
using (public.can_manage_plan(plan_id))
with check (public.can_manage_plan(plan_id));

create policy checks_delete_plan_manager
on public.plan_checks for delete
to authenticated
using (public.can_manage_plan(plan_id));

create policy notifications_select_related
on public.notification_targets for select
to authenticated
using (
  public.can_manage_plan(plan_id)
  or recipient_user_id = auth.uid()
  or (
    field_id is not null
    and exists (
      select 1
      from public.fields f
      where f.id = field_id
        and f.owner_user_id = auth.uid()
    )
  )
);

create policy notifications_insert_plan_manager
on public.notification_targets for insert
to authenticated
with check (public.can_manage_plan(plan_id));

create policy notifications_update_plan_manager
on public.notification_targets for update
to authenticated
using (public.can_manage_plan(plan_id))
with check (public.can_manage_plan(plan_id));

create policy notifications_delete_plan_manager
on public.notification_targets for delete
to authenticated
using (public.can_manage_plan(plan_id));

create policy work_records_select_plan_reader
on public.work_records for select
to authenticated
using (public.can_read_plan(plan_id));

create policy work_records_insert_plan_manager
on public.work_records for insert
to authenticated
with check (
  submitted_by = auth.uid()
  and public.can_manage_plan(plan_id)
);

create policy work_records_update_submitter_or_admin
on public.work_records for update
to authenticated
using (
  submitted_by = auth.uid()
  or public.is_workspace_admin(workspace_id)
)
with check (
  submitted_by = auth.uid()
  or public.is_workspace_admin(workspace_id)
);

create policy work_records_delete_submitter_or_admin
on public.work_records for delete
to authenticated
using (
  submitted_by = auth.uid()
  or public.is_workspace_admin(workspace_id)
);

create policy assets_select_owner_or_admin
on public.app_assets for select
to authenticated
using (
  owner_user_id = auth.uid()
  or public.is_workspace_admin(workspace_id)
);

create policy assets_insert_owner
on public.app_assets for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and public.is_workspace_member(workspace_id)
);

create policy assets_delete_owner_or_admin
on public.app_assets for delete
to authenticated
using (
  owner_user_id = auth.uid()
  or public.is_workspace_admin(workspace_id)
);

create policy flight_logs_select_plan_reader
on public.flight_logs for select
to authenticated
using (public.can_read_plan(plan_id));

create policy flight_logs_insert_plan_manager
on public.flight_logs for insert
to authenticated
with check (
  imported_by = auth.uid()
  and public.can_manage_plan(plan_id)
);

create policy flight_logs_update_importer_or_admin
on public.flight_logs for update
to authenticated
using (
  imported_by = auth.uid()
  or public.is_workspace_admin(workspace_id)
)
with check (
  imported_by = auth.uid()
  or public.is_workspace_admin(workspace_id)
);

create policy flight_logs_delete_importer_or_admin
on public.flight_logs for delete
to authenticated
using (
  imported_by = auth.uid()
  or public.is_workspace_admin(workspace_id)
);

create policy audit_select_actor_or_admin
on public.audit_events for select
to authenticated
using (
  actor_user_id = auth.uid()
  or (
    workspace_id is not null
    and public.is_workspace_admin(workspace_id)
  )
);

create or replace function public.respond_to_notification(
  p_notification_id uuid,
  p_response_code text,
  p_response_message text default ''
)
returns public.notification_targets
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_target public.notification_targets%rowtype;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_response_code not in (
    'unanswered', 'confirmed', 'change_requested', 'call_requested',
    'harvest_consultation', 'other'
  ) then
    raise exception 'invalid response code' using errcode = '22023';
  end if;

  select *
  into v_target
  from public.notification_targets nt
  where nt.id = p_notification_id
    and (
      nt.recipient_user_id = v_user
      or exists (
        select 1
        from public.fields f
        where f.id = nt.field_id
          and f.owner_user_id = v_user
      )
    )
  for update;

  if v_target.id is null then
    raise exception 'notification not found' using errcode = '42501';
  end if;

  update public.notification_targets
  set response_code = p_response_code,
      response_message = coalesce(p_response_message, ''),
      response_by = v_user,
      responded_at = case
        when p_response_code = 'unanswered' then null
        else now()
      end
  where id = p_notification_id
  returning * into v_target;

  return v_target;
end;
$$;

create or replace function public.set_notification_delivery(
  p_notification_id uuid,
  p_delivery_status text,
  p_delivered_at timestamptz default null
)
returns public.notification_targets
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_target public.notification_targets%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_delivery_status not in ('pending', 'queued', 'sent', 'delivered', 'failed', 'skipped') then
    raise exception 'invalid delivery status' using errcode = '22023';
  end if;

  select *
  into v_target
  from public.notification_targets nt
  where nt.id = p_notification_id
    and public.can_manage_plan(nt.plan_id)
  for update;

  if v_target.id is null then
    raise exception 'notification not found' using errcode = '42501';
  end if;

  update public.notification_targets
  set delivery_status = p_delivery_status,
      delivered_at = case
        when p_delivery_status in ('sent', 'delivered')
          then coalesce(p_delivered_at, now())
        else p_delivered_at
      end
  where id = p_notification_id
  returning * into v_target;

  return v_target;
end;
$$;

revoke all on function public.respond_to_notification(uuid, text, text) from public;
revoke all on function public.set_notification_delivery(uuid, text, timestamptz) from public;
grant execute on function public.respond_to_notification(uuid, text, text) to authenticated;
grant execute on function public.set_notification_delivery(uuid, text, timestamptz) to authenticated;

create or replace function public.set_updated_at_and_version()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  new.version = old.version + 1;
  return new;
end;
$$;

drop trigger fields_set_updated_at on public.fields;
create trigger fields_set_updated_at_and_version
before update on public.fields
for each row execute function public.set_updated_at_and_version();

drop trigger operation_plans_set_updated_at on public.operation_plans;
create trigger operation_plans_set_updated_at_and_version
before update on public.operation_plans
for each row execute function public.set_updated_at_and_version();

drop trigger work_records_set_updated_at on public.work_records;
create trigger work_records_set_updated_at_and_version
before update on public.work_records
for each row execute function public.set_updated_at_and_version();

create or replace function public.write_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_row jsonb;
  v_workspace uuid;
  v_entity_id text;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_workspace := nullif(v_row ->> 'workspace_id', '')::uuid;
  v_entity_id := coalesce(v_row ->> 'id', v_row ->> 'plan_id', 'unknown');

  insert into public.audit_events (
    workspace_id,
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    event_data
  )
  values (
    v_workspace,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    v_entity_id,
    jsonb_build_object(
      'version', v_row -> 'version',
      'status', v_row -> 'status',
      'recorded_at', now()
    )
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger fields_audit
after insert or update or delete on public.fields
for each row execute function public.write_audit_event();
create trigger operation_plans_audit
after insert or update or delete on public.operation_plans
for each row execute function public.write_audit_event();
create trigger notifications_audit
after insert or update or delete on public.notification_targets
for each row execute function public.write_audit_event();
create trigger work_records_audit
after insert or update or delete on public.work_records
for each row execute function public.write_audit_event();
create trigger flight_logs_audit
after insert or update or delete on public.flight_logs
for each row execute function public.write_audit_event();

commit;
