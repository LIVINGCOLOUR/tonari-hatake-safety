begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  organization_name text not null default '',
  municipality text not null default '',
  district text not null default '',
  address_detail text not null default '',
  phone text not null default '',
  email text not null default '',
  preferred_contact_method text not null default 'email'
    check (preferred_contact_method in ('line', 'email', 'phone', 'paper')),
  affiliation text not null default '',
  visibility jsonb not null default '{}'::jsonb
    check (jsonb_typeof(visibility) = 'object'),
  profile_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(profile_data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique,
  name text not null,
  prefecture text not null default '',
  municipality text not null default '',
  district text not null default '',
  settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings) = 'object'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.workspace_memberships (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('sprayer', 'neighbor', 'admin')),
  status text not null default 'active'
    check (status in ('active', 'invited', 'suspended')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id, role)
);

create table public.workspace_invites (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role text not null check (role in ('sprayer', 'neighbor', 'admin')),
  email text,
  token_hash text not null unique,
  expires_at timestamptz not null,
  max_uses integer not null default 1 check (max_uses between 1 and 1000),
  used_count integer not null default 0 check (used_count >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table public.fields (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_ref text not null,
  owner_user_id uuid not null references auth.users(id),
  name text not null,
  field_type text not null default 'other'
    check (field_type in (
      'spray', 'organic', 'noChemical', 'house', 'preharvest',
      'water', 'bee', 'public', 'other'
    )),
  crop text not null default '未登録',
  cultivation text not null default '未登録・未回答',
  chemical_use text not null default '未回答',
  organic_jas text not null default '未回答',
  notify_preference text not null default '未確認',
  contact_method text not null default '未確認',
  harvest_window text not null default '未登録',
  avoid_reason text not null default '',
  visibility_level text not null default 'related'
    check (visibility_level in ('private', 'related', 'workspace')),
  geometry extensions.geometry(Geometry, 4326),
  geometry_revision text not null default 'missing',
  external_refs jsonb not null default '[]'::jsonb
    check (jsonb_typeof(external_refs) = 'array'),
  provenance jsonb not null default '{}'::jsonb
    check (jsonb_typeof(provenance) = 'object'),
  field_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(field_data) = 'object'),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (workspace_id, client_ref),
  constraint fields_geometry_type_check check (
    geometry is null
    or extensions.st_geometrytype(geometry) in ('ST_Polygon', 'ST_MultiPolygon')
  )
);

create table public.field_access_grants (
  field_id uuid not null references public.fields(id) on delete cascade,
  grantee_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null default 'related',
  granted_by uuid not null references auth.users(id),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (field_id, grantee_user_id)
);

create table public.operation_plans (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_ref text not null,
  field_id uuid references public.fields(id) on delete set null,
  created_by uuid not null references auth.users(id),
  operation_type text not null default 'pesticide'
    check (operation_type in ('pesticide', 'fertilizer', 'other')),
  status text not null default 'draft'
    check (status in ('draft', 'planned', 'in_progress', 'completed', 'postponed', 'cancelled')),
  planned_date date,
  time_window text not null default '',
  district text not null default '',
  operator_display_name text not null default '',
  material_name text not null default '',
  purpose text not null default '',
  visibility_level text not null default 'related'
    check (visibility_level in ('private', 'related', 'workspace')),
  plan_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(plan_data) = 'object'),
  idempotency_key text,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (workspace_id, client_ref),
  unique (workspace_id, idempotency_key)
);

create table public.weather_records (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan_id uuid not null references public.operation_plans(id) on delete cascade,
  record_type text not null
    check (record_type in ('forecast', 'operator_confirmation', 'field_measurement')),
  target_at timestamptz,
  recorded_at timestamptz not null default now(),
  recorded_by uuid references auth.users(id),
  source text not null default '',
  wind_direction text not null default '',
  wind_speed_mps numeric,
  gust_mps numeric,
  temperature_c numeric,
  humidity_percent numeric,
  precipitation_mm numeric,
  location_label text not null default '',
  weather_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(weather_data) = 'object'),
  created_at timestamptz not null default now()
);

