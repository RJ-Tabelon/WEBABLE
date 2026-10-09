-- Round 1 review fixes.
--   1. Fit history can be restored: a restored version is saved with source 'restore'.
--   2. The theme follows the most recent explicit choice: accounts.theme_set_at.
--   3. A fit profile can only reference the person's own calibration session,
--      even when written directly rather than through save_fit_profile().

alter table public.fit_profiles
  drop constraint fit_profiles_source_check;
alter table public.fit_profiles
  add constraint fit_profiles_source_check
  check (source in ('calibration', 'recalibration', 'adjustment', 'learned', 'import', 'restore'));

alter table public.accounts
  add column theme_set_at timestamptz;

drop policy fit_profiles_insert_own on public.fit_profiles;
create policy fit_profiles_insert_own on public.fit_profiles
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      calibration_session_id is null
      or exists (
        select 1 from public.calibration_sessions s
        where s.id = calibration_session_id and s.user_id = (select auth.uid())
      )
    )
  );

drop policy fit_profiles_update_own on public.fit_profiles;
create policy fit_profiles_update_own on public.fit_profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      calibration_session_id is null
      or exists (
        select 1 from public.calibration_sessions s
        where s.id = calibration_session_id and s.user_id = (select auth.uid())
      )
    )
  );
