/**
 * One-time data migration (task #860): encrypt still-plaintext integration
 * credentials in `lp_integrations.config` in place.
 *
 * Idempotent + re-runnable: only fields that are credentials for their provider
 * AND not already carrying the `v1:` envelope prefix are encrypted. Rows where
 * every credential is already encrypted (or there are no credential fields) are
 * skipped.
 *
 * Targets STAGING_DATABASE_URL when set, otherwise NEON_DATABASE_URL. Requires
 * CREDENTIAL_ENCRYPTION_KEY to be set in the environment — the same key the app
 * uses, or the backfill will encrypt with the dev fallback and the app won't be
 * able to decrypt.
 *
 * Usage:
 *   STAGING_DATABASE_URL="..." CREDENTIAL_ENCRYPTION_KEY="..." \
 *     tsx artifacts/api-server/scripts/backfill-encrypt-integrations.ts
 *   # verify, then point at prod:
 *   NEON_DATABASE_URL="..." CREDENTIAL_ENCRYPTION_KEY="..." \
 *     tsx artifacts/api-server/scripts/backfill-encrypt-integrations.ts
 */
import { Pool } from "pg";
import { encryptConfigCredentials, isCredentialField } from "../src/lib/encryption";

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

async function main() {
  const { rows } = await pool.query<{ id: number; provider: string; config: unknown }>(
    `SELECT id, provider, config FROM lp_integrations WHERE config IS NOT NULL`,
  );

  console.log(`Found ${rows.length} integration rows to inspect.`);

  let encrypted = 0;
  let skipped = 0;
  for (const row of rows) {
    const { id, provider, config } = row;
    if (!config || typeof config !== "object") {
      skipped++;
      continue;
    }

    // Encrypt only when at least one credential field is still plaintext.
    const needsEncryption = Object.entries(config as Record<string, unknown>).some(
      ([field, value]) =>
        isCredentialField(provider, field) &&
        typeof value === "string" &&
        value !== "" &&
        !value.startsWith("v1:"),
    );

    if (!needsEncryption) {
      skipped++;
      continue;
    }

    const newConfig = encryptConfigCredentials(provider, config as Record<string, unknown>);
    await pool.query(`UPDATE lp_integrations SET config = $1::jsonb WHERE id = $2`, [
      JSON.stringify(newConfig),
      id,
    ]);
    encrypted++;
    console.log(`  Encrypted credentials for integration ${id} (${provider})`);
  }

  console.log(
    `Done. Encrypted ${encrypted}, skipped ${skipped} (already encrypted or no credentials).`,
  );
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
