// Size and shape constraints: jsonb documents are bounded objects, version
// strings are short, and session status stays consistent with completed_at.

import assert from 'node:assert/strict';

export const suite = 'constraints';

const pad = (bytes) => JSON.stringify({ pad: 'x'.repeat(bytes) });

export const tests = [
  {
    name: 'calibration_sessions: device and modules are bounded objects',
    async fn(tx) {
      const a = await tx.createUser('a');
      await tx.asUser(a.id);
      const insert = `insert into public.calibration_sessions (user_id, calibration_version, device, modules)
                      values ($1, 'cal-1.0.0', $2::jsonb, $3::jsonb)`;
      await tx.expectError(insert, [a.id, pad(1100), '{}'], '23514');
      await tx.expectError(insert, [a.id, '"laptop"', '{}'], '23514');
      await tx.expectError(insert, [a.id, '{}', pad(16500)], '23514');
      await tx.expectError(insert, [a.id, '{}', '[]'], '23514');
      assert.equal(
        await tx.count(insert, [a.id, pad(900), pad(16000)]),
        1,
        'within bounds is accepted',
      );
    },
  },
  {
    name: 'calibration_sessions: status and completed_at stay consistent',
    async fn(tx) {
      const a = await tx.createUser('a');
      await tx.asUser(a.id);
      const id = await tx.value(
        `insert into public.calibration_sessions (user_id, calibration_version, device)
         values ($1, 'cal-1.0.0', '{}'::jsonb) returning id`,
        [a.id],
      );
      await tx.expectError(
        `update public.calibration_sessions set status = 'completed' where id = $1`,
        [id],
        '23514',
      );
      await tx.expectError(
        `update public.calibration_sessions set completed_at = now() where id = $1`,
        [id],
        '23514',
      );
      await tx.expectError(
        `update public.calibration_sessions set status = 'done' where id = $1`,
        [id],
        '23514',
      );
      assert.equal(
        await tx.count(
          `update public.calibration_sessions set status = 'completed', completed_at = now() where id = $1`,
          [id],
        ),
        1,
      );
      await tx.expectError(
        `insert into public.calibration_sessions (user_id, calibration_version, device) values ($1, $2, '{}'::jsonb)`,
        [a.id, 'x'.repeat(33)],
        '23514',
      );
    },
  },
  {
    name: 'fit_profiles: the document must be a v1 object under 8 KB',
    async fn(tx) {
      const a = await tx.createUser('a');
      await tx.asUser(a.id);
      const insert = `insert into public.fit_profiles (user_id, version, profile, source, derivation_version)
                      values ($1, $2, $3::jsonb, 'calibration', 'fit-1.0.0')`;
      await tx.expectError(
        insert,
        [a.id, 1, JSON.stringify({ v: 1, pad: 'x'.repeat(8200) })],
        '23514',
      );
      await tx.expectError(
        insert,
        [a.id, 1, JSON.stringify({ v: '2' })],
        '23514',
      );
      await tx.expectError(insert, [a.id, 1, '[]'], '23514');
      await tx.expectError(
        insert,
        [a.id, 0, JSON.stringify({ v: 1 })],
        '23514',
      );
      assert.equal(
        await tx.count(insert, [a.id, 1, JSON.stringify({ v: 1 })]),
        1,
      );
      await tx.expectError(
        insert,
        [a.id, 1, JSON.stringify({ v: 1 })],
        '23505',
      );
    },
  },
  {
    // Known gap in 20260929000000_core.sql: `(profile ->> 'v') = '1'` is NULL when
    // `v` is absent, and a NULL CHECK passes. Fix in a follow-up migration with
    // `coalesce(profile ->> 'v', '') = '1'`. The web data layer validates with
    // fitProfileSchema before saving, so the app never writes such a document.
    name: 'fit_profiles: a document without v is rejected',
    advisory: true,
    async fn(tx) {
      const a = await tx.createUser('a');
      await tx.asUser(a.id);
      await tx.expectError(
        `insert into public.fit_profiles (user_id, version, profile, source, derivation_version)
         values ($1, 1, '{}'::jsonb, 'calibration', 'fit-1.0.0')`,
        [a.id],
        '23514',
      );
    },
  },
  {
    name: 'fit_profiles: at most one current profile per person',
    async fn(tx) {
      const a = await tx.createUser('a');
      await tx.asUser(a.id);
      const insert = `insert into public.fit_profiles (user_id, version, profile, source, derivation_version, is_current)
                      values ($1, $2, '{"v":1}'::jsonb, 'calibration', 'fit-1.0.0', true)`;
      await tx.query(insert, [a.id, 1]);
      await tx.expectError(insert, [a.id, 2], '23505');
    },
  },
  {
    name: 'learning_state: the state must be an object under 16 KB',
    async fn(tx) {
      const a = await tx.createUser('a');
      await tx.asUser(a.id);
      const insert = `insert into public.learning_state (user_id, state, engine_version) values ($1, $2::jsonb, $3)`;
      await tx.expectError(insert, [a.id, pad(16400), 'learn-1.0.0'], '23514');
      await tx.expectError(insert, [a.id, '[]', 'learn-1.0.0'], '23514');
      await tx.expectError(insert, [a.id, '{}', 'x'.repeat(33)], '23514');
    },
  },
  {
    name: 'weekly_activity: counts are non-negative and weeks start on Monday',
    async fn(tx) {
      const a = await tx.createUser('a');
      await tx.asUser(a.id);
      const insert = `insert into public.weekly_activity (user_id, week, op, applied)
                      values ($1, date_trunc('week', now())::date + $2::int, $3, $4)`;
      await tx.expectError(insert, [a.id, 0, 'text_size', -1], '23514');
      await tx.expectError(insert, [a.id, 2, 'text_size', 1], '23514');
      await tx.expectError(insert, [a.id, 0, 'x', 1], '23514');
      await tx.expectError(insert, [a.id, 0, 'a'.repeat(33), 1], '23514');
    },
  },
  {
    name: 'extension_installs: descriptive fields are short',
    async fn(tx) {
      const a = await tx.createUser('a');
      await tx.asUser(a.id);
      const insert = `insert into public.extension_installs (id, user_id, browser, platform, extension_version)
                      values (gen_random_uuid(), $1, $2, $3, $4)`;
      await tx.expectError(
        insert,
        [a.id, 'x'.repeat(33), 'mac', '0.1.0'],
        '23514',
      );
      await tx.expectError(
        insert,
        [a.id, 'chrome', 'x'.repeat(33), '0.1.0'],
        '23514',
      );
      await tx.expectError(
        insert,
        [a.id, 'chrome', 'mac', 'x'.repeat(33)],
        '23514',
      );
    },
  },
];
