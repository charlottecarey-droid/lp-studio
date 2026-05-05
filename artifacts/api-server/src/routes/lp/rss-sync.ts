import { Router, type Request, type Response } from "express";
import { z } from "zod";

const router = Router();

/* ------------------------------------------------------------------------- */
/* Minimal podcast-RSS parser. Avoids adding a new dependency.               */
/* Handles RSS 2.0 + iTunes / media namespaces, which is the de-facto        */
/* standard used by Apple Podcasts, Spotify, Buzzsprout, Transistor, etc.    */
/* ------------------------------------------------------------------------- */

export interface ParsedEpisode {
  guid?: string;
  title: string;
  description: string;
  publishDate?: string;
  audioUrl?: string;
  thumbnailUrl?: string;
  durationSec?: number;
  episodeNumber?: number;
  season?: number;
  link?: string;
}

export interface ParsedFeed {
  title?: string;
  description?: string;
  imageUrl?: string;
  link?: string;
  episodes: ParsedEpisode[];
}

const decodeEntities = (s: string): string =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n: string) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&");

const stripHtml = (s: string): string =>
  s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

const stripCdata = (s: string): string => {
  const m = s.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return m ? m[1] : s;
};

const extractTag = (block: string, tag: string): string | undefined => {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  if (!m) return undefined;
  const raw = stripCdata(m[1]);
  return decodeEntities(raw).trim();
};

const extractAttr = (block: string, tag: string, attr: string): string | undefined => {
  const re = new RegExp(`<${tag}\\b[^>]*\\b${attr}\\s*=\\s*["']([^"']+)["'][^>]*\\/?>`, "i");
  const m = block.match(re);
  return m ? decodeEntities(m[1]) : undefined;
};

/** Parse iTunes duration: either "HH:MM:SS", "MM:SS", or seconds as a number. */
const parseDuration = (raw?: string): number | undefined => {
  if (!raw) return undefined;
  const s = raw.trim();
  if (/^\d+$/.test(s)) return Number(s);
  const parts = s.split(":").map(p => Number(p));
  if (parts.some(n => Number.isNaN(n))) return undefined;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return undefined;
};

const parseDate = (raw?: string): string | undefined => {
  if (!raw) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
};

export function parseRssXml(xml: string): ParsedFeed {
  const channelMatch = xml.match(/<channel\b[^>]*>([\s\S]*?)<\/channel>/i);
  const channel = channelMatch ? channelMatch[1] : xml;

  // Channel-level metadata
  const channelTitle = extractTag(channel, "title");
  const channelDesc = extractTag(channel, "description");
  const channelLink = extractTag(channel, "link");
  // Channel image: <image><url>...</url></image> OR <itunes:image href="...">
  let channelImage: string | undefined;
  const imageBlock = channel.match(/<image\b[^>]*>([\s\S]*?)<\/image>/i);
  if (imageBlock) channelImage = extractTag(imageBlock[1], "url");
  if (!channelImage) channelImage = extractAttr(channel, "itunes:image", "href");

  // Items
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  const episodes: ParsedEpisode[] = [];
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(channel)) !== null) {
    const item = m[1];
    const title = extractTag(item, "title") ?? "Untitled Episode";
    // Prefer itunes:summary or content:encoded for fuller descriptions; fall back to <description>
    const descRaw =
      extractTag(item, "itunes:summary") ??
      extractTag(item, "content:encoded") ??
      extractTag(item, "description") ??
      "";
    const description = stripHtml(descRaw);
    const publishDate = parseDate(extractTag(item, "pubDate"));
    const audioUrl = extractAttr(item, "enclosure", "url");
    const link = extractTag(item, "link");
    let thumbnailUrl =
      extractAttr(item, "itunes:image", "href") ??
      extractAttr(item, "media:thumbnail", "url") ??
      extractAttr(item, "media:content", "url");
    if (!thumbnailUrl) thumbnailUrl = channelImage;
    const durationSec = parseDuration(extractTag(item, "itunes:duration"));
    const episodeNumberRaw = extractTag(item, "itunes:episode");
    const seasonRaw = extractTag(item, "itunes:season");
    const guid = extractTag(item, "guid");
    episodes.push({
      guid,
      title,
      description: description.slice(0, 1200), // sane cap
      publishDate,
      audioUrl,
      thumbnailUrl,
      durationSec,
      episodeNumber: episodeNumberRaw ? Number(episodeNumberRaw) : undefined,
      season: seasonRaw ? Number(seasonRaw) : undefined,
      link,
    });
  }

  return {
    title: channelTitle,
    description: channelDesc ? stripHtml(channelDesc).slice(0, 1200) : undefined,
    imageUrl: channelImage,
    link: channelLink,
    episodes,
  };
}

/* ------------------------------------------------------------------------- */
/* POST /lp/rss/parse                                                         */
/* Public endpoint — called from both the builder panel (Sync now button)    */
/* and the published landing page (live merge on render).                    */
/* Body: { url: string }                                                     */
/* Returns: ParsedFeed                                                       */
/* ------------------------------------------------------------------------- */

const BodySchema = z.object({
  url: z.string().url().refine(u => /^https?:\/\//i.test(u), "URL must be http(s)"),
});

router.post("/lp/rss/parse", async (req: Request, res: Response) => {
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A valid http(s) URL is required" });
    return;
  }
  const { url } = parsed.data;
  try {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 15000);
    let resp: globalThis.Response;
    try {
      resp = await fetch(url, {
        signal: ac.signal,
        headers: {
          "User-Agent": "LandingPageStudio-RSS/1.0",
          Accept: "application/rss+xml, application/xml, text/xml, */*",
        },
        redirect: "follow",
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!resp.ok) {
      res.status(502).json({ error: `Feed responded ${resp.status} ${resp.statusText}` });
      return;
    }
    const xml = await resp.text();
    if (!xml || xml.length < 20) {
      res.status(502).json({ error: "Feed response was empty" });
      return;
    }
    if (!/<rss\b|<channel\b|<feed\b/i.test(xml)) {
      res.status(422).json({ error: "Response does not look like an RSS feed" });
      return;
    }
    const feed = parseRssXml(xml);
    res.json(feed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch RSS feed";
    req.log?.error?.({ err }, "rss parse failed");
    res.status(502).json({ error: msg });
  }
});

export default router;
