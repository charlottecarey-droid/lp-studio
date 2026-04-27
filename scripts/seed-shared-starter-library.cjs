#!/usr/bin/env node
/**
 * One-time seed: populate the shared "starter" image library so every tenant
 * (Royal, Max, future tenants) sees a baseline neutral image set in their
 * library on day one — without leaking any Dandy-branded content.
 *
 * Idempotent: skips uploads when an is_shared row with the same title already
 * exists. Re-run safely after editing STARTER_IMAGES below.
 *
 * Requires:
 *   - API server running on localhost:8080
 *   - ADMIN_PASSWORD env var
 *   - NEON_DATABASE_URL env var
 *   - Outbound HTTPS to fetch source URLs
 */
const path = require("path");
const { Client } = require(path.join(__dirname, "..", "lib", "db", "node_modules", "pg"));

const API_BASE = process.env.API_BASE || "http://localhost:8080";
const ADMIN_KEY = process.env.ADMIN_PASSWORD;
const DB_URL = process.env.NEON_DATABASE_URL;

if (!ADMIN_KEY) { console.error("ADMIN_PASSWORD env var required"); process.exit(1); }
if (!DB_URL)   { console.error("NEON_DATABASE_URL env var required"); process.exit(1); }

// Neutral, generic dental / healthcare / office stock images served by Unsplash.
// Tags drive what shows up in the editor's quick-pick filters.
const STARTER_IMAGES = [
  {
    title: "Modern Dental Practice",
    url: "https://plus.unsplash.com/premium_photo-1661776242582-0bb7c580e37e?fm=jpg&q=80&w=1600",
    tags: ["starter", "dental", "office", "interior"],
  },
  {
    title: "Smiling Patient",
    url: "https://plus.unsplash.com/premium_photo-1733306422832-2ad7280956e8?fm=jpg&q=80&w=1600",
    tags: ["starter", "patient", "smile", "people"],
  },
  {
    title: "Doctor at Work",
    url: "https://plus.unsplash.com/premium_photo-1683121051768-c17becde6735?fm=jpg&q=80&w=1600",
    tags: ["starter", "doctor", "healthcare", "people"],
  },
  {
    title: "Modern Office Interior",
    url: "https://plus.unsplash.com/premium_photo-1661938316795-02d427070b15?fm=jpg&q=80&w=1600",
    tags: ["starter", "office", "interior", "workspace"],
  },
];

async function alreadySeeded(client, title) {
  const r = await client.query(
    `SELECT id FROM lp_media
       WHERE is_shared = true AND tenant_id IS NULL AND title = $1
       LIMIT 1`,
    [title],
  );
  return r.rows[0]?.id ?? null;
}

async function fetchAsBuffer(srcUrl) {
  const res = await fetch(srcUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${srcUrl}`);
  const ct = res.headers.get("content-type") ?? "image/jpeg";
  // Normalize to a content-type the upload endpoint accepts.
  const mime = ct.split(";")[0].trim().toLowerCase();
  const buf = Buffer.from(await res.arrayBuffer());
  return { buf, mime: ["image/jpeg","image/png","image/webp","image/gif","image/avif","image/heic","image/heif"].includes(mime) ? mime : "image/jpeg" };
}

async function uploadShared(item) {
  const { buf, mime } = await fetchAsBuffer(item.url);
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const filename = item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "." + ext;

  const fd = new FormData();
  fd.append("file", new Blob([buf], { type: mime }), filename);
  fd.append("title", item.title);
  fd.append("tags", item.tags.join(","));
  // Note: NO tenantId field → endpoint defaults to is_shared=true, tenant_id=null

  const res = await fetch(`${API_BASE}/api/lp/media/shared/upload`, {
    method: "POST",
    headers: { "x-admin-key": ADMIN_KEY },
    body: fd,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Upload failed for ${item.title}: ${res.status} ${text}`);
  return JSON.parse(text);
}

(async () => {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    for (const item of STARTER_IMAGES) {
      const existing = await alreadySeeded(client, item.title);
      if (existing) {
        console.log(`[skip] "${item.title}" already shared (id=${existing})`);
        continue;
      }
      try {
        const out = await uploadShared(item);
        console.log(`[up]   "${item.title}" -> ${out.url} (id=${out.id}, tenantId=${out.tenantId}, isShared=${out.isShared})`);
      } catch (e) {
        console.error(`[err]  "${item.title}":`, e.message);
      }
    }
    const r = await client.query("SELECT id, title, url, tags FROM lp_media WHERE is_shared = true AND tenant_id IS NULL ORDER BY id");
    console.log(`\nShared starter library now has ${r.rows.length} image(s):`);
    for (const row of r.rows) console.log("  -", row.id, row.title);
  } finally {
    await client.end();
  }
})().catch((err) => { console.error(err); process.exit(1); });