create table public.plan_checks (
  plan_id uuid not null references public.operation_plans(id) on delete cascade,
  check_key text not null,
  is_checked boolean not null default false,
  checked_by uuid references auth.users(id),
  checked_at timestamptz,
  evidence jsonb not null default '{}'::jsonb
    check (jsonb_typeof(evidence) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (plan_id, check_key)
);

create table public.notification_targets (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan_id uuid not null references public.operation_plans(id) on delete cascade,
  field_id uuid references public.fields(id) on delete set null,
  recipient_user_id uuid references auth.users(id) on delete set null,
  channel text not null default 'line'
    check (channel in ('line', 'email', 'phone', 'paper', 'app')),
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'queued', 'sent', 'delivered', 'failed', 'skipped')),
  delivered_at timestamptz,
  response_code text not null default 'unanswered'
    check (response_code in (
      'unanswered', 'confirmed', 'change_requested', 'call_requested',
      'harvest_consultation', 'other'
    )),
  response_message text not null default '',
  responded_at timestamptz,
  response_by uuid references auth.users(id),
  notification_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(notification_data) = 'object'),
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, field_id, recipient_user_id),
  unique (workspace_id, idempotency_key)
);

create table public.work_records (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan_id uuid not null unique references public.operation_plans(id) on delete cascade,
  submitted_by uuid not null references auth.users(id),
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'needs_follow_up')),
  completed_date date,
  completed_time_window text not null default '',
  actual_area_ha numeric,
  actual_amount text not null default '',
  incident_status text not null default 'none',
  inquiry_status text not null default 'none',
  report_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(report_data) = 'object'),
  idempotency_key text,
  version bigint not null default 1 check (version > 0),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);

create table public.app_assets (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id),
  owner_type text not null check (owner_type in ('work_record', 'flight_log', 'field', 'plan')),
  owner_id uuid not null,
  asset_kind text not null check (asset_kind in ('report_photo', 'flight_track', 'boundary', 'other')),
  bucket_id text not null check (bucket_id in ('report-assets', 'flight-logs')),
  object_path text not null,
  mime_type text not null default 'application/octet-stream',
  byte_size bigint not null default 0 check (byte_size >= 0),
  sha256 text not null default '',
  asset_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(asset_data) = 'object'),
  created_at timestamptz not null default now(),
  unique (bucket_id, object_path)
);

create table public.flight_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan_id uuid not null references public.operation_plans(id) on delete cascade,
  imported_by uuid not null references auth.users(id),
  provider text not null default 'manual',
  external_id text,
  started_at timestamptz,
  ended_at timestamptz,
  point_count integer not null default 0 check (point_count >= 0),
  track extensions.geometry(Geometry, 4326),
  asset_id uuid references public.app_assets(id) on delete set null,
  log_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(log_data) = 'object'),
  created_at timestamptz not null default now(),
  constraint flight_logs_track_type_check check (
    track is null
    or extensions.st_geometrytype(track) in ('ST_LineString', 'ST_MultiLineString')
  )
);

create table public.audit_events (
  id bigint generated by default as identity primary key,
  workspace_id uuid references public.workspaces(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  event_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(event_data) = 'object'),
  created_at timestamptz not null default now()
);

create index workspace_memberships_user_idx
  on public.workspace_memberships (user_id, status, workspace_id);
create index fields_workspace_idx on public.fields (workspace_id, archived_at);
create index fields_owner_idx on public.fields (owner_user_id, workspace_id);
create index fields_geometry_gix on public.fields using gist (geometry);
create index field_access_grants_user_idx
  on public.field_access_grants (grantee_user_id, expires_at);
create index operation_plans_workspace_date_idx
  on public.operation_plans (workspace_id, planned_date desc, status);
create index operation_plans_creator_idx
  on public.operation_plans (created_by, workspace_id);
create index weather_records_plan_idx
  on public.weather_records (plan_id, record_type, recorded_at desc);
create index notification_targets_recipient_idx
  on public.notification_targets (recipient_user_id, delivery_status, responded_at);
create index notification_targets_plan_idx
  on public.notification_targets (plan_id, field_id);
create index work_records_workspace_idx
  on public.work_records (workspace_id, completed_date desc);
create index app_assets_owner_idx
  on public.app_assets (owner_type, owner_id);
create index flight_logs_plan_idx
  on public.flight_logs (plan_id, created_at desc);
create index flight_logs_track_gix on public.flight_logs using gist (track);
create index audit_events_workspace_idx
  on public.audit_events (workspace_id, created_at desc);
