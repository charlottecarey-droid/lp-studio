/**
 * Integration tests for per-form Salesforce lead write-back from a form submit.
 *
 * After the client_credentials → one-click OAuth migration, form submissions
 * create SFDC Leads exclusively through the tenant's active OAuth connection via
 * `sfdcService.createLead`. These tests guard the per-form behavior the
 * migration had to preserve:
 *   - an active connection ⇒ createLead is called with the submitted lead;
 *   - perFormSalesforce.enabled === false ⇒ the connection is never looked up
 *     and createLead is skipped;
 *   - per-form field mappings are layered LAST into customFields, so they
 *     override the structured/UTM-default values.
 *
 * The SFDC write-back runs in a post-response `setImmediate`, so we poll a spy
 * (inject() resolves on res.end, before the deferred work finishes). The
 * `sfdcService` singleton is spied directly (leads.ts imports the same
 * instance), and everything else runs against a HERMETIC throwaway Postgres so
 * we never touch prod and the page/lead inserts + field-mapping query are real.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { dbAvailable } from "../../test-utils/dbAvailable";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { inject, type InjectResponse } from "../../test-utils/injectRequest";
import { startEphemeralPg, type EphemeralPg } from "../../test-utils/ephemeralPg";

type Pg = typeof import("@workspace/db");
let pgMod: Pg;
type SfdcMod = typeof import("../../lib/sfdc-service");
let sfdcMod: SfdcMod;

let epg: EphemeralPg;
let app: Express;
let tenantId: number;

interface CreateLeadParams {
  firstName?: string;
  lastName: string;
  email?: string;
  company?: string;
  customFields?: Record<string, unknown>;
}

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

function submit(body: unknown): Promise<InjectResponse> {
  return inject(app, { method: "POST", url: "/lp/leads", body });
}

async function seedPage(): Promise<number> {
  const { pool } = pgMod;
  const uniq = randomUUID().slice(0, 8);
  const p = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, status)
     VALUES ($1, $2, $3, 'published') RETURNING id`,
    [tenantId, `SF Page ${uniq}`, `sf-page-${uniq}`],
  );
  return p.rows[0].id;
}

/** Seed a per-page notification row carrying the form's salesforceConfig. */
async function seedNotification(pageId: number, salesforceConfig: unknown): Promise<void> {
  await pgMod.pool.query(
    `INSERT INTO lp_form_notifications (page_id, salesforce_config)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (page_id) DO UPDATE SET salesforce_config = EXCLUDED.salesforce_config`,
    [pageId, JSON.stringify(salesforceConfig)],
  );
}

