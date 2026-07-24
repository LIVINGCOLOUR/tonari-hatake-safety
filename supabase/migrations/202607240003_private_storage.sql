begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'report-assets',
    'report-assets',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  ),
  (
    'flight-logs',
    'flight-logs',
    false,
    26214400,
    array[
      'application/json',
      'application/geo+json',
      'text/csv',
      'application/zip',
      'application/octet-stream'
    ]
  )
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.storage_path_workspace(p_name text)
returns uuid
language plpgsql
immutable
set search_path = public, storage, pg_temp
as $$
declare
  v_part text;
begin
  v_part := (storage.foldername(p_name))[1];
  if v_part is null then
    return null;
  end if;
  return v_part::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create or replace function public.storage_path_owner(p_name text)
returns uuid
language plpgsql
immutable
set search_path = public, storage, pg_temp
as $$
declare
  v_part text;
begin
  v_part := (storage.foldername(p_name))[2];
  if v_part is null then
    return null;
  end if;
  return v_part::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create or replace function public.can_read_app_asset(
  p_bucket_id text,
  p_object_path text
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
      from public.app_assets aa
      where aa.bucket_id = p_bucket_id
        and aa.object_path = p_object_path
        and (
          aa.owner_user_id = auth.uid()
          or public.is_workspace_admin(aa.workspace_id)
          or (
            aa.owner_type = 'plan'
            and public.can_read_plan(aa.owner_id)
          )
          or (
            aa.owner_type = 'work_record'
            and exists (
              select 1
              from public.work_records wr
              where wr.id = aa.owner_id
                and public.can_read_plan(wr.plan_id)
            )
          )
          or (
            aa.owner_type = 'flight_log'
            and exists (
              select 1
              from public.flight_logs fl
              where fl.id = aa.owner_id
                and public.can_read_plan(fl.plan_id)
            )
          )
        )
    );
$$;

revoke all on function public.storage_path_workspace(text) from public;
revoke all on function public.storage_path_owner(text) from public;
revoke all on function public.can_read_app_asset(text, text) from public;
grant execute on function public.storage_path_workspace(text) to authenticated;
grant execute on function public.storage_path_owner(text) to authenticated;
grant execute on function public.can_read_app_asset(text, text) to authenticated;

create policy tonari_storage_insert_owner
on storage.objects for insert
to authenticated
with check (
  bucket_id in ('report-assets', 'flight-logs')
  and public.storage_path_owner(name) = auth.uid()
  and public.is_workspace_member(public.storage_path_workspace(name))
);

create policy tonari_storage_select_allowed
on storage.objects for select
to authenticated
using (
  bucket_id in ('report-assets', 'flight-logs')
  and (
    public.storage_path_owner(name) = auth.uid()
    or public.is_workspace_admin(public.storage_path_workspace(name))
    or public.can_read_app_asset(bucket_id, name)
  )
);

create policy tonari_storage_update_owner_or_admin
on storage.objects for update
to authenticated
using (
  bucket_id in ('report-assets', 'flight-logs')
  and (
    public.storage_path_owner(name) = auth.uid()
    or public.is_workspace_admin(public.storage_path_workspace(name))
  )
)
with check (
  bucket_id in ('report-assets', 'flight-logs')
  and (
    public.storage_path_owner(name) = auth.uid()
    or public.is_workspace_admin(public.storage_path_workspace(name))
  )
);

create policy tonari_storage_delete_owner_or_admin
on storage.objects for delete
to authenticated
using (
  bucket_id in ('report-assets', 'flight-logs')
  and (
    public.storage_path_owner(name) = auth.uid()
    or public.is_workspace_admin(public.storage_path_workspace(name))
  )
);

commit;
