/**
 * One-time data migration (task #861): encrypt still-plaintext Salesforce OAuth
 * tokens in `sfdc_connections` (access_token, refresh_token) in place.
 *
 * Idempotent + re-runnable: only token columns that are non-empty AND not
 * already carrying the `v1:` envelope prefix are encrypted. Rows where both
 * tokens are already encrypted (or empty, e.g. disconnected) are skipped.
 *
 * Targets STAGING_DATABASE_URL when set, otherwise NEON_DATABASE_URL. Requires
 * CREDENTIAL_ENCRYPTION_KEY to be set in the environment — the same key the app
 * uses, or the backfill will encrypt with the dev fallback and the app won't be
 * able to decrypt.
 *
 * Usage:
 *   STAGING_DATABASE_URL="..." CREDENTIAL_ENCRYPTION_KEY="..." \
 *     tsx artifacts/api-server/scripts/backfill-encrypt-sfdc-tokens.ts
 *   # verify, then point at prod:
 *   NEON_DATABASE_URL="..." CREDENTIAL_ENCRYPTION_KEY="..." \
 *     tsx artifacts/api-server/scripts/backfill-encrypt-sfdc-tokens.ts
 */
import { Pool } from "pg";
import { encryptCredential } from "../src/lib/encryption";

const url = process.env.STAGING_DATABASE_URL ?? process.env.NEON_DATABASE_URL;
if (!url) {
  console.error("Need STAGING_DATABASE_URL or NEON_DATABASE_URL");
  process.exit(1);
}

if (process.env.NODE_ENV !== "production" && !process.env.CREDENTIAL_ENCRYPTION_KEY) {
  console.error(
    "Refusing to run: CREDENTIAL_ENCRYPTION_KEY is not set. Backfilling with " +
      "the dev fallback key would write data the app can't decrypt. Set the " +
      "same key the target app uses and re-run.",
  );
  process.exit(1);
}

const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

/** Encrypt a token only when it's non-empty and not already a v1: envelope. */
function maybeEncrypt(value: string | null): string | null {
  if (value == null || value === "" || value.startsWith("v1:")) return value;
  return encryptCredential(value);
}

async function main() {
  const { rows } = await pool.query<{ id: number; access_token: string | null; refresh_token: string | null }>(
    `SELECT id, access_token, refresh_token FROM sfdc_connections`,
  );

  console.log(`Found ${rows.length} sfdc_connections rows to inspect.`);

  let encrypted = 0;
  let skipped = 0;
  for (const row of rows) {
    const newAccess = maybeEncrypt(row.access_token);
    const newRefresh = maybeEncrypt(row.refresh_token);

    if (newAccess === row.access_token && newRefresh === row.refresh_token) {
      skipped++;
      continue;
    }

    await pool.query(
      `UPDATE sfdc_connections SET access_token = $1, refresh_token = $2 WHERE id = $3`,
      [newAccess, newRefresh, row.id],
    );
    encrypted++;
    console.log(`  Encrypted tokens for sfdc_connection ${row.id}`);
  }

  console.log(
    `Done. Encrypted ${encrypted}, skipped ${skipped} (already encrypted or empty).`,
  );
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
