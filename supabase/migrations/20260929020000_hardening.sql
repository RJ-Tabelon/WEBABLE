-- Hardening after the RLS suite review, plus an RPC for opt-in aggregate ingest.

-- 1. A profile without a version key must be rejected (a NULL comparison would pass the check).
alter table public.fit_profiles drop constraint fit_profile_bounded;
alter table public.fit_profiles add constraint fit_profile_bounded check (
  jsonb_typeof(profile) = 'object'
  and coalesce(profile ->> 'v', '') = '1'
  and octet_length(profile::text) < 8192
);

-- 2. TRUNCATE ignores RLS. The Data API cannot issue it, but no client role should hold it.
revoke truncate, references, trigger on all tables in schema public from authenticated, anon;

-- 3. A profile may only reference the caller's own calibration session.
--    Foreign-key checks bypass RLS, so this is enforced explicitly.
create or replace function public.save_fit_profile(
  p_profile jsonb,
  p_source text,
  p_derivation_version text,
  p_calibration_session_id uuid default null
)
returns public.fit_profiles
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_next integer;
  v_row public.fit_profiles;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_calibration_session_id is not null and not exists (
    select 1 from public.calibration_sessions s
    where s.id = p_calibration_session_id and s.user_id = v_user
  ) then
    raise exception 'calibration session not found' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  select coalesce(max(version), 0) + 1 into v_next
    from public.fit_profiles where user_id = v_user;

  update public.fit_profiles set is_current = false
    where user_id = v_user and is_current;

  insert into public.fit_profiles
    (user_id, version, profile, source, calibration_session_id, derivation_version, is_current)
  values
    (v_user, v_next, p_profile, p_source, p_calibration_session_id, p_derivation_version, true)
  returning * into v_row;

  update public.accounts
    set onboarding_step = case when onboarding_step in ('new', 'tuning') then 'tuned'
                               else onboarding_step end
    where user_id = v_user;

  return v_row;
end;
$$;

revoke execute on function public.save_fit_profile(jsonb, text, text, uuid) from public, anon;
grant execute on function public.save_fit_profile(jsonb, text, text, uuid) to authenticated;

-- 4. Opt-in aggregate ingest as one service-role-only transaction.
--    The user id is read only for consent; what is written carries no user id.
--    Returns 'stored', 'no_consent', or 'already_reported'.
create function public.ingest_agg_report(
  p_user uuid,
  p_tag text,
  p_period text,
  p_expires timestamptz,
  p_limit smallint,
  p_window text,
  p_lib text,
  p_cells jsonb,
  p_retention_cutoff text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_consent boolean;
  v_used smallint;
begin
  set local statement_timeout = '3s';

  if p_tag !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid tag' using errcode = '22023';
  end if;
  if jsonb_typeof(p_cells) <> 'array' or jsonb_array_length(p_cells) > 4 then
    raise exception 'invalid cells' using errcode = '22023';
  end if;

  select a.product_learning into v_consent from public.accounts a where a.user_id = p_user;
  if v_consent is not true then
    return 'no_consent';
  end if;

  delete from private.ingest_quota where expires_at < now();

  insert into private.ingest_quota as q (tag, period, used, expires_at)
    values (decode(p_tag, 'hex'), p_period, 1, p_expires)
    on conflict (tag) do update set used = q.used + 1
      where q.used < p_limit
    returning q.used into v_used;
  if v_used is null then
    return 'already_reported';
  end if;

  insert into private.agg_outcome as a (window_id, lib_ver, op, need, cat, mode, trigger, n, ones)
    select p_window, p_lib, c.op, c.need, c.cat, c.mode, c.trigger, 1, c.y
    from jsonb_to_recordset(p_cells)
      as c(op text, need smallint, cat text, mode text, trigger text, y integer)
    where c.op ~ '^[a-z_]{2,32}$' and c.cat ~ '^[a-z_]{2,32}$' and c.y in (0, 1)
  on conflict (window_id, lib_ver, op, need, cat, mode, trigger)
    do update set n = a.n + 1, ones = a.ones + excluded.ones;

  delete from private.agg_outcome where window_id < p_retention_cutoff;

  return 'stored';
end;
$$;

revoke execute on function public.ingest_agg_report(uuid, text, text, timestamptz, smallint, text, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.ingest_agg_report(uuid, text, text, timestamptz, smallint, text, text, jsonb, text)
  to service_role;
