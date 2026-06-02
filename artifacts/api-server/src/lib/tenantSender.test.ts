import { describe, it, expect } from "vitest";
import {
  buildSenderIdentity,
  deriveSlugLocalPart,
  SHARED_SENDING_DOMAIN,
  type SenderKind,
} from "./tenantSender";

function ctx(overrides: Partial<{
  brandName: string;
  senderName: string;
  senderLocalPart: string;
  sendingDomain: string;
  replyTo: string;
  notificationsLocalPart: string;
}> = {}) {
  return {
    brandName: "Acme Dental",
    senderName: "",
    senderLocalPart: "",
    sendingDomain: "",
    replyTo: "",
    notificationsLocalPart: "",
    ...overrides,
  };
}

describe("deriveSlugLocalPart", () => {
  it("lowercases and keeps a clean slug intact", () => {
    expect(deriveSlugLocalPart("acme-dental", 7)).toBe("acme-dental");
    expect(deriveSlugLocalPart("Acme", 7)).toBe("acme");
  });

  it("strips disallowed characters and collapses repeats", () => {
    expect(deriveSlugLocalPart("Acme Dental!! Co", 7)).toBe("acme-dental-co");
    expect(deriveSlugLocalPart("a__b##c", 7)).toBe("a-b-c");
  });

  it("trims leading/trailing dots and hyphens", () => {
    expect(deriveSlugLocalPart("--acme--", 7)).toBe("acme");
    expect(deriveSlugLocalPart("...acme...", 7)).toBe("acme");
  });

  it("falls back to tenant-{id} when nothing usable remains", () => {
    expect(deriveSlugLocalPart("!!!", 7)).toBe("tenant-7");
    expect(deriveSlugLocalPart("", 7)).toBe("tenant-7");
    expect(deriveSlugLocalPart(null, 99)).toBe("tenant-99");
  });
});

describe("buildSenderIdentity — Tier 1 shared default (unconfigured tenant)", () => {
  it("sends from {Brand} <{slug}@mail.lpstudio.ai> with no custom domain", () => {
    const r = buildSenderIdentity({
      kind: "sales",
      ctx: ctx(),
      slug: "acme-dental",
      tenantId: 7,
      customDomainVerified: false,
    });
    expect(r.from).toBe(`Acme Dental <acme-dental@${SHARED_SENDING_DOMAIN}>`);
    expect(r.domain).toBe(SHARED_SENDING_DOMAIN);
    expect(r.usingCustomDomain).toBe(false);
  });

  it("uses the configured replyTo when present", () => {
    const r = buildSenderIdentity({
      kind: "sales",
      ctx: ctx({ replyTo: "sales@acme.com" }),
      slug: "acme",
      tenantId: 7,
      customDomainVerified: false,
    });
    expect(r.replyTo).toBe("sales@acme.com");
  });

  it("falls back to the workspace owner email when no replyTo is set", () => {
    const r = buildSenderIdentity({
      kind: "sales",
      ctx: ctx(),
      slug: "acme",
      tenantId: 7,
      customDomainVerified: false,
      ownerEmail: "owner@acme.com",
    });
    expect(r.replyTo).toBe("owner@acme.com");
  });

  it("omits replyTo entirely when neither replyTo nor owner email exist", () => {
    const r = buildSenderIdentity({
      kind: "sales",
      ctx: ctx(),
      slug: "acme",
      tenantId: 7,
      customDomainVerified: false,
    });
    expect(r.replyTo).toBeUndefined();
    expect("replyTo" in r).toBe(false);
  });

  it("prefers an explicit senderName override for the display name", () => {
    const r = buildSenderIdentity({
      kind: "sales",
      ctx: ctx({ senderName: "Brand Sender" }),
      slug: "acme",
      tenantId: 7,
      customDomainVerified: false,
      overrides: { senderName: "Override Name" },
    });
    expect(r.from).toBe(`Override Name <acme@${SHARED_SENDING_DOMAIN}>`);
  });

  it("falls back to LP Studio when no display name is resolvable", () => {
    const r = buildSenderIdentity({
      kind: "sales",
      ctx: ctx({ brandName: "" }),
      slug: "acme",
      tenantId: 7,
      customDomainVerified: false,
    });
    expect(r.from).toBe(`LP Studio <acme@${SHARED_SENDING_DOMAIN}>`);
  });

  it("ignores a senderLocalPart override on the shared domain (slug only)", () => {
    const r = buildSenderIdentity({
      kind: "sales",
      ctx: ctx(),
      slug: "acme",
      tenantId: 7,
      customDomainVerified: false,
      overrides: { senderLocalPart: "arbitrary" },
    });
    expect(r.from).toBe(`Acme Dental <acme@${SHARED_SENDING_DOMAIN}>`);
  });
});

