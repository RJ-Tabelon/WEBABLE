// Shared fixtures: one row per user-owned public table, written as that user.

/** A valid-shaped fit profile document (the database only checks v, type and size). */
export const PROFILE_DOC = JSON.stringify({
  v: 1,
  derivationVersion: 'fit-1.0.0',
  note: 'rls-test',
});

/**
 * Every user-owned table in `public`, with how to create a row for a user and a
 * harmless update. `ownerKey` identifies the row for cross-user checks.
 */
export const OWNED_TABLES = [
  {
    name: 'calibration_sessions',
    insert: `insert into public.calibration_sessions (user_id, calibration_version, device)
             values ($1, 'cal-1.0.0', '{"class":"laptop"}'::jsonb)`,
    update: `status = 'abandoned'`,
  },
  {
    name: 'fit_profiles',
    insert: `insert into public.fit_profiles (user_id, version, profile, source, derivation_version)
             values ($1, 1, '${PROFILE_DOC}'::jsonb, 'calibration', 'fit-1.0.0')`,
    update: `source = 'adjustment'`,
  },
  {
    name: 'learning_state',
    insert: `insert into public.learning_state (user_id, state, engine_version)
             values ($1, '{"v":1}'::jsonb, 'learn-1.0.0')`,
    update: `rev = rev + 1`,
  },
  {
    name: 'weekly_activity',
    insert: `insert into public.weekly_activity (user_id, week, op, applied)
             values ($1, date_trunc('week', now())::date, 'text_size', 1)`,
    update: `applied = applied + 1`,
  },
  {
    name: 'extension_installs',
    insert: `insert into public.extension_installs (id, user_id, browser, platform, extension_version)
             values (gen_random_uuid(), $1, 'chrome', 'mac', '0.1.0')`,
    update: `last_seen_at = now()`,
  },
];

/** Every table in `public` (including accounts, which the trigger owns). */
export const PUBLIC_TABLES = ['accounts', ...OWNED_TABLES.map((t) => t.name)];

/** Seed one row in every owned table for a user, as that user. */
export async function seedAllAs(tx, uid) {
  await tx.asUser(uid);
  for (const table of OWNED_TABLES) {
    await tx.query(table.insert, [uid]);
  }
}

/** Row counts per public table for a user, read as the owner role (bypasses RLS). */
export async function ownerCounts(tx, uid) {
  await tx.asOwner();
  const counts = {};
  for (const name of PUBLIC_TABLES) {
    counts[name] = Number(
      await tx.value(`select count(*) from public.${name} where user_id = $1`, [
        uid,
      ]),
    );
  }
  return counts;
}

/** The Monday `weeksAgo` weeks before the current ISO week, as YYYY-MM-DD (DB clock). */
export async function mondayWeeksAgo(tx, weeksAgo) {
  return tx.value(
    `select to_char(date_trunc('week', now())::date - ($1::int * 7), 'YYYY-MM-DD')`,
    [weeksAgo],
  );
}
