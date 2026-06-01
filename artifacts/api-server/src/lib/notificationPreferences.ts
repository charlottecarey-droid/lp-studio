import crypto from "crypto";
import { pool } from "@workspace/db";
import { logger } from "./logger";
import {
  PREFERENCE_GROUP_DEFS,
  groupIdForTemplateKey,
  groupOptOutKey,
} from "./notificationPreferenceGroups";

/**
 * Per-recipient email preference store + one-click unsubscribe token helpers
 * (Task #587).
 *
 * Suppression contract: ONLY `category = 'lifecycle'` templates are ever
 * suppressed. System / transactional emails (auth, billing) always send and
 * never consult this store — callers MUST gate on the template category before
 * calling `isOptedOut`.
 *
 * The unsubscribe token is a stateless, host-bound HMAC (not the single-use
 * auth_email_tokens infra): an unsubscribe link must stay clickable when a
 * recipient opens an old email weeks later, so single-use semantics are wrong
 * here. Host-binding is preserved by signing the host into the payload and
 * re-checking it on redeem, so a token minted for one workspace host cannot be
 * replayed against another.
 */

const TOKEN_TTL_SEC = 90 * 24 * 60 * 60; // 90 days — long-lived but bounded.

/**
 * Resolve the HMAC signing secret. NO guessable hardcoded fallback: a default
 * constant would let anyone offline-mint valid tokens for arbitrary
 * (tenant, user, host) and mass-unsubscribe via the public route. We require a
 * real secret and throw loudly if none is configured. RESEND_API_KEY is the
 * last resort because lifecycle emails (the only place tokens are minted) can't
 * be sent without it — so wherever a token exists, the secret exists too.
 */
function unsubSecret(): string {
  const secret =
    process.env["NOTIFICATION_PREFS_SECRET"] ??
    process.env["UNSUB_SECRET"] ??
    process.env["SESSION_SECRET"] ??
    process.env["RESEND_API_KEY"];
  if (!secret) {
    throw new Error(
      "[notificationPreferences] no signing secret configured — set NOTIFICATION_PREFS_SECRET",
    );
  }
  return secret;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", unsubSecret()).update(payload).digest("hex");
}

/** Lowercase hostname with port stripped — matches getRequestHost normalization. */
function normalizeHost(host: string): string {
  return host.split(",")[0]!.split(":")[0]!.trim().toLowerCase();
}

interface TokenPayload {
  u: number; // appUserId
  t: number; // tenantId
  h: string; // host
  e: number; // exp (unix seconds)
}

/**
 * Mint a stateless, host-bound, reusable unsubscribe token for a lifecycle
 * email's one-click footer link. Carries the (appUserId, tenantId, host) it was
 * minted for; `host` is the workspace host the email links back to.
 *
 * Encoding is base64url(JSON) + "." + hex-MAC. The JSON payload is base64url'd
 * (no "." in the alphabet) so dotted hostnames like `acme.lpstudio.ai` survive a
 * single split on the separator — a previous dot-delimited format broke on every
 * real domain.
 */
export function makeUnsubscribeToken(appUserId: number, tenantId: number, host: string): string {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC;
  const payload: TokenPayload = { u: appUserId, t: tenantId, h: normalizeHost(host), e: exp };
  const json = JSON.stringify(payload);
  const b = Buffer.from(json, "utf8").toString("base64url");
  return `${b}.${sign(json)}`;
}

export interface UnsubscribeTokenClaims {
  appUserId: number;
  tenantId: number;
}

/**
 * Verify an unsubscribe token against the host the redeem request arrived on.
 * Returns null for malformed / expired / wrong-host / tampered tokens. The MAC
 * is recomputed over the exact decoded JSON bytes, so there's no canonicalization
 * gap between mint and verify.
 */
