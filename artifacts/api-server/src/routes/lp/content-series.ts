// Routes backing the Content Series "notify subscribers about new episodes"
// feature (Task #806):
//   GET  /lp/content-series/notify-status  (authed) — subscriber/pending counts
//   POST /lp/content-series/notify         (authed) — manual send for one episode
//   GET  /lp/content-series/unsubscribe    (public) — signed-token lead opt-out
import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db, lpPagesTable } from "@workspace/db";
import { getTenantId } from "../../middleware/requireAuth";
import { getRequestHost } from "../../lib/requestHost";
import {
  extractContentSeriesBlocks,
  getEpisodeNotifyStatus,
  sendEpisodeNotifications,
  verifyLeadUnsubToken,
  recordLeadUnsubscribe,
  type SubscribeEpisode,
} from "../../lib/contentSeriesNotify";

const router = Router();

/** Find an episode (and its series title) by key within a page's blocks. */
async function resolveEpisode(
  tenantId: number,
  pageId: number,
  episodeKey: string,
): Promise<{ episode: SubscribeEpisode; seriesTitle: string } | null> {
  const [page] = await db
    .select({ tenantId: lpPagesTable.tenantId, blocks: lpPagesTable.blocks })
    .from(lpPagesTable)
    .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, pageId)));
  if (!page) return null;
  for (const block of extractContentSeriesBlocks(page.blocks)) {
    const ep = block.episodes.find((e) => e.key === episodeKey);
    if (ep) return { episode: ep, seriesTitle: block.seriesTitle };
  }
  return null;
}

const StatusQuery = z.object({
  pageId: z.coerce.number().int().positive(),
  episodeKey: z.string().min(1).max(200),
});

router.get("/lp/content-series/notify-status", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;
  const parsed = StatusQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { pageId, episodeKey } = parsed.data;
  // Tenant-scope the page before reporting counts.
  const [page] = await db
    .select({ id: lpPagesTable.id })
    .from(lpPagesTable)
    .where(and(eq(lpPagesTable.tenantId, tenantId), eq(lpPagesTable.id, pageId)));
  if (!page) {
    res.status(404).json({ error: "Page not found" });
    return;
  }
  const status = await getEpisodeNotifyStatus(tenantId, pageId, episodeKey);
  res.json(status);
});

const NotifyBody = z.object({
  pageId: z.number().int().positive(),
  episodeKey: z.string().min(1).max(200),
});

router.post("/lp/content-series/notify", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;
  const parsed = NotifyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { pageId, episodeKey } = parsed.data;
  const resolved = await resolveEpisode(tenantId, pageId, episodeKey);
  if (!resolved) {
    res.status(404).json({ error: "Episode not found on this page" });
    return;
  }
  const result = await sendEpisodeNotifications({
    tenantId,
    pageId,
    seriesTitle: resolved.seriesTitle,
    episode: resolved.episode,
    requestHost: getRequestHost(req),
  });
  res.json(result);
});

function unsubscribePage(message: string): string {
  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>Unsubscribe</title></head>
<body style="margin:0;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;background:#f4f4f5;">
  <div style="max-width:480px;margin:80px auto;background:#fff;border-radius:12px;padding:40px 32px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <p style="margin:0;font-size:16px;line-height:1.6;color:#111;">${message}</p>
  </div>
</body></html>`;
}

router.get("/lp/content-series/unsubscribe", async (req, res): Promise<void> => {
  const token = typeof req.query["token"] === "string" ? req.query["token"] : "";
  const payload = token ? verifyLeadUnsubToken(token) : null;
  if (!payload) {
    res
      .status(400)
      .type("html")
      .send(unsubscribePage("This unsubscribe link is invalid or has expired."));
    return;
  }
  try {
    await recordLeadUnsubscribe(payload.tenantId, payload.pageId, payload.email);
  } catch {
    res
      .status(500)
      .type("html")
      .send(unsubscribePage("Something went wrong. Please try again later."));
    return;
  }
  res
    .type("html")
    .send(
      unsubscribePage(
        "You've been unsubscribed. You won't receive any more emails about new episodes.",
      ),
    );
});

export default router;
