import {
  JEV_ENDPOINT,
  JEV_REQUEST_ID_HEADER,
  type JevFailure,
  type JevModelId,
  type JevQuestion,
  type JevResponse,
  type JevResult,
  type JevState,
} from './api';

export interface CallJevOptions {
  apiKey: string;
  /** Hard timeout covering connect, server time and body read. */
  timeoutMs: number;
  /** The model id the thresholds were calibrated on; any other resolved model is drift. */
  pinnedModel: string;
  /** Caller cancellation (e.g. a quota denial). Reported as `network`: the request did not complete. */
  signal?: AbortSignal;
  /** Override the endpoint (a local mock server). Default: JEV_ENDPOINT. */
  endpoint?: string;
  /** Inject a fetch implementation (tests, the mock). Default: globalThis.fetch. */
  fetch?: typeof fetch;
}

const now = (): number =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

/** Combine signals; uses AbortSignal.any where available (Deno, Node >= 20.3). */
function anySignal(signals: readonly AbortSignal[]): AbortSignal {
  const withAny = AbortSignal as typeof AbortSignal & {
    any?: (s: AbortSignal[]) => AbortSignal;
  };
  if (typeof withAny.any === 'function') return withAny.any([...signals]);
  const controller = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      controller.abort(s.reason);
      break;
    }
    s.addEventListener('abort', () => controller.abort(s.reason), {
      once: true,
    });
  }
  return controller.signal;
}

function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(
    () =>
      controller.abort(
        new DOMException('The operation timed out.', 'TimeoutError'),
      ),
    ms,
  );
  return controller.signal;
}

/** Parse `retry-after-ms`, then `retry-after` (seconds or an HTTP date). */
export function parseRetryAfter(
  headers: Headers,
  nowMs: number = Date.now(),
): number | undefined {
  const ms = Number(headers.get('retry-after-ms'));
  if (headers.get('retry-after-ms') !== null && Number.isFinite(ms) && ms >= 0)
    return Math.round(ms);
  const raw = headers.get('retry-after');
  if (raw === null || raw.trim() === '') return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0)
    return Math.round(seconds * 1000);
  const date = Date.parse(raw);
  if (Number.isFinite(date)) return Math.max(0, Math.round(date - nowMs));
  return undefined;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const in01 = (x: unknown): boolean =>
  typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1;

function distribution(value: unknown, keys: readonly string[]): boolean {
  if (!isRecord(value) || Object.keys(value).length !== keys.length)
    return false;
  if (!keys.every((k) => in01(value[k]))) return false;
  // Permit rounding in the provider's serialized probabilities.
  return (
    Math.abs(keys.reduce((sum, k) => sum + (value[k] as number), 0) - 1) <= 0.02
  );
}

/**
 * Runtime shape check: the envelope, every asked id answered with the same
 * type, choices within the option set, probabilities in [0, 1], score levels in
 * range. Returns an issue code, or null when the body is a valid JevResponse.
 */
export function checkJevShape(
  questions: Record<string, JevQuestion>,
  body: unknown,
): string | null {
  if (
    !isRecord(body) ||
    typeof body.model !== 'string' ||
    !isRecord(body.answers) ||
    !isRecord(body.usage)
  ) {
    return 'envelope';
  }
  const usage = body.usage;
  if (
    !Number.isSafeInteger(usage.input_tokens) ||
    (usage.input_tokens as number) < 0 ||
    !Number.isSafeInteger(usage.output_tokens) ||
    (usage.output_tokens as number) < 0
  )
    return 'usage';
  const answers = body.answers;
  for (const [id, q] of Object.entries(questions)) {
    const a = answers[id];
    if (!isRecord(a) || a.type !== q.type) return `missing_or_type:${id}`;
    if (q.type === 'noul') {
      if (!in01(a.noul)) return `noul:${id}`;
    } else if (q.type === 'choice') {
      const options = Object.keys(q.criteria);
      if (typeof a.choice !== 'string' || !options.includes(a.choice))
        return `choice:${id}`;
      if (!distribution(a.probabilities, options)) return `probs:${id}`;
      if (!in01(a.confidence)) return `confidence:${id}`;
    } else {
      const n = q.criteria.length;
      const levels = Array.from({ length: n }, (_, i) => String(i));
      if (
        !distribution(a.probabilities, levels) ||
        typeof a.score !== 'number' ||
        !Number.isFinite(a.score) ||
        a.score < 0 ||
        a.score > n - 1 ||
        !in01(a.confidence)
      )
        return `levels:${id}`;
    }
  }
  return null;
}

