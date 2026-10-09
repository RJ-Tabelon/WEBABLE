-- WebAble core schema.
--
-- The chain this schema supports:
--   calibration measurement (calibration_sessions.modules, summaries only)
--   -> fit profile (fit_profiles.profile, versioned; history = recalibration)
--   -> adaptation decisions + outcomes (on device only; never stored here)
--   -> learned preferences (learning_state, domain-free)
--   -> weekly activity (weekly_activity, domain-free counts for the person's own view)
--   -> opt-in product learning (private.agg_outcome, no user id).
--
-- What is deliberately NOT stored: URLs, domains, page content, DOM snapshots,
-- raw pointer or reading trials, diagnoses, or per-page event logs.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Accounts: one row per auth user, created by trigger.
-- ---------------------------------------------------------------------------
create type public.onboarding_step as enum ('new', 'tuning', 'tuned', 'connected');

create table public.accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  onboarding_step public.onboarding_step not null default 'new',
  -- Consent to send vocabulary-filtered page structure for analysis (Jev via Edge Function).
  cloud_analysis boolean not null default false,
  -- Consent to contribute randomized, anonymous outcome counts.
  product_learning boolean not null default false,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.accounts is 'Per-person settings and consents. No health information.';

-- ---------------------------------------------------------------------------
-- Calibration sessions: bounded summaries per module. Raw trials never leave the browser.
-- ---------------------------------------------------------------------------
create table public.calibration_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  calibration_version text not null check (char_length(calibration_version) <= 32),
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'abandoned')),
  device jsonb not null,
  modules jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint calibration_device_bounded check (
    jsonb_typeof(device) = 'object' and octet_length(device::text) < 1024
  ),
  constraint calibration_modules_bounded check (
    jsonb_typeof(modules) = 'object' and octet_length(modules::text) < 16384
  ),
  constraint calibration_completed_consistent check (
    (status = 'completed') = (completed_at is not null)
  )
);

create index calibration_sessions_user_started_idx
  on public.calibration_sessions (user_id, started_at desc);

-- ---------------------------------------------------------------------------
-- Fit profiles: versioned. Exactly one current profile per person.
-- ---------------------------------------------------------------------------
create table public.fit_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  version integer not null check (version > 0),
  profile jsonb not null,
  source text not null
    check (source in ('calibration', 'recalibration', 'adjustment', 'learned', 'import')),
  calibration_session_id uuid references public.calibration_sessions (id) on delete set null,
  derivation_version text not null check (char_length(derivation_version) <= 32),
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, version),
  constraint fit_profile_bounded check (
    jsonb_typeof(profile) = 'object'
    and (profile ->> 'v') = '1'
    and octet_length(profile::text) < 8192
  )
);

create unique index fit_profiles_one_current_idx
  on public.fit_profiles (user_id) where is_current;
create index fit_profiles_user_version_idx
  on public.fit_profiles (user_id, version desc);
create index fit_profiles_session_idx
  on public.fit_profiles (calibration_session_id) where calibration_session_id is not null;

-- ---------------------------------------------------------------------------
-- Learning state: domain-free. Optimistic concurrency through `rev`.
-- ---------------------------------------------------------------------------
create table public.learning_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  rev bigint not null default 1,
  engine_version text not null check (char_length(engine_version) <= 32),
  updated_at timestamptz not null default now(),
  constraint learning_state_bounded check (
    jsonb_typeof(state) = 'object' and octet_length(state::text) < 16384
  )
);

-- ---------------------------------------------------------------------------
-- Weekly activity: counts per op per week, for the person's own "Changes" view.
-- ---------------------------------------------------------------------------
create table public.weekly_activity (
  user_id uuid not null references auth.users (id) on delete cascade,
  week date not null check (extract(isodow from week) = 1),
  op text not null check (op ~ '^[a-z_]{2,32}$'),
  applied integer not null default 0 check (applied >= 0),
  kept integer not null default 0 check (kept >= 0),
  undone integer not null default 0 check (undone >= 0),
  undone_by_checks integer not null default 0 check (undone_by_checks >= 0),
  offered integer not null default 0 check (offered >= 0),
  accepted integer not null default 0 check (accepted >= 0),
  primary key (user_id, week, op)
);

