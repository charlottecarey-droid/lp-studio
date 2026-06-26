import { and, eq, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db, salesHotlinksTable } from "@workspace/db";
import { isUniqueViolation } from "./dbErrors";

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
  // existing row so concurrent callers racing on the SAME (contact, page) all
  // see the same token.
  //
  // The `token` column has its OWN unique constraint, which ON CONFLICT does
  // NOT absorb (its target is the contact/page index). A SELECT-then-INSERT
  // uniqueness check has a TOCTOU race — two callers can pick the same unused
  // token between the SELECT and the INSERT — so instead we attempt the insert
  // directly and, on a unique violation (23505, the token collision), regenerate
  // a fresh candidate and retry. Astronomically unlikely with random tokens,
  // but now correct under concurrency rather than racy.
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = randomBytes(12).toString("base64url").slice(0, 16);
    try {
      const [row] = await db.insert(salesHotlinksTable)
        .values({ tenantId, token: candidate, contactId, sfdcContactId, pageId })
        .onConflictDoUpdate({
          target: [salesHotlinksTable.contactId, salesHotlinksTable.pageId],
          targetWhere: sql`contact_id IS NOT NULL`,
          set: { isActive: true },
        })
        .returning({ id: salesHotlinksTable.id, token: salesHotlinksTable.token });
      return { id: row.id, token: row.token };
    } catch (err) {
      // Only a unique violation is retryable here — and since the contact/page
      // conflict is already absorbed by ON CONFLICT, a 23505 reaching us is a
      // token collision. Regenerate and retry; rethrow anything else.
      if (isUniqueViolation(err)) { lastErr = err; continue; }
      throw err;
    }
  }
  throw new Error("Failed to generate a unique hotlink token after multiple attempts", { cause: lastErr });
}
