/**
 * Task #1206 — protect team-member headshots from AI reuse.
 *
 * End-to-end against the REAL Postgres pool (no TCP socket — requests are
 * injected in-process, mirroring blockCatalog.integration.test.ts). Verifies
 * the full contract:
 *
 *   (a) Saving a `team_member` library item with a photo URL auto-tags the
 *       matching `lp_media` row with the reserved `team-photo` tag, tenant-
 *       scoped and idempotent (preserving existing tags).
 *   (b) A `team-photo`-tagged image is EXCLUDED from the AI image catalog
 *       (`fetchMediaCatalog().images`) while remaining in `allImages`, and
 *       `sanitizeAIImageUrls` CLEARS it if the model assigns it to a hero.
 *   (c) The "Meet the Team" block still resolves the saved headshot via
 *       `reconcileTeamMemberPhotos`, so excluding the tag does not break the
 *       team section.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dbAvailable } from "../../test-utils/dbAvailable";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import type { AuthUser } from "../../middleware/requireAuth";
import { inject } from "../../test-utils/injectRequest";
import libraryRouter from "./library";
import {
  fetchMediaCatalog,
  sanitizeAIImageUrls,
  reconcileTeamMemberPhotos,
  type TeamMember,
} from "./generate-page";

const TENANT_SLUG = `it-teamphoto-${Date.now()}`;
const HEADSHOT_URL = `/api/storage/objects/uploads/it-headshot-${randomUUID()}.jpg`;
const OTHER_URL = `/api/storage/objects/uploads/it-other-${randomUUID()}.jpg`;

let tenantId: number;
let app: Express;

async function cleanup(): Promise<void> {
  if (tenantId) {
    await pool.query(`DELETE FROM lp_library_items WHERE tenant_id = $1`, [tenantId]).catch(() => {});
    await pool.query(`DELETE FROM lp_media WHERE tenant_id = $1`, [tenantId]).catch(() => {});
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]).catch(() => {});
  }
}

async function mediaTags(url: string): Promise<string[]> {
  const r = await pool.query<{ tags: unknown }>(
    `SELECT tags FROM lp_media WHERE tenant_id = $1 AND url = $2`,
    [tenantId, url],
  );
  const tags = r.rows[0]?.tags;
  return Array.isArray(tags) ? (tags as string[]) : [];
}

beforeAll(async () => {
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ('IT TeamPhoto Tenant', $1, 'active', '{"industry":"generic"}'::jsonb)
     RETURNING id`,
    [TENANT_SLUG],
  );
  tenantId = t.rows[0].id;

  // A pre-existing headshot media row carrying an UNRELATED tag, so we can prove
  // the merge preserves existing tags rather than overwriting them.
  await pool.query(
    `INSERT INTO lp_media (tenant_id, title, url, media_type, mime_type, tags)
     VALUES ($1, 'Headshot', $2, 'image', 'image/jpeg', '["portrait"]'::jsonb)`,
    [tenantId, HEADSHOT_URL],
  );
  // An ordinary library image that must remain selectable by the AI.
  await pool.query(
    `INSERT INTO lp_media (tenant_id, title, url, media_type, mime_type, tags)
     VALUES ($1, 'Office', $2, 'image', 'image/jpeg', '[]'::jsonb)`,
    [tenantId, OTHER_URL],
  );

  // Inject req.authUser directly (the library router reads tenant from it via
  // getTenantId) so no session/OAuth round-trip is needed.
  const authUser: AuthUser = {
    userId: 999100001,
    email: "it@example.com",
    name: "IT",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.authUser = authUser;
    next();
  });
  app.use("/api", libraryRouter);
});

afterAll(async () => {
  await cleanup();
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("Task #1206 — team headshots reserved from AI reuse", () => {
  it("(a) auto-tags the headshot media row on team_member create, preserving existing tags", async () => {
    const res = await inject(app, {
      method: "POST",
      url: "/api/lp/library/team_member",
      body: { name: "Jane Doe", content: { name: "Jane Doe", role: "Lead", email: "jane@acme.com", photo: HEADSHOT_URL } },
    });
    expect(res.status).toBe(200);

    const tags = await mediaTags(HEADSHOT_URL);
    expect(tags).toContain("team-photo");
    // Existing tag is preserved, not clobbered.
    expect(tags).toContain("portrait");
  });

  it("(a) tagging is idempotent — re-saving the same photo does not duplicate the tag", async () => {
    await inject(app, {
      method: "POST",
      url: "/api/lp/library/team_member",
      body: { name: "Jane Doe", content: { name: "Jane Doe", role: "Lead", email: "jane@acme.com", photo: HEADSHOT_URL } },
    });
    const tags = await mediaTags(HEADSHOT_URL);
    expect(tags.filter((t) => t === "team-photo")).toHaveLength(1);
  });

  it("(b) excludes the team headshot from the AI catalog but keeps it in allImages", async () => {
    const { images, allImages } = await fetchMediaCatalog(tenantId);
    const inCatalog = images.some((i) => i.url === HEADSHOT_URL);
    const inAll = allImages.some((i) => i.url === HEADSHOT_URL);
    const otherInCatalog = images.some((i) => i.url === OTHER_URL);
    expect(inCatalog).toBe(false); // never offered to the AI for hero/feature/etc.
    expect(inAll).toBe(true); // still known to the sanitizer (so it can clear it)
    expect(otherInCatalog).toBe(true); // ordinary images stay selectable
  });

  it("(b) sanitizeAIImageUrls clears a team headshot the model assigned to a hero", async () => {
    const { allImages } = await fetchMediaCatalog(tenantId);
    const blocks = [{ type: "hero", props: { imageUrl: HEADSHOT_URL } }];
    const cleaned = sanitizeAIImageUrls(blocks, allImages) as Array<{ props: { imageUrl: string } }>;
    expect(cleaned[0].props.imageUrl).toBe("");
  });

  it("(c) the Meet the Team block still resolves the saved headshot", () => {
    const team: TeamMember[] = [
      { name: "Jane Doe", role: "Lead", email: "jane@acme.com", photo: HEADSHOT_URL },
    ];
    const block = { type: "dso-meet-team", props: { members: [{ name: "Jane Doe", email: "jane@acme.com", photo: "" }] } };
    reconcileTeamMemberPhotos([block], team);
    expect((block.props.members[0] as { photo: string }).photo).toBe(HEADSHOT_URL);
  });

  it("(a) updating a team member's photo tags the new headshot", async () => {
    // Create with one photo, then PUT a different photo and assert the new row
    // gets tagged. Use the OTHER_URL as the replacement headshot.
    const created = await inject(app, {
      method: "POST",
      url: "/api/lp/library/team_member",
      body: { name: "John Smith", content: { name: "John Smith", photo: HEADSHOT_URL } },
    });
    const id = (created.json as { id: number }).id;
    const res = await inject(app, {
      method: "PUT",
      url: `/api/lp/library/team_member/${id}`,
      body: { name: "John Smith", content: { name: "John Smith", photo: OTHER_URL } },
    });
    expect(res.status).toBe(200);
    const tags = await mediaTags(OTHER_URL);
    expect(tags).toContain("team-photo");
  });
});
