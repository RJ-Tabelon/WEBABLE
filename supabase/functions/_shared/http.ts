// HTTP helpers shared by WebAble Edge Functions.
//
// Every response is JSON, never cached, and carries a stable machine-readable
// error code. Messages are for developers; user-facing copy lives in the apps.

export type ErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'forbidden_origin'
  | 'not_found'
  | 'method_not_allowed'
  | 'payload_too_large'
  | 'unsupported_media_type'
  | 'rate_limited'
  | 'misconfigured'
  | 'unavailable'
  | 'internal';

export interface ErrorBody {
  error: { code: ErrorCode | (string & {}); message: string };
}

/** Headers every function response carries. */
export const BASE_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
});

/** A failure that maps directly to an HTTP response. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode | (string & {});
  readonly headers: Record<string, string>;

  constructor(
    status: number,
    code: ErrorCode | (string & {}),
    message: string,
    headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

function mergeHeaders(...sources: Array<HeadersInit | undefined>): Headers {
  const headers = new Headers(BASE_HEADERS);
  for (const source of sources) {
    if (!source) continue;
    new Headers(source).forEach((value, key) => headers.set(key, value));
  }
  return headers;
}

/** A JSON response with the base headers. */
export function json(
  body: unknown,
  init: { status?: number; headers?: HeadersInit } = {},
): Response {
  const headers = mergeHeaders(init.headers, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers,
  });
}

/** An empty response (204 preflights, 405s) with the base headers. */
export function empty(status: number, headers?: HeadersInit): Response {
  return new Response(null, { status, headers: mergeHeaders(headers) });
}

/** A JSON error body: `{ error: { code, message } }`. */
export function errorResponse(
  status: number,
  code: ErrorCode | (string & {}),
  message: string,
  headers?: HeadersInit,
): Response {
  const body: ErrorBody = { error: { code, message } };
  return json(body, { status, headers });
}

export function fromHttpError(
  error: HttpError,
  headers?: HeadersInit,
): Response {
  return errorResponse(
    error.status,
    error.code,
    error.message,
    mergeHeaders(headers, error.headers),
  );
}

/**
 * Read a JSON body without trusting Content-Length: the stream is counted and
 * cut off at `maxBytes`. An empty body yields `undefined`.
 */
export async function readJsonBody(
  req: Request,
  opts: { maxBytes: number },
): Promise<unknown> {
  const declared = req.headers.get('content-length');
  if (declared !== null) {
    const length = Number(declared);
    if (!Number.isFinite(length) || length < 0) {
      throw new HttpError(400, 'bad_request', 'Invalid Content-Length.');
    }
    if (length > opts.maxBytes) {
      throw new HttpError(
        413,
        'payload_too_large',
        `Body exceeds ${opts.maxBytes} bytes.`,
      );
    }
  }
  if (!req.body) return undefined;

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > opts.maxBytes) {
      await reader.cancel().catch(() => {});
      throw new HttpError(
        413,
        'payload_too_large',
        `Body exceeds ${opts.maxBytes} bytes.`,
      );
    }
    chunks.push(value);
  }
  if (total === 0) return undefined;

  const contentType = req.headers.get('content-type') ?? '';
  if (!/^application\/json\b/i.test(contentType.trim())) {
    throw new HttpError(
      415,
      'unsupported_media_type',
      'Send the body as application/json.',
    );
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new HttpError(400, 'bad_request', 'Body is not valid JSON.');
  }
}

/** Structured, low-cardinality logs. Never pass tokens, emails or request bodies. */
export function logEvent(
  event: string,
  fields: Record<string, string | number | boolean | null> = {},
): void {
  console.log(JSON.stringify({ event, ...fields }));
}
