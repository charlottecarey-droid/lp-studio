import { logger } from "./logger";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * True when Cloudflare Turnstile is configured (a server secret is present).
 * When false, all challenge checks are skipped gracefully so the auth flows
 * keep working in dev / before keys are provisioned.
 */
export function turnstileConfigured(): boolean {
  return !!process.env["TURNSTILE_SECRET_KEY"];
}

/**
 * Verify a Turnstile token against Cloudflare's siteverify endpoint.
 *
 * Gating: when `TURNSTILE_SECRET_KEY` is absent the challenge is considered
 * disabled and this resolves `{ ok: true, configured: false }` — callers
 * therefore proceed normally. When configured, a missing/invalid token fails.
 */
export async function verifyTurnstile(
  token: unknown,
  remoteIp?: string,
): Promise<{ ok: boolean; configured: boolean }> {
  const secret = process.env["TURNSTILE_SECRET_KEY"];
  if (!secret) return { ok: true, configured: false };
  if (typeof token !== "string" || token.length === 0) return { ok: false, configured: true };
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json().catch(() => ({}))) as { success?: boolean };
    return { ok: !!data.success, configured: true };
  } catch (err) {
    logger.error({ err }, "Turnstile siteverify request failed");
    // Fail closed when the challenge is enabled — better to ask the user to
    // retry than to wave through a request whose challenge we couldn't verify.
    return { ok: false, configured: true };
  }
}
