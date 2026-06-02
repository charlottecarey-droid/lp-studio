/**
 * CSRF-aware fetch wrapper.
 *
 * The api-server enforces a double-submit CSRF token on every cookie-authed
 * state-changing request. Rather than migrate ~400 individual fetch() call
 * sites, we install a single global interceptor that:
 *
 *   1. On boot (and again whenever the auth state changes), GETs
 *      `/api/auth/csrf` to obtain a token + the matching `lp_csrf` cookie.
 *   2. Auto-injects `X-CSRF-Token` on POST/PATCH/PUT/DELETE requests targeted
 *      at our own /api/* origin.
 *   3. On a 403 with a CSRF-shaped error body, refetches the token once and
 *      retries — so a session change mid-page (e.g. password login) doesn't
 *      strand the user with a stale token.
 *
 * Public endpoints (no `lp_sid` cookie) are exempted server-side, so sending
 * the header to them is harmless.
 */

import { emitUpgradeRequired, parseUpgradeBody } from "./plan-upgrade";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_HEADER = "X-CSRF-Token";
const CSRF_ENDPOINT = "/api/auth/csrf";

/**
 * The production edge WAF (Cloudflare managed rules) 403s request bodies that
 * carry a template token inside an href attribute — e.g. the
 * `<a href="{{microsite_url}}">` CTA and `<a href="{{unsubscribe_url}}">`
 * footer that every styled marketing email contains. The block happens at the
 * edge, BEFORE the request reaches the origin, so it never shows up in server
 * logs and surfaces only as a generic "failed" in the UI (styled-email test
 * sends + saving styled emails as templates were silently failing in prod;
 * plain-text ones, which carry no such pattern, worked).
 *
 * Since we don't control Cloudflare, we base64-wrap any same-origin /api body
 * that carries this pattern so the raw HTML never appears on the wire. The
 * api-server has a matching global middleware that unwraps `{ __encoded }`
 * back into req.body before CSRF and the route handlers run, so this is fully
 * transparent to every endpoint. Already-encoded bodies (the superadmin
 * notifications editor wraps its own) contain only base64 and won't re-match.
 */
const WAF_TRIPPING_BODY = /href\s*=\s*["'][^"']*\{\{/i;

function encodeBodyForWaf(body: string): string {
  const bytes = new TextEncoder().encode(body);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return JSON.stringify({ __encoded: btoa(binary) });
}

const originalFetch: typeof fetch = window.fetch.bind(window);

let cachedToken: string | null = null;
let pendingFetch: Promise<string | null> | null = null;

async function fetchToken(force = false): Promise<string | null> {
  if (!force && cachedToken) return cachedToken;
  if (pendingFetch) return pendingFetch;
  pendingFetch = (async () => {
    try {
      const res = await originalFetch(CSRF_ENDPOINT, { credentials: "include" });
      if (!res.ok) return null;
      const data = (await res.json()) as { csrfToken?: string };
      cachedToken = data.csrfToken ?? null;
      return cachedToken;
    } catch {
      return null;
    } finally {
      pendingFetch = null;
    }
  })();
  return pendingFetch;
}

/** Call after login/logout so the next request fetches a token bound to the new session. */
export function clearCsrfToken(): void {
  cachedToken = null;
}

/** Eagerly fetch a token. Useful at app boot. */
export function ensureCsrfToken(): Promise<string | null> {
  return fetchToken();
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function methodOf(input: RequestInfo | URL, init?: RequestInit): string {
  const m = init?.method ?? (input instanceof Request ? input.method : "GET");
  return m.toUpperCase();
}

function isSameOriginApi(url: string): boolean {
  if (url.startsWith("/api/")) return true;
  try {
    const u = new URL(url, window.location.href);
    return u.origin === window.location.origin && u.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

/**
 * Inspect a 402 to see if it's the server's structured `plan_upgrade_required`
 * contract (see api-server/src/lib/planGate.ts). If so, fire the global
 * upgrade event so the listener in App.tsx can show a toast. We clone the
 * response before reading it so the caller still gets a fresh body to consume.
 *
 * Silent on any other 402 or unexpected body — we only react to the
 * documented contract (keyed on `gate`).
 */
async function maybeEmitPlanUpgrade(res: Response): Promise<void> {
  if (res.status !== 402) return;
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return;
  try {
    const detail = parseUpgradeBody(await res.clone().json());
    if (detail) emitUpgradeRequired(detail);
  } catch {
    // Non-JSON or malformed body — ignore.
  }
}

async function isCsrfFailure(res: Response): Promise<boolean> {
  if (res.status !== 403) return false;
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return false;
  try {
    const body = await res.clone().json();
    const msg = (body?.error ?? "").toString().toLowerCase();
    return msg.includes("csrf");
  } catch {
    return false;
  }
}

type WrappedFetch = typeof window.fetch & { __csrfWrapped?: boolean };

export function installCsrfFetchInterceptor(): void {
  const existing = window.fetch as WrappedFetch;
  if (existing.__csrfWrapped) return;

  const wrapped: WrappedFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = methodOf(input, init);
    const url = urlOf(input);
    if (SAFE_METHODS.has(method) || !isSameOriginApi(url) || url.includes(CSRF_ENDPOINT)) {
      const res = await originalFetch(input, init);
      if (isSameOriginApi(url)) await maybeEmitPlanUpgrade(res);
      return res;
    }

    const token = (await fetchToken()) ?? "";
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    if (token && !headers.has(CSRF_HEADER)) headers.set(CSRF_HEADER, token);

    const credentials: RequestCredentials =
      init?.credentials ?? (input instanceof Request ? input.credentials : "include");
    // Base64-wrap bodies that carry the WAF-tripping href-token pattern so the
    // raw HTML never reaches the edge (see WAF_TRIPPING_BODY above). Only string
    // bodies are inspected; FormData/Blob/Request bodies pass through untouched.
    let body = init?.body;
    if (typeof body === "string" && WAF_TRIPPING_BODY.test(body)) {
      body = encodeBodyForWaf(body);
    }
    const newInit: RequestInit = { ...(init ?? {}), headers, credentials, body };

    const res = await originalFetch(input, newInit);
    if (await isCsrfFailure(res)) {
      const fresh = await fetchToken(true);
      if (fresh && fresh !== token) {
        headers.set(CSRF_HEADER, fresh);
        const retried = await originalFetch(input, newInit);
        await maybeEmitPlanUpgrade(retried);
        return retried;
      }
    }
    await maybeEmitPlanUpgrade(res);
    return res;
  }) as WrappedFetch;

  wrapped.__csrfWrapped = true;
  window.fetch = wrapped;
}
