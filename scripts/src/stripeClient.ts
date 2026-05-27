// Mirror of `artifacts/api-server/src/lib/stripeClient.ts` for the
// `@workspace/scripts` package. Same portability contract: env var first,
// Replit connector second. Kept as a separate file (rather than imported)
// because scripts cannot reach into the api-server's TS path-mapping
// without dragging the whole bundle config along.
import Stripe from "stripe";

const STRIPE_API_VERSION = "2026-04-22.dahlia" as const;

async function fetchReplitStripeSecret(): Promise<string> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;
  if (!hostname || !xReplitToken) {
    throw new Error(
      "STRIPE_SECRET_KEY env var is not set and Replit connector env (REPLIT_CONNECTORS_HOSTNAME / REPL_IDENTITY) is also missing. Set STRIPE_SECRET_KEY or run inside a Replit workspace with the Stripe integration connected.",
    );
  }
  const resp = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
    {
      headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!resp.ok) throw new Error(`Replit connectors broker returned ${resp.status}`);
  const data = (await resp.json()) as { items?: { settings?: { secret_key?: string } }[] };
  const secret = data.items?.[0]?.settings?.secret_key;
  if (!secret) throw new Error("Stripe integration is not connected (no secret_key returned).");
  return secret;
}

export async function getStripe(): Promise<Stripe> {
  const envKey = process.env.STRIPE_SECRET_KEY;
  const secretKey = envKey ?? (await fetchReplitStripeSecret());
  return new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
}
