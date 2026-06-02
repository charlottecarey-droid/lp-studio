import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the two external-resource modules so no network/DB is touched.
vi.mock("./cloudflare", () => ({
  createDnsRecord: vi.fn(),
  deleteDnsRecord: vi.fn(),
  findDnsRecordsByName: vi.fn(),
}));
vi.mock("./resendDomainStatus", () => ({
  createResendDomain: vi.fn(),
  deleteResendDomain: vi.fn(),
}));

import { createDnsRecord, deleteDnsRecord, findDnsRecordsByName } from "./cloudflare";
import { createResendDomain, deleteResendDomain } from "./resendDomainStatus";
import {
  buildBrandedSubdomainHost,
  mapResendRecordsToCfInputs,
  provisionBrandedEmailDomain,
  deprovisionBrandedEmailDomain,
  BrandedEmailDomainError,
} from "./brandedEmailDomain";

const createDns = vi.mocked(createDnsRecord);
const deleteDns = vi.mocked(deleteDnsRecord);
const findDns = vi.mocked(findDnsRecordsByName);
const createResend = vi.mocked(createResendDomain);
const deleteResend = vi.mocked(deleteResendDomain);

const RESEND_RECORDS = [
  { type: "TXT", name: "send.acme.lpstudio.ai", value: '"v=spf1 include:amazonses.com ~all"' },
  { type: "MX", name: "send", value: "feedback-smtp.us-east-1.amazonses.com", priority: 10 },
  { type: "TXT", name: "resend._domainkey", value: "p=MIGf..." },
];

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildBrandedSubdomainHost", () => {
  it("joins a valid slug to the zone, lowercasing", () => {
    expect(buildBrandedSubdomainHost("Acme", "lpstudio.ai")).toBe("acme.lpstudio.ai");
  });
  it("rejects an invalid slug", () => {
    expect(() => buildBrandedSubdomainHost("bad slug!", "lpstudio.ai")).toThrow(BrandedEmailDomainError);
  });
  it("throws when the zone is missing", () => {
    expect(() => buildBrandedSubdomainHost("acme", "")).toThrow(BrandedEmailDomainError);
  });
});

describe("mapResendRecordsToCfInputs", () => {
  it("fully-qualifies names, strips TXT quotes, and carries MX priority", () => {
    const out = mapResendRecordsToCfInputs(RESEND_RECORDS, "acme.lpstudio.ai");
    expect(out).toEqual([
      { type: "TXT", name: "send.acme.lpstudio.ai", content: "v=spf1 include:amazonses.com ~all" },
      { type: "MX", name: "send.acme.lpstudio.ai", content: "feedback-smtp.us-east-1.amazonses.com", priority: 10 },
      { type: "TXT", name: "resend._domainkey.acme.lpstudio.ai", content: "p=MIGf..." },
    ]);
  });
});

describe("provisionBrandedEmailDomain", () => {
  it("registers in Resend then publishes every record to Cloudflare", async () => {
    createResend.mockResolvedValue({
      available: true,
      domain: { id: "dom_1", name: "acme.lpstudio.ai", status: "pending", records: RESEND_RECORDS },
    });
    createDns
      .mockResolvedValueOnce({ id: "cf1", type: "TXT", name: "send.acme.lpstudio.ai", content: "x", ttl: 1 })
      .mockResolvedValueOnce({ id: "cf2", type: "MX", name: "send.acme.lpstudio.ai", content: "x", ttl: 1 })
      .mockResolvedValueOnce({ id: "cf3", type: "TXT", name: "resend._domainkey.acme.lpstudio.ai", content: "x", ttl: 1 });

    const result = await provisionBrandedEmailDomain("acme.lpstudio.ai");

    expect(result.resendId).toBe("dom_1");
    expect(result.host).toBe("acme.lpstudio.ai");
    expect(result.dnsRecordIds).toEqual(["cf1", "cf2", "cf3"]);
    expect(result.status).toBe("pending");
    expect(createDns).toHaveBeenCalledTimes(3);
    expect(deleteDns).not.toHaveBeenCalled();
    expect(deleteResend).not.toHaveBeenCalled();
  });

  it("throws when Resend registration is unavailable", async () => {
    createResend.mockResolvedValue({ available: false, error: "no RESEND_API_KEY" });
    await expect(provisionBrandedEmailDomain("acme.lpstudio.ai")).rejects.toBeInstanceOf(BrandedEmailDomainError);
    expect(createDns).not.toHaveBeenCalled();
  });

  it("rolls back created CF records AND the Resend domain when a CF write fails", async () => {
    createResend.mockResolvedValue({
      available: true,
      domain: { id: "dom_2", name: "acme.lpstudio.ai", status: "pending", records: RESEND_RECORDS },
    });
    createDns
      .mockResolvedValueOnce({ id: "cf1", type: "TXT", name: "send.acme.lpstudio.ai", content: "x", ttl: 1 })
      .mockRejectedValueOnce(new Error("cf boom"));
    deleteDns.mockResolvedValue(undefined);
    deleteResend.mockResolvedValue({ available: true });

    await expect(provisionBrandedEmailDomain("acme.lpstudio.ai")).rejects.toThrow("cf boom");
    // The one created record is rolled back, and the Resend domain is removed.
    expect(deleteDns).toHaveBeenCalledWith("cf1");
    expect(deleteResend).toHaveBeenCalledWith("dom_2");
  });
});

describe("deprovisionBrandedEmailDomain", () => {
  it("deletes records by stored id then removes the Resend domain", async () => {
    deleteDns.mockResolvedValue(undefined);
    deleteResend.mockResolvedValue({ available: true });

    await deprovisionBrandedEmailDomain({
      host: "acme.lpstudio.ai",
      resendId: "dom_1",
      dnsRecordIds: ["cf1", "cf2"],
    });

    expect(deleteDns).toHaveBeenCalledWith("cf1");
    expect(deleteDns).toHaveBeenCalledWith("cf2");
    expect(findDns).not.toHaveBeenCalled();
    expect(deleteResend).toHaveBeenCalledWith("dom_1");
  });

  it("falls back to name lookup when no record ids are stored", async () => {
    findDns.mockResolvedValue([
      { id: "found1", type: "TXT", name: "send.acme.lpstudio.ai", content: "x", ttl: 1 },
    ]);
    deleteDns.mockResolvedValue(undefined);
    deleteResend.mockResolvedValue({ available: true });

    await deprovisionBrandedEmailDomain({
      host: "acme.lpstudio.ai",
      resendId: "dom_1",
      dnsRecordIds: [],
    });

    expect(findDns).toHaveBeenCalled();
    expect(deleteDns).toHaveBeenCalledWith("found1");
    expect(deleteResend).toHaveBeenCalledWith("dom_1");
  });
});
