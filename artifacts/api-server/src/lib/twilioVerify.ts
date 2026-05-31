import { logger } from "./logger";

// Twilio Verify (SMS one-time codes) + Lookup (line-type intelligence) wrapper
// backing the trial phone gate (Task #637).
//
// Gating philosophy mirrors `turnstile.ts`: when the three Twilio secrets are
// absent the feature is considered disabled — `twilioConfigured()` returns
// false and the signup path skips the phone requirement so dev / e2e / pre-
// provisioning keep working. The endpoints, however, fail SAFE: they surface a
// clear setup error rather than ever pretending a number was verified.

const VERIFY_BASE = "https://verify.twilio.com/v2";
const LOOKUP_BASE = "https://lookups.twilio.com/v2";

// Twilio Lookup line-type-intelligence values we treat as virtual / not a real
// mobile and therefore reject. Google Voice and similar resolve to
// `nonFixedVoip`. Voicemail/toll-free/premium can't be a personal mobile a
// trial should be tied to. `mobile` (and unknown/landline, which simply fail to
// receive an SMS) are allowed through to the Verify send.
const VOIP_LINE_TYPES = new Set([
  "voip",
  "nonFixedVoip",
  "fixedVoip",
  "tollFree",
  "premium",
  "sharedCost",
  "voicemail",
]);

/**
 * True when Twilio Verify is fully configured (account SID, auth token, and a
 * Verify Service SID are all present). When false the trial phone gate is
 * skipped at signup and the phone endpoints return a clear 503 setup error.
 */
export function twilioConfigured(): boolean {
  return !!(
    process.env["TWILIO_ACCOUNT_SID"] &&
    process.env["TWILIO_AUTH_TOKEN"] &&
    process.env["TWILIO_VERIFY_SERVICE_SID"]
  );
}

function authHeader(): string {
  const sid = process.env["TWILIO_ACCOUNT_SID"] ?? "";
  const token = process.env["TWILIO_AUTH_TOKEN"] ?? "";
  return "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
}

/** True for a Twilio Lookup line type we reject as virtual / non-mobile. */
export function isVoipLineType(lineType: string | null): boolean {
  return !!lineType && VOIP_LINE_TYPES.has(lineType);
}

export interface LookupResult {
  // Whether Twilio considers the number a valid, dialable phone number.
  valid: boolean;
  // Canonical E.164 form returned by Twilio (source of truth for hashing /
  // sending), or null when the lookup failed or the number was invalid.
  phoneNumber: string | null;
  // line_type_intelligence.type, e.g. "mobile" | "landline" | "nonFixedVoip".
  lineType: string | null;
}

/**
 * Look up a phone number via Twilio Lookup v2 with line-type intelligence.
 * Returns the canonical E.164 form and the carrier line type so the caller can
 * reject VOIP/virtual numbers before spending an SMS. Fails CLOSED: a network
 * error or non-2xx resolves to `{ valid: false }` so an unverifiable number is
 * never waved through.
 */
export async function lookupLineType(rawPhone: string): Promise<LookupResult> {
  try {
    const url = `${LOOKUP_BASE}/PhoneNumbers/${encodeURIComponent(
      rawPhone,
    )}?Fields=line_type_intelligence`;
    const res = await fetch(url, { headers: { Authorization: authHeader() } });
    if (res.status === 404) {
      // Twilio returns 404 for a number it can't resolve at all.
      return { valid: false, phoneNumber: null, lineType: null };
    }
    if (!res.ok) {
      logger.error({ status: res.status }, "Twilio Lookup request failed");
      return { valid: false, phoneNumber: null, lineType: null };
    }
    const data = (await res.json().catch(() => ({}))) as {
      valid?: boolean;
      phone_number?: string;
      line_type_intelligence?: { type?: string | null } | null;
    };
    return {
      valid: !!data.valid,
      phoneNumber: typeof data.phone_number === "string" ? data.phone_number : null,
      lineType: data.line_type_intelligence?.type ?? null,
    };
  } catch (err) {
    logger.error({ err }, "Twilio Lookup request threw");
    return { valid: false, phoneNumber: null, lineType: null };
  }
}

/**
 * Start an SMS verification — Twilio sends a one-time code to the number.
 * Returns `{ ok }`; fails CLOSED on any error so the caller surfaces a retry
 * message instead of advancing to the code step for an undelivered code.
 */
export async function sendVerificationCode(phoneE164: string): Promise<{ ok: boolean }> {
  const serviceSid = process.env["TWILIO_VERIFY_SERVICE_SID"] ?? "";
  try {
    const body = new URLSearchParams({ To: phoneE164, Channel: "sms" });
    const res = await fetch(`${VERIFY_BASE}/Services/${serviceSid}/Verifications`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) {
      logger.error({ status: res.status }, "Twilio Verify send failed");
      return { ok: false };
    }
    const data = (await res.json().catch(() => ({}))) as { status?: string };
    return { ok: data.status === "pending" || data.status === "approved" };
  } catch (err) {
    logger.error({ err }, "Twilio Verify send threw");
    return { ok: false };
  }
}

/**
 * Check a user-entered code against an in-flight verification. Returns
 * `{ approved }`; fails CLOSED so an error never reads as a passing check.
 */
export async function checkVerificationCode(
  phoneE164: string,
  code: string,
): Promise<{ approved: boolean }> {
  const serviceSid = process.env["TWILIO_VERIFY_SERVICE_SID"] ?? "";
  try {
    const body = new URLSearchParams({ To: phoneE164, Code: code });
    const res = await fetch(`${VERIFY_BASE}/Services/${serviceSid}/VerificationCheck`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) {
      // 404 here means no pending verification for that number — treat as a
      // failed check (expired / never started), not a server error.
      return { approved: false };
    }
    const data = (await res.json().catch(() => ({}))) as { status?: string };
    return { approved: data.status === "approved" };
  } catch (err) {
    logger.error({ err }, "Twilio Verify check threw");
    return { approved: false };
  }
}
