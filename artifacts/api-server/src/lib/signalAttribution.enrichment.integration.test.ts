/**
 * Coverage for the identity-enrichment additions to `resolveSignalLinkage`
 * (task: capture richer visitor identity so more engagement links to accounts).
 *
 * The matcher gained two enrichment steps that must improve account match rate
 * WITHOUT ever doing fuzzy or cross-tenant matching:
 *
 *   1. Email → company domain: a signal that carried only a corporate email now
 *      derives its domain (`deriveDomainFromEmail`) and reaches the same exact,
 *      tenant-scoped account-by-domain lookup. Free/personal providers
 *      (gmail.com, …) are deliberately NOT enriched.
 *
 *   2. Tenant-derived alias map: when no `sales_accounts.domain` matches, the
 *      domain is resolved through the tenant's OWN contacts (an account that
 *      already has contacts on that email domain owns it) — but ONLY when it is
 *      unambiguous (exactly one account in this tenant). 0 or >1 fails closed.
 *
 * Both must stay strictly tenant-scoped: the same domain in another tenant's CRM
 * must never leak attribution across tenants.
 *
 * Runs against a HERMETIC throwaway Postgres (schema via `drizzle-kit push`) so
 * it never touches prod Neon — dev's `NEON_DATABASE_URL` points at production.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { startEphemeralPg, type EphemeralPg } from "../test-utils/ephemeralPg";

// Imported dynamically in beforeAll AFTER the ephemeral DB env is set, because
// these modules transitively load `@workspace/db`, whose pool reads the
// connection string at import time.
type Pg = typeof import("@workspace/db");
type Attr = typeof import("./signalAttribution");
let pgMod: Pg;
let attr: Attr;

let epg: EphemeralPg;

/** Walk up from cwd to find the repo's `lib/db` package dir. */
function resolveLibDbDir(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, "lib", "db");
    if (existsSync(path.join(candidate, "drizzle.config.ts"))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not locate lib/db from " + process.cwd());
}

beforeAll(async () => {
  epg = startEphemeralPg();
  process.env.NEON_DATABASE_URL = epg.connectionString;
  process.env.DATABASE_URL = epg.connectionString;

  const libDb = resolveLibDbDir();
  const push = spawnSync(
    "npx",
    ["drizzle-kit", "push", "--force", "--config", "./drizzle.config.ts"],
    { cwd: libDb, encoding: "utf8", env: process.env },
  );
  if (push.status !== 0) {
    throw new Error(
      `drizzle-kit push failed (status ${push.status}):\n${push.stdout}\n${push.stderr}`,
    );
  }

  pgMod = await import("@workspace/db");
  attr = await import("./signalAttribution");
}, 120_000);

afterAll(async () => {
  await pgMod?.pool.end().catch(() => {});
  epg?.stop();
});

