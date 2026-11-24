// Database harness for the RLS and function suite.
//
// Every test runs inside BEGIN ... ROLLBACK on one connection, so nothing it
// creates (auth users, rows, quota counters) ever persists. Expected failures
// run inside a SAVEPOINT so the surrounding transaction stays usable.

import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import pg from 'pg';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/**
 * Resolve the Postgres URL for tests. Session mode (:5432) is required because
 * `set local role` and `set_config(..., true)` must stay on one backend for the
 * whole transaction; the transaction pooler (:6543) is rewritten to :5432.
 */
export function resolveDbUrl() {
  dotenv.config({ path: resolve(ROOT, '.env'), quiet: true });
  const raw = process.env.DB_TEST_URL ?? process.env.SUPABASE_DIRECT_URL ?? '';
  if (!raw) return null;
  return raw.replace(/:6543\//, ':5432/');
}

export async function connect(url) {
  const client = new pg.Client({
    connectionString: url,
    application_name: 'webable-db-test',
    connectionTimeoutMillis: 15_000,
  });
  await client.connect();
  return client;
}

/** A SQL error we expected, reduced to what assertions need. */
export class ExpectedErrorMissing extends Error {
  constructor(label, expected) {
    super(`${label}: expected error ${expected}, but the statement succeeded`);
    this.name = 'ExpectedErrorMissing';
  }
}

let savepointSeq = 0;

/**
 * Per-test transaction context. Role switches use SET LOCAL so they end with
 * the transaction; `asOwner()` returns to the connection's login role.
 */
export class Tx {
  /** @param {pg.Client} client */
  constructor(client) {
    this.client = client;
  }

  /** Run a statement and return the full pg result. */
  async query(sql, params = []) {
    return this.client.query(sql, params);
  }

  async rows(sql, params = []) {
    return (await this.client.query(sql, params)).rows;
  }

  /** Exactly one row, or throw. */
  async one(sql, params = []) {
    const { rows } = await this.client.query(sql, params);
    if (rows.length !== 1)
      throw new Error(`expected 1 row, got ${rows.length}: ${sql}`);
    return rows[0];
  }

  /** First column of the single row. */
  async value(sql, params = []) {
    const row = await this.one(sql, params);
    return Object.values(row)[0];
  }

  /** Affected-row count of a write. */
  async count(sql, params = []) {
    return (await this.client.query(sql, params)).rowCount ?? 0;
  }

  /**
   * Assert that a statement fails with the given SQLSTATE (and, optionally, a
   * message pattern). The failure is contained in a savepoint.
   * @returns {Promise<{code: string, message: string}>}
   */
  async expectError(sql, params, code, messagePattern) {
    const sp = `sp_${++savepointSeq}`;
    await this.client.query(`savepoint ${sp}`);
    let caught = null;
    try {
      await this.client.query(sql, params);
    } catch (error) {
      caught = error;
    }
    await this.client.query(`rollback to savepoint ${sp}`);
    if (!caught) throw new ExpectedErrorMissing(sql.trim().slice(0, 80), code);
    if (caught.code !== code) {
      throw new Error(
        `expected SQLSTATE ${code}, got ${caught.code} (${caught.message}) for: ${sql.trim().slice(0, 80)}`,
      );
    }
    if (messagePattern && !messagePattern.test(caught.message)) {
      throw new Error(
        `error message "${caught.message}" does not match ${messagePattern}`,
      );
    }
    return { code: caught.code, message: caught.message };
  }

  /** Back to the login role (postgres on Supabase), with no JWT claims. */
  async asOwner() {
    await this.client.query('reset role');
    await this.client.query(
      `select set_config('request.jwt.claims', '', true)`,
    );
  }

  /** Impersonate a signed-in user exactly as PostgREST does. */
  async asUser(uid) {
    await this.client.query('set local role authenticated');
    await this.client.query(
      `select set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role', 'authenticated')::text, true)`,
      [uid],
    );
  }

  /** The authenticated role with no subject (a malformed or missing token). */
  async asAuthenticatedWithoutSub() {
    await this.client.query('set local role authenticated');
    await this.client.query(
      `select set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true)`,
    );
  }

  async asAnon() {
    await this.client.query('set local role anon');
    await this.client.query(
      `select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true)`,
    );
  }

  async asService() {
    await this.client.query('set local role service_role');
    await this.client.query(
      `select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true)`,
    );
  }

  /**
   * Create an auth user directly in auth.users (as the owner role), which fires
   * the on_auth_user_created trigger exactly as a real sign-up does.
   */
  async createUser(label = 'user') {
    const id = randomUUID();
    const email = `rls-${label}-${id.slice(0, 8)}@webable.test`;
    await this.asOwner();
    await this.client.query(
      `insert into auth.users
         (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values
         ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '',
          now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())`,
      [id, email],
    );
    return { id, email };
  }
}

/**
 * Run one test in its own transaction and always roll back.
 * @param {pg.Client} client
 * @param {(tx: Tx) => Promise<void>} fn
 */
export async function inRollback(client, fn) {
  await client.query('begin');
  try {
    await client.query(`set local statement_timeout = '20s'`);
    await client.query(`set local lock_timeout = '10s'`);
    await client.query(`set local idle_in_transaction_session_timeout = '60s'`);
    await fn(new Tx(client));
  } finally {
    await client.query('rollback').catch(() => {});
  }
}
