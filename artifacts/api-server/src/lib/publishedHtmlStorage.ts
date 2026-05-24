/**
 * Object-Storage helpers for prerendered published landing-page HTML.
 *
 * One file per (tenantId, slug) at `<PRIVATE_OBJECT_DIR>/published-html/
 * <tenantId>/<slug>.html`. Tagged with a tenant-owner ACL so cross-tenant
 * reads are refused by the serve route even when the caller stumbles onto a
 * sibling tenant's path.
 *
 * Used by:
 *   - publish/approve hooks in routes/lp/pages.ts (write/refresh)
 *   - unpublish + DELETE hooks in routes/lp/pages.ts (delete)
 *   - GET /api/lp/rendered/:slug (read + stream)
 *
 * Task #364. Render-on-publish replaces the CF og-bot-router worker so real
 * visitors AND bots see per-page meta + DOM without the bot-vs-browser
 * branching that worker used to do at the edge.
 */
import { Storage, type File } from "@google-cloud/storage";
import { Readable } from "stream";
import {
  ACL_METADATA_KEY,
  tenantOwnerKey,
  type ObjectAclPolicy,
} from "./objectAcl";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// Use the same external-account auth dance the rest of the storage layer
// uses (see objectStorage.ts). We can't reuse the same `Storage` instance
// from objectStorage.ts because it's not exported; the cost of a second
// client is negligible (lazy connection pool).
const storageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

function getPrivateObjectDir(): string {
  const dir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!dir) throw new Error("PRIVATE_OBJECT_DIR env var is not set");
  return dir;
}

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) path = `/${path}`;
  const parts = path.split("/");
  if (parts.length < 3) throw new Error("Invalid object path");
  return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
}

function objectPathFor(tenantId: number, slug: string): string {
  let dir = getPrivateObjectDir();
  if (!dir.endsWith("/")) dir = `${dir}/`;
  // Slug is already URL-safe in the schema (validated upstream), but encode
  // anyway to be defensive against any path-traversal attempt sneaking
  // through (`../`, `/`, etc.).
  const safeSlug = encodeURIComponent(slug);
  return `${dir}published-html/${tenantId}/${safeSlug}.html`;
}

function fileFor(tenantId: number, slug: string): File {
  const { bucketName, objectName } = parseObjectPath(objectPathFor(tenantId, slug));
  return storageClient.bucket(bucketName).file(objectName);
}

/** Upload (or overwrite) the rendered HTML for a published page. */
export async function uploadPublishedHtml(
  tenantId: number,
  slug: string,
  html: string,
): Promise<void> {
  const file = fileFor(tenantId, slug);
  const policy: ObjectAclPolicy = {
    owner: tenantOwnerKey(tenantId),
    visibility: "private",
  };
  await file.save(Buffer.from(html, "utf8"), {
    contentType: "text/html; charset=utf-8",
    resumable: false,
    metadata: {
      metadata: { [ACL_METADATA_KEY]: JSON.stringify(policy) },
    },
  });
}

/**
 * Stream the published HTML for (tenant, slug). Returns null if no file
 * exists yet (publish never ran, or unpublish deleted it).
 */
export async function readPublishedHtml(
  tenantId: number,
  slug: string,
): Promise<{ html: string; updatedAt: Date | null } | null> {
  const file = fileFor(tenantId, slug);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [buffer] = await file.download();
  let updatedAt: Date | null = null;
  try {
    const [metadata] = await file.getMetadata();
    if (metadata.updated) updatedAt = new Date(metadata.updated as string);
  } catch {
    /* metadata is best-effort; the body is what matters */
  }
  return { html: buffer.toString("utf8"), updatedAt };
}

/** Best-effort delete. No-throw on "already gone". */
export async function deletePublishedHtml(
  tenantId: number,
  slug: string,
): Promise<void> {
  const file = fileFor(tenantId, slug);
  try {
    await file.delete({ ignoreNotFound: true });
  } catch (err) {
    // We never want a storage hiccup to fail a publish/delete request —
    // the DB row is the source of truth; the rendered file is a cache.
    console.warn("[publishedHtmlStorage] delete failed", { tenantId, slug, err });
  }
}

/** Stream helper for downstream Express handlers if we ever need it. */
export function fileAsReadableStream(file: File): Readable {
  return file.createReadStream();
}
