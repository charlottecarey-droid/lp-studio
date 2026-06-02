/**
 * Round-trip guard for the Partner Practices ("new partner") one-pager editor
 * controls added recently:
 *   - an editable testimonials heading (defaults to
 *     "See what <brand> doctors are saying:"), and
 *   - header subtitle controls: subtitleShow (hide the "Brand & DSO name:" line)
 *     plus independent X/Y nudges (subtitleOffsetX / subtitleLineOffsetY).
 *
 * These flow: editor state -> saved layout defaults (sales_layout_defaults via
 * PUT/GET /sales/layout-defaults/:key) -> PDF generator (generateNewPartnerOnePager).
 * Nothing guarded this chain, so a refactor could silently drop the saved values
 * (especially an intentionally-empty heading) or break the PDF output.
 *
 * Two layers are covered:
 *  1. Persistence round-trip — save the partner layout to the real layout-defaults
 *     store and read it back, asserting every new field survives, INCLUDING an
 *     empty-string testimonialsHeading (which must not be dropped/coerced away).
 *     Driven in-process via inject() against the REAL Postgres pool, mirroring
 *     dandyGatedTemplates.integration.test.ts.
 *  2. Generator behavior — feeding the reloaded config through the same mapping
 *     the client wrapper (sales-one-pager.tsx) uses, the PDF must: render a custom
 *     heading; NOT fall back to the brand default when the heading is empty; and
 *     omit the "Brand & DSO name:" subtitle line when subtitleShow=false.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import {
  generateNewPartnerOnePager,
  type NewPartnerContent,
  type NewPartnerOpts,
} from "@workspace/one-pager-types/generators";
import type { jsPDF } from "jspdf";
import { SESSION_COOKIE, optionalAuth, type AuthUser } from "../../middleware/requireAuth";
import { inject, type InjectResponse } from "../../test-utils/injectRequest";
import layoutDefaultsRouter from "./layout-defaults";

const PARTNER_LAYOUT_KEY = "dandy_partner_template_layout";

const TENANT_SLUG = `it-partner-editor-${Date.now()}`;
const SID = `it-partner-editor-${randomUUID()}`;

let tenantId: number;
let app: Express;

function injectSid(opts: { method: string; url: string; sid?: string; body?: unknown }): Promise<InjectResponse> {
  const headers = opts.sid ? { cookie: `${SESSION_COOKIE}=${opts.sid}` } : undefined;
  return inject(app, { method: opts.method, url: opts.url, headers, body: opts.body });
}

function sessJson(u: Partial<AuthUser> & Pick<AuthUser, "userId">): string {
  const full: AuthUser = {
    email: "it@example.com",
    name: "IT",
    avatarUrl: null,
    tenantId: null,
    role: "viewer",
    permissions: {},
    isAdmin: false,
    appUserRole: null,
    ...u,
  };
  return JSON.stringify(full);
}

async function seedSession(sid: string, user: Partial<AuthUser> & Pick<AuthUser, "userId">): Promise<void> {
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire)
     VALUES ($1, $2, now() + interval '1 hour')
     ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
    [sid, sessJson(user)],
  );
}

async function cleanup(): Promise<void> {
  if (tenantId) {
    await pool.query(`DELETE FROM sales_layout_defaults WHERE tenant_id = $1`, [tenantId]).catch(() => {});
  }
  await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [SID]).catch(() => {});
  if (tenantId) await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]).catch(() => {});
}

beforeAll(async () => {
  await cleanup();

  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ('IT Partner Editor Tenant', $1, 'active', '{"industry":"generic"}'::jsonb)
     RETURNING id`,
    [TENANT_SLUG],
  );
  tenantId = t.rows[0].id;

  // sales_campaigns → the layout-defaults PUT/DELETE permission gate.
  await seedSession(SID, {
    userId: 999200001,
    tenantId,
    role: "admin",
    permissions: { sales_campaigns: true },
  });

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(optionalAuth);
  app.use(layoutDefaultsRouter);
});

afterAll(async () => {
  await cleanup();
});

/**
 * The shape the editor's handleSave() persists for the partner template:
 * top-level partner* content fields plus the layout config groups. Only the
 * fields exercised here are spelled out; the rest mirror the editor defaults.
 */
