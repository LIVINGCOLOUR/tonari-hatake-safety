begin;

create table public.account_deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'cancelled', 'completed')),
  requested_at timestamptz not null default now(),
  cancelled_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  request_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(request_data) = 'object')
);

alter table public.account_deletion_requests enable row level security;

revoke all on public.account_deletion_requests from anon;
revoke all on public.account_deletion_requests from authenticated;
grant select on public.account_deletion_requests to authenticated;

create policy account_deletion_requests_select_own
on public.account_deletion_requests for select
to authenticated
using (user_id = auth.uid());

create or replace function public.request_account_deletion(
  p_confirmation text
)
returns public.account_deletion_requests
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.account_deletion_requests%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if btrim(coalesce(p_confirmation, '')) <> '退会を申請' then
    raise exception 'confirmation mismatch' using errcode = '22023';
  end if;

  insert into public.account_deletion_requests (
    user_id,
    status,
    requested_at,
    cancelled_at,
    completed_at,
    updated_at
  )
  values (
    v_user_id,
    'pending',
    now(),
    null,
    null,
    now()
  )
  on conflict (user_id) do update
  set status = 'pending',
      requested_at = now(),
      cancelled_at = null,
      completed_at = null,
      updated_at = now()
  returning * into v_request;

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    event_data
  )
  values (
    v_user_id,
    'request',
    'account_deletion',
    v_user_id::text,
    jsonb_build_object('status', 'pending', 'recorded_at', now())
  );

  return v_request;
end;
$$;

create or replace function public.cancel_account_deletion()
returns public.account_deletion_requests
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.account_deletion_requests%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  update public.account_deletion_requests
  set status = 'cancelled',
      cancelled_at = now(),
      updated_at = now()
  where user_id = v_user_id
    and status = 'pending'
  returning * into v_request;

  if v_request.user_id is null then
    raise exception 'pending request not found' using errcode = 'P0002';
  end if;

  insert into public.audit_events (
    actor_user_id,
    event_type,
    entity_type,
    entity_id,
    event_data
  )
  values (
    v_user_id,
    'cancel',
    'account_deletion',
    v_user_id::text,
    jsonb_build_object('status', 'cancelled', 'recorded_at', now())
  );

  return v_request;
end;
$$;

revoke all on function public.request_account_deletion(text) from public;
revoke all on function public.cancel_account_deletion() from public;
grant execute on function public.request_account_deletion(text) to authenticated;
grant execute on function public.cancel_account_deletion() to authenticated;

commit;
