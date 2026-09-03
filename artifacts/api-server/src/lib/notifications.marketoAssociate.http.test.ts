/**
 * HTTP-layer tests for syncToMarketo's Munchkin-cookie association
 * (lib/notifications.ts).
 *
 * The form-lead REST upsert (createOrUpdate, lookupField email) carries no
 * browser cookie, so the visitor's Munchkin web activity never reached the
 * synced lead — it stayed anonymous or stuck to a stale ghost-submit-era
 * lead (the Forms2 ghost submit that used to carry the cookie is disabled).
 * syncToMarketo now calls Marketo's Associate Lead API with the raw
 * `_mkto_trk` value BlockForm captures at submit. Pins:
 *   • a well-formed cookie → POST /v1/leads/{id}/associate.json with the
 *     cookie URL-encoded and the bearer token attached;
 *   • no cookie → no associate call;
 *   • a malformed cookie (arbitrary client input) → no associate call —
 *     the shape check keeps junk out of the request URL;
 *   • an association failure never fails the sync.
 *
 * global.fetch is intercepted (same approach as marketo-service.http.test.ts);
 * no real network. The module transitively imports the db pool, so the suite
 * is DB-gated like its siblings even though it never queries.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { dbAvailable } from "../test-utils/dbAvailable";

const { syncToMarketo } = await import("./notifications");
type MarketoConfig = Parameters<typeof syncToMarketo>[0];
type LeadPayload = Parameters<typeof syncToMarketo>[1];

const realFetch = global.fetch;
let calls: Array<{ url: string; init?: RequestInit }> = [];

function installFetchMock() {
  calls = [];
  global.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    if (url.includes("/oauth/token")) {
      return json({ access_token: "tok-123", expires_in: 3600 });
    }
    if (url.includes("/v1/leads.json")) {
      return json({ success: true, result: [{ id: 777, status: "created" }] });
    }
    if (url.includes("/associate.json")) {
      return json({ success: true, result: [] });
    }
    return json({ success: true });
  }) as typeof fetch;
}

afterAll(() => {
  global.fetch = realFetch;
});

// Unique clientId per case — getMarketoToken caches per (identityBase, clientId).
let n = 0;
function config(): MarketoConfig {
  n += 1;
  return {
    munchkinId: "000-TST-000",
    clientId: `client-${Date.now()}-${n}`,
    clientSecret: "secret",
    restEndpoint: "https://fake.mktorest.example/rest",
    identityEndpoint: "https://fake.mktorest.example/identity",
    fieldMappings: { "Email Address": "email" },
  } as MarketoConfig;
}

const lead: LeadPayload = {
  leadId: 1,
  pageId: 2,
  pageSlug: "test",
  pageTitle: "Test",
  fields: { "Email Address": "jane@acme.com" },
  submittedAt: new Date().toISOString(),
};

const COOKIE = "id:000-TST-000&token:_mch-meetdandy.com-1756800000000-12345";

describe.skipIf(!dbAvailable)("syncToMarketo Munchkin association", () => {
  beforeEach(installFetchMock);

  it("associates the upserted lead with a well-formed _mkto_trk cookie", async () => {
    await syncToMarketo(config(), lead, { mktoTrk: COOKIE });
    const assoc = calls.find((c) => c.url.includes("/associate.json"));
    expect(assoc).toBeDefined();
    expect(assoc!.url).toBe(
      `https://fake.mktorest.example/rest/v1/leads/777/associate.json?cookie=${encodeURIComponent(COOKIE)}`,
    );
    expect(assoc!.init?.method).toBe("POST");
    expect((assoc!.init?.headers as Record<string, string>)["Authorization"]).toBe("Bearer tok-123");
    // Cookie never leaks into the createOrUpdate field payload.
    const upsert = calls.find((c) => c.url.includes("/v1/leads.json"));
    expect(String(upsert!.init?.body)).not.toContain("mkto_trk");
  });

  it("skips association when no cookie was captured", async () => {
    await syncToMarketo(config(), lead, {});
    await syncToMarketo(config(), lead);
    expect(calls.some((c) => c.url.includes("/associate.json"))).toBe(false);
  });

  it("rejects a malformed cookie instead of sending arbitrary client input", async () => {
    for (const bad of ["javascript:alert(1)", "id:x&token:", "totally-not-a-cookie", "id:000-TST-000&token:a b"]) {
      await syncToMarketo(config(), lead, { mktoTrk: bad });
    }
    expect(calls.some((c) => c.url.includes("/associate.json"))).toBe(false);
  });

  it("an association failure never fails the sync", async () => {
    installFetchMock();
    const base = global.fetch as typeof fetch;
    global.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).includes("/associate.json")) {
        calls.push({ url: String(input), init });
        // Marketo's classic failure mode: HTTP 200 with success:false in the
        // body (a non-2xx would exercise retryFetch's real backoff sleeps).
        return new Response(JSON.stringify({ success: false, errors: [{ code: "1004", message: "Lead not found" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return base(input, init);
    }) as typeof fetch;
    await expect(syncToMarketo(config(), lead, { mktoTrk: COOKIE })).resolves.toBeUndefined();
    expect(calls.some((c) => c.url.includes("/associate.json"))).toBe(true);
  });
});
