/**
 * startAutoStyleFromReference — the fail-open auto "style from URL" runner
 * used by /lp/generate-page. Pure unit tests with an injected fake
 * orchestrator: the contract under pin is "filtered result on success, null
 * on EVERY failure mode, never a rejection".
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { startAutoStyleFromReference } from "./auto-style-from-reference";
import type { OrchestratorPayload, StreamEvent } from "./brand-import/types";

function fakePayload(proposed: Record<string, unknown>, sourceUrl = "https://ref.example/"): OrchestratorPayload {
  return { sourceUrl, proposed } as unknown as OrchestratorPayload;
}

function fakeOrchestrator(events: StreamEvent[]) {
  const calls: string[] = [];
  // eslint-disable-next-line @typescript-eslint/require-await
  const orchestrator = async function* (url: string): AsyncGenerator<StreamEvent, void, undefined> {
    calls.push(url);
    for (const e of events) yield e;
  };
  return { orchestrator, calls };
}

const safeHost = async (): Promise<boolean> => true;

const PROPOSED = {
  primaryColor: "#112233",
  cardRadius: "soft",
  layoutDensity: "spacious",
  // must be filtered out
  brandName: "Acme",
  logoUrl: "https://acme.example/logo.svg",
};

const ORIGINAL_FLAG = process.env.AUTO_STYLE_FROM_REFERENCE;

beforeEach(() => {
  delete process.env.AUTO_STYLE_FROM_REFERENCE;
});

afterEach(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.AUTO_STYLE_FROM_REFERENCE;
  else process.env.AUTO_STYLE_FROM_REFERENCE = ORIGINAL_FLAG;
  vi.restoreAllMocks();
});

describe("startAutoStyleFromReference", () => {
  it("resolves the whitelist-filtered overrides on a done event", async () => {
    const { orchestrator, calls } = fakeOrchestrator([
      { event: "done", payload: fakePayload(PROPOSED) },
    ]);
    const result = await startAutoStyleFromReference({
      referenceUrls: ["acme.example/pricing"],
      apiKey: "fc-key",
      orchestrator,
      checkHost: safeHost,
    });
    expect(result).toEqual({
      styleOverrides: { primaryColor: "#112233", cardRadius: "soft", layoutDensity: "spacious" },
      sourceUrl: "https://ref.example/",
    });
    // Schemeless URL was normalized to https before hitting the orchestrator.
    expect(calls).toEqual(["https://acme.example/pricing"]);
  });

  it("returns null when the proposal has no whitelisted visual tokens", async () => {
    const { orchestrator } = fakeOrchestrator([
      { event: "done", payload: fakePayload({ brandName: "Acme", taglines: ["Do more"] }) },
    ]);
    const result = await startAutoStyleFromReference({
      referenceUrls: ["https://acme.example"],
      apiKey: "fc-key",
      orchestrator,
      checkHost: safeHost,
    });
    expect(result).toBeNull();
  });

  it("returns null on an orchestrator error event", async () => {
    const { orchestrator } = fakeOrchestrator([
      { event: "error", error: "evidence build failed" },
    ]);
    const result = await startAutoStyleFromReference({
      referenceUrls: ["https://acme.example"],
      apiKey: "fc-key",
      orchestrator,
      checkHost: safeHost,
    });
    expect(result).toBeNull();
  });

  it("returns null (never rejects) when the orchestrator throws mid-stream", async () => {
    // eslint-disable-next-line @typescript-eslint/require-await
    const orchestrator = async function* (): AsyncGenerator<StreamEvent, void, undefined> {
      yield {
        event: "start", sourceUrl: "https://acme.example/", pagesScraped: [],
        hasScreenshot: false, sampledPalette: [], robots: { allowed: true } as never,
      } as StreamEvent;
      throw new Error("boom");
    };
    const result = await startAutoStyleFromReference({
      referenceUrls: ["https://acme.example"],
      apiKey: "fc-key",
      orchestrator: () => orchestrator(),
      checkHost: safeHost,
    });
    expect(result).toBeNull();
  });

  it("returns null when the orchestrator hangs past timeoutMs", async () => {
    const orchestrator = async function* (): AsyncGenerator<StreamEvent, void, undefined> {
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      yield { event: "done", payload: fakePayload(PROPOSED) };
    };
    const result = await startAutoStyleFromReference({
      referenceUrls: ["https://acme.example"],
      apiKey: "fc-key",
      orchestrator: () => orchestrator(),
      checkHost: safeHost,
      timeoutMs: 20,
    });
    expect(result).toBeNull();
  });

  it("kill switch: AUTO_STYLE_FROM_REFERENCE=0 disables without invoking the orchestrator", async () => {
    process.env.AUTO_STYLE_FROM_REFERENCE = "0";
    const { orchestrator, calls } = fakeOrchestrator([
      { event: "done", payload: fakePayload(PROPOSED) },
    ]);
    const result = await startAutoStyleFromReference({
      referenceUrls: ["https://acme.example"],
      apiKey: "fc-key",
      orchestrator,
      checkHost: safeHost,
    });
    expect(result).toBeNull();
    expect(calls).toEqual([]);
  });

  it('kill switch also accepts "false"', async () => {
    process.env.AUTO_STYLE_FROM_REFERENCE = "false";
    const { orchestrator, calls } = fakeOrchestrator([
      { event: "done", payload: fakePayload(PROPOSED) },
    ]);
    const result = await startAutoStyleFromReference({
      referenceUrls: ["https://acme.example"],
      apiKey: "fc-key",
      orchestrator,
      checkHost: safeHost,
    });
    expect(result).toBeNull();
    expect(calls).toEqual([]);
  });

  it("returns null without an apiKey", async () => {
    const { orchestrator, calls } = fakeOrchestrator([
      { event: "done", payload: fakePayload(PROPOSED) },
    ]);
    const result = await startAutoStyleFromReference({
      referenceUrls: ["https://acme.example"],
      apiKey: undefined,
      orchestrator,
      checkHost: safeHost,
    });
    expect(result).toBeNull();
    expect(calls).toEqual([]);
  });

  it("returns null with no reference URLs", async () => {
    const { orchestrator, calls } = fakeOrchestrator([
      { event: "done", payload: fakePayload(PROPOSED) },
    ]);
    const result = await startAutoStyleFromReference({
      referenceUrls: [],
      apiKey: "fc-key",
      orchestrator,
      checkHost: safeHost,
    });
    expect(result).toBeNull();
    expect(calls).toEqual([]);
  });

  it("returns null when the host fails the SSRF guard", async () => {
    const { orchestrator, calls } = fakeOrchestrator([
      { event: "done", payload: fakePayload(PROPOSED) },
    ]);
    const result = await startAutoStyleFromReference({
      referenceUrls: ["https://internal.local"],
      apiKey: "fc-key",
      orchestrator,
      checkHost: async () => false,
    });
    expect(result).toBeNull();
    expect(calls).toEqual([]);
  });

  it("returns null for a non-http(s) URL", async () => {
    const { orchestrator, calls } = fakeOrchestrator([
      { event: "done", payload: fakePayload(PROPOSED) },
    ]);
    const result = await startAutoStyleFromReference({
      referenceUrls: ["ftp://acme.example/styles"],
      apiKey: "fc-key",
      orchestrator,
      checkHost: safeHost,
    });
    expect(result).toBeNull();
    expect(calls).toEqual([]);
  });

  it("only styles from the FIRST reference URL", async () => {
    const { orchestrator, calls } = fakeOrchestrator([
      { event: "done", payload: fakePayload(PROPOSED) },
    ]);
    await startAutoStyleFromReference({
      referenceUrls: ["https://first.example", "https://second.example"],
      apiKey: "fc-key",
      orchestrator,
      checkHost: safeHost,
    });
    expect(calls).toEqual(["https://first.example/"]);
  });
});