-- ---------------------------------------------------------------------------
-- Extension installs: which browsers are connected. The id is random per install.
-- ---------------------------------------------------------------------------
create table public.extension_installs (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  browser text not null check (char_length(browser) <= 32),
  platform text not null check (char_length(platform) <= 32),
  extension_version text not null check (char_length(extension_version) <= 32),
  connected_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index extension_installs_user_idx on public.extension_installs (user_id);

-- ---------------------------------------------------------------------------
-- Private: page-analysis quota and anonymous product-learning aggregates.
-- ---------------------------------------------------------------------------
create table private.ai_quota (
  user_id uuid not null references auth.users (id) on delete cascade,
  window_start timestamptz not null,
  used integer not null default 0,
  primary key (user_id, window_start)
);

create table private.ai_quota_global (
  window_start timestamptz primary key,
  used integer not null default 0
);

-- No user id. Written only by the ingest Edge Function with randomized-response bits.
create table private.agg_outcome (
  window_id text not null,
  lib_ver text not null,
  op text not null,
  need smallint not null check (need between 0 and 2),
  cat text not null,
  mode text not null check (mode in ('auto', 'offer')),
  trigger text not null check (trigger in ('profile', 'friction', 'pinned')),
  n integer not null default 0,
  ones integer not null default 0,
  primary key (window_id, lib_ver, op, need, cat, mode, trigger)
);

-- Abuse control for ingest only: tag = HMAC(user_id, period salt); salt rotates and is destroyed.
create table private.ingest_quota (
  tag bytea primary key,
  period text not null,
  used smallint not null default 0,
  expires_at timestamptz not null
);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger accounts_touch before update on public.accounts
  for each row execute function private.touch_updated_at();

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.accounts (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security: every table, own rows only.
-- ---------------------------------------------------------------------------
alter table public.accounts enable row level security;
alter table public.calibration_sessions enable row level security;
alter table public.fit_profiles enable row level security;
alter table public.learning_state enable row level security;
alter table public.weekly_activity enable row level security;
alter table public.extension_installs enable row level security;
alter table private.ai_quota enable row level security;
alter table private.ai_quota_global enable row level security;
alter table private.agg_outcome enable row level security;
alter table private.ingest_quota enable row level security;

revoke all on all tables in schema public from anon;
revoke all on all tables in schema private from anon, authenticated;

create policy accounts_select_own on public.accounts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy accounts_update_own on public.accounts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy calibration_select_own on public.calibration_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy calibration_insert_own on public.calibration_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy calibration_update_own on public.calibration_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy calibration_delete_own on public.calibration_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy fit_profiles_select_own on public.fit_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
-- Writes go through save_fit_profile() (security invoker) so versions stay consistent.
create policy fit_profiles_insert_own on public.fit_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy fit_profiles_update_own on public.fit_profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy fit_profiles_delete_own on public.fit_profiles
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy learning_state_select_own on public.learning_state
  for select to authenticated using ((select auth.uid()) = user_id);
create policy learning_state_insert_own on public.learning_state
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy learning_state_update_own on public.learning_state
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy learning_state_delete_own on public.learning_state
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy weekly_activity_select_own on public.weekly_activity
  for select to authenticated using ((select auth.uid()) = user_id);
create policy weekly_activity_insert_own on public.weekly_activity
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy weekly_activity_update_own on public.weekly_activity
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy weekly_activity_delete_own on public.weekly_activity
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy extension_installs_select_own on public.extension_installs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy extension_installs_insert_own on public.extension_installs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy extension_installs_update_own on public.extension_installs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy extension_installs_delete_own on public.extension_installs
  for delete to authenticated using ((select auth.uid()) = user_id);

-- accounts rows are created by trigger; people cannot insert or delete them directly.
revoke insert, delete on public.accounts from authenticated;

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Save a new fit profile version and make it current, atomically.
create function public.save_fit_profile(
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

-- Replace learning state if the caller saw the latest revision; otherwise report a conflict.
create function public.put_learning_state(
  p_state jsonb,
  p_expected_rev bigint,
  p_engine_version text
)
returns table (ok boolean, rev bigint, state jsonb)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_current public.learning_state;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_current from public.learning_state ls where ls.user_id = v_user for update;

  if not found then
    if p_expected_rev <> 0 then
      return query select false, 0::bigint, null::jsonb;
      return;
    end if;
    insert into public.learning_state (user_id, state, rev, engine_version)
      values (v_user, p_state, 1, p_engine_version);
    return query select true, 1::bigint, p_state;
    return;
  end if;

  if v_current.rev <> p_expected_rev then
    return query select false, v_current.rev, v_current.state;
    return;
  end if;

  update public.learning_state ls
    set state = p_state, rev = ls.rev + 1, engine_version = p_engine_version, updated_at = now()
    where ls.user_id = v_user;

  return query select true, v_current.rev + 1, p_state;
end;
$$;

-- Add counts to this week's activity rows; prune rows older than 26 weeks.
create function public.record_activity(p_week date, p_counts jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_op text;
  v_c jsonb;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(p_counts) <> 'object' or octet_length(p_counts::text) > 4096 then
    raise exception 'invalid counts' using errcode = '22023';
  end if;

  for v_op, v_c in select key, value from jsonb_each(p_counts) loop
    insert into public.weekly_activity as wa
      (user_id, week, op, applied, kept, undone, undone_by_checks, offered, accepted)
    values (
      v_user, p_week, v_op,
      least(coalesce((v_c ->> 'applied')::int, 0), 10000),
      least(coalesce((v_c ->> 'kept')::int, 0), 10000),
      least(coalesce((v_c ->> 'undone')::int, 0), 10000),
      least(coalesce((v_c ->> 'undone_by_checks')::int, 0), 10000),
      least(coalesce((v_c ->> 'offered')::int, 0), 10000),
      least(coalesce((v_c ->> 'accepted')::int, 0), 10000)
    )
    on conflict (user_id, week, op) do update set
      applied = wa.applied + excluded.applied,
      kept = wa.kept + excluded.kept,
      undone = wa.undone + excluded.undone,
      undone_by_checks = wa.undone_by_checks + excluded.undone_by_checks,
      offered = wa.offered + excluded.offered,
      accepted = wa.accepted + excluded.accepted;
  end loop;

  delete from public.weekly_activity
    where user_id = v_user and week < (p_week - interval '26 weeks');
end;
$$;

-- Everything WebAble stores about the caller, as one JSON document.
create function public.export_my_data()
returns jsonb
language sql
security invoker
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'account', (select to_jsonb(a) from public.accounts a where a.user_id = (select auth.uid())),
    'fit_profiles', coalesce((select jsonb_agg(to_jsonb(f) order by f.version)
                      from public.fit_profiles f where f.user_id = (select auth.uid())), '[]'::jsonb),
    'calibration_sessions', coalesce((select jsonb_agg(to_jsonb(c) order by c.started_at)
                      from public.calibration_sessions c where c.user_id = (select auth.uid())), '[]'::jsonb),
    'learning_state', (select to_jsonb(l) from public.learning_state l where l.user_id = (select auth.uid())),
    'weekly_activity', coalesce((select jsonb_agg(to_jsonb(w) order by w.week, w.op)
                      from public.weekly_activity w where w.user_id = (select auth.uid())), '[]'::jsonb),
    'extension_installs', coalesce((select jsonb_agg(to_jsonb(e))
                      from public.extension_installs e where e.user_id = (select auth.uid())), '[]'::jsonb)
  );
$$;

-- Delete the caller's account and, by cascade, everything tied to it.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  delete from auth.users where id = v_user;
end;
$$;

-- Page-analysis quota: per person 30/min and 1500/day, product-wide 1000/min.
-- Callable only by the service role (the `decide` Edge Function).
create function public.consume_ai_quota(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_minute timestamptz := date_trunc('minute', now());
  v_day timestamptz := date_trunc('day', now());
  v_user_minute integer;
  v_user_day integer;
  v_global integer;
begin
  insert into private.ai_quota as q (user_id, window_start, used) values (p_user, v_minute, 1)
    on conflict (user_id, window_start) do update set used = q.used + 1
    returning used into v_user_minute;

  select coalesce(sum(used), 0) into v_user_day
    from private.ai_quota where user_id = p_user and window_start >= v_day;

  insert into private.ai_quota_global as g (window_start, used) values (v_minute, 1)
    on conflict (window_start) do update set used = g.used + 1
    returning used into v_global;

  delete from private.ai_quota where window_start < now() - interval '2 days';
  delete from private.ai_quota_global where window_start < now() - interval '1 hour';

  return jsonb_build_object(
    'user_ok', v_user_minute <= 30 and v_user_day <= 1500,
    'global_ok', v_global <= 1000
  );
end;
$$;

revoke execute on function public.consume_ai_quota(uuid) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid) to service_role;

revoke execute on function public.save_fit_profile(jsonb, text, text, uuid) from public, anon;
revoke execute on function public.put_learning_state(jsonb, bigint, text) from public, anon;
revoke execute on function public.record_activity(date, jsonb) from public, anon;
revoke execute on function public.export_my_data() from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.save_fit_profile(jsonb, text, text, uuid) to authenticated;
grant execute on function public.put_learning_state(jsonb, bigint, text) to authenticated;
grant execute on function public.record_activity(date, jsonb) to authenticated;
grant execute on function public.export_my_data() to authenticated;
grant execute on function public.delete_my_account() to authenticated;

revoke execute on function private.handle_new_user() from public, anon, authenticated;
revoke execute on function private.touch_updated_at() from public, anon, authenticated;