export function verifyUnsubscribeToken(
  token: string,
  currentHost: string,
): UnsubscribeTokenClaims | null {
  try {
    const sep = token.indexOf(".");
    if (sep < 1 || sep === token.length - 1) return null;
    const b = token.slice(0, sep);
    const mac = token.slice(sep + 1);
    const json = Buffer.from(b, "base64url").toString("utf8");

    const expected = sign(json);
    const macBuf = Buffer.from(mac);
    const expBuf = Buffer.from(expected);
    if (macBuf.length !== expBuf.length || !crypto.timingSafeEqual(macBuf, expBuf)) return null;

    const payload = JSON.parse(json) as Partial<TokenPayload>;
    const { u: appUserId, t: tenantId, h: host, e: exp } = payload;
    if (
      !Number.isInteger(appUserId) ||
      !Number.isInteger(tenantId) ||
      !Number.isInteger(exp) ||
      typeof host !== "string"
    ) {
      return null;
    }
    if (Math.floor(Date.now() / 1000) > (exp as number)) return null;
    if (host !== normalizeHost(currentHost)) return null;
    return { appUserId: appUserId as number, tenantId: tenantId as number };
  } catch {
    return null;
  }
}

/**
 * Is this recipient opted OUT of (templateKey, channel)? True when EITHER a
 * per-template opt-out row exists (legacy / one-click) OR a group-level opt-out
 * row exists for the template's category. The group-level check is what makes a
 * category unsubscribe DURABLE — a template added to that category later inherits
 * the existing opt-out instead of silently delivering. Fails OPEN (returns
 * false = deliver) on any DB error: a preference-store hiccup must never block a
 * legitimate send. Callers gate on `category === 'lifecycle'` before calling.
 */
export async function isOptedOut(
  tenantId: number,
  appUserId: number,
  templateKey: string,
  channel: string,
): Promise<boolean> {
  const groupKey = groupOptOutKey(groupIdForTemplateKey(templateKey));
  try {
    const r = await pool.query(
      `SELECT 1 FROM notification_preferences
        WHERE tenant_id = $1 AND app_user_id = $2 AND channel = $3
          AND template_key IN ($4, $5)
        LIMIT 1`,
      [tenantId, appUserId, channel, templateKey, groupKey],
    );
    return r.rows.length > 0;
  } catch (err) {
    logger.error(
      { err, tenantId, appUserId, templateKey, channel },
      "[notificationPreferences] opt-out check failed — failing open (will send)",
    );
    return false;
  }
}

/** All (template_key, channel) opt-outs for one recipient, tenant-scoped. */
export async function getOptOuts(
  tenantId: number,
  appUserId: number,
): Promise<{ templateKey: string; channel: string }[]> {
  const r = await pool.query<{ template_key: string; channel: string }>(
    `SELECT template_key, channel FROM notification_preferences
      WHERE tenant_id = $1 AND app_user_id = $2`,
    [tenantId, appUserId],
  );
  return r.rows.map((row) => ({ templateKey: row.template_key, channel: row.channel }));
}

/** Subscribe (delete the opt-out row) or unsubscribe (insert it) for one pair. */
export async function setOptOut(
  tenantId: number,
  appUserId: number,
  templateKey: string,
  channel: string,
  optedOut: boolean,
): Promise<void> {
  if (optedOut) {
    await pool.query(
      `INSERT INTO notification_preferences (tenant_id, app_user_id, template_key, channel)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, app_user_id, template_key, channel) DO NOTHING`,
      [tenantId, appUserId, templateKey, channel],
    );
  } else {
    await pool.query(
      `DELETE FROM notification_preferences
        WHERE tenant_id = $1 AND app_user_id = $2 AND template_key = $3 AND channel = $4`,
      [tenantId, appUserId, templateKey, channel],
    );
  }
}

/**
 * One-click: opt the recipient OUT of every lifecycle EMAIL category. Writes one
 * durable group-level opt-out row per category (not per template), so it also
 * suppresses operator-created / DB-only lifecycle templates — which map to the
 * catch-all group — and any template added to a category later. Returns the
 * number of new opt-out rows written (0 if already fully unsubscribed).
 */
export async function unsubscribeAllLifecycleEmails(
  tenantId: number,
  appUserId: number,
): Promise<number> {
  const keys = PREFERENCE_GROUP_DEFS.map((g) => groupOptOutKey(g.id));
  if (!keys.length) return 0;
  const r = await pool.query(
    `INSERT INTO notification_preferences (tenant_id, app_user_id, template_key, channel)
     SELECT $1, $2, k, 'email' FROM unnest($3::text[]) AS k
     ON CONFLICT (tenant_id, app_user_id, template_key, channel) DO NOTHING`,
    [tenantId, appUserId, keys],
  );
  return r.rowCount ?? 0;
}
