/**
 * Auto "style from URL" on reference-URL generations (brand-fidelity step 5,
 * July 2026).
 *
 * When a generation request carries a per-request reference URL, run the
 * brand-import orchestrator on it CONCURRENTLY with generation and hand back
 * the same whitelisted visual tokens the builder's explicit "Match style from
 * URL" action would persist (lp_pages.style_overrides). The orchestrator's
 * 24h shared URL cache makes the typical flow (brand import at signup, then
 * generate from the same URL) near-instant.
 *
 * Fail-open by contract: style is an enhancement, never a blocker. The
 * returned promise NEVER rejects — any failure (flag off, no key, unsafe
 * host, orchestrator error, empty override set, timeout) resolves null and
 * generation proceeds unstyled.
 */
import { runOrchestrator } from "./brand-import";
import { isSafePublicHost } from "./brand-import/net-guard";
import type { OrchestratorPayload, StreamEvent } from "./brand-import/types";
import { pickPageStyleOverrides } from "./page-style-overrides";
import { logger } from "./logger";

export interface AutoStyleResult {
  styleOverrides: Record<string, unknown>;
  sourceUrl: string;
}

export interface AutoStyleOptions {
  /** Per-request reference URLs from the generation body; only the FIRST is
   *  styled from. */
  referenceUrls: string[];
  /** FIRECRAWL_API_KEY — absent means the scrape pipeline is unavailable. */
  apiKey: string | undefined;
  /** Injectable for tests — defaults to the real brand-import orchestrator. */
  orchestrator?: (url: string, apiKey: string) => AsyncGenerator<StreamEvent, void, undefined>;
  /** Injectable for tests — defaults to the real SSRF guard. */
  checkHost?: (hostname: string) => Promise<boolean>;
  /** Outer safety net around the orchestrator run. The orchestrator's internal
   *  budgets bound it to ~92s worst case; this catches hangs beyond that. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 100_000;

/** Kill switch — default ON; set AUTO_STYLE_FROM_REFERENCE=0 (or "false") to
 *  disable auto-styling without a deploy-level revert. */
function autoStyleEnabled(): boolean {
  const v = (process.env.AUTO_STYLE_FROM_REFERENCE ?? "").trim().toLowerCase();
  return v !== "0" && v !== "false";
}

/** Kick off style extraction for the first reference URL. Resolves the
 *  filtered override payload, or null on ANY failure — never rejects. Callers
 *  start this alongside generation and race it against a short grace window
 *  at result time; a run that loses the race still warms the orchestrator's
 *  URL cache for the builder's manual action. */
export function startAutoStyleFromReference(opts: AutoStyleOptions): Promise<AutoStyleResult | null> {
  return runAutoStyle(opts).catch((err) => {
    logger.warn({ err: String(err) }, "[auto-style] unexpected failure (fail-open)");
    return null;
  });
}

async function runAutoStyle(opts: AutoStyleOptions): Promise<AutoStyleResult | null> {
  if (!autoStyleEnabled()) return null;
  const rawUrl = (opts.referenceUrls[0] ?? "").trim();
  if (!rawUrl) return null;
  if (!opts.apiKey) return null;

  let parsed: URL;
  try {
    // Prepend https:// only when the URL carries no scheme of its own —
    // blindly prepending would smuggle e.g. "ftp://x" through as a valid
    // https URL with hostname "ftp".
    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(rawUrl);
    parsed = new URL(hasScheme ? rawUrl : `https://${rawUrl}`);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  const checkHost = opts.checkHost ?? isSafePublicHost;
  if (!(await checkHost(parsed.hostname))) return null;

  const orchestrator = opts.orchestrator
    ?? ((url: string, apiKey: string) => runOrchestrator(url, apiKey, {}));

  // No forceRefresh and no tenantId — same cache-anchoring semantics as the
  // manual route: style tokens need no asset mirroring, and the shared cache
  // row stays anchored to external URLs.
  const run = async (): Promise<AutoStyleResult | null> => {
    let payload: OrchestratorPayload | null = null;
    for await (const event of orchestrator(parsed.toString(), opts.apiKey as string)) {
      if (event.event === "done") payload = event.payload;
      if (event.event === "error") {
        logger.info({ url: parsed.toString(), error: event.error }, "[auto-style] orchestrator error (fail-open)");
        return null;
      }
    }
    if (!payload) return null;
    const styleOverrides = pickPageStyleOverrides(payload.proposed);
    if (Object.keys(styleOverrides).length === 0) return null;
    return { styleOverrides, sourceUrl: payload.sourceUrl };
  };

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      run(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