/**
 * Raw-fetch Jev client (runs unchanged in Deno and Node). No retries: a retry
 * cannot land inside the page-view latency budget. Validates response shape and
 * that the resolved model equals the pinned model.
 *
 * Error taxonomy: timeout (our deadline), network (connection failure or caller
 * abort), rate_limited (429, with retryAfterMs), overloaded (529), auth (401/403),
 * invalid (400/422, our bug: never retry), server (anything else non-2xx),
 * shape (a 2xx body that is not the documented contract), model_drift.
 */
export async function callJev(
  req: {
    state: JevState;
    model: JevModelId;
    questions: Record<string, JevQuestion>;
  },
  opts: CallJevOptions,
): Promise<JevResult> {
  const t0 = now();
  const elapsed = () => Math.max(0, now() - t0);
  const doFetch =
    opts.fetch ?? (typeof fetch === 'function' ? fetch : undefined);

  if (!opts.apiKey) {
    // Never send a keyless request: the API would answer 403 after a round trip.
    return {
      ok: false,
      error: { kind: 'auth', status: 403 },
      requestId: null,
      ms: elapsed(),
    };
  }
  if (!doFetch)
    return {
      ok: false,
      error: { kind: 'network' },
      requestId: null,
      ms: elapsed(),
    };

  const deadline = timeoutSignal(Math.max(1, opts.timeoutMs));
  const signal = opts.signal ? anySignal([deadline, opts.signal]) : deadline;
  const failed = (error: JevFailure, requestId: string | null): JevResult => ({
    ok: false,
    error,
    requestId,
    ms: elapsed(),
  });
  const aborted = (): JevFailure | null =>
    deadline.aborted
      ? { kind: 'timeout' }
      : opts.signal?.aborted
        ? { kind: 'network' }
        : null;

  let res: Response;
  try {
    res = await doFetch(opts.endpoint ?? JEV_ENDPOINT, {
      method: 'POST',
      signal,
      headers: {
        authorization: `Bearer ${opts.apiKey}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      // Only the three documented fields; key order as built (canonical by construction).
      body: JSON.stringify({
        model: req.model,
        state: req.state,
        questions: req.questions,
      }),
    });
  } catch (e) {
    const name = e instanceof Error || e instanceof DOMException ? e.name : '';
    return failed(
      aborted() ??
        (name === 'TimeoutError' ? { kind: 'timeout' } : { kind: 'network' }),
      null,
    );
  }

  const requestId = res.headers.get(JEV_REQUEST_ID_HEADER);

  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    switch (res.status) {
      case 429: {
        const retryAfterMs = parseRetryAfter(res.headers);
        return failed(
          retryAfterMs === undefined
            ? { kind: 'rate_limited' }
            : { kind: 'rate_limited', retryAfterMs },
          requestId,
        );
      }
      case 529:
        return failed({ kind: 'overloaded' }, requestId);
      case 401:
      case 403:
        return failed({ kind: 'auth', status: res.status }, requestId);
      case 400:
      case 422:
        return failed({ kind: 'invalid', status: res.status, body }, requestId);
      default:
        return failed({ kind: 'server', status: res.status }, requestId);
    }
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return failed(aborted() ?? { kind: 'shape', issue: 'json' }, requestId);
  }

  const issue = checkJevShape(req.questions, body);
  if (issue) return failed({ kind: 'shape', issue }, requestId);
  const data = body as JevResponse;
  if (data.model !== opts.pinnedModel)
    return failed({ kind: 'model_drift', got: data.model }, requestId);
  return { ok: true, data, requestId, ms: elapsed() };
}
