begin;

drop policy fields_select_allowed on public.fields;
create policy fields_select_allowed
on public.fields for select
to authenticated
using (
  archived_at is null
  and (
    owner_user_id = auth.uid()
    or public.is_workspace_admin(workspace_id)
    or (
      visibility_level = 'workspace'
      and public.is_workspace_member(workspace_id)
    )
    or exists (
      select 1
      from public.field_access_grants fag
      where fag.field_id = fields.id
        and fag.grantee_user_id = auth.uid()
        and (fag.expires_at is null or fag.expires_at > now())
    )
  )
);

drop policy plans_select_allowed on public.operation_plans;
create policy plans_select_allowed
on public.operation_plans for select
to authenticated
using (
  archived_at is null
  and (
    created_by = auth.uid()
    or public.is_workspace_admin(workspace_id)
    or (
      visibility_level = 'workspace'
      and public.is_workspace_member(workspace_id)
    )
    or exists (
      select 1
      from public.notification_targets nt
      where nt.plan_id = operation_plans.id
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

commit;
