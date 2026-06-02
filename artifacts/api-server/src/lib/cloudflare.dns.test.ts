import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CloudflareError,
  createDnsRecord,
  deleteDnsRecord,
  findDnsRecordsByName,
} from "./cloudflare";

// cfFetch reads CLOUDFLARE_API_TOKEN / CLOUDFLARE_ZONE_ID and calls global
// fetch. We stub both so these tests never touch the network.
const ZONE_ID = "zone-test-123";

function okEnvelope(result: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, errors: [], result }),
  } as unknown as Response;
}

function errEnvelope(status: number, errors: Array<{ code: number; message: string }>) {
  return {
    ok: false,
    status,
    json: async () => ({ success: false, errors, result: null }),
  } as unknown as Response;
}

describe("cloudflare DNS record CRUD", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.CLOUDFLARE_API_TOKEN = "token-test";
    process.env.CLOUDFLARE_ZONE_ID = ZONE_ID;
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.CLOUDFLARE_ZONE_ID;
  });

  it("createDnsRecord posts an unproxied record with TTL default 1", async () => {
    fetchSpy.mockResolvedValueOnce(
      okEnvelope({ id: "rec1", type: "TXT", name: "send.acme.lpstudio.ai", content: "v=spf1", ttl: 1 }),
    );

    const rec = await createDnsRecord({
      type: "TXT",
      name: "send.acme.lpstudio.ai",
      content: "v=spf1 include:amazonses.com ~all",
    });

    expect(rec.id).toBe("rec1");
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records`);
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      type: "TXT",
      name: "send.acme.lpstudio.ai",
      content: "v=spf1 include:amazonses.com ~all",
      ttl: 1,
      proxied: false,
    });
    expect(body).not.toHaveProperty("priority");
  });

  it("createDnsRecord includes priority for MX records", async () => {
    fetchSpy.mockResolvedValueOnce(
      okEnvelope({ id: "mx1", type: "MX", name: "send.acme.lpstudio.ai", content: "feedback-smtp.us-east-1.amazonses.com", priority: 10, ttl: 1 }),
    );

    await createDnsRecord({
      type: "MX",
      name: "send.acme.lpstudio.ai",
      content: "feedback-smtp.us-east-1.amazonses.com",
      priority: 10,
    });

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(body.priority).toBe(10);
    expect(body.proxied).toBe(false);
  });

  it("deleteDnsRecord swallows a 404 (idempotent teardown)", async () => {
    fetchSpy.mockResolvedValueOnce(errEnvelope(404, [{ code: 81044, message: "record not found" }]));
    await expect(deleteDnsRecord("missing")).resolves.toBeUndefined();
  });

  it("deleteDnsRecord rethrows non-404 errors", async () => {
    fetchSpy.mockResolvedValueOnce(errEnvelope(500, [{ code: 1000, message: "boom" }]));
    await expect(deleteDnsRecord("rec1")).rejects.toBeInstanceOf(CloudflareError);
  });

  it("findDnsRecordsByName paginates and matches case-insensitively", async () => {
    // Page 1 full (100) then a short page → stops after page 2.
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      id: `other${i}`,
      type: "TXT",
      name: "unrelated.lpstudio.ai",
      content: "x",
      ttl: 1,
    }));
    const page2 = [
      { id: "hit1", type: "TXT", name: "Send.Acme.LPStudio.ai", content: "v=spf1", ttl: 1 },
      { id: "nomatch", type: "TXT", name: "else.lpstudio.ai", content: "y", ttl: 1 },
    ];
    fetchSpy.mockResolvedValueOnce(okEnvelope(page1)).mockResolvedValueOnce(okEnvelope(page2));

    const found = await findDnsRecordsByName("send.acme.lpstudio.ai");
    expect(found.map((r) => r.id)).toEqual(["hit1"]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
