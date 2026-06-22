/**
 * Integration test for the storage serve route's cross-tenant ACL branch
 * (task #1186). Global / shared-library imagery must load for EVERY
 * authenticated tenant even when the underlying object carries a tenant-private
 * ACL (e.g. it was uploaded by one tenant and then promoted into a global
 * template). The route now consults `isSharedOrGlobalAsset` before returning
 * the cross-tenant 403, so:
 *
 *   - other tenant + shared/global asset  → 200 (serves)
 *   - other tenant + private upload       → 403 (leak protection intact)
 *   - owner tenant                        → 200 (never consults the lookup)
 *   - anonymous (published microsite)     → 200 (never consults the lookup)
 *
 * Object storage, the session pool, and `isSharedOrGlobalAsset` are mocked so
 * the test runs with no storage credentials / database. Requests are injected
 * in-process (the vitest worker pool here can't bind a listening port).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ObjectAclPolicy } from "../lib/objectAcl";

// Drives the ACL the serve route reads for the requested object.
let currentAcl: ObjectAclPolicy | null = null;

vi.mock("../lib/objectStorage", () => {
  class ObjectStorageService {
    async getObjectEntityFile(): Promise<unknown> {
      return { fake: "file" };
    }
    async getObjectAclPolicy(): Promise<ObjectAclPolicy | null> {
      return currentAcl;
    }
    async downloadObject(): Promise<globalThis.Response> {
      return new globalThis.Response("IMAGE-BYTES", {
        headers: { "Content-Type": "image/png" },
      });
    }
  }
  class ObjectNotFoundError extends Error {}
  return { ObjectStorageService, ObjectNotFoundError };
});

// The serve route resolves the requester's tenant via a session lookup on
// pool.query. Returning a session row with a tenantId stands in for a
// logged-in caller; an empty result stands in for anonymous.
let sessionRows: Array<{ sess: string }> = [];

vi.mock("@workspace/db", () => ({
  db: {},
  pool: { query: vi.fn(async () => ({ rows: sessionRows })) },
  lpMediaTable: {},
  tenantsTable: {},
}));

// The shared/global allow-list lookup — exercised on its own in
// libraryScope.sharedAsset.test.ts. Here we only verify the route WIRES it in.
// resolveOwnedTenantIds drives the reciprocal-sibling read scope: the serve
// ACL allows a requester whose owned-tenant set includes the object owner.
const { isSharedOrGlobalAsset, resolveOwnedTenantIds } = vi.hoisted(() => ({
  isSharedOrGlobalAsset: vi.fn(async () => false),
  resolveOwnedTenantIds: vi.fn(async (id: number) => [id]),
}));
vi.mock("../lib/libraryScope", () => ({
  resolveOwnedTenantIds,
  libraryReadablePredicate: vi.fn(),
  isSharedOrGlobalAsset,
}));

import express, { type Request, type Response, type NextFunction } from "express";
import { inject, type InjectResponse } from "../test-utils/injectRequest";
import { SESSION_COOKIE } from "../middleware/requireAuth";
import storageRouter from "./storage";

function fakeLog(req: Request, _res: Response, next: NextFunction): void {
  const noop = () => {};
  (req as Request & { log: unknown }).log = {
    error: noop, warn: noop, info: noop, debug: noop, trace: noop, fatal: noop,
  } as unknown as Request["log"];
  next();
}

/** Inject a GET for a stored object, optionally carrying a session cookie. */
function getObject(opts: { cookie?: string } = {}): Promise<InjectResponse> {
  const app = express();
  app.use(fakeLog);
  // cookie-parser stand-in: the serve route reads req.cookies[SESSION_COOKIE].
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.cookies = opts.cookie ? { [SESSION_COOKIE]: opts.cookie } : {};
    next();
  });
  app.use("/api", storageRouter);
  return inject(app, {
    method: "GET",
    url: "/api/storage/objects/uploads/some-object-uuid",
  });
}

