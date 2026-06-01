import { describe, expect, it } from "vitest";

import { payloadHasUsableResults } from "./orchestrator";
import type { DimensionResult, OrchestratorPayload } from "./types";

function res(status: DimensionResult<unknown>["status"]): DimensionResult<unknown> {
  return { status, data: status === "failed" ? null : ({} as unknown), confidence: "low", errors: [] };
}

// Build a payload whose dimension statuses we control; only `results` matters
// to payloadHasUsableResults, so the rest is filler cast to the payload shape.
function payloadWith(
  statuses: Partial<Record<keyof OrchestratorPayload["results"], DimensionResult<unknown>["status"]>>,
): OrchestratorPayload {
  const dims: (keyof OrchestratorPayload["results"])[] = [
    "logos", "colors", "typography", "buttons", "photography", "voice", "content", "structure",
  ];
  const results = Object.fromEntries(
    dims.map((d) => [d, res(statuses[d] ?? "failed")]),
  ) as OrchestratorPayload["results"];
  return { results } as OrchestratorPayload;
}

describe("payloadHasUsableResults (cache poisoning guard)", () => {
  it("rejects a payload where every dimension failed", () => {
    // This is the transient/total-failure case that must NOT be cached or
    // served — caching it would block re-scraping the site for the 24h TTL.
    expect(payloadHasUsableResults(payloadWith({}))).toBe(false);
  });

  it("accepts a payload with at least one ok dimension", () => {
    expect(payloadHasUsableResults(payloadWith({ colors: "ok" }))).toBe(true);
  });

  it("accepts a legitimately-partial payload", () => {
    expect(payloadHasUsableResults(payloadWith({ voice: "partial" }))).toBe(true);
  });

  it("tolerates cache rows missing newer dimensions", () => {
    const p = payloadWith({ colors: "ok" });
    // Simulate an older cached row that predates content/structure.
    delete (p.results as Record<string, unknown>).content;
    delete (p.results as Record<string, unknown>).structure;
    expect(payloadHasUsableResults(p)).toBe(true);
  });
});
