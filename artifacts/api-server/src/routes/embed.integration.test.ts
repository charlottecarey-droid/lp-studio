/**
 * Pins the agenda embed surface end to end against real Postgres:
 *
 *   1. Publish mints an embed_token (opaque, 22-char base64url) and NEVER
 *      rotates it on republish — links printed into a customer's website
 *      must survive edits.
 *   2. GET /embed/agenda/:token 302s into the published /lp/<slug> with
 *      embed=1 plus forwarded utm params + gclid (and nothing else), framing
 *      headers relaxed (helmet's X-Frame-Options stripped, frame-ancestors
 *      set), no-store.
 *   3. Token resolution is host-scoped: the request host must resolve to
 *      the agenda's tenant — another tenant's domain (or an unknown host)
 *      404s, so tokens can't be replayed into a foreign slug namespace.
 *   4. Unknown tokens and unpublished agendas/pages 404 with the friendly
 *      in-iframe HTML, not JSON.
 *   5. The loader (/embed/agenda.js) ships with CORP: cross-origin —
 *      helmet's same-origin default would break the customer's <script>
 *      tag — and is cacheable.
 *
 * Auth: the events router (used to seed + publish) reads req.authUser via
 * getTenantId; the embed router itself must work with NO auth at all, so the
 * test app injects authUser only for /seed-scoped requests.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dbAvailable } from "../test-utils/dbAvailable";
import express, { type Express } from "express";
import { pool } from "@workspace/db";
import { inject } from "../test-utils/injectRequest";
import { invalidateTenantHostCache } from "../lib/tenantHosts";
import eventsRouter from "./sales/events";
import lpPagesRouter from "./lp/pages";
import embedRouter from "./embed";

const STAMP = Date.now();
const TENANT_SLUG = `it-embed-${STAMP}`;
const TENANT_DOMAIN = `it-embed-${STAMP}.example.com`;
const OTHER_TENANT_SLUG = `it-embed-other-${STAMP}`;
const OTHER_TENANT_DOMAIN = `it-embed-other-${STAMP}.example.com`;

let tenantId: number;
let otherTenantId: number;
let accountId: number;
let eventId: number;
let agendaId: number;
let app: Express;

async function cleanup(): Promise<void> {
  for (const id of [tenantId, otherTenantId]) {
    if (!id) continue;
    await pool.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_event_agendas WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_event_sessions WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_events WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_accounts WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
  }
  invalidateTenantHostCache();
}

beforeAll(async () => {
  if (!dbAvailable) return;
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, domain, settings)
     VALUES ('IT Embed Tenant', $1, 'active', $2, '{"industry":"generic"}'::jsonb)
     RETURNING id`,
    [TENANT_SLUG, TENANT_DOMAIN],
  );
  tenantId = t.rows[0].id;
  const t2 = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, domain, settings)
     VALUES ('IT Embed Other Tenant', $1, 'active', $2, '{"industry":"generic"}'::jsonb)
     RETURNING id`,
    [OTHER_TENANT_SLUG, OTHER_TENANT_DOMAIN],
  );
  otherTenantId = t2.rows[0].id;
  // The host→tenant cache may hold a snapshot from another suite in this
  // worker that predates these tenants.
  invalidateTenantHostCache();

  const a = await pool.query<{ id: number }>(
    `INSERT INTO sales_accounts (tenant_id, name, industry) VALUES ($1, 'Procore Test Co', 'Construction') RETURNING id`,
    [tenantId],
  );
  accountId = a.rows[0].id;

  app = express();
  app.use(express.json());
  // Simulate helmet: every response starts with the restrictive header the
  // embed routes must strip. Registered BEFORE the routers, like app.ts.
  app.use((_req, res, next) => {
    res.set("X-Frame-Options", "SAMEORIGIN");
    next();
  });
  // authUser hydration for the seeding routes only — the embed router must
  // never depend on it.
  app.use((req, _res, next) => {
    if (!req.url.startsWith("/embed/")) {
      req.authUser = { tenantId } as typeof req.authUser;
    }
    next();
  });
  app.use(eventsRouter);
  app.use(lpPagesRouter);
  app.use(embedRouter);

  const eventRes = await inject(app, {
    method: "POST",
    url: "/events",
    body: { name: "Groundbreak 2026", location: "Austin, TX", startDate: "2026-10-20", endDate: "2026-10-21" },
  });
  expect(eventRes.status).toBe(200);
  eventId = (eventRes.json as { event: { id: number } }).event.id;

  const sess = await inject(app, {
    method: "POST",
    url: `/events/${eventId}/sessions`,
    body: { title: "Opening keynote", day: "2026-10-20", startTime: "09:00", endTime: "10:00", tags: { industries: ["Construction"] } },
  });
  expect(sess.status).toBe(200);

  const agendaRes = await inject(app, {
    method: "POST",
    url: `/events/${eventId}/agendas`,
    body: { accountId, attendeeRoles: [] },
  });
  expect(agendaRes.status).toBe(200);
  agendaId = (agendaRes.json as { agenda: { id: number } }).agenda.id;
}, 30_000);

afterAll(async () => {
  await cleanup();
});

describe.skipIf(!dbAvailable)("agenda embed surface", () => {
  let embedToken: string;
  let pageSlug: string;
  let pageId: number;

  it("publish mints an embed token and returns it", async () => {
    const res = await inject(app, { method: "POST", url: `/agendas/${agendaId}/publish` });
    expect(res.status).toBe(200);
    const body = res.json as { slug: string; embedToken: string; pageId: number };
    pageSlug = body.slug;
    pageId = body.pageId;
    embedToken = body.embedToken;
    // 16 random bytes → 22 base64url chars, no padding.
    expect(embedToken).toMatch(/^[A-Za-z0-9_-]{22}$/);

    const row = await pool.query<{ embed_token: string }>(
      `SELECT embed_token FROM sales_event_agendas WHERE id = $1`,
      [agendaId],
    );
    expect(row.rows[0].embed_token).toBe(embedToken);
  });

  it("republish keeps the token stable — customer-site links never break", async () => {
    const res = await inject(app, { method: "POST", url: `/agendas/${agendaId}/publish` });
    expect(res.status).toBe(200);
    expect((res.json as { embedToken: string }).embedToken).toBe(embedToken);
  });

  it("redirects into the published page with embed=1, forwarding only campaign params", async () => {
    const res = await inject(app, {
      method: "GET",
      url: `/embed/agenda/${embedToken}?utm_source=procore&utm_campaign=groundbreak&gclid=g123&lpvh=900&evil=1&reviewToken=x`,
      headers: { host: TENANT_DOMAIN },
    });
    expect(res.status).toBe(302);
    const location = String(res.headers.location);
    const url = new URL(location, "https://placeholder.invalid");
    expect(url.pathname).toBe(`/lp/${pageSlug}`);
    expect(url.searchParams.get("embed")).toBe("1");
    expect(url.searchParams.get("utm_source")).toBe("procore");
    expect(url.searchParams.get("utm_campaign")).toBe("groundbreak");
    expect(url.searchParams.get("gclid")).toBe("g123");
    // lpvh rides the allowlist too: the viewer sizes 100vh against the HOST
    // page's height with it, and against the (growing) iframe without it.
    expect(url.searchParams.get("lpvh")).toBe("900");
    // Anything not on the allowlist is dropped — the redirect must not be a
    // general query-string relay into our page URLs.
    expect(url.searchParams.get("evil")).toBeNull();
    expect(url.searchParams.get("reviewToken")).toBeNull();

    // Framing contract: helmet's header stripped, frame-ancestors set, and
    // never cached so unpublish takes effect on the next load.
    expect(res.headers["x-frame-options"]).toBeUndefined();
    expect(String(res.headers["content-security-policy"])).toContain("frame-ancestors");
    expect(String(res.headers["cache-control"])).toContain("no-store");
  });

  it("404s the token on another tenant's host (and on unknown hosts)", async () => {
    for (const host of [OTHER_TENANT_DOMAIN, "unmapped.example.com"]) {
      const res = await inject(app, {
        method: "GET",
        url: `/embed/agenda/${embedToken}`,
        headers: { host },
      });
      expect(res.status).toBe(404);
      // Friendly HTML for the iframe, not JSON — and it signals the loader
      // so a data-hide fallback (the site's RainFocus widget) is restored.
      expect(String(res.headers["content-type"])).toContain("text/html");
      expect(res.text).toContain("lp-embed-missing");
    }
  });

  it("404s unknown tokens", async () => {
    const res = await inject(app, {
      method: "GET",
      url: `/embed/agenda/AAAAAAAAAAAAAAAAAAAAAA`,
      headers: { host: TENANT_DOMAIN },
    });
    expect(res.status).toBe(404);
  });

  it("stores a custom embed link-param per event, validated and resettable", async () => {
    // Custom name (RainFocus squats on ?agenda for real customer sites).
    const ok = await inject(app, { method: "PATCH", url: `/events/${eventId}`, body: { embedParam: "dandy_agenda" } });
    expect(ok.status).toBe(200);
    expect((ok.json as { event: { embedParam: string } }).event.embedParam).toBe("dandy_agenda");

    // Not URL-param-safe → rejected, value untouched.
    const bad = await inject(app, { method: "PATCH", url: `/events/${eventId}`, body: { embedParam: "has spaces&stuff" } });
    expect(bad.status).toBe(400);
    const row = await pool.query<{ embed_param: string }>(`SELECT embed_param FROM sales_events WHERE id = $1`, [eventId]);
    expect(row.rows[0].embed_param).toBe("dandy_agenda");

    // Empty resets to NULL = loader default.
    const reset = await inject(app, { method: "PATCH", url: `/events/${eventId}`, body: { embedParam: "" } });
    expect(reset.status).toBe(200);
    expect((reset.json as { event: { embedParam: string | null } }).event.embedParam).toBeNull();
  });

  it("stores the fallback selector and default agenda, minting a missing token", async () => {
    const sel = await inject(app, { method: "PATCH", url: `/events/${eventId}`, body: { embedHideSelector: "#rainfocus-agenda" } });
    expect(sel.status).toBe(200);
    expect((sel.json as { event: { embedHideSelector: string } }).event.embedHideSelector).toBe("#rainfocus-agenda");

    // Wipe the token to simulate an agenda published before the embed
    // feature — choosing it as default must mint one.
    await pool.query(`UPDATE sales_event_agendas SET embed_token = NULL WHERE id = $1`, [agendaId]);
    const def = await inject(app, { method: "PATCH", url: `/events/${eventId}`, body: { embedDefaultAgendaId: agendaId } });
    expect(def.status).toBe(200);
    expect((def.json as { event: { embedDefaultAgendaId: number } }).event.embedDefaultAgendaId).toBe(agendaId);
    const minted = await pool.query<{ embed_token: string }>(`SELECT embed_token FROM sales_event_agendas WHERE id = $1`, [agendaId]);
    expect(minted.rows[0].embed_token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    // The freshly minted token is live for the rest of the suite.
    embedToken = minted.rows[0].embed_token;

    // A nonexistent agenda can't be the default.
    const bad = await inject(app, { method: "PATCH", url: `/events/${eventId}`, body: { embedDefaultAgendaId: 999999999 } });
    expect(bad.status).toBe(400);
  });

  it("lazy-mints a token on agenda read for pre-embed published agendas", async () => {
    await pool.query(`UPDATE sales_event_agendas SET embed_token = NULL WHERE id = $1`, [agendaId]);
    const res = await inject(app, { method: "GET", url: `/agendas/${agendaId}` });
    expect(res.status).toBe(200);
    const token = (res.json as { agenda: { embedToken: string } }).agenda.embedToken;
    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    // Persisted, not just echoed — the whole point is a stable link.
    const row = await pool.query<{ embed_token: string }>(`SELECT embed_token FROM sales_event_agendas WHERE id = $1`, [agendaId]);
    expect(row.rows[0].embed_token).toBe(token);
    embedToken = token;
  });

  it("serves the loader cross-origin-loadable and cacheable", async () => {
    const res = await inject(app, { method: "GET", url: "/embed/agenda.js" });
    expect(res.status).toBe(200);
    expect(String(res.headers["content-type"])).toContain("javascript");
    // helmet's CORP: same-origin would make the customer's <script src> fail.
    expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect(String(res.headers["cache-control"])).toContain("public");
    expect(res.text).toContain("lp-embed-height");
    // Fallback-coexistence contract: data-hide + the dead-token signal.
    expect(res.text).toContain("data-hide");
    expect(res.text).toContain("lp-embed-missing");
    // Sticky-personalisation contract: tokens persist across linkless
    // return visits and dead ones are forgotten.
    expect(res.text).toContain("lp-embed-token:");
    expect(res.text).toContain("localStorage");
  });

  it("embeds a regular published page by slug, forwarding ALL params for DTR", async () => {
    const res = await inject(app, {
      method: "GET",
      url: `/embed/page/${pageSlug}?utm_source=procore&keyword=roofing&city=Austin`,
      headers: { host: TENANT_DOMAIN },
    });
    expect(res.status).toBe(302);
    const url = new URL(String(res.headers.location), "https://placeholder.invalid");
    expect(url.pathname).toBe(`/lp/${pageSlug}`);
    expect(url.searchParams.get("embed")).toBe("1");
    // Unlike the agenda redirect's utm-allowlist, EVERYTHING forwards —
    // dynamic-text pages resolve {{keyword}}/{{city}} from these.
    expect(url.searchParams.get("keyword")).toBe("roofing");
    expect(url.searchParams.get("city")).toBe("Austin");
    expect(res.headers["x-frame-options"]).toBeUndefined();

    // Wrong host and unknown slug both 404 with the loader signal.
    const wrongHost = await inject(app, { method: "GET", url: `/embed/page/${pageSlug}`, headers: { host: OTHER_TENANT_DOMAIN } });
    expect(wrongHost.status).toBe(404);
    expect(wrongHost.text).toContain("lp-embed-missing");
    const unknown = await inject(app, { method: "GET", url: `/embed/page/not-a-real-slug`, headers: { host: TENANT_DOMAIN } });
    expect(unknown.status).toBe(404);
  });

  it("renders a DIFFERENT page per visitor by token, scoped to the host's tenant", async () => {
    // The whole point of the feature: one installed snippet, a personalized
    // link per account. Mint a token the way the Pages row does.
    const minted = await inject(app, { method: "POST", url: `/lp/pages/${pageId}/embed-token` });
    expect(minted.status).toBe(200);
    const token = (minted.json as { embedToken: string }).embedToken;
    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);

    // Stable: a second call returns the same token, because it is already
    // sitting in links we cannot edit after sending.
    const again = await inject(app, { method: "POST", url: `/lp/pages/${pageId}/embed-token` });
    expect((again.json as { embedToken: string }).embedToken).toBe(token);

    const res = await inject(app, {
      method: "GET",
      url: `/embed/p/${token}?utm_source=email`,
      headers: { host: TENANT_DOMAIN },
    });
    expect(res.status).toBe(302);
    const url = new URL(String(res.headers.location), "https://placeholder.invalid");
    expect(url.pathname).toBe(`/lp/${pageSlug}`);
    expect(url.searchParams.get("embed")).toBe("1");
    expect(url.searchParams.get("utm_source")).toBe("email");
    expect(res.headers["x-frame-options"]).toBeUndefined();

    // A token is not a skeleton key: it only works on its own tenant's host.
    const crossTenant = await inject(app, {
      method: "GET",
      url: `/embed/p/${token}`,
      headers: { host: OTHER_TENANT_DOMAIN },
    });
    expect(crossTenant.status).toBe(404);

    const unknown = await inject(app, {
      method: "GET",
      url: "/embed/p/AAAAAAAAAAAAAAAAAAAAAA",
      headers: { host: TENANT_DOMAIN },
    });
    expect(unknown.status).toBe(404);
    expect(unknown.text).toContain("lp-embed-missing");
  });

  it("refuses an embed link for an unpublished page", async () => {
    await pool.query(`UPDATE lp_pages SET status = 'draft' WHERE id = $1`, [pageId]);
    const res = await inject(app, { method: "POST", url: `/lp/pages/${pageId}/embed-token` });
    expect(res.status).toBe(409);
    await pool.query(`UPDATE lp_pages SET status = 'published' WHERE id = $1`, [pageId]);
  });

  it("serves the page loader with the same cross-origin + fallback contract", async () => {
    const res = await inject(app, { method: "GET", url: "/embed/page.js" });
    expect(res.status).toBe(200);
    expect(String(res.headers["content-type"])).toContain("javascript");
    expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect(res.text).toContain("data-page");
    expect(res.text).toContain("lp-embed-height");
    expect(res.text).toContain("lp-embed-missing");
    // Personalized-link contract: reads a token param, remembers it, and
    // routes to the token endpoint rather than the fixed slug.
    expect(res.text).toContain("lp_page");
    expect(res.text).toContain("/api/embed/p/");
    expect(res.text).toContain("lp-embed-page:");
    // Sends the HOST window's height so 100vh sizing inside the embed
    // resolves against the reader's screen instead of the iframe we then
    // size to fit — that pairing is what feeds back and lands ~3x too tall.
    expect(res.text).toContain("lpvh");
    expect(res.text).toContain("window.innerHeight");
    // data-mode="page" opts a whole-page takeover back into full-height
    // heroes; the default (section) scaling needs no per-page authoring.
    expect(res.text).toContain("data-mode");
    expect(res.text).toContain("lpmode");
  });

  it("404s when the underlying page is unpublished (revoke works)", async () => {
    await pool.query(`UPDATE lp_pages SET status = 'draft' WHERE tenant_id = $1`, [tenantId]);
    const res = await inject(app, {
      method: "GET",
      url: `/embed/agenda/${embedToken}`,
      headers: { host: TENANT_DOMAIN },
    });
    expect(res.status).toBe(404);
    await pool.query(`UPDATE lp_pages SET status = 'published' WHERE tenant_id = $1`, [tenantId]);
  });

  it("404s when the agenda itself is unpublished", async () => {
    await pool.query(`UPDATE sales_event_agendas SET status = 'draft' WHERE id = $1`, [agendaId]);
    const res = await inject(app, {
      method: "GET",
      url: `/embed/agenda/${embedToken}`,
      headers: { host: TENANT_DOMAIN },
    });
    expect(res.status).toBe(404);
  });
});