/** Session row for a logged-in caller belonging to `tenantId`. */
function sessionFor(tenantId: number): Array<{ sess: string }> {
  return [{ sess: JSON.stringify({ tenantId, userId: 99 }) }];
}

describe("GET /api/storage/objects/* — shared/global ACL allow-list", () => {
  beforeEach(() => {
    currentAcl = { owner: "tenant:1", visibility: "private" };
    sessionRows = [];
    isSharedOrGlobalAsset.mockClear();
    isSharedOrGlobalAsset.mockResolvedValue(false);
    // Default: no siblings — each tenant owns only itself.
    resolveOwnedTenantIds.mockClear();
    resolveOwnedTenantIds.mockImplementation(async (id: number) => [id]);
  });

  it("serves a shared/global asset to an authenticated NON-owning tenant", async () => {
    sessionRows = sessionFor(2); // requester is tenant 2, object owned by tenant 1
    isSharedOrGlobalAsset.mockResolvedValue(true);

    const res = await getObject({ cookie: "sid-tenant-2" });

    expect(res.status).toBe(200);
    expect(res.text).toBe("IMAGE-BYTES");
    expect(isSharedOrGlobalAsset).toHaveBeenCalledWith("uploads/some-object-uuid");
    // Cross-origin embedding + cookie-keyed caching must survive the allow path.
    expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect(res.headers["vary"]).toBe("Cookie");
  });

  it("still 403s a PRIVATE tenant upload for a non-owning tenant", async () => {
    sessionRows = sessionFor(2);
    isSharedOrGlobalAsset.mockResolvedValue(false);

    const res = await getObject({ cookie: "sid-tenant-2" });

    expect(res.status).toBe(403);
    expect(isSharedOrGlobalAsset).toHaveBeenCalledWith("uploads/some-object-uuid");
    expect(res.headers["vary"]).toBe("Cookie");
  });

  it("serves a sibling-tenant-owned asset (reciprocal library scope)", async () => {
    // Requester is tenant 2; the object is owned by tenant 1; the two are
    // reciprocal siblings (e.g. an account-microsite pair), so the library
    // lists tenant 1's image to tenant 2 and the serve route must match.
    sessionRows = sessionFor(2);
    resolveOwnedTenantIds.mockImplementation(async (id: number) =>
      id === 2 ? [2, 1] : [id],
    );

    const res = await getObject({ cookie: "sid-tenant-2" });

    expect(res.status).toBe(200);
    expect(res.text).toBe("IMAGE-BYTES");
    expect(resolveOwnedTenantIds).toHaveBeenCalledWith(2);
    // Sibling access resolves before the shared/global fallback is consulted.
    expect(isSharedOrGlobalAsset).not.toHaveBeenCalled();
    expect(res.headers["vary"]).toBe("Cookie");
  });

  it("still 403s a non-sibling, non-shared tenant upload", async () => {
    // Requester tenant 2 has NO siblings; object owned by tenant 1.
    sessionRows = sessionFor(2);
    resolveOwnedTenantIds.mockImplementation(async (id: number) => [id]);
    isSharedOrGlobalAsset.mockResolvedValue(false);

    const res = await getObject({ cookie: "sid-tenant-2" });

    expect(res.status).toBe(403);
    expect(resolveOwnedTenantIds).toHaveBeenCalledWith(2);
  });

  it("serves the owning tenant without consulting the allow-list", async () => {
    sessionRows = sessionFor(1); // owner

    const res = await getObject({ cookie: "sid-tenant-1" });

    expect(res.status).toBe(200);
    expect(isSharedOrGlobalAsset).not.toHaveBeenCalled();
  });

  it("serves anonymous callers (public microsite) without consulting the allow-list", async () => {
    sessionRows = []; // no session

    const res = await getObject(); // no cookie

    expect(res.status).toBe(200);
    expect(isSharedOrGlobalAsset).not.toHaveBeenCalled();
    expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
  });
});
