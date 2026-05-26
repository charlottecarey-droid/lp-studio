import { Router, type Request, type Response } from "express";
import { z } from "zod";
import dns from "dns/promises";
import net from "net";
import http from "http";
import https from "https";

const router = Router();

/* ------------------------------------------------------------------------- */
/* SSRF protection — block requests to loopback, link-local, and RFC1918     */
/* addresses so the public RSS proxy cannot be abused to probe internal      */
/* services.                                                                 */
/*                                                                           */
/* Defence-in-depth approach:                                                */
/*  1. Always resolve via dns.lookup (normalises literal IPs too, so        */
/*     expanded IPv6 forms like 0:0:0:0:0:0:0:1 → ::1 are handled).        */
/*  2. Validate every resolved address against private ranges.              */
/*  3. Connect directly to the validated IP using Node's http/https module  */
/*     while keeping the original hostname in Host / TLS-SNI — this closes  */
/*     the DNS-rebinding window between validation and connection.           */
/*  4. Follow redirects manually; re-validate every hop's hostname.         */
/*  5. Reject redirects to non-http(s) schemes.                             */
/* ------------------------------------------------------------------------- */

const PRIVATE_IP_PATTERNS: RegExp[] = [
  /^127\./,                                              // IPv4 loopback
  /^::1$/,                                               // IPv6 loopback (normalised)
  /^0+\.0+\.0+\.0+$/,                                   // "this" network
  /^169\.254\./,                                         // IPv4 link-local
  /^fe80:/i,                                             // IPv6 link-local
  /^10\./,                                               // RFC1918 class A
  /^172\.(1[6-9]|2\d|3[01])\./,                         // RFC1918 class B
  /^192\.168\./,                                         // RFC1918 class C
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,          // CGNAT (RFC6598)
  /^fc[0-9a-f]{2}:/i,                                   // IPv6 unique-local fc::/7
  /^fd[0-9a-f]{2}:/i,                                   // IPv6 unique-local fd::/8
  /^::ffff:/i,                                           // IPv4-mapped IPv6
];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_PATTERNS.some(re => re.test(ip));
}

/**
 * Resolve `hostname` to all its addresses (dns.lookup normalises literal IPs,
 * so expanded IPv6 forms are canonicalised before the private-range check).
 * Throws if any resolved address falls inside a blocked range.
 * Returns the first resolved address so the caller can connect to it
 * directly (eliminating the DNS-rebinding window).
 */
async function resolveAndValidate(hostname: string): Promise<string> {
  let addrs: { address: string; family: number }[];
  try {
    addrs = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error("Unable to resolve RSS feed hostname");
  }
  if (addrs.length === 0) {
    throw new Error("Unable to resolve RSS feed hostname");
  }
  for (const { address } of addrs) {
    if (isPrivateIp(address)) {
      throw new Error("URL resolves to a blocked network address");
    }
  }
  return addrs[0].address;
}

interface LightResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

/**
 * Make a single HTTP(S) request to the pre-validated `ip`, using `parsed`
 * for the path, Host header, and TLS SNI.  Connecting to the resolved IP
 * directly prevents a second DNS lookup at the socket layer, removing the
 * DNS-rebinding window between our validation step and the actual connection.
 */
function requestToIp(
  parsed: URL,
  ip: string,
  signal: AbortSignal,
): Promise<LightResponse> {
  return new Promise((resolve, reject) => {
    const isHttps = parsed.protocol === "https:";
    const defaultPort = isHttps ? 443 : 80;
    const port = parsed.port ? parseInt(parsed.port, 10) : defaultPort;
    const hostHeader =
      parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;

    const options: http.RequestOptions | https.RequestOptions = {
      hostname: ip,
      port,
      path: (parsed.pathname || "/") + parsed.search,
      method: "GET",
      headers: {
        Host: hostHeader,
        "User-Agent": "LandingPageStudio-RSS/1.0",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      ...(isHttps && {
        servername: parsed.hostname,
        rejectUnauthorized: true,
      }),
    };

    const lib = isHttps ? https : http;
    const req = lib.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        const status = res.statusCode ?? 0;
        const rawHeaders = res.headers;
        resolve({
          ok: status >= 200 && status < 300,
          status,
          statusText: res.statusMessage ?? "",
          headers: {
            get(name: string): string | null {
              const v = rawHeaders[name.toLowerCase()];
              return Array.isArray(v) ? v[0] : (v ?? null);
            },
          },
          text: async () => body,
        });
      });
      res.on("error", reject);
    });

    const onAbort = () => req.destroy(new Error("Request aborted"));
    signal.addEventListener("abort", onAbort);
    req.on("close", () => signal.removeEventListener("abort", onAbort));
    req.on("error", reject);
    req.end();
  });
}

const MAX_REDIRECTS = 5;

async function safeFetch(url: string, signal: AbortSignal): Promise<LightResponse> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = new URL(current);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Only http(s) URLs are permitted");
    }
    const ip = await resolveAndValidate(parsed.hostname);
    const resp = await requestToIp(parsed, ip, signal);

    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get("location");
      if (!location) throw new Error("Redirect with no Location header");
      const next = new URL(location, current);
      if (next.protocol !== "http:" && next.protocol !== "https:") {
        throw new Error("Redirect to non-http(s) protocol blocked");
      }
      current = next.href;
      continue;
    }

    return resp;
  }
  throw new Error("Too many redirects");
}

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
    let resp: LightResponse;
    try {
      resp = await safeFetch(url, ac.signal);
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
