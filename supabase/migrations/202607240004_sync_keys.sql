begin;

alter table public.weather_records
  add column source_key text not null default 'current';

create unique index weather_records_sync_key_idx
  on public.weather_records (plan_id, record_type, source_key);

alter table public.notification_targets
  add column target_key text not null default '';

update public.notification_targets
set target_key = coalesce(field_id::text, recipient_user_id::text, id::text)
where target_key = '';

alter table public.notification_targets
  add constraint notification_targets_target_key_present
  check (btrim(target_key) <> '');

create unique index notification_targets_sync_key_idx
  on public.notification_targets (plan_id, target_key);

alter table public.flight_logs
  add column source_key text not null default 'current';

create unique index flight_logs_sync_key_idx
  on public.flight_logs (plan_id, provider, source_key);

grant update on public.app_assets to authenticated;

create policy app_assets_update_owner_or_admin
on public.app_assets for update
to authenticated
using (
  owner_user_id = auth.uid()
  or public.is_workspace_admin(workspace_id)
)
with check (
  owner_user_id = auth.uid()
  or public.is_workspace_admin(workspace_id)
);

commit;