function buildSavedConfig(overrides: {
  partnerTestimonialsHeading: string;
  subtitleShow: boolean;
  subtitleOffsetX: number;
  subtitleLineOffsetY: number;
}): Record<string, unknown> {
  return {
    headerCfg: {
      height: 280,
      splitRatio: 48,
      subtitleShow: overrides.subtitleShow,
      subtitleOffsetX: overrides.subtitleOffsetX,
      subtitleLineOffsetY: overrides.subtitleLineOffsetY,
    },
    bodyCfg: {},
    teamCfg: { show: true },
    footerCfg: { show: true, link: "example.com" },
    partnerHeadline: "Partner with us for predictable dentistry",
    partnerTestimonialsHeading: overrides.partnerTestimonialsHeading,
    partnerIntro: "Custom intro copy",
    partnerFeatures: [],
    partnerStats: [],
    partnerQrUrl: "https://example.com",
  };
}

describe("partner one-pager editor — layout-defaults persistence round-trip", () => {
  it("persists a custom testimonials heading + subtitle controls across save/reload", async () => {
    const config = buildSavedConfig({
      partnerTestimonialsHeading: "Hear from our happy partners:",
      subtitleShow: false,
      subtitleOffsetX: 24,
      subtitleLineOffsetY: -18,
    });

    const put = await injectSid({
      method: "PUT",
      url: `/layout-defaults/${PARTNER_LAYOUT_KEY}`,
      sid: SID,
      body: { config },
    });
    expect([200, 201]).toContain(put.status);

    const get = await injectSid({
      method: "GET",
      url: `/layout-defaults/${PARTNER_LAYOUT_KEY}`,
      sid: SID,
    });
    expect(get.status).toBe(200);
    const reloaded = get.json as Record<string, unknown>;
    const header = reloaded.headerCfg as Record<string, unknown>;

    expect(reloaded.partnerTestimonialsHeading).toBe("Hear from our happy partners:");
    expect(header.subtitleShow).toBe(false);
    expect(header.subtitleOffsetX).toBe(24);
    expect(header.subtitleLineOffsetY).toBe(-18);
  });

  it("preserves an intentionally-empty testimonials heading (does not drop the empty string)", async () => {
    const config = buildSavedConfig({
      partnerTestimonialsHeading: "",
      subtitleShow: true,
      subtitleOffsetX: 0,
      subtitleLineOffsetY: 0,
    });

    const put = await injectSid({
      method: "PUT",
      url: `/layout-defaults/${PARTNER_LAYOUT_KEY}`,
      sid: SID,
      body: { config },
    });
    expect([200, 201]).toContain(put.status);

    const get = await injectSid({
      method: "GET",
      url: `/layout-defaults/${PARTNER_LAYOUT_KEY}`,
      sid: SID,
    });
    expect(get.status).toBe(200);
    const reloaded = get.json as Record<string, unknown>;

    // The empty string must survive verbatim — not become undefined/null, or the
    // editor would re-show the brand default on reload.
    expect(Object.prototype.hasOwnProperty.call(reloaded, "partnerTestimonialsHeading")).toBe(true);
    expect(reloaded.partnerTestimonialsHeading).toBe("");
  });
});

/** Decode the searchable (helvetica) text streams from a rendered jsPDF. */
function searchableText(doc: jsPDF): string {
  return Buffer.from(doc.output("arraybuffer")).toString("latin1");
}

/**
 * Mirror the client wrapper (sales-one-pager.tsx): map a saved layout config into
 * the generator's content + layoutOverrides. `testimonialsHeading` is taken
 * verbatim (string | undefined) so an empty string flows through unchanged.
 */
