import { Router, type IRouter } from "express";
import { chromium, type Browser } from "playwright";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  rmdirSync,
  existsSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execSync, spawnSync } from "child_process";
import { logger } from "../lib/logger.js";

function findChromiumPath(): string | undefined {
  try {
    return (
      execSync(
        "which chromium 2>/dev/null || which chromium-browser 2>/dev/null || which google-chrome-stable 2>/dev/null || echo ''",
      )
        .toString()
        .trim() || undefined
    );
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
    filename: "dandy-insights-clinical.mp4",
  },
  biz: {
    url: "http://localhost:21012/dandy-biz-video/",
    totalMs: 40500,
    filename: "dandy-insights-business.mp4",
  },
  combined: {
    url: "http://localhost:24253/dandy-combined-video/",
    totalMs: 51000,
    filename: "dandy-insights-combined.mp4",
  },
};

function cleanupDir(dir: string) {
  try {
    if (!existsSync(dir)) return;
    readdirSync(dir).forEach((f) => {
      try {
        unlinkSync(join(dir, f));
      } catch {}
    });
    rmdirSync(dir);
  } catch {}
}

function transcodeToMp4(webmPath: string, mp4Path: string): void {
  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-i", webmPath,
      "-c:v", "libx264",
      "-crf", "15",
      "-preset", "slow",
      "-pix_fmt", "yuv420p",
      // Subtle grain breaks up color banding on dark gradient backgrounds
      "-vf", "noise=alls=2:allf=t",
      "-colorspace", "bt709",
      "-color_primaries", "bt709",
      "-color_trc", "bt709",
      "-movflags", "+faststart",
      "-an",
      mp4Path,
    ],
    { timeout: 180_000 },
  );

  if (result.status !== 0) {
    const stderr = result.stderr?.toString() ?? "";
    throw new Error(`ffmpeg transcoding failed: ${stderr.slice(-400)}`);
  }
}

router.get("/video/render", async (req, res) => {
  const videoKey = req.query.video as string;
  const config = VIDEO_CONFIGS[videoKey];

  if (!config) {
    res
      .status(400)
      .json({ error: "Invalid video. Use ?video=clinical or ?video=biz" });
    return;
  }

  logger.info({ videoKey }, "Starting server-side video render");

  const tempDir = mkdtempSync(join(tmpdir(), "dandy-video-"));
  let browser: Browser | null = null;

  try {
    req.socket.setNoDelay(true);
    req.socket.setTimeout(0);

    if (CHROMIUM_EXECUTABLE) {
      logger.info(
        { executablePath: CHROMIUM_EXECUTABLE },
        "Using system Chromium",
      );
    }

    browser = await chromium.launch({
      headless: true,
      executablePath: CHROMIUM_EXECUTABLE,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        // Use SwiftShader (software GPU) instead of disabling GPU entirely —
        // gives more accurate gradient/radial-gradient rendering
        "--use-gl=swiftshader",
        "--enable-unsafe-swiftshader",
        "--disable-dev-shm-usage",
        "--disable-web-security",
        "--autoplay-policy=no-user-gesture-required",
        "--force-color-profile=srgb",
        // Prevent background throttling that stalls requestAnimationFrame in headless mode
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--disable-ipc-flooding-protection",
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: {
        dir: tempDir,
        size: { width: 1920, height: 1080 },
      },
    });

    const page = await context.newPage();

    await page.goto(config.url, {
      waitUntil: "load",
      timeout: 30000,
    });

    // Brief warm-up so fonts, GIFs and videos are decoded before scenes start
    await page.waitForTimeout(2000);

    logger.info({ videoKey }, "Page loaded, recording at 1920×1080");

    await page.waitForTimeout(config.totalMs + 2000);

    await context.close();
    await browser.close();
    browser = null;

    const webmFiles = readdirSync(tempDir).filter((f) => f.endsWith(".webm"));
    if (webmFiles.length === 0) {
      throw new Error("No WebM file was produced by Playwright");
    }

    const webmPath = join(tempDir, webmFiles[0]);
    const mp4Path = join(tempDir, "output.mp4");

    logger.info({ videoKey }, "Transcoding WebM → H.264 MP4 via ffmpeg");
    transcodeToMp4(webmPath, mp4Path);

    const videoData = readFileSync(mp4Path);
    logger.info(
      { videoKey, bytes: videoData.length },
      "Transcode complete, sending MP4",
    );

    res.setHeader("Content-Type", "video/mp4");
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
