import { Router } from "express";
import { db } from "@workspace/db";
import { lpPagesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getTenantId } from "../../middleware/requireAuth";

const router = Router();

const IMAGE_SCALAR_PROPS = ["imageUrl", "backgroundImageUrl", "heroImageUrl", "mediaUrl"];
const IMAGE_ARRAY_SPECS = [
  { field: "rows",     key: "imageUrl" },
  { field: "items",    key: "image" },
  { field: "chapters", key: "imageUrl" },
  { field: "tiles",    key: "imageUrl" },
  { field: "cases",    key: "image" },
  { field: "images",   key: "src" },
];

// Scan only the tenant's most-recently-edited pages and hand back a bounded set
// of distinct image URLs. Without these caps the picker would (a) leak every
// other tenant's imagery on the shared DB and (b) ask the browser to decode
// hundreds of full-resolution images at once, which crashes mobile Safari's
// image decoder and renders the thumbnails as scrambled/garbled tiles.
const MAX_PAGES_SCANNED = 40;
const MAX_URLS_RETURNED = 40;

function extractImageUrls(blocks: unknown[]): string[] {
  const urls: string[] = [];
  for (const block of blocks) {
    const b = block as Record<string, unknown>;
    const props = (b.props ?? {}) as Record<string, unknown>;
    for (const f of IMAGE_SCALAR_PROPS) {
      if (typeof props[f] === "string" && props[f]) urls.push(props[f] as string);
    }
    for (const { field, key } of IMAGE_ARRAY_SPECS) {
      if (Array.isArray(props[field])) {
        for (const item of props[field] as Record<string, unknown>[]) {
          if (typeof item[key] === "string" && item[key]) urls.push(item[key] as string);
        }
      }
    }
  }
  return urls;
}

router.get("/lp/in-use-images", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;
  try {
    const pages = await db
      .select({ blocks: lpPagesTable.blocks })
      .from(lpPagesTable)
      .where(eq(lpPagesTable.tenantId, tenantId))
      .orderBy(desc(lpPagesTable.updatedAt))
      .limit(MAX_PAGES_SCANNED);
    const urlSet = new Set<string>();
    outer: for (const page of pages) {
      if (!Array.isArray(page.blocks)) continue;
      for (const url of extractImageUrls(page.blocks)) {
        if (url.startsWith("http")) {
          urlSet.add(url);
          if (urlSet.size >= MAX_URLS_RETURNED) break outer;
        }
      }
    }
    res.json({ urls: [...urlSet] });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
