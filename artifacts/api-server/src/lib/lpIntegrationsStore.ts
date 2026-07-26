import { db, lpIntegrationsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { decryptConfigCredentials, encryptConfigCredentials } from "./encryption";

/**
 * Shared accessors for the lp_integrations provider store (google_sheets,
 * asana, webhook). Settings consolidation Phase 4: this replaces two
 * duplicated raw-SQL helpers (routes/lp/integrations.ts and
 * lib/exportDestinations.ts each carried their own copy of decrypt-on-read).
 *
 * Reads always return DECRYPTED config so every consumer (GET masking, PUT
 * merge, /test handlers, sync helpers, export destinations) works with the
 * live secret — and so the PUT merge → upsert re-encrypt can't double-encrypt
 * (`v1:v1:…`) a preserved-on-masked secret. Writes always encrypt the
 * whitelisted credential fields (CREDENTIAL_FIELDS_BY_PROVIDER) first.
 */
export async function getIntegration(
  provider: string,
  tenantId: number,
): Promise<{ config: unknown; enabled: boolean } | null> {
  const [row] = await db
    .select({ config: lpIntegrationsTable.config, enabled: lpIntegrationsTable.enabled })
    .from(lpIntegrationsTable)
    .where(and(eq(lpIntegrationsTable.provider, provider), eq(lpIntegrationsTable.tenantId, tenantId)));
  if (!row) return null;
  const config =
    row.config && typeof row.config === "object"
      ? decryptConfigCredentials(provider, row.config as Record<string, unknown>)
      : row.config;
  return { config, enabled: row.enabled };
}

export async function upsertIntegration(
  provider: string,
  config: unknown,
  enabled: boolean,
  tenantId: number,
): Promise<void> {
  const toStore =
    config && typeof config === "object"
      ? encryptConfigCredentials(provider, config as Record<string, unknown>)
      : config;
  await db
    .insert(lpIntegrationsTable)
    .values({ tenantId, provider, config: toStore, enabled, updatedAt: sql`now()` })
    .onConflictDoUpdate({
      target: [lpIntegrationsTable.tenantId, lpIntegrationsTable.provider],
      set: { config: toStore, enabled, updatedAt: sql`now()` },
    });
}