create index audit_events_actor_idx
  on public.audit_events (actor_user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();
create trigger workspace_memberships_set_updated_at
before update on public.workspace_memberships
for each row execute function public.set_updated_at();
create trigger fields_set_updated_at
before update on public.fields
for each row execute function public.set_updated_at();
create trigger operation_plans_set_updated_at
before update on public.operation_plans
for each row execute function public.set_updated_at();
create trigger plan_checks_set_updated_at
before update on public.plan_checks
for each row execute function public.set_updated_at();
create trigger notification_targets_set_updated_at
before update on public.notification_targets
for each row execute function public.set_updated_at();
create trigger work_records_set_updated_at
before update on public.work_records
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.create_workspace_with_admin(
  p_name text,
  p_prefecture text default '',
  p_municipality text default '',
  p_district text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_workspace uuid;
  v_slug text;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'workspace name is required' using errcode = '22023';
  end if;

  v_slug := 'workspace-' || replace(extensions.gen_random_uuid()::text, '-', '');
  insert into public.workspaces (
    slug, name, prefecture, municipality, district, created_by
  )
  values (
    v_slug,
    btrim(p_name),
    coalesce(btrim(p_prefecture), ''),
    coalesce(btrim(p_municipality), ''),
    coalesce(btrim(p_district), ''),
    v_user
  )
  returning id into v_workspace;

  insert into public.workspace_memberships (
    workspace_id, user_id, role, status, created_by
  )
  values (v_workspace, v_user, 'admin', 'active', v_user);

  return v_workspace;
end;
$$;

create or replace function public.create_workspace_invite(
  p_workspace_id uuid,
  p_role text,
  p_email text default null,
  p_expires_at timestamptz default (now() + interval '7 days'),
  p_max_uses integer default 1
)
returns table (invite_id uuid, invite_token text)
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_token text;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_role not in ('sprayer', 'neighbor', 'admin') then
    raise exception 'invalid role' using errcode = '22023';
  end if;
  if p_expires_at <= now() then
    raise exception 'expiry must be in the future' using errcode = '22023';
  end if;
  if p_max_uses < 1 or p_max_uses > 1000 then
    raise exception 'invalid max uses' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.workspace_memberships wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = v_user
      and wm.role = 'admin'
      and wm.status = 'active'
  ) then
    raise exception 'workspace admin required' using errcode = '42501';
  end if;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.workspace_invites (
    workspace_id, role, email, token_hash, expires_at,
    max_uses, created_by
  )
  values (
    p_workspace_id,
    p_role,
    nullif(lower(btrim(p_email)), ''),
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    p_expires_at,
    p_max_uses,
    v_user
  )
  returning id into v_id;

  return query select v_id, v_token;
end;
$$;

create or replace function public.accept_workspace_invite(p_token text)
returns table (workspace_id uuid, role text)
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_invite public.workspace_invites%rowtype;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if nullif(btrim(p_token), '') is null then
    raise exception 'invite token is required' using errcode = '22023';
  end if;

  select lower(coalesce(email, ''))
  into v_email
  from auth.users
  where id = v_user;

  select *
  into v_invite
  from public.workspace_invites wi
  where wi.token_hash = encode(extensions.digest(btrim(p_token), 'sha256'), 'hex')
    and wi.revoked_at is null
    and wi.expires_at > now()
    and wi.used_count < wi.max_uses
  for update;

  if v_invite.id is null then
    raise exception 'invite is invalid or expired' using errcode = '22023';
  end if;
  if v_invite.email is not null and lower(v_invite.email) <> v_email then
    raise exception 'invite does not match this account' using errcode = '42501';
  end if;

  insert into public.workspace_memberships (
    workspace_id, user_id, role, status, created_by
  )
  values (
    v_invite.workspace_id, v_user, v_invite.role, 'active', v_invite.created_by
  )
  on conflict (workspace_id, user_id, role)
  do update set status = 'active', updated_at = now();

  update public.workspace_invites
  set used_count = used_count + 1
  where id = v_invite.id;

  return query select v_invite.workspace_id, v_invite.role;
end;
$$;

revoke all on function public.create_workspace_with_admin(text, text, text, text) from public;
revoke all on function public.create_workspace_invite(uuid, text, text, timestamptz, integer) from public;
revoke all on function public.accept_workspace_invite(text) from public;
grant execute on function public.create_workspace_with_admin(text, text, text, text) to authenticated;
grant execute on function public.create_workspace_invite(uuid, text, text, timestamptz, integer) to authenticated;
grant execute on function public.accept_workspace_invite(text) to authenticated;

commit;
