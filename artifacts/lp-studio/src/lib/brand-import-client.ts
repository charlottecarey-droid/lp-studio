/**
 * Shared client for the streaming "import brand from a website URL" feature.
 *
 * The server endpoint (`POST /api/lp/brand-import/from-url-stream`) scrapes the
 * site, runs the AI extractors, and emits newline-delimited JSON events:
 *   - { event: "dimension", dimension, result: { status, data, errors } }
 *   - { event: "done", payload: { proposed, confidence, ... } }
 *   - { event: "error", error }
 *
 * This module owns the fetch + stream-parsing so both Brand Settings and the
 * new-tenant Onboarding wizard can consume it without duplicating the loop.
 */

export type BrandImportDimensionName =
  | "logos"
  | "colors"
  | "typography"
  | "buttons"
  | "photography"
  | "voice"
  | "content"
  | "structure";

export type BrandImportDimensionStatus =
  | "pending"
  | "loading"
  | "ok"
  | "partial"
  | "failed";

export interface BrandImportDimensionResult {
  status: BrandImportDimensionStatus;
  data: unknown;
  errors: string[];
}

export interface BrandImportLogoAlternate {
  url: string;
  source: string;
  format: string;
  score: number;
}

export interface BrandImportResult {
  /** Flat field map ready to merge into a BrandConfig (see flattenForProposed). */
  proposed: Record<string, unknown>;
  confidence: Record<string, "high" | "medium" | "low">;
  sourceUrl?: string;
  pagesScraped?: string[];
  hasScreenshot?: boolean;
  /** Ranked logo candidates so a review UI can show a picker. */
  logoAlternates?: BrandImportLogoAlternate[];
}

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/**
 * Run the streaming brand importer against `url`. `onDimension` is invoked as
 * each extractor reports progress (use it to drive a live status UI). Resolves
 * with the final proposed brand fields, or throws on failure.
 */
export async function streamBrandImportFromUrl(
  url: string,
  onDimension?: (
    dimension: BrandImportDimensionName,
    result: BrandImportDimensionResult,
  ) => void,
): Promise<BrandImportResult> {
  const res = await fetch(`${BASE}/api/lp/brand-import/from-url-stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok || !res.body) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Import failed");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  interface DonePayload {
    proposed: Record<string, unknown>;
    confidence: Record<string, "high" | "medium" | "low">;
    sourceUrl?: string;
    pagesScraped?: string[];
    hasScreenshot?: boolean;
  }
  let donePayload: DonePayload | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let event: { event: string; [k: string]: unknown };
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      if (event.event === "dimension") {
        const dimension = event.dimension as BrandImportDimensionName;
        const result = event.result as {
          status: BrandImportDimensionStatus;
          data: unknown;
          errors?: string[];
        };
        onDimension?.(dimension, {
          status: result.status,
          data: result.data,
          errors: result.errors ?? [],
        });
      } else if (event.event === "done") {
        donePayload = event.payload as DonePayload;
      } else if (event.event === "error") {
        throw new Error(String(event.error));
      }
    }
  }

  if (!donePayload) throw new Error("Stream ended without a final payload");

  return {
    proposed: donePayload.proposed,
    confidence: donePayload.confidence,
    sourceUrl: donePayload.sourceUrl,
    pagesScraped: donePayload.pagesScraped,
    hasScreenshot: donePayload.hasScreenshot,
    logoAlternates: Array.isArray(donePayload.proposed.logoAlternates)
      ? (donePayload.proposed.logoAlternates as BrandImportLogoAlternate[])
      : undefined,
  };
}

/**
 * Best-effort provenance write so the tenant's Brand Settings shows where the
 * imported values came from. Never throws.
 */
export async function recordBrandImportSource(
  url: string,
  fields: string[],
  confidenceCounts?: Record<string, number>,
): Promise<void> {
  try {
    await fetch(`${BASE}/api/lp/brand-import/record-source`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, fields, confidenceCounts }),
    });
  } catch {
    /* provenance is non-critical */
  }
}
