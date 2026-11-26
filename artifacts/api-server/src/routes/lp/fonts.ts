/**
 * GET /api/lp/fonts/:file — self-hosted brand font files at a STABLE address.
 *
 * The SPA bundles these fonts through Vite, which renames them per build
 * (/assets/BagossStandard-Regular-<hash>.woff2), and /assets is served without
 * CORS. So a custom HTML block (an opaque-origin iframe) or exported page that
 * pointed at the bundled file broke on the next release. This route serves the
 * same files under a name that never changes, with CORS open so any page or
 * iframe can load them. Public (fonts are already public in every page).
 */
import { Router } from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const router = Router();

/** Font files we serve: name → content type. Only these names, so no path tricks. */
export const STABLE_FONT_FILES: Record<string, string> = {
  "BagossStandard-Regular.woff2": "font/woff2",
  "BagossStandard-Regular.woff": "font/woff",
  "BagossStandard-Regular.ttf": "font/ttf",
};

function fontDir(): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, "../../lp-studio/src/fonts"), // dist/index.mjs → artifacts/lp-studio/src/fonts
    path.resolve(here, "../../../../lp-studio/src/fonts"), // src/routes/lp → artifacts/lp-studio/src/fonts
    path.resolve(process.cwd(), "artifacts/lp-studio/src/fonts"),
    path.resolve(process.cwd(), "../lp-studio/src/fonts"),
  ];
  return candidates.find((d) => existsSync(path.join(d, "BagossStandard-Regular.woff2"))) ?? null;
}

let cachedDir: string | null | undefined;

router.get("/lp/fonts/:file", (req, res): void => {
  const file = String(req.params.file);
  const type = STABLE_FONT_FILES[file];
  if (cachedDir === undefined) cachedDir = fontDir();
  if (!type || !cachedDir) {
    res.status(404).json({ error: "Font not found" });
    return;
  }
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Content-Type", type);
  // Stable name, so cache for a day (not immutable: the file may be updated in place).
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.sendFile(path.join(cachedDir, file));
});

export default router;
