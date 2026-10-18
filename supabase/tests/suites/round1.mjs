// Migration 20260930000000_round1: restored fit versions, the explicit theme
// timestamp, and fit profiles that may only reference the person's own
// calibration session (checked by the RLS policies, not only save_fit_profile).

import assert from 'node:assert/strict';

export const suite = 'round1';

const insertSession = `insert into public.calibration_sessions (user_id, calibration_version, device)
                       values ($1, 'cal-1.0.0', '{"class":"laptop"}'::jsonb) returning id`;

export const tests = [
  {
    name: "fit_profiles: source 'restore' is accepted",
    async fn(tx) {
      const a = await tx.createUser('a');
      await tx.asUser(a.id);
      const insert = `insert into public.fit_profiles (user_id, version, profile, source, derivation_version)
                      values ($1, $2, '{"v":1}'::jsonb, $3, 'fit-1.0.0')`;
      assert.equal(await tx.count(insert, [a.id, 1, 'restore']), 1);
      await tx.expectError(insert, [a.id, 2, 'restored'], '23514');
    },
  },
  {
    name: 'accounts: the owner writes theme_set_at; nobody else can',
    async fn(tx) {
      const a = await tx.createUser('a');
      const b = await tx.createUser('b');
      await tx.asUser(a.id);
      const update = `update public.accounts set theme = 'dark', theme_set_at = now() where user_id = $1`;
      assert.equal(await tx.count(update, [a.id]), 1, 'owner update');
      assert.notEqual(
        await tx.value(
          `select theme_set_at from public.accounts where user_id = $1`,
          [a.id],
        ),
        null,
      );
      assert.equal(await tx.count(update, [b.id]), 0, 'cross-user update');
      await tx.asOwner();
      assert.equal(
        await tx.value(
          `select theme_set_at from public.accounts where user_id = $1`,
          [b.id],
        ),
        null,
      );
    },
  },
  {
    name: "fit_profiles: a row cannot reference another person's calibration session",
    async fn(tx) {
      const a = await tx.createUser('a');
      const b = await tx.createUser('b');
      await tx.asUser(b.id);
      const theirs = await tx.value(insertSession, [b.id]);
      await tx.asUser(a.id);
      const mine = await tx.value(insertSession, [a.id]);
      const insert = `insert into public.fit_profiles
                        (user_id, version, profile, source, derivation_version, calibration_session_id)
                      values ($1, $2, '{"v":1}'::jsonb, 'calibration', 'fit-1.0.0', $3)`;
      await tx.expectError(insert, [a.id, 1, theirs], '42501');
      assert.equal(await tx.count(insert, [a.id, 1, mine]), 1, 'own session');
      await tx.expectError(
        `update public.fit_profiles set calibration_session_id = $2 where user_id = $1`,
        [a.id, theirs],
        '42501',
      );
    },
  },
];
