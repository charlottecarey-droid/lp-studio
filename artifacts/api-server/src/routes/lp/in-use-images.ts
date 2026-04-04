import { Router } from "express";
import { db } from "@workspace/db";
import { lpPagesTable } from "@workspace/db";

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

router.get("/lp/in-use-images", async (_req, res): Promise<void> => {
  try {
    const pages = await db.select({ blocks: lpPagesTable.blocks }).from(lpPagesTable);
    const urlSet = new Set<string>();
    for (const page of pages) {
      if (!Array.isArray(page.blocks)) continue;
      for (const url of extractImageUrls(page.blocks)) {
        if (url.startsWith("http")) urlSet.add(url);
      }
    }
    res.json({ urls: [...urlSet] });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