function buildOpts(saved: Record<string, unknown>): NewPartnerOpts {
  const content: NewPartnerContent = {
    headline: saved.partnerHeadline as string | undefined,
    intro: saved.partnerIntro as string | undefined,
    features: saved.partnerFeatures as Array<{ title: string; desc: string }> | undefined,
    stats: saved.partnerStats as Array<{ value: string; desc: string }> | undefined,
    testimonialsHeading: saved.partnerTestimonialsHeading as string | undefined,
    footerLink: (saved.footerCfg as { link?: string } | undefined)?.link,
  };
  return { logoPng: null, headerImgData: null, layoutOverrides: saved, content };
}

const DSO_NAME = "Acme Group";
const DEFAULT_HEADING_PHRASE = /doctors are saying/i;
// The subtitle renders "<productName> & <dsoName>:" — for the default (Dandy)
// brand that is the distinctive "Dandy & Acme Group" adjacency (the intro mentions
// both words but never adjacent), so it isolates the subtitle line.
const SUBTITLE_LINE = /Dandy & Acme Group/;

describe("partner one-pager generator — testimonials heading + subtitle controls", () => {
  it("renders a custom testimonials heading", async () => {
    const saved = buildSavedConfig({
      partnerTestimonialsHeading: "Hear from our happy partners:",
      subtitleShow: true,
      subtitleOffsetX: 0,
      subtitleLineOffsetY: 0,
    });
    const doc = await generateNewPartnerOnePager(
      DSO_NAME,
      null,
      { w: 0, h: 0 },
      "https://example.com",
      undefined,
      buildOpts(saved),
    );
    expect(searchableText(doc)).toMatch(/Hear from our happy partners/);
  }, 30_000);

  it("does NOT fall back to the brand default heading when the heading is empty", async () => {
    const saved = buildSavedConfig({
      partnerTestimonialsHeading: "",
      subtitleShow: true,
      subtitleOffsetX: 0,
      subtitleLineOffsetY: 0,
    });
    const doc = await generateNewPartnerOnePager(
      DSO_NAME,
      null,
      { w: 0, h: 0 },
      "https://example.com",
      undefined,
      buildOpts(saved),
    );
    expect(searchableText(doc)).not.toMatch(DEFAULT_HEADING_PHRASE);
  }, 30_000);

  it("positive control: an undefined heading DOES render the brand default", async () => {
    // No testimonialsHeading key at all → generator must supply its brand default,
    // proving the empty-string assertion above has teeth (absence is the empty
    // string, not the phrase simply never being drawn).
    const doc = await generateNewPartnerOnePager(
      DSO_NAME,
      null,
      { w: 0, h: 0 },
      "https://example.com",
      undefined,
      { logoPng: null, headerImgData: null },
    );
    expect(searchableText(doc)).toMatch(DEFAULT_HEADING_PHRASE);
  }, 30_000);

  it("omits the 'Brand & DSO name:' subtitle line when subtitleShow=false", async () => {
    const saved = buildSavedConfig({
      partnerTestimonialsHeading: "Hear from our happy partners:",
      subtitleShow: false,
      subtitleOffsetX: 0,
      subtitleLineOffsetY: 0,
    });
    const doc = await generateNewPartnerOnePager(
      DSO_NAME,
      null,
      { w: 0, h: 0 },
      "https://example.com",
      undefined,
      buildOpts(saved),
    );
    expect(searchableText(doc)).not.toMatch(SUBTITLE_LINE);
  }, 30_000);

  it("positive control: the subtitle line IS rendered when subtitleShow=true", async () => {
    const saved = buildSavedConfig({
      partnerTestimonialsHeading: "Hear from our happy partners:",
      subtitleShow: true,
      subtitleOffsetX: 0,
      subtitleLineOffsetY: 0,
    });
    const doc = await generateNewPartnerOnePager(
      DSO_NAME,
      null,
      { w: 0, h: 0 },
      "https://example.com",
      undefined,
      buildOpts(saved),
    );
    expect(searchableText(doc)).toMatch(SUBTITLE_LINE);
  }, 30_000);
});
