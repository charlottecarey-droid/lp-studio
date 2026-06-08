import crypto from "crypto";

// HMAC-signed OAuth `state` shared by every Salesforce connect entry point
// (the sales console at /api/sales/sfdc/* and the marketing Integrations page
// at /api/lp/integrations/salesforce/*). Both flows redirect to the SAME
// callback (/api/sales/sfdc/callback), so the signing/verification logic must
// live in one place or the two callers would drift.
//
// Without signing, `state` was a plain base64 JSON `{ tenantId }` and the
// callback trusted whatever tenantId the caller put in it — letting a logged-in
// user link their own Salesforce org to a different tenant by tampering with the
// state value. The signing key is the same WORKER_HOST_SECRET used by the
// Cloudflare tenant-host worker; it always exists in this environment. We fall
// back to a per-process key only as a last resort so dev without secrets still
// runs — but a dev secret never matches a prod-signed state, so signatures don't
// survive a restart, which is fine for short-lived OAuth flows.

const SFDC_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

let __sfdcStateDevSecret: string | null = null;
function sfdcStateKey(): string {
  const k = process.env.WORKER_HOST_SECRET;
  if (k && k.length > 0) return k;
  if (!__sfdcStateDevSecret) __sfdcStateDevSecret = crypto.randomBytes(32).toString("hex");
  return __sfdcStateDevSecret;
}

/**
 * Sanitize a caller-supplied post-OAuth return path. Only same-origin relative
 * paths are allowed (must start with a single "/", never "//" or a scheme) so a
 * forged state cannot turn the callback into an open redirect.
 */
function sanitizeReturnTo(returnTo: string | undefined): string | undefined {
  if (!returnTo || typeof returnTo !== "string") return undefined;
  if (!returnTo.startsWith("/")) return undefined;
  if (returnTo.startsWith("//")) return undefined;
  if (returnTo.includes("\\")) return undefined;
  return returnTo;
}

export interface SfdcState {
  tenantId: number;
  /**
   * Optional relative path the callback should redirect the browser back to
   * after completing the OAuth exchange. When absent, the callback returns its
   * legacy JSON body (the sales-console flow relies on this). The marketing
   * Integrations flow sets it so the user lands back on the Integrations page.
   */
  returnTo?: string;
}

export function signSfdcState(tenantId: number, returnTo?: string): string {
  const payload: { tenantId: number; ts: number; returnTo?: string } = {
    tenantId,
    ts: Date.now(),
  };
  const safe = sanitizeReturnTo(returnTo);
  if (safe) payload.returnTo = safe;
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", sfdcStateKey()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySfdcState(state: string): SfdcState | null {
  const dot = state.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = crypto.createHmac("sha256", sfdcStateKey()).update(body).digest("base64url");
  // Constant-time compare; lengths must match for timingSafeEqual.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload: { tenantId?: unknown; ts?: unknown; returnTo?: unknown };
  try { payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { return null; }
  const tenantId = typeof payload.tenantId === "number" ? payload.tenantId : null;
  const ts = typeof payload.ts === "number" ? payload.ts : null;
  if (tenantId == null || ts == null) return null;
  if (Date.now() - ts > SFDC_STATE_TTL_MS) return null;
  const returnTo = sanitizeReturnTo(typeof payload.returnTo === "string" ? payload.returnTo : undefined);
  return returnTo ? { tenantId, returnTo } : { tenantId };
}