describe("buildSenderIdentity — verified custom domain", () => {
  it("sends from the custom domain with the sales local part", () => {
    const r = buildSenderIdentity({
      kind: "sales",
      ctx: ctx({ senderName: "Acme Sales", senderLocalPart: "hello", sendingDomain: "mail.acme.com", replyTo: "reply@acme.com" }),
      slug: "acme",
      tenantId: 7,
      customDomainVerified: true,
    });
    expect(r.from).toBe("Acme Sales <hello@mail.acme.com>");
    expect(r.replyTo).toBe("reply@acme.com");
    expect(r.domain).toBe("mail.acme.com");
    expect(r.usingCustomDomain).toBe(true);
  });

  it("honors a senderLocalPart override on a verified custom domain", () => {
    const r = buildSenderIdentity({
      kind: "sales",
      ctx: ctx({ senderName: "Acme Sales", senderLocalPart: "hello", sendingDomain: "mail.acme.com" }),
      slug: "acme",
      tenantId: 7,
      customDomainVerified: true,
      overrides: { senderLocalPart: "campaign" },
    });
    expect(r.from).toBe("Acme Sales <campaign@mail.acme.com>");
  });

  it("uses the notifications local part for notification kind", () => {
    const r = buildSenderIdentity({
      kind: "notifications",
      ctx: ctx({ senderName: "Acme", sendingDomain: "mail.acme.com", notificationsLocalPart: "alerts" }),
      slug: "acme",
      tenantId: 7,
      customDomainVerified: true,
    });
    expect(r.from).toBe("Acme <alerts@mail.acme.com>");
    expect(r.usingCustomDomain).toBe(true);
  });
});

describe("buildSenderIdentity — fail closed", () => {
  it("falls back to the shared default when the custom domain is NOT verified", () => {
    const r = buildSenderIdentity({
      kind: "sales",
      ctx: ctx({ senderName: "Acme Sales", senderLocalPart: "hello", sendingDomain: "mail.acme.com", replyTo: "reply@acme.com" }),
      slug: "acme",
      tenantId: 7,
      customDomainVerified: false,
    });
    expect(r.domain).toBe(SHARED_SENDING_DOMAIN);
    expect(r.from).toBe(`Acme Sales <acme@${SHARED_SENDING_DOMAIN}>`);
    expect(r.usingCustomDomain).toBe(false);
    // never emits the unverified custom domain
    expect(r.from).not.toContain("mail.acme.com");
  });

  it("falls back to the shared default when no custom domain is configured even if verified flag is true", () => {
    const r = buildSenderIdentity({
      kind: "sales",
      ctx: ctx({ senderName: "Acme Sales", senderLocalPart: "hello" }),
      slug: "acme",
      tenantId: 7,
      customDomainVerified: true,
    });
    expect(r.domain).toBe(SHARED_SENDING_DOMAIN);
    expect(r.usingCustomDomain).toBe(false);
  });

  it("falls back to the shared default when a verified custom domain has no usable local part", () => {
    const r = buildSenderIdentity({
      kind: "sales",
      ctx: ctx({ senderName: "Acme Sales", sendingDomain: "mail.acme.com" }),
      slug: "acme",
      tenantId: 7,
      customDomainVerified: true,
    });
    // sales kind with empty senderLocalPart + no override → no custom local part
    expect(r.domain).toBe(SHARED_SENDING_DOMAIN);
    expect(r.usingCustomDomain).toBe(false);
  });
});

describe("buildSenderIdentity — never borrows another tenant's domain", () => {
  it("the only non-tenant domain ever emitted is the shared account domain", () => {
    const kinds: SenderKind[] = ["sales", "notifications"];
    for (const kind of kinds) {
      const r = buildSenderIdentity({
        kind,
        ctx: ctx({ sendingDomain: "someone-elses.com" }),
        slug: "acme",
        tenantId: 7,
        customDomainVerified: false, // unverified → fail closed
      });
      expect(r.domain).toBe(SHARED_SENDING_DOMAIN);
      expect(r.from).not.toContain("someone-elses.com");
    }
  });
});
