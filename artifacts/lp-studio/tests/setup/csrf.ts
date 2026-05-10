// CSRF helpers for Playwright tests.
//
// Background: the api-server uses csrf-csrf double-submit protection. State-
// changing requests (POST/PUT/PATCH/DELETE) that carry an `lp_sid` cookie
// must also carry the `lp_csrf` cookie *and* a matching `X-CSRF-Token` header.
// Webhooks, login endpoints, GET/HEAD/OPTIONS, and requests without `lp_sid`
// are exempt (see api-server/src/lib/csrf.ts).
//
// Tests that previously sent `Cookie: lp_sid=...` directly need to also fetch
// a CSRF token and forward both cookies + the header. These helpers do that.

import {
  request as playwrightRequest,
  type APIRequestContext,
} from "@playwright/test";

export type CsrfHeaders = { Cookie: string; "X-CSRF-Token": string };

/**
 * Fetch a CSRF token for the given `lp_sid` session and return headers ready
 * to merge into a state-changing request. The returned `Cookie` field includes
 * BOTH `lp_sid` and `lp_csrf` because Playwright's per-request `headers.Cookie`
 * fully overrides the context cookie jar (set-cookie from /api/auth/csrf would
 * otherwise be ignored on the next call).
 */
export async function getCsrfHeaders(
  request: APIRequestContext,
  sid: string,
  csrfUrl = "/api/auth/csrf",
): Promise<CsrfHeaders> {
  const res = await request.get(csrfUrl, {
    headers: { Cookie: `lp_sid=${sid}` },
  });
  if (!res.ok()) {
    throw new Error(
      `CSRF token fetch failed (${res.status()}): ${await res.text()}`,
    );
  }
  const setCookie = res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value)
    .join("\n");
  const m = /lp_csrf=([^;]+)/.exec(setCookie);
  if (!m) {
    throw new Error(`No lp_csrf cookie in /api/auth/csrf response: ${setCookie}`);
  }
  const { csrfToken } = (await res.json()) as { csrfToken: string };
  return {
    Cookie: `lp_sid=${sid}; lp_csrf=${m[1]}`,
    "X-CSRF-Token": csrfToken,
  };
}

// Per-(request, sid) cache so a single test that makes many state-changing
// calls doesn't re-fetch /api/auth/csrf on every one. The cache is keyed on
// the APIRequestContext instance, so it is naturally scoped to a single test
// (or test file's beforeAll fixture) and gets garbage-collected with it.
const csrfCache = new WeakMap<APIRequestContext, Map<string, CsrfHeaders>>();

/**
 * Like {@link getCsrfHeaders} but caches the result per `request` fixture so
 * repeated calls within the same test don't re-fetch the token.
 */
export async function csrfHeaders(
  request: APIRequestContext,
  sid: string,
  csrfUrl = "/api/auth/csrf",
): Promise<CsrfHeaders> {
  let bySid = csrfCache.get(request);
  if (!bySid) {
    bySid = new Map();
    csrfCache.set(request, bySid);
  }
  const cached = bySid.get(sid);
  if (cached) return cached;
  const fresh = await getCsrfHeaders(request, sid, csrfUrl);
  bySid.set(sid, fresh);
  return fresh;
}

export interface NewAuthedContextOptions {
  /** baseURL for the new context. May or may not end in `/api/`. */
  baseURL: string;
  /** lp_sid session cookie value to authenticate as. */
  sid: string;
  /** Extra headers to merge (e.g. X-Tenant-Id). */
  extraHeaders?: Record<string, string>;
}

/**
 * Create an APIRequestContext that is pre-authenticated with `lp_sid` AND
 * pre-loaded with the matching `lp_csrf` cookie + `X-CSRF-Token` header so
 * every state-changing request through it satisfies CSRF protection.
 *
 * Use this in place of `playwrightRequest.newContext({ baseURL,
 * extraHTTPHeaders: { Cookie: 'lp_sid=...' } })` whenever the caller will
 * make POST/PUT/PATCH/DELETE requests against the api-server.
 */
export async function newAuthedContext(
  opts: NewAuthedContextOptions,
): Promise<APIRequestContext> {
  const csrfPath = opts.baseURL.endsWith("/api/")
    ? "auth/csrf"
    : "/api/auth/csrf";
  // Use a temp context just for the GET /auth/csrf so we can capture set-cookie
  // without having to inspect the long-lived context's jar.
  const tmp = await playwrightRequest.newContext({ baseURL: opts.baseURL });
  try {
    const headers = await getCsrfHeaders(tmp, opts.sid, csrfPath);
    return await playwrightRequest.newContext({
      baseURL: opts.baseURL,
      extraHTTPHeaders: {
        ...headers,
        ...(opts.extraHeaders ?? {}),
      },
    });
  } finally {
    await tmp.dispose();
  }
}
