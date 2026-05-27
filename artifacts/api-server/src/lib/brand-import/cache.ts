import { pool } from "@workspace/db";
import type { OrchestratorPayload } from "./types";

export function normalizeUrlKey(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    let pathname = u.pathname.replace(/\/+$/, "");
    if (!pathname) pathname = "/";
    const lang = u.searchParams.get("lang");
    const langSuffix = lang ? `?lang=${encodeURIComponent(lang)}` : "";
    return `${host}${pathname}${langSuffix}`;
  } catch {
    return rawUrl.toLowerCase();
  }
}

export async function getCached(rawUrl: string, maxAgeHours: number): Promise<OrchestratorPayload | null> {
  const key = normalizeUrlKey(rawUrl);
  try {
    const r = await pool.query<{ payload: OrchestratorPayload; created_at: Date }>(
      `SELECT payload, created_at
         FROM lp_brand_import_cache
        WHERE url_key = $1
          AND created_at > now() - ($2 || ' hours')::interval
        LIMIT 1`,
      [key, String(maxAgeHours)],
    );
    if (!r.rows.length) return null;
    return { ...r.rows[0].payload, cached: true };
  } catch {
    return null;
  }
}

export async function putCached(rawUrl: string, payload: OrchestratorPayload): Promise<void> {
  const key = normalizeUrlKey(rawUrl);
  try {
    await pool.query(
      `INSERT INTO lp_brand_import_cache (url_key, payload, created_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (url_key) DO UPDATE
         SET payload = EXCLUDED.payload, created_at = now()`,
      [key, JSON.stringify({ ...payload, cached: false })],
    );
  } catch {
    /* cache miss is non-fatal */
  }
}
