/**
 * Fetch the readable copy from a URL so a tenant can turn a page they admire
 * into a microsite exemplar without copy-pasting by hand. The Brand Settings
 * "Your microsite exemplars" editor calls this, then drops the returned text
 * into the exemplar's `content` field.
 *
 * The page is scraped by Firecrawl (not by our server directly), so this is
 * not an SSRF vector. We still validate the URL is plain http(s) and gate the
 * endpoint behind the sales-console plan + auth so it can't be used to burn
 * our scraping quota anonymously. The result is capped to the same length the
 * generator's exemplar parser keeps (parseCustomExemplars MAX_CONTENT).
 */
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth, getTenantId } from "../../middleware/requireAuth";
import { scrapeWebsite } from "../../lib/briefing-service";

const router = Router();

/** Keep in sync with parseCustomExemplars' MAX_CONTENT in microsite-exemplars.ts. */
const MAX_CONTENT = 4000;

// Each fetch triggers a ~15s Firecrawl scrape, so cap how often an authenticated
// user can fire one off and burn our scraping quota. Mirrors the sibling
// microsite-generation limiter (generate-microsite.ts).
const fetchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many fetch requests. Please wait a moment before trying again." },
});

router.post("/microsite-exemplars/fetch", requireAuth, fetchLimiter, async (req, res): Promise<void> => {
  // Resolve (and require) a tenant context purely to gate the endpoint; the
  // scrape itself reads no tenant data.
  if (getTenantId(req, res) === null) return;

  const rawUrl =
    typeof (req.body as { url?: unknown })?.url === "string"
      ? (req.body as { url: string }).url.trim()
      : "";
  if (!rawUrl) {
    res.status(400).json({ error: "A URL is required." });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    res.status(400).json({ error: "That doesn't look like a valid URL." });
    return;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    res.status(400).json({ error: "Only http:// and https:// URLs are supported." });
    return;
  }

  try {
    const markdown = await scrapeWebsite(parsed.toString());
    const content = markdown.trim().slice(0, MAX_CONTENT);
    if (!content) {
      res.status(502).json({
        error: "Couldn't read that page. Paste the copy in manually instead.",
      });
      return;
    }
    res.json({ content });
  } catch (err) {
    console.error("[microsite-exemplars] fetch failed:", err);
    res.status(502).json({
      error: "Couldn't read that page. Paste the copy in manually instead.",
    });
  }
});

export default router;
