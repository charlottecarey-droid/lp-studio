import { Router, type IRouter } from "express";
import { chromium, type Browser } from "playwright";
import { mkdtempSync, readdirSync, readFileSync, unlinkSync, rmdirSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execSync } from "child_process";
import { logger } from "../lib/logger.js";

function findChromiumPath(): string | undefined {
  try {
    return execSync("which chromium 2>/dev/null || which chromium-browser 2>/dev/null || which google-chrome-stable 2>/dev/null || echo ''")
      .toString()
      .trim() || undefined;
  } catch {
    return undefined;
  }
}

const CHROMIUM_EXECUTABLE = findChromiumPath();

const router: IRouter = Router();

const VIDEO_CONFIGS: Record<
  string,
  { url: string; totalMs: number; filename: string }
> = {
  clinical: {
    url: "http://localhost:22714/dandy-insights-video/",
    totalMs: 41000,
    filename: "dandy-insights-clinical.webm",
  },
  biz: {
    url: "http://localhost:21012/dandy-biz-video/",
    totalMs: 40500,
    filename: "dandy-insights-business.webm",
  },
};

function cleanupDir(dir: string) {
  try {
    if (!existsSync(dir)) return;
    readdirSync(dir).forEach((f) => {
      try { unlinkSync(join(dir, f)); } catch {}
    });
    rmdirSync(dir);
  } catch {}
}

router.get("/video/render", async (req, res) => {
  const videoKey = req.query.video as string;
  const config = VIDEO_CONFIGS[videoKey];

  if (!config) {
    res.status(400).json({ error: "Invalid video. Use ?video=clinical or ?video=biz" });
    return;
  }

  logger.info({ videoKey }, "Starting server-side video render");

  const tempDir = mkdtempSync(join(tmpdir(), "dandy-video-"));
  let browser: Browser | null = null;

  try {
    req.socket.setNoDelay(true);
    req.socket.setTimeout(0);

    if (CHROMIUM_EXECUTABLE) {
      logger.info({ executablePath: CHROMIUM_EXECUTABLE }, "Using system Chromium");
    }

    browser = await chromium.launch({
      headless: true,
      executablePath: CHROMIUM_EXECUTABLE,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-web-security",
        "--autoplay-policy=no-user-gesture-required",
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: {
        dir: tempDir,
        size: { width: 1280, height: 720 },
      },
    });

    const page = await context.newPage();

    await page.goto(config.url, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    logger.info({ videoKey }, "Page loaded, recording for full duration");

    await page.waitForTimeout(config.totalMs + 2000);

    await context.close();
    await browser.close();
    browser = null;

    const files = readdirSync(tempDir).filter((f) => f.endsWith(".webm"));
    if (files.length === 0) {
      throw new Error("No video file was produced");
    }

    const videoPath = join(tempDir, files[0]);
    const videoData = readFileSync(videoPath);

    logger.info({ videoKey, bytes: videoData.length }, "Render complete, sending file");

    res.setHeader("Content-Type", "video/webm");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${config.filename}"`,
    );
    res.setHeader("Content-Length", videoData.length);
    res.send(videoData);

    cleanupDir(tempDir);
  } catch (err: unknown) {
    logger.error({ err, videoKey }, "Video render failed");

    if (browser) {
      await browser.close().catch(() => {});
    }
    cleanupDir(tempDir);

    if (!res.headersSent) {
      const msg = err instanceof Error ? err.message : "Video render failed";
      res.status(500).json({ error: msg });
    }
  }
});

export default router;
