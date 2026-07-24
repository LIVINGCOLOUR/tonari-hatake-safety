begin;

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

  select lower(coalesce(au.email, ''))
  into v_email
  from auth.users au
  where au.id = v_user;

  select wi.*
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
  on conflict on constraint workspace_memberships_pkey
  do update set status = 'active', updated_at = now();

  update public.workspace_invites wi
  set used_count = wi.used_count + 1
  where wi.id = v_invite.id;

  return query select v_invite.workspace_id, v_invite.role;
end;
$$;

commit;
