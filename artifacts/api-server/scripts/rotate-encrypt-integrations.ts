/**
 * Key-rotation re-encrypt (task #862): re-encrypt every credential in
 * `lp_integrations.config` from the PREVIOUS encryption key to the ACTIVE one.
 *
 * Run this as step 2 of the two-key rotation procedure (see
 * `src/lib/encryption.ts` header):
 *   1. Set CREDENTIAL_ENCRYPTION_KEY = NEW key,
 *      CREDENTIAL_ENCRYPTION_KEY_PREVIOUS = OLD key, then redeploy the app.
 *   2. Run this script. It decrypts each credential with whichever key works
 *      (active first, previous as fallback) and re-encrypts under the active
 *      (new) key. Rows already under the active key are skipped.
 *   3. When this reports 0 remaining rows under the old key, remove
 *      CREDENTIAL_ENCRYPTION_KEY_PREVIOUS and redeploy.
 *
 * Idempotent + re-runnable + resumable: only fields decryptable solely by the
 * previous key are rewritten; a value already under the active key is left
 * untouched. Re-running after a completed rotation is a clean no-op.
 *
 * Targets STAGING_DATABASE_URL when set, otherwise NEON_DATABASE_URL. Requires
 * BOTH CREDENTIAL_ENCRYPTION_KEY (the new/active key) and
 * CREDENTIAL_ENCRYPTION_KEY_PREVIOUS (the old key) to be set — otherwise stored
 * ciphertext under the old key can't be decrypted and the rotation can't run.
 *
 * Usage:
 *   STAGING_DATABASE_URL="..." \
 *     CREDENTIAL_ENCRYPTION_KEY="<new>" CREDENTIAL_ENCRYPTION_KEY_PREVIOUS="<old>" \
 *     tsx artifacts/api-server/scripts/rotate-encrypt-integrations.ts
 *   # verify, then point at prod:
 *   NEON_DATABASE_URL="..." \
 *     CREDENTIAL_ENCRYPTION_KEY="<new>" CREDENTIAL_ENCRYPTION_KEY_PREVIOUS="<old>" \
 *     tsx artifacts/api-server/scripts/rotate-encrypt-integrations.ts
 */
import { Pool } from "pg";
import { rotateConfigCredentials } from "../src/lib/encryption";

const url = process.env.STAGING_DATABASE_URL ?? process.env.NEON_DATABASE_URL;
if (!url) {
  console.error("Need STAGING_DATABASE_URL or NEON_DATABASE_URL");
  process.exit(1);
}

if (!process.env.CREDENTIAL_ENCRYPTION_KEY) {
  console.error(
    "Refusing to run: CREDENTIAL_ENCRYPTION_KEY (the new/active key) is not set. " +
      "Rotation re-encrypts under the active key; without it credentials would be " +
      "re-encrypted with the dev fallback key the app can't decrypt.",
  );
  process.exit(1);
}

if (!process.env.CREDENTIAL_ENCRYPTION_KEY_PREVIOUS) {
  console.error(
    "Refusing to run: CREDENTIAL_ENCRYPTION_KEY_PREVIOUS (the old key) is not set. " +
      "It's needed to decrypt ciphertext still under the old key. Set it to the " +
      "key being rotated out and re-run.",
  );
  process.exit(1);
}

const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function main() {
  const { rows } = await pool.query<{ id: number; provider: string; config: unknown }>(
    `SELECT id, provider, config FROM lp_integrations WHERE config IS NOT NULL`,
  );

  console.log(`Found ${rows.length} integration rows to inspect.`);

  let rotated = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of rows) {
    const { id, provider, config } = row;
    if (!config || typeof config !== "object") {
      skipped++;
      continue;
    }

    let result: { config: Record<string, unknown>; rotated: number };
    try {
      result = rotateConfigCredentials(provider, config as Record<string, unknown>);
    } catch (err) {
      // Undecryptable by either key — surface loudly, keep going so one bad row
      // doesn't block rotating the rest.
      failed++;
      console.error(
        `  FAILED to rotate integration ${id} (${provider}): ${(err as Error).message}`,
      );
      continue;
    }

    if (result.rotated === 0) {
      skipped++;
      continue;
    }

    await pool.query(`UPDATE lp_integrations SET config = $1::jsonb WHERE id = $2`, [
      JSON.stringify(result.config),
      id,
    ]);
    rotated++;
    console.log(`  Rotated ${result.rotated} credential(s) for integration ${id} (${provider})`);
  }

  console.log(
    `Done. Rotated ${rotated}, skipped ${skipped} (already under active key or no credentials)` +
      (failed > 0 ? `, FAILED ${failed} (undecryptable — investigate before removing the previous key).` : "."),
  );
  await pool.end();

  // Non-zero exit if any row couldn't be rotated, so the operator doesn't
  // mistakenly remove CREDENTIAL_ENCRYPTION_KEY_PREVIOUS while ciphertext under
  // the old key remains.
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
