import { and, eq, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db, salesHotlinksTable } from "@workspace/db";

/**
 * Find-or-create an active hotlink for (contactId, pageId). Reactivates a
 * soft-deleted one if present. Shared by the campaign send/test/preview paths
 * and the personalized-link export flow so recipients always get a real,
 * working personalized link rather than an empty `{{microsite_url}}` placeholder.
 *
 * NOTE: caller is responsible for validating that the page is published
 * before calling — we don't gate here so that draft-page previews still work.
 * Both contactId and pageId must originate from tenant-filtered lookups in the
 * caller; passing the tenantId only stamps the row on insert.
 */
export async function ensureHotlinkForContact(
  tenantId: number,
  contactId: number,
  pageId: number,
  sfdcContactId: string | null,
): Promise<{ id: number; token: string }> {
  // Fast path: an existing row for this (contact, page) — reactivate if soft-deleted.
  const [existing] = await db
    .select({ id: salesHotlinksTable.id, token: salesHotlinksTable.token, isActive: salesHotlinksTable.isActive })
    .from(salesHotlinksTable)
    .where(and(
      eq(salesHotlinksTable.contactId, contactId),
      eq(salesHotlinksTable.pageId, pageId),
    ))
    .limit(1);
  if (existing) {
    if (!existing.isActive) {
      await db.update(salesHotlinksTable)
        .set({ isActive: true })
        .where(eq(salesHotlinksTable.id, existing.id));
    }
    return { id: existing.id, token: existing.token };
  }
  // Insert with ON CONFLICT on the partial unique index `(contact_id, page_id)`
  // (migration 0017). The DO UPDATE is a no-op SET that still returns the
  // existing row so concurrent callers all see the same token.
  let token = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = randomBytes(12).toString("base64url").slice(0, 16);
    const [clash] = await db.select({ id: salesHotlinksTable.id })
      .from(salesHotlinksTable)
      .where(eq(salesHotlinksTable.token, candidate))
      .limit(1);
    if (!clash) { token = candidate; break; }
  }
  if (!token) throw new Error("Failed to generate unique hotlink token");
  const [row] = await db.insert(salesHotlinksTable)
    .values({ tenantId, token, contactId, sfdcContactId, pageId })
    .onConflictDoUpdate({
      target: [salesHotlinksTable.contactId, salesHotlinksTable.pageId],
      targetWhere: sql`contact_id IS NOT NULL`,
      set: { isActive: true },
    })
    .returning({ id: salesHotlinksTable.id, token: salesHotlinksTable.token });
  return { id: row.id, token: row.token };
}
