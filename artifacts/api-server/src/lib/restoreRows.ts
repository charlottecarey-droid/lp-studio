import { getTableColumns } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "@workspace/db";

/**
 * Undo-delete support.
 *
 * The Sales / Reviews delete endpoints return the full rows they removed so the
 * client can offer an "Undo" toast. When the user clicks Undo, the client POSTs
 * those rows back to a restore endpoint, which re-inserts them with their
 * original primary keys (serial PKs allow explicit ids, and the just-freed ids
 * can't collide with anything created since the sequence only moves forward).
 *
 * Restore is intentionally defensive:
 *   - Only columns that actually exist on the table are kept (unknown keys from
 *     a tampered payload are dropped).
 *   - `overrides` (e.g. tenantId / pageId) are forced onto every row so a
 *     restore can never land a row in another tenant or page.
 *   - `onConflictDoNothing()` makes restore idempotent and means a tampered id
 *     that collides with an existing row is skipped rather than overwriting it.
 *   - Date columns arrive as ISO strings over JSON and are converted back to
 *     Date so timestamps (e.g. a signal's event time) are preserved faithfully.
 */
function sanitizeRowsForRestore<T extends PgTable>(
  table: T,
  rows: unknown[],
  overrides: Record<string, unknown>,
): Record<string, unknown>[] {
  const cols = getTableColumns(table) as Record<string, { dataType: string }>;
  const validKeys = Object.keys(cols);
  const out: Record<string, unknown>[] = [];

  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const clean: Record<string, unknown> = {};

    for (const key of validKeys) {
      const value = row[key];
      if (value === undefined) continue;
      if (value !== null && cols[key].dataType === "date") {
        const d = new Date(value as string);
        if (Number.isNaN(d.getTime())) continue; // skip unparseable timestamps
        clean[key] = d;
        continue;
      }
      clean[key] = value;
    }

    Object.assign(clean, overrides);
    out.push(clean);
  }

  return out;
}

/**
 * Re-insert previously-deleted rows. Returns the number of rows actually
 * restored (conflicts are skipped). Inserts in dependency order are the
 * caller's responsibility (e.g. accounts before their contacts/signals).
 */
export async function restoreRows<T extends PgTable>(
  table: T,
  rows: unknown[] | undefined,
  overrides: Record<string, unknown> = {},
): Promise<number> {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  const clean = sanitizeRowsForRestore(table, rows, overrides);
  if (clean.length === 0) return 0;
  // The rows are sanitized to the table's real columns at runtime, but their
  // static type is Record<string, unknown>, so cast for the generic insert.
  const inserted = await db
    .insert(table)
    .values(clean as never)
    .onConflictDoNothing()
    .returning();
  return inserted.length;
}
