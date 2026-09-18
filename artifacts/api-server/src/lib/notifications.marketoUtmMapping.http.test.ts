/**
 * HTTP-layer tests for syncToMarketo's UTM auto-injection (lib/notifications.ts).
 *
 * A form with no hidden UTM fields submits nothing UTM-shaped in `fields`, so
 * the only way attribution reaches Marketo is the auto-injection block, which
 * resolves each URL-param key ("utm_source") through the form's
 * `fieldMappings` to the tenant's REST field name ("UTM_Source__c").
 *
 * The regression this pins: `fieldMappings` is keyed by form LABEL ("UTM
 * Source") — that is what the Forms UI writes — while the injection block
 * looked the key up as "utm_source". The exact-key miss meant every UTM was
 * silently dropped for label-keyed tenants, which is the common case. The
 * lookup is now canonicalized on both sides.
 *
 * Also pinned: injection still refuses to invent a field name when no mapping
 * exists. Marketo's createOrUpdate is all-or-nothing, so a raw lowercase
 * "utm_source" key would make it skip the entire lead.
 *
 * global.fetch is intercepted; no real network. This suite issues no queries,
 * so it gates on DATABASE_URL merely being set (the db module the import chain
 * pulls in throws without one) rather than on Postgres being reachable — that
 * way the assertions actually run in CI instead of skipping.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";

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
    if (url.includes("/oauth/token")) return json({ access_token: "tok-123", expires_in: 3600 });
    if (url.includes("/v1/leads.json")) return json({ success: true, result: [{ id: 777, status: "created" }] });
    return json({ success: true });
  }) as typeof fetch;
}

afterAll(() => {
  global.fetch = realFetch;
});

// Unique clientId per case — getMarketoToken caches per (identityBase, clientId).
let n = 0;
function config(fieldMappings: Record<string, string>): MarketoConfig {
  n += 1;
  return {
    munchkinId: "000-TST-000",
    clientId: `client-${Date.now()}-${n}`,
    clientSecret: "secret",
    restEndpoint: "https://fake.mktorest.example/rest",
    identityEndpoint: "https://fake.mktorest.example/identity",
    fieldMappings,
  } as MarketoConfig;
}

function lead(
  fields: Record<string, unknown> = { "Email Address": "jane@acme.com" },
  clickIds?: Record<string, string>,
): LeadPayload {
  return {
    leadId: 1,
    pageId: 2,
    pageSlug: "test",
    pageTitle: "Test",
    fields,
    submittedAt: new Date().toISOString(),
    utm: {
      source: "google",
      medium: "cpc",
      campaign: "dso-q3",
      term: "digital dentures",
      content: "variant-b",
    },
    ...(clickIds ? { clickIds } : {}),
  } as LeadPayload;
}

/** The single field object sent to Marketo's createOrUpdate. */
function sentFields(): Record<string, unknown> {
  const upsert = calls.find((c) => c.url.includes("/v1/leads.json"));
  expect(upsert).toBeDefined();
  return JSON.parse(String(upsert!.init?.body)).input[0];
}

// Dandy's real shape: mappings keyed by the form's field label.
const LABEL_KEYED = {
  "Email Address": "email",
  "UTM Source": "UTM_Source__c",
  "UTM Medium": "UTM_Medium__c",
  "UTM Campaign": "UTM_Campaign__c",
  "UTM Term": "UTM_Term__c",
  "UTM Content": "UTM_Content__c",
};

describe.skipIf(!process.env.DATABASE_URL)("syncToMarketo UTM auto-injection", () => {
  beforeEach(installFetchMock);

  it("resolves label-keyed field mappings for URL-param UTM keys", async () => {
    await syncToMarketo(config(LABEL_KEYED), lead());
    expect(sentFields()).toMatchObject({
      email: "jane@acme.com",
      UTM_Source__c: "google",
      UTM_Medium__c: "cpc",
      UTM_Campaign__c: "dso-q3",
      UTM_Term__c: "digital dentures",
      UTM_Content__c: "variant-b",
    });
  });

  it("still resolves mappings keyed by the raw URL-param name", async () => {
    await syncToMarketo(
      config({ "Email Address": "email", utm_source: "UTM_Source__c" }),
      lead(),
    );
    expect(sentFields()).toMatchObject({ UTM_Source__c: "google" });
  });

  it("lets a submitted UTM field win over injection instead of writing it twice", async () => {
    await syncToMarketo(
      config(LABEL_KEYED),
      lead({ "Email Address": "jane@acme.com", "UTM Source": "hidden-field-value" }),
    );
    expect(sentFields()).toMatchObject({ UTM_Source__c: "hidden-field-value" });
  });

  it("injects ad click IDs through their mapped field names", async () => {
    await syncToMarketo(
      config({ ...LABEL_KEYED, GCLID: "GCLID__c", FBCLID: "FBCLID__c", GBRAID: "gBRAID" }),
      lead(undefined, { gclid: "Cj0KCQ", fbclid: "IwAR1", gbraid: "0AAAAA" }),
    );
    expect(sentFields()).toMatchObject({
      GCLID__c: "Cj0KCQ",
      FBCLID__c: "IwAR1",
      gBRAID: "0AAAAA",
    });
  });

  it("resolves a click ID mapped under its human label rather than its param name", async () => {
    // "Microsoft Click ID" does not collapse to "msclkid", so the alias list
    // is what makes this tenant's mapping resolve.
    await syncToMarketo(
      config({ "Email Address": "email", "Microsoft Click ID": "microsoftClickID" }),
      lead(undefined, { msclkid: "abc123" }),
    );
    expect(sentFields()).toMatchObject({ microsoftClickID: "abc123" });
  });

  it("never injects a raw lowercase URL-param key when no mapping exists", async () => {
    await syncToMarketo(config({ "Email Address": "email" }), lead(undefined, { gclid: "Cj0KCQ", msclkid: "abc123" }));
    const f = sentFields();
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "msclkid"]) {
      expect(f).not.toHaveProperty(k);
    }
    expect(Object.keys(f)).toEqual(["email"]);
  });
});
