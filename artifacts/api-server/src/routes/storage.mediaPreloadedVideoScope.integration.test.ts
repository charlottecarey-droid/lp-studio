/**
 * Integration test for the preloaded-video tenant scope on GET /api/lp/media.
 *
 * Videos and images share the `lp_media` table. Uploaded rows are scoped by the
 * reciprocal-sibling read ACL (`libraryReadablePredicate`), exercised
 * elsewhere. Separately, the route appends a hardcoded `PRELOADED_VIDEOS`
 * list — the Dandy-branded clip set (digital lab / intraoral scans / doctor
 * testimonials). That list must surface ONLY for the Dandy workspaces (Dandy
 * Enterprise `dandy` + Dandy SMB `dandy-smb`, the pair that also shares the
 * uploaded image library) and NEVER appear in any other tenant's video drawer.
 *
 * @workspace/db and the libraryScope ACL helpers are mocked so the test runs
 * with no database; the real `isProtectedEnterpriseSlug` slug guard runs against
 * the tenant slug we feed in. Requests are injected in-process (the vitest
 * worker pool here can't bind a listening port).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Drives the tenant slug the route resolves before gating preloaded videos.
let tenantSlug: string | null = null;

// Chainable db.select() stand-in: the route runs two selects — the uploaded
// media query terminates in `.orderBy()` (we return no uploads), and the
// tenant-slug query terminates in `.limit()` (we return the slug under test).
vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          orderBy: async () => [] as unknown[],
          limit: async () =>
            tenantSlug == null ? [] : [{ slug: tenantSlug }],
        }),
      }),
    })),
  },
  pool: { query: vi.fn(async () => ({ rows: [] })) },
  lpMediaTable: {},
  tenantsTable: {},
  lpPagesTable: {},
}));

// Read ACL for uploaded media — verified on its own elsewhere. Here we only
// need the route to resolve a tenant scope; the predicate result is ignored by
// the mocked db.select chain above.
vi.mock("../lib/libraryScope", () => ({
  resolveOwnedTenantIds: vi.fn(async (tenantId: number) => [tenantId]),
  libraryReadablePredicate: vi.fn(() => undefined),
  isSharedOrGlobalAsset: vi.fn(async () => false),
}));

import express, { type Request, type Response, type NextFunction } from "express";
import { inject, type InjectResponse } from "../test-utils/injectRequest";
import type { AuthUser } from "../middleware/requireAuth";
import storageRouter from "./storage";

function fakeAuth(tenantId: number) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    (req as Request & { authUser?: AuthUser }).authUser = {
      tenantId,
      userId: 99,
    } as AuthUser;
    next();
  };
}

function fakeLog(req: Request, _res: Response, next: NextFunction): void {
  const noop = () => {};
  (req as Request & { log: unknown }).log = {
    error: noop, warn: noop, info: noop, debug: noop, trace: noop, fatal: noop,
  } as unknown as Request["log"];
  next();
}

interface MediaItem { id: string; isPreloaded: boolean }

async function listVideos(slug: string | null): Promise<MediaItem[]> {
  tenantSlug = slug;
  const app = express();
  app.use(fakeLog);
  app.use(fakeAuth(7));
  app.use("/api", storageRouter);
  const res: InjectResponse = await inject(app, {
    method: "GET",
    url: "/api/lp/media?mediaType=video",
  });
  expect(res.status).toBe(200);
  return (JSON.parse(res.text).items as MediaItem[]) ?? [];
}

describe("GET /api/lp/media — preloaded video tenant scope", () => {
  beforeEach(() => {
    tenantSlug = null;
  });

  it("returns NO preloaded Dandy videos to a non-Dandy tenant", async () => {
    const items = await listVideos("acme-dental");
    expect(items.filter((i) => i.isPreloaded)).toHaveLength(0);
    expect(items.some((i) => i.id.startsWith("preloaded-"))).toBe(false);
  });

  it("returns the preloaded Dandy videos to the Dandy Enterprise tenant", async () => {
    const ids = (await listVideos("dandy")).map((i) => i.id);
    expect(ids).toContain("preloaded-dandy-digital-lab");
    expect(ids).toContain("preloaded-ai-scan-review");
  });

  it("returns the preloaded Dandy videos to the Dandy SMB tenant", async () => {
    const ids = (await listVideos("dandy-smb")).map((i) => i.id);
    expect(ids).toContain("preloaded-dandy-digital-lab");
    expect(ids).toContain("preloaded-ai-scan-review");
  });

  it("returns nothing preloaded when the tenant slug can't be resolved", async () => {
    const items = await listVideos(null);
    expect(items.some((i) => i.id.startsWith("preloaded-"))).toBe(false);
  });
});
