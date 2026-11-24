// Entry point: wires the handler to the real environment and Supabase clients.
// config.toml disables the legacy gateway JWT check for ES256 support.
// verifyRequest below authenticates every protected request.
//
// Environment:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY  injected by Supabase
//   WEB_ORIGINS  comma-separated web app origins allowed by CORS, e.g.
//                "http://localhost:3000,https://app.webable.example"

import { verifierFromClient, verifyRequest } from '../_shared/auth.ts';
import { corsPolicyFromEnv } from '../_shared/cors.ts';
import {
  createAuthClient,
  createServiceClient,
  denoEnv,
  type SupabaseClient,
} from '../_shared/supabase.ts';
import { createHandler, type MagicLinkResult } from './handler.ts';
import { createRateLimiter } from './rate-limit.ts';

let authClient: SupabaseClient | null = null;
let serviceClient: SupabaseClient | null = null;

async function generateMagicLink(email: string): Promise<MagicLinkResult> {
  serviceClient ??= createServiceClient(denoEnv);
  const { data, error } = await serviceClient.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (error || !data.user || !data.properties?.hashed_token) {
    throw error ?? new Error('generateLink returned no token');
  }
  return {
    hashedToken: data.properties.hashed_token,
    userId: data.user.id,
    verificationType: data.properties.verification_type,
  };
}

const handler = createHandler({
  cors: corsPolicyFromEnv(denoEnv, ['web'], { methods: ['POST'] }),
  verify: (req) => {
    authClient ??= createAuthClient(denoEnv);
    return verifyRequest(
      req,
      { env: denoEnv, verifier: verifierFromClient(authClient) },
      { requireLiveSession: true },
    );
  },
  generateMagicLink,
  perUser: createRateLimiter({ limit: 5, windowMs: 60_000 }),
  global: createRateLimiter({ limit: 600, windowMs: 60_000 }),
  now: () => Date.now(),
});

Deno.serve(handler);