async function newTenant(label: string): Promise<number> {
  const uniq = `${label}-${randomUUID().slice(0, 8)}`;
  const t = await pgMod.pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ($1, $2, 'active', '{"industry":"generic"}'::jsonb) RETURNING id`,
    [`IT Enrich ${uniq}`, `it-enrich-${uniq}`],
  );
  return t.rows[0].id;
}

async function newAccount(tenantId: number, name: string, domain: string | null): Promise<number> {
  const a = await pgMod.pool.query<{ id: number }>(
    `INSERT INTO sales_accounts (tenant_id, name, domain, status)
     VALUES ($1, $2, $3, 'prospect') RETURNING id`,
    [tenantId, name, domain],
  );
  return a.rows[0].id;
}

async function newContact(
  tenantId: number, accountId: number, email: string | null, linkedinUrl?: string | null,
): Promise<number> {
  const c = await pgMod.pool.query<{ id: number }>(
    `INSERT INTO sales_contacts (tenant_id, account_id, first_name, last_name, email, linkedin_url, status)
     VALUES ($1, $2, 'Test', 'Person', $3, $4, 'active') RETURNING id`,
    [tenantId, accountId, email, linkedinUrl ?? null],
  );
  return c.rows[0].id;
}

describe("deriveDomainFromEmail (pure)", () => {
  it("returns the domain for a corporate address", () => {
    expect(attr.deriveDomainFromEmail("john@acmedental.com")).toBe("acmedental.com");
    expect(attr.deriveDomainFromEmail("  John@AcmeDental.com ")).toBe("acmedental.com");
  });
  it("returns null for free/personal providers", () => {
    expect(attr.deriveDomainFromEmail("john@gmail.com")).toBeNull();
    expect(attr.deriveDomainFromEmail("jane@yahoo.com")).toBeNull();
    expect(attr.deriveDomainFromEmail("x@outlook.com")).toBeNull();
  });
  it("returns null for empty / malformed input", () => {
    expect(attr.deriveDomainFromEmail("")).toBeNull();
    expect(attr.deriveDomainFromEmail(null)).toBeNull();
    expect(attr.deriveDomainFromEmail("not-an-email")).toBeNull();
    expect(attr.deriveDomainFromEmail("john@localhost")).toBeNull();
  });
});

describe("resolveSignalLinkage — email→domain enrichment", () => {
  it("matches an account by domain DERIVED from a corporate email (no explicit domain)", async () => {
    const tenantId = await newTenant("email-domain");
    const accountId = await newAccount(tenantId, "Acme Dental", "acmedental.com");

    const r = await attr.resolveSignalLinkage(tenantId, {
      email: "newvisitor@acmedental.com", // person not in CRM; only the domain matches the account
    });
    expect(r.accountId).toBe(accountId);
    expect(r.contactId).toBeNull();
  });

  it("does NOT derive a domain from a free email provider (fail closed)", async () => {
    const tenantId = await newTenant("free-email");
    // An account literally named after the provider must never be matched from a
    // consumer gmail.com address.
    await newAccount(tenantId, "Gmail", "gmail.com");

    const r = await attr.resolveSignalLinkage(tenantId, {
      email: "someone@gmail.com",
    });
    expect(r.accountId).toBeNull();
    expect(r.contactId).toBeNull();
  });
});

describe("resolveSignalLinkage — tenant-derived alias map (contact email domain)", () => {
  it("matches an account whose domain field is blank via its contacts' email domain", async () => {
    const tenantId = await newTenant("alias-blank");
    const accountId = await newAccount(tenantId, "Bright Smiles", null); // no domain set
    await newContact(tenantId, accountId, "owner@brightsmiles.com");

    const r = await attr.resolveSignalLinkage(tenantId, {
      email: "prospect@brightsmiles.com", // different person, same domain
    });
    expect(r.accountId).toBe(accountId);
  });

  it("fails closed when the domain maps to MORE THAN ONE account in the tenant", async () => {
    const tenantId = await newTenant("alias-ambiguous");
    const a1 = await newAccount(tenantId, "Practice A", null);
    const a2 = await newAccount(tenantId, "Practice B", null);
    await newContact(tenantId, a1, "a@sharedgroup.com");
    await newContact(tenantId, a2, "b@sharedgroup.com");

    const r = await attr.resolveSignalLinkage(tenantId, {
      email: "c@sharedgroup.com",
    });
    expect(r.accountId).toBeNull();
  });

  it("prefers an exact sales_accounts.domain match over the contact-derived map", async () => {
    const tenantId = await newTenant("alias-prefer-account");
    const direct = await newAccount(tenantId, "Direct Co", "directco.com");
    const other = await newAccount(tenantId, "Other Co", null);
    await newContact(tenantId, other, "x@directco.com"); // a contact at a DIFFERENT account

    const r = await attr.resolveSignalLinkage(tenantId, {
      companyDomain: "directco.com",
    });
    expect(r.accountId).toBe(direct);
  });
});

describe("resolveSignalLinkage — tenant isolation of enrichment", () => {
  it("never resolves an account via a domain that only exists in another tenant", async () => {
    const tenantA = await newTenant("iso-a");
    const tenantB = await newTenant("iso-b");
    const accountB = await newAccount(tenantB, "Tenant B Co", "tenantb.com");
    await newContact(tenantB, accountB, "ceo@tenantb.com");

    // Tenant A has nothing for this domain — must not borrow tenant B's account.
    const r = await attr.resolveSignalLinkage(tenantA, {
      email: "visitor@tenantb.com",
    });
    expect(r.accountId).toBeNull();
    expect(r.contactId).toBeNull();
  });

  it("returns no linkage for a null tenant", async () => {
    const r = await attr.resolveSignalLinkage(null, { email: "anyone@acmedental.com" });
    expect(r).toEqual({ contactId: null, accountId: null });
  });
});
