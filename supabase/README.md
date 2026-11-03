# Backend authentication

The `extension-link` Edge Function lets a signed-in web-app user obtain a single-use Supabase magic-link token hash for the extension. It does not send a sign-in email or pass the web app's refresh token to the extension. It rejects anonymous users, unapproved browser origins, oversized or unexpected request bodies, and links belonging to a different user.

The shared HTTP and authentication helpers and endpoint tests are adapted from `WEBABLE-PROTOYPE` commit `5e91301`. This change does not import application database migrations, the web app, or the extension's account-sync/UI code.

## Run the tests

Install [Deno 2.9.8](https://docs.deno.com/runtime/getting_started/installation/) and run from the repository root:

```sh
pnpm test:functions
pnpm test:functions -- --filter "rate"
```

The wrapper typechecks the production entrypoint before running the shared-auth, origin, HTTP-body and endpoint tests. Tests use injected dependencies, require no environment values, and have no network/environment permissions at runtime. Deno may download the locked npm/JSR dependencies on the first run. Its dependency cache is separate from pnpm; `supabase/deno.lock` is checked with `--frozen` in local checks and CI.

To intentionally update backend dependency resolution, run this command, review the lockfile diff, then rerun `pnpm test:functions`:

```sh
deno check --no-config --lock=supabase/deno.lock supabase/functions/extension-link/index.ts supabase/functions/extension-link/handler.test.ts supabase/functions/extension-link/rate-limit.test.ts supabase/tests/functions/auth.test.ts supabase/tests/functions/cors.test.ts supabase/tests/functions/http.test.ts
```

Set `DENO_NO_PACKAGE_JSON=1` in your shell before that dependency-update command so Deno does not try to migrate the pnpm workspace. For PowerShell: `$env:DENO_NO_PACKAGE_JSON='1'`.

## Configuration

Hosted Supabase functions receive `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from the platform. The helper also accepts Supabase's `SUPABASE_PUBLISHABLE_KEYS` and `SUPABASE_SECRET_KEYS` key maps. Secret/service-role keys stay in the backend.

Set `WEB_ORIGINS` to a comma-separated list of exact web-app origins allowed to request a handoff, such as `https://app.example.com,http://localhost:3000`. Browser calls from other origins are refused. Server calls without an Origin still require a valid user's bearer token. `JWT_ISSUER` can optionally pin the expected issuer.

The endpoint verifies bearer tokens itself through the project's Supabase Auth client and confirms the user with Auth before generating a link. Disable the legacy gateway JWT check for this function so asymmetric user tokens and browser preflight requests can reach the handler. The handler's authentication remains required.

With the Supabase CLI authenticated and the target project's `WEB_ORIGINS` secret configured:

```sh
supabase functions deploy extension-link --project-ref YOUR_PROJECT_REF --no-verify-jwt
```

The database-setup PR #4 already owns the shared `supabase/config.toml`; this PR avoids adding a competing configuration. When that PR is merged, keep its `[functions.extension-link]` `verify_jwt = false` setting. This endpoint uses Supabase Auth and does not require application tables or a database migration.

## Request and response

```http
POST /functions/v1/extension-link
Authorization: Bearer USER_ACCESS_TOKEN
Content-Type: application/json
Origin: https://app.example.com

{}
```

The body must be empty or `{}` and is limited to 1 KiB. A successful response is `{ "tokenHash": "...", "email": "..." }`, with `Cache-Control: no-store`. The extension client subsequently exchanges the hash with `auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash })`; that client integration is outside this PR.

The endpoint uses per-user and per-isolate sliding-window limits. These are burst controls, not a durable limit shared by every server instance. Responses distinguish invalid sessions (401), disallowed callers (403), rate limits (429), configuration failures (500) and temporary Auth/admin API failures (503). Logs omit token hashes, bearer tokens, email addresses and request bodies.

## Hosted verification

Automated tests mock Supabase Auth and the admin link generator. Before release, verify the deployed function rejects missing/expired/signed-out sessions and disallowed origins, accepts a signed-in allowed web origin, and produces a hash that can be exchanged only once for the same user. Hosted deployment and a real email-account handoff require project access and are not performed by this test suite.
