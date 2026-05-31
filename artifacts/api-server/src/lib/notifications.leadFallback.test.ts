/**
 * Regression test for the brand-neutral lead-notification fallback (Task #624).
 *
 * When the tenant-scoped template can't render, sendEmailNotification() drops to
 * a vendor-agnostic last-resort layout. A co-branded tenant must NEVER receive a
 * lead email stamped with the platform's (LP Studio) or another customer's
 * (Dandy) brand colors or wording. This test forces the fallback path and
 * asserts the rendered HTML bytes contain none of those brand markers.
 *
 * Everything is mocked so the test is pure (no DB, no network):
 *   - renderTenantEmail → null, so the fallback branch is taken.
 *   - global fetch → captures the Resend POST body instead of sending.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.mock("./tenantEmailRender", async (importActual) => {
  const actual = await importActual<typeof import("./tenantEmailRender")>();
  return {
    ...actual,
    // Force the brand-neutral fallback: pretend the tenant has no usable template.
    renderTenantEmail: vi.fn(async () => null),
  };
});

const { sendEmailNotification } = await import("./notifications");

// Brand markers that must never appear in the neutral fallback.
const FORBIDDEN_COLORS = ["#003a30", "#c7e738"]; // LP Studio dark green + lime
const FORBIDDEN_WORDS = ["lp studio", "lpstudio", "dandy", "meetdandy"];

let capturedHtml = "";
let originalFetch: typeof globalThis.fetch;
let originalKey: string | undefined;

beforeAll(() => {
  originalKey = process.env["RESEND_API_KEY"];
  // A dummy key so the sender proceeds past its no-key early-return. Nothing
  // leaves the process — fetch is mocked below.
  process.env["RESEND_API_KEY"] = "re_test_dummy_key_not_real";

  originalFetch = globalThis.fetch;
  globalThis.fetch = vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { html?: string };
    capturedHtml = body.html ?? "";
    return { ok: true, status: 200, statusText: "OK" } as Response;
  }) as unknown as typeof globalThis.fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env["RESEND_API_KEY"];
  else process.env["RESEND_API_KEY"] = originalKey;
});

describe("sendEmailNotification — brand-neutral fallback", () => {
  it("renders a fallback email with no LP Studio / Dandy colors or wording", async () => {
    await sendEmailNotification(
      ["recruiter@tenant.example"],
      {
        leadId: 1,
        pageId: 2,
        pageSlug: "demo",
        pageTitle: "Spring Promo",
        variantName: "B",
        fields: { Name: "Jane Doe", Email: "jane@acme.example" },
        submittedAt: new Date("2026-05-31T12:00:00Z").toISOString(),
      },
      12345, // tenantId — render is mocked to null, so the fallback is used
    );

    // The fallback path was taken and we captured the outgoing HTML.
    expect(capturedHtml).not.toBe("");

    const lower = capturedHtml.toLowerCase();
    for (const color of FORBIDDEN_COLORS) {
      expect(lower).not.toContain(color);
    }
    for (const word of FORBIDDEN_WORDS) {
      expect(lower).not.toContain(word);
    }

    // Sanity: it is still a usable lead email (carries the submitted fields).
    expect(capturedHtml).toContain("Jane Doe");
    expect(capturedHtml).toContain("Spring Promo");
  });
});