/** Wait (bounded) for the deferred SFDC write-back to invoke createLead. */
async function waitForCalls(spy: { mock: { calls: unknown[] } }, atLeast = 1, timeoutMs = 4000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (spy.mock.calls.length >= atLeast) return;
    await new Promise((r) => setTimeout(r, 25));
  }
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
    throw new Error(`drizzle-kit push failed (status ${push.status}):\n${push.stdout}\n${push.stderr}`);
  }

  pgMod = await import("@workspace/db");
  sfdcMod = await import("../../lib/sfdc-service");
  const requireAuth = await import("../../middleware/requireAuth");
  const leadsRouter = (await import("./leads")).default;

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth.optionalAuth);
  app.use(leadsRouter);

  const { pool } = pgMod;
  const uniq = randomUUID().slice(0, 8);
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status) VALUES ($1, $2, 'active') RETURNING id`,
    [`IT SF Sync ${uniq}`, `it-sf-sync-${uniq}`],
  );
  tenantId = t.rows[0].id;
}, 120_000);

afterAll(async () => {
  vi.restoreAllMocks();
  await pgMod?.pool.end().catch(() => {});
  epg?.stop();
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("form-lead Salesforce write-back", () => {
  it("creates a Lead through the active OAuth connection on submit", async () => {
    const pageId = await seedPage();
    await seedNotification(pageId, { enabled: true });

    const getConn = vi
      .spyOn(sfdcMod.sfdcService, "getActiveConnection")
      .mockResolvedValue({ id: 4242, instanceUrl: "https://acme.my.salesforce.com" });
    const createLead = vi
      .spyOn(sfdcMod.sfdcService, "createLead")
      .mockResolvedValue({ id: "00Q000000000001", success: true });

    try {
      const res = await submit({
        pageId,
        fields: { first_name: "Ada", last_name: "Lovelace", email: "ada@compute.io", company: "Analytical Engines" },
      });
      expect(res.status).toBe(201);

      await waitForCalls(createLead);
      expect(getConn).toHaveBeenCalledWith(tenantId);
      expect(createLead).toHaveBeenCalledTimes(1);
      const [connId, params] = createLead.mock.calls[0] as [number, CreateLeadParams];
      expect(connId).toBe(4242);
      expect(params.firstName).toBe("Ada");
      expect(params.lastName).toBe("Lovelace");
      expect(params.email).toBe("ada@compute.io");
      expect(params.company).toBe("Analytical Engines");
    } finally {
      getConn.mockRestore();
      createLead.mockRestore();
    }
  });

  it("skips the connection lookup and createLead when perFormSalesforce.enabled === false", async () => {
    const pageId = await seedPage();
    await seedNotification(pageId, { enabled: false });

    const getConn = vi.spyOn(sfdcMod.sfdcService, "getActiveConnection");
    const createLead = vi.spyOn(sfdcMod.sfdcService, "createLead");

    try {
      const res = await submit({
        pageId,
        fields: { first_name: "Grace", last_name: "Hopper", email: "grace@navy.mil" },
      });
      expect(res.status).toBe(201);

      // Give the deferred work a chance to run, then assert it stayed away.
      await new Promise((r) => setTimeout(r, 500));
      expect(getConn).not.toHaveBeenCalled();
      expect(createLead).not.toHaveBeenCalled();
    } finally {
      getConn.mockRestore();
      createLead.mockRestore();
    }
  });

  it("layers per-form field mappings last so they override the UTM defaults in customFields", async () => {
    const pageId = await seedPage();
    // Map the submitted `company` field onto the SAME SFDC key the utm_source
    // default would populate, proving per-form mappings win the merge.
    await seedNotification(pageId, {
      enabled: true,
      fieldMappings: { company: "utm_source__c", job_title: "Title__c" },
    });

    const getConn = vi
      .spyOn(sfdcMod.sfdcService, "getActiveConnection")
      .mockResolvedValue({ id: 777, instanceUrl: "https://acme.my.salesforce.com" });
    const createLead = vi
      .spyOn(sfdcMod.sfdcService, "createLead")
      .mockResolvedValue({ id: "00Q000000000002", success: true });

    try {
      const res = await submit({
        pageId,
        fields: { last_name: "Turing", email: "alan@bombe.uk", company: "OverrideCo", job_title: "Cryptanalyst" },
        utmSource: "google",
        utmMedium: "cpc",
      });
      expect(res.status).toBe(201);

      await waitForCalls(createLead);
      const [, params] = createLead.mock.calls[0] as [number, CreateLeadParams];
      const cf = params.customFields ?? {};
      // UTM default would have set utm_source__c = "google"; the per-form
      // mapping (company → utm_source__c) is spread last and overrides it.
      expect(cf["utm_source__c"]).toBe("OverrideCo");
      // The non-conflicting per-form mapping is also applied.
      expect(cf["Title__c"]).toBe("Cryptanalyst");
      // A UTM with no per-form override keeps its default mapping.
      expect(cf["utm_medium__c"]).toBe("cpc");
    } finally {
      getConn.mockRestore();
      createLead.mockRestore();
    }
  });

  it("layers per-form mappings that target a STRUCTURED SFDC field so they override it", async () => {
    const pageId = await seedPage();
    // Map submitted fields onto the SAME SFDC keys createLead derives from the
    // structured lead (Company, LeadSource). createLead spreads customFields
    // LAST over its structured body, so these per-form values must win.
    await seedNotification(pageId, {
      enabled: true,
      fieldMappings: { account_name: "Company", channel: "LeadSource" },
    });

    const getConn = vi
      .spyOn(sfdcMod.sfdcService, "getActiveConnection")
      .mockResolvedValue({ id: 909, instanceUrl: "https://acme.my.salesforce.com" });
    const createLead = vi
      .spyOn(sfdcMod.sfdcService, "createLead")
      .mockResolvedValue({ id: "00Q000000000003", success: true });

    try {
      const res = await submit({
        pageId,
        fields: {
          last_name: "Babbage",
          email: "charles@engines.uk",
          company: "StructuredCo",
          account_name: "MappedAccount",
          channel: "Partner Referral",
        },
      });
      expect(res.status).toBe(201);

      await waitForCalls(createLead);
      const [, params] = createLead.mock.calls[0] as [number, CreateLeadParams];
      // The structured `company` is still passed through from the form...
      expect(params.company).toBe("StructuredCo");
      // ...but the per-form mappings carry the structured SFDC keys in
      // customFields, which createLead spreads last to override the structured
      // body (Company → "MappedAccount", LeadSource → "Partner Referral").
      const cf = params.customFields ?? {};
      expect(cf["Company"]).toBe("MappedAccount");
      expect(cf["LeadSource"]).toBe("Partner Referral");
    } finally {
      getConn.mockRestore();
      createLead.mockRestore();
    }
  });
});
