/**
 * Hermetic integration coverage for the centralized signal→account/contact
 * matcher and the retroactive v2 backfill (task: "Add automated tests for
 * signal→account/contact matching").
 *
 * `resolveSignalLinkage` and the v2 backfill are the single source of truth for
 * attribution across every ingest path. These tests lock in the critical
 * guarantees so they can never silently regress:
 *   - tenant-scoping: the same email / LinkedIn / domain / name in two tenants
 *     must NEVER leak attribution across tenants
 *   - fail-closed on a null tenant (returns no linkage)
 *   - exact / canonical matching, NEVER fuzzy
 *   - JS `normalizeLinkedinUrl` and the SQL canonicalizer agree (the subtle bug:
 *     the SQL must KEEP THE PATH, not collapse every profile to `linkedin.com`)
 *   - backfill: re-resolution, dangling-pointer cleanup, unambiguity
 *     (HAVING count = 1), and idempotency on a second run
 *
 * This must NOT touch prod Neon: dev's NEON_DATABASE_URL points at production,
 * and `@workspace/db`'s pool binds it at import time, so we stand up our OWN
 * throwaway Postgres and repoint the env at it BEFORE the first import. The
 * schema is built straight from the drizzle definitions via `drizzle-kit push`
 * (the full migration set can't be replayed on a blank DB), and the
 * migration-only `_schema_migration_markers` table — which is NOT in the drizzle
 * schema — is created by hand so the backfill's one-shot gate works.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { startEphemeralPg, type EphemeralPg } from "../test-utils/ephemeralPg";

type Pg = typeof import("@workspace/db");
type SignalAttr = typeof import("./signalAttribution");
let pgMod: Pg;
let attr: SignalAttr;

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

  // The one-shot marker table is created by raw SQL migrations, not the drizzle
  // schema, so `push` never makes it. The v2 backfill gates on it.
  await pgMod.pool.query(`
    CREATE TABLE IF NOT EXISTS _schema_migration_markers (
      key text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}, 120_000);

afterAll(async () => {
  await pgMod?.pool.end().catch(() => {});
  epg?.stop();
});

// ── seed helpers ───────────────────────────────────────────────────────────

async function newTenant(label: string): Promise<number> {
  const uniq = `${label}-${randomUUID().slice(0, 8)}`;
  const r = await pgMod.pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ($1, $2, 'active', '{}'::jsonb) RETURNING id`,
    [`T ${uniq}`, `t-${uniq}`],
  );
  return r.rows[0].id;
}

async function newAccount(
  tenantId: number,
  opts: { name: string; domain?: string | null },
): Promise<number> {
  const r = await pgMod.pool.query<{ id: number }>(
    `INSERT INTO sales_accounts (tenant_id, name, domain, status)
     VALUES ($1, $2, $3, 'prospect') RETURNING id`,
    [tenantId, opts.name, opts.domain ?? null],
  );
  return r.rows[0].id;
}

async function newContact(
  tenantId: number,
  opts: { email?: string | null; linkedinUrl?: string | null; accountId?: number | null },
): Promise<number> {
  const r = await pgMod.pool.query<{ id: number }>(
    `INSERT INTO sales_contacts (tenant_id, account_id, first_name, last_name, email, linkedin_url, status)
     VALUES ($1, $2, 'F', 'L', $3, $4, 'active') RETURNING id`,
    [tenantId, opts.accountId ?? null, opts.email ?? null, opts.linkedinUrl ?? null],
  );
  return r.rows[0].id;
}

// ── resolveSignalLinkage ─────────────────────────────────────────────────────

describe("resolveSignalLinkage — contact resolution", () => {
  it("matches a contact by case-insensitive email and derives its account", async () => {
    const tenantId = await newTenant("email");
    const accountId = await newAccount(tenantId, { name: "Acme Inc" });
    const contactId = await newContact(tenantId, {
      email: "Jane@Acme.com",
      accountId,
    });

    const res = await attr.resolveSignalLinkage(tenantId, { email: "jane@acme.com" });
    expect(res).toEqual({ contactId, accountId });
  });

  it("matches a contact by canonical LinkedIn URL when no email is given", async () => {
    const tenantId = await newTenant("li");
    const accountId = await newAccount(tenantId, { name: "Globex" });
    const contactId = await newContact(tenantId, {
      // stored in one surface form …
      linkedinUrl: "https://www.linkedin.com/in/jane-doe/",
      accountId,
    });

    // … matched against a DIFFERENT surface form of the SAME profile.
    const res = await attr.resolveSignalLinkage(tenantId, {
      linkedinUrl: "http://linkedin.com/in/jane-doe?utm_source=x",
    });
    expect(res).toEqual({ contactId, accountId });
  });

  it("prefers email over LinkedIn when both point at different contacts", async () => {
    const tenantId = await newTenant("order");
    const acctA = await newAccount(tenantId, { name: "A Co" });
    const acctB = await newAccount(tenantId, { name: "B Co" });
    const emailContact = await newContact(tenantId, { email: "match@a.com", accountId: acctA });
    await newContact(tenantId, { linkedinUrl: "linkedin.com/in/bee", accountId: acctB });

    const res = await attr.resolveSignalLinkage(tenantId, {
      email: "match@a.com",
      linkedinUrl: "linkedin.com/in/bee",
    });
    expect(res).toEqual({ contactId: emailContact, accountId: acctA });
  });
});

describe("resolveSignalLinkage — account resolution", () => {
  it("falls back to company domain when no contact matches", async () => {
    const tenantId = await newTenant("domain");
    const accountId = await newAccount(tenantId, { name: "Initech", domain: "initech.com" });

    const res = await attr.resolveSignalLinkage(tenantId, {
      email: "stranger@nowhere.test",
      companyDomain: "https://www.initech.com/careers",
    });
    expect(res).toEqual({ contactId: null, accountId });
  });

  it("falls back to exact company name when no contact and no domain match", async () => {
    const tenantId = await newTenant("name");
    const accountId = await newAccount(tenantId, { name: "Umbrella Corp" });

    const res = await attr.resolveSignalLinkage(tenantId, {
      companyName: "  umbrella corp ",
    });
    expect(res).toEqual({ contactId: null, accountId });
  });
});

describe("resolveSignalLinkage — fail-closed & tenant scoping", () => {
  it("returns no linkage for a null/undefined tenant (never a global lookup)", async () => {
    const tenantId = await newTenant("global");
    const accountId = await newAccount(tenantId, { name: "Leaky", domain: "leaky.com" });
    await newContact(tenantId, { email: "ceo@leaky.com", accountId });

    expect(await attr.resolveSignalLinkage(null, { email: "ceo@leaky.com" })).toEqual({
      contactId: null,
      accountId: null,
    });
    expect(await attr.resolveSignalLinkage(undefined, { email: "ceo@leaky.com" })).toEqual({
      contactId: null,
      accountId: null,
    });
  });

  it("never matches another tenant's contact/account with the same identity", async () => {
    const tenantA = await newTenant("scope-a");
    const tenantB = await newTenant("scope-b");
    // Same email, LinkedIn, domain, and name exist in BOTH tenants.
    const acctA = await newAccount(tenantA, { name: "Shared LLC", domain: "shared.com" });
    const acctB = await newAccount(tenantB, { name: "Shared LLC", domain: "shared.com" });
    const contactA = await newContact(tenantA, {
      email: "same@shared.com",
      linkedinUrl: "linkedin.com/in/same",
      accountId: acctA,
    });
    const contactB = await newContact(tenantB, {
      email: "same@shared.com",
      linkedinUrl: "linkedin.com/in/same",
      accountId: acctB,
    });

    const resA = await attr.resolveSignalLinkage(tenantA, { email: "same@shared.com" });
    expect(resA).toEqual({ contactId: contactA, accountId: acctA });
    const resB = await attr.resolveSignalLinkage(tenantB, { email: "same@shared.com" });
    expect(resB).toEqual({ contactId: contactB, accountId: acctB });

    // Domain/name fallbacks are tenant-scoped too.
    const resDomA = await attr.resolveSignalLinkage(tenantA, { companyDomain: "shared.com" });
    expect(resDomA.accountId).toBe(acctA);
    const resNameB = await attr.resolveSignalLinkage(tenantB, { companyName: "Shared LLC" });
    expect(resNameB.accountId).toBe(acctB);
  });

  it("returns no linkage when nothing matches", async () => {
    const tenantId = await newTenant("nomatch");
    await newAccount(tenantId, { name: "Real Co", domain: "real.com" });

    expect(
      await attr.resolveSignalLinkage(tenantId, {
        email: "ghost@ghost.test",
        linkedinUrl: "linkedin.com/in/ghost",
        companyDomain: "ghost.test",
        companyName: "Ghost Co",
      }),
    ).toEqual({ contactId: null, accountId: null });
  });
});

describe("resolveSignalLinkage — ambiguous matches (LIMIT 1, not fail-closed)", () => {
  // The runtime matcher uses `.limit(1)`, so — UNLIKE the v2 backfill, which
  // skips ambiguous rows via `HAVING count(*) = 1` — it deterministically
  // returns ONE of the colliding rows rather than failing closed. These tests
  // lock that contract in (a future change to "fail closed on ambiguity" would
  // have to update them deliberately). We assert the result is one of the real
  // candidates (never null, never a different tenant's row).

  it("contact: duplicate emails in one tenant resolve to one of the colliding contacts", async () => {
    const tenantId = await newTenant("ambig-contact");
    const accountId = await newAccount(tenantId, { name: "Dup Co" });
    const c1 = await newContact(tenantId, { email: "dup@dup.co", accountId });
    const c2 = await newContact(tenantId, { email: "dup@dup.co", accountId });

    const res = await attr.resolveSignalLinkage(tenantId, { email: "dup@dup.co" });
    expect([c1, c2]).toContain(res.contactId);
    expect(res.accountId).toBe(accountId);
  });

  it("account: duplicate domains (no contact) resolve to one of the colliding accounts", async () => {
    const tenantId = await newTenant("ambig-domain");
    const a1 = await newAccount(tenantId, { name: "Dom One", domain: "dup-domain.co" });
    const a2 = await newAccount(tenantId, { name: "Dom Two", domain: "dup-domain.co" });

    const res = await attr.resolveSignalLinkage(tenantId, { companyDomain: "dup-domain.co" });
    expect(res.contactId).toBeNull();
    expect([a1, a2]).toContain(res.accountId);
  });

  it("account: duplicate names (no contact, no domain) resolve to one of the colliding accounts", async () => {
    const tenantId = await newTenant("ambig-name");
    const a1 = await newAccount(tenantId, { name: "Same Name LLC" });
    const a2 = await newAccount(tenantId, { name: "Same Name LLC" });

    const res = await attr.resolveSignalLinkage(tenantId, { companyName: "same name llc" });
    expect(res.contactId).toBeNull();
    expect([a1, a2]).toContain(res.accountId);
  });
});

// ── JS / SQL canonicalizer parity ────────────────────────────────────────────

// MUST mirror `linkedinColExpr` in signalAttribution.ts AND the v2 backfill in
// migrate.ts: strip protocol, www., query/fragment, trailing slash — KEEP THE
// PATH. If this drifts from the JS `normalizeLinkedinUrl`, the parity test below
// fails (the whole point — a mismatch is the mass-misattribution bug).
const SQL_LINKEDIN_CANON =
  "regexp_replace(regexp_replace(regexp_replace(regexp_replace(lower($1), '^https?://', ''), '^www\\.', ''), '[?#].*$', ''), '/+$', '')";

describe("LinkedIn canonicalizer — JS and SQL agree", () => {
  const urls = [
    "https://www.linkedin.com/in/jane-doe",
    "http://www.linkedin.com/in/jane-doe/",
    "https://linkedin.com/in/jane-doe?utm_source=x&trk=y",
    "https://www.linkedin.com/in/jane-doe#about",
    "LinkedIn.com/in/Jane-Doe/",
    "https://www.linkedin.com/company/acme/",
    "https://www.linkedin.com/in/john-roe",
  ];

  it("produces identical canonical forms for representative URLs", async () => {
    for (const url of urls) {
      const jsForm = attr.normalizeLinkedinUrl(url);
      const r = await pgMod.pool.query<{ v: string }>(
        `SELECT ${SQL_LINKEDIN_CANON} AS v`,
        [url],
      );
      expect(r.rows[0].v).toBe(jsForm);
    }
  });

  it("keeps distinct profiles distinct in BOTH forms (never collapses to the bare domain)", async () => {
    const a = "https://www.linkedin.com/in/jane-doe";
    const b = "https://www.linkedin.com/in/john-roe";
    expect(attr.normalizeLinkedinUrl(a)).not.toBe(attr.normalizeLinkedinUrl(b));
    const r = await pgMod.pool.query<{ va: string; vb: string }>(
      `SELECT ${SQL_LINKEDIN_CANON} AS va,
              regexp_replace(regexp_replace(regexp_replace(regexp_replace(lower($2), '^https?://', ''), '^www\\.', ''), '[?#].*$', ''), '/+$', '') AS vb`,
      [a, b],
    );
    expect(r.rows[0].va).not.toBe(r.rows[0].vb);
    expect(r.rows[0].va).not.toBe("linkedin.com");
  });
});

// ── v2 backfill ──────────────────────────────────────────────────────────────

async function newSignal(
  tenantId: number,
  opts: {
    accountId?: number | null;
    contactId?: number | null;
    metadata?: Record<string, unknown>;
  },
): Promise<number> {
  const r = await pgMod.pool.query<{ id: number }>(
    `INSERT INTO sales_signals (tenant_id, account_id, contact_id, type, metadata)
     VALUES ($1, $2, $3, 'page_view', $4::jsonb) RETURNING id`,
    [tenantId, opts.accountId ?? null, opts.contactId ?? null, JSON.stringify(opts.metadata ?? {})],
  );
  return r.rows[0].id;
}

async function signalRow(id: number): Promise<{ account_id: number | null; contact_id: number | null }> {
  const r = await pgMod.pool.query<{ account_id: number | null; contact_id: number | null }>(
    `SELECT account_id, contact_id FROM sales_signals WHERE id = $1`,
    [id],
  );
  return r.rows[0];
}

describe("runSignalAttributionBackfillV2", () => {
  // Each test owns its data; clear the one-shot marker so the pass actually runs.
  beforeEach(async () => {
    await pgMod.pool.query(`DELETE FROM _schema_migration_markers WHERE key = 'sales_signal_attribution_backfill_v2'`);
  });

  it("re-resolves contact + account by email, LinkedIn, domain, and name", async () => {
    const tenantId = await newTenant("bf-resolve");
    const accountId = await newAccount(tenantId, { name: "Backfill Co", domain: "backfill.co" });
    const contactByEmail = await newContact(tenantId, { email: "ann@backfill.co", accountId });
    const contactByLi = await newContact(tenantId, {
      linkedinUrl: "https://www.linkedin.com/in/bob-li/",
      accountId,
    });

    // 1a: email → contact + derived account
    const sigEmail = await newSignal(tenantId, { metadata: { email: "ANN@backfill.co" } });
    // 1b: canonical LinkedIn → contact + derived account
    const sigLi = await newSignal(tenantId, {
      metadata: { linkedinUrl: "http://linkedin.com/in/bob-li?trk=x" },
    });
    // 2a: account by company domain only
    const sigDomain = await newSignal(tenantId, { metadata: { companyDomain: "www.backfill.co" } });
    // 2b: account by exact company name only
    const sigName = await newSignal(tenantId, { metadata: { companyName: "backfill co" } });

    const result = await attr.runSignalAttributionBackfillV2();
    expect(result.skipped).toBe(false);

    expect(await signalRow(sigEmail)).toEqual({ contact_id: contactByEmail, account_id: accountId });
    expect(await signalRow(sigLi)).toEqual({ contact_id: contactByLi, account_id: accountId });
    expect(await signalRow(sigDomain)).toEqual({ contact_id: null, account_id: accountId });
    expect(await signalRow(sigName)).toEqual({ contact_id: null, account_id: accountId });
  });

  it("clears a dangling contact_id pointer that cannot be re-resolved", async () => {
    const tenantId = await newTenant("bf-dangling");
    // contact_id is a plain integer column (no FK), so it can point at a row that
    // was later deleted. (account_id has an FK + ON DELETE CASCADE, so it can
    // never dangle — deleting the account removes the signal.) With no metadata
    // to re-resolve from, step 3 must null the dangling pointer.
    const sig = await newSignal(tenantId, { contactId: 999_000_002, metadata: {} });

    const result = await attr.runSignalAttributionBackfillV2();
    expect(result.skipped).toBe(false);
    expect(result.danglingContactsCleared).toBeGreaterThanOrEqual(1);

    expect(await signalRow(sig)).toEqual({ contact_id: null, account_id: null });
  });

  it("re-resolves a dangling contact pointer to the live contact by email", async () => {
    const tenantId = await newTenant("bf-redangle");
    const accountId = await newAccount(tenantId, { name: "Redo Co" });
    const contactId = await newContact(tenantId, { email: "carol@redo.co", accountId });
    // contact_id points at a deleted row, but metadata.email can re-resolve it.
    const sig = await newSignal(tenantId, {
      contactId: 999_111_222,
      metadata: { email: "carol@redo.co" },
    });

    await attr.runSignalAttributionBackfillV2();
    expect(await signalRow(sig)).toEqual({ contact_id: contactId, account_id: accountId });
  });

  it("never matches ambiguously (two contacts share an email → HAVING count = 1 skips)", async () => {
    const tenantId = await newTenant("bf-ambig");
    const accountId = await newAccount(tenantId, { name: "Ambig Co" });
    await newContact(tenantId, { email: "dup@ambig.co", accountId });
    await newContact(tenantId, { email: "dup@ambig.co", accountId });
    const sig = await newSignal(tenantId, { metadata: { email: "dup@ambig.co" } });

    await attr.runSignalAttributionBackfillV2();
    // Ambiguous → left unresolved.
    expect(await signalRow(sig)).toEqual({ contact_id: null, account_id: null });
  });

  it("never crosses tenants when resolving (other tenant's contact is ignored)", async () => {
    const tenantA = await newTenant("bf-xt-a");
    const tenantB = await newTenant("bf-xt-b");
    const acctB = await newAccount(tenantB, { name: "Other Co", domain: "other.co" });
    await newContact(tenantB, { email: "eve@other.co", accountId: acctB });
    // Signal in tenant A references an identity that only exists in tenant B.
    const sig = await newSignal(tenantA, { metadata: { email: "eve@other.co", companyDomain: "other.co" } });

    await attr.runSignalAttributionBackfillV2();
    expect(await signalRow(sig)).toEqual({ contact_id: null, account_id: null });
  });

  it("is idempotent: gated by the marker, and the SQL itself makes no further changes", async () => {
    const tenantId = await newTenant("bf-idem");
    const accountId = await newAccount(tenantId, { name: "Idem Co", domain: "idem.co" });
    const contactId = await newContact(tenantId, { email: "frank@idem.co", accountId });
    const sig = await newSignal(tenantId, { metadata: { email: "frank@idem.co" } });

    const first = await attr.runSignalAttributionBackfillV2();
    expect(first.skipped).toBe(false);
    expect(first.contactByEmail).toBeGreaterThanOrEqual(1);
    const after1 = await signalRow(sig);
    expect(after1).toEqual({ contact_id: contactId, account_id: accountId });

    // Second run with the marker present → no-op.
    const second = await attr.runSignalAttributionBackfillV2();
    expect(second.skipped).toBe(true);
    expect(second.contactByEmail).toBe(0);
    expect(await signalRow(sig)).toEqual(after1);

    // Clear the marker and run the SQL again → the work is already done, so it
    // makes NO further changes (the SQL is idempotent in its own right).
    await pgMod.pool.query(`DELETE FROM _schema_migration_markers WHERE key = 'sales_signal_attribution_backfill_v2'`);
    const third = await attr.runSignalAttributionBackfillV2();
    expect(third.skipped).toBe(false);
    expect(third.contactByEmail).toBe(0);
    expect(third.accountByDomain).toBe(0);
    expect(third.accountByName).toBe(0);
    expect(third.danglingAccountsCleared).toBe(0);
    expect(third.danglingContactsCleared).toBe(0);
    expect(await signalRow(sig)).toEqual(after1);
  });
});
